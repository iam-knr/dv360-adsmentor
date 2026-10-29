// Core types (validation.md 6.3) plus the input DTOs and context snapshots of the Campaign, IO and Line item domains.
// Everything here is plain serialisable data, so the same context can be built on the server and sent to the browser.
import type { CurrencyCode } from '@/lib/money';
import type { BidPriority } from './constants/bids';
import type { LiCountingMode } from './constants/conversions';
import type { AppAdType, CreativeFormat } from './constants/creatives';
import type { FreqMode, FreqPeriod } from './constants/frequency';
import type { CampaignGoal, Kpi } from './constants/goals-kpis';
import type { BidStrategy, IoObjective, IoType } from './constants/io-matrix';
import type { LiType } from './constants/li-compat';
import type { OptimizationMode, PacingPeriod, PacingType } from './constants/pacing';

export type { CampaignGoal, Kpi } from './constants/goals-kpis';
export type { BidStrategy, IoObjective, IoType } from './constants/io-matrix';
export type { LiType } from './constants/li-compat';
export type { FreqMode, FreqPeriod } from './constants/frequency';
export type { PacingPeriod, PacingType, OptimizationMode } from './constants/pacing';
export type { LiCountingMode } from './constants/conversions';
export type { AppAdType, CreativeFormat } from './constants/creatives';
export type { BidPriority } from './constants/bids';

export type Severity = 'error' | 'warning' | 'info';
export type Trigger = 'blur' | 'save' | 'cross' | 'activate'; // B, S, X, A in the tables

/** `generic` is the pseudo kind of the GEN primitives (validation.md 2.1); it is not an entity. */
export type EntityKind =
  | 'generic'
  | 'partner'
  | 'advertiser'
  | 'campaign'
  | 'insertionOrder'
  | 'lineItem'
  | 'adGroup'
  | 'ad'
  | 'targetingTemplate'
  | 'creative'
  | 'audience'
  | 'instantDeal'
  | 'deal'
  | 'dealGroup'
  | 'channel'
  | 'keywordList'
  | 'locationList'
  | 'floodlightGroup'
  | 'floodlightConversion'
  | 'customBidding'
  | 'abTest'
  | 'liftStudy'
  | 'plan'
  | 'report'
  | 'user'
  | 'sdfUpload';

export type RoleKey =
  'ADMIN' | 'STANDARD' | 'READ_ONLY' | 'REPORTING_ONLY' | 'PARTNER_CLIENT' | 'CREATIVE' | 'SYSTEM';

export type IssueParams = Record<string, string | number>;

export interface Issue {
  ruleId: string; // 'CMP-013'
  severity: Severity;
  path: string; // 'kpi.type', 'budget.segments[1].amount'
  message: string; // already formatted
  params?: IssueParams;
  blocking: boolean; // severity === 'error'
}

/** What check() returns; the engine adds id, severity and message. */
export interface Violation {
  path: string;
  params?: IssueParams;
  message?: string; // only when one rule has two wordings (LI-072, LI-091)
}

export interface Rule<T> {
  id: string;
  kind: EntityKind;
  severity: Severity;
  triggers: readonly Trigger[]; // first moment the rule may run; save/activate always run everything
  reads: readonly string[]; // field paths the rule depends on (blur and cross selection)
  message: string | null; // null = documentation-only rule (never emitted)
  needs?: readonly (keyof ValidationContext['lookups'])[]; // rule is skipped when the lookup is not loaded
  suppressedBy?: readonly string[]; // dropped when one of these fired on the same entity
  appliesTo?: (e: T, ctx: ValidationContext) => boolean; // gates by type, mode, status
  check: (e: T, ctx: ValidationContext) => Violation | Violation[] | null;
  since?: string;
  retired?: boolean;
}

/** A rule of any entity, as stored in the registry. */
export type AnyRule = Rule<never>;

export interface ValidateOptions {
  trigger?: Trigger; // 'save' (default) runs all rules; 'blur'/'cross' run the subset
  changedPath?: string; // with 'blur' or 'cross': only rules whose `reads` contain this path
  targetStatus?: 'ACTIVE' | 'DRAFT' | 'PAUSED'; // 'ACTIVE' adds the 'activate' rules
  includeInfo?: boolean; // default true
}

