import { describe, expect, it } from 'vitest';
import {
  dayIn,
  endOfDayIn,
  formatZoneLabel,
  longDate,
  monthDay,
  startOfDayIn,
  timeIn,
  weekdayOf,
} from '@/lib/history/zone';

describe('formatZoneLabel (AC-05-14)', () => {
  it('maps common zones to their abbreviations', () => {
    expect(formatZoneLabel('Asia/Calcutta')).toBe('IST');
    expect(formatZoneLabel('Asia/Kolkata')).toBe('IST');
    expect(formatZoneLabel('UTC')).toBe('UTC');
    expect(formatZoneLabel('Asia/Singapore')).toBe('SGT');
  });
  it('picks the daylight name only while daylight time applies', () => {
    expect(formatZoneLabel('America/New_York', new Date('2026-01-15T12:00:00Z'))).toBe('EST');
    expect(formatZoneLabel('America/New_York', new Date('2026-07-15T12:00:00Z'))).toBe('EDT');
    expect(formatZoneLabel('Europe/London', new Date('2026-07-15T12:00:00Z'))).toBe('BST');
    expect(formatZoneLabel('Australia/Sydney', new Date('2026-01-15T12:00:00Z'))).toBe('AEDT');
    expect(formatZoneLabel('Australia/Sydney', new Date('2026-07-15T12:00:00Z'))).toBe('AEST');
  });
  it('falls back to GMT+h:mm for an unmapped zone', () => {
    expect(formatZoneLabel('Asia/Kathmandu')).toBe('GMT+5:45');
    expect(formatZoneLabel('America/Sao_Paulo', new Date('2026-07-15T12:00:00Z'))).toBe('GMT-3:00');
    expect(formatZoneLabel('Africa/Abidjan')).toBe('GMT');
  });
});

describe('day bucketing', () => {
  it('moves a row across midnight when the zone changes (AC-05-13)', () => {
    const at = new Date('2026-03-25T20:30:00Z'); // 02:00 IST on Mar 26
    expect(dayIn('Asia/Calcutta', at)).toBe('2026-03-26');
    expect(dayIn('UTC', at)).toBe('2026-03-25');
    expect(timeIn('Asia/Calcutta', at)).toBe('02:00:00');
  });
  it('gives day bounds that survive a daylight saving change', () => {
    // US clocks went forward on 2026-03-08: that day has 23 hours
    const start = startOfDayIn('America/New_York', '2026-03-08');
    const end = endOfDayIn('America/New_York', '2026-03-08');
    expect(end.getTime() - start.getTime() + 1).toBe(23 * 3_600_000);
    expect(dayIn('America/New_York', start)).toBe('2026-03-08');
    expect(dayIn('America/New_York', end)).toBe('2026-03-08');
  });
});

describe('date text', () => {
  it('formats the day card labels', () => {
    expect(monthDay('2026-03-26')).toBe('Mar 26');
    expect(weekdayOf('2026-03-26')).toBe('Thursday');
    expect(longDate('2026-03-26')).toBe('Mar 26, 2026');
  });
});
