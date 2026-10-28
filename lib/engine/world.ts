// World: the read-only snapshot of entities one tick reads (engine.md 1.1). The io layer
// (P3-08b) fills it from the database; the core never reads anything else.
// Money fields are in the advertiser currency (budgets, bids, fees). Dates are YYYY-MM-DD
// in the advertiser time zone.

import type { BidGoal, Device, Environment, Format, LineItemType } from './types';

export type EntityStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type FreqUnit = 'MINUTE' | 'HOUR' | 'DAY' | 'WEEK' | 'MONTH';

export interface FrequencyCap {
  mode: 'INHERIT' | 'UNLIMITED' | 'LIMITED';
  maxExposures?: number;
  unit?: FreqUnit;
  unitCount?: number;
}

export interface BudgetSegment {
  id: string;
  amount: number;
  startDay: string;
  endDay: string;
}

export interface PartnerCost {
  kind: 'CPM_FEE' | 'MEDIA_FEE';
  slot: 1 | 2;
  /** CPM in advertiser currency for CPM fees, a fraction (0.05 = 5%) for media fees. */
  amount: number;
  invoiced: boolean;
}

export type AlertCode =
  | 'NO_SPEND_LI'
  | 'NO_SPEND_IO'
  | 'UNDERPACING_IO'
  | 'CONFLICT_IO'
  | 'CONFLICT_LI'
  | 'LIMITED_AUDIENCE_LI'
  | 'UNDERPERFORMING_IO'
  | 'RESTRICTED_AUDIENCE_LIST_LI'
  | 'CREATIVE_REJECTED'
  | 'CREATIVE_RESTRICTED'
  | 'SPEND_THRESHOLD';

export interface AlertPrefs {
  /** Missing key means enabled (SPEND_THRESHOLD is off unless a threshold is set). */
  enabled?: Partial<Record<AlertCode, boolean>>;
  underpacingThresholdPct?: number;
  /** Advertiser spend yesterday above this raises SPEND_THRESHOLD. */
  spendThreshold?: number;
}

export interface AdvertiserEntity {
  id: string;
  currency: string;
  tzOffsetMin: number;
  vertical: string;
  alertPrefs: AlertPrefs;
}

export interface CampaignEntity {
  id: string;
  status: EntityStatus;
  frequency: FrequencyCap;
}

export type IoKpi = {
  kind: 'CPM' | 'CPC' | 'CTR' | 'CPA' | 'CVR' | 'VCPM' | 'VIEWABILITY' | 'CPV' | 'VTR';
  value: number;
};

export interface IoEntity {
  id: string;
  campaignId: string;
  status: EntityStatus;
  budgetUnit: 'CURRENCY' | 'IMPRESSIONS';
  segments: BudgetSegment[];
  pacing: { period: 'FLIGHT' | 'DAILY'; type: 'AHEAD' | 'EVEN' | 'ASAP'; dailyAmount?: number };
  bidBudgetControl: 'IO_AUTOMATED' | 'LI_CONTROLLED';
  optimizeTarget?:
    | 'MAX_VIEWABLE_IMPRESSIONS'
    | 'MAX_VIEWABLE_10S'
    | 'MAX_COMPLETED_IN_VIEW_AUDIBLE'
    | 'MAX_CUSTOM_VALUE_COST'
    | 'MAX_REACH';
  autoBudgetAllocation: boolean;
  frequency: FrequencyCap;
  kpi?: IoKpi;
  partnerCosts: PartnerCost[];
}

export interface ListSelection {
  include?: string[];
  exclude?: string[];
}

export interface TargetingSpec {
  /** Selected inventory sources (engine exchange keys). Undefined means all enabled exchanges. */
  exchanges?: string[];
  environment?: Environment[];
  devices?: Device[];
  geo?: {
    includeRegions?: string[];
    excludeRegions?: string[];
    pincodes?: { region: string; count: number }[];
  };
  languages?: string[];
  daypart?: { windows: { days: number[]; startHour: number; endHour: number }[] };
  deviceDetail?: ListSelection;
  browser?: ListSelection;
  connection?: ListSelection;
  carrier?: ListSelection;
  /** Predicted viewability threshold, 0.5 to 0.9. */
  viewabilityMin?: number;
  position?: ListSelection;
  /** Restrict to formats (for example native only). */
  formats?: Format[];
  categories?: ListSelection;
  keywords?: { includeCount: number; negativeCount?: number };
  appUrl?: { includeCount?: number; excludeCount?: number };
  brandSuitability?: {
    mode?: 'maximum' | 'standard' | 'limited';
    excludedLabels?: number;
    excludedCategories?: number;
  };
  /** Pre-bid verification options, keys of params.costs.verificationCpm. */
  verification?: string[];
  demographics?: { age?: string[]; gender?: string[]; parental?: string[]; income?: string[] };
  audiences?: { includeGroups?: string[][]; exclude?: string[] };
}

