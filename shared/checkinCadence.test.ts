import {
  monthKey, checkinMonths, officialDoneThisWindow, currentStreak, daysUntilNextCheckin,
} from './checkinCadence';

// Fixed "now" mid-month so window math is stable.
const NOW = new Date('2026-06-15T12:00:00.000Z'); // window 2026-06

describe('monthKey', () => {
  it('buckets by UTC year-month', () => {
    expect(monthKey(new Date('2026-06-15T12:00:00Z'))).toBe('2026-06');
    expect(monthKey(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01');
  });
});

describe('officialDoneThisWindow', () => {
  it('true when a check-in exists in the current month', () => {
    expect(officialDoneThisWindow(['2026-06-03T09:00:00Z'], NOW)).toBe(true);
  });
  it('false when none this month', () => {
    expect(officialDoneThisWindow(['2026-05-20T09:00:00Z'], NOW)).toBe(false);
    expect(officialDoneThisWindow([], NOW)).toBe(false);
  });
});

describe('currentStreak', () => {
  it('counts this month + consecutive prior months', () => {
    const dates = ['2026-06-02', '2026-05-10', '2026-04-22']; // Jun, May, Apr
    expect(currentStreak(dates, NOW)).toBe(3);
  });

  it('stays alive (counts from last month) when this window is not done yet', () => {
    const dates = ['2026-05-10', '2026-04-22']; // May + Apr, none in Jun yet
    expect(currentStreak(dates, NOW)).toBe(2);
  });

  it('breaks to 0 once a full window is missed', () => {
    const dates = ['2026-04-22', '2026-03-15']; // nothing in May or Jun → missed May
    expect(currentStreak(dates, NOW)).toBe(0);
  });

  it('ignores gaps before the streak', () => {
    const dates = ['2026-06-02', '2026-05-10', '2026-02-01']; // Jun, May, then a gap (Apr/Mar missing)
    expect(currentStreak(dates, NOW)).toBe(2);
  });

  it('is 0 with no check-ins', () => {
    expect(currentStreak([], NOW)).toBe(0);
  });
});

describe('daysUntilNextCheckin', () => {
  it('is 0 when this window is not done (available now)', () => {
    expect(daysUntilNextCheckin(['2026-05-10'], NOW)).toBe(0);
  });
  it('counts days to next month start when this window is done', () => {
    // NOW = Jun 15 12:00Z; next window opens Jul 1 → ~16 days.
    expect(daysUntilNextCheckin(['2026-06-02'], NOW)).toBe(16);
  });
});
