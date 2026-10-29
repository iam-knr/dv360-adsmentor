// Database rows to engine World: the pure mapping helpers.
import { describe, expect, it } from 'vitest';
import { defaultParams } from '@/lib/engine/params/load';
import {
  alertTypeOf,
  allocKey,
  countryForCurrency,
  foldApproval,
  mapAlertPrefs,
  mapFrequency,
  mapKpi,
  mapPartnerCost,
  mapTargeting,
  tzOffsetMinutes,
  type OptionInfo,
  type TargetRow,
} from '@/lib/engine/io/map';
import type { AlertCode } from '@/lib/engine/world';

const params = defaultParams().params;
const row = (over: Partial<TargetRow>): TargetRow => ({
  dimension: 'GEOGRAPHY',
  mode: 'INCLUDE',
  optionId: null,
  refType: null,
  refId: null,
  groupIndex: 0,
  config: null,
  ...over,
});
const options = (entries: Record<string, [string, string]>): Map<string, OptionInfo> =>
  new Map(Object.entries(entries).map(([id, [code, name]]) => [id, { code, name }]));
const ctx = (opts: Map<string, OptionInfo>, country = 'IN') => ({
  country,
  params,
  options: opts,
  exchangeKey: (id: string) => (id === 'ex-1' ? 'pubmatic' : undefined),
});

describe('time zones and markets', () => {
  it('computes fixed offsets', () => {
    const at = Date.parse('2026-10-28T00:00:00Z');
    expect(tzOffsetMinutes('Asia/Calcutta', at)).toBe(330);
    expect(tzOffsetMinutes('Asia/Kolkata', at)).toBe(330);
    expect(tzOffsetMinutes('Asia/Singapore', at)).toBe(480);
    expect(tzOffsetMinutes('Europe/London', Date.parse('2026-07-01T00:00:00Z'))).toBe(60);
    expect(tzOffsetMinutes('Not/AZone', at)).toBe(0);
  });
  it('maps a currency to its market', () => {
    expect(countryForCurrency(params, 'INR')).toBe('IN');
    expect(countryForCurrency(params, 'SGD')).toBe('SG');
    expect(countryForCurrency(params, 'XXX')).toBe('IN');
  });
});

describe('small mappers', () => {
  it('maps frequency caps', () => {
    expect(mapFrequency({ mode: 'LIMITED', maxExposures: 3, unit: 'DAY', unitCount: 1 })).toEqual({
      mode: 'LIMITED',
      maxExposures: 3,
      unit: 'DAY',
      unitCount: 1,
    });
    expect(
      mapFrequency({ mode: 'UNLIMITED', maxExposures: null, unit: null, unitCount: null }),
    ).toEqual({ mode: 'UNLIMITED' });
    expect(
      mapFrequency({ mode: 'INHERIT', maxExposures: null, unit: null, unitCount: null }),
    ).toEqual({ mode: 'INHERIT' });
  });
  it('maps KPIs and drops those without a value', () => {
    expect(mapKpi('CPA', '250.000000')).toEqual({ kind: 'CPA', value: 250 });
    expect(mapKpi('VIEWABLE_PCT', 60)).toEqual({ kind: 'VIEWABILITY', value: 60 });
    expect(mapKpi('CPA', null)).toBeUndefined();
    expect(mapKpi(null, 5)).toBeUndefined();
    expect(mapKpi('OTHER', 5)).toBeUndefined();
  });
  it('turns fee percentages into fractions', () => {
    expect(
      mapPartnerCost({
        kind: 'MEDIA_FEE',
        slot: 2,
        amount: null,
        percentage: '8.0000',
        invoiced: true,
      }),
    ).toEqual({
      kind: 'MEDIA_FEE',
      slot: 2,
      amount: 0.08,
      invoiced: true,
    });
    expect(
      mapPartnerCost({
        kind: 'CPM_FEE',
        slot: 1,
        amount: '4.5',
        percentage: null,
        invoiced: false,
      }),
    ).toMatchObject({ amount: 4.5 });
  });
  it('folds exchange approvals to the worst state', () => {
    expect(foldApproval(['APPROVED', 'DISAPPROVED'])).toBe('DISAPPROVED');
    expect(foldApproval(['APPROVED', 'PENDING'])).toBe('PENDING');
    expect(foldApproval(['APPROVED'])).toBe('APPROVED');
    expect(foldApproval([])).toBe('PENDING');
  });
});

describe('alert preferences', () => {
  it('fans a preference out to the engine codes', () => {
    const prefs = mapAlertPrefs([
      { alertType: 'NO_SPEND', enabled: false, thresholdPct: null, thresholdAmount: null },
      { alertType: 'UNDERPACING', enabled: true, thresholdPct: 80, thresholdAmount: null },
      {
        alertType: 'EXCEEDED_SPEND_THRESHOLD',
        enabled: true,
        thresholdPct: null,
        thresholdAmount: '5000.00',
      },
    ]);
    expect(prefs.enabled).toMatchObject({
      NO_SPEND_LI: false,
      NO_SPEND_IO: false,
      UNDERPACING_IO: true,
      SPEND_THRESHOLD: true,
    });
    expect(prefs.underpacingThresholdPct).toBe(80);
    expect(prefs.spendThreshold).toBe(5000);
  });
  it('gives every engine code a type and category', () => {
    const codes: AlertCode[] = [
      'NO_SPEND_LI',
      'NO_SPEND_IO',
      'UNDERPACING_IO',
      'CONFLICT_IO',
      'CONFLICT_LI',
      'LIMITED_AUDIENCE_LI',
      'UNDERPERFORMING_IO',
      'RESTRICTED_AUDIENCE_LIST_LI',
      'CREATIVE_REJECTED',
      'CREATIVE_RESTRICTED',
      'SPEND_THRESHOLD',
    ];
    for (const c of codes) expect(alertTypeOf(c).type, c).toBeTruthy();
    expect(alertTypeOf('CREATIVE_REJECTED')).toEqual({
      type: 'REJECTED_CREATIVE',
      category: 'CREATIVES',
    });
  });
});

