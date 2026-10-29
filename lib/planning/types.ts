// Wire and domain types of module 04 (spec 4.1 to 4.3, 4.9). Dates are YYYY-MM-DD, instants ISO strings.
import type { PlanDemographics } from './countries';

export type PlanStatusKey = 'PLANNED' | 'TRAFFICKED';
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

export interface PlanAdditional {
  frequencyGoal: number;
  reachBasis: ReachBasisKey;
  includeYoutube: boolean;
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
  budget: number;
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
}
