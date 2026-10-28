// valid*() factories used by every validation test (validation.md 6.7 "Fixture facts").
// `now` is 2026-10-28 12:00 in the advertiser time zone. Money is in minor units (RC-019).
import type { CreativeFormat } from '../constants/creatives';
import { IO_DEFAULT_KPI } from '../constants/io-matrix';
import type {
  AdvertiserSnapshot,
  CampaignInput,
  CampaignSnapshot,
  CreativeInfo,
  ExchangeInfo,
  IoInput,
  IoObjective,
  IoSnapshot,
  IoType,
  LineItemInput,
  LiType,
  ValidationContext,
} from '../types';

export const NOW = new Date('2026-10-28T06:30:00Z'); // 12:00 in Asia/Kolkata
export const TODAY = '2026-10-28';

/** ₹ amount to minor units. */
export function inr(amount: number): number {
  return Math.round(amount * 100);
}

export const ENABLED_EXCHANGES: string[] = [
  ...Array.from({ length: 50 }, (_, i) => `ex-${String(i + 1).padStart(2, '0')}`),
  'ex-dooh-1',
  'ex-dooh-2',
  'ex-dooh-3',
  'ex-dooh-4',
];

export function validCampaign(): CampaignInput {
  return {
    name: 'Fixture campaign',
    status: 'ACTIVE',
    goal: 'AWARENESS',
    kpi: { type: 'CPM', value: inr(50) },
    creativeTypes: ['DISPLAY'],
    plannedSpend: null,
    startDate: TODAY,
    endDate: null,
    frequencyCap: { mode: 'UNLIMITED' },
    budgetUnit: 'CURRENCY',
    budgets: [],
    landingPageUrls: [],
    keywords: [],
  };
}

export function validIo(opts: { type?: IoType; objective?: IoObjective } = {}): IoInput {
  const type = opts.type ?? 'STANDARD';
  const objective = opts.objective ?? 'BRAND_AWARENESS';
  const kpiType = type === 'DOOH' ? null : IO_DEFAULT_KPI[objective];
  return {
    name: 'Fixture IO',
    status: 'DRAFT',
    type,
    objective,
    budget: {
      type: 'CURRENCY',
      segments: [
        { id: 'seg-1', amount: inr(10_000), startDate: '2026-10-01', endDate: '2026-10-31' },
      ],
    },
    pacing: { period: 'FLIGHT', type: 'AHEAD' },
    kpi: kpiType ? { type: kpiType, value: inr(100) } : null,
    optimization: { mode: 'LI_CONTROLLED', optimizedTowards: null },
    frequencyCap: { mode: 'INHERIT' },
    partnerCosts: { cpmFees: [], mediaFees: [{ type: 'Default', amount: 0, system: true }] },
    integrationCode: '',
  };
}

/** The "Clicks IO" of the case tables: STANDARD / CLICKS, line item controlled, same budget. */
export function validClicksIo(): IoInput {
  return validIo({ objective: 'CLICKS' });
}

// ---------------------------------------------------------------------------------------------
// Line items
// ---------------------------------------------------------------------------------------------

/** The IO a valid line item of this type sits in. */
export function ioFor(type: LiType): { ioType: IoType; objective: IoObjective } {
  switch (type) {
    case 'DEMAND_GEN':
      return { ioType: 'STANDARD', objective: 'CLICKS' };
    case 'DOOH_DISPLAY':
    case 'DOOH_VIDEO':
      return { ioType: 'DOOH', objective: 'NONE' };
    case 'YT_ON_CTV':
      return { ioType: 'CTV_OTT', objective: 'BRAND_AWARENESS' };
    default:
      return { ioType: 'STANDARD', objective: 'BRAND_AWARENESS' };
  }
}

const CREATIVE_FORMAT_FOR: Partial<Record<LiType, CreativeFormat>> = {
  DISPLAY: 'IMAGE',
  VIDEO: 'VIDEO_FILE',
  CTV: 'VIDEO_FILE',
  AUDIO: 'AUDIO_FILE',
  MOBILE_APP_INSTALL: 'IMAGE',
  ADS_IN_MOBILE_APPS: 'IMAGE',
  DOOH_DISPLAY: 'IMAGE',
  DOOH_VIDEO: 'VIDEO_FILE',
};

