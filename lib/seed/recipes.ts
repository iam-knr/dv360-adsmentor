// Insertion order recipes: what each seeded IO looks like (module 07 3.4) and which line item types it holds (module 08 3.4).
export type Kpi = 'CPM' | 'CPC' | 'CPA' | 'CTR' | 'CPV' | 'CPIAVC' | 'VIEWABLE_PCT' | 'VALUE_COST';

export type RecipeKey =
  | 'brand-auto'
  | 'clicks-autoalloc'
  | 'conv-auto'
  | 'custom'
  | 'none-yt'
  | 'brand-impr'
  | 'clicks-daily'
  | 'conv-multiseg'
  | 'ctv'
  | 'dooh';

export interface Recipe {
  key: RecipeKey;
  ioType: 'STANDARD' | 'CTV_OTT' | 'DOOH';
  objective: 'BRAND_AWARENESS' | 'CLICKS' | 'CONVERSIONS' | 'CUSTOM' | 'NONE';
  control: 'IO_AUTOMATED' | 'LI_CONTROLLED';
  optimizeTarget?: 'MAX_VIEWABLE_IMPRESSIONS' | 'MAX_REACH';
  kpi: Kpi | null;
  kpiValue: number | null;
  budgetUnit: 'CURRENCY' | 'IMPRESSIONS';
  pacingPeriod: 'FLIGHT' | 'DAILY';
  pacingType: 'AHEAD' | 'EVEN' | 'ASAP';
  autoBudgetAllocation: boolean;
  ytReachFreqOptimization: boolean;
  segments: 1 | 3;
  /** Line item types by position; the list repeats when lineItemsPerIo is larger. */
  liTypes: readonly string[];
  /** Median IO budget in INR; scaled by the advertiser currency. */
  medianBudgetInr: number;
}

const BASE = {
  budgetUnit: 'CURRENCY',
  pacingPeriod: 'FLIGHT',
  pacingType: 'EVEN',
  autoBudgetAllocation: false,
  ytReachFreqOptimization: false,
  segments: 1,
} as const;

