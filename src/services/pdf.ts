// PDF export — turns a financial analysis into a shareable "Deep Dive" report.
//
// Approach: render an HTML document → `expo-print` rasterizes it to a real PDF in the app
// cache → `expo-sharing` opens the iOS share sheet (Save to Files / Mail / AirDrop). No
// server round-trip and no LLM cost: the action-plan section reuses the already-generated
// active plan (`getActivePlan`), it never generates one.
//
// This is the "Downloadable PDF Report" promised to Deep Dive on the paywall. Gate the entry
// point with `useSubscription().hasAccess('deep_dive')` — this module does not check tier.
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { FinalAnalysis } from '@shared/types';
import { getScoreBand } from '@shared/scoring/bands.ts';
import { formatCurrency } from '@/utils/format';
import { Colors } from '@/theme/colors';
import type { ActivePlan } from './activePlan';

export interface ReportOptions {
  /** Included as the "Your 90-Day Plan" section when present (no generation happens here). */
  plan?: ActivePlan | null;
  /** Shown in the header; defaults to today. */
  generatedAt?: Date;
}

const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const num = (n: unknown): number | null => (typeof n === 'number' && isFinite(n) ? n : null);

// `monthlyIncome` etc. are {value, confidence} objects on the analysis; pull the number.
const valueOf = (v: any): number => num(v?.value) ?? num(v) ?? 0;

function metricsRows(a: FinalAnalysis): string {
  const income = valueOf(a.monthlyIncome);
  const expenses = valueOf(a.monthlyExpenses);
  const rows: [string, string | null][] = [
    ['Monthly Income', formatCurrency(income)],
    ['Monthly Expenses', formatCurrency(expenses)],
    ['Liquid Savings', formatCurrency(valueOf(a.liquidSavings))],
    ['Monthly Savings', formatCurrency(num(a.monthlySavings) ?? 0)],
    ['Total Debt', formatCurrency(num(a.debtTotal) ?? 0)],
    ['Savings Rate', a.savingsRate != null ? `${Math.round(a.savingsRate * 100)}%` : null],
    ['Emergency Fund', a.emergencyFundMonths != null ? `${a.emergencyFundMonths.toFixed(1)} mo` : null],
    ['Debt-to-Income', a.debtToIncomeRatio != null ? `${(a.debtToIncomeRatio * 100).toFixed(0)}%` : null],
    ['Monthly Debt Service', formatCurrency(num(a.monthlyDebtService) ?? 0)],
  ];
  return rows
    .filter(([, v]) => v != null)
    .map(([label, v]) => `<tr><td class="ml">${esc(label)}</td><td class="mv">${esc(v)}</td></tr>`)
    .join('');
}

function listSection(title: string, items: string[] | undefined, marker: string): string {
  if (!items || items.length === 0) return '';
  const lis = items.map((i) => `<li><span class="mk">${marker}</span>${esc(i)}</li>`).join('');
  return `<h2>${esc(title)}</h2><ul class="bul">${lis}</ul>`;
}

function debtsSection(a: FinalAnalysis): string {
  const debts = (a.debts ?? []) as any[];
  if (debts.length === 0) return '';
  const rows = debts
    .map((d) => `<tr>
      <td class="ml">${esc(d.name)}</td>
      <td class="mv">${esc(formatCurrency(num(d.balance) ?? 0))}</td>
      <td class="mv">${d.interestRate != null ? `${(d.interestRate * 100).toFixed(1)}%` : '—'}</td>
    </tr>`)
    .join('');
  return `<h2>Your Debts</h2>
    <table class="grid">
      <tr><th class="ml">Debt</th><th class="mv">Balance</th><th class="mv">Rate</th></tr>
      ${rows}
    </table>`;
}

function budgetSection(a: FinalAnalysis): string {
  const income = valueOf(a.monthlyIncome);
  const expenses = valueOf(a.monthlyExpenses);
  const savings = num(a.monthlySavings) ?? 0;
  if (income <= 0) return '';
  const needs = (expenses / income) * 100;
  const wants = Math.max(0, ((income - expenses - savings) / income) * 100);
  const save = (savings / income) * 100;
  const row = (label: string, pct: number, target: number) =>
    `<tr><td class="ml">${esc(label)}</td><td class="mv">${pct.toFixed(0)}%</td><td class="mv">${target}% target</td></tr>`;
  return `<h2>Recommended Budget (50/30/20)</h2>
    <table class="grid">
      ${row('Needs', needs, 50)}
      ${row('Wants', wants, 30)}
      ${row('Savings / Debt', save, 20)}
    </table>`;
}

function planSection(plan: ActivePlan | null | undefined): string {
  if (!plan || !plan.steps || plan.steps.length === 0) return '';
  const intro = plan.overall_message ? `<p class="lede">${esc(plan.overall_message)}</p>` : '';
  const steps = plan.steps
    .map((s) => `<div class="step">
      <div class="step-h"><span class="step-week">${esc(s.week)}</span><span class="step-title">${esc(s.title)}</span></div>
      <p class="step-desc">${esc(s.description)}</p>
      ${s.impact ? `<p class="step-impact">${esc(s.impact)}</p>` : ''}
    </div>`)
    .join('');
  return `<h2>Your 90-Day Action Plan</h2>${intro}${steps}`;
}

