import { z } from 'zod';

const SpendingCategorySchema = z.object({
  name: z.string(),
  amount: z.number(),
  percentage: z.number(),
  color: z.string(),
  status: z.enum(['good', 'warning', 'danger']),
});

const DebtItemSchema = z.object({
  name: z.string(),
  balance: z.number(),
  interestRate: z.number(),
  minimumPayment: z.number(),
  urgency: z.enum(['low', 'medium', 'high', 'critical']),
});

const ActionStepSchema = z.object({
  week: z.number(),
  title: z.string(),
  description: z.string(),
  impact: z.string(),
  category: z.enum(['savings', 'debt', 'income', 'mindset']),
  completed: z.boolean(),
});

export const FinancialAnalysisSchema = z.object({
  score: z.number().min(0).max(100),
  scoreLabel: z.string(),
  scoreColor: z.string(),
  summary: z.string(),
  roast: z.string(),
  monthlyIncome: z.number(),
  monthlyExpenses: z.number(),
  monthlySavings: z.number(),
  debtTotal: z.number(),
  savingsRate: z.number(),
  emergencyFundMonths: z.number(),
  debtToIncomeRatio: z.number(),
  spendingBreakdown: z.array(SpendingCategorySchema),
  debts: z.array(DebtItemSchema),
  actionPlan: z.array(ActionStepSchema),
  insights: z.array(z.string()),
  topProblems: z.array(z.string()).optional(),
  positiveBehaviors: z.array(z.string()).optional(),
  topFix: z.object({
    action: z.string(),
    monthlyImpact: z.number(),
  }).optional(),
  emotionalStatus: z.object({
    label: z.string(),
    emoji: z.string(),
  }).optional(),
});

export type ValidatedFinancialAnalysis = z.infer<typeof FinancialAnalysisSchema>;
