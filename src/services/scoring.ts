import { ScoringWeights, SCORING_WEIGHTS, SCORING_THRESHOLDS } from '@/config/scoring';

export interface ScoreConfig {
  thresholds: {
    critical: number;
    warning: number;
    healthy: number;
  };
  labels: Record<string, { label: string; color: string; emoji: string }>;
}

export const SCORE_CONFIG: ScoreConfig = {
  thresholds: { critical: 30, warning: 60, healthy: 80 },
  labels: {
    critical: { label: 'Broke AF', color: '#ff453a', emoji: '🚨' },
    fragile: { label: 'Financially Fragile', color: '#ff6b00', emoji: '⚠️' },
    surviving: { label: 'Surviving', color: '#ff9f0a', emoji: '😬' },
    stable: { label: 'Stable', color: '#39FF14', emoji: '👍' },
    thriving: { label: 'Thriving', color: '#00e0ff', emoji: '🌟' },
  },
};

export interface ScoringInput {
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlySavings: number;
  debtTotal: number;
  savingsRate: number;
  emergencyFundMonths: number;
  debtToIncomeRatio: number;
  spendingBreakdown: { name: string; amount: number; percentage: number }[];
}

export interface ScoreResult {
  score: number;
  label: string;
  color: string;
  emoji: string;
  breakdown: {
    savingsRateScore: number;
    debtToIncomeScore: number;
    expenseAllocationScore: number;
    emergencyFundScore: number;
  };
}

export function calculateFinancialScore(
  input: ScoringInput,
  weights: ScoringWeights = SCORING_WEIGHTS,
): ScoreResult {
  const savingsRateScore = calculateSavingsRateScore(input.savingsRate);
  const debtToIncomeScore = calculateDebtToIncomeScore(input.debtToIncomeRatio);
  const expenseAllocationScore = calculateExpenseAllocationScore(input.spendingBreakdown, input.monthlyIncome);
  const emergencyFundScore = calculateEmergencyFundScore(input.emergencyFundMonths);

  const score = Math.round(
    savingsRateScore * weights.savingsRate +
    debtToIncomeScore * weights.debtToIncome +
    expenseAllocationScore * weights.expenseAllocation +
    emergencyFundScore * weights.emergencyFund,
  );

  const clamped = Math.max(0, Math.min(100, score));
  const { label, color, emoji } = getScoreMeta(clamped);

  return {
    score: clamped,
    label,
    color,
    emoji,
    breakdown: {
      savingsRateScore,
      debtToIncomeScore,
      expenseAllocationScore,
      emergencyFundScore,
    },
  };
}

function calculateSavingsRateScore(rate: number): number {
  const t = SCORING_THRESHOLDS.savingsRate;
  if (rate >= t.excellent) return 100;
  if (rate >= t.good) return 80;
  if (rate >= t.fair) return 60;
  if (rate >= t.poor) return 40;
  if (rate >= 0) return 20;
  return 0;
}

function calculateDebtToIncomeScore(dti: number): number {
  const t = SCORING_THRESHOLDS.debtToIncome;
  if (dti <= t.excellent) return 100;
  if (dti <= t.good) return 80;
  if (dti <= t.fair) return 60;
  if (dti <= t.poor) return 40;
  if (dti <= t.critical) return 20;
  return 0;
}

function calculateExpenseAllocationScore(
  breakdown: { name: string; amount: number; percentage: number }[],
  income: number,
): number {
  if (breakdown.length === 0 || income <= 0) return 50;
  const discretionary = breakdown.filter((c) =>
    ['Eating Out', 'Entertainment', 'Shopping', 'DoorDash', 'Uber Eats'].includes(c.name),
  );
  const discretionaryPct = discretionary.reduce((sum, c) => sum + c.percentage, 0);
  const t = SCORING_THRESHOLDS.discretionarySpending;
  if (discretionaryPct <= t.excellent) return 100;
  if (discretionaryPct <= t.good) return 75;
  if (discretionaryPct <= t.fair) return 50;
  if (discretionaryPct <= t.poor) return 25;
  return 0;
}

function calculateEmergencyFundScore(months: number): number {
  const t = SCORING_THRESHOLDS.emergencyFund;
  if (months >= t.excellent) return 100;
  if (months >= t.good) return 75;
  if (months >= t.fair) return 50;
  if (months >= t.poor) return 25;
  return 0;
}

function getScoreMeta(score: number): { label: string; color: string; emoji: string } {
  if (score <= SCORE_CONFIG.thresholds.critical) return SCORE_CONFIG.labels.critical;
  if (score <= SCORE_CONFIG.thresholds.warning) return SCORE_CONFIG.labels.fragile;
  if (score <= SCORE_CONFIG.thresholds.healthy) return SCORE_CONFIG.labels.surviving;
  if (score < 90) return SCORE_CONFIG.labels.stable;
  return SCORE_CONFIG.labels.thriving;
}
