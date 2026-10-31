// Wire and domain types of module 04 (spec 4.1 to 4.3, 4.9). Dates are YYYY-MM-DD, instants ISO strings.
import type { PlanDemographics } from './countries';

export type PlanStatusKey = 'PLANNED' | 'TRAFFICKED' | 'ARCHIVED';
export type PlanBuyingMethodKey =
  | 'OPEN_AUCTION'
  | 'PROGRAMMATIC_GUARANTEED'
  | 'PREFERRED_DEAL'
  | 'PRIVATE_AUCTION'
  | 'YOUTUBE_RESERVE';
export type PlanChannelKey = 'DIGITAL' | 'TV' | 'CROSS_MEDIA';
export type ReachBasisKey = 'CENSUS' | 'DIGITAL';

export const BUYING_METHOD_LABEL: Record<PlanBuyingMethodKey, string> = {
  OPEN_AUCTION: 'Open Auction',
  PROGRAMMATIC_GUARANTEED: 'Programmatic Guaranteed',
  PREFERRED_DEAL: 'Preferred Deal',
  PRIVATE_AUCTION: 'Private Auction',
  YOUTUBE_RESERVE: 'YouTube Reserve',
};
export const BUYING_METHODS = Object.keys(BUYING_METHOD_LABEL) as PlanBuyingMethodKey[];
/** Methods that need a deal (PLN-025). */
export const DEAL_METHODS: PlanBuyingMethodKey[] = [
  'PROGRAMMATIC_GUARANTEED',
  'PREFERRED_DEAL',
  'PRIVATE_AUCTION',
];
/** Methods whose CPM is fixed by the deal (spec 2.4). */
export const LOCKED_CPM_METHODS: PlanBuyingMethodKey[] = [
  'PROGRAMMATIC_GUARANTEED',
  'PREFERRED_DEAL',
  'YOUTUBE_RESERVE',
];
export const CHANNEL_LABEL: Record<PlanChannelKey, string> = {
  DIGITAL: 'Digital',
  TV: 'TV',
  CROSS_MEDIA: 'Cross-media',
};

export type InventoryQuality = 'AUTHORIZED_AND_NON_PARTICIPATING' | 'AUTHORIZED';
export type ViewabilityGoal = 'NONE' | 'MRC_50' | 'PREDICTED_70';

export const INVENTORY_QUALITY_LABEL: Record<InventoryQuality, string> = {
  AUTHORIZED_AND_NON_PARTICIPATING: 'Authorized and Non-Participating Publishers',
  AUTHORIZED: 'Authorized Publishers',
};
export const VIEWABILITY_LABEL: Record<ViewabilityGoal, string> = {
  NONE: 'No restrictions',
  MRC_50: 'Viewable at least 50% (Open Measurement)',
  PREDICTED_70: 'Predicted viewability 70% or higher',
};

/** Additional Settings (explore 19 section 3). The last three do not change the forecast; they are kept on the plan. */
export interface PlanAdditional {
  frequencyGoal: number;
  reachBasis: ReachBasisKey;
  includeYoutube: boolean;
  inventoryQuality?: InventoryQuality;
  publicInventory?: boolean;
  viewability?: ViewabilityGoal;
  brandSuitability?: 'NO_RESTRICTIONS' | 'EXCLUDE_SENSITIVE';
}

export interface PlanListRow {
  id: string;
  publicId: string;
  name: string;
  totalBudget: number | null;
  currencyCode: string;
  startDate: string;
  endDate: string;
  channels: string[];
  status: PlanStatusKey;
}

export interface PlanRowDto {
  id: string;
  ordinal: number;
  name: string;
  buyingMethod: PlanBuyingMethodKey;
  dealId: string | null;
  locations: string[];
  startDate: string;
  endDate: string;
  targeting: Record<string, unknown>;
  audienceRefs: string[];
  budgetNet: number;
  budgetTotal: number;
  feePct: number;
  maxCpm: number | null;
  isCpmLocked: boolean;
  pricing: string;
}

export interface PlanRowInput {
  id?: string;
  name: string;
  buyingMethod: PlanBuyingMethodKey;
  dealId?: string | null;
  locations?: string[];
  startDate: string;
  endDate: string;
  targeting?: Record<string, unknown>;
  audienceRefs?: string[];
  budgetNet: number;
  maxCpm?: number | null;
}

