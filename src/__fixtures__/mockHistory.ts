/**
 * Dev-only mock history for QA-ing the History screen + filterable chart without
 * burning API calls. Active only when USE_AI_MOCKS is on (see src/config/ai.ts).
 *
 * The data is shaped to exercise every chart filter (anchored around 2026-06-01):
 *   - Year 2026   → Feb/Mar/Apr (1 each), May (5 bars, at threshold), Jun (×7 collapse)
 *   - Month Jun   → day 1 collapses to ×7
 *   - Week (current, May 31–Jun 6) → Sun has 3 bars, Mon collapses to ×7, rest empty
 *   - Day May 31  → 3 time-labelled bars; Day Jun 1 → 7 time-labelled bars
 *
 * Timestamps are written in LOCAL time (no trailing Z) so the day-view time labels
 * read as authored regardless of the machine timezone.
 */
import type { AnalysisHistoryItem, CheckIn, CheckinConfig, TrackedGoal } from '@/types';
import type { FinalAnalysis } from '@shared/types';
import { mergeIntoSnapshot, type FinancialSnapshot } from '@shared/financialSnapshot';
import { metricGoalId, debtGoalId } from '@/utils/checkinGoals';
import { getScoreBand } from '@shared/scoring/bands.ts';
import { SAMPLE_ANALYSIS } from './sampleAnalysis';

function labelFor(score: number): string {
  return getScoreBand(score).label;
}
function emojiFor(score: number): string {
  if (score < 40) return '😰';
  if (score < 55) return '😟';
  if (score < 68) return '😬';
  if (score < 80) return '🙂';
  return '😎';
}

// [isoLocal, score, summary, hasPlan?, hasCaptions?]
type Raw = [string, number, string, boolean?, boolean?];
const RAW: Raw[] = [
  // Older months — spread for the Year view.
  ['2026-02-03T14:00:00', 34, 'Spending exceeds income most months and the card is the overflow valve. The bottom of the climb.'],
  ['2026-03-08T16:30:00', 47, 'Barely breaking even. Minimum payments eat most of the surplus and there is no cushion.'],
  ['2026-04-12T11:15:00', 55, 'Treading water with a $700/mo surplus but carrying $4,200 in card debt at 25% APR.', true],
  // May — gives the year's May slot 5 bars (at the collapse threshold).
  ['2026-05-18T09:40:00', 68, 'Card balance under $1k and a real buffer forming. Savings rate hit 12%.', true],
  ['2026-05-25T19:05:00', 64, 'Slipped a little after a big grocery run, but still well ahead of where you started.'],
  // Sun May 31 — 3 entries → 3 sub-bars in the current week / day view.
  ['2026-05-31T10:00:00', 70, 'Steady morning check. Buffer holding, no new debt this week.', true],
  ['2026-05-31T15:00:00', 66, 'Afternoon dip after booking a flight — within plan though.'],
  ['2026-05-31T20:00:00', 73, 'Closed the week strong; surplus routed straight to savings.', true, true],
  // Mon Jun 1 — 7 entries → collapses to a ×7 average bar in week/month/year.
  ['2026-06-01T07:45:00', 70, 'Pre-coffee gut check before payday.'],
  ['2026-06-01T09:00:00', 66, 'Re-ran after seeing the rent autopay clear.'],
  ['2026-06-01T11:30:00', 74, 'Added the side-gig income — looks healthier.'],
  ['2026-06-01T13:15:00', 69, 'Lunchtime what-if on cutting subscriptions.'],
  ['2026-06-01T15:00:00', 78, 'Best read yet after moving $300 to the card.', true],
  ['2026-06-01T18:30:00', 72, 'Evening recheck, factored in groceries.'],
  ['2026-06-01T21:45:00', 80, 'Night-cap optimism: on track to be card-free this quarter.', true, true],
];

const SEEDS = RAW.map(([iso, score, summary, plan, captions], i) => ({
  id: `mock-${i + 1}`,
  created_at: iso,
  score,
  summary,
  score_label: labelFor(score),
  emoji: emojiFor(score),
  has_action_plan: !!plan,
  has_captions: !!captions,
}));

// Sample free-text inputs so the All Roasts preview snippet renders in mock mode.
const SAMPLE_INPUTS = [
  "My subscriptions are out of control and I've got ~$4k on credit cards",
  "I make $5k/mo but somehow I'm broke by the 20th every month",
  'Rent eats half my paycheck and I still have student loans',
  'Trying to save for a trip but my spending is a disaster',
  'Just tell me how cooked my credit card situation is',
];

