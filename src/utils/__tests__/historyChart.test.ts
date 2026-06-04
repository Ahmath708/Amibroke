import {
  periodRange, periodLabel, shiftAnchor, isLatestPeriod, buildSlots, itemsInPeriod,
  timeLabel,
} from '../historyChart';
import type { AnalysisHistoryItem } from '@/types';

// Build a minimal history row at a given local datetime.
const row = (id: string, score: number, d: Date): AnalysisHistoryItem => ({
  id, score, score_label: 'Surviving', summary: '', created_at: d.toISOString(),
});

describe('periodRange', () => {
  it('week runs Sunday→Sunday', () => {
    // 2026-06-01 is a Monday.
    const { start, end } = periodRange('week', new Date(2026, 5, 1, 12));
    expect(start.getDay()).toBe(0);           // Sunday
    expect(start.getDate()).toBe(31);          // May 31
    expect(start.getMonth()).toBe(4);          // May
    expect(end.getDate()).toBe(7);             // next Sunday = Jun 7
    expect((end.getTime() - start.getTime()) / 86_400_000).toBe(7);
  });

  it('month spans the whole calendar month', () => {
    const { start, end } = periodRange('month', new Date(2026, 1, 15)); // Feb 2026
    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(1);
    expect(end.getMonth()).toBe(2); // March 1
  });

  it('year spans Jan 1 → next Jan 1', () => {
    const { start, end } = periodRange('year', new Date(2026, 7, 9));
    expect(start.getFullYear()).toBe(2026);
    expect(end.getFullYear()).toBe(2027);
  });
});

describe('shiftAnchor', () => {
  it('moves by one unit each way', () => {
    const a = new Date(2026, 5, 1);
    expect(shiftAnchor('week', a, -1).getDate()).toBe(25); // May 25
    expect(shiftAnchor('day', a, -1).getMonth()).toBe(4);  // May 31
    expect(shiftAnchor('month', a, 1).getMonth()).toBe(6); // July
    expect(shiftAnchor('year', a, 1).getFullYear()).toBe(2027);
  });
});

describe('isLatestPeriod', () => {
  const now = new Date(2026, 5, 1, 12);
  it('is true for the current period and false for a past one', () => {
    expect(isLatestPeriod('week', now, now)).toBe(true);
    expect(isLatestPeriod('week', shiftAnchor('week', now, -1), now)).toBe(false);
  });
});

describe('buildSlots', () => {
  it('week → 7 slots with empty days included', () => {
    const items = [row('a', 70, new Date(2026, 5, 1, 9))]; // Mon Jun 1
    const slots = buildSlots('week', new Date(2026, 5, 1, 12), items);
    expect(slots).toHaveLength(7);
    expect(slots[0].label).toBe('Sun');
    expect(slots[0].bars).toHaveLength(0);   // empty Sunday
    expect(slots[1].bars).toHaveLength(1);   // Monday has the entry
    expect(slots[1].bars[0]).toMatchObject({ kind: 'entry', score: 70, id: 'a' });
  });

  it('merges a day\'s multiple entries into one averaged aggregate bar', () => {
    // Post consistency-overhaul: a period slot shows one bar per day — a lone
    // entry, or (for 2+) a single bar at the AVERAGE score carrying a ×N count.
    const items = [
      row('e0', 40, new Date(2026, 5, 2, 8)),
      row('e1', 50, new Date(2026, 5, 2, 12)),
      row('e2', 60, new Date(2026, 5, 2, 16)),
    ];
    const slots = buildSlots('week', new Date(2026, 5, 2), items);
    const tue = slots.find((s) => s.label === 'Tue')!;
    expect(tue.bars).toHaveLength(1);
    expect(tue.bars[0]).toMatchObject({ kind: 'aggregate', score: 50, count: 3 }); // avg(40,50,60)=50
  });

  it('day view → one time-labelled bar per analysis, chronological', () => {
    const items = [
      row('late', 60, new Date(2026, 5, 1, 19, 0)),
      row('early', 55, new Date(2026, 5, 1, 8, 30)),
    ];
    const slots = buildSlots('day', new Date(2026, 5, 1, 12), items);
    expect(slots).toHaveLength(2);
    expect(slots[0].bars[0].id).toBe('early'); // sorted ascending
    expect(slots[0].label).toBe('8:30a');
    expect(slots[1].label).toBe('7p');
  });

  it('year → 12 month slots', () => {
    const slots = buildSlots('year', new Date(2026, 0, 1), [row('a', 70, new Date(2026, 3, 5))]);
    expect(slots).toHaveLength(12);
    expect(slots[3].bars).toHaveLength(1); // April
  });

  it('month → one slot per day of month', () => {
    const slots = buildSlots('month', new Date(2026, 1, 10), []); // Feb 2026 (28 days)
    expect(slots).toHaveLength(28);
  });
});

describe('timeLabel', () => {
  it('formats 12h with a/p and drops :00', () => {
    expect(timeLabel(new Date(2026, 5, 1, 8, 30))).toBe('8:30a');
    expect(timeLabel(new Date(2026, 5, 1, 19, 0))).toBe('7p');
    expect(timeLabel(new Date(2026, 5, 1, 0, 0))).toBe('12a');
    expect(timeLabel(new Date(2026, 5, 1, 12, 0))).toBe('12p');
  });
});

describe('itemsInPeriod', () => {
  it('keeps only rows inside the window', () => {
    const items = [
      row('in', 70, new Date(2026, 5, 1, 9)),
      row('out', 50, new Date(2026, 4, 1, 9)),
    ];
    const kept = itemsInPeriod('week', new Date(2026, 5, 1), items);
    expect(kept.map((i) => i.id)).toEqual(['in']);
  });
});

describe('periodLabel', () => {
  it('formats each granularity', () => {
    expect(periodLabel('year', new Date(2026, 5, 1))).toBe('2026');
    expect(periodLabel('month', new Date(2026, 4, 1))).toBe('May 2026');
    expect(periodLabel('week', new Date(2026, 5, 1))).toBe('May 31 – Jun 6'); // cross-month week
    expect(periodLabel('week', new Date(2026, 5, 10))).toBe('Jun 7 – 13');    // same-month week
    expect(periodLabel('day', new Date(2026, 5, 1))).toBe('Mon, Jun 1');
  });
});
