export interface ScoringWeights {
  savingsRate: number;
  debtToIncome: number;
  expenseAllocation: number;
  emergencyFund: number;
}

export const SCORING_WEIGHTS: ScoringWeights = {
  savingsRate: 0.30,
  debtToIncome: 0.30,
  expenseAllocation: 0.20,
  emergencyFund: 0.20,
};

export const SCORING_DESCRIPTION = {
  savingsRate: {
    label: 'Savings Rate',
    description: 'Percentage of income saved each month. Higher is better.',
    ideal: '20% or more',
    minimum: '5%',
  },
  debtToIncome: {
    label: 'Debt-to-Income Ratio',
    description: 'Total debt divided by annual income. Lower is better.',
    ideal: '10% or less',
    maximum: '50%',
  },
  expenseAllocation: {
    label: 'Expense Allocation',
    description: 'How much of your spending goes to discretionary vs essential categories.',
    ideal: '10% or less on discretionary',
    maximum: '40% on discretionary',
  },
  emergencyFund: {
    label: 'Emergency Fund',
    description: 'Months of expenses you could cover with current savings.',
    ideal: '6 months or more',
    minimum: '1 month',
  },
};

export interface ScoreBand {
  min: number;
  max: number;
  label: string;
  color: string;
  emoji: string;
  description: string;
}

export const SCORE_BANDS: ScoreBand[] = [
  {
    min: 0,
    max: 30,
    label: 'Broke AF',
    color: '#ff453a',
    emoji: '🚨',
    description: 'Your finances are in critical condition. Immediate action needed.',
  },
  {
    min: 31,
    max: 60,
    label: 'Financially Fragile',
    color: '#ff6b00',
    emoji: '⚠️',
    description: 'One unexpected expense could derail you. Time to build a safety net.',
  },
  {
    min: 61,
    max: 80,
    label: 'Stable',
    color: '#39FF14',
    emoji: '👍',
    description: 'You\'re managing okay, but there\'s room to optimize.',
  },
  {
    min: 81,
    max: 90,
    label: 'Thriving',
    color: '#00e0ff',
    emoji: '🌟',
    description: 'Great job! Your financial habits are solid.',
  },
  {
    min: 91,
    max: 100,
    label: 'Elite',
    color: '#bf5af2',
    emoji: '🏆',
    description: 'You\'re in the top tier. Keep maintaining these habits.',
  },
];

export function getScoreBand(score: number): ScoreBand {
  for (let i = SCORE_BANDS.length - 1; i >= 0; i--) {
    if (score >= SCORE_BANDS[i].min) return SCORE_BANDS[i];
  }
  return SCORE_BANDS[0];
}

export function getScoreMeta(score: number): { label: string; color: string; emoji: string } {
  const band = getScoreBand(score);
  return { label: band.label, color: band.color, emoji: band.emoji };
}

export const SCORING_THRESHOLDS = {
  savingsRate: {
    excellent: 0.20,
    good: 0.15,
    fair: 0.10,
    poor: 0.05,
  },
  debtToIncome: {
    excellent: 0.10,
    good: 0.20,
    fair: 0.30,
    poor: 0.40,
    critical: 0.50,
  },
  discretionarySpending: {
    excellent: 0.10,
    good: 0.20,
    fair: 0.30,
    poor: 0.40,
  },
  emergencyFund: {
    excellent: 6,
    good: 4,
    fair: 2,
    poor: 1,
  },
};