export interface PlanRowForecast {
  onTargetReachPct: number;
  onTargetFrequency: number;
  trps: number;
  costPerReach: number;
  cpa: number | null;
  onTargetImpressions: number;
  billableUnits: number;
  billableUnitLabel: string;
  avgCost: number;
  avgCostLabel: string;
  maxCpm: number | null;
  viewableCpm: number;
  viewabilityRate: number | null;
  /** Share of the plan budget (percent). */
  budgetSharePct: number;
  /** Percent of the row budget expected to be spent: below 100 when Max CPM is under the expected CPM. */
  expectedSpendPct?: number;
}

export type ForecastTabKey = 'REACH' | 'TRUEVIEW' | 'CONVERSIONS' | 'DEMOGRAPHICS' | 'DEVICES';

export interface SeriesPoint {
  label: string;
  [metric: string]: number | string;
}

export interface PlanForecast {
  asOf: string;
  reachPct: number;
  /** On-target reach in people. */
  reach: number;
  avgFrequency: number;
  totalCpm: number;
  onTargetCpm: number;
  trps: number;
  cpp: number;
  population: { census: number; digital: number; tv: number; youtube: number };
  cpa: number | null;
  actionCpa: number | null;
  viewableCpm: number;
  viewabilityRate: number | null;
  /** Reach at 1+ .. 10+ (percent of the target). */
  reachByFrequency: number[];
  /** Spend the forecast expects, incl. fees: below `plannedBudget` when a Max CPM limits delivery. */
  budget: number;
  /** What the line items ask for, incl. fees (the sum of the row budgets). Older snapshots have no value. */
  plannedBudget?: number;
  impressions: number;
  perRow: Record<string, PlanRowForecast>;
  tabs: Record<ForecastTabKey, SeriesPoint[]>;
  inputsHash: string;
}

export interface PlanHeader {
  name: string;
  location: string;
  currencyCode: string;
  dates: { start: string; end: string };
  demographics: PlanDemographics;
  additional: PlanAdditional;
  channels: PlanChannelKey[];
}

export interface PlanDto {
  id: string;
  publicId: string;
  header: PlanHeader;
  forecast: PlanForecast | null;
  rows: PlanRowDto[];
  savedAt: string | null;
  locked: boolean;
  stale: boolean;
  status: PlanStatusKey;
  convertedCampaignId: string | null;
  convertedCampaignPublicId: string | null;
  version: number;
  canWrite: boolean;
  simToday: string;
  /** Row id of the advertiser: the key the audience catalogue and the targeting editors use. */
  advertiserRowId: string;
}

/** Ad formats of the "Add ad formats" dialog (explore 19 section 3): label, buying method and row name. */
export interface AdFormatDef {
  id: string;
  group: string;
  label: string;
  buyingMethod: PlanBuyingMethodKey;
}
export const AD_FORMATS: readonly AdFormatDef[] = [
  {
    id: 'oa-display',
    group: 'Open auction',
    label: 'Open auction display',
    buyingMethod: 'OPEN_AUCTION',
  },
  {
    id: 'oa-video',
    group: 'Open auction',
    label: 'Open auction video',
    buyingMethod: 'OPEN_AUCTION',
  },
  {
    id: 'oa-audio',
    group: 'Open auction',
    label: 'Open auction audio',
    buyingMethod: 'OPEN_AUCTION',
  },
  {
    id: 'yt-skippable',
    group: 'YouTube & partners',
    label: 'YouTube skippable in-stream',
    buyingMethod: 'OPEN_AUCTION',
  },
  {
    id: 'yt-bumper',
    group: 'YouTube & partners',
    label: 'YouTube bumper',
    buyingMethod: 'OPEN_AUCTION',
  },
  {
    id: 'yt-reserve',
    group: 'YouTube & partners',
    label: 'YouTube reserve',
    buyingMethod: 'YOUTUBE_RESERVE',
  },
  {
    id: 'deal-pg',
    group: 'Existing deals',
    label: 'Programmatic guaranteed deal',
    buyingMethod: 'PROGRAMMATIC_GUARANTEED',
  },
  {
    id: 'deal-pd',
    group: 'Existing deals',
    label: 'Preferred deal',
    buyingMethod: 'PREFERRED_DEAL',
  },
  {
    id: 'deal-pa',
    group: 'Existing deals',
    label: 'Private auction deal',
    buyingMethod: 'PRIVATE_AUCTION',
  },
];
