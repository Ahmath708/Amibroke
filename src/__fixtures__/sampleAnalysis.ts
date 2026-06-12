import { FinalAnalysisSchema, ActionPlanResponseSchema, CaptionResponseSchema } from '@shared/schemas';
import type { FinalAnalysis, ActionPlanResponse, CaptionResponse } from '@shared/types';
import { getScoreBand } from '@shared/scoring/bands.ts';
import { computeFinalScore } from '@shared/scoring/index.ts';
import { scoreFromRawTotal } from '@shared/scoring/cfpb_irt.ts';
import { personaLatest, debtTotal, emojiFor, type PersonaPoint } from './demoPersona';

// Mock scores are DERIVED from the real engine (computeFinalScore), never hardcoded — so a fixture can
// never claim a score its own CFPB answers don't support (the old mock drifted to an impossible 80: its
// template answers actually computed to ~43). `scoredCfpb(target)` synthesizes 10 high-confidence
// responses that reverse-code to the published raw total nearest `target`, plus the small modifier that
// closes the gap; with all-high confidence the engine's attenuation is the identity, so the computed
// score === target exactly. CFPB item layout: forward items at indices 0,1,3,7; reverse-coded at 2,4,5,6,8,9.
const FORWARD_IDX = [0, 1, 3, 7];
const REVERSE_IDX = [2, 4, 5, 6, 8, 9];

/** Greedily place `total` across `n` slots, ≤4 each (the CFPB per-item response cap). */
function fillN(total: number, n: number): number[] {
  const out = new Array(n).fill(0) as number[];
  let rem = total;
  for (let i = 0; i < n && rem > 0; i++) { const v = Math.min(4, rem); out[i] = v; rem -= v; }
  return out;
}

/** A 10-item high-confidence response vector that reverse-codes to raw total `raw` (0–40).
 *  raw = 24 + Σforward − Σreverse, so load forward high (reverse 0) for high raw, and vice-versa. */
function responsesForRaw(raw: number): { value: number; confidence: 'high' }[] {
  const d = raw - 24;
  const fwd = fillN(d >= 0 ? d : 0, FORWARD_IDX.length);
  const rev = fillN(d < 0 ? -d : 0, REVERSE_IDX.length);
  const values = new Array(10).fill(0) as number[];
  FORWARD_IDX.forEach((idx, k) => { values[idx] = fwd[k]; });
  REVERSE_IDX.forEach((idx, k) => { values[idx] = rev[k]; });
  return values.map((v) => ({ value: v, confidence: 'high' as const }));
}

/** Score block (responses + modifier + engine-derived score/label/color) whose computed score === `target`. */
function scoredCfpb(target: number) {
  // Pick the published raw total whose table score is nearest target; the remainder becomes the modifier.
  let best = { raw: 20, mod: target - scoreFromRawTotal(20) };
  for (let raw = 0; raw <= 40; raw++) {
    const mod = target - scoreFromRawTotal(raw);
    if (Math.abs(mod) < Math.abs(best.mod)) best = { raw, mod };
  }
  const cfpb_responses = responsesForRaw(best.raw);
  const { score, scoreLabel, scoreColor } = computeFinalScore(cfpb_responses, best.mod);
  return {
    cfpb_responses,
    scoreModifier: best.mod,
    scoreModifierReason: best.mod !== 0 ? 'Rounded to the nearest published CFPB score band.' : '',
    score,
    scoreLabel,
    scoreColor,
  };
}
const SPENDING_TEMPLATE = [
  { category: 'Groceries', amount: 420, source: 'user_stated' },
  { category: 'Dining out', amount: 180, source: 'user_stated' },
  { category: 'Gas', amount: 160, source: 'user_stated' },
  { category: 'Car insurance', amount: 165, source: 'user_stated' },
];

const round2 = (n: number) => Math.round(n * 100) / 100;
const urgencyFor = (apr: number): 'high' | 'medium' | 'low' => (apr >= 20 ? 'high' : apr >= 5 ? 'medium' : 'low');
const minPayment = (balance: number, apr: number) => (apr === 0 ? 50 : Math.max(25, Math.round(balance * 0.025)));

function roastByTier(score: number): string {
  if (score >= 78) return "Bestie, who let you become responsible? Card in the ground, savings actually growing — respectfully, the algorithm fumbled serving you a finance-roast app.";
  if (score >= 65) return "Momentum's real — the debt's shrinking and a buffer's forming. Don't get cocky, but yeah, maybe smile a little.";
  if (score >= 50) return "Head's above water now. Every extra dollar you throw at the highest-rate balance is one that stops haunting you at 2am.";
  return "It's rough — spending's outrunning income and the card is the pressure valve. But you're here, looking at the numbers. That's step one and most people skip it.";
}

