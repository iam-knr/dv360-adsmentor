// Pure size logic of module 14: buckets and lifecycle, combined, lookalike, customer match, estimator, geography.
import { describe, expect, it } from 'vitest';
import { audienceInsights, geoDistribution, SUGGESTED_INDEX } from '@/lib/audiences/analysis';
import {
  AVAILABILITY_HOURS,
  POOL_USERS,
  availabilityFor,
  bucketOf,
  combinedSize,
  customListSize,
  estimateCustomList,
  hoursUntil,
  lookalikeExpansion,
  lookalikeSize,
  matchRate,
  matchResult,
  parseCustomerMatchCsv,
  unionSize,
} from '@/lib/audiences/sizes';

describe('lifecycle', () => {
  const now = new Date('2026-10-28T06:00:00Z');
  it('every type but combined is processing for 4 sim hours', () => {
    for (const t of ['TAG_BASED', 'CUSTOMER_MATCH', 'LOOKALIKE', 'CUSTOM_AFFINITY', 'YOUTUBE_USERS']) {
      const a = availabilityFor(t, now);
      expect(a.status).toBe('PROCESSING');
      expect(a.availableAt.getTime() - now.getTime()).toBe(AVAILABILITY_HOURS * 3_600_000);
    }
  });
  it('combined is active at once', () => {
    const a = availabilityFor('COMBINED', now);
    expect(a.status).toBe('ACTIVE');
    expect(a.availableAt).toEqual(now);
  });
  it('hoursUntil rounds up and is zero when available', () => {
    expect(hoursUntil(new Date(now.getTime() + 1), now)).toBe(1);
    expect(hoursUntil(new Date(now.getTime() + 3.2 * 3_600_000), now)).toBe(4);
    expect(hoursUntil(now, now)).toBe(0);
    expect(hoursUntil(null, now)).toBe(0);
  });
  it.each([
    [0, '< 1K'],
    [999, '< 1K'],
    [1000, '1K-10K'],
    [9999, '1K-10K'],
    [10_000, '10K-100K'],
    [99_999, '10K-100K'],
    [100_000, '100K-1M'],
    [1_000_000, '1M-10M'],
    [10_000_000, '10M+'],
  ])('bucketOf(%s) = %s', (n, b) => expect(bucketOf(n)).toBe(b));
  it('bucketOf takes null and bigint', () => {
    expect(bucketOf(null)).toBe('< 1K');
    expect(bucketOf(5000n)).toBe('1K-10K');
  });
});

describe('combined size', () => {
  it('union grows with every member and never exceeds the pool', () => {
    expect(unionSize([100])).toBe(100);
    expect(unionSize([100, 50])).toBeGreaterThan(100);
    expect(unionSize([100, 50])).toBeLessThan(150);
    expect(unionSize([POOL_USERS, POOL_USERS])).toBe(POOL_USERS);
  });
  it('is order independent', () => {
    expect(unionSize([10, 500, 70])).toBe(unionSize([500, 70, 10]));
    expect(combinedSize([[100], [900]], [50])).toBe(combinedSize([[900], [100]], [50]));
  });
  it('adding to a group never shrinks, intersecting groups narrows, excluding shrinks', () => {
    const base = combinedSize([[100_000]], []);
    expect(combinedSize([[100_000, 20_000]], [])).toBeGreaterThanOrEqual(base);
    expect(combinedSize([[100_000], [80_000]], [])).toBeLessThan(base);
    expect(combinedSize([[100_000]], [40_000])).toBeLessThan(base);
    expect(combinedSize([[100_000]], [999_999_999])).toBeGreaterThanOrEqual(0);
  });
  it('is zero without an include member', () => expect(combinedSize([[]], [5])).toBe(0));
});

describe('lookalike size', () => {
  it('expansion is 4 at the default reach and scales with it', () => {
    expect(lookalikeExpansion(5)).toBe(4);
    expect(lookalikeExpansion(10)).toBe(8);
    expect(lookalikeExpansion(2.5)).toBe(2);
  });
  it('seed total times expansion, capped at 25% of the pool', () => {
    expect(lookalikeSize(10_000, 5)).toBe(40_000);
    expect(lookalikeSize(10_000, 10)).toBe(80_000);
    expect(lookalikeSize(50_000_000, 10)).toBe(POOL_USERS * 0.25);
  });
});

