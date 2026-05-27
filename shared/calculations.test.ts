import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deriveMetrics } from './calculations';

void describe('deriveMetrics', () => {
  void it('typical user with income, expenses, savings, no debt', () => {
    const result = deriveMetrics({
      monthlyIncome: 4000,
      monthlyExpenses: 3000,
      liquidSavings: 5000,
      debts: [],
    });
    assert.equal(result.monthlySavings, 1000);
    assert.equal(result.savingsRate, 0.25);
    assert.equal(result.debtTotal, 0);
    assert.equal(result.monthlyDebtService, 0);
    assert.equal(result.debtToIncomeRatio, 0);
    assert.equal(result.emergencyFundMonths, 5000 / 3000);
  });

  void it('unemployed user (income=0): no divide-by-zero', () => {
    const result = deriveMetrics({
      monthlyIncome: 0,
      monthlyExpenses: 1500,
      liquidSavings: 200,
      debts: [],
    });
    assert.equal(result.monthlySavings, -1500);
    assert.equal(result.savingsRate, 0);
    assert.equal(result.debtToIncomeRatio, 0);
    assert.equal(result.emergencyFundMonths, 200 / 1500);
  });

  void it('no expenses: emergencyFundMonths=0, no divide-by-zero', () => {
    const result = deriveMetrics({
      monthlyIncome: 3000,
      monthlyExpenses: 0,
      liquidSavings: 10000,
      debts: [],
    });
    assert.equal(result.monthlySavings, 3000);
    assert.equal(result.emergencyFundMonths, 0);
  });

  void it('multiple debts: sum totals correctly', () => {
    const result = deriveMetrics({
      monthlyIncome: 5000,
      monthlyExpenses: 3500,
      liquidSavings: 2000,
      debts: [
        { name: 'CC', balance: 5000, interestRate: 0.22, minimumPayment: 150, urgency: 'high' },
        { name: 'Car', balance: 12000, interestRate: 0.06, minimumPayment: 300, urgency: 'medium' },
        { name: 'Student', balance: 15000, interestRate: 0.05, minimumPayment: 200, urgency: 'low' },
      ],
    });
    assert.equal(result.debtTotal, 5000 + 12000 + 15000);
    assert.equal(result.monthlyDebtService, 150 + 300 + 200);
    assert.equal(result.debtToIncomeRatio, (150 + 300 + 200) / 5000);
  });

  void it('negative savings (expenses exceed income)', () => {
    const result = deriveMetrics({
      monthlyIncome: 3800,
      monthlyExpenses: 4500,
      liquidSavings: 0,
      debts: [],
    });
    assert.equal(result.monthlySavings, -700);
    assert.equal(result.savingsRate, -700 / 3800);
    assert.equal(result.emergencyFundMonths, 0);
  });
});
