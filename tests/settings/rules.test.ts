// PRT, ADV and USR rules (modules 02 and 03): one passing and one failing input per rule, messages verbatim.
import { describe, expect, it } from 'vitest';
import { donut } from '@/lib/settings/advertisers';
import { coverageOf, type CoverageLineItem } from '@/lib/settings/brand-controls';
import {
  validateAdvertiser,
  validateAlertPrefs,
  validateConfigurations,
  validateCreateAdvertiser,
  validateExchanges,
  validatePartner,
  validateThirdParty,
  validateUser,
  roleSummary,
  type AlertPrefInput,
  type PartnerDetailsInput,
} from '@/lib/settings/rules';
import { DV_ROLE_LABEL } from '@/lib/settings/constants';

const codes = (issues: { code: string }[]) => issues.map((i) => i.code);

const partner: PartnerDetailsInput = {
  name: 'Acme',
  status: 'ACTIVE',
  currencyCode: 'INR',
  timeZone: 'Asia/Calcutta',
  sdfVersion: 'V11',
  sdfAdminEmail: 'sdf@example.test',
  autoEnableNewExchanges: false,
  dataProtection: {
    accepted: true,
    contacts: { PRIMARY: { email: 'a@example.test' } },
    contactPerson: 'PRIMARY',
  },
};
const storedPartner = { currencyCode: 'INR', timeZone: 'Asia/Calcutta', dataTermsAccepted: true };

describe('PRT rules (AC-02-10)', () => {
  it('passes a valid partner', () => expect(validatePartner(partner, storedPartner)).toEqual([]));
  it('PRT-001 empty name', () =>
    expect(codes(validatePartner({ ...partner, name: ' ' }, storedPartner))).toContain('PRT-001'));
  it('PRT-002 bad status', () =>
    expect(codes(validatePartner({ ...partner, status: 'DRAFT' }, storedPartner))).toContain(
      'PRT-002',
    ));
  it('PRT-003 currency and time zone are locked', () => {
    const r = validatePartner({ ...partner, currencyCode: 'USD', timeZone: 'UTC' }, storedPartner);
    expect(r.filter((i) => i.code === 'PRT-003').map((i) => i.path)).toEqual([
      'currencyCode',
      'timeZone',
    ]);
  });
  it('PRT-004 rejects SDF 12', () => {
    const r = validatePartner({ ...partner, sdfVersion: '12' }, storedPartner);
    expect(r).toContainEqual(
      expect.objectContaining({ code: 'PRT-004', message: 'Choose a supported SDF version.' }),
    );
  });
  it('PRT-005 invalid admin email', () => {
    const r = validatePartner({ ...partner, sdfAdminEmail: 'not-an-email' }, storedPartner);
    expect(r).toContainEqual(
      expect.objectContaining({ code: 'PRT-005', message: 'Enter a valid email address.' }),
    );
  });
  it('PRT-006 accepted terms cannot be unchecked', () => {
    const r = validatePartner(
      { ...partner, dataProtection: { ...partner.dataProtection, accepted: false } },
      storedPartner,
    );
    expect(codes(r)).toContain('PRT-006');
    expect(
      codes(
        validatePartner(
          { ...partner, dataProtection: { ...partner.dataProtection, accepted: false } },
          { ...storedPartner, dataTermsAccepted: false },
        ),
      ),
    ).not.toContain('PRT-006');
  });
  it('PRT-011 contact email and PRT-012 contact person', () => {
    const bad = validatePartner(
      {
        ...partner,
        dataProtection: {
          accepted: true,
          contacts: { PRIMARY: { email: 'x' } },
          contactPerson: 'EU_REPRESENTATIVE',
        },
      },
      storedPartner,
    );
    expect(codes(bad)).toEqual(expect.arrayContaining(['PRT-011', 'PRT-012']));
  });
});

describe('PRT-008 exchange extra ids (AC-02-11)', () => {
  const meta = new Map([
    ['gam', { id: 'gam', needsNetworkId: true, needsSeatId: false }],
    ['yl', { id: 'yl', needsNetworkId: false, needsSeatId: true }],
  ]);
  it('requires network and agency ids and seat ids when ticked', () => {
    const r = validateExchanges([{ exchangeId: 'gam' }, { exchangeId: 'yl', seatId: ' ' }], meta);
    expect(r.map((i) => i.path)).toEqual([
      'enabled[0].networkId',
      'enabled[0].agencyId',
      'enabled[1].seatId',
    ]);
    expect(r.every((i) => i.message === 'Enter a value')).toBe(true);
  });
  it('passes filled ids', () => {
    expect(
      validateExchanges(
        [
          { exchangeId: 'gam', networkId: '1', agencyId: '2' },
          { exchangeId: 'yl', seatId: '3' },
        ],
        meta,
      ),
    ).toEqual([]);
  });
});