export const RECIPES: Record<RecipeKey, Recipe> = {
  'brand-auto': {
    ...BASE,
    key: 'brand-auto',
    ioType: 'STANDARD',
    objective: 'BRAND_AWARENESS',
    control: 'IO_AUTOMATED',
    optimizeTarget: 'MAX_VIEWABLE_IMPRESSIONS',
    kpi: 'CPM',
    kpiValue: 90,
    pacingType: 'AHEAD',
    liTypes: ['DISPLAY', 'VIDEO', 'DISPLAY'],
    medianBudgetInr: 720_000,
  },
  'clicks-autoalloc': {
    ...BASE,
    key: 'clicks-autoalloc',
    ioType: 'STANDARD',
    objective: 'CLICKS',
    control: 'LI_CONTROLLED',
    kpi: 'CPC',
    kpiValue: 14,
    autoBudgetAllocation: true,
    liTypes: ['DISPLAY', 'ADS_IN_MOBILE_APPS', 'MOBILE_APP_INSTALL'],
    medianBudgetInr: 450_000,
  },
  'conv-auto': {
    ...BASE,
    key: 'conv-auto',
    ioType: 'STANDARD',
    objective: 'CONVERSIONS',
    control: 'IO_AUTOMATED',
    kpi: 'CPA',
    kpiValue: 480,
    liTypes: ['DISPLAY', 'VIDEO', 'DISPLAY'],
    medianBudgetInr: 640_000,
  },
  custom: {
    ...BASE,
    key: 'custom',
    ioType: 'STANDARD',
    objective: 'CUSTOM',
    control: 'LI_CONTROLLED',
    kpi: 'VALUE_COST',
    kpiValue: 1.2,
    liTypes: ['DISPLAY', 'VIDEO', 'AUDIO'],
    medianBudgetInr: 300_000,
  },
  'none-yt': {
    ...BASE,
    key: 'none-yt',
    ioType: 'STANDARD',
    objective: 'NONE',
    control: 'LI_CONTROLLED',
    kpi: 'CPM',
    kpiValue: 120,
    ytReachFreqOptimization: true,
    liTypes: ['DISPLAY', 'VIDEO', 'DISPLAY'],
    medianBudgetInr: 360_000,
  },
  'brand-impr': {
    ...BASE,
    key: 'brand-impr',
    ioType: 'STANDARD',
    objective: 'BRAND_AWARENESS',
    control: 'LI_CONTROLLED',
    kpi: 'VIEWABLE_PCT',
    kpiValue: 60,
    budgetUnit: 'IMPRESSIONS',
    liTypes: ['AUDIO', 'VIDEO', 'DISPLAY'],
    medianBudgetInr: 400_000,
  },
  'clicks-daily': {
    ...BASE,
    key: 'clicks-daily',
    ioType: 'STANDARD',
    objective: 'CLICKS',
    control: 'IO_AUTOMATED',
    kpi: 'CTR',
    kpiValue: 0.4,
    pacingPeriod: 'DAILY',
    liTypes: ['DISPLAY', 'VIDEO', 'DISPLAY'],
    medianBudgetInr: 280_000,
  },
  'conv-multiseg': {
    ...BASE,
    key: 'conv-multiseg',
    ioType: 'STANDARD',
    objective: 'CONVERSIONS',
    control: 'LI_CONTROLLED',
    kpi: 'CPA',
    kpiValue: 520,
    segments: 3,
    liTypes: ['DEMAND_GEN', 'DISPLAY', 'AUDIO'],
    medianBudgetInr: 540_000,
  },
  ctv: {
    ...BASE,
    key: 'ctv',
    ioType: 'CTV_OTT',
    objective: 'BRAND_AWARENESS',
    control: 'LI_CONTROLLED',
    kpi: 'CPM',
    kpiValue: 750,
    liTypes: ['CTV', 'CTV', 'CTV'],
    medianBudgetInr: 900_000,
  },
  dooh: {
    ...BASE,
    key: 'dooh',
    ioType: 'DOOH',
    objective: 'NONE',
    control: 'LI_CONTROLLED',
    kpi: null,
    kpiValue: null,
    liTypes: ['DOOH_DISPLAY', 'DOOH_VIDEO', 'DOOH_DISPLAY'],
    medianBudgetInr: 500_000,
  },
};

/**
 * Recipe for each IO slot of the default layout (2 advertisers, 3 campaigns, 2 IOs). Slot key is `${campaign}.${io}`.
 * Campaign 0 and 1 are active; campaign 2 is paused for the first advertiser and archived for the second.
 */
const SLOTS: readonly Record<string, RecipeKey>[] = [
  {
    '0.0': 'brand-auto',
    '0.1': 'clicks-autoalloc',
    '1.0': 'ctv',
    '1.1': 'dooh',
    '2.0': 'none-yt',
    '2.1': 'brand-impr',
  },
  {
    '0.0': 'conv-auto',
    '0.1': 'conv-multiseg',
    '1.0': 'ctv',
    '1.1': 'dooh',
    '2.0': 'clicks-daily',
    '2.1': 'custom',
  },
];

const FALLBACK: readonly RecipeKey[] = [
  'brand-auto',
  'clicks-autoalloc',
  'conv-auto',
  'custom',
  'none-yt',
  'brand-impr',
  'clicks-daily',
  'conv-multiseg',
];

export function recipeFor(advertiser: number, campaign: number, io: number): Recipe {
  const fixed = SLOTS[advertiser % SLOTS.length]?.[`${campaign}.${io}`];
  if (fixed) return RECIPES[fixed];
  const n = advertiser * 31 + campaign * 7 + io;
  return RECIPES[FALLBACK[n % FALLBACK.length] as RecipeKey];
}
