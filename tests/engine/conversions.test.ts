import { describe, expect, it } from 'vitest';
import { Phi } from '@/lib/engine/math';
import {
  creditSplit,
  countConversion,
  incrementalityClass,
  lagBuckets,
  postViewWeight,
  scheduleLags,
  windowHours,
} from '@/lib/engine/outcomes';
import { Rng } from '@/lib/engine/rng/xoshiro';
import { liOf, purchase } from '@/lib/engine/testing/fixtures';
import type { FloodlightActivity } from '@/lib/engine/world';
import { params } from './helpers';

const P = params.params;
const act = (over: Partial<FloodlightActivity> = {}): FloodlightActivity => ({
  ...purchase,
  ...over,
});

describe('lag and window (engine.md 6.4)', () => {
  it('bucket probabilities equal the lognormal CDF at the window edge', () => {
    for (const [kind, hours] of [
      ['click', 720],
      ['view', 24],
      ['click', 168],
    ] as const) {
      const b = lagBuckets(kind, hours, P);
      const total = b.reduce((a, x) => a + x.prob, 0);
      const { medianHours, sigma } = P.outcomes.lag[kind];
      const edge = Phi(
        (Math.log(Math.floor(hours / 24) * 24 || hours) - Math.log(medianHours)) / sigma,
      );
      expect(total).toBeLessThanOrEqual(1);
      expect(total).toBeCloseTo(edge, 6);
    }
  });

  it('never releases a conversion after the window (window rule)', () => {
    const b = lagBuckets('view', 24, P);
    expect(Math.max(...b.map((x) => x.dueOffset))).toBeLessThanOrEqual(24);
    const c = lagBuckets('click', 720, P);
    expect(Math.max(...c.map((x) => x.dueOffset))).toBeLessThanOrEqual(720);
    expect(Math.min(...c.map((x) => x.dueOffset))).toBeGreaterThanOrEqual(1);
  });

  it('drops the share of conversions beyond the window', () => {
    const r = new Rng('lags');
    const kept = scheduleLags(r, 100_000, 'view', 24, P).reduce((a, x) => a + x.n, 0);
    const { medianHours, sigma } = P.outcomes.lag.view;
    const expected = 100_000 * Phi((Math.log(24) - Math.log(medianHours)) / sigma);
    expect(kept / expected).toBeGreaterThan(0.97);
    expect(kept / expected).toBeLessThan(1.03);
    expect(scheduleLags(r, 0, 'click', 720, P)).toEqual([]);
  });

  it('click lags are shorter than view lags', () => {
    const med = (kind: 'click' | 'view') => {
      const b = lagBuckets(kind, 720, P);
      let acc = 0;
      for (const x of b) {
        acc += x.prob;
        if (acc >= 0.25) return x.dueOffset;
      }
      return 999;
    };
    expect(med('click')).toBeLessThan(med('view'));
  });

  it('reads per line item windows in days', () => {
    const li = {
      ...liOf('l', 'display'),
      floodlight: [{ activityId: 'fl-purchase', postClickWindowDays: 7, postViewWindowDays: 2 }],
    };
    expect(windowHours(li, 'fl-purchase', 'click', P)).toBe(168);
    expect(windowHours(li, 'fl-purchase', 'view', P)).toBe(48);
    expect(windowHours(li, 'other', 'click', P)).toBe(720);
    expect(windowHours(li, 'other', 'view', P)).toBe(24);
  });
});