describe('PRT-009, PRT-013, PRT-014 configurations (AC-02-16)', () => {
  const stored = {
    enhancedAutomation: true,
    productImprovement: true,
    instantDealsTermsAccepted: false,
  };
  const flag = (
    enabled: boolean,
    scope: 'ALL_ADVERTISERS' | 'SELECTED' = 'ALL_ADVERTISERS',
    advertiserIds: string[] = [],
  ) => ({ enabled, scope, advertiserIds });
  it('PRT-009 product improvement is read only while Enhanced automation is on', () => {
    const r = validateConfigurations(
      { flags: { ENHANCED_AUTOMATION: flag(true), PRODUCT_IMPROVEMENT: flag(false) } },
      stored,
    );
    expect(r).toContainEqual(
      expect.objectContaining({
        code: 'PRT-009',
        message: "This setting can't be changed while Enhanced automation is on.",
      }),
    );
  });
  it('with Enhanced automation off it can change', () => {
    expect(
      validateConfigurations(
        { flags: { ENHANCED_AUTOMATION: flag(false), PRODUCT_IMPROVEMENT: flag(false) } },
        stored,
      ),
    ).toEqual([]);
  });
  it('PRT-013 instant deals need accepted terms', () => {
    const r = validateConfigurations(
      { flags: { YOUTUBE_GUARANTEED_INSTANT_DEALS: flag(true) } },
      stored,
    );
    expect(codes(r)).toContain('PRT-013');
    expect(
      validateConfigurations(
        { flags: { YOUTUBE_GUARANTEED_INSTANT_DEALS: flag(true) } },
        { ...stored, instantDealsTermsAccepted: true },
      ),
    ).toEqual([]);
  });
  it('PRT-014 a selected scope needs an advertiser', () => {
    const r = validateConfigurations(
      { flags: { AUTO_TAGGING: flag(true, 'SELECTED', []) } },
      stored,
    );
    expect(r).toContainEqual(
      expect.objectContaining({ code: 'PRT-014', message: 'A selection is required' }),
    );
    expect(
      validateConfigurations({ flags: { AUTO_TAGGING: flag(true, 'SELECTED', ['a']) } }, stored),
    ).toEqual([]);
  });
});

describe('ADV create rules (AC-02-5)', () => {
  const ctx = { currencies: ['INR', 'SGD'], timeZones: ['Asia/Calcutta'] };
  const ok = {
    name: 'Acme',
    website: 'https://acme.example',
    currencyCode: 'INR',
    timeZone: 'Asia/Calcutta',
    adServer: 'THIRD_PARTY_ONLY' as const,
  };
  it('passes', () => expect(validateCreateAdvertiser(ok, ctx)).toEqual([]));
  it('empty name and website say "Enter a value"', () => {
    const r = validateCreateAdvertiser({ ...ok, name: '', website: '' }, ctx);
    expect(r.map((i) => [i.code, i.message])).toEqual([
      ['ADV-001', 'Enter a value'],
      ['ADV-002', 'Enter a value'],
    ]);
  });
  it('invalid URL says Enter a valid URL.', () => {
    expect(validateCreateAdvertiser({ ...ok, website: 'abc' }, ctx)).toContainEqual(
      expect.objectContaining({ code: 'ADV-003', message: 'Enter a valid URL.' }),
    );
  });
  it('GEN-004 name over 240 characters', () => {
    expect(codes(validateCreateAdvertiser({ ...ok, name: 'x'.repeat(241) }, ctx))).toContain(
      'GEN-004',
    );
  });
  it('GEN-005 currency and time zone must come from the lists', () => {
    expect(
      codes(validateCreateAdvertiser({ ...ok, currencyCode: 'XXX', timeZone: 'Mars/Base' }, ctx)),
    ).toEqual(['GEN-005', 'GEN-005']);
  });
});

