// A/B report maths (engine 6.7, acceptance 7): z tests on known numbers, confidence flip, best with three arms.
import { describe, expect, it } from 'vitest';
import {
  buildTiles,
  confidencePct,
  costZ,
  countZ,
  normalCdf,
  proportionZ,
  twoSidedP,
  Z_CRITICAL,
  type ArmCounters,
  type ArmInput,
} from '@/lib/experiments/stats';
import { engineParams } from './helpers';

const counters = (over: Partial<ArmCounters> = {}): ArmCounters => ({
  impressions: 100_000,
  clicks: 1_000,
  conversions: 100,
  engagements: 0,
  videoStarts: 0,
  videoCompletions: 0,
  videoViews: 0,
  audibleVisibleComplete: 0,
  customImpressionValue: 0,
  reached: 40_000,
  cost: 1_000,
  revenue: 1_200,
  split: 0.5,
  ...over,
});
const arm = (armId: string, isControl: boolean, over: Partial<ArmCounters> = {}): ArmInput => ({
  armId,
  name: armId.toUpperCase(),
  isControl,
  counters: counters(over),
});

describe('critical values come from the engine parameters', () => {
  it('matches engine/params.json', () => {
    const z = engineParams().experiments.zCritical;
    expect(Z_CRITICAL.P90).toBe(z['0.90']);
    expect(Z_CRITICAL.P95).toBe(z['0.95']);
    expect(confidencePct('P95')).toBe(95);
  });
});

describe('z statistics', () => {
  it('normal cdf and p', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(twoSidedP(1.96)).toBeCloseTo(0.05, 3);
  });
  it('two proportions: 2.0% against 1.0% of 10,000 is z of about 5.8', () => {
    const z = proportionZ(200, 10_000, 100, 10_000) as number;
    expect(z).toBeCloseTo(5.77, 1);
    expect(proportionZ(100, 10_000, 100, 10_000)).toBe(0);
    expect(proportionZ(1, 0, 1, 10)).toBeNull();
  });
  it('cost per click by the delta method', () => {
    const z = costZ(1.0, 400, 50_000, 1.2, 400, 50_000) as number;
    expect(z).toBeLessThan(0);
    expect(Math.abs(z)).toBeGreaterThan(1.645);
    expect(costZ(1, 0, 10, 1, 10, 10)).toBeNull();
  });
  it('counts per unit of split', () => {
    expect(countZ(1000, 0.5, 1000, 0.5)).toBe(0);
    expect((countZ(1200, 0.5, 1000, 0.5) as number) > 3).toBe(true);
  });
});

describe('tiles and Best', () => {
  it('N/A when no arm is significantly different from the control', () => {
    const r = buildTiles('CLICKS', [arm('a', true), arm('b', false, { clicks: 1_010 })], 'P90', 'INR');
    expect(r.best).toBe('N/A');
    expect(r.tiles.find((t) => t.key === 'ctr')?.best).toBe('N/A');
    expect(r.significance.b?.significant).toBe(false);
  });
  it('names an arm when |z| exceeds the critical value', () => {
    const r = buildTiles('CLICKS', [arm('a', true), arm('b', false, { clicks: 1_400 })], 'P90', 'INR');
    expect(r.best).toEqual({ armId: 'b', name: 'B' });
    expect(r.significance.b?.significant).toBe(true);
    const ctr = r.tiles.find((t) => t.key === 'ctr');
    expect(ctr?.arms.find((x) => x.armId === 'b')?.diffPct).toBeCloseTo(40, 6);
    expect(ctr?.arms.find((x) => x.armId === 'a')?.diffPct).toBeNull();
  });
  it('changing 90% to 95% can flip the result (fixture)', () => {
    // 1,000 against 1,082 clicks of 100,000: z is between 1.645 and 1.96
    const arms = [arm('a', true), arm('b', false, { clicks: 1_082 })];
    const z = proportionZ(1_082, 100_000, 1_000, 100_000) as number;
    expect(z).toBeGreaterThan(Z_CRITICAL.P90);
    expect(z).toBeLessThan(Z_CRITICAL.P95);
    expect(buildTiles('CLICKS', arms, 'P90', 'INR').best).toEqual({ armId: 'b', name: 'B' });
    expect(buildTiles('CLICKS', arms, 'P95', 'INR').best).toBe('N/A');
  });
  it('three arms: the best of the control and the significant arms wins', () => {
    const arms = [arm('a', true), arm('b', false, { clicks: 1_400 }), arm('c', false, { clicks: 1_800 })];
    expect(buildTiles('CLICKS', arms, 'P90', 'INR').best).toEqual({ armId: 'c', name: 'C' });
  });
  it('a significantly worse arm leaves the control as the best', () => {
    const arms = [arm('a', true), arm('b', false, { clicks: 600 })];
    expect(buildTiles('CLICKS', arms, 'P90', 'INR').best).toEqual({ armId: 'a', name: 'A' });
  });
  it('cost tiles prefer the lower value', () => {
    const arms = [arm('a', true, { revenue: 1_200 }), arm('b', false, { revenue: 600 })];
    const cpc = buildTiles('CLICKS', arms, 'P90', 'INR').tiles.find((t) => t.key === 'cpc');
    expect(cpc?.best).toEqual({ armId: 'b', name: 'B' });
  });
  it('empty values stay null and every metric builds tiles', () => {
    const zero = counters({ impressions: 0, clicks: 0, conversions: 0, reached: 0, revenue: 0 });
    const arms = [{ armId: 'a', name: 'A', isControl: true, counters: zero }, { armId: 'b', name: 'B', isControl: false, counters: zero }];
    for (const m of ['IMPRESSIONS', 'CLICKS', 'CONVERSIONS', 'REACH', 'VIDEO_COMPLETIONS', 'AVOC', 'CUSTOM_IMPRESSION_VALUE', 'ENGAGEMENTS', 'VIEWS'] as const) {
      const r = buildTiles(m, arms, 'P90', 'INR');
      expect(r.tiles.length).toBeGreaterThan(0);
      expect(r.best).toBe('N/A');
    }
  });
});