describe('customer match', () => {
  it('match rate is stable for a seed and file, between 38% and 72%', () => {
    const r = matchRate('sb', 'aud', 'h1');
    expect(matchRate('sb', 'aud', 'h1')).toBe(r);
    expect(r).toBeGreaterThanOrEqual(0.38);
    expect(r).toBeLessThanOrEqual(0.72);
    expect(matchRate('sb', 'aud', 'h2')).not.toBe(r);
  });
  it('matched is the floor of rows times the rate', () => {
    expect(matchResult(1000, 0.555)).toEqual({ rows: 1000, matched: 555, matchRatePct: 55.5 });
    expect(matchResult(0, 0.5).matchRatePct).toBe(0);
  });
  it('header detection and row count', () => {
    expect(parseCustomerMatchCsv('email\na\nb\n', 'x.csv')).toMatchObject({ ok: true, rows: 2, identifierColumns: ['email'] });
    expect(parseCustomerMatchCsv('name,Phone\n1,2', 'x.csv').ok).toBe(true);
  });
  it('rejects an empty file, a non-CSV name, a missing identifier and too many rows', () => {
    expect(parseCustomerMatchCsv('', 'x.csv').error).toBe('NO_FILE');
    expect(parseCustomerMatchCsv('email\na', 'x.txt').error).toBe('NOT_CSV');
    expect(parseCustomerMatchCsv('colour\nred', 'x.csv').error).toBe('NO_IDENTIFIER');
    const big = `email\n${'a\n'.repeat(100_001)}`;
    expect(parseCustomerMatchCsv(big, 'x.csv').error).toBe('TOO_MANY_ROWS');
    expect(parseCustomerMatchCsv(`email\n${'a\n'.repeat(100_000)}`, 'x.csv').ok).toBe(true);
  });
});

describe('Impressions Estimator', () => {
  const e = (o: Partial<Parameters<typeof estimateCustomList>[0]> = {}) =>
    estimateCustomList({ interests: [], urls: [], apps: [], keywords: [], ...o });
  it('is unavailable exactly when the list has no entry', () => {
    expect(e()).toEqual({ unavailable: true });
    expect('unavailable' in e({ interests: ['x'] })).toBe(false);
    expect('unavailable' in e({ keywords: ['x'] })).toBe(false);
  });
  it('is deterministic and independent of entry order', () => {
    expect(e({ interests: ['a', 'b'] })).toEqual(e({ interests: ['b', 'a'] }));
  });
  it('stays inside 0.5% to 4% of the pool', () => {
    const r = e({ interests: ['a'] });
    if ('unavailable' in r) throw new Error('unexpected');
    expect(r.display).toBeGreaterThanOrEqual(POOL_USERS * 0.005);
    expect(r.display).toBeLessThanOrEqual(POOL_USERS * 0.04);
  });
  it('created list size is 0.5 to 3% of the pool', () => {
    const n = customListSize('k');
    expect(n).toBeGreaterThanOrEqual(POOL_USERS * 0.005);
    expect(n).toBeLessThanOrEqual(POOL_USERS * 0.03);
  });
});

describe('geographic distribution', () => {
  const seed = { id: '42', name: 'Customers', size: 50_000 };
  it.each(['IN', 'US', 'SG'])('shares sum to 100 for %s and sort by index descending', (country) => {
    const g = geoDistribution(seed, country, '2026-10-28T00:00:00Z');
    expect(Math.round(g.regions.reduce((s, r) => s + r.sharePct, 0) * 10) / 10).toBe(100);
    for (let i = 1; i < g.regions.length; i++) expect(g.regions[i - 1]!.index).toBeGreaterThanOrEqual(g.regions[i]!.index);
  });
  it('is stable for a seed and differs between seeds', () => {
    expect(geoDistribution(seed, 'IN', 't')).toEqual(geoDistribution(seed, 'IN', 't'));
    expect(geoDistribution({ ...seed, id: '43' }, 'IN', 't').regions).not.toEqual(geoDistribution(seed, 'IN', 't').regions);
  });
  it('suggests exactly the regions with an index of 120 or more', () => {
    const g = geoDistribution(seed, 'IN', 't');
    for (const r of g.regions) expect(r.suggested).toBe(r.index >= SUGGESTED_INDEX);
  });
});

describe('audience insights', () => {
  it('has five cards, shares near 100 and is stable', () => {
    const a = audienceInsights('7', 'IN', 1000);
    for (const key of ['age', 'gender', 'device', 'regions', 'interests'] as const) {
      expect(a[key].length).toBeGreaterThan(1);
      const sum = a[key].reduce((s, b) => s + b.sharePct, 0);
      expect(sum).toBeGreaterThan(98);
      expect(sum).toBeLessThan(102);
    }
    expect(audienceInsights('7', 'IN', 1000)).toEqual(a);
  });
});
