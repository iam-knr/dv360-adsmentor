// MX-02 IO type x objective: enabled objectives, KPIs, bid strategies, line item types (validation.md 3).
import type { Kpi } from './goals-kpis';
import type { LiType } from './li-compat';

export const IO_TYPES = ['STANDARD', 'CTV_OTT', 'DOOH'] as const;
export type IoType = (typeof IO_TYPES)[number];

export const IO_OBJECTIVES = [
  'BRAND_AWARENESS',
  'CLICKS',
  'CONVERSIONS',
  'CUSTOM',
  'NONE',
] as const;
export type IoObjective = (typeof IO_OBJECTIVES)[number];

export const IO_OBJECTIVE_LABEL: Record<IoObjective, string> = {
  BRAND_AWARENESS: 'Brand awareness',
  CLICKS: 'Clicks',
  CONVERSIONS: 'Conversions',
  CUSTOM: 'Custom',
  NONE: 'Insertion order without objective',
};

export const BID_STRATEGIES = [
  'FIXED_BID',
  'MAX_CLICKS',
  'TARGET_CPC',
  'MAX_CONVERSIONS',
  'MAX_CONVERSION_VALUE',
  'TARGET_CPA',
  'TARGET_ROAS',
  'MAX_REACH',
  'MAX_VIEWABLE_IMPRESSIONS',
  'MAX_VIEWABLE_10S',
  'MAX_COMPLETED_IN_VIEW_AUDIBLE',
  'MAX_CPV',
  'TARGET_CPM',
  'TARGET_CPV',
  'TARGET_VIEWABLE_IMPRESSIONS',
  'MAX_CUSTOM_VALUE_COST',
  'TARGET_CUSTOM_VALUE_COST',
] as const;
export type BidStrategy = (typeof BID_STRATEGIES)[number];

/** Strategies an insertion order can optimise towards (everything except the fixed bid). */
export const AUTOMATED_STRATEGIES: readonly BidStrategy[] = BID_STRATEGIES.filter(
  (s) => s !== 'FIXED_BID',
);

export interface ObjectiveRow {
  kpis: readonly Kpi[];
  bidStrategies: readonly BidStrategy[];
  liTypes: readonly LiType[];
}

/** KPIs shown for the `NONE` objective: all but the campaign-only free text. */
export const ALL_IO_KPIS: readonly Kpi[] = [
  'CPM',
  'CPC',
  'CPA',
  'CTR',
  'CPV',
  'CPIAVC',
  'VIEWABLE_PCT',
  'VCPM',
  'CPCL',
  'CPCV',
  'TOS10',
  'VTR',
  'COMPL_AUDIO',
  'COMPL_VIDEO',
  'VALUE_COST',
  'CLICK_CVR',
  'IMPR_CVR',
];

/** MX-02 table B, STANDARD insertion order. `NONE` allows any KPI and any automated strategy. */
export const STANDARD_IO_MATRIX: Record<IoObjective, ObjectiveRow> = {
  BRAND_AWARENESS: {
    kpis: [
      'CPCL',
      'CPCV',
      'CPIAVC',
      'CPM',
      'CPV',
      'COMPL_AUDIO',
      'COMPL_VIDEO',
      'TOS10',
      'VCPM',
      'VTR',
      'VALUE_COST',
      'VIEWABLE_PCT',
    ],
    bidStrategies: [
      'MAX_COMPLETED_IN_VIEW_AUDIBLE',
      'MAX_CUSTOM_VALUE_COST',
      'MAX_REACH',
      'MAX_VIEWABLE_10S',
      'MAX_VIEWABLE_IMPRESSIONS',
      'MAX_CPV',
      'TARGET_CPM',
      'TARGET_CPV',
      'TARGET_CUSTOM_VALUE_COST',
      'TARGET_VIEWABLE_IMPRESSIONS',
    ],
    liTypes: [
      'DISPLAY',
      'VIDEO',
      'CTV',
      'AUDIO',
      'MOBILE_APP_INSTALL',
      'ADS_IN_MOBILE_APPS',
      'YT_VIDEO',
      'YT_AUDIO',
    ],
  },
  CLICKS: {
    kpis: ['CPC', 'CTR', 'VALUE_COST'],
    bidStrategies: [
      'MAX_CLICKS',
      'MAX_CUSTOM_VALUE_COST',
      'TARGET_CPC',
      'TARGET_CUSTOM_VALUE_COST',
    ],
    liTypes: ['DISPLAY', 'VIDEO', 'MOBILE_APP_INSTALL', 'ADS_IN_MOBILE_APPS', 'DEMAND_GEN'],
  },
  CONVERSIONS: {
    kpis: ['CPA', 'CLICK_CVR', 'IMPR_CVR', 'VALUE_COST'],
    bidStrategies: [
      'MAX_CONVERSION_VALUE',
      'MAX_CONVERSIONS',
      'MAX_CUSTOM_VALUE_COST',
      'TARGET_CPA',
      'TARGET_ROAS',
      'TARGET_CUSTOM_VALUE_COST',
    ],
    liTypes: [
      'DISPLAY',
      'VIDEO',
      'CTV',
      'AUDIO',
      'MOBILE_APP_INSTALL',
      'ADS_IN_MOBILE_APPS',
      'DEMAND_GEN',
    ],
  },
  CUSTOM: {
    kpis: ['VALUE_COST'],
    bidStrategies: ['MAX_CUSTOM_VALUE_COST', 'TARGET_CUSTOM_VALUE_COST'],
    liTypes: ['DISPLAY', 'VIDEO', 'CTV', 'AUDIO', 'MOBILE_APP_INSTALL', 'ADS_IN_MOBILE_APPS'],
  },
  NONE: {
    kpis: ALL_IO_KPIS,
    bidStrategies: AUTOMATED_STRATEGIES,
    liTypes: [
      'DISPLAY',
      'VIDEO',
      'AUDIO',
      'CTV',
      'MOBILE_APP_INSTALL',
      'ADS_IN_MOBILE_APPS',
      'YT_VIDEO',
      'YT_AUDIO',
      'DEMAND_GEN',
    ],
  },
};

