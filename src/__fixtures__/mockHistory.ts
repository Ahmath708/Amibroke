/**
 * Dev-only mock history (USE_AI_MOCKS) — ALL derived from the demo persona (./demoPersona) so the
 * History chart, Results, check-ins, snapshot, and money trend tell ONE coherent story (Jason's Apr→Jun
 * glow-up). Edit the arc in demoPersona.ts; these adapters follow. See docs/redesign/demo-prep.md.
 */
import type { AnalysisHistoryItem, CheckIn, CheckinConfig, TrackedGoal } from '@/types';
import type { FinalAnalysis } from '@shared/types';
import { mergeIntoSnapshot, type FinancialSnapshot } from '@shared/financialSnapshot';
import { metricGoalId, debtGoalId } from '@/utils/checkinGoals';
import { getScoreBand } from '@shared/scoring/bands.ts';
import {
  PERSONA_TIMELINE, PERSONA_CARD, personaRoasts, personaCheckins, personaFirst, personaLatest,
  debtTotal, cardBalance, emojiFor,
} from './demoPersona';
import { pointToAnalysis } from './sampleAnalysis';

const round2 = (n: number) => Math.round(n * 100) / 100;

// Sample free-text inputs so the All Roasts preview snippet renders in mock mode (newest → oldest).
const SAMPLE_INPUTS = [
  'Down to one debt and actually saving now — how am I doing?',
  'Card is dead, just the car loan left. What do I do with the freed-up cash?',
  'Paid off most of the Capital One card. Buffer is finally forming.',
  'Cut my subscriptions and threw the difference at my 25% card.',
  "Paycheck to paycheck with ~$4k on a credit card at 25%. Roast me.",
];

// Roasts newest-first → History chart + All Roasts list.
export const MOCK_HISTORY: AnalysisHistoryItem[] = personaRoasts()
  .slice()
  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  .map((p, i) => ({
    id: p.id,
    input_text: SAMPLE_INPUTS[i % SAMPLE_INPUTS.length],
    score: p.score,
    score_label: getScoreBand(p.score).label,
    summary: p.note ?? '',
    created_at: p.date,
    emotional_status: { label: getScoreBand(p.score).label, emoji: emojiFor(p.score) },
    has_action_plan: p.id === personaFirst().id, // the active plan's source roast (Apr 12)
    has_captions: p.id === personaLatest().id,
  }));

// Goal baselines = the Apr-12 low point (the plan's start), tracked down/up to target.
const first = personaFirst();
const G_DEBT = metricGoalId('debtTotal');
const G_SAVINGS = metricGoalId('liquidSavings');
const G_EF = metricGoalId('emergencyFundMonths');
const G_CARD = debtGoalId(PERSONA_CARD);

const MOCK_GOALS: TrackedGoal[] = [
  { id: G_DEBT, kind: 'metric', key: 'debtTotal', label: 'Total debt', unit: 'currency', direction: 'down', baseline: debtTotal(first), baselineDate: first.date, target: 0, sourceAnalysisId: first.id },
  { id: G_CARD, kind: 'debt', key: PERSONA_CARD, label: PERSONA_CARD, unit: 'currency', direction: 'down', baseline: cardBalance(first), baselineDate: first.date, target: 0, sourceAnalysisId: first.id },
  { id: G_SAVINGS, kind: 'metric', key: 'liquidSavings', label: 'Savings balance', unit: 'currency', direction: 'up', baseline: first.savings, baselineDate: first.date, target: 5000, sourceAnalysisId: first.id },
  { id: G_EF, kind: 'metric', key: 'emergencyFundMonths', label: 'Emergency fund', unit: 'months', direction: 'up', baseline: round2(first.savings / first.expenses), baselineDate: first.date, target: 3, sourceAnalysisId: first.id },
];

export const MOCK_CHECKIN_CONFIG: CheckinConfig = {
  firstAnalyzeAt: first.date,
  anchorDay: 3,
  goals: MOCK_GOALS,
};

// Check-ins newest-first; figures folded into `metrics` (matches services/checkins saveCheckIn).
export const MOCK_CHECKINS: CheckIn[] = personaCheckins()
  .slice()
  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  .map((p) => ({
    id: p.id,
    mood: p.mood ?? 3,
    notes: p.note ?? '',
    created_at: p.date,
    reflection: null,
    metrics: {
      [G_DEBT]: debtTotal(p),
      [G_CARD]: cardBalance(p),
      [G_SAVINGS]: p.savings,
      [G_EF]: round2(p.savings / p.expenses),
      monthlyIncome: p.income,
      monthlyExpenses: p.expenses,
      liquidSavings: p.savings,
      debtTotal: debtTotal(p),
    },
  }));

// Current snapshot = the latest persona point (Jun 1). Built via the real merge engine so derived
// metrics compute correctly; 'roast' + the latest timestamp so it doesn't read as stale.
const last = personaLatest();
export const MOCK_SNAPSHOT: FinancialSnapshot = mergeIntoSnapshot(
  null,
  {
    monthlyIncome: { value: last.income, confidence: 'stated' },
    monthlyExpenses: { value: last.expenses, confidence: 'stated' },
    liquidSavings: { value: last.savings, confidence: 'stated' },
    debts: {
      value: last.debts.map((d) => ({
        name: d.name,
        balance: d.balance,
        apr: round2(d.apr) / 100,
        min_payment: Math.max(25, Math.round(d.balance * 0.025)),
        kind: d.name.toLowerCase().includes('car') ? 'auto' : 'other',
      })),
      confidence: 'stated',
    },
  },
  'roast',
  last.date,
  last.score,
);

/** Coherent full analysis for a tapped roast/check-in row — derived from the same persona point. */
export function getMockAnalysisById(id: string): FinalAnalysis | null {
  const p = PERSONA_TIMELINE.find((x) => x.id === id);
  return p ? pointToAnalysis(p) : null;
}
