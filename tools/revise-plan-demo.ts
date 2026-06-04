/**
 * Active Plan — Claude REVISION demo / prompt harness.  ⚠️ PAID (Anthropic API).
 *
 * Prototypes the Phase-2 capability: when the user's situation changes, Claude
 * REVISES the remaining steps of their committed 90-day plan (keeping done steps
 * as wins). Runs locally against the real Anthropic API so we can iterate the
 * prompt cheaply BEFORE it goes into an edge function. Validates Claude's
 * structured tool output with the SAME Zod schema the app uses
 * (ActionPlanResponseSchema), then runs deterministic checks on the revision —
 * demonstrating the "commodity Claude + our deterministic code" split.
 *
 * Usage:  npx tsx tools/revise-plan-demo.ts [--case <id>] [--raw]
 *   ONE Anthropic call per case (default: the first case). 40-call session cap.
 */
import fs from 'fs';
import path from 'path';
import { recordApiCall, getCounterState } from './lib/call-counter';
import { ActionPlanResponseSchema } from '../shared/schemas';

// ── minimal .env loader (just ANTHROPIC_API_KEY) ──────────────────────────────
(function loadEnv() {
  try {
    const env = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf-8');
    for (const line of env.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* ignore */ }
})();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';
const MODEL = 'claude-sonnet-4-6';
const API_URL = 'https://api.anthropic.com/v1/messages';

// Same step shape as the live action-plan tool (supabase/functions/action-plan/tool.ts).
const generatePlanTool = {
  name: 'generate_plan',
  description: 'Return the REVISED 90-day action plan (the remaining + any new steps). Server validates it.',
  input_schema: {
    type: 'object',
    required: ['steps', 'overallMessage'],
    properties: {
      steps: {
        type: 'array', minItems: 4, maxItems: 6,
        items: {
          type: 'object',
          required: ['week', 'title', 'description', 'category', 'impact', 'confidence'],
          properties: {
            week: { type: 'string', maxLength: 20 },
            title: { type: 'string', maxLength: 80 },
            description: { type: 'string', maxLength: 300 },
            category: { type: 'string', enum: ['savings', 'debt', 'income', 'mindset'] },
            impact: { type: 'string', maxLength: 200 },
            confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          },
        },
      },
      overallMessage: { type: 'string', maxLength: 400 },
    },
  },
};

// ── The REVISE system prompt (iterate here; later → edge fn prompt file) ───────
const REVISE_SYSTEM = `You are "Am I Broke?" — REVISING a user's existing 90-day action plan because their finances changed. You return ONLY the generate_plan tool call. No prose, no markdown.

The user message is JSON: { completedSteps, remainingSteps, change, startSnapshot, currentSnapshot }.
- completedSteps: steps the user already finished (their wins). Do NOT re-list these as todos.
- remainingSteps: the not-yet-done steps from the current plan.
- change: a plain-English description of what changed.
- startSnapshot / currentSnapshot: their numbers when the plan started vs now.

# How to revise
1. Acknowledge progress + the change in overallMessage (1-2 sentences) — reference what they finished and what changed.
2. Produce 4-6 steps that REPLACE the remaining steps, re-fit to currentSnapshot:
   - DROP any remaining step that no longer applies (e.g., a debt step once that debt is $0).
   - KEEP/adapt remaining steps that still make sense.
   - ADD new steps that fit the new reality (e.g., bigger surplus → aggressive saving/investing).
3. Anchor every step to a SPECIFIC number from currentSnapshot (e.g. "automate $1,400/mo", not "save more").
4. Each step: week, title (<=80), description (<=300), category ('savings'|'debt'|'income'|'mindset'), impact (<=200), confidence ('low'|'medium'|'high').
5. If the user is now in great shape (no debt, strong surplus), pivot to optimization/growth — not survival.

NEVER pretend to be a licensed advisor, guarantee outcomes, or mention self-harm.`;

// ── Test cases (each = 1 Anthropic call; add more to "build upon it") ──────────
type Snapshot = { score: number; debtTotal: number; monthlyIncome: number; monthlySavings: number; liquidSavings: number };
type StepKind = 'debt_paydown' | 'build_efund' | 'cut_spend' | 'grow_income' | 'habit';
type PlanStep = { week: string; title: string; description: string; category: string; impact: string; confidence: string; target?: { kind?: StepKind; amount?: number } };
type Case = {
  id: string;
  label: string;
  completedSteps: PlanStep[];
  remainingSteps: PlanStep[];
  change: string;
  startSnapshot: Snapshot;
  currentSnapshot: Snapshot;
  /** Deterministic checks on the revision (the "our code validates Claude" half).
   *  steps may carry `status` in patch mode (so checks can exempt completed steps). */
  checks: (steps: (PlanStep & { status?: string })[], overallMessage: string) => { name: string; pass: boolean }[];
};

const CASES: Case[] = [
  {
    id: 'debt-cleared-and-raise',
    label: 'Paid off the $5k card + got a raise to $5,200/mo',
    completedSteps: [
      { week: 'Week 1', title: 'Attack the $5,000 credit card', description: 'Throw every spare dollar at the 24% APR card.', category: 'debt', impact: 'Kills $100/mo interest', confidence: 'high' },
    ],
    remainingSteps: [
      { week: 'Weeks 2-3', title: 'Build a $1,200 starter emergency fund', description: 'Auto-transfer $150/wk until you hit one month of expenses.', category: 'savings', impact: 'Stops the next surprise from becoming debt', confidence: 'medium' },
      { week: 'Weeks 4-6', title: 'Pay $50 extra on the card monthly', description: 'On top of minimums, hit the highest-rate balance.', category: 'debt', impact: 'Less interest', confidence: 'medium' },
      { week: 'Weeks 7-8', title: 'Negotiate your phone + internet bills', description: 'Call and ask for retention rates.', category: 'savings', impact: 'Saves $30-60/mo', confidence: 'medium' },
      { week: 'Weeks 9-12', title: '30-day review', description: 'Re-run your analysis and compare your score.', category: 'mindset', impact: 'Accountability', confidence: 'high' },
    ],
    change: 'I paid off the entire $5,000 credit card balance, and I just got a raise — I now make $5,200/mo (was $4,000). My surplus is about $1,400/mo now.',
    startSnapshot: { score: 55, debtTotal: 5000, monthlyIncome: 4000, monthlySavings: 200, liquidSavings: 200 },
    currentSnapshot: { score: 72, debtTotal: 0, monthlyIncome: 5200, monthlySavings: 1400, liquidSavings: 200 },
    checks: (steps, msg) => [
      { name: 'no ACTIVE debt-category step remains (debt is $0; completed ones may stay as wins)', pass: !steps.some((s) => s.category === 'debt' && s.status !== 'done') },
      { name: 'references the new income/surplus ($5,200 or $1,400)', pass: steps.some((s) => /5,?200|1,?400/.test(`${s.title} ${s.description} ${s.impact}`)) || /5,?200|1,?400/.test(msg) },
      { name: 'overallMessage acknowledges the win (paid off / cleared / raise)', pass: /paid off|cleared|raise|congrat|crushed|debt-free/i.test(msg) },
      { name: 'step count within 4-6', pass: steps.length >= 4 && steps.length <= 6 },
    ],
  },
  {
    id: 'lost-job-downturn',
    label: 'Lost the job — income to $0, new $800 on a card',
    completedSteps: [
      { week: 'Weeks 2-3', title: 'Build a $1,200 starter emergency fund', description: 'Auto-transfer until you hit one month of expenses.', category: 'savings', impact: 'Cash buffer', confidence: 'medium' },
    ],
    remainingSteps: [
      { week: 'Weeks 4-6', title: 'Pay $50 extra on the $5,000 card', description: 'Hit the highest-rate balance on top of minimums.', category: 'debt', impact: 'Less interest', confidence: 'medium' },
      { week: 'Weeks 7-8', title: 'Negotiate phone + internet bills', description: 'Call for retention rates.', category: 'savings', impact: 'Saves $30-60/mo', confidence: 'medium' },
      { week: 'Weeks 9-12', title: '30-day review', description: 'Re-run your analysis and compare.', category: 'mindset', impact: 'Accountability', confidence: 'high' },
    ],
    change: 'I lost my job — I have $0 income right now and I am living off savings. I also had to put $800 of car repairs on a credit card, so my card balance is now $5,800. I have about $2,500 in savings left.',
    startSnapshot: { score: 55, debtTotal: 5000, monthlyIncome: 4000, monthlySavings: 200, liquidSavings: 2500 },
    currentSnapshot: { score: 34, debtTotal: 5800, monthlyIncome: 0, monthlySavings: -1800, liquidSavings: 2500 },
    checks: (steps, msg) => [
      { name: 'prioritizes restoring income (an income step, or job/gig/work language)', pass: steps.some((s) => s.category === 'income' || /\bjob\b|income|gig|work|earn|hustle/i.test(`${s.title} ${s.description}`)) },
      { name: 'no investing/growth step while income is $0', pass: !steps.some((s) => /invest|index fund|brokerage|retirement|401k|roth ira|build wealth/i.test(`${s.title} ${s.description} ${s.impact}`)) },
      { name: 'references a current number ($0 / $5,800 / $2,500)', pass: steps.some((s) => /\$?0\b|5,?800|2,?500|runway|months? of/i.test(`${s.title} ${s.description} ${s.impact}`)) || /5,?800|2,?500|runway/i.test(msg) },
      { name: 'overallMessage acknowledges the setback (job / income / tighten)', pass: /lost|job|income|setback|tough|tighten|right-?size|hard|protect/i.test(msg) },
      { name: 'step count within 4-6', pass: steps.length >= 4 && steps.length <= 6 },
    ],
  },
  {
    id: 'efund-funded-debt-remains',
    label: 'Emergency fund fully funded; $5k card still there',
    completedSteps: [],
    remainingSteps: [
      { week: 'Weeks 2-4', title: 'Build a 3-month emergency fund', description: 'Auto-transfer $150/wk until you hit $6,000.', category: 'savings', impact: 'Stops surprises becoming debt', confidence: 'medium' },
      { week: 'Weeks 5-6', title: 'Pay $50 extra on the $5,000 card', description: 'Highest-rate balance on top of minimums.', category: 'debt', impact: 'Less interest', confidence: 'medium' },
      { week: 'Weeks 7-8', title: 'Negotiate phone + internet bills', description: 'Call for retention rates.', category: 'savings', impact: 'Saves $30-60/mo', confidence: 'medium' },
      { week: 'Weeks 9-12', title: '30-day review', description: 'Re-run your analysis and compare.', category: 'mindset', impact: 'Accountability', confidence: 'high' },
    ],
    change: 'I already fully funded my emergency fund — I have $6,000 saved now (about 3 months of expenses). My $5,000 credit card is still there and my income is the same at $4,000/mo.',
    startSnapshot: { score: 55, debtTotal: 5000, monthlyIncome: 4000, monthlySavings: 800, liquidSavings: 200 },
    currentSnapshot: { score: 64, debtTotal: 5000, monthlyIncome: 4000, monthlySavings: 800, liquidSavings: 6000 },
    checks: (steps, msg) => [
      { name: 'drops the "build emergency fund" step (already funded)', pass: !steps.some((s) => /emergency fund|e-?fund|starter fund|3-?month fund/i.test(s.title)) },
      { name: 'keeps a debt step (the $5,000 card remains)', pass: steps.some((s) => s.category === 'debt') },
      { name: 'references the $5,000 debt', pass: steps.some((s) => /5,?000|\$5k/i.test(`${s.title} ${s.description} ${s.impact}`)) || /5,?000|\$5k/i.test(msg) },
      { name: 'step count within 4-6', pass: steps.length >= 4 && steps.length <= 6 },
    ],
  },
  {
    // The duplication bait: the change ADJUSTS a goal an existing step already covers
    // (attack the SAME $5k card harder). Correct = MODIFY that debt step. The failure
    // mode is keep-the-$50-step + ADD an aggressive-payoff step → two debt_paydown steps.
    id: 'bait-modify-not-add',
    label: 'Go harder on the SAME $5k card (should modify, not add a variant)',
    completedSteps: [],
    remainingSteps: [
      { week: 'Weeks 2-3', title: 'Build a $1,200 starter emergency fund', description: 'Auto-transfer $100/wk until you hit one month of expenses.', category: 'savings', impact: 'Cash buffer', confidence: 'medium' },
      { week: 'Weeks 4-6', title: 'Pay $50 extra on the $5,000 card', description: 'On top of minimums, chip at the 24% APR balance.', category: 'debt', impact: 'A little less interest', confidence: 'medium' },
      { week: 'Weeks 7-8', title: 'Negotiate phone + internet bills', description: 'Call for retention rates.', category: 'savings', impact: 'Saves $30-60/mo', confidence: 'medium' },
      { week: 'Weeks 9-12', title: '30-day review', description: 'Re-run your analysis and compare.', category: 'mindset', impact: 'Accountability', confidence: 'high' },
    ],
    change: 'I cut a bunch of subscriptions and freed up about $400/mo. I want to go MUCH harder on that $5,000 credit card now — really attack it instead of just $50 extra.',
    startSnapshot: { score: 52, debtTotal: 5000, monthlyIncome: 4000, monthlySavings: 100, liquidSavings: 200 },
    currentSnapshot: { score: 58, debtTotal: 5000, monthlyIncome: 4000, monthlySavings: 500, liquidSavings: 200 },
    checks: (steps, msg) => {
      const debtSteps = steps.filter((s) => s.target?.kind === 'debt_paydown' && s.status !== 'done');
      return [
        { name: 'exactly ONE active debt_paydown step (no duplicate variant)', pass: debtSteps.length === 1 },
        { name: 'the debt step reflects the bigger payment (not just $50)', pass: debtSteps.some((s) => /4[05]0|500|aggress|attack|harder|hammer|nuke|every (spare|extra)/i.test(`${s.title} ${s.description} ${s.impact}`)) },
        { name: 'references the $5,000 card', pass: steps.some((s) => /5,?000|\$5k/i.test(`${s.title} ${s.description} ${s.impact}`)) || /5,?000|\$5k/i.test(msg) },
        { name: 'step count within 4-6', pass: steps.length >= 4 && steps.length <= 6 },
      ];
    },
  },

  // ─── Stress cases: messy/poor + rich input, designed to make Claude slip ───────
  {
    // CONTRADICTION: the free text claims the card is paid off, but currentSnapshot
    // still shows $5,000. Prompt says snapshot is source-of-truth — does it hold, or
    // does it drop the debt step on the (wrong) text and pivot to growth?
    id: 'stress-contradiction',
    label: 'Text says "paid off the card" but snapshot still shows $5k debt',
    completedSteps: [],
    remainingSteps: [
      { week: 'Weeks 2-3', title: 'Build a $1,200 starter emergency fund', description: 'Auto-transfer $100/wk.', category: 'savings', impact: 'Cash buffer', confidence: 'medium' },
      { week: 'Weeks 4-6', title: 'Pay $50 extra on the $5,000 card', description: 'On top of minimums.', category: 'debt', impact: 'Less interest', confidence: 'medium' },
      { week: 'Weeks 7-8', title: 'Negotiate phone + internet bills', description: 'Call for retention rates.', category: 'savings', impact: 'Saves $30-60/mo', confidence: 'medium' },
      { week: 'Weeks 9-12', title: '30-day review', description: 'Re-run your analysis.', category: 'mindset', impact: 'Accountability', confidence: 'high' },
    ],
    change: 'I paid off my whole credit card!! so relieved 🙏',
    startSnapshot: { score: 55, debtTotal: 5000, monthlyIncome: 4000, monthlySavings: 200, liquidSavings: 200 },
    currentSnapshot: { score: 55, debtTotal: 5000, monthlyIncome: 4000, monthlySavings: 200, liquidSavings: 200 }, // UNCHANGED — contradicts the text
    checks: (steps) => [
      { name: 'trusts the SNAPSHOT: a debt step still remains (debt is still $5k)', pass: steps.some((s) => s.target?.kind === 'debt_paydown' && s.status !== 'done') },
      { name: 'did NOT pivot to investing/growth (debt not actually cleared)', pass: !steps.some((s) => /invest|index fund|roth|brokerage|wealth/i.test(`${s.title} ${s.description} ${s.impact}`)) },
      { name: 'step count within 4-6', pass: steps.length >= 4 && steps.length <= 6 },
    ],
  },
  {
    // COMPOUND RICH: several simultaneous changes (raise eaten by daycare, a move, a
    // new medical debt). Tests completeness + whether it mis-maps numbers. Also probes
    // OUR dedup: there are now TWO debts (card + medical) — singular-by-kind may
    // wrongly fold them (the "key by account" limitation we flagged).
    id: 'stress-compound-rich',
    label: 'Raise eaten by daycare + moved + new $3k medical debt',
    completedSteps: [
      { week: 'Weeks 1-3', title: 'Built a $6,000 emergency fund', description: 'Three months of expenses banked.', category: 'savings', impact: 'Done', confidence: 'high' },
    ],
    remainingSteps: [
      { week: 'Weeks 4-6', title: 'Pay $100 extra on the $5,000 card', description: 'Highest-rate balance.', category: 'debt', impact: 'Less interest', confidence: 'medium' },
      { week: 'Weeks 7-8', title: 'Negotiate phone + internet bills', description: 'Retention rates.', category: 'savings', impact: 'Saves $30-60/mo', confidence: 'medium' },
      { week: 'Weeks 9-12', title: 'Start a $200/mo side hustle', description: 'Freelance evenings.', category: 'income', impact: '+$200/mo', confidence: 'low' },
    ],
    change: 'A lot changed: I got a $600/mo raise (now $4,600/mo), but we had a baby and daycare is $1,400/mo. We moved cities for the job. And I put a $3,000 medical bill on a new card — so I owe $5,000 on the old card AND $3,000 medical, $8,000 total now.',
    startSnapshot: { score: 55, debtTotal: 5000, monthlyIncome: 4000, monthlySavings: 400, liquidSavings: 6000 },
    currentSnapshot: { score: 47, debtTotal: 8000, monthlyIncome: 4600, monthlySavings: -200, liquidSavings: 6000 },
    checks: (steps, msg) => [
      { name: 'addresses the new $8,000 total debt (refs 8,000 or 3,000 medical)', pass: steps.some((s) => /8,?000|3,?000/.test(`${s.title} ${s.description} ${s.impact}`)) || /8,?000|3,?000/.test(msg) },
      { name: 'reflects the income/daycare squeeze (refs 4,?600 / 1,?400 / tight / negative)', pass: /4,?600|1,?400|daycare|tight|negative|deficit|shortfall/i.test(`${steps.map((s) => s.title + s.description).join(' ')} ${msg}`) },
      { name: 'keeps the completed $6k efund (status done) as a win', pass: steps.some((s) => s.status === 'done' && /6,?000|emergency/i.test(`${s.title} ${s.description}`)) },
      { name: 'step count within 4-6', pass: steps.length >= 4 && steps.length <= 6 },
    ],
  },
  {
    // VAGUE / LOW-SIGNAL: no numbers, basically noise. The failure is over-revision —
    // churning the whole plan or fabricating dollar figures. Good behavior = barely
    // touch it (the printed patch should be mostly `keep`).
    id: 'stress-vague',
    label: 'Vague update, no numbers ("things kinda better i guess 🤷")',
    completedSteps: [],
    remainingSteps: [
      { week: 'Weeks 2-3', title: 'Build a $1,200 starter emergency fund', description: 'Auto-transfer $100/wk.', category: 'savings', impact: 'Cash buffer', confidence: 'medium' },
      { week: 'Weeks 4-6', title: 'Pay $50 extra on the $5,000 card', description: 'On top of minimums.', category: 'debt', impact: 'Less interest', confidence: 'medium' },
      { week: 'Weeks 7-8', title: 'Negotiate phone + internet bills', description: 'Retention rates.', category: 'savings', impact: 'Saves $30-60/mo', confidence: 'medium' },
      { week: 'Weeks 9-12', title: '30-day review', description: 'Re-run your analysis.', category: 'mindset', impact: 'Accountability', confidence: 'high' },
    ],
    change: 'idk things are kinda better i guess, spent a little less this month maybe 🤷',
    startSnapshot: { score: 55, debtTotal: 5000, monthlyIncome: 4000, monthlySavings: 200, liquidSavings: 200 },
    currentSnapshot: { score: 55, debtTotal: 5000, monthlyIncome: 4000, monthlySavings: 200, liquidSavings: 200 }, // no real change
    checks: (steps) => [
      { name: 'did NOT fabricate a new large $ figure (>=$1,000) absent from the snapshot', pass: !steps.some((s) => (`${s.title} ${s.description} ${s.impact}`.match(/\$\s?([1-9]\d{3,})/g) ?? []).some((m) => !/5,?000|1,?200/.test(m))) },
      { name: 'plan stays intact (still has the debt + efund steps)', pass: steps.some((s) => s.target?.kind === 'debt_paydown') && steps.some((s) => s.target?.kind === 'build_efund') },
      { name: 'step count within 4-6', pass: steps.length >= 4 && steps.length <= 6 },
    ],
  },
];

// Call the DEPLOYED revise-plan edge function (uses the Supabase Anthropic secret;
// no local key needed). Returns the sanitized plan body.
async function callEndpoint(userJson: unknown): Promise<any> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !anon) throw new Error('EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY not in .env');
  const res = await fetch(`${url}/functions/v1/revise-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anon}` },
    body: JSON.stringify(userJson),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`revise-plan ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data; // { steps, overallMessage, _provider }
}

async function callClaude(system: string, userJson: unknown): Promise<any> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL, max_tokens: 2000, temperature: 0.2,
      system: [{ type: 'text', text: system }],
      tools: [generatePlanTool],
      tool_choice: { type: 'tool', name: 'generate_plan' },
      messages: [{ role: 'user', content: JSON.stringify(userJson) }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const toolUse = data.content?.find((c: any) => c.type === 'tool_use');
  if (!toolUse) throw new Error('No tool_use block in response');
  return toolUse.input;
}

function printSteps(label: string, steps: PlanStep[]) {
  console.log(`\n${label}`);
  steps.forEach((s) => console.log(`  • [${s.category}/${s.confidence}] ${s.week}: ${s.title}\n      ${s.description}\n      → ${s.impact}`));
}

function userJsonFor(tc: Case) {
  return {
    completedSteps: tc.completedSteps,
    remainingSteps: tc.remainingSteps,
    change: tc.change,
    startSnapshot: tc.startSnapshot,
    currentSnapshot: tc.currentSnapshot,
  };
}

type CaseResult = { id: string; zodOk: boolean; passed: number; total: number };

// ─── Patch mode (hybrid) ──────────────────────────────────────────────────────
type StepStatus = 'done' | 'pending' | 'skipped';
type CurStep = PlanStep & { id: string; status: StepStatus };
type Patch = { keep: string[]; drop: string[]; modify: (Partial<PlanStep> & { id: string })[]; add: PlanStep[]; overallMessage: string };

// Singular kinds: at most one ACTIVE step each (you don't run two emergency funds, or
// two generic debt-payoff steps). In production debt_paydown would be keyed by account
// so multiple debts are allowed; here there's one debt, so kind alone is the key.
const SINGULAR_KINDS = new Set<StepKind>(['build_efund', 'debt_paydown']);

// Demo shim: label each existing step with a target.kind. In production the kind is
// stored on the step at generation (the StepTarget schema field); here we infer it.
function inferKind(s: PlanStep): StepKind {
  if (s.target?.kind) return s.target.kind;
  if (s.category === 'debt') return 'debt_paydown';
  if (s.category === 'income') return 'grow_income';
  if (s.category === 'mindset') return 'habit';
  return /emergency|e-?fund|cushion|safety net|months? of expenses/i.test(`${s.title} ${s.description}`) ? 'build_efund' : 'cut_spend';
}

// Reconstruct the user's CURRENT plan (with stable ids + completion + kind) from a case:
// completed steps come first (status 'done'), then the remaining ones (status 'pending').
function currentStepsFor(tc: Case): CurStep[] {
  const tag = (s: PlanStep, id: string, status: StepStatus): CurStep => ({ ...s, id, status, target: { ...s.target, kind: inferKind(s) } });
  const done = tc.completedSteps.map((s, i) => tag(s, `s${i}`, 'done'));
  const pending = tc.remainingSteps.map((s, i) => tag(s, `s${done.length + i}`, 'pending'));
  return [...done, ...pending];
}

// THE deterministic apply engine — the half of the architecture our code owns.
// It records the model's structural defects (informational), then REPAIRS them so
// the output is always a valid, identity-preserving 4-6 step plan:
//   • resolve overlapping op-sets by precedence modify > keep > drop (never lose content)
//   • never drop a completed ('done') step
//   • default-keep any unclassified step
//   • trim to ≤6 by removing excess ADDED steps first (then trailing pending), never completed
//   • backfill to ≥4 by restoring dropped steps
function applyPatch(current: CurStep[], patch: Patch): { steps: CurStep[]; modelIssues: string[]; repairs: string[] } {
  const modelIssues: string[] = [];
  const repairs: string[] = [];
  const byId = new Map(current.map((s) => [s.id, s]));
  const inKeep = new Set(patch.keep ?? []);
  const inDrop = new Set(patch.drop ?? []);
  const modById = new Map((patch.modify ?? []).map((m) => [m.id, m]));

  // Record raw model defects (what the LLM got wrong — we'll absorb these).
  for (const id of [...inKeep, ...inDrop, ...modById.keys()]) if (!byId.has(id)) modelIssues.push(`hallucinated id ${id}`);
  for (const s of current) {
    const n = (inKeep.has(s.id) ? 1 : 0) + (inDrop.has(s.id) ? 1 : 0) + (modById.has(s.id) ? 1 : 0);
    if (n === 0) modelIssues.push(`unclassified ${s.id}`);
    if (n > 1) modelIssues.push(`${s.id} in ${n} op-sets`);
  }
  for (const id of inDrop) if (byId.get(id)?.status === 'done') modelIssues.push(`tried to drop completed ${id}`);

  // Classify each CURRENT step by precedence: modify > keep > drop.
  const retained: CurStep[] = [];
  for (const s of current) {
    const mod = modById.get(s.id);
    if (mod) { const { id: _omit, ...fields } = mod; retained.push({ ...s, ...fields }); }
    else if (inKeep.has(s.id)) retained.push(s);
    else if (inDrop.has(s.id)) {
      if (s.status === 'done') { retained.push(s); repairs.push(`kept completed ${s.id} the model dropped`); }
      // otherwise genuinely dropped
    } else { retained.push(s); repairs.push(`kept unclassified ${s.id}`); }
  }
  if (modelIssues.some((i) => i.includes('op-sets'))) repairs.push('resolved op-set overlap by precedence modify>keep>drop');

  let next = current.length;
  const added: CurStep[] = (patch.add ?? []).map((a) => ({ ...a, id: `s${next++}`, status: 'pending' as StepStatus }));
  let result = [...retained, ...added];

  // Trim to ≤6: drop excess ADDED first, then trailing pending; never completed.
  if (result.length > 6) {
    const removable = Math.min(result.length - 6, added.length);
    if (removable > 0) { result = [...retained, ...added.slice(0, added.length - removable)]; repairs.push(`trimmed ${removable} excess added step(s) to cap at 6`); }
    while (result.length > 6) {
      const fromEnd = [...result].reverse().findIndex((s) => s.status !== 'done');
      if (fromEnd === -1) break;
      const idx = result.length - 1 - fromEnd;
      repairs.push(`trimmed pending step ${result[idx].id} to cap at 6`);
      result.splice(idx, 1);
    }
  }
  // Backfill to ≥4: restore dropped steps.
  if (result.length < 4) {
    const have = new Set(result.map((s) => s.id));
    for (const id of inDrop) {
      if (result.length >= 4) break;
      const s = byId.get(id);
      if (s && !have.has(id)) { result.push(s); have.add(id); repairs.push(`restored dropped ${id} to reach 4`); }
    }
  }

  // De-dup by singular kind: when the model adds a VARIATION of a goal that an active
  // step already covers (the credit_debt/credit_debts case) instead of modifying in
  // place, fold the later step's content onto the FIRST step's id+status and drop the
  // duplicate. Identity preserved; the intended revision is recovered; no double entry.
  const kindOf = (s: CurStep) => s.target?.kind;
  const firstByKind = new Map<StepKind, number>();
  const folded: CurStep[] = [];
  for (const s of result) {
    const k = kindOf(s);
    if (s.status !== 'done' && k && SINGULAR_KINDS.has(k) && firstByKind.has(k)) {
      const i = firstByKind.get(k)!;
      const keeper = folded[i];
      folded[i] = { ...keeper, week: s.week, title: s.title, description: s.description, impact: s.impact, category: s.category, confidence: s.confidence, target: s.target ?? keeper.target };
      modelIssues.push(`duplicate '${k}' intent: ${s.id} should have been a modify of ${keeper.id}`);
      repairs.push(`folded duplicate '${k}' step ${s.id} into ${keeper.id} (recovered the intended modify)`);
      continue;
    }
    if (s.status !== 'done' && k && SINGULAR_KINDS.has(k)) firstByKind.set(k, folded.length);
    folded.push(s);
  }
  result = folded;

  return { steps: result, modelIssues, repairs };
}

// Deterministic proof that the dedup catches the model's worst case (no API call):
// the model KEEPS the stale $50 debt step AND ADDS a $300 duplicate debt_paydown.
function selfTest(): never {
  console.log('\n🧪 SELF-TEST — deterministic dedup of a duplicate intent (no API call)\n');
  const catOf = (k: StepKind) => (k === 'debt_paydown' ? 'debt' : k === 'grow_income' ? 'income' : k === 'habit' ? 'mindset' : 'savings');
  const mk = (id: string, kind: StepKind, title: string): CurStep =>
    ({ id, status: 'pending', week: 'Wk', title, description: 'd', category: catOf(kind), impact: 'i', confidence: 'medium', target: { kind } });

  const current: CurStep[] = [
    mk('s0', 'debt_paydown', 'Pay $50 extra on the $5,000 card'),
    mk('s1', 'build_efund', 'Build a $1,200 emergency fund'),
    mk('s2', 'cut_spend', 'Negotiate bills'),
    mk('s3', 'habit', '30-day review'),
  ];
  const buggyPatch: Patch = {
    keep: ['s0', 's1', 's2', 's3'], drop: [], modify: [],
    add: [{ week: 'Weeks 4-8', title: 'Aggressively attack the $5,000 card — $300/mo', description: 'Stack $300/mo on the 24% APR balance.', category: 'debt', impact: '~$900 saved', confidence: 'high', target: { kind: 'debt_paydown' } }],
    overallMessage: 'go harder on the card',
  };

  const { steps, modelIssues, repairs } = applyPatch(current, buggyPatch);
  const activeDebt = steps.filter((s) => s.target?.kind === 'debt_paydown' && s.status !== 'done');
  let fails = 0;
  const assert = (name: string, cond: boolean) => { console.log(`  ${cond ? '✅' : '❌'} ${name}`); if (!cond) fails++; };

  console.log(`  model defects detected: ${modelIssues.join('; ') || '(none)'}`);
  console.log(`  repairs applied: ${repairs.join('; ') || '(none)'}\n`);
  assert('detected the duplicate debt_paydown intent', modelIssues.some((i) => i.includes("duplicate 'debt_paydown'")));
  assert('folded the duplicate (repair logged)', repairs.some((r) => r.includes('folded')));
  assert('exactly ONE active debt_paydown survives', activeDebt.length === 1);
  assert('survivor keeps the existing id s0 (identity preserved)', activeDebt[0]?.id === 's0');
  assert('survivor adopts the new $300 content (intended modify recovered)', /300/.test(`${activeDebt[0]?.title} ${activeDebt[0]?.description}`));
  assert('final plan stays 4 steps (no bloat)', steps.length === 4);

  console.log(`\n${fails === 0 ? '✅ self-test passed' : `❌ ${fails} failed`}`);
  process.exit(fails === 0 ? 0 : 2);
}

async function runCase(tc: Case, useEndpoint: boolean, raw: boolean): Promise<CaseResult> {
  console.log(`\n${'━'.repeat(64)}`);
  console.log(`🧪 case "${tc.id}": ${tc.label}`);
  console.log(`Change: ${tc.change}`);

  const userJson = userJsonFor(tc);
  let out: any;
  if (useEndpoint) {
    recordApiCall(`revise-demo:${tc.id}:endpoint`);
    out = await callEndpoint(userJson);
  } else {
    recordApiCall(`revise-demo:${tc.id}`);
    out = await callClaude(REVISE_SYSTEM, userJson);
  }
  if (raw) console.log('\nRAW:', JSON.stringify(out, null, 2));

  const parsed = ActionPlanResponseSchema.safeParse(out);
  console.log(`\n── Zod (ActionPlanResponseSchema): ${parsed.success ? '✅ valid' : '❌ INVALID'}`);
  if (!parsed.success) {
    console.log(JSON.stringify(parsed.error.issues, null, 2));
    return { id: tc.id, zodOk: false, passed: 0, total: tc.checks([], '').length };
  }

  printSteps('BEFORE — remaining steps:', tc.remainingSteps);
  printSteps('AFTER — revised steps:', parsed.data.steps as PlanStep[]);
  console.log(`\nRevised overallMessage:\n  "${parsed.data.overallMessage}"`);

  console.log('\n── Deterministic checks ──');
  const checks = tc.checks(parsed.data.steps as PlanStep[], parsed.data.overallMessage);
  checks.forEach((c) => console.log(`  ${c.pass ? '✅' : '❌'} ${c.name}`));
  return { id: tc.id, zodOk: true, passed: checks.filter((c) => c.pass).length, total: checks.length };
}

async function runCasePatch(tc: Case, raw: boolean): Promise<CaseResult> {
  console.log(`\n${'━'.repeat(64)}`);
  console.log(`🧪 [PATCH] case "${tc.id}": ${tc.label}`);
  console.log(`Change: ${tc.change}`);

  const current = currentStepsFor(tc);
  printSteps('CURRENT plan (id · status):', current.map((s) => ({ ...s, week: `${s.id}·${s.status} ${s.week}` })) as PlanStep[]);

  recordApiCall(`revise-demo:${tc.id}:patch`);
  const patch: Patch = await callEndpoint({
    currentSteps: current, change: tc.change, startSnapshot: tc.startSnapshot, currentSnapshot: tc.currentSnapshot, mode: 'patch',
  });
  if (raw) console.log('\nRAW PATCH:', JSON.stringify(patch, null, 2));

  console.log(`\n── Patch from Claude ──`);
  console.log(`  keep:   [${(patch.keep ?? []).join(', ')}]`);
  console.log(`  drop:   [${(patch.drop ?? []).join(', ')}]`);
  console.log(`  modify: [${(patch.modify ?? []).map((m) => m.id).join(', ')}]`);
  console.log(`  add:    ${(patch.add ?? []).length} new step(s)`);

  // ── Deterministic apply + repair (our code) ──
  const { steps, modelIssues, repairs } = applyPatch(current, patch);
  if (modelIssues.length) console.log(`  model patch defects (absorbed): ${modelIssues.join('; ')}`);
  if (repairs.length) console.log(`  repairs applied: ${repairs.join('; ')}`);
  printSteps('APPLIED + REPAIRED result (id · status):', steps.map((s) => ({ ...s, week: `${s.id}·${s.status} ${s.week}` })) as PlanStep[]);
  console.log(`\nRevised overallMessage:\n  "${patch.overallMessage}"`);

  // Post-repair the plan must be valid + completion must survive.
  const zod = ActionPlanResponseSchema.safeParse({ steps, overallMessage: patch.overallMessage });
  const countOk = steps.length >= 4 && steps.length <= 6;
  const doneBefore = current.filter((s) => s.status === 'done').map((s) => s.id);
  const donePreserved = doneBefore.every((id) => steps.find((s) => s.id === id)?.status === 'done');

  console.log('\n── Integrity after repair (deterministic) ──');
  console.log(`  ${zod.success && countOk ? '✅' : '❌'} valid 4-6 step plan (${steps.length} steps, Zod ${zod.success ? 'ok' : 'fail'})`);
  console.log(`  ${donePreserved ? '✅' : '❌'} completion preserved (done steps stay done)`);

  console.log('── Semantic checks (on repaired result) ──');
  const checks = tc.checks(steps, patch.overallMessage);
  checks.forEach((c) => console.log(`  ${c.pass ? '✅' : '❌'} ${c.name}`));

  const integrity = (zod.success && countOk ? 1 : 0) + (donePreserved ? 1 : 0);
  const passed = integrity + checks.filter((c) => c.pass).length;
  const total = 2 + checks.length;
  return { id: tc.id, zodOk: zod.success && countOk, passed, total };
}

async function run() {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) selfTest();
  const raw = args.includes('--raw');
  const patch = args.includes('--patch');
  const useEndpoint = args.includes('--endpoint') || patch; // patch mode always hits the deployed fn
  const all = args.includes('--all');
  const caseId = args.includes('--case') ? args[args.indexOf('--case') + 1] : CASES[0].id;

  const cases = all ? CASES : CASES.filter((c) => c.id === caseId);
  if (cases.length === 0) { console.error(`No case "${caseId}". Available: ${CASES.map((c) => c.id).join(', ')}`); process.exit(1); }

  // --dry: verify plumbing + inspect prompt/payload for the first selected case, NO API call.
  if (args.includes('--dry')) {
    const tc = cases[0];
    console.log('\n[DRY RUN — no API call]');
    console.log(`Mode: ${useEndpoint ? 'endpoint (deployed revise-plan)' : 'direct (local Anthropic key)'} · cases: ${cases.map((c) => c.id).join(', ')}`);
    console.log(`Model: ${MODEL} · key loaded: ${ANTHROPIC_API_KEY ? 'yes' : 'NO'} · schema import: ${typeof ActionPlanResponseSchema.safeParse === 'function' ? 'ok' : 'FAIL'}`);
    console.log('\nSYSTEM:\n' + REVISE_SYSTEM);
    console.log('\nUSER MESSAGE (JSON):\n' + JSON.stringify(userJsonFor(tc), null, 2));
    process.exit(0);
  }

  if (!useEndpoint && !ANTHROPIC_API_KEY) {
    console.error('\nANTHROPIC_API_KEY not available locally (it lives in Supabase secrets).');
    console.error('Use --endpoint to hit the deployed function instead, or export the key inline.');
    process.exit(1);
  }
  console.log(`Mode: ${patch ? 'PATCH (diff + deterministic apply)' : useEndpoint ? 'endpoint full-regen' : 'direct full-regen'} · ${cases.length} case(s)`);

  const results: CaseResult[] = [];
  for (const tc of cases) results.push(await (patch ? runCasePatch(tc, raw) : runCase(tc, useEndpoint, raw)));

  console.log(`\n${'═'.repeat(64)}`);
  console.log('SUMMARY');
  results.forEach((r) => console.log(`  ${r.zodOk && r.passed === r.total ? '✅' : '⚠️'} ${r.id}: Zod ${r.zodOk ? '✅' : '❌'} · checks ${r.passed}/${r.total}`));
  console.log(`Counter: ${getCounterState().count}/40`);
  console.log('═'.repeat(64));
  process.exit(results.every((r) => r.zodOk && r.passed === r.total) ? 0 : 2);
}

run().catch((e) => { console.error('Error:', e.message); process.exit(1); });