/** MX-02 table A: type rules. */
export const IO_TYPE_RULES: Record<
  IoType,
  { objectives: readonly IoObjective[]; liTypes: readonly LiType[] | 'STANDARD_MATRIX' }
> = {
  STANDARD: { objectives: IO_OBJECTIVES, liTypes: 'STANDARD_MATRIX' },
  CTV_OTT: {
    objectives: ['BRAND_AWARENESS', 'CONVERSIONS', 'CUSTOM', 'NONE'],
    liTypes: ['CTV', 'YT_ON_CTV'],
  },
  DOOH: { objectives: ['NONE'], liTypes: ['DOOH_DISPLAY', 'DOOH_VIDEO'] },
};

/** CTV_OTT KPI lists (MX-02 A, below the table). `NONE` allows any. */
const CTV_OTT_KPIS: Partial<Record<IoObjective, readonly Kpi[]>> = {
  BRAND_AWARENESS: ['CPM', 'VALUE_COST'],
  CONVERSIONS: ['CPA', 'VALUE_COST'],
  CUSTOM: ['VALUE_COST'],
};

/** CTV_OTT automated strategies: Brand awareness is MAX_REACH only, the rest follow the Standard row. */
const CTV_OTT_STRATEGIES: Partial<Record<IoObjective, readonly BidStrategy[]>> = {
  BRAND_AWARENESS: ['MAX_REACH'],
};

export function isObjectiveEnabled(type: IoType, objective: IoObjective): boolean {
  return IO_TYPE_RULES[type].objectives.includes(objective);
}

/** KPIs allowed for an IO of this type and objective. DOOH has none (N/A). */
export function ioKpisFor(type: IoType, objective: IoObjective): readonly Kpi[] {
  if (type === 'DOOH') return [];
  if (type === 'CTV_OTT') {
    const own = CTV_OTT_KPIS[objective];
    if (own) return own;
  }
  return STANDARD_IO_MATRIX[objective].kpis;
}

/** Automated "optimised towards" strategies allowed for an IO of this type and objective. */
export function ioBidStrategiesFor(type: IoType, objective: IoObjective): readonly BidStrategy[] {
  if (type === 'DOOH') return [];
  if (type === 'CTV_OTT') {
    const own = CTV_OTT_STRATEGIES[objective];
    if (own) return own;
  }
  return STANDARD_IO_MATRIX[objective].bidStrategies;
}

/** Default first KPI for a new IO (validation.md MX-02 note, Q4). DOOH has none. */
export const IO_DEFAULT_KPI: Record<IoObjective, Kpi | null> = {
  BRAND_AWARENESS: 'VCPM',
  CLICKS: 'CPC',
  CONVERSIONS: 'CPA',
  CUSTOM: 'VALUE_COST',
  NONE: null,
};
