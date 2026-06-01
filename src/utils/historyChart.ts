/**
 * Pure bucketing logic for the filterable History chart.
 *
 * Given a granularity (year/month/week/day) and an anchor date, we compute the
 * period window and split the analyses into x-axis "slots":
 *   - year  → 12 month slots
 *   - month → one slot per day of the month
 *   - week  → 7 day slots (Sun–Sat), empty days included so the whole week shows
 *   - day   → one slot per analysis, labelled by time (no hourly bucketing)
 *
 * Within a slot, each analysis is its own bar UNTIL the count exceeds
 * COLLAPSE_THRESHOLD, at which point the slot collapses to a single bar at the
 * average score with a "×N" badge (tap to drill into the finer granularity).
 *
 * No React / theme imports — kept pure so it can be unit-tested and the colour
 * mapping stays in the component.
 */
import type { AnalysisHistoryItem } from '@/types';

export type Granularity = 'year' | 'month' | 'week' | 'day';
export const GRANULARITIES: Granularity[] = ['year', 'month', 'week', 'day'];

/** Above this many analyses in one slot, collapse to a single averaged bar. */
export const COLLAPSE_THRESHOLD = 5;

export interface ChartEntry {
  id: string;
  score: number;
  date: Date;
}

export interface ChartBar {
  kind: 'entry' | 'aggregate';
  score: number;          // entry score, or rounded average for an aggregate
  id?: string;            // present for single entries (→ open that Results)
  count?: number;         // present for aggregates (→ "×count")
  timeLabel?: string;     // present in day view (e.g. "8:30a")
}

export interface ChartSlot {
  label: string;          // primary x-axis label (weekday / day-of-month / month / time)
  sublabel?: string;      // secondary line (e.g. date number under a weekday)
  date: Date;             // representative date — used to drill down
  bars: ChartBar[];       // empty array = no analyses in this slot
}

export interface Period {
  start: Date;            // inclusive
  end: Date;              // exclusive
}

const DAY_MS = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function periodRange(g: Granularity, anchor: Date): Period {
  switch (g) {
    case 'year':
      return { start: new Date(anchor.getFullYear(), 0, 1), end: new Date(anchor.getFullYear() + 1, 0, 1) };
    case 'month':
      return { start: new Date(anchor.getFullYear(), anchor.getMonth(), 1), end: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1) };
    case 'week': {
      const s = startOfDay(anchor);
      s.setDate(s.getDate() - s.getDay()); // back up to Sunday
      const e = new Date(s);
      e.setDate(s.getDate() + 7);
      return { start: s, end: e };
    }
    case 'day': {
      const s = startOfDay(anchor);
      const e = new Date(s);
      e.setDate(s.getDate() + 1);
      return { start: s, end: e };
    }
  }
}

/** Shift the anchor by ±1 unit of the granularity. */
export function shiftAnchor(g: Granularity, anchor: Date, dir: 1 | -1): Date {
  const d = new Date(anchor);
  switch (g) {
    case 'year': d.setFullYear(d.getFullYear() + dir); break;
    case 'month': d.setMonth(d.getMonth() + dir); break;
    case 'week': d.setDate(d.getDate() + 7 * dir); break;
    case 'day': d.setDate(d.getDate() + dir); break;
  }
  return d;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LETTER = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function periodLabel(g: Granularity, anchor: Date): string {
  switch (g) {
    case 'year':
      return `${anchor.getFullYear()}`;
    case 'month':
      return `${MONTHS_SHORT[anchor.getMonth()]} ${anchor.getFullYear()}`;
    case 'week': {
      const { start, end } = periodRange('week', anchor);
      const last = new Date(end.getTime() - DAY_MS);
      const sameMonth = start.getMonth() === last.getMonth();
      const left = `${MONTHS_SHORT[start.getMonth()]} ${start.getDate()}`;
      const right = sameMonth ? `${last.getDate()}` : `${MONTHS_SHORT[last.getMonth()]} ${last.getDate()}`;
      return `${left} – ${right}`;
    }
    case 'day':
      return `${WEEKDAYS_SHORT[anchor.getDay()]}, ${MONTHS_SHORT[anchor.getMonth()]} ${anchor.getDate()}`;
  }
}

/** True when navigating forward would enter a period that hasn't happened yet. */
export function isLatestPeriod(g: Granularity, anchor: Date, now: Date): boolean {
  return periodRange(g, anchor).end > now;
}

export function timeLabel(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h < 12 ? 'a' : 'p';
  h = h % 12;
  if (h === 0) h = 12;
  return m === 0 ? `${h}${ampm}` : `${h}:${String(m).padStart(2, '0')}${ampm}`;
}

const round = (n: number) => Math.round(n);
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Collapse a slot's entries to bars, applying the overflow threshold. */
function barsFor(entries: ChartEntry[]): ChartBar[] {
  if (entries.length === 0) return [];
  if (entries.length <= COLLAPSE_THRESHOLD) {
    return entries.map((e) => ({ kind: 'entry', score: e.score, id: e.id }));
  }
  return [{ kind: 'aggregate', score: round(avg(entries.map((e) => e.score))), count: entries.length }];
}

/**
 * Build the chart slots for a period. `items` are the raw history rows (any order);
 * only those inside the period are used.
 */
export function buildSlots(g: Granularity, anchor: Date, items: AnalysisHistoryItem[]): ChartSlot[] {
  const { start, end } = periodRange(g, anchor);
  const entries: ChartEntry[] = items
    .map((it) => ({ id: it.id, score: it.score, date: new Date(it.created_at) }))
    .filter((e) => e.date >= start && e.date < end)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (g === 'day') {
    // One bar per analysis, chronological, labelled by time. No collapsing —
    // this is the leaf view where every run is meant to be visible (scrollable).
    return entries.map((e) => ({
      label: timeLabel(e.date),
      date: e.date,
      bars: [{ kind: 'entry', score: e.score, id: e.id, timeLabel: timeLabel(e.date) }],
    }));
  }

  if (g === 'year') {
    return MONTHS_SHORT.map((_, month) => {
      const inSlot = entries.filter((e) => e.date.getMonth() === month);
      return { label: MONTHS_LETTER[month], date: new Date(anchor.getFullYear(), month, 1), bars: barsFor(inSlot) };
    });
  }

  if (g === 'month') {
    const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const inSlot = entries.filter((e) => e.date.getDate() === day);
      return { label: `${day}`, date: new Date(anchor.getFullYear(), anchor.getMonth(), day), bars: barsFor(inSlot) };
    });
  }

  // week → 7 day slots, Sun–Sat
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const inSlot = entries.filter((e) => startOfDay(e.date).getTime() === date.getTime());
    return { label: WEEKDAYS_SHORT[date.getDay()], sublabel: `${date.getDate()}`, date, bars: barsFor(inSlot) };
  });
}

/** Filter raw history rows to a period (used to sync the list under the chart). */
export function itemsInPeriod(g: Granularity, anchor: Date, items: AnalysisHistoryItem[]): AnalysisHistoryItem[] {
  const { start, end } = periodRange(g, anchor);
  return items.filter((it) => {
    const d = new Date(it.created_at);
    return d >= start && d < end;
  });
}
