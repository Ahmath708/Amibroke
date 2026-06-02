export type ExtractedFacts = {
  monthlyIncome: number;
  monthlyExpenses: number;
  liquidSavings: number;
  debts: Array<{
    name: string;
    balance: number;
    interestRate: number;
    minimumPayment: number;
    urgency: 'low' | 'medium' | 'high' | 'critical';
  }>;
};

export type DerivedMetrics = {
  monthlySavings: number;
  savingsRate: number;
  debtTotal: number;
  monthlyDebtService: number;
  emergencyFundMonths: number;
  debtToIncomeRatio: number;
};

export type PayoffStrategy = 'avalanche' | 'snowball';

export interface PayoffDebt {
  balance: number;
  interestRate: number;   // annual rate as a fraction (0–1), e.g. 0.2499 = 24.99% — matches the analyze schema
  minimumPayment: number;
}

export interface PayoffResult {
  months: number;          // months to debt-free (capped — see `feasible`)
  totalInterest: number;   // total interest paid over the life of the payoff
  feasible: boolean;       // false when payments can't outrun interest (never pays off)
}

const MAX_PAYOFF_MONTHS = 600; // 50yr safety cap for the "never pays off" case

/**
 * Month-by-month debt-payoff simulation. Each month: accrue interest on every
 * balance, pay each active debt its minimum, then route all remaining budget
 * (the extra payment + minimums freed by paid-off debts) at the priority debt —
 * avalanche = highest APR first, snowball = lowest balance first. Unlike a naive
 * balance/payment division, this reflects real interest and makes the strategy
 * choice actually change the outcome.
 */
export function simulateDebtPayoff(
  debts: PayoffDebt[],
  extraMonthly: number,
  strategy: PayoffStrategy,
): PayoffResult {
  const bal = debts.map((d) => ({ rate: d.interestRate, min: d.minimumPayment, balance: d.balance }));
  const monthlyBudget = debts.reduce((s, d) => s + d.minimumPayment, 0) + Math.max(0, extraMonthly);
  let months = 0;
  let totalInterest = 0;

  while (bal.some((d) => d.balance > 0.5) && months < MAX_PAYOFF_MONTHS) {
    months++;
    for (const d of bal) {
      if (d.balance > 0) {
        const interest = d.balance * (d.rate / 12); // rate is an annual fraction
        d.balance += interest;
        totalInterest += interest;
      }
    }
    let budget = monthlyBudget;
    for (const d of bal) {
      if (d.balance > 0) {
        const pay = Math.min(d.min, d.balance);
        d.balance -= pay;
        budget -= pay;
      }
    }
    const priority = bal
      .filter((d) => d.balance > 0)
      .sort((a, b) => (strategy === 'avalanche' ? b.rate - a.rate : a.balance - b.balance));
    for (const d of priority) {
      if (budget <= 0.5) break;
      const pay = Math.min(budget, d.balance);
      d.balance -= pay;
      budget -= pay;
    }
  }

  return { months, totalInterest: Math.round(totalInterest), feasible: months < MAX_PAYOFF_MONTHS };
}

export function deriveMetrics(facts: ExtractedFacts): DerivedMetrics {
  const monthlySavings = facts.monthlyIncome - facts.monthlyExpenses;
  const savingsRate = facts.monthlyIncome > 0 ? monthlySavings / facts.monthlyIncome : 0;
  const debtTotal = facts.debts.reduce((s, d) => s + d.balance, 0);
  const monthlyDebtService = facts.debts.reduce((s, d) => s + d.minimumPayment, 0);
  const emergencyFundMonths = facts.monthlyExpenses > 0 ? facts.liquidSavings / facts.monthlyExpenses : 0;
  const debtToIncomeRatio = facts.monthlyIncome > 0 ? monthlyDebtService / facts.monthlyIncome : 0;
  return {
    monthlySavings,
    savingsRate,
    debtTotal,
    monthlyDebtService,
    emergencyFundMonths,
    debtToIncomeRatio,
  };
}
