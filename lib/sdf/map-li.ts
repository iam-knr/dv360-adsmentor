// LineItems.csv mapper (module 11 4.4 D). Model = the line item form value plus the ids the file shows. Columns the
// simulator does not model (view frequency, custom bidding algorithm, deal ids, exchanges, ...) are exported blank
// and are not applied on upload; the upload reports a changed value in them as read only (BLK-028).
import type { LiFormValue } from '@/lib/line-items/form';
import { BID_STRATEGY_LABEL } from '@/lib/line-items/type-config';
import { LI_TYPE_LABEL } from '@/lib/validation/constants/li-compat';
import type { Sel, TargetingCriteria, TargetMode } from '@/lib/targeting/types';
import {
  CellError,
  decNum,
  decTuples,
  encEpoch,
  encNum,
  encTuples,
  enumError,
  refError,
} from './codec';
import {
  bool,
  date,
  enm,
  enumCodec,
  FREQ_PERIOD_LABEL,
  int,
  list,
  money,
  PACING_PERIOD_LABEL,
  PACING_TYPE_LABEL,
  STATUS_LABEL,
  text,
  type ColMap,
  type ColMaps,
} from './map-common';

export interface LiRefs {
  /** Creative row id <-> public id. */
  creativeToPublic: Map<string, string>;
  creativeFromPublic: Map<string, string>;
  activityToPublic: Map<string, string>;
  activityFromPublic: Map<string, string>;
}

export const emptyRefs = (): LiRefs => ({
  creativeToPublic: new Map(),
  creativeFromPublic: new Map(),
  activityToPublic: new Map(),
  activityFromPublic: new Map(),
});

export interface LiModel {
  publicId: string;
  ioPublicId: string;
  updatedAt: Date;
  value: LiFormValue;
  refs: LiRefs;
  advancedAdServingRate?: number;
}

const FLIGHT = { SAME_AS_IO: 'Same as insertion order', CUSTOM: 'Custom' } as const;
const BUDGET = { UNLIMITED: 'Unlimited', AMOUNT: 'Fixed' } as const;
const QUALITY = {
  AUTHORIZED_DIRECT_SELLERS: 'Authorized direct sellers',
  AUTHORIZED_DIRECT_SELLERS_AND_RESELLERS: 'Authorized direct sellers and resellers',
  AUTHORIZED_AND_NON_PARTICIPATING: 'Authorized and non-participating publishers',
} as const;
const PRIORITY = { FULL_BUDGET: 'Spend full budget', TARGET: 'Target value' } as const;
const EU = { YES: 'Yes', NO: 'No' } as const;
const COUNTING = {
  ALL: 'All',
  POST_CLICK_ONLY: 'Post-click only',
  PERCENTAGE: 'Percentage',
} as const;
const REVENUE = {
  TOTAL_MEDIA_COST_MARKUP: 'Total media cost markup',
  CPM_VALUE: 'CPM value',
} as const;
const FREQ_MODE_ON = (m: LiModel) => m.value.frequencyCap.mode === 'LIMITED';
const TZ = { LOCAL: 'Local', ADVERTISER: 'Advertiser' } as const;
const DAY = {
  MON: 'Mon',
  TUE: 'Tue',
  WED: 'Wed',
  THU: 'Thu',
  FRI: 'Fri',
  SAT: 'Sat',
  SUN: 'Sun',
} as const;
type DayKey = keyof typeof DAY;

const crit = (m: LiModel): TargetingCriteria => m.value.targetingState.criteria;
const setCrit = (m: LiModel, fn: (c: TargetingCriteria) => void) => {
  const c = structuredClone(crit(m));
  fn(c);
  m.value = { ...m.value, targetingState: { ...m.value.targetingState, criteria: c } };
};

const ids = (sels: Sel[] | undefined, mode: TargetMode) =>
  (sels ?? []).filter((s) => s.mode === mode).map((s) => s.id);