/** Build the full report as a standalone HTML document (pure — unit-testable, no IO). */
export function buildReportHtml(a: FinalAnalysis, opts: ReportOptions = {}): string {
  const date = (opts.generatedAt ?? new Date()).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  const band = getScoreBand(a.score);
  const bandColor = a.scoreColor ?? band.color;
  const accent = Colors.accent;

  const topFix = a.topFix
    ? `<h2>#1 Thing to Fix</h2>
       <div class="fix">
         <p class="fix-action">${esc(a.topFix.action)}</p>
         <p class="fix-impact">Est. monthly improvement: ${esc(formatCurrency(num(a.topFix.monthlyImpact) ?? 0))}</p>
       </div>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    /* Page margins: WKWebView (expo-print) ignores body padding but honors @page margin,
       and @page applies the inset to every page — not just the first/last. */
    @page { margin: 0.7in 0.6in; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #15151b; font-size: 14px; line-height: 1.5; }
    .brand { font-size: 13px; font-weight: 700; letter-spacing: 0.5px; color: ${accent}; text-transform: uppercase; }
    .doc-title { font-size: 26px; font-weight: 800; margin: 4px 0 2px; }
    .date { color: #6b6b76; font-size: 12px; margin-bottom: 24px; }
    .hr { height: 2px; background: ${accent}; opacity: 0.18; border: 0; margin: 0 0 24px; }
    .score-wrap { display: flex; align-items: center; gap: 20px; margin-bottom: 8px; }
    .score { font-size: 56px; font-weight: 800; line-height: 1; color: ${bandColor}; }
    .score small { font-size: 22px; color: #9a9aa4; font-weight: 600; }
    .band { font-size: 16px; font-weight: 700; color: ${bandColor}; }
    .roast { font-size: 18px; font-style: italic; line-height: 1.5; background: #f5f4f8; border-left: 4px solid ${accent}; padding: 16px 18px; border-radius: 10px; margin: 18px 0 8px; }
    h2 { font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: #3a3a44; margin: 26px 0 10px; border-bottom: 1px solid #e6e6ec; padding-bottom: 6px; }
    p { margin: 0 0 8px; }
    .lede { color: #45454f; }
    table { width: 100%; border-collapse: collapse; }
    .grid td, .grid th, table td { padding: 8px 4px; border-bottom: 1px solid #eee; text-align: left; }
    .ml { color: #45454f; }
    .mv { text-align: right; font-weight: 600; }
    th.mv { font-weight: 700; color: #3a3a44; }
    ul.bul { list-style: none; padding: 0; margin: 0; }
    ul.bul li { padding: 6px 0; display: flex; gap: 8px; }
    .mk { color: ${accent}; font-weight: 700; }
    .fix { background: #f5f4f8; border-radius: 10px; padding: 14px 16px; }
    .fix-action { font-weight: 600; margin-bottom: 4px; }
    .fix-impact { color: #1a8f4c; font-weight: 600; margin: 0; }
    .step { border: 1px solid #e6e6ec; border-radius: 10px; padding: 12px 14px; margin-bottom: 10px; page-break-inside: avoid; }
    .step-h { display: flex; align-items: baseline; gap: 10px; margin-bottom: 4px; }
    .step-week { font-size: 11px; font-weight: 700; color: ${accent}; text-transform: uppercase; }
    .step-title { font-weight: 700; }
    .step-desc { color: #45454f; margin: 0 0 4px; }
    .step-impact { color: #1a8f4c; font-weight: 600; font-size: 13px; margin: 0; }
    .footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid #e6e6ec; color: #8a8a94; font-size: 11px; line-height: 1.5; }
  </style></head><body>
    <div class="brand">Am I Broke?</div>
    <div class="doc-title">Your Financial Report</div>
    <div class="date">Generated ${esc(date)}</div>
    <hr class="hr" />

    <div class="score-wrap">
      <div class="score">${Math.round(a.score)}<small>/100</small></div>
      <div class="band">${esc(a.scoreLabel || band.label)}</div>
    </div>

    <div class="roast">"${esc(a.roast)}"</div>

    ${a.summary ? `<h2>The Breakdown</h2><p>${esc(a.summary)}</p>` : ''}
    ${topFix}

    <h2>Key Metrics</h2>
    <table>${metricsRows(a)}</table>

    ${listSection("What You're Doing Right", a.positiveBehaviors, '✓')}
    ${listSection('Biggest Problems', a.topProblems, '✕')}
    ${debtsSection(a)}
    ${budgetSection(a)}
    ${listSection('Key Insights', a.insights, '→')}
    ${planSection(opts.plan)}

    <div class="footer">
      This report is generated for informational and educational purposes only and does not
      constitute financial, investment, tax, or legal advice. Figures may be estimates based on
      the information you provided. Am I Broke? · ${esc(date)}
    </div>
  </body></html>`;
}

/**
 * Generate the report PDF and open the share sheet. Resolves to `true` if the document was
 * produced (the user may still cancel the share sheet). Throws on a generation failure so the
 * caller can surface an error.
 */
export async function shareFinancialReportPdf(a: FinalAnalysis, opts: ReportOptions = {}): Promise<boolean> {
  const html = buildReportHtml(a, opts);
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Your Financial Report',
      UTI: 'com.adobe.pdf',
    });
  }
  return true;
}
