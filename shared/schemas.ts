import { z } from 'zod';

// ─── User context (the structured form) ─────────────────────────

export const USStateSchema = z.enum([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', 'unknown',
]);

export const UserContextSchema = z.object({
  state: USStateSchema,
  ageBracket: z.enum(['18-24', '25-29', '30-34', '35-44', '45+', 'unknown']),
  incomeBracket: z.enum(['under_2k', '2k_4k', '4k_6k', '6k_10k', 'over_10k', 'unknown']),
  livingSituation: z.enum(['renting', 'owning', 'with_family', 'dorm', 'other', 'unknown']),
  employmentStatus: z.enum(['full_time', 'part_time', 'self_employed', 'student', 'between_jobs', 'unknown']),
  debtBracket: z.enum(['none', 'under_5k', '5k_15k', '15k_50k', 'over_50k', 'unknown']).default('none'),
  liquidSavingsBracket: z.enum(['none', 'under_500', '500_2k', '2k_10k', '10k_50k', 'over_50k', 'unknown']).default('under_500'),
  primaryConcern: z.enum(['debt_payoff', 'building_savings', 'curious', 'investing', 'other']).optional(),
});

// ─── Request body sent from frontend to /analyze ────────────────

export const AnalyzeRequestSchema = z.object({
  freeText: z.string().min(10).max(5000),
  userContext: UserContextSchema,
  tone: z.enum(['savage', 'gentle', 'therapist', 'older_sibling', 'finance_bro']),
});

// ─── AI's structured output (the tool call) ─────────────────────

const NumberWithConfidence = z.object({
  value: z.number().min(0),
  confidence: z.enum(['low', 'medium', 'high']),
});

const DebtItem = z.object({
  name: z.string().max(40),
  balance: z.number().min(0),
  interestRate: z.number().min(0).max(0.5),
  minimumPayment: z.number().min(0),
  urgency: z.enum(['low', 'medium', 'high', 'critical']),
});

const CfpbResponse = z.object({
  value: z.number().int().min(0).max(4),
  confidence: z.enum(['low', 'medium', 'high']),
});

const MentionedSpending = z.object({
  category: z.string().max(40),
  amount: z.number().min(0),
  source: z.literal('user_stated'),
});

export const AIRawOutputSchema = z.object({
  monthlyIncome: NumberWithConfidence,
  monthlyExpenses: NumberWithConfidence,
  liquidSavings: NumberWithConfidence,
  debts: z.array(DebtItem).max(8),
  cfpb_responses: z.array(CfpbResponse).length(10),

  scoreModifier: z.number().int().min(-10).max(10),
  scoreModifierReason: z.string().max(200),
  summary: z.string().max(400),
  roast: z.string().max(240),
  insights: z.array(z.string().max(160)).max(5),
  topProblems: z.array(z.string().max(140)).max(3),
  positiveBehaviors: z.array(z.string().max(140)).max(3),
  topFix: z.object({
    action: z.string().max(200),
    monthlyImpact: z.number().min(0),
  }),
  emotionalStatus: z.object({
    label: z.string().max(40),
    emoji: z.string().max(4),
  }),
  mentionedSpending: z.array(MentionedSpending).max(10),
});

// ─── Final response sent from edge function back to frontend ────

export const FinalAnalysisSchema = AIRawOutputSchema.extend({
  score: z.number().min(0).max(100),
  scoreLabel: z.string(),
  scoreColor: z.string(),
  monthlySavings: z.number(),
  savingsRate: z.number(),
  debtTotal: z.number(),
  monthlyDebtService: z.number(),
  emergencyFundMonths: z.number(),
  debtToIncomeRatio: z.number(),
  avgConfidence: z.number().min(0).max(1),
});
