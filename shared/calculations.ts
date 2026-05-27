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
