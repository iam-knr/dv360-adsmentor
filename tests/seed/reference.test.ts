import { describe, expect, it } from 'vitest';
import {
  APPS,
  EXCHANGES,
  EXCHANGE_BY_CODE,
  FX_PER_USD,
  GOOGLE_AUDIENCES,
  SIM_CLASSES,
  TARGETING_OPTIONS,
  exchangeSimClass,
  referenceVendorNames,
} from '@/lib/seed/reference';
import { assertVendorsAllowed, VENDOR_ALLOW_LIST, VendorNotAllowedError } from '@/lib/seed/vendors';
import { containsRealBrand, assertSyntheticName, brandNames } from '@/lib/seed/names';
import { Rng } from '@/lib/seed/prng';

describe('exchanges (module 02 3.3, RC-029)', () => {
  it('has about 70 rows: 54 enabled, 8 app mediation partners of which 6 are enabled', () => {
    expect(EXCHANGES.length).toBe(71);
    expect(EXCHANGES.filter((e) => e.enabledByDefault)).toHaveLength(54);
    const mediation = EXCHANGES.filter((e) => e.kind === 'APP_MEDIATION_PARTNER');
    expect(mediation).toHaveLength(8);
    expect(mediation.filter((e) => e.enabledByDefault)).toHaveLength(6);
  });

  it('has unique codes and ids', () => {
    expect(new Set(EXCHANGES.map((e) => e.code)).size).toBe(EXCHANGES.length);
    expect(new Set(EXCHANGES.map((e) => e.id)).size).toBe(EXCHANGES.length);
  });

  it('carries the extra id flags of the demo', () => {
    expect(EXCHANGE_BY_CODE.get('google-ad-manager')).toMatchObject({
      needsNetworkId: true,
      enabledByDefault: true,
    });
    expect(EXCHANGE_BY_CODE.get('smartclip')?.needsSeatId).toBe(true);
    expect(EXCHANGE_BY_CODE.get('yieldlab')?.needsSeatId).toBe(true);
  });

  it('gives every row an engine simClass and shares that sum to 1 over the enabled rows of a class', () => {
    const sums = new Map<string, number>();
    for (const e of EXCHANGES) {
      expect(SIM_CLASSES).toContain(e.simClass);
      if (e.enabledByDefault)
        sums.set(e.simClass, (sums.get(e.simClass) ?? 0) + Number(e.simSupplyShare));
    }
    for (const [cls, sum] of sums) expect(sum, cls).toBeCloseTo(1, 6);
    expect(exchangeSimClass('openx')).toBe('openx');
    expect(exchangeSimClass('sovrn')).toBe('long_tail');
  });

  it('has at least one enabled exchange per format the seed uses', () => {
    const enabled = EXCHANGES.filter((e) => e.enabledByDefault);
    expect(enabled.some((e) => e.supportsDisplay)).toBe(true);
    expect(enabled.some((e) => e.supportsVideo)).toBe(true);
    expect(enabled.some((e) => e.supportsAudio)).toBe(true);
    expect(enabled.some((e) => e.supportsCtv)).toBe(true);
    expect(enabled.some((e) => e.supportsDooh)).toBe(true);
  });
});

describe('vendor allow-list (RC-055)', () => {
  it('lists every real name the reference data uses', () => {
    expect(() => assertVendorsAllowed(referenceVendorNames())).not.toThrow();
  });

  it('fails on a name that is not in the list', () => {
    expect(() => assertVendorsAllowed(['Google Ad Manager', 'Acme Exchange Pro'])).toThrow(
      VendorNotAllowedError,
    );
    expect(() => assertVendorsAllowed(['Acme Exchange Pro'])).toThrow(/Acme Exchange Pro/);
  });

  it('honours a custom list', () => {
    const list = {
      ...VENDOR_ALLOW_LIST,
      exchanges: ['Only This'],
      verifiers: [],
      feeVendors: [],
      viewabilityVendors: [],
      brandSafetyVendors: [],
      adServers: [],
      extraNames: [],
    };
    expect(() => assertVendorsAllowed(['Only This'], list)).not.toThrow();
    expect(() => assertVendorsAllowed(['Adform'], list)).toThrow(VendorNotAllowedError);
  });
});

