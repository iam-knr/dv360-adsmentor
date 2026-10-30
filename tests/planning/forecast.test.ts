// forecastPlan (module 04 AC-04-9, AC-04-10, AC-04-28): identities, determinism, monotonic and concave properties.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DEFAULT_DEMOGRAPHICS } from '@/lib/planning/countries';
import { forecastPlan, type ForecastInput } from '@/lib/planning/forecast';

const base = (over: Partial<ForecastInput> = {}): ForecastInput => ({
  seed: 'seed-a',
  planId: 'plan-1',
  country: 'SG',
  currency: 'SGD',
  demographics: DEFAULT_DEMOGRAPHICS,
  reachBasis: 'CENSUS',
  includeYoutube: true,
  startDate: '2026-03-01',
  endDate: '2026-03-31',
  asOf: '2026-01-01T00:00:00.000Z',
  rows: [
    { key: 'a', name: 'A', buyingMethod: 'OPEN_AUCTION', budgetNet: 20_000 },
    { key: 'b', name: 'B', buyingMethod: 'PREFERRED_DEAL', budgetNet: 15_000 },
  ],
  ...over,
});

describe('forecastPlan identities', () => {
  const f = forecastPlan(base());
  it('TRPs equal reach percent times average frequency (AC-04-9)', () => {
    expect(Math.abs(f.trps - f.reachPct * f.avgFrequency)).toBeLessThanOrEqual(f.trps * 0.01);
  });
  it('CPP equals budget over TRPs', () => {
    expect(Math.abs(f.cpp - f.budget / f.trps)).toBeLessThanOrEqual(f.cpp * 0.01);
  });
  it('total CPM times impressions equals the budget', () => {
    expect(Math.abs((f.totalCpm * f.impressions) / 1000 - f.budget)).toBeLessThanOrEqual(
      f.budget * 0.005,
    );
  });
  it('has a forecast for every row and the five tabs', () => {
    expect(Object.keys(f.perRow).sort()).toEqual(['a', 'b']);
    expect(Object.keys(f.tabs).sort()).toEqual([
      'CONVERSIONS',
      'DEMOGRAPHICS',
      'DEVICES',
      'REACH',
      'TRUEVIEW',
    ]);
    expect(f.tabs.REACH).toHaveLength(5);
  });
  it('a plan with no rows has a zero forecast', () => {
    const z = forecastPlan(base({ rows: [] }));
    expect(z.reachPct).toBe(0);
    expect(z.trps).toBe(0);
  });
});

describe('forecastPlan determinism (AC-04-10, AC-04-28)', () => {
  it('same inputs and seed give identical output', () => {
    expect(forecastPlan(base())).toEqual(forecastPlan(base()));
  });
  it('a different market seed gives a different forecast', () => {
    expect(forecastPlan(base({ seed: 'seed-b' })).totalCpm).not.toBe(forecastPlan(base()).totalCpm);
  });
  it('Singapore and the United States price differently', () => {
    const us = forecastPlan(base({ country: 'US', currency: 'USD' }));
    const sg = forecastPlan(base());
    expect(us.population.census).not.toBe(sg.population.census);
  });
});

describe('forecastPlan properties', () => {
  const one = (budget: number) =>
    forecastPlan(
      base({ rows: [{ key: 'a', name: 'A', buyingMethod: 'OPEN_AUCTION', budgetNet: budget }] }),
    );

  it('more budget never lowers reach or impressions (monotonic)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 500, max: 200_000 }),
        fc.double({ min: 1.01, max: 3, noNaN: true }),
        (b, m) => {
          const lo = one(b);
          const hi = one(b * m);
          expect(hi.reach).toBeGreaterThanOrEqual(lo.reach);
          expect(hi.impressions).toBeGreaterThanOrEqual(lo.impressions);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('doubling the budget never more than doubles the reach (concave)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 500, max: 200_000 }), (b) => {
        expect(one(b * 2).reach).toBeLessThanOrEqual(one(b).reach * 2 + 1);
      }),
      { numRuns: 200 },
    );
  });
});
