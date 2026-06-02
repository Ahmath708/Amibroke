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
  // Total monthly outlay stays CONSTANT (sum of minimums + extra). As debts clear,
  // their freed-up minimums roll into the attack budget — the snowball/avalanche engine.
  const monthlyBudget = debts.reduce((s, d) => s + d.minimumPayment, 0) + Math.max(0, extraMonthly);

  // Commit to ONE payoff order up front (the canonical method): avalanche attacks the
  // highest APR first, snowball the smallest balance first. Computing it once — rather
  // than re-sorting each month — avoids "target thrashing" (a high-minimum debt dipping
  // below the current target and silently stealing focus), which would understate
  // snowball's true cost and diverge from the method users are told they're following.
  const order = bal
    .map((_, i) => i)
    .sort((i, j) => (strategy === 'avalanche' ? bal[j].rate - bal[i].rate : bal[i].balance - bal[j].balance));

  let months = 0;
  let totalInterest = 0;

  while (bal.some((d) => d.balance > 0.5) && months < MAX_PAYOFF_MONTHS) {
    months++;
    // 1. Accrue one month of interest on every outstanding balance.
    for (const d of bal) {
      if (d.balance > 0) {
        const interest = d.balance * (d.rate / 12); // rate is an annual fraction
        d.balance += interest;
        totalInterest += interest;
      }
    }
    // 2. Pay the minimum on every debt (capped at its remaining balance).
    let budget = monthlyBudget;
    for (const d of bal) {
      if (d.balance > 0) {
        const pay = Math.min(d.min, d.balance);
        d.balance -= pay;
        budget -= pay;
      }
    }
    // 3. Throw everything left (extra + minimums freed by cleared debts) at the target
    //    debts in the committed order, cascading to the next once one is paid off.
    for (const i of order) {
      if (budget <= 0.5) break;
      if (bal[i].balance <= 0) continue;
      const pay = Math.min(budget, bal[i].balance);
      bal[i].balance -= pay;
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
