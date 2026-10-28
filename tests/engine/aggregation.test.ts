import { describe, expect, it } from 'vitest';
import {
  allocateDerived,
  deriveMetrics,
  reachFromImpressions,
  unionReach,
} from '@/lib/engine/aggregation';
import { emptyMetrics, METRIC_KEYS, type Metrics } from '@/lib/engine/metrics';
import { smallWorld, benchmarkWorld } from '@/lib/engine/testing/fixtures';
import { SLICE_KINDS } from '@/lib/engine/aggregation/dailySlices';
import type { TickOutput } from '@/lib/engine';
import { runTicks } from './helpers';

const world = () =>
  smallWorld({
    world: {
      partner: {
        id: 'p1',
        currency: 'INR',
        enabledExchanges: ['index_exchange', 'google_ad_manager'],
      },
    },
  });

function reconcile(outputs: TickOutput[]) {
  for (const o of outputs) {
    const byLi = new Map<string, Map<string, Metrics>>();
    for (const d of o.daily) {
      let kinds = byLi.get(d.lineItemId);
      if (!kinds) byLi.set(d.lineItemId, (kinds = new Map<string, Metrics>()));
      const agg = kinds.get(d.sliceKind) ?? emptyMetrics();
      for (const k of METRIC_KEYS) agg[k] += d.metrics[k];
      kinds.set(d.sliceKind, agg);
    }
    for (const [, kinds] of byLi) {
      const total = kinds.get('total')!;
      for (const [kind, agg] of kinds) {
        if (kind === 'total' || kind === 'activity') continue;
        for (const k of METRIC_KEYS) {
          const tol = k.startsWith('conv') && k !== 'convRevenue' ? 2e-6 : 0;
          expect(Math.abs(agg[k] - total[k]), `${kind}.${k} tick ${o.tick}`).toBeLessThanOrEqual(
            tol,
          );
        }
      }
    }
  }
}

describe('aggregation (engine.md 9)', () => {
  const { outputs } = runTicks(world(), 0, 30);

  it('writes one hourly row per active line item and a daily total per tick', () => {
    for (const o of outputs) {
      expect(o.hourly.length).toBeLessThanOrEqual(1);
      const totals = o.daily.filter((d) => d.sliceKind === 'total');
      expect(totals.length).toBe(o.hourly.length);
      expect(totals.length ? totals[0]!.metrics : null).toEqual(o.hourly[0]?.metrics ?? null);
    }
    expect(outputs.some((o) => o.hourly.length === 1)).toBe(true);
  });

  it('every slice kind sums to the total row', () => {
    reconcile(outputs);
    const kinds = new Set(outputs.flatMap((o) => o.daily.map((d) => d.sliceKind)));
    for (const k of [
      'total',
      'exchange',
      'device',
      'environment',
      'region',
      'format',
      'hourOfDay',
      'creative',
      'exchangeDevice',
      'regionDevice',
    ]) {
      expect(kinds.has(k), k).toBe(true);
    }
    for (const k of kinds) expect(SLICE_KINDS as readonly string[]).toContain(k);
  });

  it('keeps integer counts and integer money micros, and fractional conversions only in conversion columns', () => {
    for (const o of outputs) {
      for (const d of o.daily) {
        for (const k of METRIC_KEYS) {
          const v = d.metrics[k];
          expect(Number.isFinite(v), k).toBe(true);
          if (
            ![
              'convPostClick',
              'convPostView',
              'convTotal',
              'convTransactions',
              'convItems',
            ].includes(k)
          ) {
            expect(Number.isInteger(v), `${k}=${v}`).toBe(true);
          }
        }
      }
    }
  });

  it('money rows add up: total media cost is the sum of its parts, profit is revenue minus cost', () => {
    for (const o of outputs) {
      for (const d of o.daily) {
        const m = d.metrics;
        expect(
          d.sliceKind === 'creative'
            ? 0
            : m.totalMediaCost -
                (m.mediaCost -
                  m.refund +
                  m.cpmFee1 +
                  m.cpmFee2 +
                  m.mediaFee1 +
                  m.mediaFee2 +
                  m.dataCost +
                  m.verificationCost +
                  m.adServingCost),
        ).toBe(0);
        if (d.sliceKind !== 'creative') expect(m.profit).toBe(m.revenue - m.totalMediaCost);
      }
    }
  });

  it('the day total equals the hourly rows within a day', () => {
    const hourly = outputs.flatMap((o) => o.hourly).filter((h) => h.date === '2026-11-01');
    const daily = outputs
      .flatMap((o) => o.daily)
      .filter((d) => d.date === '2026-11-01' && d.sliceKind === 'total');
    for (const k of ['impressions', 'clicks', 'revenue', 'bidRequests', 'lostTargeting'] as const) {
      expect(daily.reduce((a, d) => a + d.metrics[k], 0)).toBe(
        hourly.reduce((a, h) => a + h.metrics[k], 0),
      );
    }
  });

  it('conversions land in the hour they are released and reconcile across slices', () => {
    const { outputs: long } = runTicks(benchmarkWorld({ formats: ['display'] }), 0, 6);
    reconcile(long);
    const conv = long
      .flatMap((o) => o.daily)
      .filter((d) => d.sliceKind === 'total')
      .reduce((a, d) => a + d.metrics.convTotal, 0);
    expect(conv).toBeGreaterThan(0);
    const byActivity = long
      .flatMap((o) => o.daily)
      .filter((d) => d.sliceKind === 'activity')
      .reduce((a, d) => a + d.metrics.convTotal, 0);
    expect(byActivity).toBeCloseTo(conv, 4);
  });
});

