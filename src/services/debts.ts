// Per-debt store — the `debts` table is the SOURCE OF TRUTH for itemized debts (per-row provenance +
// soft-delete tombstones). The snapshot's `debts` / `debt_total` are a denormalized MIRROR this
// service syncs on every change, so existing read sites keep working unchanged. Closes redesign
// #3 (payoff merge) + #5 (manual CRUD). Mirrors services/subscriptionAudit.ts. See docs/debts-table.md.
import { withClient } from './supabaseClient';
import { TABLES } from './tables';
import { USE_AI_MOCKS } from '@/config/ai';
import {
  reconcileDebts, incomingDebtsFromAnalysis, onboardingDebtSeed,
  type DebtRecord, type DebtOps, type OnboardingExact, type Confidence,
} from '@shared/financialSnapshot';
import { syncDebtsMirror } from './financialSnapshot';
import type { FinalAnalysis } from '@shared/types';

/** A manual add/edit from the Debts UI (no provenance — the service stamps manual/stated). */
export interface ManualDebtInput {
  id?: string;
  name: string;
  balance: number;
  apr?: number;
  min_payment?: number;
  kind?: DebtRecord['kind'];
}

interface DebtRow {
  id: string; user_id: string; name: string; balance: number | string;
  apr: number | string | null; min_payment: number | string | null; kind: string | null;
  source: string; confidence: string; deleted_at: string | null;
}

const num = (v: number | string | null | undefined): number | undefined => (v == null ? undefined : Number(v));
const toRecord = (r: DebtRow): DebtRecord => ({
  id: r.id, name: r.name, balance: Number(r.balance), apr: num(r.apr), min_payment: num(r.min_payment),
  kind: (r.kind ?? undefined) as DebtRecord['kind'],
  source: r.source as DebtRecord['source'], confidence: r.confidence as DebtRecord['confidence'],
  deletedAt: r.deleted_at,
});

// ─── Dev mock store (USE_AI_MOCKS) — seeded from the mock snapshot's debts mirror ────────────
let mockId = 0;
let mockDebts: DebtRecord[] | null = USE_AI_MOCKS
  ? ((require('@/__fixtures__/mockHistory').MOCK_SNAPSHOT?.debts?.value ?? []) as DebtRecord[]).map((d) => ({
      id: `mock-debt-${mockId++}`, name: d.name, balance: d.balance, apr: d.apr, min_payment: d.min_payment,
      kind: d.kind, source: 'roast', confidence: 'medium', deletedAt: null,
    }))
  : null;

const activeOf = (rows: DebtRecord[]): DebtRecord[] => rows.filter((d) => d.deletedAt == null);

/** Read ALL rows incl. tombstoned — the reconcile needs them for the §3.2 re-add guard. */
async function readAll(userId: string): Promise<DebtRecord[]> {
  if (USE_AI_MOCKS) return mockDebts ?? [];
  return withClient<DebtRecord[]>('fetch debts', [], async (client) => {
    const { data, error } = await (client as any)
      .from(TABLES.debts).select('*').eq('user_id', userId).order('created_at', { ascending: true });
    if (error) throw error;
    return (data as DebtRow[]).map(toRecord);
  });
}

/** Active (non-tombstoned) debts — what the UI lists + the mirror/context use. */
export async function getDebts(userId: string): Promise<DebtRecord[]> {
  return activeOf(await readAll(userId));
}

/** Resync the snapshot mirror (debts + debt_total) from the current active rows. */
async function syncFromRows(userId: string, source: DebtRecord['source']): Promise<void> {
  await syncDebtsMirror(userId, await getDebts(userId), source);
}

