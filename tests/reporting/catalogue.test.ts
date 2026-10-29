// Module 16 6.3 catalogue.test.ts
import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  CATEGORY_COUNTS,
  ENTITY_PATHS,
  FIELDS,
  FIELD_BY_KEY,
  PLANNED_COUNTS,
  SEEN_COUNTS,
  assertCatalogue,
  sourceRefs,
} from '@/lib/reporting/catalogue';

describe('report field catalogue', () => {
  it('is coherent (unique keys, resolvable references, planned and seen counts)', () => {
    expect(() => assertCatalogue()).not.toThrow();
  });

  it('has 34 categories and about 830 fields', () => {
    expect(CATEGORIES).toHaveLength(34);
    expect(FIELDS.length).toBeGreaterThanOrEqual(800);
    expect(FIELDS.length).toBeLessThanOrEqual(900);
  });

  it('meets the counts seen in the demo picker', () => {
    for (const [category, n] of Object.entries(SEEN_COUNTS)) {
      expect(
        CATEGORY_COUNTS[category as keyof typeof CATEGORY_COUNTS],
        category,
      ).toBeGreaterThanOrEqual(n);
    }
  });

  it('matches the planned count of every category', () => {
    for (const c of CATEGORIES) expect(CATEGORY_COUNTS[c], c).toBe(PLANNED_COUNTS[c]);
  });

  it('keeps every key unique and snake case', () => {
    const keys = FIELDS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k).toMatch(/^[a-z0-9]+(_[a-z0-9]+)*$/);
  });

  it('points every RATIO, DIFF and SUM_OF at an existing field', () => {
    for (const f of FIELDS)
      for (const r of sourceRefs(f)) expect(FIELD_BY_KEY.has(r), `${f.key} -> ${r}`).toBe(true);
  });

  it('uses only entity paths the resolver knows', () => {
    for (const f of FIELDS) {
      if (f.source.t === 'ENTITY')
        expect(ENTITY_PATHS as readonly string[]).toContain(f.source.path);
    }
  });

  it('keeps money in complete currency triplets', () => {
    const bases = new Map<string, Set<string>>();
    for (const f of FIELDS) {
      const m = /^(.*)_(adv|partner|usd)$/.exec(f.key);
      if (!m || f.dataType !== 'MONEY') continue;
      const set = bases.get(m[1] as string) ?? new Set<string>();
      set.add(m[2] as string);
      bases.set(m[1] as string, set);
    }
    expect(bases.size).toBeGreaterThan(100);
    for (const [base, set] of bases)
      expect([...set].sort(), base).toEqual(['adv', 'partner', 'usd']);
  });

  it('labels money fields with the currency', () => {
    expect(FIELD_BY_KEY.get('revenue_adv')?.label).toBe('Revenue (Advertiser Currency)');
    expect(FIELD_BY_KEY.get('revenue_partner')?.label).toBe('Revenue (Partner Currency)');
    expect(FIELD_BY_KEY.get('revenue_usd')?.label).toBe('Revenue (USD)');
  });

  it('flags fees, profit and partner-currency money as PARTNER_COST', () => {
    for (const f of FIELDS) {
      if (f.category === 'Fees' || f.category === 'Profit' || f.currency === 'PARTNER') {
        expect(f.sensitivity, f.key).toBe('PARTNER_COST');
      }
    }
    expect(FIELD_BY_KEY.get('revenue_adv')?.sensitivity).toBeUndefined();
  });

  it('lists the six frequently used fields of the demo', () => {
    const fav = FIELDS.filter((f) => f.frequentlyUsed)
      .map((f) => f.label)
      .sort();
    expect(fav).toEqual(
      [
        'Advertiser',
        'Advertiser Currency',
        'Clicks',
        'Impressions',
        'Insertion Order',
        'Revenue (Advertiser Currency)',
      ].sort(),
    );
  });

  it('marks reach metrics, including ratios over them, with the REACH group', () => {
    expect(FIELD_BY_KEY.get('impression_reach')?.compat).toContain('REACH');
    expect(FIELD_BY_KEY.get('cost_per_unique_impression_reach_adv')?.compat).toContain('REACH');
    expect(FIELD_BY_KEY.get('impressions')?.compat).toBeUndefined();
  });

  it('keeps the Date category and its hourly fields', () => {
    expect(FIELD_BY_KEY.get('hour')?.compat).toContain('HOURLY');
    expect(FIELD_BY_KEY.get('date_and_hour')?.compat).toContain('HOURLY');
  });

  it('gives each offline type some fields and keeps availability fields offline only', () => {
    expect(FIELDS.filter((f) => f.offline?.includes('FLOODLIGHT')).length).toBeGreaterThan(10);
    const avail = FIELDS.filter((f) => f.offline?.includes('INVENTORY_AVAILABILITY'));
    expect(avail.length).toBeGreaterThan(5);
    expect(FIELD_BY_KEY.get('available_impressions')?.offlineOnly).toBe(true);
  });

  it('only ZERO and NA fields use CONST sources', () => {
    for (const f of FIELDS) {
      if (f.source.t === 'CONST') expect(f.status, f.key).not.toBe('LIVE');
    }
  });
});
