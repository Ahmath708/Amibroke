// Check-in cadence + streak — soft monthly (docs/unified-financial-model.md §7).
// Pure + cross-runtime. This governs ONLY the streak + the countdown nudge — never access:
// numbers/feelings stay updatable anytime; the OFFICIAL check-in (one canonical check_ins row
// per monthly window) advances the streak.

/** 'YYYY-MM' month bucket for a date (UTC). */
export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function prevMonthKey(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/** Set of months ('YYYY-MM') that have at least one check-in. */
export function checkinMonths(dates: Array<string | Date>): Set<string> {
  const s = new Set<string>();
  for (const d of dates) s.add(monthKey(typeof d === 'string' ? new Date(d) : d));
  return s;
}

/** Has the official check-in for the current window already happened? */
export function officialDoneThisWindow(dates: Array<string | Date>, now: Date = new Date()): boolean {
  return checkinMonths(dates).has(monthKey(now));
}

/**
 * Consecutive monthly windows with a check-in. Alive if this month is done (count it + walk back),
 * or this month isn't done yet but last month was (count from last month — still alive, this
 * window just hasn't been logged). Broken to 0 once a full window is missed.
 */
export function currentStreak(dates: Array<string | Date>, now: Date = new Date()): number {
  const months = checkinMonths(dates);
  let ym = monthKey(now);
  if (!months.has(ym)) {
    ym = prevMonthKey(ym);
    if (!months.has(ym)) return 0; // the last full window was missed → streak broken
  }
  let streak = 0;
  while (months.has(ym)) { streak++; ym = prevMonthKey(ym); }
  return streak;
}

/**
 * Days until the next official check-in is *due* — for the countdown nudge (never a gate).
 * 0 when this window's check-in isn't done yet (available now); otherwise days until the 1st of
 * next month (when the next window opens).
 */
export function daysUntilNextCheckin(dates: Array<string | Date>, now: Date = new Date()): number {
  if (!officialDoneThisWindow(dates, now)) return 0; // available now
  const nextWindow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return Math.max(0, Math.ceil((nextWindow - now.getTime()) / (24 * 60 * 60 * 1000)));
}
