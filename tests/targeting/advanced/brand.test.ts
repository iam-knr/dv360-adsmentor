import { describe, expect, it } from 'vitest';
import {
  ABS_KEY,
  BRAND_MESSAGES,
  brandError,
  disabledOptions,
  setProvider,
  toggleOption,
  totalCostText,
} from '@/components/targeting/editors/brand/verification-options';
import { VERIFICATION_OPTIONS, verificationCost } from '@/lib/targeting/verification';

const brand = (provider: 'NONE' | 'DOUBLEVERIFY' | 'IAS' | 'SCOPE3', options: string[]) => ({
  inventoryMode: 'MAXIMUM' as const,
  thirdParty: { provider, options },
});

describe('verification running total (V-10-11, TGT-093)', () => {
  it('ABS + display viewability = 20.95 + 12.38', () => {
    expect(verificationCost('DOUBLEVERIFY', [ABS_KEY, 'display-viewability'])).toBe(33.33);
    expect(totalCostText('DOUBLEVERIFY', [ABS_KEY, 'display-viewability'])).toBe(
      'Total cost: ~₹33.33 CPM',
    );
  });
  it('no provider costs nothing', () => {
    expect(totalCostText('NONE', [])).toBe('Total cost: ~₹0.00 CPM');
  });
  it('is the sum of the selected options for every provider and every subset', () => {
    for (const [provider, opts] of Object.entries(VERIFICATION_OPTIONS)) {
      const keys = opts.map((o) => o.key);
      for (let mask = 0; mask < 1 << keys.length; mask++) {
        const pick = keys.filter((_, i) => mask & (1 << i));
        const expected = opts.filter((o) => pick.includes(o.key)).reduce((s, o) => s + o.cpm, 0);
        expect(verificationCost(provider as 'DOUBLEVERIFY', pick)).toBeCloseTo(expected, 2);
      }
    }
  });
  it('uses the currency symbol it is given', () => {
    expect(totalCostText('SCOPE3', ['brand-standards'], '$')).toBe('Total cost: ~$4.50 CPM');
  });
});

describe('exclusivity (V-10-10, TGT-091)', () => {
  it('ticking ABS clears brand safety and fraud/IVT and disables them', () => {
    const after = toggleOption(
      'DOUBLEVERIFY',
      ['brand-safety', 'fraud-ivt', 'display-viewability'],
      ABS_KEY,
      true,
    );
    expect(after.sort()).toEqual([ABS_KEY, 'display-viewability'].sort());
    expect(disabledOptions('DOUBLEVERIFY', after).sort()).toEqual(['brand-safety', 'fraud-ivt']);
  });
  it('unticking ABS frees them again', () => {
    const after = toggleOption('DOUBLEVERIFY', [ABS_KEY], ABS_KEY, false);
    expect(after).toEqual([]);
    expect(disabledOptions('DOUBLEVERIFY', after)).toEqual([]);
  });
  it('the rule applies to DoubleVerify only', () => {
    expect(disabledOptions('IAS', ['brand-safety'])).toEqual([]);
  });
  it('a saved ABS + brand safety state is TGT-091', () => {
    expect(brandError(brand('DOUBLEVERIFY', [ABS_KEY, 'brand-safety']), undefined)).toBe(
      BRAND_MESSAGES.TGT_091,
    );
    expect(
      brandError(brand('DOUBLEVERIFY', [ABS_KEY, 'display-viewability']), undefined),
    ).toBeNull();
  });
  it('options of another provider are ignored', () => {
    expect(toggleOption('IAS', [], ABS_KEY, true)).toEqual([]);
  });
});

describe('provider and advertiser settings (TGT-092)', () => {
  it('a provider that is off in Advertiser settings blocks Apply', () => {
    expect(brandError(brand('IAS', ['fraud']), ['DOUBLEVERIFY'])).toBe(BRAND_MESSAGES.TGT_092);
    expect(brandError(brand('DOUBLEVERIFY', []), ['DOUBLEVERIFY'])).toBeNull();
  });
  it('"No third party verification" is always allowed', () => {
    expect(brandError(brand('NONE', []), [])).toBeNull();
  });
  it('without settings every provider is on', () => {
    expect(brandError(brand('SCOPE3', []), undefined)).toBeNull();
  });
  it('changing the provider drops options it does not offer', () => {
    const next = setProvider(brand('DOUBLEVERIFY', [ABS_KEY, 'brand-safety']), 'IAS');
    expect(next.thirdParty).toEqual({ provider: 'IAS', options: ['brand-safety'] });
  });
});