export function validCreativeInfo(type: LiType): CreativeInfo | null {
  const format = CREATIVE_FORMAT_FOR[type];
  if (!format) return null;
  return {
    id: 'cr-1',
    format,
    status: 'ACTIVE',
    review: 'SERVABLE',
    exchangeStatus: { 'ex-01': 'APPROVED', 'ex-02': 'APPROVED' },
    restrictedCountries: [],
    ...(format === 'IMAGE' ? { width: 300, height: 250 } : {}),
  };
}

export function validLineItem(type: LiType = 'DISPLAY'): LineItemInput {
  const dooh = type === 'DOOH_DISPLAY' || type === 'DOOH_VIDEO';
  const audioOrDooh = type === 'AUDIO' || dooh;
  const creative = validCreativeInfo(type);
  const base: LineItemInput = {
    name: 'Fixture line item',
    status: 'DRAFT',
    type,
    ioId: 'io-1',
    inventory: {
      quality: 'AUTHORIZED_DIRECT_SELLERS_AND_RESELLERS',
      exchanges: dooh ? ['ex-dooh-1'] : ['ex-01', 'ex-02'],
      deals: [],
      dealGroups: [],
    },
    flight: { mode: 'SAME_AS_IO' },
    budget: { mode: 'UNLIMITED' },
    pacing: { period: 'FLIGHT', type: 'EVEN' },
    bid: audioOrDooh
      ? { mode: 'FIXED', fixedCpm: inr(10) }
      : type === 'CTV'
        ? { mode: 'AUTOMATED', optimizedTowards: 'MAX_REACH' }
        : type === 'DEMAND_GEN'
          ? { mode: 'AUTOMATED', optimizedTowards: 'MAX_CLICKS', priority: 'FULL_BUDGET' }
          : {
              mode: 'AUTOMATED',
              optimizedTowards: 'MAX_VIEWABLE_IMPRESSIONS',
              priority: 'FULL_BUDGET',
            },
    frequencyCap: { mode: 'INHERIT' },
    creatives: creative ? [creative.id] : [],
    conversions: {
      activities: [],
      countingMode: 'ALL',
      postViewPct: 100,
      attributionModelId: null,
    },
    euPoliticalAds: 'NO',
    revenueModel: null,
    partnerCosts: { cpmFees: [], mediaFees: [] },
    integrationCode: '',
    targeting: { dimensions: ['GEOGRAPHY'] },
  };

  switch (type) {
    case 'DISPLAY':
      base.targeting = {
        dimensions: ['BRAND_SUITABILITY', 'VIEWABILITY', 'GEOGRAPHY'],
        predictedViewability: 'ALL',
      };
      break;
    case 'CTV':
      base.targeting = {
        dimensions: ['DEVICE_TYPE', 'POSITION_IN_CONTENT', 'VIDEO_PLAYER_SIZE', 'GEOGRAPHY'],
        device: { include: ['CONNECTED_TV'], exclude: ['COMPUTER', 'SMARTPHONE', 'TABLET'] },
      };
      break;
    case 'MOBILE_APP_INSTALL':
      base.app = { platform: 'ALL', storeId: 'store-1' };
      base.adType = 'DISPLAY';
      break;
    case 'ADS_IN_MOBILE_APPS':
      base.adType = 'DISPLAY';
      base.targeting = {
        dimensions: ['ENVIRONMENT', 'DEVICE_TYPE', 'GEOGRAPHY'],
        environment: { include: ['APP'] },
        device: { include: ['SMARTPHONE', 'TABLET'], exclude: [] },
      };
      break;
    case 'DEMAND_GEN':
      base.budget = { mode: 'AMOUNT', amount: inr(5_000) };
      base.ads = [{ headline: 'Headline', description: 'Description', businessName: 'Business' }];
      break;
    default:
      break;
  }
  return base;
}

// ---------------------------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------------------------

export function validAdvertiser(): AdvertiserSnapshot {
  return {
    currency: 'INR',
    timeZone: 'Asia/Kolkata',
    demandGenFloodlightOptimization: true,
    googleInventoryEnabled: true,
    appAttributionLinked: true,
    attributionModelIds: ['PRIMARY', 'LAST_CLICK'],
    businessName: null,
  };
}

export function validCampaignSnapshot(): CampaignSnapshot {
  return { id: 'cmp-1', goal: 'AWARENESS', status: 'ACTIVE', frequencyCap: { mode: 'UNLIMITED' } };
}

