// Client-side, heuristic starting-score ESTIMATE for the onboarding "live score" (Plan 2, Act 2).
// This is NOT the real score — it's a directional 0–100 preview that moves as the user answers, so
// they watch the number assemble. The REAL score comes from `analyzeFinances` at the payoff. This
// runs entirely on-device (no API call — rule #1).
import { INCOME_MID, SAVINGS_MID, DEBT_MID } from '@shared/financialSnapshot';
import type { ContextValues } from '@/components/FinancialContextForm';

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** A rough, monotonic 0–100 estimate from the bracketed inputs collected so far. Returns null when
 *  there's no money signal yet (so Act 2 can show the ring as "waiting"). */
export function estimateScore(sel: ContextValues, incomeExact?: number | null): number | null {
  const income = (incomeExact && incomeExact > 0 ? incomeExact : INCOME_MID[sel.incomeBracket ?? ''] ?? 0);
  const debt = DEBT_MID[sel.debtBracket ?? ''] ?? 0;
  const savings = SAVINGS_MID[sel.liquidSavingsBracket ?? ''] ?? 0;
  const hasSignal = income > 0 || debt > 0 || savings > 0 || !!sel.debtBracket || !!sel.liquidSavingsBracket;
  if (!hasSignal) return null;

  let score = 50;

  // Savings cushion — emergency months against a proxy expense (70% of income).
  const expenses = Math.max(income * 0.7, 1);
  const months = savings / expenses;
  score += clamp(months * 8, 0, 22); // ~+22 at ~2.7 months saved

  // Debt burden — total debt vs annual income (heavy penalty for high consumer debt).
  const dti = income > 0 ? debt / (income * 12) : (debt > 0 ? 1 : 0);
  score -= clamp(dti * 60, 0, 32);

  // Situational nudges.
  if (sel.employmentStatus === 'full_time') score += 4;
  else if (sel.employmentStatus === 'between_jobs') score -= 6;
  if (sel.livingSituation === 'with_family') score += 3;

  return Math.round(clamp(score, 5, 95));
}