export interface ValidationResult {
  issues: Issue[];
  /** Rules skipped because a lookup they need is not loaded (partial client run, 6.4 rule 2). */
  skipped: string[];
}

// ---------------------------------------------------------------------------------------------
// Form values. A number field can hold a number, the typed text or nothing.
// Money is in minor units (RC-019); percentages are plain numbers (50 means 50 %).
// ---------------------------------------------------------------------------------------------

export type Num = number | string | null | undefined;

export interface FrequencyCapInput {
  mode: FreqMode;
  maxImpressions?: Num;
  periodCount?: Num;
  period?: FreqPeriod | null;
}

export type CreativeType = 'DISPLAY' | 'VIDEO' | 'AUDIO';
export type BudgetUnit = 'CURRENCY' | 'IMPRESSIONS';

export interface CampaignBudgetRow {
  name?: string | null;
  amount?: Num;
  startDate?: string | null; // YYYY-MM-DD
  endDate?: string | null;
}

export interface CampaignInput {
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | null;
  goal: CampaignGoal | null;
  kpi?: { type?: Kpi | null; value?: Num; otherText?: string | null } | null;
  creativeTypes: CreativeType[];
  plannedSpend?: Num;
  startDate: string | null;
  endDate?: string | null;
  frequencyCap: FrequencyCapInput;
  budgetUnit?: BudgetUnit;
  budgets: CampaignBudgetRow[];
  landingPageUrls: string[];
  keywords: string[];
}

export interface FeeInput {
  type?: string | null;
  amount?: Num; // CPM fee in money, media fee in percent
  system?: boolean; // media fee 1, locked
}

export interface PartnerCostsInput {
  cpmFees: FeeInput[];
  mediaFees: FeeInput[];
}

export interface BudgetSegmentInput {
  id?: string;
  /** Spent so far, in the budget unit. Set by the server on the stored copy (`ctx.original`) for IO-026. */
  spent?: number;
  amount?: Num;
  startDate?: string | null;
  endDate?: string | null;
}

export type EntityStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

export interface IoInput {
  name: string;
  status: EntityStatus | null;
  type: IoType | null;
  objective: IoObjective | null;
  budget: { type: BudgetUnit | null; segments: BudgetSegmentInput[] };
  pacing: { period: PacingPeriod | null; type: PacingType | null; dailyAmount?: Num };
  kpi?: { type?: Kpi | null; value?: Num } | null; // type null = "Any" / N/A
  optimization: {
    mode: OptimizationMode | null;
    optimizedTowards?: BidStrategy | null;
    autoBudgetAllocation?: boolean;
    youtubeReachFrequency?: boolean;
  };
  frequencyCap: FrequencyCapInput;
  partnerCosts: PartnerCostsInput;
  integrationCode?: string | null;
}

export type InventoryQuality =
  | 'AUTHORIZED_DIRECT_SELLERS'
  | 'AUTHORIZED_DIRECT_SELLERS_AND_RESELLERS'
  | 'AUTHORIZED_AND_NON_PARTICIPATING';

export interface LiTargetingInput {
  templateId?: string | null;
  /** DM `TargetingDimension` keys of the rows present in the card. */
  dimensions: string[];
  /** Rows the advertiser's rules lock (brand suitability, Open Measurement) that were removed or edited. */
  lockedRowsChanged?: string[];
  device?: { include: string[]; exclude: string[] } | null;
  environment?: { include: string[] } | null;
  position?: { onScreen: string[]; inContent: string[] } | null;
  /** 10..90 or 'ALL' (default). */
  predictedViewability?: number | 'ALL' | null;
  /** Countries the line item targets (LI-064). */
  countries?: string[];
}

export type EuPoliticalAds = 'YES' | 'NO';

