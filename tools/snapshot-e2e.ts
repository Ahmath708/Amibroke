/**
 * End-to-end "real glimpse" harness for the unified financial model (PAID — rule #1).
 *
 * Drives one real fixture through the WHOLE chain, calling Anthropic DIRECTLY (not the edge
 * endpoint) but with our exact current logic — the real prompts (prompt.ts), the real tool
 * schemas (tool.ts), and all of shared/*:
 *
 *   seed snapshot (onboarding brackets)
 *     → roast (real Claude call, analyze prompt+tool)
 *     → confident-merge into the snapshot   ← the bit we most want to eyeball
 *     → debt payoff (avalanche vs snowball)
 *     → action plan (real Claude call, action-plan prompt+tool)
 *
 * Usage:  npx tsx tools/snapshot-e2e.ts [--case <fixtureId>] [--tone <tone>] [--extra <n>]
 *   2 Anthropic calls per run (analyze + action-plan), claude-sonnet-4-6 ≈ ~$0.05.
 */
import fs from 'fs';
import { FIXTURES } from './eval/fixtures.analyze';
import { SYSTEM_PROMPT } from '../supabase/functions/analyze/prompt';
import { submitAnalysisTool } from '../supabase/functions/analyze/tool';
import { ACTION_PLAN_PROMPT } from '../supabase/functions/action-plan/prompt';
import { generatePlanTool } from '../supabase/functions/action-plan/tool';
import {
  patchFromOnboarding, patchFromAnalysis, mergeIntoSnapshot, isPayoffDebt,
  type FinancialSnapshot, type ProvField,
} from '../shared/financialSnapshot';
import { deriveMetrics, simulateDebtPayoff } from '../shared/calculations';
import { computeFinalScore } from '../shared/scoring/index';
import { getBaselines } from '../shared/baselines/index';

// ─── env / args ──────────────────────────────────────────────────────────────
function loadKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  try {
    const line = fs.readFileSync('.env', 'utf8').split('\n').find((l) => l.startsWith('ANTHROPIC_API_KEY='));
    if (line) return line.slice('ANTHROPIC_API_KEY='.length).trim().replace(/^["']|["']$/g, '');
  } catch { /* ignore */ }
  return '';
}
const KEY = loadKey();

function arg(flag: string, dflt: string): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}
const caseId = arg('--case', 'detailed_1');
const tone = arg('--tone', 'savage');
const extra = Number(arg('--extra', '100'));
const NOW = '2026-06-04T00:00:00.000Z';
const NOW2 = '2026-06-04T01:00:00.000Z';

// ─── tiny formatting ─────────────────────────────────────────────────────────
const $ = (n: number | null | undefined) => (n == null ? '—' : '$' + Math.round(n).toLocaleString());
const hr = (t: string) => console.log(`\n${'─'.repeat(64)}\n  ${t}\n${'─'.repeat(64)}`);
const field = (f?: ProvField<number>) => (f ? `${$(f.value)}  [${f.confidence}/${f.source}]` : '— (none)');

// ─── replicate the edge fn's compose step (deriveMetrics + scoring) ───────────
function composeFinalAnalysis(raw: any): any {
  const derived = deriveMetrics({
    monthlyIncome: raw.monthlyIncome.value,
    monthlyExpenses: raw.monthlyExpenses.value,
    liquidSavings: raw.liquidSavings.value,
    debts: raw.debts,
  });
  const scoring = computeFinalScore(raw.cfpb_responses, raw.scoreModifier);
  return { ...raw, ...derived, score: scoring.score, scoreLabel: scoring.scoreLabel, scoreColor: scoring.scoreColor, avgConfidence: scoring.avgConfidence };
}

function baselinesFor(ctx: any) {
  const b = getBaselines(ctx.state);
  return {
    stateMedianRent1br: b.medianRent1br, stateColTier: b.colTier,
    ageMedianNetIncome: b.medianNetIncomeByAge[ctx.ageBracket] ?? b.medianNetIncome,
    currentCcApr: b.currentCcApr, currentStudentLoanRate: b.currentStudentLoanRate,
    healthySavingsRate: b.healthySavingsRate, adequateEmergencyMonths: b.adequateEmergencyMonths,
    recommendedRentPctOfIncome: b.recommendedRentPctOfIncome,
  };
}

// ─── direct Anthropic call (same shape as the edge fn: forced tool-use + cache) ─
async function callClaude(system: string, tool: any, userMessage: string, maxTokens: number): Promise<any> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      temperature: 0.2,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name },
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const toolUse = data.content.find((c: any) => c.type === 'tool_use');
  if (!toolUse) throw new Error('No tool_use block in response');
  return toolUse.input;
}

