// Fixtures for engine tests (engine.md 11.3): the benchmark advertiser and small worlds for
// property tests. Not part of the runtime; the determinism lint rule does not apply here.

import type { Format, LineItemType } from '../types';
import type {
  CampaignEntity,
  CreativeEntity,
  FloodlightActivity,
  IoEntity,
  LineItemEntity,
  TargetingSpec,
  World,
} from '../world';

/** 2026-11-01 00:00 in Asia/Kolkata (UTC+5:30). */
export const SIM_START_MS = Date.UTC(2026, 10, 1, 0, 0, 0) - 330 * 60_000;

export const CLEAR_MEDIAN: Record<Format, number> = {
  display: 65,
  native: 110,
  video_instream: 260,
  ctv: 700,
  audio: 320,
  youtube: 130,
};

const TYPE_OF: Record<Format, LineItemType> = {
  display: 'DISPLAY',
  native: 'DISPLAY',
  video_instream: 'VIDEO',
  ctv: 'CTV',
  audio: 'AUDIO',
  youtube: 'YT_VIDEO',
};

export function baseWorld(over: Partial<World> = {}): World {
  return {
    sandboxId: 'sb-1',
    marketSeed: 'market-1',
    sandboxSeed: 'sandbox-1',
    simStartMs: SIM_START_MS,
    tzOffsetMin: 330,
    country: 'IN',
    partner: { id: 'p1', currency: 'INR' },
    advertiser: {
      id: 'a1',
      currency: 'INR',
      tzOffsetMin: 330,
      vertical: 'ecommerce',
      alertPrefs: {},
    },
    campaigns: [{ id: 'c1', status: 'ACTIVE', frequency: { mode: 'UNLIMITED' } }],
    insertionOrders: [],
    lineItems: [],
    creatives: [],
    audiences: [],
    floodlightActivities: [],
    deals: [],
    ...over,
  };
}

export function creativeFor(format: Format, id = `cr-${format}`): CreativeEntity {
  const type =
    format === 'display'
      ? 'display'
      : format === 'native'
        ? 'native'
        : format === 'audio'
          ? 'audio'
          : 'video';
  return {
    id,
    status: 'ACTIVE',
    type,
    size: type === 'display' ? '300x250' : undefined,
    dv360Servable: true,
    approval: { '*': 'APPROVED' },
  };
}

export const purchase: FloodlightActivity = {
  id: 'fl-purchase',
  name: 'Purchase',
  type: 'sale',
  countingMethod: 'standard',
  category: 'purchase',
  tagStatus: 'active',
};

export function ioOf(over: Partial<IoEntity> = {}): IoEntity {
  return {
    id: 'io1',
    campaignId: 'c1',
    status: 'ACTIVE',
    budgetUnit: 'CURRENCY',
    segments: [{ id: 'seg1', amount: 50_000_000, startDay: '2026-11-01', endDay: '2026-11-30' }],
    pacing: { period: 'FLIGHT', type: 'EVEN' },
    bidBudgetControl: 'LI_CONTROLLED',
    autoBudgetAllocation: false,
    frequency: { mode: 'UNLIMITED' },
    partnerCosts: [],
    ...over,
  };
}

export function liOf(
  id: string,
  format: Format,
  over: Partial<LineItemEntity> = {},
  targeting: TargetingSpec = {},
): LineItemEntity {
  const t: TargetingSpec = { ...targeting };
  if (format === 'display' || format === 'native') t.formats = [format];
  return {
    id,
    ioId: 'io1',
    status: 'ACTIVE',
    type: TYPE_OF[format],
    inventoryQuality: 'DIRECT_AND_RESELLERS',
    budget: { mode: 'UNLIMITED_UP_TO_IO' },
    pacing: { period: 'FLIGHT', type: 'ASAP' },
    bid: { kind: 'FIXED', fixedCpm: CLEAR_MEDIAN[format] * 1.2 },
    frequency: { mode: 'INHERIT' },
    targeting: t,
    creativeIds: [`cr-${format}`],
    floodlight: [{ activityId: 'fl-purchase' }],
    conversionCounting: { mode: 'ALL' },
    attributionModel: 'last_click',
    revenueModel: { type: 'TOTAL_MEDIA_COST_MARKUP', markup: 0 },
    optimizedTargeting: false,
    creativeOptimization: true,
    ...over,
  };
}

export const BENCHMARK_FORMATS: Format[] = [
  'display',
  'native',
  'video_instream',
  'ctv',
  'audio',
  'youtube',
];

/** Benchmark advertiser: 1 IO, 1 line item per format, broad India targeting, large budget. */
export function benchmarkWorld(
  opts: { bidMultiple?: number; formats?: Format[]; budget?: number } = {},
): World {
  const formats = opts.formats ?? BENCHMARK_FORMATS;
  const mult = opts.bidMultiple ?? 1.2;
  const lis = formats.map((f) =>
    liOf(`li-${f}`, f, { bid: { kind: 'FIXED', fixedCpm: CLEAR_MEDIAN[f] * mult } }),
  );
  const camp: CampaignEntity = { id: 'c1', status: 'ACTIVE', frequency: { mode: 'UNLIMITED' } };
  return baseWorld({
    campaigns: [camp],
    insertionOrders: [
      ioOf({
        segments: [
          {
            id: 'seg1',
            amount: opts.budget ?? 5_000_000_000,
            startDay: '2026-11-01',
            endDay: '2026-11-30',
          },
        ],
      }),
    ],
    lineItems: lis,
    creatives: formats.map((f) => creativeFor(f)),
    floodlightActivities: [purchase],
  });
}

