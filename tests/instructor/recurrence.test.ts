import { describe, expect, it } from 'vitest';
import {
  addDaysTo,
  localDateOf,
  localTimeOf,
  localToUtc,
  singleOccurrence,
  weekdayOf,
  weeklyOccurrences,
} from '@/lib/instructor/recurrence';
import { InstructorError } from '@/lib/instructor/rules';

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof InstructorError ? e.code : 'OTHER';
  }
  return 'NONE';
};

describe('local time to UTC', () => {
  it('Asia/Kolkata is UTC+5:30 all year', () => {
    expect(localToUtc('2026-11-02', '10:00', 'Asia/Kolkata').toISOString()).toBe('2026-11-02T04:30:00.000Z');
    expect(localToUtc('2026-07-02', '10:00', 'Asia/Kolkata').toISOString()).toBe('2026-07-02T04:30:00.000Z');
  });
  it('America/New_York follows daylight saving', () => {
    expect(localToUtc('2026-03-07', '10:00', 'America/New_York').toISOString()).toBe('2026-03-07T15:00:00.000Z'); // EST
    expect(localToUtc('2026-03-09', '10:00', 'America/New_York').toISOString()).toBe('2026-03-09T14:00:00.000Z'); // EDT
  });
  it('round trips the local date and time', () => {
    const at = localToUtc('2026-11-02', '23:30', 'America/New_York');
    expect(localDateOf(at, 'America/New_York')).toBe('2026-11-02');
    expect(localTimeOf(at, 'America/New_York')).toBe('23:30');
    // the same instant is already the next day in Kolkata
    expect(localDateOf(at, 'Asia/Kolkata')).toBe('2026-11-03');
  });
  it('rejects malformed input (SIM-017)', () => {
    expect(code(() => localToUtc('2026-13-40', '10:00', 'Asia/Kolkata'))).toBe('SIM-017');
    expect(code(() => localToUtc('2026-11-02', '25:00', 'Asia/Kolkata'))).toBe('SIM-017');
    expect(code(() => localToUtc('02/11/2026', '10:00', 'Asia/Kolkata'))).toBe('SIM-017');
  });
});

describe('calendar helpers', () => {
  it('weekday and date arithmetic ignore the zone', () => {
    expect(weekdayOf('2026-10-30')).toBe('FR');
    expect(weekdayOf('2026-11-01')).toBe('SU');
    expect(addDaysTo('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDaysTo('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('single window', () => {
  it('end must be after start (SIM-005)', () => {
    expect(code(() => singleOccurrence('2026-11-02', '12:00', '12:00', 'Asia/Kolkata'))).toBe('SIM-005');
    expect(code(() => singleOccurrence('2026-11-02', '12:00', '09:00', 'Asia/Kolkata'))).toBe('SIM-005');
    const o = singleOccurrence('2026-11-02', '10:00', '12:00', 'Asia/Kolkata');
    expect(o.closesAt.getTime() - o.opensAt.getTime()).toBe(2 * 3_600_000);
  });
});

describe('weekly repeat (M18-AC7)', () => {
  it('creates one window per matching day until the end date, inclusive', () => {
    // Mondays and Wednesdays from Mon 2 Nov to Sun 22 Nov 2026: 2, 4, 9, 11, 16, 18
    const o = weeklyOccurrences('2026-11-02', '10:00', '12:00', { byDay: ['MO', 'WE'], until: '2026-11-22' }, 'Asia/Kolkata');
    expect(o).toHaveLength(6);
    expect(o.map((x) => localDateOf(x.opensAt, 'Asia/Kolkata'))).toEqual([
      '2026-11-02', '2026-11-04', '2026-11-09', '2026-11-11', '2026-11-16', '2026-11-18',
    ]);
    expect(new Set(o.map((x) => localTimeOf(x.opensAt, 'Asia/Kolkata')))).toEqual(new Set(['10:00']));
  });
  it('starts at the first matching day on or after the start date', () => {
    const o = weeklyOccurrences('2026-11-03', '10:00', '11:00', { byDay: ['MO'] , until: '2026-11-16' }, 'Asia/Kolkata');
    expect(o.map((x) => localDateOf(x.opensAt, 'Asia/Kolkata'))).toEqual(['2026-11-09', '2026-11-16']);
  });
  it('keeps the local hour across the New York daylight saving change', () => {
    // Sundays: 1 Nov 2026 is the day clocks go back (EDT to EST)
    const o = weeklyOccurrences('2026-10-25', '09:00', '10:00', { byDay: ['SU'], until: '2026-11-08' }, 'America/New_York');
    expect(o.map((x) => x.opensAt.toISOString())).toEqual([
      '2026-10-25T13:00:00.000Z',
      '2026-11-01T14:00:00.000Z',
      '2026-11-08T14:00:00.000Z',
    ]);
  });
  it('allows 26 occurrences and refuses 27 (SIM-016)', () => {
    expect(weeklyOccurrences('2026-11-02', '10:00', '11:00', { byDay: ['MO'], until: '2027-04-26' }, 'Asia/Kolkata')).toHaveLength(26);
    expect(code(() => weeklyOccurrences('2026-11-02', '10:00', '11:00', { byDay: ['MO'], until: '2027-05-03' }, 'Asia/Kolkata'))).toBe('SIM-016');
  });
  it('needs days and an end date that is not before the start (SIM-019)', () => {
    expect(code(() => weeklyOccurrences('2026-11-02', '10:00', '11:00', { byDay: [], until: '2026-12-01' }, 'Asia/Kolkata'))).toBe('SIM-019');
    expect(code(() => weeklyOccurrences('2026-11-02', '10:00', '11:00', { byDay: ['MO'], until: '2026-10-01' }, 'Asia/Kolkata'))).toBe('SIM-019');
    expect(code(() => weeklyOccurrences('2026-11-02', '10:00', '11:00', { byDay: ['TU'], until: '2026-11-02' }, 'Asia/Kolkata'))).toBe('SIM-019');
  });
});