describe('ADV details rules (AC-03-2, AC-03-4, AC-03-5, AC-03-10)', () => {
  const ok = {
    name: 'Acme',
    status: 'ACTIVE',
    website: 'https://acme.example',
    currencyCode: 'INR',
    timeZone: 'Asia/Calcutta',
    sdfVersion: 'V9',
    euPoliticalAds: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADS' as const,
    productImprovement: true,
  };
  const stored = { currencyCode: 'INR', timeZone: 'Asia/Calcutta' };
  const t = { partnerDataTermsAccepted: true };
  it('passes', () => expect(validateAdvertiser(ok, stored, t)).toEqual([]));
  it('ADV-004 forged currency change', () => {
    expect(validateAdvertiser({ ...ok, currencyCode: 'USD' }, stored, t)).toContainEqual(
      expect.objectContaining({ code: 'ADV-004' }),
    );
  });
  it('ADV-005 status is Active or Paused only', () => {
    expect(
      codes(validateAdvertiser({ ...ok, status: 'SCHEDULED_FOR_DELETION' }, stored, t)),
    ).toContain('ADV-005');
  });
  it('ADV-006 and ADV-007', () => {
    const r = validateAdvertiser({ ...ok, sdfVersion: '12', sdfAdminEmail: 'x' }, stored, t);
    expect(codes(r)).toEqual(expect.arrayContaining(['ADV-006', 'ADV-007']));
  });
  it('ADV-008 integration code over 500 bytes', () => {
    expect(
      codes(validateAdvertiser({ ...ok, integrationCode: 'é'.repeat(251) }, stored, t)),
    ).toContain('ADV-008');
    expect(
      codes(validateAdvertiser({ ...ok, integrationCode: 'x'.repeat(500) }, stored, t)),
    ).not.toContain('ADV-008');
  });
  it('ADV-011 EU answer is required', () => {
    expect(codes(validateAdvertiser({ ...ok, euPoliticalAds: null }, stored, t))).toContain(
      'ADV-011',
    );
  });
  it('ADV-013 business name of 26 characters', () => {
    expect(codes(validateAdvertiser({ ...ok, businessName: 'a'.repeat(26) }, stored, t))).toContain(
      'ADV-013',
    );
    expect(
      codes(validateAdvertiser({ ...ok, businessName: 'a'.repeat(25) }, stored, t)),
    ).not.toContain('ADV-013');
  });
  it('ADV-014 product improvement off needs accepted terms', () => {
    expect(
      codes(
        validateAdvertiser({ ...ok, productImprovement: false }, stored, {
          partnerDataTermsAccepted: false,
        }),
      ),
    ).toContain('ADV-014');
    expect(
      codes(validateAdvertiser({ ...ok, productImprovement: false }, stored, t)),
    ).not.toContain('ADV-014');
  });
});

describe('alert preference rules (AC-03-16)', () => {
  const base = (): Record<string, AlertPrefInput> => ({
    NO_SPEND: { enabled: true },
    UNDERPACING: { enabled: true, thresholdPct: 90 },
    UNDERPERFORMING: { enabled: true },
    LIMITED_AUDIENCE_SIZE: { enabled: true },
    DEALS_OFFLINE: { enabled: true },
    RESTRICTED_AUDIENCE_LIST: { enabled: true },
    REJECTED_CREATIVE: { enabled: true },
    RESTRICTED_CREATIVE: { enabled: true },
    EXCEEDED_SPEND_THRESHOLD: { enabled: false, thresholdAmount: 0 },
    CONFLICTING_SETTINGS: { enabled: true },
  });
  const run = (over: Record<string, AlertPrefInput>) =>
    validateAlertPrefs({ ...base(), ...over } as never);
  it('passes defaults', () => expect(run({})).toEqual([]));
  it('ADV-015 rejects 0 and 101', () => {
    for (const v of [0, 101, 1.5, ''])
      expect(codes(run({ UNDERPACING: { enabled: true, thresholdPct: v } })), String(v)).toContain(
        'ADV-015',
      );
    expect(run({ UNDERPACING: { enabled: true, thresholdPct: 100 } })).toEqual([]);
  });
  it('ADV-016 negative spend threshold, ignored while the toggle is off', () => {
    expect(
      codes(run({ EXCEEDED_SPEND_THRESHOLD: { enabled: true, thresholdAmount: -1 } })),
    ).toContain('ADV-016');
    expect(run({ EXCEEDED_SPEND_THRESHOLD: { enabled: false, thresholdAmount: -1 } })).toEqual([]);
  });
  it('ADV-019 dependent toggles need Underpacing on', () => {
    const r = run({ UNDERPACING: { enabled: false, thresholdPct: 90 } });
    expect(r.map((i) => i.path)).toEqual(['LIMITED_AUDIENCE_SIZE', 'DEALS_OFFLINE']);
    expect(r[0]?.message).toBe('Turn on Underpacing to use this alert.');
  });
});

describe('third-party services rules (AC-03-7)', () => {
  it('ADV-017 whole number', () => {
    expect(validateThirdParty({ iasClientId: '1.5', rateCards: [] })).toContainEqual(
      expect.objectContaining({ code: 'ADV-017', message: 'Enter a whole number.' }),
    );
    expect(validateThirdParty({ iasClientId: 0, rateCards: [] })).toEqual([]);
  });
  it('ADV-018 a ticked rate card needs the affirmation', () => {
    expect(
      codes(
        validateThirdParty({
          iasClientId: 0,
          rateCards: [{ vendorKey: 'a', selected: true, affirmed: false }],
        }),
      ),
    ).toEqual(['ADV-018']);
    expect(
      validateThirdParty({
        iasClientId: 0,
        rateCards: [{ vendorKey: 'a', selected: false, affirmed: false }],
      }),
    ).toEqual([]);
  });
});