export function validIoSnapshot(opts: { type?: IoType; objective?: IoObjective } = {}): IoSnapshot {
  const type = opts.type ?? 'STANDARD';
  const objective = opts.objective ?? 'BRAND_AWARENESS';
  return {
    id: 'io-1',
    type,
    objective,
    mode: 'LI_CONTROLLED',
    optimizedTowards: null,
    status: 'ACTIVE',
    budgetType: 'CURRENCY',
    budgetTotal: inr(10_000),
    flight: { start: '2026-10-01', end: '2026-10-31' },
    frequencyCap: { mode: 'INHERIT' },
  };
}

export interface CtxOverrides {
  mode?: ValidationContext['mode'];
  source?: ValidationContext['source'];
  original?: unknown;
  role?: ValidationContext['actor']['role'];
  limitedAccess?: boolean;
  now?: Date;
  partner?: Partial<ValidationContext['partner']>;
  advertiser?: Partial<AdvertiserSnapshot>;
  campaign?: Partial<CampaignSnapshot> | null;
  io?: Partial<IoSnapshot> | null;
  children?: ValidationContext['children'];
  lookups?: ValidationContext['lookups'] | null;
  disabledRules?: readonly string[];
}

const EXCHANGE_LOOKUP = new Map<string, ExchangeInfo>(
  ENABLED_EXCHANGES.map((id): [string, ExchangeInfo] => [
    id,
    { id, name: id, isDooh: id.startsWith('ex-dooh') },
  ]),
);

/** A complete lookup set: nothing is skipped for a missing lookup. */
export function fullLookups(type: LiType = 'DISPLAY'): NonNullable<ValidationContext['lookups']> {
  const creative = validCreativeInfo(type);
  return {
    exchanges: new Map(EXCHANGE_LOOKUP),
    deals: new Map([
      [
        'deal-1',
        { id: 'deal-1', accessible: true, exchangeEnabled: true, status: 'ACTIVE' as const },
      ],
    ]),
    creatives: new Map(creative ? [[creative.id, creative]] : []),
    floodlightActivities: new Map([
      ['fl-1', { id: 'fl-1', status: 'ACTIVE' as const, linkedToAdvertiser: true }],
    ]),
    customBidding: new Map([['cb-1', { id: 'cb-1', status: 'ACTIVE' as const }]]),
    templates: new Map([
      ['tpl-display', { id: 'tpl-display', liType: 'DISPLAY' as const }],
      ['tpl-video', { id: 'tpl-video', liType: 'VIDEO' as const }],
    ]),
  };
}

/**
 * A valid context: create mode, a Standard role, the fixture advertiser, an active campaign and an
 * active Brand awareness IO. `overrides` replace parts of it; `null` removes `campaign`, `io` or `lookups`.
 */
export function makeCtx(
  overrides: CtxOverrides = {},
  lineItemType: LiType = 'DISPLAY',
): ValidationContext {
  const { ioType, objective } = ioFor(lineItemType);
  const io =
    overrides.io === null
      ? undefined
      : { ...validIoSnapshot({ type: ioType, objective }), ...overrides.io };
  const campaign =
    overrides.campaign === null ? undefined : { ...validCampaignSnapshot(), ...overrides.campaign };
  const lookups =
    overrides.lookups === null ? {} : (overrides.lookups ?? fullLookups(lineItemType));
  return {
    mode: overrides.mode ?? 'create',
    now: overrides.now ?? NOW,
    actor: {
      userId: 'user-1',
      role: overrides.role ?? 'STANDARD',
      limitedAccess: overrides.limitedAccess ?? false,
    },
    ...(overrides.source ? { source: overrides.source } : {}),
    ...(overrides.original !== undefined ? { original: overrides.original } : {}),
    partner: { enabledExchangeIds: ENABLED_EXCHANGES, sdfVersion: '11', ...overrides.partner },
    advertiser: { ...validAdvertiser(), ...overrides.advertiser },
    ...(campaign ? { campaign } : {}),
    ...(io ? { io } : {}),
    ...(overrides.children ? { children: overrides.children } : {}),
    ...(overrides.disabledRules ? { disabledRules: overrides.disabledRules } : {}),
    lookups,
  };
}

// ---------------------------------------------------------------------------------------------
// Patching
// ---------------------------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Deep merge for case tables: objects merge, arrays and scalars replace, `undefined` removes the key. */
export function applyPatch<T>(base: T, patch: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(patch))
    return (patch === undefined ? base : patch) as T;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete out[key];
    else if (isPlainObject(value) && isPlainObject(out[key]))
      out[key] = applyPatch(out[key], value);
    else out[key] = value;
  }
  return out as T;
}