export const MOCK_HISTORY: AnalysisHistoryItem[] = SEEDS
  .map((s, i) => ({
    id: s.id,
    input_text: SAMPLE_INPUTS[i % SAMPLE_INPUTS.length],
    score: s.score,
    score_label: s.score_label,
    summary: s.summary,
    created_at: s.created_at,
    emotional_status: { label: s.score_label, emoji: s.emoji },
    has_action_plan: s.has_action_plan,
    has_captions: s.has_captions,
  }))
  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); // newest first

// Stable goal ids (also key each check-in's `metrics`).
const G_DEBT = metricGoalId('debtTotal');
const G_SAVINGS = metricGoalId('liquidSavings');
const G_EF = metricGoalId('emergencyFundMonths');
const G_CARD = debtGoalId('Capital One Credit Card');

const BASELINE_DATE = '2026-04-12T00:00:00';
const MOCK_GOALS: TrackedGoal[] = [
  { id: G_DEBT, kind: 'metric', key: 'debtTotal', label: 'Total debt', unit: 'currency', direction: 'down', baseline: 16500, baselineDate: BASELINE_DATE, target: 0, sourceAnalysisId: 'mock-3' },
  { id: G_CARD, kind: 'debt', key: 'Capital One Credit Card', label: 'Capital One Credit Card', unit: 'currency', direction: 'down', baseline: 4200, baselineDate: BASELINE_DATE, target: 0, sourceAnalysisId: 'mock-3' },
  { id: G_SAVINGS, kind: 'metric', key: 'liquidSavings', label: 'Savings balance', unit: 'currency', direction: 'up', baseline: 1200, baselineDate: BASELINE_DATE, target: 5000, sourceAnalysisId: 'mock-3' },
  { id: G_EF, kind: 'metric', key: 'emergencyFundMonths', label: 'Emergency fund', unit: 'months', direction: 'up', baseline: 0.29, baselineDate: BASELINE_DATE, target: 3, sourceAnalysisId: 'mock-3' },
];

// First analysis Feb 3 → check-ins are due on the 3rd of each following month.
export const MOCK_CHECKIN_CONFIG: CheckinConfig = {
  firstAnalyzeAt: '2026-02-03T14:00:00',
  anchorDay: 3,
  goals: MOCK_GOALS,
};

export const MOCK_CHECKINS: CheckIn[] = [
  { id: 'ci-2', mood: 4, notes: 'Paid off the Capital One card this month. Felt unreal.', income: 5000, expenses: 3900, savings: 2100, debt: 11500, created_at: '2026-05-20T12:00:00',
    metrics: { [G_DEBT]: 11500, [G_CARD]: 0, [G_SAVINGS]: 2100, [G_EF]: 0.6 } },
  { id: 'ci-1', mood: 2, notes: 'Tight month, car needed brakes. Held the line though.', income: 4800, expenses: 4400, savings: 900, debt: 14800, created_at: '2026-03-22T12:00:00',
    metrics: { [G_DEBT]: 14800, [G_CARD]: 3800, [G_SAVINGS]: 900, [G_EF]: 0.4 } },
];

// Current financial snapshot for the mock user — a returning user mid-progress (~score 80): the
// Capital One card is paid off (per ci-2), a student loan remains, and savings are building. Seeds
// getSnapshot in mock mode so the dashboard "Your Finances" card, the Money hub, and the check-in
// prefill all show real-looking data without burning API calls. Built via the real merge engine so
// the derived metrics (savings rate, DTI, emergency fund) are computed correctly. Source 'roast' +
// the latest-roast timestamp so it doesn't read as stale.
export const MOCK_SNAPSHOT: FinancialSnapshot = mergeIntoSnapshot(
  null,
  {
    monthlyIncome: { value: 5000, confidence: 'stated' },
    monthlyExpenses: { value: 3700, confidence: 'stated' },
    liquidSavings: { value: 2600, confidence: 'stated' },
    debts: { value: [{ name: 'Student loan', balance: 9800, apr: 0.065, min_payment: 210, kind: 'student_loan' }], confidence: 'stated' },
  },
  'roast',
  '2026-06-01T21:45:00',
  80,
);

/** Returns a coherent full analysis for a tapped row (clone + score overrides). */
export function getMockAnalysisById(id: string): FinalAnalysis | null {
  const seed = SEEDS.find((s) => s.id === id);
  if (!seed) return null;
  return {
    ...SAMPLE_ANALYSIS,
    score: seed.score,
    scoreLabel: seed.score_label,
    summary: seed.summary,
    emotionalStatus: { label: seed.score_label, emoji: seed.emoji },
  };
}