describe('targeting', () => {
  it('maps allocation keys from option names', () => {
    expect(allocKey(params.targeting.allocation.browser, 'Chrome 120', 'B7')).toBe('chrome');
    expect(allocKey(params.targeting.allocation.browser, 'Samsung Internet 24', 'B9')).toBe(
      'samsung_internet',
    );
    expect(allocKey(params.targeting.allocation.browser, 'Opera 5', 'B1')).toBe('other');
  });

  it('maps geography: states include, cities become pincodes, the country is unrestricted', () => {
    const opts = options({
      g1: ['IN-MH', 'Maharashtra'],
      g2: ['IN-GA-panaji', 'Panaji'],
      g3: ['IN', 'India'],
      g4: ['IN-AS', 'Assam'],
    });
    const spec = mapTargeting(
      [
        row({ optionId: 'g1' }),
        row({ optionId: 'g2' }),
        row({ optionId: 'g3' }),
        row({ optionId: 'g4', mode: 'EXCLUDE' }),
      ],
      ctx(opts),
    );
    expect(spec.geo?.includeRegions).toEqual(['IN-MH']);
    expect(spec.geo?.pincodes).toEqual([{ region: 'IN-REST', count: 10 }]);
    expect(spec.geo?.excludeRegions).toEqual(['IN-REST']);
    // Singapore has a single region: no restriction
    const sg = mapTargeting(
      [row({ optionId: 'g5' })],
      ctx(options({ g5: ['SG-5', 'Central'] }), 'SG'),
    );
    expect(sg.geo).toBeUndefined();
  });

  it('maps device, environment, day and time, viewability and languages', () => {
    const opts = options({
      d1: ['SMARTPHONE', 'Smartphone'],
      d2: ['CONNECTED_TV', 'Connected TV'],
      e1: ['APP', 'App'],
      l1: ['hi', 'Hindi'],
    });
    const spec = mapTargeting(
      [
        row({ dimension: 'DEVICE_TYPE', optionId: 'd1' }),
        row({ dimension: 'DEVICE_TYPE', optionId: 'd2', mode: 'EXCLUDE' }),
        row({ dimension: 'ENVIRONMENT', optionId: 'e1' }),
        row({ dimension: 'LANGUAGE', optionId: 'l1' }),
        row({ dimension: 'DAY_TIME', config: { days: ['MON', 'FRI'], fromHour: 8, toHour: 22 } }),
        row({ dimension: 'VIEWABILITY', config: { predictedViewabilityMin: 70 } }),
      ],
      ctx(opts),
    );
    expect(spec.devices).toEqual(['smartphone']);
    expect(spec.environment).toEqual(['app']);
    expect(spec.languages).toEqual(['hi']);
    expect(spec.daypart).toEqual({ windows: [{ days: [0, 4], startHour: 8, endHour: 22 }] });
    expect(spec.viewabilityMin).toBeCloseTo(0.7);
  });

  it('groups audiences, counts keywords and apps, and picks verification and exchanges', () => {
    const opts = options({ v1: ['TV1', 'DoubleVerify'] });
    const spec = mapTargeting(
      [
        row({ dimension: 'AUDIENCE_LIST', refType: 'AUDIENCE', refId: 'au-1', groupIndex: 0 }),
        row({ dimension: 'AUDIENCE_LIST', refType: 'AUDIENCE', refId: 'au-2', groupIndex: 1 }),
        row({ dimension: 'AUDIENCE_LIST', refType: 'AUDIENCE', refId: 'au-3', mode: 'EXCLUDE' }),
        row({ dimension: 'KEYWORD', config: { count: 4 } }),
        row({ dimension: 'NEGATIVE_KEYWORD_LIST', config: { count: 2 } }),
        row({ dimension: 'APPS_AND_URLS', config: { count: 10 } }),
        row({ dimension: 'APPS_AND_URLS', mode: 'EXCLUDE' }),
        row({
          dimension: 'THIRD_PARTY_VERIFIER',
          optionId: 'v1',
          config: { provider: 'DoubleVerify' },
        }),
        row({ dimension: 'INVENTORY_SOURCE', refId: 'ex-1' }),
        row({ dimension: 'DIGITAL_CONTENT_LABEL', mode: 'EXCLUDE' }),
      ],
      ctx(opts),
    );
    expect(spec.audiences).toEqual({ includeGroups: [['au-1'], ['au-2']], exclude: ['au-3'] });
    expect(spec.keywords).toEqual({ includeCount: 4, negativeCount: 2 });
    expect(spec.appUrl).toEqual({ includeCount: 10, excludeCount: 1 });
    expect(spec.verification).toEqual(['dv_abs']);
    expect(spec.exchanges).toEqual(['pubmatic']);
    expect(spec.brandSuitability).toEqual({ excludedLabels: 1 });
  });

  it('returns an empty spec for a line item without targeting rows', () => {
    expect(mapTargeting([], ctx(new Map()))).toEqual({});
  });
});
