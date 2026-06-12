import { buildMoneyTrend, trendDelta, type DatedFigures } from './moneyTrend';

const events: DatedFigures[] = [
  { at: '2026-05-04T09:00:00Z', debt: 10600, savings: 1800, spending: 3900 },
  { at: '2026-05-04T19:30:00Z', debt: 10400, savings: 1900, spending: 3800 }, // same day, later → wins
  { at: '2026-05-25T12:00:00Z', debt: 10000, savings: 2200 },                  // check-in: no spending
];
const now: DatedFigures = { at: '2026-06-11T00:00:00Z', debt: 9800, savings: 2600, spending: 3700 };

describe('buildMoneyTrend', () => {
  it('keeps the last reading per day (never averages a same-day re-reading)', () => {
    const t = buildMoneyTrend(events, now);
    expect(t.debt.find((p) => p.date === '2026-05-04')?.value).toBe(10400);
  });

  it('anchors the series end at the snapshot "now"', () => {
    const t = buildMoneyTrend(events, now);
    expect(t.debt[t.debt.length - 1]).toEqual({ date: '2026-06-11', value: 9800 });
  });

  it('is per-metric — a check-in without spending adds no spending point', () => {
    const t = buildMoneyTrend(events, now);
    expect(t.debt.map((p) => p.date)).toEqual(['2026-05-04', '2026-05-25', '2026-06-11']);
    expect(t.spending.map((p) => p.date)).toEqual(['2026-05-04', '2026-06-11']);
  });

  it('trendDelta is first→last, null under 2 points', () => {
    const t = buildMoneyTrend(events, now);
    expect(trendDelta(t.debt)).toEqual({ from: 10400, to: 9800, change: -600 });
    expect(trendDelta([{ date: '2026-06-11', value: 9800 }])).toBeNull();
  });
});