const SMALL_SIZES: [string, string][] = [
  ['cr-display', '300x250'],
  ['cr-display-2', '320x50'],
  ['cr-display-3', '728x90'],
  ['cr-display-4', '300x600'],
  ['cr-display-5', '160x600'],
  ['cr-display-6', '970x250'],
  ['cr-display-7', '336x280'],
  ['cr-display-8', '320x100'],
];
/** Display creatives that cover 82% of the slot sizes, so small worlds are not creative limited. */
export const SMALL_CREATIVES: CreativeEntity[] = SMALL_SIZES.map(([id, size]) => ({
  ...creativeFor('display', id),
  size,
}));

/** One narrow display line item that is cheap to simulate, for property tests. */
export function smallWorld(
  over: {
    li?: Partial<LineItemEntity>;
    targeting?: TargetingSpec;
    io?: Partial<IoEntity>;
    world?: Partial<World>;
  } = {},
): World {
  const targeting: TargetingSpec = {
    exchanges: ['google_ad_manager', 'index_exchange'],
    geo: { includeRegions: ['IN-MH'] },
    ...over.targeting,
  };
  return baseWorld({
    insertionOrders: [ioOf(over.io)],
    lineItems: [
      liOf(
        'li1',
        'display',
        {
          pacing: { period: 'FLIGHT', type: 'EVEN' },
          creativeIds: SMALL_CREATIVES.map((c) => c.id),
          ...over.li,
        },
        targeting,
      ),
    ],
    creatives: SMALL_CREATIVES.map((c) => ({ ...c })),
    floodlightActivities: [purchase],
    ...over.world,
  });
}

/**
 * World for the determinism goldens (engine.md 11.1): two competing display line items with a
 * frequency cap and an audience, an IO-automated video line item and a CTV line item, so the
 * golden touches pacing, own-line-item competition, learning, frequency and conversions.
 */
export function determinismWorld(over: Partial<World> = {}): World {
  const targeting: TargetingSpec = {
    exchanges: ['google_ad_manager'],
    geo: { includeRegions: ['IN-MH', 'IN-KA'] },
    devices: ['smartphone'],
  };
  const cap = { mode: 'LIMITED' as const, maxExposures: 5, unit: 'DAY' as const, unitCount: 1 };
  const base = baseWorld({
    partner: {
      id: 'p1',
      currency: 'INR',
      enabledExchanges: ['google_ad_manager'],
    },
    campaigns: [{ id: 'c1', status: 'ACTIVE', frequency: { mode: 'UNLIMITED' } }],
    insertionOrders: [
      ioOf({
        id: 'io1',
        segments: [{ id: 'seg1', amount: 300_000, startDay: '2026-11-01', endDay: '2026-11-30' }],
        partnerCosts: [{ kind: 'CPM_FEE', slot: 1, amount: 4, invoiced: true }],
      }),
      ioOf({
        id: 'io2',
        segments: [{ id: 'seg2', amount: 600_000, startDay: '2026-11-01', endDay: '2026-11-30' }],
        bidBudgetControl: 'IO_AUTOMATED',
        optimizeTarget: 'MAX_VIEWABLE_IMPRESSIONS',
        pacing: { period: 'FLIGHT', type: 'AHEAD' },
      }),
    ],
    lineItems: [
      liOf(
        'd1',
        'display',
        {
          frequency: cap,
          bid: { kind: 'FIXED', fixedCpm: 75 },
          pacing: { period: 'FLIGHT', type: 'EVEN' },
        },
        { ...targeting, audiences: { includeGroups: [['aud1']] } },
      ),
      liOf(
        'd2',
        'display',
        { bid: { kind: 'FIXED', fixedCpm: 60 }, pacing: { period: 'FLIGHT', type: 'EVEN' } },
        targeting,
      ),
      liOf(
        'v1',
        'video_instream',
        { ioId: 'io2', bid: { kind: 'AUTOMATED', goal: 'MAX_VIEWABLE_IMPRESSIONS' } },
        { exchanges: ['google_ad_manager'], geo: { includeRegions: ['IN-DL', 'IN-MH'] } },
      ),
      liOf(
        'c1',
        'ctv',
        { ioId: 'io2', bid: { kind: 'FIXED', fixedCpm: 800 } },
        { exchanges: ['google_ad_manager'] },
      ),
    ],
    creatives: [
      ...['300x250', '320x50', '728x90'].map((size, i) => ({
        ...creativeFor('display', `cr-d${i}`),
        size,
      })),
      creativeFor('video_instream'),
      creativeFor('ctv'),
    ],
    audiences: [{ id: 'aud1', type: 'in_market', sizeFraction: 0.04 }],
    floodlightActivities: [purchase],
  });
  const withCreatives = base.lineItems.map((l) =>
    l.id === 'd1' || l.id === 'd2' ? { ...l, creativeIds: ['cr-d0', 'cr-d1', 'cr-d2'] } : l,
  );
  return { ...base, lineItems: withCreatives, ...over };
}
