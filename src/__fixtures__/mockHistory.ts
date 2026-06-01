/**
 * Dev-only mock history for QA-ing the History screen without burning API calls
 * or needing real saved analyses. Active only when USE_AI_MOCKS is on
 * (see src/config/ai.ts) — wired into the getAnalysisHistory / getCheckIns /
 * getAnalysisById service functions.
 *
 * The journey is intentionally an *improving* arc that crosses score bands
 * (Fragile → Surviving → Stable) so the chart shows red/amber/teal bars,
 * positive deltas, varied emoji, and a mix of Plan/Caption badges.
 */
import type { AnalysisHistoryItem, CheckIn } from '@/types';
import type { FinalAnalysis } from '@shared/types';
import { SAMPLE_ANALYSIS } from './sampleAnalysis';

interface MockSeed {
  id: string;
  score: number;
  score_label: AnalysisHistoryItem['score_label'];
  summary: string;
  created_at: string;
  emoji: string;
  label: string;
  has_action_plan?: boolean;
  has_captions?: boolean;
}

// Newest first — mirrors the real `.order('created_at', { ascending: false })`.
const SEEDS: MockSeed[] = [
  {
    id: 'mock-5', score: 78, score_label: 'Stable', created_at: '2026-06-01T15:00:00Z',
    emoji: '😎', label: 'Actually thriving now',
    summary: 'Credit card is dead, $2k emergency fund banked, and you are saving 18% of income. The car loan is the last domino.',
    has_action_plan: true, has_captions: true,
  },
  {
    id: 'mock-4', score: 68, score_label: 'Stable', created_at: '2026-05-18T15:00:00Z',
    emoji: '🙂', label: 'Finding your footing',
    summary: 'Card balance under $1k and a real buffer forming. Savings rate hit 12% — the momentum is obvious now.',
    has_action_plan: true,
  },
  {
    id: 'mock-3', score: 55, score_label: 'Surviving', created_at: '2026-04-12T15:00:00Z',
    emoji: '😬', label: 'Treading but not drowning',
    summary: 'You are treading water with a $700/mo surplus but carrying $4,200 in credit card debt at 25% APR.',
    has_action_plan: true, has_captions: true,
  },
  {
    id: 'mock-2', score: 47, score_label: 'Surviving', created_at: '2026-03-08T15:00:00Z',
    emoji: '😟', label: 'One bad month away',
    summary: 'Barely breaking even. Minimum payments eat most of the surplus and there is no cushion if anything breaks.',
  },
  {
    id: 'mock-1', score: 34, score_label: 'Financially Fragile', created_at: '2026-02-03T15:00:00Z',
    emoji: '😰', label: 'In the red',
    summary: 'Spending exceeds income most months and the credit card is the overflow valve. This is the bottom of the climb.',
  },
];

export const MOCK_HISTORY: AnalysisHistoryItem[] = SEEDS.map((s) => ({
  id: s.id,
  score: s.score,
  score_label: s.score_label,
  summary: s.summary,
  created_at: s.created_at,
  emotional_status: { label: s.label, emoji: s.emoji },
  has_action_plan: !!s.has_action_plan,
  has_captions: !!s.has_captions,
}));

export const MOCK_CHECKINS: CheckIn[] = [
  { id: 'ci-2', mood: 4, notes: 'Paid off the Capital One card this month. Felt unreal.', income: 5000, expenses: 3900, savings: 2100, debt: 11500, created_at: '2026-05-20T12:00:00Z' },
  { id: 'ci-1', mood: 2, notes: 'Tight month, car needed brakes. Held the line though.', income: 4800, expenses: 4400, savings: 900, debt: 14800, created_at: '2026-03-22T12:00:00Z' },
];

/** Returns a coherent full analysis for a tapped mock row (clone + score overrides). */
export function getMockAnalysisById(id: string): FinalAnalysis | null {
  const seed = SEEDS.find((s) => s.id === id);
  if (!seed) return null;
  return {
    ...SAMPLE_ANALYSIS,
    score: seed.score,
    scoreLabel: seed.score_label,
    summary: seed.summary,
    emotionalStatus: { label: seed.label, emoji: seed.emoji },
  };
}