export interface LineItemEntity {
  id: string;
  ioId: string;
  status: EntityStatus;
  type: LineItemType;
  inventoryQuality: 'DIRECT_ONLY' | 'DIRECT_AND_RESELLERS' | 'ALL';
  /** Custom flight (advertiser dates); undefined inherits the IO segments. */
  flight?: { start: string; end: string };
  budget: { mode: 'UNLIMITED_UP_TO_IO' | 'FIXED'; amount?: number };
  pacing: { period: 'FLIGHT' | 'DAILY'; type: 'AHEAD' | 'EVEN' | 'ASAP'; dailyAmount?: number };
  bid: { kind: 'FIXED' | 'AUTOMATED'; fixedCpm?: number; goal?: BidGoal; targetValue?: number };
  frequency: FrequencyCap;
  targeting: TargetingSpec;
  creativeIds: string[];
  floodlight: { activityId: string; postClickWindowDays?: number; postViewWindowDays?: number }[];
  conversionCounting: { mode: 'ALL' | 'POST_CLICK_ONLY' | 'PERCENTAGE'; pct?: number };
  attributionModel: 'last_click' | 'linear' | 'time_decay' | 'position_based' | 'data_driven';
  revenueModel: {
    type: 'TOTAL_MEDIA_COST_MARKUP' | 'MEDIA_COST_MARKUP' | 'CPM_VALUE';
    markup?: number;
    cpm?: number;
  };
  /** Undefined inherits the IO's partner costs. */
  partnerCosts?: PartnerCost[];
  optimizedTargeting: boolean;
  creativeOptimization: boolean;
}

export type ApprovalState = 'APPROVED' | 'PENDING' | 'DISAPPROVED';

export interface CreativeEntity {
  id: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  type: 'display' | 'native' | 'video' | 'audio';
  /** Display and native slot size such as '300x250'. */
  size?: string;
  dv360Servable: boolean;
  /** Exchange approval; key '*' is the default for exchanges not listed. */
  approval: Record<string, ApprovalState>;
  restrictedRegions?: string[];
  mraid?: boolean;
  rich?: boolean;
  scaled?: boolean;
  trackingIssue?: boolean;
  /** Instructor override of the quality multiplier (0.7 to 1.3). */
  qualityOverride?: number;
  advancedAdServingCpm?: number;
}

export interface AudienceEntity {
  id: string;
  type: 'affinity' | 'in_market' | 'custom' | 'first_party' | 'lookalike' | 'demographics';
  /** First-party list size in users. */
  size?: number;
  /** Fraction of the regional user pool; when missing it is derived from the id inside the type's range. */
  sizeFraction?: number;
  /** Lookalike reach setting, percent (1 to 5). */
  reachPct?: number;
  /** Sim hours after which the list is usable; ticks, relative to simStart. */
  usableFromTick?: number;
  dataCpm?: number;
  restricted?: boolean;
  seedSize?: number;
}

export type FloodlightCategory =
  | 'purchase'
  | 'add_to_cart'
  | 'begin_checkout'
  | 'subscribe'
  | 'contact'
  | 'submit_lead_form'
  | 'book_appointment'
  | 'sign_up'
  | 'request_quote'
  | 'get_directions'
  | 'outbound_click'
  | 'qualified_lead'
  | 'converted_lead'
  | 'page_view';

export interface FloodlightActivity {
  id: string;
  name: string;
  type: 'counter' | 'sale';
  countingMethod: 'standard' | 'unique' | 'perSession' | 'transactions' | 'itemsSold';
  category: FloodlightCategory;
  cvrClickMult?: number;
  cvrViewMult?: number;
  avgOrderValue?: number;
  itemsPerTxn?: number;
  repeatPerUserDay?: number;
  repeatPerSession?: number;
  tagStatus: 'active' | 'broken' | 'inactive';
  remarketing?: boolean;
}

export interface World {
  sandboxId: string;
  marketSeed: string;
  sandboxSeed: string;
  /** Epoch ms of tick 0, aligned to local midnight of the sandbox time zone. */
  simStartMs: number;
  /** Sandbox time zone offset from UTC in minutes (330 for Asia/Kolkata). */
  tzOffsetMin: number;
  /** Market key in params.markets, for example 'IN'. */
  country: string;
  partner: { id: string; currency: string; enabledExchanges?: string[] };
  advertiser: AdvertiserEntity;
  campaigns: CampaignEntity[];
  insertionOrders: IoEntity[];
  lineItems: LineItemEntity[];
  creatives: CreativeEntity[];
  audiences: AudienceEntity[];
  floodlightActivities: FloodlightActivity[];
  /** Deals are out of scope for P3-08a; the field exists so the io layer can fill it later. */
  deals: never[];
}

export interface WorldIndex {
  campaigns: Map<string, CampaignEntity>;
  ios: Map<string, IoEntity>;
  lis: Map<string, LineItemEntity>;
  creatives: Map<string, CreativeEntity>;
  audiences: Map<string, AudienceEntity>;
  activities: Map<string, FloodlightActivity>;
  /** Line items sorted by id (engine.md 1.3 entity order). */
  sortedLis: LineItemEntity[];
  sortedIos: IoEntity[];
}

const indexCache = new WeakMap<World, WorldIndex>();

export function indexWorld(w: World): WorldIndex {
  const hit = indexCache.get(w);
  if (hit) return hit;
  const byId = <T extends { id: string }>(xs: T[]): Map<string, T> =>
    new Map(xs.map((x) => [x.id, x]));
  const cmp = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const idx: WorldIndex = {
    campaigns: byId(w.campaigns),
    ios: byId(w.insertionOrders),
    lis: byId(w.lineItems),
    creatives: byId(w.creatives),
    audiences: byId(w.audiences),
    activities: byId(w.floodlightActivities),
    sortedLis: [...w.lineItems].sort(cmp),
    sortedIos: [...w.insertionOrders].sort(cmp),
  };
  indexCache.set(w, idx);
  return idx;
}
