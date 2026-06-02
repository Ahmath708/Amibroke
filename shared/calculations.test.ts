import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deriveMetrics, simulateDebtPayoff } from './calculations';

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

void describe('simulateDebtPayoff', () => {
  const A = { balance: 2000, interestRate: 0.30, minimumPayment: 120 };
  const B = { balance: 500, interestRate: 0.08, minimumPayment: 25 };

  void it('single debt pays off in finite time and accrues real interest', () => {
    const r = simulateDebtPayoff([{ balance: 1000, interestRate: 0.12, minimumPayment: 100 }], 0, 'avalanche');
    assert.equal(r.feasible, true);
    assert.ok(r.months > 0 && r.months < 15);
    assert.ok(r.totalInterest > 0); // a naive balance/payment model would report ~0
  });

  void it('avalanche pays no more interest than snowball', () => {
    const ava = simulateDebtPayoff([A, B], 200, 'avalanche');
    const sno = simulateDebtPayoff([A, B], 200, 'snowball');
    assert.ok(ava.totalInterest <= sno.totalInterest);
  });

  void it('extra payments reduce both months and total interest', () => {
    const minOnly = simulateDebtPayoff([A, B], 0, 'avalanche');
    const withExtra = simulateDebtPayoff([A, B], 300, 'avalanche');
    assert.ok(withExtra.months < minOnly.months);
    assert.ok(withExtra.totalInterest < minOnly.totalInterest);
  });

  void it('flags infeasible when payments cannot outrun interest', () => {
    const r = simulateDebtPayoff([{ balance: 10000, interestRate: 0.24, minimumPayment: 100 }], 0, 'avalanche');
    assert.equal(r.feasible, false);
  });
});