const withMode = (sels: Sel[] | undefined, mode: TargetMode, values: string[]): Sel[] => {
  const others = (sels ?? []).filter((s) => s.mode !== mode);
  const old = new Map((sels ?? []).filter((s) => s.mode === mode).map((s) => [s.id, s] as const));
  return [...others, ...values.map((id) => old.get(id) ?? { id, mode })];
};

/** An include / exclude column pair over a `Sel[]` dimension. */
function selPair(
  include: string,
  exclude: string,
  read: (c: TargetingCriteria) => Sel[] | undefined,
  write: (c: TargetingCriteria, next: Sel[]) => void,
): ColMaps<LiModel> {
  const one = (name: string, mode: TargetMode): ColMap<LiModel> =>
    list(
      (m) => ids(read(crit(m)), mode),
      (m, v) =>
        setCrit(m, (c) => {
          const next = withMode(read(c), mode, v);
          write(c, next);
        }),
    );
  return { [include]: one(include, 'INCLUDE'), [exclude]: one(exclude, 'EXCLUDE') };
}

const dropEmpty = <T>(arr: T[], assign: (v: T[] | undefined) => void) =>
  assign(arr.length ? arr : undefined);

const cap = (m: LiModel) => m.value.frequencyCap;
const setCap = (m: LiModel, patch: Partial<LiModel['value']['frequencyCap']>) =>
  (m.value = { ...m.value, frequencyCap: { ...cap(m), ...patch } });

const bidLabel = (m: LiModel) =>
  m.value.bid.mode === 'FIXED'
    ? BID_STRATEGY_LABEL.FIXED_BID
    : m.value.bid.optimizedTowards
      ? BID_STRATEGY_LABEL[m.value.bid.optimizedTowards]
      : '';

