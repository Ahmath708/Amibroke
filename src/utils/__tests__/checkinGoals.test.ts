import {
  goalCandidatesFromAnalysis, goalProgress, formatGoalValue,
  metricGoalId, debtGoalId, METRIC_META, computeGoalCurrent, CheckinBase,
} from '../checkinGoals';
import { SAMPLE_ANALYSIS } from '@/__fixtures__/sampleAnalysis';
import type { TrackedGoal } from '@/types';

describe('goalCandidatesFromAnalysis', () => {
  const goals = goalCandidatesFromAnalysis(SAMPLE_ANALYSIS, { analysisId: 'a1', date: '2026-04-12T00:00:00' });

  it('produces one goal per metric plus one per debt', () => {
    const metricCount = Object.keys(METRIC_META).length;
    expect(goals).toHaveLength(metricCount + SAMPLE_ANALYSIS.debts.length);
  });

  it('captures metric baselines from the analysis', () => {
    const debtTotal = goals.find((g) => g.id === metricGoalId('debtTotal'))!;
    expect(debtTotal.baseline).toBe(SAMPLE_ANALYSIS.debtTotal);
    expect(debtTotal.direction).toBe('down');
    expect(debtTotal.target).toBe(0);
  });

  it('captures each debt with a stable id and a payoff target', () => {
    const card = goals.find((g) => g.id === debtGoalId('Capital One Credit Card'))!;
    expect(card.kind).toBe('debt');
    expect(card.baseline).toBe(4200);
    expect(card.target).toBe(0);
    expect(card.direction).toBe('down');
    expect(card.sourceAnalysisId).toBe('a1');
  });
});

describe('goalProgress', () => {
  const debt: TrackedGoal = { id: 'd:card', kind: 'debt', key: 'Card', label: 'Card', unit: 'currency', direction: 'down', baseline: 4200, baselineDate: '', target: 0 };
  const savings: TrackedGoal = { id: 'm:liquidSavings', kind: 'metric', key: 'liquidSavings', label: 'Savings', unit: 'currency', direction: 'up', baseline: 1200, baselineDate: '', target: 5000 };

  it('marks paying down debt as improvement', () => {
    const p = goalProgress(debt, 2900);
    expect(p.improved).toBe(true);
    expect(p.delta).toBe(-1300);
    expect(p.pctToTarget).toBeCloseTo(0.3095, 3); // (2900-4200)/(0-4200)
    expect(p.atTarget).toBe(false);
  });

  it('detects reaching a payoff target', () => {
    expect(goalProgress(debt, 0).atTarget).toBe(true);
  });

  it('tracks savings growth toward a target', () => {
    const p = goalProgress(savings, 1800);
    expect(p.improved).toBe(true);
    expect(p.pctToTarget).toBeCloseTo(0.1579, 3); // (1800-1200)/(5000-1200)
  });

  it('returns null pctToTarget when there is no target', () => {
    const noTarget: TrackedGoal = { ...savings, target: null };
    expect(goalProgress(noTarget, 1800).pctToTarget).toBeNull();
  });
});

describe('computeGoalCurrent', () => {
  const base: CheckinBase = { income: 5000, expenses: 3800, savings: 2000, totalDebt: 9000, debts: { 'Capital One Credit Card': 1500 } };
  const goal = (key: string, kind: 'metric' | 'debt' = 'metric'): TrackedGoal =>
    ({ id: 'x', kind, key, label: key, unit: 'currency', direction: 'up', baseline: 999, baselineDate: '' });

  it('reads direct metrics from base', () => {
    expect(computeGoalCurrent(goal('liquidSavings'), base)).toBe(2000);
    expect(computeGoalCurrent(goal('debtTotal'), base)).toBe(9000);
    expect(computeGoalCurrent(goal('monthlyIncome'), base)).toBe(5000);
  });
  it('derives computed metrics', () => {
    expect(computeGoalCurrent(goal('monthlySavings'), base)).toBe(1200);
    expect(computeGoalCurrent(goal('savingsRate'), base)).toBeCloseTo(0.24, 5);
    expect(computeGoalCurrent(goal('emergencyFundMonths'), base)).toBeCloseTo(2000 / 3800, 5);
  });
  it('reads a specific debt by name, falling back to baseline', () => {
    expect(computeGoalCurrent(goal('Capital One Credit Card', 'debt'), base)).toBe(1500);
    expect(computeGoalCurrent(goal('Unknown Loan', 'debt'), base)).toBe(999); // baseline fallback
  });
  it('avoids divide-by-zero', () => {
    const broke: CheckinBase = { income: 0, expenses: 0, savings: 0, totalDebt: 0 };
    expect(computeGoalCurrent(goal('savingsRate'), broke)).toBe(0);
    expect(computeGoalCurrent(goal('emergencyFundMonths'), broke)).toBe(0);
  });
});

describe('formatGoalValue', () => {
  it('formats by unit', () => {
    expect(formatGoalValue('currency', 4200)).toBe('$4,200');
    expect(formatGoalValue('percent', 0.042)).toBe('4.2%');
    expect(formatGoalValue('months', 0.29)).toBe('0.3 mo');
  });
});
