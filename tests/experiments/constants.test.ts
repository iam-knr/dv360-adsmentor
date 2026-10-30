// MX-14 goals per channel scope and the constant lists (Δ17-9).
import { describe, expect, it } from 'vitest';
import {
  AB_GOALS_BY_SCOPE,
  AB_METRICS,
  GOAL_TO_METRIC,
  LIFT_LANGUAGES,
  LIFT_OBJECT_TYPES,
  metricsForScope,
} from '@/lib/experiments/constants';

describe('goals per arm scope (MX-14)', () => {
  it('cross exchange: Clicks, Conversions, Reach, Custom impression value, Video completions', () => {
    expect(AB_GOALS_BY_SCOPE.CROSS_EXCHANGE).toEqual(['CLICKS', 'CONVERSIONS', 'REACH', 'CUSTOM_IMPRESSION_VALUE', 'VIDEO_COMPLETIONS']);
  });
  it('YouTube: Clicks, Conversions, Reach, Views; Demand Gen: Clicks, Conversions, Reach', () => {
    expect(AB_GOALS_BY_SCOPE.YOUTUBE).toEqual(['CLICKS', 'CONVERSIONS', 'REACH', 'VIEWS_YOUTUBE']);
    expect(AB_GOALS_BY_SCOPE.DEMAND_GEN).toEqual(['CLICKS', 'CONVERSIONS', 'REACH']);
  });
  it('mixed scopes keep the standard metrics only', () => {
    expect(AB_GOALS_BY_SCOPE.MIXED).toEqual(['CLICKS', 'CONVERSIONS', 'REACH']);
  });
  it('every goal maps to a report metric offered for its scope', () => {
    for (const [scope, goals] of Object.entries(AB_GOALS_BY_SCOPE)) {
      const keys = metricsForScope(scope as keyof typeof AB_GOALS_BY_SCOPE).map((m) => m.key);
      for (const g of goals) expect(keys).toContain(GOAL_TO_METRIC[g]);
    }
    expect(AB_METRICS.map((m) => m.label)).toContain('Impressions');
  });
});

describe('lift lists', () => {
  it('about 60 object types, 35 languages and an Experimental group with the Indian languages', () => {
    expect(LIFT_OBJECT_TYPES.length).toBeGreaterThanOrEqual(60);
    expect(LIFT_LANGUAGES.filter((l) => !l.experimental)).toHaveLength(35);
    const exp = LIFT_LANGUAGES.filter((l) => l.experimental).map((l) => l.label);
    for (const l of ['Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 'Bangla', 'Urdu']) expect(exp).toContain(l);
    expect(LIFT_LANGUAGES[0]?.label).toBe('English (US)');
  });
});
