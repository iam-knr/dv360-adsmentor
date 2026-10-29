import { describe, expect, it } from 'vitest';
import {
  forecastInstantDeal,
  forecastTokenValid,
  issueForecastToken,
  type ForecastInput,
} from '@/lib/inventory/forecast';

const base: ForecastInput = {
  sellerId: 'seller-1',
  sellerImpressions7d: 40_000_000_000,
  floorCpm: 120,
  targeting: { country: ['India'], format: ['Video'] },
  optionCounts: { country: 12, format: 3 },
  seed: 7,
};

describe('instant deal forecast', () => {
  it('is deterministic for the same payload and seed', () => {
    expect(forecastInstantDeal(base)).toEqual(forecastInstantDeal({ ...base }));
  });
  it('orders p10 <= p50 <= p90 and prices from the floor', () => {
    const f = forecastInstantDeal(base);
    expect(f.impressions7d.p10).toBeLessThanOrEqual(f.impressions7d.p50);
    expect(f.impressions7d.p50).toBeLessThanOrEqual(f.impressions7d.p90);
    expect(f.recommendedMinBid).toBe(156);
    expect(f.estimatedMediaCost).toBeCloseTo((f.impressions7d.p50 / 1000) * 156, 1);
  });
  it('narrower targeting lowers p50 (AC 7)', () => {
    const wide = forecastInstantDeal({
      ...base,
      targeting: { country: ['India', 'Singapore', 'UAE'] },
    });
    const narrow = forecastInstantDeal({ ...base, targeting: { country: ['India'] } });
    const narrower = forecastInstantDeal({
      ...base,
      targeting: { country: ['India'], format: ['Video'] },
    });
    expect(narrow.impressions7d.p50).toBeLessThan(wide.impressions7d.p50);
    expect(narrower.impressions7d.p50).toBeLessThan(narrow.impressions7d.p50);
  });
  it('another seed gives another number', () => {
    expect(forecastInstantDeal({ ...base, seed: 8 }).impressions7d.p50).not.toBe(
      forecastInstantDeal(base).impressions7d.p50,
    );
  });
});

describe('forecast token (INV-006)', () => {
  const payload = {
    sellerId: 's',
    name: 'Deal',
    targeting: { a: ['1', '2'] },
    advertiserIds: ['x', 'y'],
  };
  const now = 1_700_000_000_000;
  it('accepts the same payload within 30 minutes', () => {
    const t = issueForecastToken(payload, now);
    expect(forecastTokenValid(t, payload, now + 29 * 60_000)).toBe(true);
    expect(forecastTokenValid(t, { ...payload, advertiserIds: ['y', 'x'] }, now)).toBe(true);
  });
  it('rejects a changed payload, an old token and garbage', () => {
    const t = issueForecastToken(payload, now);
    expect(forecastTokenValid(t, { ...payload, name: 'Other' }, now)).toBe(false);
    expect(forecastTokenValid(t, { ...payload, targeting: { a: ['1'] } }, now)).toBe(false);
    expect(forecastTokenValid(t, payload, now + 31 * 60_000)).toBe(false);
    expect(forecastTokenValid('nope', payload, now)).toBe(false);
    expect(forecastTokenValid(null, payload, now)).toBe(false);
  });
});