describe('derived dimensions (engine.md 9.3)', () => {
  const parent = emptyMetrics();
  Object.assign(parent, {
    impressions: 1_000_003,
    clicks: 1_501,
    revenue: 98_765_431,
    convTotal: 12.345678,
    profit: -12_345,
  });

  it('allocation sums back to the parent for every metric', () => {
    const shares = { Mumbai: 0.52, Pune: 0.18, Nagpur: 0.08, others: 0.22 };
    const parts = allocateDerived(parent, shares);
    expect(Object.keys(parts).sort()).toEqual(['Mumbai', 'Nagpur', 'Pune', 'others']);
    for (const k of METRIC_KEYS) {
      const sum = Object.values(parts).reduce((a, p) => a + p[k], 0);
      expect(Math.abs(sum - parent[k])).toBeLessThanOrEqual(1e-6);
    }
    expect(parts.Mumbai!.impressions / parent.impressions).toBeCloseTo(0.52, 3);
  });

  it('a value with a zero share gets nothing', () => {
    const parts = allocateDerived(parent, { chrome: 0, safari: 1 });
    expect(parts.chrome!.impressions).toBe(0);
    expect(parts.safari!.impressions).toBe(parent.impressions);
  });
});

describe('derived ratios and reach', () => {
  it('computes ratios on read and returns null for empty denominators', () => {
    const m = emptyMetrics();
    expect(deriveMetrics(m).ctr).toBeNull();
    Object.assign(m, {
      billableImpressions: 10_000,
      clicks: 20,
      totalMediaCost: 1_000_000_000,
      measurableImpressions: 8_000,
      viewableImpressions: 4_000,
      impressions: 10_000,
      bidResponses: 20_000,
      revenue: 1_200_000_000,
      profit: 200_000_000,
    });
    const d = deriveMetrics(m);
    expect(d.ctr).toBeCloseTo(0.002, 9);
    expect(d.ecpm).toBeCloseTo(100_000_000, 0);
    expect(d.viewabilityRate).toBe(0.5);
    expect(d.winRate).toBe(0.5);
    expect(d.profitMargin).toBeCloseTo(1 / 6, 9);
    expect(d.ecpc).toBe(50_000_000);
  });

  it('negative binomial reach never exceeds the pool or the impressions and is monotone', () => {
    let prev = 0;
    for (const i of [1, 10, 1000, 1e5, 1e6, 1e7, 1e9]) {
      const r = reachFromImpressions(i, 1e6);
      expect(r).toBeGreaterThan(0);
      expect(r).toBeLessThanOrEqual(1e6);
      expect(r).toBeLessThanOrEqual(i);
      expect(r).toBeGreaterThanOrEqual(prev);
      prev = r;
    }
    expect(reachFromImpressions(0, 100)).toBe(0);
  });

  it('union reach uses 1.15 times the largest pool and never exceeds it', () => {
    const u = unionReach([
      { reach: 400_000, pool: 1_000_000 },
      { reach: 300_000, pool: 800_000 },
    ]);
    expect(u.pool).toBeCloseTo(1_150_000, 6);
    expect(u.reach).toBeGreaterThan(400_000);
    expect(u.reach).toBeLessThanOrEqual(u.pool);
    expect(unionReach([])).toEqual({ reach: 0, pool: 0 });
  });
});
