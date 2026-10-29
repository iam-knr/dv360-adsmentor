import { describe, expect, it } from 'vitest';
import {
  MAX_CATCH_UP,
  nextOccurrence,
  occurrenceDay,
  occurrences,
  scheduleSummary,
} from '@/lib/reporting/schedule';
import type { ReportSchedule } from '@/lib/reporting/types';

const base: ReportSchedule = {
  active: true,
  timeZone: 'UTC',
  repeats: 'DAILY',
  every: 1,
  starts: '2026-10-01',
};
const at = (iso: string) => new Date(`${iso}T00:00:00Z`);
const days = (list: Date[]) => list.map((d) => d.toISOString().slice(0, 10));

describe('occurrences', () => {
  it('daily: one per day after `from`, up to and including `to`', () => {
    expect(days(occurrences(base, at('2026-10-01'), at('2026-10-04')))).toEqual([
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
  });
  it('every n days', () => {
    expect(days(occurrences({ ...base, every: 3 }, at('2026-09-30'), at('2026-10-10')))).toEqual([
      '2026-10-01',
      '2026-10-04',
      '2026-10-07',
      '2026-10-10',
    ]);
  });
  it('weekly, monthly (clamped to month end), quarterly and yearly', () => {
    const w = occurrences({ ...base, repeats: 'WEEKLY' }, at('2026-09-30'), at('2026-10-20'));
    expect(days(w)).toEqual(['2026-10-01', '2026-10-08', '2026-10-15']);
    const m = occurrences(
      { ...base, repeats: 'MONTHLY', starts: '2026-01-31' },
      at('2026-01-01'),
      at('2026-04-01'),
    );
    expect(days(m)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    const q = occurrences({ ...base, repeats: 'QUARTERLY' }, at('2026-09-30'), at('2027-05-01'));
    expect(days(q)).toEqual(['2026-10-01', '2027-01-01', '2027-04-01']);
    const y = occurrences({ ...base, repeats: 'YEARLY' }, at('2026-09-30'), at('2028-12-01'));
    expect(days(y)).toEqual(['2026-10-01', '2027-10-01', '2028-10-01']);
  });
  it('stops after the expiry day and when inactive', () => {
    const s = { ...base, expires: '2026-10-03' };
    expect(days(occurrences(s, at('2026-09-30'), at('2026-10-20')))).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ]);
    expect(occurrences({ ...base, active: false }, at('2026-09-30'), at('2026-10-20'))).toEqual([]);
  });
  it('midnight is in the schedule time zone', () => {
    const s = { ...base, timeZone: 'Asia/Kolkata' };
    const [first] = occurrences(s, at('2026-09-30'), at('2026-10-05'));
    expect(first?.toISOString()).toBe('2026-09-30T18:30:00.000Z');
    expect(occurrenceDay(first as Date, 'Asia/Kolkata')).toBe('2026-10-01');
  });
  it('a fast-forward owes more than the catch-up cap', () => {
    const owed = occurrences(base, at('2026-10-01'), at('2026-10-25'));
    expect(owed.length).toBeGreaterThan(MAX_CATCH_UP);
  });
  it('is idempotent: the same window gives the same instants', () => {
    const a = occurrences(base, at('2026-10-01'), at('2026-10-09'));
    const b = occurrences(base, at('2026-10-01'), at('2026-10-09'));
    expect(a.map(Number)).toEqual(b.map(Number));
  });
});

describe('nextOccurrence and summary', () => {
  it('next after an instant, null after expiry', () => {
    expect(nextOccurrence(base, new Date('2026-10-02T05:00:00Z'))?.toISOString()).toBe(
      '2026-10-03T00:00:00.000Z',
    );
    expect(nextOccurrence({ ...base, expires: '2026-10-02' }, at('2026-10-02'))).toBeNull();
  });
  it('reads like the form', () => {
    expect(scheduleSummary({ ...base, expires: '2026-12-31' })).toBe(
      'Runs every day at 12 am in UTC until 2026-12-31',
    );
    expect(scheduleSummary({ ...base, repeats: 'WEEKLY', every: 2 })).toBe(
      'Runs every 2 weeks at 12 am in UTC',
    );
  });
});