/** Add or edit a debt manually → `manual`/`stated` (authoritative; never clobbered by an inferred roast). */
export async function upsertDebt(userId: string, input: ManualDebtInput): Promise<DebtRecord[]> {
  const fields = {
    name: input.name, balance: input.balance, apr: input.apr ?? null, min_payment: input.min_payment ?? null,
    kind: input.kind ?? null, source: 'manual' as const, confidence: 'stated' as const, deleted_at: null,
  };
  if (USE_AI_MOCKS) {
    const rec: DebtRecord = {
      id: input.id ?? `mock-debt-${mockId++}`, name: input.name, balance: input.balance, apr: input.apr,
      min_payment: input.min_payment, kind: input.kind, source: 'manual', confidence: 'stated', deletedAt: null,
    };
    const list = mockDebts ?? [];
    mockDebts = input.id && list.some((d) => d.id === input.id) ? list.map((d) => (d.id === input.id ? rec : d)) : [...list, rec];
  } else {
    await withClient('upsert debt', null, async (client) => {
      const t = (client as any).from(TABLES.debts);
      const { error } = input.id
        ? await t.update(fields).eq('id', input.id).eq('user_id', userId)
        : await t.insert({ ...fields, user_id: userId });
      if (error) throw error;
      return null;
    });
  }
  await syncFromRows(userId, 'manual');
  return getDebts(userId);
}

/** Soft-delete (tombstone) a debt — see §3.2; the row is kept so an inferred roast can't resurrect it. */
export async function deleteDebt(userId: string, debtId: string): Promise<DebtRecord[]> {
  const now = new Date().toISOString();
  if (USE_AI_MOCKS) {
    mockDebts = (mockDebts ?? []).map((d) => (d.id === debtId ? { ...d, deletedAt: now } : d));
  } else {
    await withClient('delete debt', null, async (client) => {
      const { error } = await (client as any)
        .from(TABLES.debts).update({ deleted_at: now }).eq('id', debtId).eq('user_id', userId);
      if (error) throw error;
      return null;
    });
  }
  await syncFromRows(userId, 'manual');
  return getDebts(userId);
}

async function applyOps(userId: string, ops: DebtOps): Promise<void> {
  if (!ops.inserts.length && !ops.updates.length && !ops.deleteIds.length) return;
  if (USE_AI_MOCKS) {
    let list = mockDebts ?? [];
    for (const ins of ops.inserts) list = [...list, { ...ins, id: `mock-debt-${mockId++}` }];
    for (const up of ops.updates) list = list.map((d) => (d.id === up.id ? { ...d, ...up } : d));
    if (ops.deleteIds.length) {
      const now = new Date().toISOString();
      const del = new Set(ops.deleteIds);
      list = list.map((d) => (d.id && del.has(d.id) ? { ...d, deletedAt: now } : d));
    }
    mockDebts = list;
    return;
  }
  await withClient('apply debt ops', null, async (client) => {
    const t = () => (client as any).from(TABLES.debts);
    for (const ins of ops.inserts) {
      const { error } = await t().insert({
        user_id: userId, name: ins.name, balance: ins.balance, apr: ins.apr ?? null,
        min_payment: ins.min_payment ?? null, kind: ins.kind ?? null, source: ins.source, confidence: ins.confidence,
      });
      if (error) throw error;
    }
    for (const up of ops.updates) {
      const patch: Record<string, unknown> = {
        balance: up.balance, apr: up.apr ?? null, min_payment: up.min_payment ?? null,
        kind: up.kind ?? null, source: up.source, confidence: up.confidence,
      };
      if (up.deletedAt === null) patch.deleted_at = null; // lift a tombstone (§3.2 user_stated re-add)
      const { error } = await t().update(patch).eq('id', up.id).eq('user_id', userId);
      if (error) throw error;
    }
    if (ops.deleteIds.length) {
      const { error } = await t().update({ deleted_at: new Date().toISOString() }).in('id', ops.deleteIds).eq('user_id', userId);
      if (error) throw error;
    }
    return null;
  });
}