describe('counting methods (engine.md 6.4)', () => {
  it('standard counts every conversion and produces no revenue', () => {
    expect(countConversion(100, act(), P, 1)).toEqual({
      counted: 100,
      transactions: 0,
      items: 0,
      revenue: 0,
    });
  });

  it('unique and per session remove repeats; unique <= per session <= standard', () => {
    const std = countConversion(100, act({ countingMethod: 'standard' }), P, 1).counted;
    const per = countConversion(100, act({ countingMethod: 'perSession' }), P, 1).counted;
    const uni = countConversion(100, act({ countingMethod: 'unique' }), P, 1).counted;
    expect(uni).toBeLessThanOrEqual(per);
    expect(per).toBeLessThanOrEqual(std);
    expect(uni).toBeCloseTo(100 / 1.06, 9); // purchase repeats 0.06 per user day
  });

  it('transactions bill raw * average order value', () => {
    const c = countConversion(
      10,
      act({ countingMethod: 'transactions', avgOrderValue: 2000 }),
      P,
      1,
    );
    expect(c).toEqual({ counted: 10, transactions: 10, items: 0, revenue: 20_000 });
  });

  it('items sold: items = raw * items per transaction, revenue = items * item price', () => {
    const c = countConversion(
      10,
      act({ countingMethod: 'itemsSold', avgOrderValue: 1800, itemsPerTxn: 1.8 }),
      P,
      1,
    );
    expect(c.items).toBeCloseTo(18, 9);
    expect(c.revenue).toBeCloseTo(18_000, 6);
  });

  it('counter activities never produce revenue', () => {
    expect(
      countConversion(10, act({ type: 'counter', countingMethod: 'transactions' }), P, 1).revenue,
    ).toBe(0);
  });

  it('default order value follows the advertiser currency', () => {
    const inUsd = countConversion(1, act({ countingMethod: 'transactions' }), P, 1 / 88);
    expect(inUsd.revenue).toBeCloseTo(1800 / 88, 9);
  });

  it('post-view weight follows the line item conversion counting (6.4)', () => {
    const base = liOf('l', 'display');
    expect(postViewWeight(base)).toBe(1);
    expect(postViewWeight({ ...base, conversionCounting: { mode: 'POST_CLICK_ONLY' } })).toBe(0);
    expect(
      postViewWeight({ ...base, conversionCounting: { mode: 'PERCENTAGE', pct: 40 } }),
    ).toBeCloseTo(0.4, 9);
    expect(postViewWeight({ ...base, conversionCounting: { mode: 'PERCENTAGE', pct: 400 } })).toBe(
      1,
    );
  });
});

describe('attribution credit (engine.md 6.5)', () => {
  const last = (model: Parameters<typeof creditSplit>[0]['attributionModel']) => ({
    ...liOf('last', 'display'),
    attributionModel: model,
  });
  const cands = [
    { liId: 'a', weight: 300, klass: 'prospecting' },
    { liId: 'b', weight: 100, klass: 'remarketing' },
    { liId: 'last', weight: 999, klass: 'prospecting' },
  ];
  const split = (model: Parameters<typeof last>[0]) =>
    creditSplit(last(model), cands, P, 'seed', 5, 'fl-purchase');

  it('last click gives everything to the last touch', () => {
    expect(split('last_click')).toEqual([{ liId: 'last', share: 1 }]);
  });

  it('every model conserves the total credit', () => {
    for (const m of ['linear', 'position_based', 'time_decay', 'data_driven'] as const) {
      const credits = split(m);
      expect(credits.reduce((a, c) => a + c.share, 0)).toBeCloseTo(1, 9);
      expect(credits[0]!.liId).toBe('last');
      expect(credits.length).toBe(3);
      for (const c of credits) expect(c.share).toBeGreaterThanOrEqual(0);
    }
  });

  it('linear splits a multi-touch conversion evenly between last and assists', () => {
    const credits = split('linear');
    const m = P.outcomes.multiTouchShare;
    expect(credits[0]!.share).toBeCloseTo(1 - m + m * 0.5, 9);
    expect(credits[1]!.share).toBeCloseTo(m * 0.5 * 0.75, 9); // a has 300 of 400
  });

  it('assists follow the impression share of the other line items', () => {
    const credits = split('linear');
    expect(credits[1]!.liId).toBe('a');
    expect(credits[1]!.share / credits[2]!.share).toBeCloseTo(3, 9);
  });

  it('time decay gives the last touch more than half and is seeded', () => {
    const a = split('time_decay');
    expect(a[0]!.share).toBeGreaterThan(1 - P.outcomes.multiTouchShare / 2);
    expect(split('time_decay')).toEqual(a);
  });

  it('with no other line item the last touch keeps everything', () => {
    expect(creditSplit(last('linear'), [], P, 's', 1, 'x')).toEqual([{ liId: 'last', share: 1 }]);
  });

  it('classifies incrementality', () => {
    expect(incrementalityClass(liOf('c', 'ctv'))).toBe('ctv');
    expect(incrementalityClass(liOf('y', 'youtube'))).toBe('youtube_reach');
    expect(
      incrementalityClass({
        ...liOf('r', 'display'),
        targeting: { audiences: { includeGroups: [['a']] } },
      }),
    ).toBe('remarketing');
    expect(incrementalityClass(liOf('p', 'display'))).toBe('prospecting');
  });
});