export const liMaps: ColMaps<LiModel> = {
  'Line Item Id': text((m) => m.publicId),
  'Io Id': text((m) => m.ioPublicId),
  Type: enm(
    LI_TYPE_LABEL,
    'Type',
    (m) => m.value.type,
    (m, v) => (m.value.type = v),
  ),
  Name: text(
    (m) => m.value.name,
    (m, v) => (m.value.name = v),
  ),
  Timestamp: { get: (m) => encEpoch(m.updatedAt) },
  Status: enm(
    STATUS_LABEL,
    'Status',
    (m) => m.value.status,
    (m, v) => (m.value.status = v),
  ),
  'Mobile App Platform': text(
    (m) => m.value.app?.platform ?? '',
    (m, v) => {
      m.value.app = {
        ...(m.value.app ?? {}),
        platform: (v.toUpperCase() as 'ALL' | 'IOS' | 'ANDROID') || 'ALL',
      };
    },
  ),
  'Mobile App Id': text(
    (m) => m.value.app?.storeId ?? '',
    (m, v) => {
      m.value.app = { ...(m.value.app ?? {}), storeId: v || null };
    },
  ),
  'App Ad Format': text(
    (m) => (m.value.adType ? (m.value.adType === 'VIDEO' ? 'Video' : 'Display') : ''),
    (m, v) => {
      m.value.adType = v ? (v.toLowerCase() === 'video' ? 'VIDEO' : 'DISPLAY') : null;
    },
  ),
  'Flight Mode': enm(
    FLIGHT,
    'Flight Mode',
    (m) => m.value.flight.mode,
    (m, v) => (m.value.flight = { ...m.value.flight, mode: v }),
  ),
  'Start Date': date(
    (m) => (m.value.flight.mode === 'CUSTOM' ? m.value.flight.startDate : null),
    (m, v) => (m.value.flight = { ...m.value.flight, startDate: v }),
  ),
  'End Date': date(
    (m) => (m.value.flight.mode === 'CUSTOM' ? m.value.flight.endDate : null),
    (m, v) => (m.value.flight = { ...m.value.flight, endDate: v }),
  ),
  'Budget Mode': enm(
    BUDGET,
    'Budget Mode',
    (m) => m.value.budget.mode,
    (m, v) => (m.value.budget = { ...m.value.budget, mode: v ?? 'UNLIMITED' }),
  ),
  'Budget Amount': money(
    (m) => (m.value.budget.mode === 'AMOUNT' ? (m.value.budget.amount as number | string) : null),
    (m, v) => (m.value.budget = { ...m.value.budget, amount: v }),
  ),
  Pacing: enm(
    PACING_PERIOD_LABEL,
    'Pacing',
    (m) => m.value.pacing.period,
    (m, v) => (m.value.pacing = { ...m.value.pacing, period: v }),
  ),
  'Pacing Type': enm(
    PACING_TYPE_LABEL,
    'Pacing Type',
    (m) => m.value.pacing.type,
    (m, v) => (m.value.pacing = { ...m.value.pacing, type: v }),
  ),
  'Pacing Amount': money(
    (m) =>
      m.value.pacing.period === 'DAILY' ? (m.value.pacing.dailyAmount as number | string) : null,
    (m, v) => (m.value.pacing = { ...m.value.pacing, dailyAmount: v }),
  ),
  'Frequency Enabled': bool(FREQ_MODE_ON, (m, v) =>
    setCap(m, { mode: v ? 'LIMITED' : m.value.youtube ? 'UNLIMITED' : 'INHERIT' }),
  ),
  'Frequency Exposures': int(
    (m) => (FREQ_MODE_ON(m) ? (cap(m).maxImpressions as number | null) : null),
    (m, v) => setCap(m, { maxImpressions: v }),
  ),
  'Frequency Period': enm(
    FREQ_PERIOD_LABEL,
    'Frequency Period',
    (m) => (FREQ_MODE_ON(m) ? cap(m).period : null),
    (m, v) => setCap(m, { period: v }),
  ),
  'Frequency Amount': int(
    (m) => (FREQ_MODE_ON(m) ? (cap(m).periodCount as number | null) : null),
    (m, v) => setCap(m, { periodCount: v }),
  ),
  'Bid Strategy Type': {
    get: bidLabel,
    set: (m, v) => {
      const k = enumCodec(BID_STRATEGY_LABEL, 'Bid Strategy Type').dec(v);
      if (!k) return;
      m.value.bid =
        k === 'FIXED_BID'
          ? { ...m.value.bid, mode: 'FIXED', optimizedTowards: null }
          : { ...m.value.bid, mode: 'AUTOMATED', optimizedTowards: k };
    },
  },
  'Bid Strategy Value': money(
    (m) =>
      m.value.bid.mode === 'FIXED'
        ? (m.value.bid.fixedCpm as number | string)
        : (m.value.bid.targetValue as number | string),
    (m, v) =>
      (m.value.bid =
        m.value.bid.mode === 'FIXED'
          ? { ...m.value.bid, fixedCpm: v }
          : { ...m.value.bid, targetValue: v }),
  ),
  'Bid Priority': enm(
    PRIORITY,
    'Bid Priority',
    (m) => (m.value.bid.mode === 'AUTOMATED' ? m.value.bid.priority : null),
    (m, v) => (m.value.bid = { ...m.value.bid, priority: v }),
  ),
  'Inventory Quality': enm(
    QUALITY,
    'Inventory Quality',
    (m) => m.value.inventory.quality,
    (m, v) => (m.value.inventory = { ...m.value.inventory, quality: v }),
  ),
  'Target Curated CTV': bool(
    (m) => m.value.inventory.targetCuratedCtv,
    (m, v) => (m.value.inventory = { ...m.value.inventory, targetCuratedCtv: !!v }),
  ),
  'Optimized Targeting': bool(
    (m) => m.value.optimizedTargeting,
    (m, v) => (m.value.optimizedTargeting = !!v),
  ),
  ...selPair(
    'Geography Targeting - Include',
    'Geography Targeting - Exclude',
    (c) => c.geography?.regions,
    (c, next) => {
      if (next.length || c.geography?.radius || c.geography?.locationListIds?.length)
        c.geography = { ...(c.geography ?? { regions: [] }), regions: next };
      else delete c.geography;
    },
  ),
  ...selPair(
    'Language Targeting - Include',
    'Language Targeting - Exclude',
    (c) => c.language,
    (c, next) => dropEmpty(next, (v) => (c.language = v)),
  ),
  ...selPair(
    'Device Type Targeting - Include',
    'Device Type Targeting - Exclude',
    (c) => c.device?.types,
    (c, next) => {
      const d = c.device ?? { types: [], os: [], makeModel: [] };
      if (next.length || d.os.length || d.makeModel.length) c.device = { ...d, types: next };
      else delete c.device;
    },
  ),
  ...selPair(
    'Browser Targeting - Include',
    'Browser Targeting - Exclude',
    (c) => c.browser,
    (c, next) => dropEmpty(next, (v) => (c.browser = v)),
  ),
  ...selPair(
    'Carrier And ISP Targeting - Include',
    'Carrier And ISP Targeting - Exclude',
    (c) => c.carrierIsp,
    (c, next) => dropEmpty(next, (v) => (c.carrierIsp = v)),
  ),
  ...selPair(
    'Category Targeting - Include',
    'Category Targeting - Exclude',
    (c) => c.categories,
    (c, next) => dropEmpty(next, (v) => (c.categories = v)),
  ),
  'Operating System Targeting': list(
    (m) => ids(crit(m).device?.os, 'INCLUDE'),
    (m, v) =>
      setCrit(m, (c) => {
        const d = c.device ?? { types: [], os: [], makeModel: [] };
        c.device = { ...d, os: withMode(d.os, 'INCLUDE', v) };
      }),
  ),
  'Keyword Targeting - Include': list(
    (m) => crit(m).keywords?.include,
    (m, v) =>
      setCrit(m, (c) => {
        const k = { include: v, exclude: c.keywords?.exclude ?? [] };
        if (k.include.length || k.exclude.length) c.keywords = k;
        else delete c.keywords;
      }),
  ),
  'Keyword Targeting - Exclude': list(
    (m) => crit(m).keywords?.exclude,
    (m, v) =>
      setCrit(m, (c) => {
        const k = { include: c.keywords?.include ?? [], exclude: v };
        if (k.include.length || k.exclude.length) c.keywords = k;
        else delete c.keywords;
      }),
  ),
  'Connection Speed Targeting': text(
    (m) => crit(m).connectionSpeed,
    (m, v) =>
      setCrit(m, (c) => {
        if (v) c.connectionSpeed = v;
        else delete c.connectionSpeed;
      }),
  ),
  'Environment Targeting': {
    get: (m) => {
      const e = crit(m).environment;
      return e ? [e.web && 'Web', e.app && 'App'].filter(Boolean).join(';') : '';
    },
    set: (m, v) =>
      setCrit(m, (c) => {
        const parts = v
          .split(';')
          .map((x) => x.trim().toLowerCase())
          .filter(Boolean);
        for (const p of parts)
          if (p !== 'web' && p !== 'app') throw enumError(p, 'Environment Targeting');
        if (parts.length)
          c.environment = { web: parts.includes('web'), app: parts.includes('app') };
        else delete c.environment;
      }),
  },
  'Viewability Targeting Predicted': {
    get: (m) => {
      const v = crit(m).viewability;
      return v ? (v.predictedPct === null ? 'All' : String(v.predictedPct)) : '';
    },
    set: (m, v) =>
      setCrit(m, (c) => {
        if (v === '') return void delete c.viewability;
        if (v.toLowerCase() === 'all')
          c.viewability = {
            openMeasurement: c.viewability?.openMeasurement ?? true,
            predictedPct: null,
          };
        else {
          const n = decNum(v);
          if (n === null || n < 10 || n > 90 || n % 10 !== 0)
            throw new CellError('BLK-030', 'Enter a value in the format All or 10 to 90.');
          c.viewability = {
            openMeasurement: c.viewability?.openMeasurement ?? true,
            predictedPct: n,
          };
        }
      }),
  },
  'Gender Targeting': list(
    (m) => crit(m).demographics?.gender,
    (m, v) => setCrit(m, (c) => demo(c, { gender: v })),
  ),
  'Parental Status': list(
    (m) => crit(m).demographics?.parental,
    (m, v) => setCrit(m, (c) => demo(c, { parental: v })),
  ),
  'Household Income Targeting': list(
    (m) => crit(m).demographics?.income,
    (m, v) => setCrit(m, (c) => demo(c, { income: v })),
  ),
  'Age Range': {
    get: (m) => {
      const d = crit(m).demographics;
      return d ? `${d.ageRange[0]}-${d.ageRange[1] >= 65 ? '65+' : d.ageRange[1]}` : '';
    },
    set: (m, v) =>
      setCrit(m, (c) => {
        if (!v) return;
        const r = /^(\d+)-(\d+)\+?$/.exec(v.trim());
        if (!r) throw new CellError('BLK-030', 'Enter a value in the format 18-65+.');
        demo(c, { ageRange: [Number(r[1]), Number(r[2])] });
      }),
  },
  'Day And Time Targeting': {
    get: (m) =>
      encTuples((crit(m).dayAndTime?.segments ?? []).map((s) => [DAY[s.day], s.from, s.to])),
    set: (m, v) =>
      setCrit(m, (c) => {
        const segments = decTuples(v).map((r) => {
          const day = (Object.keys(DAY) as DayKey[]).find(
            (k) => DAY[k].toLowerCase() === (r[0] ?? '').toLowerCase(),
          );
          if (!day) throw enumError(r[0] ?? '', 'Day And Time Targeting');
          return { day, from: r[1] ?? '', to: r[2] ?? '' };
        });
        if (segments.length) c.dayAndTime = { segments, tz: c.dayAndTime?.tz ?? 'ADVERTISER' };
        else delete c.dayAndTime;
      }),
  },
  'Day And Time Time Zone': enm(
    TZ,
    'Day And Time Time Zone',
    (m) => crit(m).dayAndTime?.tz,
    (m, v) =>
      setCrit(m, (c) => {
        if (c.dayAndTime && v) c.dayAndTime = { ...c.dayAndTime, tz: v };
      }),
  ),
  'Position Targeting - On Screen': list(
    (m) => crit(m).position?.onScreen,
    (m, v) => setCrit(m, (c) => pos(c, { onScreen: v })),
  ),
  'Position Targeting - In Content': list(
    (m) => crit(m).position?.inContent,
    (m, v) => setCrit(m, (c) => pos(c, { inContent: v })),
  ),
  'Position Targeting - Native': list(
    (m) => crit(m).position?.native,
    (m, v) => setCrit(m, (c) => pos(c, { native: v })),
  ),
  'Audience Targeting - Google Include': list(
    (m) => crit(m).audienceLists?.include.google,
    (m, v) => setCrit(m, (c) => aud(c, (a) => (a.include.google = v))),
  ),
  'Audience Targeting - Combined Include': list(
    (m) => crit(m).audienceLists?.include.combined,
    (m, v) => setCrit(m, (c) => aud(c, (a) => (a.include.combined = v))),
  ),
  'Audience Targeting - Custom List Include': list(
    (m) => crit(m).audienceLists?.include.custom,
    (m, v) => setCrit(m, (c) => aud(c, (a) => (a.include.custom = v))),
  ),
  'Audience Targeting - First Party Exclude': list(
    (m) => crit(m).audienceLists?.exclude.firstParty,
    (m, v) => setCrit(m, (c) => aud(c, (a) => (a.exclude.firstParty = v))),
  ),
  'Audience Targeting - Google Exclude': list(
    (m) => crit(m).audienceLists?.exclude.google,
    (m, v) => setCrit(m, (c) => aud(c, (a) => (a.exclude.google = v))),
  ),
  'Audience Targeting - First Party Include Groups': {
    get: (m) => encTuples(crit(m).audienceLists?.include.firstPartyGroups ?? []),
    set: (m, v) =>
      setCrit(m, (c) =>
        aud(c, (a) => (a.include.firstPartyGroups = decTuples(v).map((g) => g.filter(Boolean)))),
      ),
  },
  'Creative Ids': {
    get: (m) => m.value.creatives.map((id) => m.refs.creativeToPublic.get(id) ?? id).join(';'),
    set: (m, v) => {
      m.value.creatives = v
        .split(';')
        .map((x) => x.trim())
        .filter(Boolean)
        .map((p) => {
          const row = m.refs.creativeFromPublic.get(p);
          if (!row) throw refError(p, 'Creative Ids');
          return row;
        });
    },
  },
  'Creative Optimization': bool(
    (m) => m.value.creativeOptimization,
    (m, v) => (m.value.creativeOptimization = !!v),
  ),
  'Conversion Floodlight Activity Ids': {
    get: (m) =>
      m.value.conversions.activities.map((id) => m.refs.activityToPublic.get(id) ?? id).join(';'),
    set: (m, v) => {
      m.value.conversions = {
        ...m.value.conversions,
        activities: v
          .split(';')
          .map((x) => x.trim())
          .filter(Boolean)
          .map((p) => {
            const row = m.refs.activityFromPublic.get(p);
            if (!row) throw refError(p, 'Conversion Floodlight Activity Ids');
            return row;
          }),
      };
    },
  },
  'Conversion Counting': enm(
    COUNTING,
    'Conversion Counting',
    (m) => m.value.conversions.countingMode,
    (m, v) => (m.value.conversions = { ...m.value.conversions, countingMode: v }),
  ),
  'Conversion Counting Percent': int(
    (m) =>
      m.value.conversions.countingMode === 'PERCENTAGE'
        ? (m.value.conversions.postViewPct as number)
        : null,
    (m, v) => (m.value.conversions = { ...m.value.conversions, postViewPct: v }),
  ),
  'Contains EU Political Ads': enm(
    EU,
    'Contains EU Political Ads',
    (m) => m.value.euPoliticalAds,
    (m, v) => (m.value.euPoliticalAds = v),
  ),
  'Revenue Model Type': enm(
    REVENUE,
    'Revenue Model Type',
    (m) => m.value.revenueModel?.type,
    (m, v) => (m.value.revenueModel = { ...(m.value.revenueModel ?? { type: null }), type: v }),
  ),
  'Revenue Model Value': money(
    (m) => m.value.revenueModel?.value as number | string,
    (m, v) => (m.value.revenueModel = { ...(m.value.revenueModel ?? { type: null }), value: v }),
  ),
  'Integration Code': text(
    (m) => m.value.integrationCode,
    (m, v) => (m.value.integrationCode = v),
  ),
  Details: text(
    (m) => m.value.integrationDetail,
    (m, v) => (m.value.integrationDetail = v),
  ),
  'Advanced Ad Serving Rate': { get: (m) => encNum(m.advancedAdServingRate) },
};

function demo(
  c: TargetingCriteria,
  patch: Partial<NonNullable<TargetingCriteria['demographics']>>,
) {
  c.demographics = {
    gender: [],
    ageRange: [18, 65],
    ageUnknown: true,
    parental: [],
    income: [],
    ...c.demographics,
    ...patch,
  };
}
function pos(c: TargetingCriteria, patch: Partial<NonNullable<TargetingCriteria['position']>>) {
  c.position = { onScreen: [], inContent: [], native: [], ...c.position, ...patch };
}
function aud(
  c: TargetingCriteria,
  fn: (a: NonNullable<TargetingCriteria['audienceLists']>) => void,
) {
  const a = c.audienceLists ?? {
    include: { firstPartyGroups: [], google: [], combined: [], custom: [] },
    exclude: { firstParty: [], google: [] },
  };
  fn(a);
  c.audienceLists = a;
}
