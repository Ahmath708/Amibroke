// Financial snapshot service (Phase 2a of the unified financial model — see
// docs/unified-financial-model.md). The single per-user "current financial state" every
// feature reads. Written by onboarding (seed), each roast (confident-merge), and later
// check-ins/manual edits. Merge logic + DB mapping live in @shared/financialSnapshot.
// In dev (USE_AI_MOCKS) it uses an in-memory store so the flow works on the sim before the
// migration is pushed (mirrors services/activePlan).
import { withClient } from './supabaseClient';
import { TABLES } from './tables';
import { USE_AI_MOCKS } from '@/config/ai';
import {
  mergeIntoSnapshot, fromRow, toRow, patchFromAnalysis, patchFromOnboarding,
  type FinancialSnapshot, type SnapshotPatch, type SnapshotSource, type SnapshotRow,
} from '@shared/financialSnapshot';
import type { FinalAnalysis } from '@shared/types';

// Dev-only in-memory store (resets on reload) so the flow works without the table pushed.
let mockSnapshot: FinancialSnapshot | null = null;

export async function getSnapshot(userId: string): Promise<FinancialSnapshot | null> {
  if (USE_AI_MOCKS) return mockSnapshot;
  return withClient<FinancialSnapshot | null>('fetch snapshot', null, async (client) => {
    const { data, error } = await (client as any)
      .from(TABLES.financial_snapshots).select('*').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as SnapshotRow) : null;
  });
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
  ctx: { incomeBracket?: string; debtBracket?: string; liquidSavingsBracket?: string },
  exactIncome?: number | null,
): Promise<FinancialSnapshot | null> {
  return mergeSnapshot(userId, patchFromOnboarding(ctx, exactIncome), 'onboarding');
}

/** Merge a roast's numbers into the snapshot (confidence-aware; debts only when listed). */
export function updateSnapshotFromAnalysis(userId: string, analysis: FinalAnalysis): Promise<FinancialSnapshot | null> {
  return mergeSnapshot(userId, patchFromAnalysis(analysis as Parameters<typeof patchFromAnalysis>[0]), 'roast', analysis.score);
}