/** Build a coherent FinalAnalysis for a persona point — figures from the point, qualitative text kept
 *  generic so it never contradicts (the latest point returns the hand-authored SAMPLE_ANALYSIS). */
export function pointToAnalysis(p: PersonaPoint): FinalAnalysis {
  if (p.id === personaLatest().id) return SAMPLE_ANALYSIS;
  const band = getScoreBand(p.score);
  const scored = scoredCfpb(p.score); // CFPB answers + modifier whose engine score === p.score
  const debt = debtTotal(p);
  const monthlySavings = p.income - p.expenses;
  const debts = p.debts.map((d) => ({
    name: d.name, balance: d.balance, interestRate: round2(d.apr) / 100,
    minimumPayment: minPayment(d.balance, d.apr), urgency: urgencyFor(d.apr),
  }));
  const biggest = [...p.debts].sort((a, b) => b.balance - a.balance)[0];
  const hasCard = p.debts.some((d) => d.apr >= 20);
  return FinalAnalysisSchema.parse({
    monthlyIncome: { value: p.income, confidence: 'high' },
    monthlyExpenses: { value: p.expenses, confidence: 'high' },
    liquidSavings: { value: p.savings, confidence: 'medium' },
    debts,
    cfpb_responses: scored.cfpb_responses,
    scoreModifier: scored.scoreModifier,
    scoreModifierReason: scored.scoreModifierReason,
    summary: p.note ?? `${band.label}. $${debt.toLocaleString()} in debt, $${p.savings.toLocaleString()} saved.`,
    roast: roastByTier(p.score),
    insights: [
      `Your savings rate is about ${Math.round((monthlySavings / p.income) * 100)}% this month.`,
      `You're carrying $${debt.toLocaleString()} across ${p.debts.length} account${p.debts.length > 1 ? 's' : ''}.`,
      hasCard
        ? `The ${biggest.name} at ${biggest.apr}% APR is the one bleeding you — kill it first.`
        : `The ${biggest.name} at ${biggest.apr}% is your last real debt — steady payments end it.`,
    ],
    topProblems: [
      hasCard
        ? `$${biggest.balance.toLocaleString()} on the ${biggest.name} at ${biggest.apr}% APR compounds faster than minimums clear it.`
        : `The $${biggest.balance.toLocaleString()} ${biggest.name} is the last meaningful debt to clear.`,
      p.savings < p.expenses
        ? `Savings of $${p.savings.toLocaleString()} is under a month of expenses — thin if something breaks.`
        : `Your buffer is forming but isn't a full emergency fund yet.`,
    ],
    positiveBehaviors: [
      'Consistent income and steady fixed costs — no mystery spending.',
      monthlySavings > 0 ? "You're running a real monthly surplus now." : "You're facing the whole picture honestly — that's the start.",
    ],
    topFix: {
      action: hasCard
        ? `Throw every spare dollar at the ${biggest.name} until it's gone — it's the most expensive money you owe.`
        : 'Keep the freed-up card payment flowing to savings until you have one full month of expenses parked.',
      monthlyImpact: 200,
    },
    emotionalStatus: { label: band.label, emoji: emojiFor(p.score) },
    mentionedSpending: SPENDING_TEMPLATE,
    score: scored.score,
    scoreLabel: scored.scoreLabel,
    scoreColor: scored.scoreColor,
    monthlySavings,
    savingsRate: p.income ? round2(monthlySavings / p.income) : 0,
    debtTotal: debt,
    monthlyDebtService: debts.reduce((s, d) => s + d.minimumPayment, 0),
    emergencyFundMonths: p.expenses ? round2(p.savings / p.expenses) : 0,
    debtToIncomeRatio: p.income ? round2(debt / (p.income * 12)) : 0,
    avgConfidence: 0.8,
  });
}

