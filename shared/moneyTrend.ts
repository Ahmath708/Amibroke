// Money trend — the user's debt / savings / spending over time, for the Finances-tab chart.
// Pure + framework-agnostic. The dated readings come from immutable roast history (`analyses`) and
// check-ins (`check_ins`); the IO + the dev mock live in services/moneyTrend.ts.

export type MoneyMetric = 'debt' | 'savings' | 'spending';

/** A figure reading at a point in time (a roast or a check-in). Any metric may be absent — a check-in
 *  that only logged debt leaves savings/spending null, so it adds no point to those series. */
export interface DatedFigures {
  at: string; // ISO timestamp
  debt?: number | null;
  savings?: number | null;
  spending?: number | null;
}

export interface TrendPoint { date: string; value: number } // date = YYYY-MM-DD (the event day)

export type MoneyTrend = Record<MoneyMetric, TrendPoint[]>;

export const MONEY_METRICS: MoneyMetric[] = ['debt', 'savings', 'spending'];

/**
 * Build the per-metric trend from raw readings:
 *  • group by day, keep the LAST reading per metric per day — a balance is a point-in-time state, so a
 *    later same-day reading is a *correction* that supersedes the earlier one (never an average).
 *  • sort ascending by day.
 *  • anchor the series end at the current snapshot ("now") so the line always finishes at today's value.
 * A flat run is left flat (stable = honest signal); only "< 2 points" is a real empty state (UI's call).
 */
export function buildMoneyTrend(events: DatedFigures[], now?: DatedFigures): MoneyTrend {
  const out: MoneyTrend = { debt: [], savings: [], spending: [] };
  for (const metric of MONEY_METRICS) {
    const byDay = new Map<string, { at: string; value: number }>();
    for (const e of events) {
      const v = e[metric];
      if (v == null) continue;
      const day = e.at.slice(0, 10);
      const prev = byDay.get(day);
      if (!prev || e.at > prev.at) byDay.set(day, { at: e.at, value: v }); // later same-day reading wins
    }
    const pts = [...byDay.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([date, { value }]) => ({ date, value }));

    const nowV = now?.[metric];
    if (now && nowV != null) {
      const nowDay = now.at.slice(0, 10);
      if (pts.length && pts[pts.length - 1].date === nowDay) pts[pts.length - 1].value = nowV; // snapshot supersedes
      else pts.push({ date: nowDay, value: nowV });
    }
    out[metric] = pts;
  }
  return out;
}

/** First → last delta for a metric's series (for the headline, e.g. "Debt ↓ $2.6k"). Null if < 2 points. */
export function trendDelta(points: TrendPoint[]): { from: number; to: number; change: number } | null {
  if (points.length < 2) return null;
  const from = points[0].value;
  const to = points[points.length - 1].value;
  return { from, to, change: to - from };
}
