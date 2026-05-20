import { useMemo } from 'react';

export interface DebtItem {
  name: string;
  balance: number;
  interestRate: number;
  minimumPayment: number;
}

export interface DebtPayoffResult {
  totalDebt: number;
  totalInterest: number;
  monthsToPayoff: number;
  schedule: { month: number; payment: number; balance: number; interest: number }[];
  strategy: 'avalanche' | 'snowball';
}

export function useDebtStrategy(debts: DebtItem[], extraPayment = 0) {
  const avalanche = useMemo(() => calculatePayoff(debts, extraPayment, 'avalanche'), [debts, extraPayment]);
  const snowball = useMemo(() => calculatePayoff(debts, extraPayment, 'snowball'), [debts, extraPayment]);

  const recommended = avalanche.totalInterest < snowball.totalInterest ? avalanche : snowball;

  return {
    avalanche,
    snowball,
    recommended,
    totalDebt: debts.reduce((sum, d) => sum + d.balance, 0),
    totalMinimumPayment: debts.reduce((sum, d) => sum + d.minimumPayment, 0),
  };
}

function calculatePayoff(
  debts: DebtItem[],
  extraPayment: number,
  strategy: 'avalanche' | 'snowball',
): DebtPayoffResult {
  const sorted = [...debts].sort((a, b) =>
    strategy === 'avalanche'
      ? b.interestRate - a.interestRate
      : a.balance - b.balance,
  );

  const balances = sorted.map((d) => d.balance);
  const rates = sorted.map((d) => d.interestRate / 100 / 12);
  const minimums = sorted.map((d) => d.minimumPayment);
  const schedule: DebtPayoffResult['schedule'] = [];

  let month = 0;
  let totalInterest = 0;
  const maxMonths = 600;

  while (balances.some((b) => b > 0) && month < maxMonths) {
    month++;
    let extraBudget = extraPayment;
    const monthlyInterest = balances.map((b, i) => b * rates[i]);
    totalInterest += monthlyInterest.reduce((a, b) => a + b, 0);

    for (let i = 0; i < sorted.length; i++) {
      if (balances[i] <= 0) continue;

      const interest = monthlyInterest[i];
      balances[i] += interest;

      let payment = minimums[i];
      if (i === 0) {
        payment += extraBudget;
        extraBudget = 0;
      }

      if (payment >= balances[i]) {
        payment = balances[i];
        extraBudget += minimums[i] - payment;
        balances[i] = 0;
      } else {
        balances[i] -= payment;
      }
    }

    schedule.push({
      month,
      payment: sorted.reduce((sum, _, i) => sum + (balances[i] > 0 ? minimums[i] : 0), 0) + extraPayment,
      balance: balances.reduce((a, b) => a + Math.max(0, b), 0),
      interest: monthlyInterest.reduce((a, b) => a + b, 0),
    });
  }

  return {
    totalDebt: debts.reduce((sum, d) => sum + d.balance, 0),
    totalInterest: Math.round(totalInterest * 100) / 100,
    monthsToPayoff: month,
    schedule,
    strategy,
  };
}
