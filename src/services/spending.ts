// Named-spending store — the `spending` table is the source of truth for the user's PARTIAL
// spending breakdown (rent, takeout, …). Light user CRUD + each roast merges its mentioned
// categories in. Mirrors services/subscriptionAudit.ts; merge logic is shared/spending.ts.
//
// Simpler than debts: every item is user-stated (no provenance), no soft-delete tombstone, and no
// snapshot mirror (the breakdown feeds no score). It is a PARTIAL list — sum != monthlyExpenses.
import { withClient } from './supabaseClient';
import { TABLES } from './tables';
import { USE_AI_MOCKS } from '@/config/ai';
import { mergeSpending, incomingSpendingFromAnalysis, type SpendingItem, type SpendingOps } from '@shared/spending';
import type { FinalAnalysis } from '@shared/types';

/** A manual add/edit from the spending UI. */
export interface ManualSpendingInput {
  id?: string;
  category: string;
  amount: number;
}

interface SpendingRow { id: string; user_id: string; category: string; amount: number | string }
const toItem = (r: SpendingRow): SpendingItem => ({ id: r.id, category: r.category, amount: Number(r.amount) });

// ─── Dev mock store (USE_AI_MOCKS) — starts empty; roasts populate it ─────────
let mockId = 0;
let mockSpending: SpendingItem[] | null = USE_AI_MOCKS ? [] : null;

async function readAll(userId: string): Promise<SpendingItem[]> {
  if (USE_AI_MOCKS) return mockSpending ?? [];
  return withClient<SpendingItem[]>('fetch spending', [], async (client) => {
    const { data, error } = await (client as any)
      .from(TABLES.spending).select('*').eq('user_id', userId).order('created_at', { ascending: true });
    if (error) throw error;
    return (data as SpendingRow[]).map(toItem);
  });
}

/** The user's current named-spending breakdown (partial — does not sum to monthlyExpenses). */
export async function getSpending(userId: string): Promise<SpendingItem[]> {
  return readAll(userId);
}

/** Add or edit a spending category manually. */
export async function upsertSpending(userId: string, input: ManualSpendingInput): Promise<SpendingItem[]> {
  if (USE_AI_MOCKS) {
    const item: SpendingItem = { id: input.id ?? `mock-spend-${mockId++}`, category: input.category, amount: input.amount };
    const list = mockSpending ?? [];
    mockSpending = input.id && list.some((s) => s.id === input.id) ? list.map((s) => (s.id === input.id ? item : s)) : [...list, item];
  } else {
    await withClient('upsert spending', null, async (client) => {
      const t = (client as any).from(TABLES.spending);
      const { error } = input.id
        ? await t.update({ category: input.category, amount: input.amount }).eq('id', input.id).eq('user_id', userId)
        : await t.insert({ user_id: userId, category: input.category, amount: input.amount });
      if (error) throw error;
      return null;
    });
  }
  return getSpending(userId);
}

/** Remove a spending category (hard delete — no tombstone needed; a roast only re-adds it if the
 *  user mentions it again, which is legitimate). */
export async function deleteSpending(userId: string, id: string): Promise<SpendingItem[]> {
  if (USE_AI_MOCKS) {
    mockSpending = (mockSpending ?? []).filter((s) => s.id !== id);
  } else {
    await withClient('delete spending', null, async (client) => {
      const { error } = await (client as any).from(TABLES.spending).delete().eq('id', id).eq('user_id', userId);
      if (error) throw error;
      return null;
    });
  }
  return getSpending(userId);
}

async function applyOps(userId: string, ops: SpendingOps): Promise<void> {
  if (!ops.inserts.length && !ops.updates.length) return;
  if (USE_AI_MOCKS) {
    let list = mockSpending ?? [];
    for (const ins of ops.inserts) list = [...list, { ...ins, id: `mock-spend-${mockId++}` }];
    for (const up of ops.updates) list = list.map((s) => (s.id === up.id ? { ...s, ...up } : s));
    mockSpending = list;
    return;
  }
  await withClient('apply spending ops', null, async (client) => {
    const t = () => (client as any).from(TABLES.spending);
    for (const ins of ops.inserts) {
      const { error } = await t().insert({ user_id: userId, category: ins.category, amount: ins.amount });
      if (error) throw error;
    }
    for (const up of ops.updates) {
      const { error } = await t().update({ amount: up.amount }).eq('id', up.id).eq('user_id', userId);
      if (error) throw error;
    }
    return null;
  });
}

/** Merge a roast's mentioned categories into the store (upsert-by-category; silent categories kept). */
export async function reconcileSpendingFromAnalysis(userId: string, analysis: FinalAnalysis): Promise<void> {
  const incoming = incomingSpendingFromAnalysis(analysis as Parameters<typeof incomingSpendingFromAnalysis>[0]);
  if (!incoming.length) return;
  await applyOps(userId, mergeSpending(await readAll(userId), incoming));
}