export interface LineItemInput {
  name: string;
  status: EntityStatus | null;
  type: LiType | null;
  ioId: string | null;
  inventory: {
    quality: InventoryQuality | null;
    exchanges: string[];
    deals: string[];
    dealGroups: string[];
    targetCuratedCtv?: boolean;
  };
  flight: {
    mode: 'SAME_AS_IO' | 'CUSTOM' | null;
    startDate?: string | null;
    endDate?: string | null;
  };
  budget: { mode: 'UNLIMITED' | 'AMOUNT'; amount?: Num };
  pacing: { period: PacingPeriod | null; type: PacingType | null; dailyAmount?: Num };
  bid: {
    mode: 'AUTOMATED' | 'FIXED' | null;
    fixedCpm?: Num;
    optimizedTowards?: BidStrategy | null;
    priority?: BidPriority | null;
    targetValue?: Num;
    customBiddingAlgorithmId?: string | null;
  };
  frequencyCap: FrequencyCapInput;
  creatives: string[];
  conversions: {
    activities: string[];
    countingMode: LiCountingMode | null;
    postViewPct?: Num;
    attributionModelId?: string | null;
  };
  euPoliticalAds: EuPoliticalAds | null;
  revenueModel?: { type: 'TOTAL_MEDIA_COST_MARKUP' | 'CPM_VALUE' | null; value?: Num } | null;
  partnerCosts: PartnerCostsInput;
  integrationCode?: string | null;
  targeting: LiTargetingInput;
  app?: { platform?: 'ALL' | 'IOS' | 'ANDROID' | null; storeId?: string | null } | null;
  adType?: AppAdType | null;
  /** Type of the line item the settings were copied from (LI-120). */
  copiedFromType?: LiType | null;
  /** Demand Gen ads (LI-DG-007..009). */
  ads?: { headline?: string | null; description?: string | null; businessName?: string | null }[];
}

// ---------------------------------------------------------------------------------------------
// Context snapshots: plain DTOs the caller builds (6.3). Rules never read a database.
// ---------------------------------------------------------------------------------------------

export interface PartnerSnapshot {
  enabledExchangeIds: string[];
  sdfVersion?: string;
}

export interface AdvertiserSnapshot {
  currency: CurrencyCode;
  timeZone: string; // IANA, "today" is the date in this zone
  demandGenFloodlightOptimization: boolean;
  googleInventoryEnabled: boolean;
  appAttributionLinked: boolean;
  attributionModelIds: string[];
  businessName?: string | null;
}

export interface CampaignSnapshot {
  id?: string;
  goal: CampaignGoal | null;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  frequencyCap: FrequencyCapInput;
}

export interface IoSnapshot {
  id?: string;
  type: IoType;
  objective: IoObjective;
  mode: OptimizationMode;
  optimizedTowards?: BidStrategy | null;
  status: EntityStatus;
  budgetType: BudgetUnit;
  /** Sum of all segments (minor units or impressions). */
  budgetTotal: number;
  /** Earliest segment start and latest segment end. Null when the IO has no dated segment. */
  flight: { start: string; end: string } | null;
  frequencyCap: FrequencyCapInput;
}

export interface LineItemSnapshot {
  id: string;
  type: LiType;
  status: EntityStatus;
  /** Fixed budget amount, null for "Unlimited up to the insertion order's budget". */
  budgetAmount?: number | null;
  flight?: { mode: 'SAME_AS_IO' | 'CUSTOM'; startDate?: string | null; endDate?: string | null };
  pacingType?: PacingType | null;
  bidMode?: 'AUTOMATED' | 'FIXED' | null;
  optimizedTowards?: BidStrategy | null;
}

export interface AdGroupSnapshot {
  id: string;
  status: 'ACTIVE' | 'PAUSED';
  adCount: number;
}

export interface ExchangeInfo {
  id: string;
  name: string;
  isDooh: boolean;
}

export interface DealInfo {
  id: string;
  accessible: boolean;
  exchangeEnabled: boolean;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'COMPLETED' | 'NOT_SERVABLE';
}

export interface CreativeInfo {
  id: string;
  format: CreativeFormat;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  review: 'PENDING' | 'SERVABLE' | 'NOT_SERVABLE';
  exchangeStatus: Record<string, 'APPROVED' | 'PENDING' | 'DISAPPROVED'>;
  restrictedCountries: string[];
  width?: number;
  height?: number;
}

export interface FloodlightInfo {
  id: string;
  status: 'ACTIVE' | 'ARCHIVED';
  linkedToAdvertiser: boolean;
}