describe('synthetic names (data-model 3.3)', () => {
  it('rejects real brands and builds fictional ones', () => {
    expect(containsRealBrand('Nike Running Club')).toBe(true);
    expect(containsRealBrand('Northwind Outfitters')).toBe(false);
    expect(() => assertSyntheticName('Amazon Basics')).toThrow(/real brand/);
    const names = brandNames(new Rng(1), 4);
    expect(new Set(names).size).toBe(4);
    for (const n of names) expect(containsRealBrand(n)).toBe(false);
  });

  it('is deterministic per seed', () => {
    expect(brandNames(new Rng(9), 3)).toEqual(brandNames(new Rng(9), 3));
    expect(brandNames(new Rng(9), 3)).not.toEqual(brandNames(new Rng(10), 3));
  });
});

describe('targeting catalogue (module 10 3.4, reduced)', () => {
  const by = (d: string) => TARGETING_OPTIONS.filter((o) => o.dimension === d);

  it('has unique (dimension, code) keys and ids, and parents that exist before their children', () => {
    expect(new Set(TARGETING_OPTIONS.map((o) => `${o.dimension}:${o.code}`)).size).toBe(
      TARGETING_OPTIONS.length,
    );
    expect(new Set(TARGETING_OPTIONS.map((o) => o.id)).size).toBe(TARGETING_OPTIONS.length);
    const seen = new Set<string>();
    for (const o of TARGETING_OPTIONS) {
      if (o.parentId) expect(seen.has(o.parentId), `${o.dimension}:${o.code}`).toBe(true);
      seen.add(o.id);
    }
  });

  it('has the catalogue sizes the task asks for', () => {
    expect(by('LANGUAGE')).toHaveLength(30);
    expect(by('CATEGORY').filter((o) => o.parentId === null)).toHaveLength(26);
    expect(Math.max(...by('CATEGORY').map((o) => o.code.split('.').length))).toBe(3);
    expect(by('DEVICE_TYPE')).toHaveLength(4);
    expect(by('OPERATING_SYSTEM')).toHaveLength(12);
    expect(by('CONNECTION_SPEED')).toHaveLength(8);
    expect(by('CARRIER_ISP').length).toBeGreaterThanOrEqual(30);
    expect(by('DOOH_VENUE')).toHaveLength(25);
    expect(
      by('GEOGRAPHY').filter((o) => (o.meta as { kind?: string } | null)?.kind === 'COUNTRY')
        .length,
    ).toBeGreaterThanOrEqual(30);
    expect(
      by('GEOGRAPHY').filter((o) => (o.meta as { kind?: string } | null)?.kind === 'CITY').length,
    ).toBeGreaterThanOrEqual(50);
    expect(by('THIRD_PARTY_VERIFIER').map((o) => o.name)).toContain('DoubleVerify');
    expect(by('INVENTORY_SOURCE')).toHaveLength(EXCHANGES.length);
  });

  it('holds Indian states under India and cities under their state', () => {
    const india = TARGETING_OPTIONS.find((o) => o.dimension === 'GEOGRAPHY' && o.code === 'IN');
    const mh = TARGETING_OPTIONS.find((o) => o.dimension === 'GEOGRAPHY' && o.code === 'IN-MH');
    const mumbai = TARGETING_OPTIONS.find(
      (o) => o.dimension === 'GEOGRAPHY' && o.code === 'IN-MH-mumbai',
    );
    expect(mh?.parentId).toBe(india?.id);
    expect(mumbai?.parentId).toBe(mh?.id);
  });
});

describe('other catalogues', () => {
  it('has 130 Google audiences (64 affinity, 51 in-market) including the basketball example', () => {
    expect(GOOGLE_AUDIENCES).toHaveLength(130);
    expect(
      GOOGLE_AUDIENCES.some(
        (a) =>
          a.path.join(' » ') ===
          'Display & Video 360 Audiences » Affinity Categories » Sports & Fitness » Sports Fans » Basketball Fans',
      ),
    ).toBe(true);
    expect(new Set(GOOGLE_AUDIENCES.map((a) => a.id)).size).toBe(130);
  });

  it('has synthetic apps on example domains and invented FX rates', () => {
    expect(APPS.length).toBeGreaterThanOrEqual(20);
    for (const a of APPS) expect(a.id.startsWith('com.example.')).toBe(true);
    expect(FX_PER_USD.INR).toBe(88);
  });
});
