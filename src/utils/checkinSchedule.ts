/**
 * Monthly check-in scheduling — pure date math.
 *
 * The cadence is a FIXED monthly anchor: due dates fall on the same day-of-month
 * as the user's first analysis (clamped for short months), every month. The
 * schedule never drifts if the user is early, late, or misses a month — a missed
 * month simply collapses into "due now" for the current period (it doesn't stack).
 *
 * Schedule points are firstAnalyze + 1 month, + 2 months, … (the first check-in is
 * due one month after the first analysis).
 */

const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const atMidnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** firstAnalyze + n months, with the day clamped to the target month's length. */
export function addMonthsClamped(base: Date, n: number): Date {
  const y = base.getFullYear();
  const m = base.getMonth() + n;
  const targetY = y + Math.floor(m / 12);
  const targetM = ((m % 12) + 12) % 12;
  const day = Math.min(base.getDate(), daysInMonth(targetY, targetM));
  return new Date(targetY, targetM, day);
}

/** The k-th scheduled check-in date (k ≥ 1), at midnight. */
export function scheduledDate(firstAnalyze: Date, k: number): Date {
  return addMonthsClamped(atMidnight(firstAnalyze), k);
}

/** Latest scheduled date on or before `date`, or null if none has occurred yet. */
export function scheduledOnOrBefore(firstAnalyze: Date, date: Date): Date | null {
  const first = atMidnight(firstAnalyze);
  const monthsApart = (date.getFullYear() - first.getFullYear()) * 12 + (date.getMonth() - first.getMonth());
  let k = monthsApart + 1; // generous upper guess
  while (k >= 1 && scheduledDate(first, k) > date) k--;
  return k >= 1 ? scheduledDate(first, k) : null;
}

/** Earliest scheduled date strictly after `date`. */
export function scheduledAfter(firstAnalyze: Date, date: Date): Date {
  const first = atMidnight(firstAnalyze);
  const monthsApart = (date.getFullYear() - first.getFullYear()) * 12 + (date.getMonth() - first.getMonth());
  let k = Math.max(1, monthsApart);
  while (scheduledDate(first, k) <= date) k++;
  return scheduledDate(first, k);
}

export interface DueStatus {
  /** True when a scheduled check-in is due and not yet completed. */
  due: boolean;
  /** The relevant anchor date — the period that's due now, or the next upcoming one. */
  dueDate: Date;
}

/**
 * Whether a check-in is currently due, and the relevant anchor date.
 * `lastCheckInAt` is the timestamp of the most recent completed check-in (or null).
 */
export function dueStatus(firstAnalyze: Date | null, lastCheckInAt: Date | null, now: Date): DueStatus | null {
  if (!firstAnalyze) return null; // no analysis yet → no schedule
  const current = scheduledOnOrBefore(firstAnalyze, now);
  const dueNow = current !== null && (lastCheckInAt === null || lastCheckInAt < current);
  return {
    due: dueNow,
    dueDate: dueNow ? (current as Date) : scheduledAfter(firstAnalyze, now),
  };
}

/** The next date a reminder should fire (for local-notification scheduling). */
export function nextReminderDate(firstAnalyze: Date | null, lastCheckInAt: Date | null, now: Date): Date | null {
  const status = dueStatus(firstAnalyze, lastCheckInAt, now);
  if (!status) return null;
  // If already due, the reminder is the next future occurrence; otherwise the upcoming due date.
  return status.due ? scheduledAfter(firstAnalyze as Date, now) : status.dueDate;
}
