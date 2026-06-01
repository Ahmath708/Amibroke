/**
 * Monthly check-in — pinned-goal helpers (pure).
 *
 * A "goal" is a metric or specific debt the user pins from an analysis, with a
 * baseline (captured at pin time) and an optional target. These helpers turn an
 * analysis into pinnable candidates, compute progress vs baseline/target, and
 * format values for display.
 */
import type { FinalAnalysis } from '@shared/types';
import type { TrackedGoal, MetricKey, GoalUnit, GoalDirection } from '@/types';

interface MetricMeta {
  label: string;
  unit: GoalUnit;
  direction: GoalDirection;
  extract: (a: FinalAnalysis) => number;
  /** Suggested default target (or null to let the user set one). */
  defaultTarget: number | null;
}

export const METRIC_META: Record<MetricKey, MetricMeta> = {
  liquidSavings:       { label: 'Savings balance',  unit: 'currency', direction: 'up',   extract: (a) => a.liquidSavings.value,   defaultTarget: null },
  savingsRate:         { label: 'Savings rate',     unit: 'percent',  direction: 'up',   extract: (a) => a.savingsRate,           defaultTarget: 0.20 },
  emergencyFundMonths: { label: 'Emergency fund',   unit: 'months',   direction: 'up',   extract: (a) => a.emergencyFundMonths,   defaultTarget: 3 },
  debtTotal:           { label: 'Total debt',       unit: 'currency', direction: 'down', extract: (a) => a.debtTotal,             defaultTarget: 0 },
  monthlySavings:      { label: 'Monthly savings',  unit: 'currency', direction: 'up',   extract: (a) => a.monthlySavings,        defaultTarget: null },
  debtToIncomeRatio:   { label: 'Debt-to-income',   unit: 'percent',  direction: 'down', extract: (a) => a.debtToIncomeRatio,     defaultTarget: 0.36 },
  monthlyIncome:       { label: 'Monthly income',   unit: 'currency', direction: 'up',   extract: (a) => a.monthlyIncome.value,   defaultTarget: null },
  monthlyExpenses:     { label: 'Monthly expenses', unit: 'currency', direction: 'down', extract: (a) => a.monthlyExpenses.value, defaultTarget: null },
};

/** Default metrics suggested for tracking (most actionable first). */
export const SUGGESTED_METRICS: MetricKey[] = ['debtTotal', 'liquidSavings', 'emergencyFundMonths', 'savingsRate'];

export const metricGoalId = (key: MetricKey) => `m:${key}`;
export const debtGoalId = (name: string) => `d:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;

interface CandidateOpts {
  analysisId?: string | null;
  date?: string; // ISO baseline date; defaults to now
}

/** Build the full set of pinnable goal candidates from an analysis (metrics + each debt). */
export function goalCandidatesFromAnalysis(analysis: FinalAnalysis, opts: CandidateOpts = {}): TrackedGoal[] {
  const baselineDate = opts.date ?? new Date().toISOString();
  const sourceAnalysisId = opts.analysisId ?? null;

  const metricGoals: TrackedGoal[] = (Object.keys(METRIC_META) as MetricKey[]).map((key) => {
    const meta = METRIC_META[key];
    return {
      id: metricGoalId(key),
      kind: 'metric',
      key,
      label: meta.label,
      unit: meta.unit,
      direction: meta.direction,
      baseline: meta.extract(analysis),
      baselineDate,
      target: meta.defaultTarget,
      sourceAnalysisId,
    };
  });

  const debtGoals: TrackedGoal[] = (analysis.debts ?? []).map((d) => ({
    id: debtGoalId(d.name),
    kind: 'debt',
    key: d.name,
    label: d.name,
    unit: 'currency',
    direction: 'down',
    baseline: d.balance,
    baselineDate,
    target: 0,
    sourceAnalysisId,
  }));

  return [...metricGoals, ...debtGoals];
}

export interface GoalProgress {
  delta: number;                 // current − baseline
  improved: boolean;             // moved in the goal's good direction
  pctToTarget: number | null;    // 0..1 progress baseline→target, or null if no target
  atTarget: boolean;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function goalProgress(goal: TrackedGoal, current: number): GoalProgress {
  const delta = current - goal.baseline;
  const improved = goal.direction === 'up' ? delta > 0 : delta < 0;
  const hasTarget = goal.target !== null && goal.target !== undefined;
  const pctToTarget = hasTarget && goal.target !== goal.baseline
    ? clamp01((current - goal.baseline) / ((goal.target as number) - goal.baseline))
    : null;
  const atTarget = hasTarget
    ? (goal.direction === 'down' ? current <= (goal.target as number) : current >= (goal.target as number))
    : false;
  return { delta, improved, pctToTarget, atTarget };
}

/** Format a goal value for display based on its unit. */
export function formatGoalValue(unit: GoalUnit, value: number): string {
  switch (unit) {
    case 'currency':
      return `$${Math.round(value).toLocaleString('en-US')}`;
    case 'percent':
      return `${(value * 100).toFixed(1)}%`;
    case 'months':
      return `${value.toFixed(1)} mo`;
    case 'number':
      return `${value}`;
  }
}
