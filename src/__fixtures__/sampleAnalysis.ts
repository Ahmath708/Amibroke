import { FinalAnalysisSchema, ActionPlanResponseSchema, CaptionResponseSchema } from '@shared/schemas';
import type { FinalAnalysis, ActionPlanResponse, CaptionResponse } from '@shared/types';

export const SAMPLE_ANALYSIS: FinalAnalysis = FinalAnalysisSchema.parse({
  monthlyIncome: { value: 4800, confidence: 'high' },
  monthlyExpenses: { value: 4100, confidence: 'medium' },
  liquidSavings: { value: 1200, confidence: 'high' },
  debts: [
    { name: 'Capital One Credit Card', balance: 4200, interestRate: 0.2499, minimumPayment: 126, urgency: 'high' },
    { name: 'Car Loan', balance: 11500, interestRate: 0.079, minimumPayment: 310, urgency: 'medium' },
    { name: 'Medical Bill', balance: 800, interestRate: 0, minimumPayment: 50, urgency: 'low' },
  ],
  cfpb_responses: [
    { value: 0, confidence: 'high' },
    { value: 1, confidence: 'medium' },
    { value: 3, confidence: 'high' },
    { value: 1, confidence: 'medium' },
    { value: 3, confidence: 'high' },
    { value: 3, confidence: 'medium' },
    { value: 2, confidence: 'low' },
    { value: 0, confidence: 'high' },
    { value: 2, confidence: 'medium' },
    { value: 3, confidence: 'high' },
  ],
  scoreModifier: -2,
  scoreModifierReason: 'Gig-economy income is variable with no buffer against gaps.',
  summary: 'You are treading water with $700/mo surplus but carrying $4,200 in credit card debt at 25% APR that is silently compounding. Between the car loan and medical bill, almost half your monthly surplus goes to minimum payments before you touch the high-rate card. The next 90 days are about stopping the bleed on the card before it consumes your entire wiggle room.',
  roast: 'Bestie, you are literally paying $87 a month in credit card interest just to keep the door open. That\'s a streaming bundle, a pizza night, and half a pedicure — up in smoke, every single month, for the privilege of being in debt.',
  insights: [
    'Your credit card costs roughly $87/mo in interest — that\'s 17% of your monthly surplus gone before you do anything.',
    'With only $1,200 in savings, one car repair wipes out half your buffer and sends you back to the card.',
    'Your monthly debt minimums ($486) eat 69% of your surplus ($700), leaving just $214/mo for extra progress.',
    'Your savings rate of 4.2% is well below the 20% guideline, but the debt drag makes it hard to fix.',
  ],
  topProblems: [
    '$4,200 credit card balance at 25% APR growing faster than you can pay it down with minimums only.',
    'Savings of $1,200 is only 9 days of expenses — well below the 3-month emergency target.',
  ],
  positiveBehaviors: [
    'You have a reliable income and your fixed expenses are consistent — no mystery spending.',
    'Acknowledging the full picture including the medical bill is a sign of financial maturity.',
  ],
  topFix: {
    action: 'Put every dollar above $1,000 in savings toward the credit card until it\'s below $2,000 — roughly 5 months at $200/mo extra, saves about $420 in interest.',
    monthlyImpact: 200,
  },
  emotionalStatus: { label: 'Treading but not drowning', emoji: '😬' },
  mentionedSpending: [
    { category: 'Car insurance', amount: 165, source: 'user_stated' },
    { category: 'Gas', amount: 180, source: 'user_stated' },
    { category: 'Groceries', amount: 420, source: 'user_stated' },
    { category: 'Dining out', amount: 240, source: 'user_stated' },
  ],
  score: 55,
  scoreLabel: 'Surviving',
  scoreColor: '#FF6B00',
  monthlySavings: 200,
  savingsRate: 0.042,
  debtTotal: 16500,
  monthlyDebtService: 486,
  emergencyFundMonths: 0.29,
  debtToIncomeRatio: 0.34,
  avgConfidence: 0.73,
});

export const SAMPLE_ACTION_PLAN: ActionPlanResponse = ActionPlanResponseSchema.parse({
  overallMessage: 'You have income, a clear big problem (the credit card), and a small but real surplus. The first month is about creating a buffer so life stops resetting your progress; the rest is about momentum. You can absolutely do this.',
  steps: [
    {
      week: 'Week 1',
      title: 'Stop the $87/mo leak',
      description: 'Put $200 extra toward the Capital One card on top of the $126 minimum. $326 total/month. Set up the auto-pay on payday so you never see the money.',
      category: 'debt',
      impact: 'Saves roughly $87/mo in interest that would otherwise go to the bank instead of your future.',
      confidence: 'high',
    },
    {
      week: 'Weeks 2-3',
      title: 'Trim variable spending by $100/mo',
      description: 'You\'re spending $240/mo on dining out. Cut it to $140 — eat in 2 more dinners per week. Put the $100 saved toward the credit card on top of the $200 extra.',
      category: 'savings',
      impact: 'Brings total extra card payment to $300/mo and saves an additional $22/mo in interest.',
      confidence: 'medium',
    },
    {
      week: 'Weeks 4-6',
      title: 'Build a $1,000 mini emergency fund',
      description: 'Once the card drops below $3,000, redirect the $300 extra to savings until you hit $1,000. Keep paying minimums on everything.',
      category: 'savings',
      impact: 'A $1,000 buffer means the next car repair or medical bill goes to savings, not back onto the card.',
      confidence: 'medium',
    },
    {
      week: 'Weeks 7-10',
      title: 'Resume the debt avalanche',
      description: 'After the mini fund is full, put the full $300 extra back toward the credit card. Once the card hits $0, roll that $426 total freed-up cash to the car loan.',
      category: 'debt',
      impact: 'Credit card debt-free in about 9 months from now, saving roughly $390 in total interest.',
      confidence: 'high',
    },
  ],
});

export const SAMPLE_CAPTIONS: CaptionResponse = CaptionResponseSchema.parse({
  captions: [
    'Scored 55/100 on Am I Broke? — "Surviving." $4,200 in credit card debt at 25% APR. Check yours at aibroke.app',
    'Paying $87/mo in credit card interest for the privilege of being in debt 💀 Am I Broke? gave me a 55. aibroke.app',
    '"Surviving" with $700/mo surplus but $486/mo in minimums. The math is not mathing. aibroke.app',
  ],
});
