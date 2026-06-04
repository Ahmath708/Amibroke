import { planProgress, planDelta } from '@/services/activePlan';
import type { ActivePlan, ActivePlanStep, PlanStartMetrics, StepStatus } from '@/services/activePlan';

const NOW = new Date('2026-06-30T12:00:00Z');

function plan(over: Partial<ActivePlan> = {}): ActivePlan {
  return {
    id: 'p', source_analysis_id: 'a', started_at: '2026-06-01T12:00:00Z',
    horizon_days: 90, status: 'active', version: 1, overall_message: null,
    steps: [], start_metrics: null, ...over,
  };
}
const step = (id: string, status: StepStatus): ActivePlanStep => ({
  id, status, week: '1', title: 't', description: 'd', category: 'debt', impact: 'i', confidence: 'high',
});

describe('planProgress', () => {
  it('counts done steps and percentage', () => {
    const p = plan({ steps: [step('s0', 'done'), step('s1', 'done'), step('s2', 'pending'), step('s3', 'skipped')] });
    expect(planProgress(p, NOW)).toMatchObject({ done: 2, total: 4, pct: 50 });
  });
  it('computes days in / left from started_at', () => {
    const pr = planProgress(plan({ started_at: '2026-06-01T12:00:00Z' }), NOW); // 29 days later
    expect(pr.daysIn).toBe(29);
    expect(pr.daysLeft).toBe(61); // 90 - 29
  });
  it('clamps daysLeft at 0 past the horizon', () => {
    expect(planProgress(plan({ started_at: '2026-01-01T12:00:00Z' }), NOW).daysLeft).toBe(0);
  });
  it('is 0% with no steps', () => {
    expect(planProgress(plan({ steps: [] }), NOW).pct).toBe(0);
  });
});

describe('planDelta', () => {
  const start: PlanStartMetrics = { debtTotal: 5000, liquidSavings: 200, monthlyIncome: 4000, monthlySavings: 300, score: 55 };
  it('reports debt paid down + savings gained', () => {
    expect(planDelta(start, { debt: 4200, savings: 900 })).toEqual({ debtPaidDown: 800, savingsGained: 700 });
  });
  it('clamps regressions to 0', () => {
    expect(planDelta(start, { debt: 6000, savings: 100 })).toEqual({ debtPaidDown: 0, savingsGained: 0 });
  });
  it('falls back to start values when latest fields are missing', () => {
    expect(planDelta(start, { debt: null, savings: null })).toEqual({ debtPaidDown: 0, savingsGained: 0 });
  });
  it('is zero with no start metrics', () => {
    expect(planDelta(null, { debt: 0, savings: 9999 })).toEqual({ debtPaidDown: 0, savingsGained: 0 });
  });
});
