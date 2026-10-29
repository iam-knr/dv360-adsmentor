import { describe, expect, it } from 'vitest';
import { fxRate, FxRateMissingError, type FxTable } from '@/lib/metrics/fx';
import { parseMetricsQuery } from '@/lib/metrics/request';

describe('fxRate', () => {
  const table: FxTable = new Map([
    ['SGD>INR', 62],
    ['USD>INR', 83],
    ['EUR>USD', 1.1],
  ]);
  it('direct, inverse, cross via USD, identity', () => {
    expect(fxRate(table, 'SGD', 'INR')).toBe(62);
    expect(fxRate(table, 'INR', 'SGD')).toBeCloseTo(1 / 62);
    expect(fxRate(table, 'EUR', 'INR')).toBeCloseTo(1.1 * 83);
    expect(fxRate(table, 'JPY', 'JPY')).toBe(1);
  });
  it('throws when no path exists', () => {
    expect(() => fxRate(table, 'JPY', 'INR')).toThrow(FxRateMissingError);
  });
});

describe('parseMetricsQuery', () => {
  const q = (s: string) => parseMetricsQuery(new URLSearchParams(s));
  it('parses level, ids, d, currency, cards', () => {
    const r = q('level=io&ids=a,b,a&ids=c&d=LAST_7_DAYS&currency=sgd&cards=totalCost');
    expect(r).toEqual({
      ok: true,
      query: {
        level: 'io',
        ids: ['a', 'b', 'c'],
        d: 'LAST_7_DAYS',
        currency: 'SGD',
        cards: ['totalCost'],
      },
    });
  });
  it('rejects bad input', () => {
    expect(q('level=partner&ids=a')).toMatchObject({ ok: false, code: 'BAD_LEVEL' });
    expect(q('level=li&currency=rupee')).toMatchObject({ ok: false, code: 'BAD_CURRENCY' });
    expect(q('level=li&cards=pie')).toMatchObject({ ok: false, code: 'BAD_CARD' });
    const many = Array.from({ length: 1001 }, (_, i) => `x${i}`).join(',');
    expect(q(`level=li&ids=${many}`)).toMatchObject({ ok: false, code: 'TOO_MANY_IDS' });
  });
});