export interface CustomBiddingInfo {
  id: string;
  status: 'TRAINING' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
}

export interface TemplateInfo {
  id: string;
  liType: LiType;
}

export interface ValidationContext {
  mode: 'create' | 'edit';
  now: Date; // simulation clock; "today" uses advertiser.timeZone
  actor: { userId: string; role: RoleKey; limitedAccess: boolean };
  /** Where the input came from. SDF rows get the EU political ads default (LI-081). */
  source?: 'form' | 'sdf' | 'bulk';
  original?: unknown; // stored entity (edit mode) for lock rules
  partner: PartnerSnapshot;
  advertiser: AdvertiserSnapshot;
  campaign?: CampaignSnapshot;
  io?: IoSnapshot;
  children?: { lineItems?: LineItemSnapshot[]; adGroups?: AdGroupSnapshot[] };
  /** Scenario hook (6.6): soft rules (warning, info) an instructor switched off. Errors cannot be disabled. */
  disabledRules?: readonly string[];
  lookups: Partial<{
    exchanges: Map<string, ExchangeInfo>;
    deals: Map<string, DealInfo>;
    creatives: Map<string, CreativeInfo>;
    floodlightActivities: Map<string, FloodlightInfo>;
    customBidding: Map<string, CustomBiddingInfo>;
    templates: Map<string, TemplateInfo>;
  }>;
}

// ---------------------------------------------------------------------------------------------
// Creative domain (module 12, validation.md 2.18). Added by P4-01.
// ---------------------------------------------------------------------------------------------

export type CreativeKindKey =
  | 'STANDARD_IMAGE'
  | 'STANDARD_HTML5'
  | 'THIRD_PARTY_DISPLAY'
  | 'NATIVE_SITE'
  | 'NATIVE_VIDEO'
  | 'VIDEO_FILE'
  | 'YOUTUBE_VIDEO'
  | 'AUDIO_FILE'
  | 'THIRD_PARTY_VIDEO'
  | 'THIRD_PARTY_AUDIO';

/** A file the form attached. The service fills these from the `Upload` row, never from the client (module 12 4.3). */
export interface CreativeAssetInput {
  uploadId?: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  /** HTML5 zip: the archive holds exactly one HTML entry file (set by the service after reading the zip). */
  entryHtml?: boolean;
}

export interface NativeFieldsInput {
  headline?: string | null;
  body?: string | null;
  callToAction?: string | null;
  advertiserName?: string | null;
  displayUrl?: string | null;
}

export interface CreativeInput {
  kind: CreativeKindKey;
  formatKey?: string | null;
  name: string;
  /** Edit only. */
  status?: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | null;
  landingPageUrl?: string | null;
  width?: Num;
  height?: Num;
  durationSeconds?: Num;
  thirdPartyTag?: string | null;
  /** VAST tag URL or XML. */
  vastTag?: string | null;
  /** YouTube URL or 11-character id as typed. */
  youtubeVideo?: string | null;
  requiresMraid?: boolean;
  requiresHtml5?: boolean;
  expandDirection?: string;
  expandsOnHover?: boolean;
  dontScaleToFit?: boolean;
  appendTrackingTag?: boolean;
  requiresPing?: boolean;
  aiLabel?: 'UNSET' | 'AI_GENERATED' | 'NOT_AI_GENERATED';
  integrationCode?: string | null;
  notes?: string | null;
  skippable?: boolean;
  skipOffsetSec?: Num;
  impressionTrackerUrl?: string | null;
  clickTrackerUrl?: string | null;
  native?: NativeFieldsInput;
  mainAsset?: CreativeAssetInput | null;
  logoAsset?: CreativeAssetInput | null;
  /** Optimized (format gallery) asset group. */
  optimized?: {
    headlines: string[];
    descriptions: string[];
    imageCount: number;
    logoCount: number;
    businessName?: string | null;
    callToAction?: string | null;
  } | null;
  /** Edit and appeal context filled by the service. */
  source?: 'DV360' | 'CM360' | 'THIRD_PARTY';
  activeLineItemCount?: number;
  /** Appeal request: true when the creative is servable and approved on every exchange (CRE-043). */
  appeal?: { servableEverywhere: boolean };
}
