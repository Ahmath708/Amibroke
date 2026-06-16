// Financial snapshot service (Phase 2a of the unified financial model — see
// docs/unified-financial-model.md). The single per-user "current financial state" every
// feature reads. Written by onboarding (seed), each roast (confident-merge), and later
// check-ins/manual edits. Merge logic + DB mapping live in @shared/financialSnapshot.
// In dev (USE_AI_MOCKS) it uses an in-memory store so the flow works on the sim before the
// migration is pushed (mirrors services/activePlan).
import { withClient } from './supabaseClient';
import { TABLES } from './tables';
import { getAnalysisById } from './analyses';
import { getSubscriptionContext } from './subscriptionAudit';
import { USE_AI_MOCKS } from '@/config/ai';
import {
  mergeIntoSnapshot, applyDebtUpdates, fromRow, toRow, patchFromAnalysis, patchFromOnboarding,
  type FinancialSnapshot, type SnapshotPatch, type SnapshotSource, type SnapshotRow,
  type OnboardingExact,
} from '@shared/financialSnapshot';
import type { FinalAnalysis } from '@shared/types';

// Dev-only in-memory store (resets on reload) so the flow works without the table pushed. Seeded
// with the mock-persona snapshot so the dashboard/Money/check-in surfaces show data in mock mode
// (require, not a static import, so the fixture never ships to prod). Mutated by mergeSnapshot below.
let mockSnapshot: FinancialSnapshot | null = USE_AI_MOCKS
  ? (require('@/__fixtures__/mockHistory').MOCK_SNAPSHOT as FinancialSnapshot)
  : null;

export async function getSnapshot(userId: string): Promise<FinancialSnapshot | null> {
  if (USE_AI_MOCKS) return mockSnapshot;
  return withClient<FinancialSnapshot | null>('fetch snapshot', null, async (client) => {
    const { data, error } = await (client as any)
      .from(TABLES.financial_snapshots).select('*').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as SnapshotRow) : null;
  });
}

/**
 * Build the freeText for a snapshot-driven "refresh" (re-score) — no re-typing. Reconstructs the
 * current numbers from the snapshot + a progress delta vs the latest roast's basis, so the LLM
 * re-rates the score AND the roast reacts to the change. The caller runs it through `analyze`
 * (paywall-gated like any roast). Returns null when there's no snapshot to refresh from.
 */
export async function buildRescoreInput(userId: string, latestAnalysisId?: string): Promise<string | null> {
  const [snap, latest, subCtx] = await Promise.all([
    getSnapshot(userId),
    latestAnalysisId ? getAnalysisById(latestAnalysisId) : Promise.resolve(null),
    getSubscriptionContext(userId).catch(() => ''),
  ]);
  if (!snap) return null;
  const income = Math.round(snap.monthlyIncome?.value ?? 0);
  const debt = Math.round(snap.debtTotal);
  const savings = Math.round(snap.liquidSavings?.value ?? 0);
  const parts: string[] = [];
  if (latest) {
    const dDebt = Math.round((latest.debtTotal ?? debt) - debt);                       // + = paid down
    const dSave = Math.round(savings - (latest.liquidSavings?.value ?? savings));
    if (dDebt >= 1) parts.push(`paid down $${dDebt.toLocaleString()} in debt`);
    else if (dDebt <= -1) parts.push(`debt went up $${(-dDebt).toLocaleString()}`);
    if (dSave >= 1) parts.push(`saved $${dSave.toLocaleString()}`);
    else if (dSave <= -1) parts.push(`savings dropped $${(-dSave).toLocaleString()}`);
  }
  const delta = parts.length ? ` Since my last roast I ${parts.join(' and ')}.` : '';
  return `Updated check-in on my finances. Right now: about $${income.toLocaleString()}/mo income, $${debt.toLocaleString()} in total debt, and $${savings.toLocaleString()} in savings.${delta}${subCtx}`;
}

/** Confident-merge a patch into the user's snapshot and persist it. Returns the new snapshot. */
export async function mergeSnapshot(
  userId: string,
  patch: SnapshotPatch,
  source: SnapshotSource,
  score?: number | null,
): Promise<FinancialSnapshot | null> {
  const now = new Date().toISOString();
  if (USE_AI_MOCKS) {
    mockSnapshot = mergeIntoSnapshot(mockSnapshot, patch, source, now, score);
    return mockSnapshot;
  }
  return withClient<FinancialSnapshot | null>('merge snapshot', null, async (client) => {
    const { data: row, error: readErr } = await (client as any)
      .from(TABLES.financial_snapshots).select('*').eq('user_id', userId).maybeSingle();
    if (readErr) throw readErr;
    const current = row ? fromRow(row as SnapshotRow) : null;
    const next = mergeIntoSnapshot(current, patch, source, now, score);
    const { error } = await (client as any)
      .from(TABLES.financial_snapshots).upsert(toRow(next, userId), { onConflict: 'user_id' });
    if (error) throw error;
    return next;
  });
}

/** Seed (or refine) the snapshot from onboarding answers — brackets `estimated`, exact `stated`. */
export function seedSnapshotFromOnboarding(
  userId: string,
  ctx: { incomeBracket?: string; liquidSavingsBracket?: string; debtBracket?: string },
  exact?: OnboardingExact,
): Promise<FinancialSnapshot | null> {
  return mergeSnapshot(userId, patchFromOnboarding(ctx, exact), 'onboarding');
}

/** Merge a roast's numbers into the snapshot (confidence-aware; debts only when listed). */
export function updateSnapshotFromAnalysis(userId: string, analysis: FinalAnalysis): Promise<FinancialSnapshot | null> {
  return mergeSnapshot(userId, patchFromAnalysis(analysis as Parameters<typeof patchFromAnalysis>[0]), 'roast', analysis.score);
}

/**
 * Update specific debts' balances from a check-in (the per-debt path, §7). `updates` is a map of
 * debt name → new balance, matched by name. No snapshot yet → no-op (debts come from a roast).
 */
export async function updateSnapshotDebts(userId: string, updates: Record<string, number>): Promise<FinancialSnapshot | null> {
  const now = new Date().toISOString();
  if (USE_AI_MOCKS) {
    if (mockSnapshot) mockSnapshot = applyDebtUpdates(mockSnapshot, updates, 'checkin', now);
    return mockSnapshot;
  }
  return withClient<FinancialSnapshot | null>('update snapshot debts', null, async (client) => {
    const { data: row, error: readErr } = await (client as any)
      .from(TABLES.financial_snapshots).select('*').eq('user_id', userId).maybeSingle();
    if (readErr) throw readErr;
    if (!row) return null;
    const next = applyDebtUpdates(fromRow(row as SnapshotRow), updates, 'checkin', now);
    const { error } = await (client as any)
      .from(TABLES.financial_snapshots).upsert(toRow(next, userId), { onConflict: 'user_id' });
    if (error) throw error;
    return next;
  });
}
