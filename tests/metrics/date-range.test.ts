import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  formatIsoDate,
  parseIsoDate,
  resolvePreset,
  type DatePresetId,
} from '@/components/dv/date-presets';
import {
  DateRangeParamError,
  eachDayIso,
  parseDateRangeParam,
  resolveToken,
  simDateIn,
  TOKEN_TO_PRESET,
  type PresetToken,
} from '@/lib/metrics/date-range';

const isoDay = fc
  .date({
    min: new Date('2001-01-01T00:00:00Z'),
    max: new Date('2035-12-31T00:00:00Z'),
    noInvalidDate: true,
  })
  .map((d) => d.toISOString().slice(0, 10));

describe('d param (routes.md 6.1)', () => {
  it('defaults to YESTERDAY against the sim today', () => {
    expect(parseDateRangeParam(null, '2026-10-29')).toEqual({
      from: '2026-10-28',
      to: '2026-10-28',
    });
    expect(parseDateRangeParam('', '2026-03-01')).toEqual({ from: '2026-02-28', to: '2026-02-28' });
  });

  it('parses explicit ranges and rejects bad ones', () => {
    expect(parseDateRangeParam('20261001:20261015', '2026-10-29')).toEqual({
      from: '2026-10-01',
      to: '2026-10-15',
    });
    for (const bad of [
      '20261015:20261001',
      '20260230:20260301',
      'NEXT_WEEK',
      '2026-10-01',
      '0D_X',
    ]) {
      expect(() => parseDateRangeParam(bad, '2026-10-29')).toThrow(DateRangeParamError);
    }
  });

  it('parses {n}D_TODAY and {n}D_YESTERDAY', () => {
    expect(parseDateRangeParam('90D_TODAY', '2026-10-29')).toEqual({
      from: '2026-08-01',
      to: '2026-10-29',
    });
    expect(parseDateRangeParam('7d_yesterday', '2026-10-29')).toEqual({
      from: '2026-10-22',
      to: '2026-10-28',
    });
  });

  it('resolves every preset token to the same days as DvDateRange resolvePreset', () => {
    fc.assert(
      fc.property(
        isoDay,
        fc.constantFrom(...(Object.keys(TOKEN_TO_PRESET) as PresetToken[])),
        (today, token) => {
          const ours = resolveToken(token, today);
          const theirs = resolvePreset(
            TOKEN_TO_PRESET[token] as DatePresetId,
            parseIsoDate(today) as Date,
          );
          expect(ours).toEqual({
            from: formatIsoDate(theirs.start),
            to: formatIsoDate(theirs.end),
          });
        },
      ),
      { numRuns: 400 },
    );
  });

  it('lists the days of a range', () => {
    expect(eachDayIso({ from: '2026-02-27', to: '2026-03-02' })).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
    ]);
  });
});

describe('sim today in the advertiser time zone (RT R9)', () => {
  it('IST is a day ahead of UTC after 18:30 UTC', () => {
    const simNow = new Date('2026-01-01T19:00:00Z');
    expect(simDateIn(simNow, 'UTC')).toBe('2026-01-01');
    expect(simDateIn(simNow, 'Asia/Calcutta')).toBe('2026-01-02');
    expect(simDateIn(new Date('2026-01-01T18:29:00Z'), 'Asia/Calcutta')).toBe('2026-01-01');
  });

  it('YESTERDAY differs between an IST and a UTC advertiser at the same instant', () => {
    const simNow = new Date('2026-01-01T20:00:00Z');
    expect(parseDateRangeParam('YESTERDAY', simDateIn(simNow, 'Asia/Calcutta')).from).toBe(
      '2026-01-01',
    );
    expect(parseDateRangeParam('YESTERDAY', simDateIn(simNow, 'UTC')).from).toBe('2025-12-31');
  });
});