// ─── run ──────────────────────────────────────────────────────────────────────
async function main() {
  const fixture = FIXTURES.find((f) => f.id === caseId);
  if (!fixture) { console.error(`No fixture "${caseId}". Available: ${FIXTURES.map((f) => f.id).join(', ')}`); process.exit(1); }
  const { freeText, userContext } = (fixture as any).input;

  console.log(`\n🧪 E2E glimpse — case "${caseId}" · tone "${tone}"`);
  console.log(`   "${freeText}"`);
  console.log(`   context: ${JSON.stringify(userContext)}`);

  // 1) SEED from onboarding brackets (estimated)
  hr('1 · SEED snapshot from onboarding brackets (estimated)');
  let snap: FinancialSnapshot = mergeIntoSnapshot(null, patchFromOnboarding(userContext), 'onboarding', NOW);
  console.log(`   income:  ${field(snap.monthlyIncome)}`);
  console.log(`   savings: ${field(snap.liquidSavings)}`);
  console.log(`   debts:   ${$(snap.debtTotal)} (${snap.debts?.value.length ?? 0} item, ${snap.debts?.confidence}/${snap.debts?.source})`);

  if (process.argv.includes('--dry')) { hr('dry — imports + seed OK, stopped before any Claude call'); return; }

  // 2) ROAST — real Claude call
  hr('2 · ROAST (real Claude call → analyze prompt + tool)');
  const userMessage = JSON.stringify({ freeText, userContext, baselines: baselinesFor(userContext), tone });
  const raw = await callClaude(SYSTEM_PROMPT, submitAnalysisTool, userMessage, 2500);
  const analysis = composeFinalAnalysis(raw);
  console.log(`   score: ${analysis.score} (${analysis.scoreLabel})`);
  console.log(`   roast: ${analysis.roast}`);
  console.log(`   income:   ${$(raw.monthlyIncome.value)}  [${raw.monthlyIncome.confidence}/${raw.monthlyIncome.source}]`);
  console.log(`   expenses: ${$(raw.monthlyExpenses.value)}  [${raw.monthlyExpenses.confidence}/${raw.monthlyExpenses.source}]`);
  console.log(`   savings:  ${$(raw.liquidSavings.value)}  [${raw.liquidSavings.confidence}/${raw.liquidSavings.source}]`);
  (raw.debts || []).forEach((d: any) => console.log(`   debt: ${d.name} ${$(d.balance)} @ ${(d.interestRate * 100).toFixed(1)}%  [${d.kind}/${d.source}]`));

  // 3) CONFIDENT-MERGE the roast into the seeded snapshot
  hr('3 · CONFIDENT-MERGE roast → snapshot (estimated seeds give way to stated)');
  const before = snap;
  snap = mergeIntoSnapshot(snap, patchFromAnalysis(analysis), 'roast', NOW2, analysis.score);
  console.log(`   income:  ${field(before.monthlyIncome)}   →   ${field(snap.monthlyIncome)}`);
  console.log(`   savings: ${field(before.liquidSavings)}   →   ${field(snap.liquidSavings)}`);
  console.log(`   expenses:${' '}${field(before.monthlyExpenses)}   →   ${field(snap.monthlyExpenses)}`);
  console.log(`   debts:   ${$(before.debtTotal)} (${before.debts?.confidence}/${before.debts?.source}, ${before.debts?.value.length} item)   →   ${$(snap.debtTotal)} (${snap.debts?.confidence}/${snap.debts?.source}, ${snap.debts?.value.length} item)`);
  console.log(`   derived: savingsRate ${(snap.savingsRate * 100).toFixed(0)}% · emergency ${snap.emergencyFundMonths.toFixed(1)}mo · DTI ${(snap.debtToIncome * 100).toFixed(0)}%`);

  // 4) DEBT PAYOFF — consumer debt only (mortgages excluded — Finding A)
  hr('4 · DEBT PAYOFF (consumer debt from snapshot.debts; mortgage excluded)');
  const allDebts = snap.debts?.value ?? [];
  const excluded = allDebts.filter((d) => !isPayoffDebt(d));
  excluded.forEach((d) => console.log(`   excluded (${d.kind}): ${d.name} ${$(d.balance)}`));
  const payoffDebts = allDebts.filter(isPayoffDebt).map((d) => ({ balance: d.balance, interestRate: d.apr ?? 0, minimumPayment: d.min_payment ?? 0 }));
  if (payoffDebts.length === 0) {
    console.log('   no consumer debts to pay off.');
  } else {
    const av = simulateDebtPayoff(payoffDebts, extra, 'avalanche');
    const sn = simulateDebtPayoff(payoffDebts, extra, 'snowball');
    const base = simulateDebtPayoff(payoffDebts, 0, 'avalanche');
    console.log(`   with +${$(extra)}/mo extra:`);
    console.log(`     avalanche: ${av.months} mo, ${$(av.totalInterest)} interest`);
    console.log(`     snowball:  ${sn.months} mo, ${$(sn.totalInterest)} interest`);
    console.log(`   vs minimums only: ${base.months} mo, ${$(base.totalInterest)} interest  →  saves ${$(base.totalInterest - av.totalInterest)} + ${base.months - av.months} mo`);
  }

  // 5) ACTION PLAN — real Claude call
  hr('5 · ACTION PLAN (real Claude call → action-plan prompt + tool)');
  const planInput = JSON.stringify({ analysis, tone, userContext });
  const plan = await callClaude(ACTION_PLAN_PROMPT, generatePlanTool, planInput, 2000);
  console.log(`   ${plan.overallMessage ?? ''}`);
  (plan.steps || []).forEach((s: any, i: number) => console.log(`   ${i + 1}. [wk ${s.week}] ${s.title} — ${s.impact ?? ''}`));

  hr('done');
}

main().catch((e) => { console.error('\n❌', e.message || e); process.exit(1); });