/** Reconcile a roast's extracted debts into the table (confidence-gated; honors `debtsCleared`). */
export async function reconcileFromAnalysis(userId: string, analysis: FinalAnalysis): Promise<void> {
  const existing = await readAll(userId);
  const incoming = incomingDebtsFromAnalysis(analysis as Parameters<typeof incomingDebtsFromAnalysis>[0]);
  const debtsCleared = !!(analysis as { debtsCleared?: boolean }).debtsCleared;
  if (!existing.length && !incoming.length && !debtsCleared) return; // nothing to do
  await applyOps(userId, reconcileDebts(existing, incoming, 'roast', { debtsCleared }));
  await syncFromRows(userId, 'roast');
}

/** Check-in balance refresh — update matched active rows' balances by name (case-insensitive). */
export async function applyCheckinBalances(userId: string, updates: Record<string, number>): Promise<DebtRecord[]> {
  const keys = Object.keys(updates);
  if (!keys.length) return getDebts(userId);
  const norm = (n: string) => n.trim().toLowerCase();
  const byName = new Map(keys.map((n) => [norm(n), updates[n]]));
  const active = await getDebts(userId);
  const changes = active.filter((d) => {
    const nb = byName.get(norm(d.name));
    return d.id && nb != null && Number.isFinite(nb) && nb >= 0 && nb !== d.balance;
  });
  if (!changes.length) return active;
  if (USE_AI_MOCKS) {
    const next = new Map(changes.map((d) => [d.id!, byName.get(norm(d.name))!]));
    mockDebts = (mockDebts ?? []).map((d) =>
      d.id && next.has(d.id) ? { ...d, balance: next.get(d.id)!, source: 'checkin', confidence: 'stated' } : d);
  } else {
    await withClient('checkin debt balances', null, async (client) => {
      for (const d of changes) {
        const { error } = await (client as any)
          .from(TABLES.debts).update({ balance: byName.get(norm(d.name)), source: 'checkin', confidence: 'stated' })
          .eq('id', d.id).eq('user_id', userId);
        if (error) throw error;
      }
      return null;
    });
  }
  await syncFromRows(userId, 'checkin');
  return getDebts(userId);
}

/** Seed the coarse onboarding debt line — only when the user has no debts yet (idempotent on re-save). */
export async function seedOnboardingDebt(userId: string, ctx: { debtBracket?: string }, exact?: OnboardingExact): Promise<void> {
  if ((await getDebts(userId)).length > 0) return;
  const seed = onboardingDebtSeed(ctx, exact);
  if (!seed) return;
  const confidence: Confidence = seed.source === 'user_stated' ? 'stated' : (seed.confidence ?? 'estimated');
  if (USE_AI_MOCKS) {
    mockDebts = [...(mockDebts ?? []), {
      id: `mock-debt-${mockId++}`, name: seed.name, balance: seed.balance, apr: seed.apr,
      min_payment: seed.min_payment, kind: seed.kind, source: 'onboarding', confidence, deletedAt: null,
    }];
  } else {
    await withClient('seed onboarding debt', null, async (client) => {
      const { error } = await (client as any).from(TABLES.debts).insert({
        user_id: userId, name: seed.name, balance: seed.balance, apr: seed.apr ?? null,
        min_payment: seed.min_payment ?? null, kind: seed.kind ?? null, source: 'onboarding', confidence,
      });
      if (error) throw error;
      return null;
    });
  }
  await syncFromRows(userId, 'onboarding');
}

/**
 * A short context line summarizing the user's current debts, for injection into the roast / re-score
 * input (mirrors getSubscriptionContext). Active rows only — tombstoned debts are excluded (§3.2,
 * so we never remind the model of a debt the user deleted). Returns '' when nothing is logged.
 */
export async function getDebtContext(userId: string): Promise<string> {
  const debts = await getDebts(userId);
  if (!debts.length) return '';
  const total = debts.reduce((sum, d) => sum + (d.balance || 0), 0);
  const items = debts.slice(0, 6).map((d) => `${d.name} $${Math.round(d.balance)}`).join(', ');
  return ` (For context, my current debts total about $${Math.round(total)}: ${items}.)`;
}
