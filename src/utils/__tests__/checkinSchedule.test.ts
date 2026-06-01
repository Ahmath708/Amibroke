import {
  addMonthsClamped, scheduledDate, scheduledOnOrBefore, scheduledAfter,
  dueStatus, nextReminderDate,
} from '../checkinSchedule';

describe('addMonthsClamped', () => {
  it('keeps the day-of-month when it exists', () => {
    const r = addMonthsClamped(new Date(2026, 0, 14), 1); // Jan 14 → Feb 14
    expect([r.getMonth(), r.getDate()]).toEqual([1, 14]);
  });
  it('clamps to month end for short months', () => {
    const r = addMonthsClamped(new Date(2026, 0, 31), 1); // Jan 31 → Feb 28 (2026 not leap)
    expect([r.getMonth(), r.getDate()]).toEqual([1, 28]);
  });
  it('rolls across year boundaries', () => {
    const r = addMonthsClamped(new Date(2026, 11, 10), 2); // Dec 2026 → Feb 2027
    expect([r.getFullYear(), r.getMonth(), r.getDate()]).toEqual([2027, 1, 10]);
  });
});

describe('scheduled points', () => {
  const first = new Date(2026, 1, 14, 9, 30); // Feb 14 2026, with a time
  it('first check-in is one month after the first analysis', () => {
    const s1 = scheduledDate(first, 1);
    expect([s1.getMonth(), s1.getDate(), s1.getHours()]).toEqual([2, 14, 0]); // Mar 14, midnight
  });
  it('scheduledOnOrBefore returns null before the first due date', () => {
    expect(scheduledOnOrBefore(first, new Date(2026, 1, 20))).toBeNull(); // still Feb, before Mar 14
  });
  it('scheduledOnOrBefore finds the latest past due date', () => {
    const r = scheduledOnOrBefore(first, new Date(2026, 4, 2))!; // May 2 → latest is Apr 14
    expect([r.getMonth(), r.getDate()]).toEqual([3, 14]);
  });
  it('scheduledAfter finds the next future due date', () => {
    const r = scheduledAfter(first, new Date(2026, 4, 2)); // May 2 → next is May 14
    expect([r.getMonth(), r.getDate()]).toEqual([4, 14]);
  });
});

describe('dueStatus', () => {
  const first = new Date(2026, 1, 14); // Feb 14

  it('is null with no first analysis', () => {
    expect(dueStatus(null, null, new Date(2026, 5, 1))).toBeNull();
  });

  it('not due before the first scheduled check-in', () => {
    const s = dueStatus(first, null, new Date(2026, 1, 20))!; // Feb 20
    expect(s.due).toBe(false);
    expect([s.dueDate.getMonth(), s.dueDate.getDate()]).toEqual([2, 14]); // upcoming = Mar 14
  });

  it('due once the anchor passes with no check-in', () => {
    const s = dueStatus(first, null, new Date(2026, 2, 15))!; // Mar 15
    expect(s.due).toBe(true);
    expect([s.dueDate.getMonth(), s.dueDate.getDate()]).toEqual([2, 14]); // the due period = Mar 14
  });

  it('not due right after completing the current period', () => {
    const last = new Date(2026, 2, 15); // checked in Mar 15
    const s = dueStatus(first, last, new Date(2026, 2, 20))!; // Mar 20
    expect(s.due).toBe(false);
    expect([s.dueDate.getMonth(), s.dueDate.getDate()]).toEqual([3, 14]); // next = Apr 14
  });

  it('a missed month collapses into one due period (no stacking)', () => {
    // First analyze Feb 14, never checked in, now July → due, period = latest anchor (Jul 14).
    const s = dueStatus(first, new Date(2026, 2, 1), new Date(2026, 6, 20))!; // last check Mar 1, now Jul 20
    expect(s.due).toBe(true);
    expect([s.dueDate.getMonth(), s.dueDate.getDate()]).toEqual([6, 14]); // Jul 14, not stacked Apr/May/Jun
  });
});

describe('nextReminderDate', () => {
  const first = new Date(2026, 1, 14);
  it('returns the upcoming anchor when not due', () => {
    const r = nextReminderDate(first, new Date(2026, 2, 15), new Date(2026, 2, 20))!; // checked in Mar
    expect([r.getMonth(), r.getDate()]).toEqual([3, 14]); // Apr 14
  });
  it('returns the next future anchor when already overdue', () => {
    const r = nextReminderDate(first, null, new Date(2026, 2, 20))!; // due (Mar 14 passed), now Mar 20
    expect([r.getMonth(), r.getDate()]).toEqual([3, 14]); // schedule next reminder Apr 14
  });
});
