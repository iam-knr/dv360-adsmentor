import { describe, expect, it } from 'vitest';
import { formatDay, formatModified, formatOfflineRange, formatRange, fromUs, toUs } from '@/lib/reporting/format';

describe('reporting display formats', () => {
  it('prints the last modified time as in DV360 (UTC)', () => {
    expect(formatModified('2026-10-10T02:37:00Z')).toBe('Oct 10, 2026 02:37');
    expect(formatModified('2026-01-05T14:05:59Z')).toBe('Jan 5, 2026 14:05');
  });
  it('prints a date range as Mon D – D, YYYY', () => {
    expect(formatRange('2026-10-25', '2026-10-31')).toBe('Oct 25 – 31, 2026');
    expect(formatRange('2026-10-25', '2026-11-02')).toBe('Oct 25 – Nov 2, 2026');
    expect(formatRange('2026-12-28', '2027-01-03')).toBe('Dec 28, 2026 – Jan 3, 2027');
    expect(formatRange('2026-10-25', '2026-10-25')).toBe('Oct 25, 2026');
  });
  it('prints the offline range and US dates', () => {
    expect(formatDay('2026-10-25')).toBe('Oct 25, 2026');
    expect(formatOfflineRange('Last 7 days', '2026-10-25', '2026-10-31')).toBe('Last 7 days : Oct 25, 2026 - Oct 31, 2026');
    expect(toUs('2026-11-01')).toBe('11/01/2026');
    expect(fromUs('01/30/2027')).toBe('2027-01-30');
    expect(fromUs('1/3/2027')).toBe('2027-01-03');
    expect(fromUs('')).toBe('');
  });
});
