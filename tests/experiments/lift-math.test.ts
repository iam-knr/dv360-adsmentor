// Lift maths and eligibility (engine 6.8, acceptance 12, 13, 15): requirement, definitions, intervals, slices.
import { describe, expect, it } from 'vitest';
import { BRAND_WINDOW_DAYS, ENHANCED_FACTOR, LS_MIN_SLICE_RESPONSES, SEARCH_WINDOW_DAYS, SEARCH_BASE_INR } from '@/lib/experiments/constants';
import {
  binomialDraw,
  brandRequirementInr,
  enoughResponses,
  fixedSlices,
  freqShape,
  liftRequirement,
  measureOf,
  nPerArm,
  pctComplete,
  relLift,
  searchUplift,
  simulateSurvey,
  windowDays,
} from '@/lib/experiments/lift-math';
import { engineParams } from './helpers';

const params = engineParams().lift;

describe('requirement (Δ17-15)', () => {
  it('standard brand lift is about 470,000 INR from the power formula', () => {
    expect(nPerArm(0.3, 0.02)).toBeGreaterThan(6_400);
    expect(nPerArm(0.3, 0.02)).toBeLessThan(6_600);
    expect(brandRequirementInr(params)).toBe(470_000);
  });
  it('enhanced triples it, a currency multiplier applies, search lift has its own base', () => {
    expect(liftRequirement('BRAND_LIFT', 'STANDARD', params, 1)).toBe(470_000);
    expect(liftRequirement('BRAND_LIFT', 'ENHANCED', params, 1)).toBe(470_000 * ENHANCED_FACTOR);
    expect(liftRequirement('BRAND_LIFT', 'STANDARD', params, 0.0165)).toBeCloseTo(7_755, 0);
    expect(liftRequirement('SEARCH_LIFT', 'STANDARD', params, 1)).toBe(SEARCH_BASE_INR);
  });
  it('windows: about 10 days for brand lift, 4 weeks for search lift', () => {
    expect(windowDays('BRAND_LIFT')).toBe(BRAND_WINDOW_DAYS);
    expect(windowDays('SEARCH_LIFT')).toBe(SEARCH_WINDOW_DAYS);
  });
  it('percent complete is capped at 100', () => {
    expect(pctComplete(0, 470_000)).toBe(0);
    expect(pctComplete(188_000, 470_000)).toBe(40);
    expect(pctComplete(900_000, 470_000)).toBe(100);
    expect(pctComplete(10, 0)).toBe(0);
  });
});

const exposure = { reach: 900_000, avgFrequency: 3, quality: 1 };

describe('survey simulation', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    const a = simulateSurvey({ metric: 'AWARENESS', params, exposure, responsesPerArm: 6_000, sliceMult: 1, seed: 's1' });
    const b = simulateSurvey({ metric: 'AWARENESS', params, exposure, responsesPerArm: 6_000, sliceMult: 1, seed: 's1' });
    const c = simulateSurvey({ metric: 'AWARENESS', params, exposure, responsesPerArm: 6_000, sliceMult: 1, seed: 's2' });
    expect(a).toEqual(b);
    expect(c.exposedRate).not.toBe(a.exposedRate);
  });
  it('absolute, relative and headroom definitions', () => {
    const r = simulateSurvey({ metric: 'AWARENESS', params, exposure, responsesPerArm: 6_000, sliceMult: 1, seed: 'x' });
    expect(r.absoluteLift).toBeCloseTo(r.exposedRate - r.baselineRate, 10);
    expect(r.relativeLift).toBeCloseTo(r.absoluteLift / r.baselineRate, 10);
    expect(r.headroomLift).toBeCloseTo(r.absoluteLift / (1 - r.baselineRate), 10);
    expect(r.responses).toBe(12_000);
    expect(r.ci[0]).toBeLessThan(r.absoluteLift);
    expect(r.ci[1]).toBeGreaterThan(r.absoluteLift);
    expect(r.significant).toBe(r.ci[0] > 0 || r.ci[1] < 0);
  });
  it('measureOf scales the interval with the point estimate', () => {
    const r = { absoluteLift: 0.02, relativeLift: 0.1, headroomLift: 0.03, baselineRate: 0.2, ci: [0.01, 0.03] as [number, number] };
    expect(measureOf(r, 'ABSOLUTE')).toEqual({ value: 0.02, ci: [0.01, 0.03] });
    expect(measureOf(r, 'RELATIVE').ci[0]).toBeCloseTo(0.05, 10);
    expect(measureOf(r, 'HEADROOM').ci[1]).toBeCloseTo(0.0375, 10);
  });
  it('lift saturates with reach and wears out above three exposures', () => {
    const lift = (reach: number, f = 3) => relLift('AWARENESS', params, { reach, avgFrequency: f, quality: 1 });
    expect(lift(0)).toBe(0);
    expect(lift(300_000)).toBeLessThan(lift(900_000));
    expect(lift(900_000)).toBeLessThan(lift(6_000_000) + 1e-9);
    expect(lift(6_000_000)).toBeLessThanOrEqual(params.maxRelLift.awareness as number);
    expect(freqShape(1)).toBeCloseTo(1 / 3, 6);
    expect(freqShape(7)).toBeLessThan(freqShape(3));
  });
  it('enhanced studies detect smaller lifts than standard on the same data', () => {
    const lift = { metric: 'AWARENESS' as const, params, exposure: { reach: 30_000, avgFrequency: 2, quality: 1 }, sliceMult: 1 };
    let standard = 0;
    let enhanced = 0;
    for (let i = 0; i < 60; i++) {
      if (simulateSurvey({ ...lift, responsesPerArm: 2_000, seed: `d${i}` }).significant) standard++;
      if (simulateSurvey({ ...lift, responsesPerArm: 6_000, seed: `d${i}` }).significant) enhanced++;
    }
    expect(enhanced).toBeGreaterThan(standard);
  });
});

describe('slices and search lift', () => {
  it('fixed slices share responses to one and slices under 100 responses are not enough data', () => {
    for (const s of ['OVERALL', 'AGE', 'GENDER', 'DEVICE', 'PUBLISHER_DOMAIN', 'PUBLISHER_VERTICAL'] as const) {
      const defs = fixedSlices(s) ?? [];
      expect(defs.reduce((a, d) => a + d.share, 0)).toBeCloseTo(1, 6);
    }
    expect(fixedSlices('LINE_ITEM')).toBeNull();
    expect(enoughResponses(LS_MIN_SLICE_RESPONSES - 1)).toBe(false);
    expect(enoughResponses(LS_MIN_SLICE_RESPONSES)).toBe(true);
  });
  it('binomial draws stay inside 0..n', () => {
    for (let i = 0; i < 50; i++) {
      const k = binomialDraw(40, 0.9, `b${i}`);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThanOrEqual(40);
    }
    expect(binomialDraw(0, 0.5, 'z')).toBe(0);
  });
  it('search uplift follows half of the brand lift', () => {
    const u = searchUplift(0.2, 0, 'seed');
    expect(u.relUplift).toBeGreaterThan(0.05);
    expect(u.relUplift).toBeLessThan(0.15);
    expect(searchUplift(0.2, 0, 'seed')).toEqual(u);
    expect(searchUplift(0, 0, 'seed').relUplift).toBeLessThan(0.06);
  });
});