describe('USR rules (AC-02-22)', () => {
  it('USR-001 name and email', () => {
    expect(
      validateUser({ name: '', email: '', access: [{ advertiserId: 'a', role: 'STANDARD' }] }).map(
        (i) => i.message,
      ),
    ).toEqual(['Enter a value', 'Enter a value']);
    expect(
      validateUser({
        name: 'A',
        email: 'nope',
        access: [{ advertiserId: 'a', role: 'STANDARD' }],
      })[0]?.message,
    ).toBe('Enter a valid email address.');
  });
  it('USR-002 needs an access row, USR-003 each row a role', () => {
    expect(codes(validateUser({ name: 'A', email: 'a@example.test', access: [] }))).toEqual([
      'USR-002',
    ]);
    expect(
      codes(
        validateUser({
          name: 'A',
          email: 'a@example.test',
          access: [{ advertiserId: 'a', role: '' }],
        }),
      ),
    ).toEqual(['USR-003']);
  });
  it('roleSummary joins distinct labels (AC-02-21)', () => {
    expect(roleSummary(['STANDARD', 'READ_ONLY', 'STANDARD'], DV_ROLE_LABEL)).toBe(
      'Standard, Read only',
    );
  });
});

describe('summary donut (AC-02-3)', () => {
  it('always adds to 100', () => {
    for (const [s, a, t] of [
      [10, 20, 100],
      [33, 33, 100],
      [0, 0, 0],
      [99.6, 0.3, 100],
      [120, 5, 100],
    ] as const) {
      const d = donut(s, a, t);
      if (t > 0) expect(d.likelyPct + d.atRiskPct + d.spendPct).toBe(100);
      else expect(d).toEqual({ likelyPct: 0, atRiskPct: 0, spendPct: 0 });
    }
  });
});

describe('brand control coverage (AC-02-19)', () => {
  const li = (over: Partial<CoverageLineItem> = {}): CoverageLineItem => ({
    type: 'DISPLAY',
    status: 'ACTIVE',
    inventoryQuality: 'AUTHORIZED_DIRECT_SELLERS_AND_RESELLERS',
    rules: [],
    ...over,
  });
  it('total 0 gives 0 percent', () => {
    const c = coverageOf([], 'DISPLAY_VIDEO');
    expect(c.active).toBe(0);
    expect(c.coverage.KEYWORDS).toEqual({ pct: 0, covered: 0, total: 0 });
  });
  it('an advertiser-level brand suitability rule covers the line item', () => {
    const c = coverageOf(
      [li({ rules: [{ dimension: 'BRAND_SUITABILITY', mode: 'INCLUDE' }] }), li()],
      'DISPLAY_VIDEO',
    );
    expect(c.coverage.DIGITAL_CONTENT_LABELS).toEqual({ pct: 50, covered: 1, total: 2 });
  });
  it('paused and archived line items are excluded', () => {
    const c = coverageOf(
      [li({ status: 'PAUSED' }), li({ status: 'ARCHIVED' }), li()],
      'DISPLAY_VIDEO',
    );
    expect(c.active).toBe(1);
  });
  it('the tab splits YouTube and Demand Gen from the rest', () => {
    const items = [li(), li({ type: 'YT_VIDEO' }), li({ type: 'DEMAND_GEN' })];
    expect(coverageOf(items, 'YOUTUBE').active).toBe(2);
    expect(coverageOf(items, 'DISPLAY_VIDEO').active).toBe(1);
  });
  it('apps, keywords and authorized sellers predicates (Q6: the default does not count)', () => {
    const c = coverageOf(
      [
        li({
          rules: [
            { dimension: 'APPS_AND_URLS', mode: 'EXCLUDE' },
            { dimension: 'KEYWORD', mode: 'EXCLUDE' },
          ],
          inventoryQuality: 'AUTHORIZED_DIRECT_SELLERS',
        }),
        li({
          rules: [
            { dimension: 'APPS_AND_URLS', mode: 'INCLUDE' },
            { dimension: 'NEGATIVE_KEYWORD_LIST', mode: 'EXCLUDE' },
          ],
        }),
      ],
      'DISPLAY_VIDEO',
    );
    expect(c.coverage.APPS_URL_CHANNEL.covered).toBe(1);
    expect(c.coverage.KEYWORDS.covered).toBe(2);
    expect(c.coverage.AUTHORIZED_SELLERS.covered).toBe(1);
  });
});
