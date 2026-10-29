// Planner and compatibility (module 16 4.3, 6.3 planner.test / compat.test).
import { describe, expect, it } from 'vitest';
import { incompatibility, incompatibleWith } from '@/lib/reporting/engine/compat';
import { plan } from '@/lib/reporting/engine/plan';
import type { ReportDefinition } from '@/lib/reporting/types';

const def = (dimensions: string[], metrics = ['impressions']): ReportDefinition => ({
  kind: 'INSTANT',
  name: 'p',
  timeZone: 'ADVERTISER',
  dateRange: 'LAST_7_DAYS',
  filters: [{ field: 'partner', op: 'IN', values: ['1'] }],
  dimensions,
  metrics,
  viz: { type: 'TABLE' },
});

describe('base grain', () => {
  it('entity and calendar dimensions read the totals', () => {
    const p = plan(def(['advertiser', 'insertion_order', 'date']));
    expect(p.kinds).toEqual([]);
    expect(p.approximated).toBe(false);
    expect(p.hourly).toBe(false);
  });
  it('one slice dimension reads that slice', () => {
    expect(plan(def(['device_type'])).kinds).toEqual(['device']);
    expect(plan(def(['advertiser', 'creative'])).kinds).toEqual(['creative']);
  });
  it('a stored pair is exact, other pairs are approximated', () => {
    const exact = plan(def(['exchange', 'device_type']));
    expect(exact.pair).toBe('exchangeDevice');
    expect(exact.approximated).toBe(false);
    const approx = plan(def(['exchange', 'creative']));
    expect(approx.pair).toBeNull();
    expect(approx.approximated).toBe(true);
  });
  it('a derived dimension reads its parent slice', () => {
    expect(plan(def(['app_url'])).kinds).toEqual(['exchange']);
  });
  it('Hour reads the hourly table; reach metrics are flagged', () => {
    expect(plan(def(['hour'])).hourly).toBe(true);
    expect(plan(def(['advertiser'], ['impression_reach'])).reach).toBe(true);
  });
});

describe('compatibility', () => {
  it('reach metrics only combine with the reach-allowed dimensions', () => {
    expect(incompatibility('device_type', ['impression_reach'])).toMatch(/can't be used with/);
    expect(incompatibility('line_item', ['impression_reach'])).toBeNull();
    expect(incompatibility('date', ['impression_reach'])).toBeNull();
  });
  it('the picker map greys out conflicting fields and nothing else', () => {
    const map = incompatibleWith(['impression_reach']);
    expect(map.device_type).toBeDefined();
    expect(map.advertiser).toBeUndefined();
    expect(map.impressions).toBeUndefined();
    expect(incompatibleWith([])).toEqual({});
  });
  it('is symmetric', () => {
    expect(incompatibility('impression_reach', ['device_type'])).not.toBeNull();
  });
});
