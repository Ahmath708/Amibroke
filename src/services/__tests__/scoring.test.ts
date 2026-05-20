import { calculateFinancialScore } from '@/services/scoring';
import { SCORING_WEIGHTS } from '@/config/scoring';

describe('calculateFinancialScore', () => {
  it('returns 100 for perfect finances', () => {
    const result = calculateFinancialScore({
      monthlyIncome: 10000,
      monthlyExpenses: 4000,
      monthlySavings: 6000,
      debtTotal: 0,
      savingsRate: 0.30,
      emergencyFundMonths: 12,
      debtToIncomeRatio: 0,
      spendingBreakdown: [
        { name: 'Housing', amount: 1500, percentage: 0.15 },
        { name: 'Food', amount: 500, percentage: 0.05 },
      ],
    });
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.label).toBe('Thriving');
  });

  it('returns 0 for dire finances', () => {
    const result = calculateFinancialScore({
      monthlyIncome: 3000,
      monthlyExpenses: 3500,
      monthlySavings: -500,
      debtTotal: 50000,
      savingsRate: -0.17,
      emergencyFundMonths: 0,
      debtToIncomeRatio: 1.39,
      spendingBreakdown: [
        { name: 'DoorDash', amount: 800, percentage: 0.27 },
        { name: 'Entertainment', amount: 400, percentage: 0.13 },
      ],
    });
    expect(result.score).toBeLessThanOrEqual(30);
    expect(result.label).toBe('Broke AF');
  });

  it('returns middle-range for average finances', () => {
    const result = calculateFinancialScore({
      monthlyIncome: 5000,
      monthlyExpenses: 3500,
      monthlySavings: 1500,
      debtTotal: 10000,
      savingsRate: 0.10,
      emergencyFundMonths: 2,
      debtToIncomeRatio: 0.17,
      spendingBreakdown: [
        { name: 'Housing', amount: 1400, percentage: 0.28 },
        { name: 'Food', amount: 600, percentage: 0.12 },
      ],
    });
    expect(result.score).toBeGreaterThanOrEqual(31);
    expect(result.score).toBeLessThanOrEqual(80);
  });

  it('includes a breakdown with all four components', () => {
    const result = calculateFinancialScore({
      monthlyIncome: 6000,
      monthlyExpenses: 4000,
      monthlySavings: 2000,
      debtTotal: 15000,
      savingsRate: 0.15,
      emergencyFundMonths: 3,
      debtToIncomeRatio: 0.21,
      spendingBreakdown: [
        { name: 'Housing', amount: 1800, percentage: 0.30 },
        { name: 'Food', amount: 800, percentage: 0.13 },
      ],
    });
    expect(result.breakdown).toBeDefined();
    expect(result.breakdown.savingsRateScore).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.debtToIncomeScore).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.expenseAllocationScore).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.emergencyFundScore).toBeGreaterThanOrEqual(0);
  });

  it('uses custom weights when provided', () => {
    const defaultResult = calculateFinancialScore({
      monthlyIncome: 5000,
      monthlyExpenses: 3000,
      monthlySavings: 2000,
      debtTotal: 5000,
      savingsRate: 0.20,
      emergencyFundMonths: 4,
      debtToIncomeRatio: 0.08,
      spendingBreakdown: [],
    });

    const customResult = calculateFinancialScore({
      monthlyIncome: 5000,
      monthlyExpenses: 3000,
      monthlySavings: 2000,
      debtTotal: 5000,
      savingsRate: 0.20,
      emergencyFundMonths: 4,
      debtToIncomeRatio: 0.08,
      spendingBreakdown: [],
    }, {
      savingsRate: 0.50,
      debtToIncome: 0.50,
      expenseAllocation: 0,
      emergencyFund: 0,
    });

    expect(customResult.score).not.toBe(defaultResult.score);
  });
});
