// Primitives and the frequency helpers (MX-06, V-07-23).
import { describe, expect, it } from 'vitest';
import {
  impliedMax,
  looserThan,
  periodLabel,
  strictestCap,
  UNIT_MINUTES,
  windowMin,
  type ResolvedCap,
} from '@/lib/validation/constants/frequency';
import { primitives } from '@/lib/validation';
import { resolveCap } from '@/lib/validation/rules/shared';

describe('numbers and text', () => {
  it('reads form values', () => {
    expect(primitives.toNum('12.5')).toBe(12.5);
    expect(primitives.toNum(' 3 ')).toBe(3);
    expect(primitives.toNum('')).toBeNull();
    expect(primitives.toNum('abc')).toBeNull();
    expect(primitives.toNum(null)).toBeNull();
    expect(primitives.toNum(0)).toBe(0);
    expect(primitives.isEmptyNum(0)).toBe(false);
    expect(primitives.isEmptyNum('  ')).toBe(true);
  });

  it('knows positive, larger, whole, percent and non-negative', () => {
    expect(primitives.positive(0.01)).toBe(true);
    expect(primitives.positive(0)).toBe(false);
    expect(primitives.larger(1, 0)).toBe(true);
    expect(primitives.larger(0, 0)).toBe(false);
    expect(primitives.isWhole('4')).toBe(true);
    expect(primitives.isWhole(4.5)).toBe(false);
    expect(primitives.pct(100)).toBe(true);
    expect(primitives.pct(-1)).toBe(false);
    expect(primitives.nonNegative(0)).toBe(true);
    expect(primitives.nonNegative(-0.1)).toBe(false);
  });

  it('counts code points and bytes', () => {
    expect(primitives.codePointLength('a😀b')).toBe(3);
    expect(primitives.byteLength('é')).toBe(2);
    expect(primitives.maxLen('abc', 3)).toBe(true);
    expect(primitives.maxLen('abcd', 3)).toBe(false);
    expect(primitives.maxLen(null, 3)).toBe(true);
  });

  it('checks urls', () => {
    expect(primitives.isUrl('https://a.example/x?y=1#z')).toBe(true);
    expect(primitives.isUrl('http://a.example')).toBe(true);
    expect(primitives.isUrl('ftp://a.example')).toBe(false);
    expect(primitives.isUrl('https://')).toBe(false);
    expect(primitives.isUrl('example.com')).toBe(false);
    expect(primitives.isUrl('https://a.example/ b')).toBe(false);
    expect(primitives.isUrl('https://a.example/abc', 10)).toBe(false);
  });
});

describe('dates', () => {
  it('validates ISO dates', () => {
    expect(primitives.isIsoDate('2026-02-28')).toBe(true);
    expect(primitives.isIsoDate('2026-02-30')).toBe(false);
    expect(primitives.isIsoDate('26-02-28')).toBe(false);
    expect(primitives.isIsoDate(null)).toBe(false);
  });

  it('compares ranges and overlaps inclusively', () => {
    expect(primitives.dateRange('2026-10-01', '2026-10-01')).toBe(true);
    expect(primitives.dateRange('2026-10-02', '2026-10-01')).toBe(false);
    expect(primitives.dateRange(null, '2026-10-01')).toBe(true);
    expect(
      primitives.rangesOverlap(
        { start: '2026-10-01', end: '2026-10-10' },
        { start: '2026-10-10', end: '2026-10-20' },
      ),
    ).toBe(true);
    expect(
      primitives.rangesOverlap(
        { start: '2026-10-01', end: '2026-10-09' },
        { start: '2026-10-10', end: '2026-10-20' },
      ),
    ).toBe(false);
  });

  it('turns an instant into the date in a time zone', () => {
    const instant = new Date('2026-10-27T20:00:00Z');
    expect(primitives.todayIn(instant, 'Asia/Kolkata')).toBe('2026-10-28');
    expect(primitives.todayIn(instant, 'America/Los_Angeles')).toBe('2026-10-27');
    expect(primitives.todayIn(instant, 'UTC')).toBe('2026-10-27');
  });
});

describe('frequency caps (MX-06)', () => {
  const cap = (n: number, period: ResolvedCap['period'], periodCount = 1): ResolvedCap => ({
    n,
    periodCount,
    period,
  });

  it('has the unit table of the document', () => {
    expect(UNIT_MINUTES).toEqual({ MINUTE: 1, HOUR: 60, DAY: 1440, WEEK: 10080, MONTH: 43200 });
    expect(windowMin(cap(1, 'WEEK', 2))).toBe(20160);
  });

  it('V-07-23 campaign 3 per week makes 10 per day redundant', () => {
    expect(impliedMax(cap(3, 'WEEK'), windowMin(cap(10, 'DAY')))).toBe(3);
    expect(looserThan(cap(10, 'DAY'), cap(3, 'WEEK'))).toBe(true);
  });

  it('campaign 3 per week keeps 10 per month meaningful', () => {
    expect(impliedMax(cap(3, 'WEEK'), windowMin(cap(10, 'MONTH')))).toBe(15);
    expect(looserThan(cap(10, 'MONTH'), cap(3, 'WEEK'))).toBe(false);
  });

  it('an identical cap is redundant', () => {
    expect(looserThan(cap(5, 'DAY'), cap(5, 'DAY'))).toBe(true);
    expect(looserThan(cap(4, 'DAY'), cap(5, 'DAY'))).toBe(false);
  });

  it('picks the strictest cap and labels periods', () => {
    expect(strictestCap([cap(10, 'DAY'), cap(3, 'WEEK')])).toEqual(cap(3, 'WEEK'));
    expect(strictestCap([])).toBeNull();
    expect(periodLabel(cap(3, 'WEEK'))).toBe('week');
    expect(periodLabel(cap(3, 'DAY', 2))).toBe('2 days');
  });

  it('only a limit with valid numbers resolves', () => {
    expect(resolveCap({ mode: 'UNLIMITED' })).toBeNull();
    expect(resolveCap({ mode: 'INHERIT' })).toBeNull();
    expect(
      resolveCap({ mode: 'LIMITED', maxImpressions: '', periodCount: 1, period: 'DAY' }),
    ).toBeNull();
    expect(
      resolveCap({ mode: 'LIMITED', maxImpressions: 0, periodCount: 1, period: 'DAY' }),
    ).toBeNull();
    expect(
      resolveCap({ mode: 'LIMITED', maxImpressions: 2, periodCount: 1, period: 'YEAR' as never }),
    ).toBeNull();
    expect(
      resolveCap({ mode: 'LIMITED', maxImpressions: '2', periodCount: '3', period: 'HOUR' }),
    ).toEqual({ n: 2, periodCount: 3, period: 'HOUR' });
  });
});