// The current state (Jun 1, score 80) — Jason's latest roast. Hand-authored so the most-shown roast is
// punchy + specific; everything else (snapshot, money trend, captions) lines up with these figures.
const SAMPLE = scoredCfpb(80); // engine-derived score block for the hero roast (so 80 is real, not asserted)
export const SAMPLE_ANALYSIS: FinalAnalysis = FinalAnalysisSchema.parse({
  monthlyIncome: { value: 5000, confidence: 'high' },
  monthlyExpenses: { value: 3700, confidence: 'high' },
  liquidSavings: { value: 2600, confidence: 'high' },
  debts: [
    { name: 'Car Loan', balance: 9800, interestRate: 0.079, minimumPayment: 310, urgency: 'medium' },
  ],
  cfpb_responses: SAMPLE.cfpb_responses,
  scoreModifier: SAMPLE.scoreModifier,
  scoreModifierReason: SAMPLE.scoreModifierReason,
  summary: 'The card is gone, savings are real, and you are finally ahead of your bills instead of chasing them. The $9,800 car loan is the last boss — and at 7.9% it is very beatable. The next move is turning the freed-up card payment into a full emergency fund.',
  roast: "Bestie, who let you get responsible? Credit card in the ground, an emergency fund forming, and you actually saved this month. Respectfully — the algorithm fumbled serving a finance-roast app to someone winning this hard.",
  insights: [
    'You killed the Capital One card — that is roughly $87/mo in interest you no longer set on fire.',
    'Savings of $2,600 is a real buffer now: about three weeks of expenses, climbing toward a full month.',
    'With the card gone, the car loan at 7.9% is the only meaningful debt left — steady payments retire it.',
  ],
  topProblems: [
    'The $9,800 car loan is the last debt standing — not urgent at 7.9%, but the final step to debt-free.',
    'Savings is building but still under a full month of expenses, so a big surprise could still sting.',
  ],
  positiveBehaviors: [
    'You paid off a 25% APR card — the single highest-return money move available to anyone.',
    'Spending is down and savings are automated. The hard part is genuinely behind you.',
  ],
  topFix: {
    action: 'Keep the old $326 card payment flowing into savings until you have one full month of expenses (~$3,700) parked, then split it between the buffer and the car loan.',
    monthlyImpact: 326,
  },
  emotionalStatus: { label: getScoreBand(80).label, emoji: emojiFor(80) },
  mentionedSpending: SPENDING_TEMPLATE,
  score: SAMPLE.score,
  scoreLabel: SAMPLE.scoreLabel,
  scoreColor: SAMPLE.scoreColor,
  monthlySavings: 1300,
  savingsRate: 0.26,
  debtTotal: 9800,
  monthlyDebtService: 310,
  emergencyFundMonths: 0.7,
  debtToIncomeRatio: 0.16,
  avgConfidence: 0.85,
});

export const SAMPLE_ACTION_PLAN: ActionPlanResponse = ActionPlanResponseSchema.parse({
  overallMessage: 'The expensive debt is dead and you are saving — now the job is turning this momentum into a real cushion and closing out the car loan. Steady beats heroic.',
  steps: [
    {
      week: 'Week 1',
      title: 'Redirect the old card payment',
      description: 'You freed up ~$326/mo when the Capital One card died. Auto-transfer it to savings on payday so it never touches your checking.',
      category: 'savings',
      impact: 'Turns a debt payment into ~$326/mo of cushion without feeling a thing.',
      confidence: 'high',
    },
    {
      week: 'Weeks 2-4',
      title: 'Hit a one-month emergency fund',
      description: 'Keep the auto-transfer running until savings reach one full month of expenses (~$3,700). Park it somewhere boring you will not touch.',
      category: 'savings',
      impact: 'A full month of expenses means the next surprise goes to savings, not a new card.',
      confidence: 'high',
    },
    {
      week: 'Weeks 5-8',
      title: 'Throw extra at the car loan',
      description: 'Once the buffer is full, split the $326: half stays in savings, half goes on top of the car-loan minimum.',
      category: 'debt',
      impact: 'Knocks months off the 7.9% car loan and the interest that rides with it.',
      confidence: 'medium',
    },
    {
      week: 'Weeks 9-12',
      title: '30-day re-roast',
      description: 'Run a fresh roast and compare to where you started in April. Lock in the habits that moved the score.',
      category: 'mindset',
      impact: 'Accountability + proof the system works keeps the streak alive.',
      confidence: 'high',
    },
  ],
});

export const SAMPLE_CAPTIONS: CaptionResponse = CaptionResponseSchema.parse({
  captions: [
    'Went from 42 to 80 on Am I Broke? in three months — paid off the card, built a real cushion. aibroke.app',
    'Killed a 25% APR credit card and my score hit 80 💪 The glow-up is real. Am I Broke? — aibroke.app',
    'From "paycheck to paycheck" to actually saving. 80/100 and climbing. Check yours at aibroke.app',
  ],
});
