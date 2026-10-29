// Wire types of the resource screens (module 15 4, routes.md 8.12). Client safe: no server or database imports.
// Ids on the wire are public ids as strings (routes.md R10).
import type { WireIssue } from '@/lib/campaigns/wire';
import type { ParseStats } from './parse-sites';

export type { WireIssue } from '@/lib/campaigns/wire';
export type { ParseStats } from './parse-sites';

export type OwnerScopeKey = 'ADVERTISER' | 'PARTNER';

export interface WriteMeta {
  /** Optimistic lock (routes.md 8.0): the `version` the form was loaded with. */
  expectedVersion?: number;
  changeNote?: string;
}

export interface UsingLineItem {
  publicId: string;
  name: string;
  /** Channels only: how the line item uses the channel. */
  flag?: 'Included' | 'Excluded';
}

// Channels ---------------------------------------------------------------------------------------

export interface ChannelRow {
  id: string;
  name: string;
  apps: number;
  urls: number;
  includedByLis: number;
  excludedByLis: number;
  ownerScope: OwnerScopeKey;
}

export interface ChannelView {
  id: string;
  name: string;
  /** The textarea text, one site per line. */
  sites: string;
  siteCount: number;
  stats: ParseStats;
  version: number;
  ownerScope: OwnerScopeKey;
  lineItems: UsingLineItem[];
}

export interface ChannelInput {
  name: string;
  /** Raw textarea text. */
  sites: string;
}

// Negative keyword lists ---------------------------------------------------------------------

export interface KeywordListRow {
  id: string;
  name: string;
  keywords: number;
  lineItems: number;
}

export interface KeywordListView {
  id: string;
  name: string;
  keywords: string;
  keywordCount: number;
  version: number;
  lineItems: UsingLineItem[];
}

export interface KeywordListInput {
  name: string;
  keywords: string;
}

// Location lists -----------------------------------------------------------------------------

export type LocationListTypeKey = 'REGIONAL' | 'PROXIMITY';

export interface LocationListRow {
  id: string;
  name: string;
  type: LocationListTypeKey;
  count: number;
  lineItems: number;
}

export interface ResolutionRow {
  line: number;
  text: string;
  resolvedAs: string;
  status: 'Resolved' | 'Not found';
}

export interface LocationListView {
  id: string;
  name: string;
  type: LocationListTypeKey;
  entries: string;
  entryCount: number;
  version: number;
  lineItems: UsingLineItem[];
}

export interface LocationListInput {
  name: string;
  type: LocationListTypeKey | null;
  entries: string;
}

// Floodlight ---------------------------------------------------------------------------------

export type PlatformKey = 'WEB' | 'MOBILE_APP' | 'CONNECTED_TV';
export type FormatKey = 'GOOGLE_TAG' | 'IFRAME_TAG' | 'IMAGE_TAG';
export type FloodlightTypeKey = 'COUNTER' | 'SALE';
export type CountingMethodKey =
  'STANDARD' | 'UNIQUE' | 'PER_SESSION' | 'TRANSACTIONS' | 'ITEMS_SOLD';

export interface FloodlightRow {
  id: string;
  name: string;
  status: 'ACTIVE' | 'ARCHIVED';
  source: 'Iframe tag' | 'Image tag' | 'Google tag';
  type: FloodlightTypeKey;
  countingMethod: CountingMethodKey;
  category: string | null;
  remarketing: boolean;
  youtubeTracking: boolean;
  lineItems: number;
  /** Proxy for "Impressions (Yesterday)" (conflicts C3): yesterday's conversions. */
  impressionsYesterday: number;
  platform: PlatformKey;
}

export interface FloodlightConversionInput {
  platform: PlatformKey | null;
  name: string;
  format: FormatKey | null;
  type: FloodlightTypeKey | null;
  countingMethod: CountingMethodKey | null;
  category: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  remarketing: boolean;
  youtubeEnabled: boolean;
  valueBasedBidding: boolean;
  commercePartner: boolean;
  personalizedAdExclusion: 'DONT_EXCLUDE' | 'EXCLUDE_ALL_LOCATIONS';
  customVariableKeys: string[];
  appId: string | null;
  ctvAppId: string | null;
  conversionEventName: string | null;
}

export function newConversionValue(platform: PlatformKey): FloodlightConversionInput {
  return {
    platform,
    name: '',
    format: 'GOOGLE_TAG',
    type: null,
    countingMethod: null,
    category: null,
    status: 'ACTIVE',
    remarketing: false,
    youtubeEnabled: false,
    valueBasedBidding: false,
    commercePartner: false,
    personalizedAdExclusion: 'DONT_EXCLUDE',
    customVariableKeys: [],
    appId: null,
    ctvAppId: null,
    conversionEventName: null,
  };
}

export interface FloodlightConversionView extends FloodlightConversionInput {
  id: string;
  version: number;
  lineItems: number;
}

export interface AttributionModelWire {
  id: string;
  name: string;
  kind: string;
  isPrimary: boolean;
}

export interface FloodlightGroupView {
  id: string;
  name: string;
  clickDays: number;
  impressionDays: number;
  imageTagOnly: boolean;
  dynamicTag: boolean;
  personalizedAdExclusion: 'DONT_EXCLUDE' | 'EXCLUDE_ALL_LOCATIONS';
  defaultConsent: Record<string, unknown> | null;
  importedDataConsent: Record<string, unknown> | null;
  viewableImpressionPct: number;
  engagedViewVariable: string | null;
  activeViewVariable: string | null;
  enhancedConversions: boolean;
  appAttributionPartners: string[];
  googleAnalyticsLinked: boolean;
  models: AttributionModelWire[];
  variables: { key: string; name: string; dataType: 'STRING' | 'NUMBER' }[];
  conversionGroups: { id: string; name: string; activityIds: string[] }[];
  activities: { id: string; name: string }[];
  googleTag: { tagId: string | null; status: string | null; lastSeenAt: string | null };
  version: number;
}

export interface FloodlightGroupInput {
  name?: string;
  clickDays?: number | string;
  impressionDays?: number | string;
  primaryModelId?: string;
  imageTagOnly?: boolean;
  dynamicTag?: boolean;
  personalizedAdExclusion?: 'DONT_EXCLUDE' | 'EXCLUDE_ALL_LOCATIONS';
  viewableImpressionPct?: number | string;
  appAttributionPartners?: string[];
  googleAnalyticsLinked?: boolean;
  enhancedConversions?: boolean;
  engagedViewVariable?: string | null;
  activeViewVariable?: string | null;
  customVariables?: { key: string; name: string; dataType: 'STRING' | 'NUMBER' }[];
  conversionGroups?: { id?: string; name: string; activityIds: string[] }[];
}

// Brand controls --------------------------------------------------------------------------------

export type BrandRowKey =
  'CONTENT_LABEL' | 'APPS_URLS_CHANNELS' | 'KEYWORDS' | 'AUTHORIZED_SELLERS' | 'VERIFICATION';

export interface BrandCoverageRow {
  key: BrandRowKey;
  title: string;
  enabled: number;
  total: number;
  /** 0 to 100, whole number. */
  pct: number;
  label: string;
  summary: string;
}

export interface BrandBreakdownRow {
  lineItemId: string;
  name: string;
  status: string;
  enabled: boolean;
  source: 'Line item' | 'Advertiser' | 'Partner' | '-';
}

export interface BrandControlsView {
  tab: 'display' | 'youtube';
  filter: 'active' | 'all';
  rows: BrandCoverageRow[];
  breakdown: Record<BrandRowKey, BrandBreakdownRow[]>;
  ivt: { date: string; blockedPct: number }[];
  totalLineItems: number;
}

// YouTube assets ------------------------------------------------------------------------------

export interface YoutubeAssetRow {
  id: string;
  name: string;
  filters: string;
  status: string;
  clicks: number;
  impressions: number;
  ctr: number | null;
  avgCpc: number | null;
  parentId: string | null;
}

export type { WireIssue as ResourceIssue };

// Custom bidding -----------------------------------------------------------------------------------

export type CbStatusKey = 'ACTIVE' | 'SUSPENDED' | 'TRAINING';
export type CbObjectiveWire = 'BRAND_AWARENESS' | 'CLICKS' | 'CONVERSIONS' | 'CUSTOM';

export interface CbRow {
  id: string;
  name: string;
  /** `RULES` on the wire (conflicts RC-009 maps it to `RULE_BASED`). */
  source: 'RULES' | 'SCRIPT' | 'GOAL';
  ownerScope: OwnerScopeKey;
  status: CbStatusKey;
  readinessPct: number;
  updatedAt: string;
  activeLineItems: number;
  /** Percent of impressions where a rule could not be evaluated. */
  errorPct: number;
}

export interface CbRuleWire {
  groupKey: string;
  signalKey: string;
  value: boolean;
  score: number;
}

export interface CbMultiplierWire {
  kind: string;
  values: { valueKey: string; multiplier: number }[];
}

export interface CbDraftInput {
  id?: string;
  name: string;
  objective: CbObjectiveWire | null;
  rules: CbRuleWire[];
  multipliers: CbMultiplierWire[];
}

export interface CbTestWire {
  sampleSize: number;
  matchedPct: number;
  histogram: number[];
  histogramMax: number;
  meanScore: number;
  p90Score: number;
  warnings: { kind: 'HARD' | 'SOFT'; message: string }[];
  passed: boolean;
  ranAt: string;
}

export interface CbView {
  id: string;
  name: string;
  objective: CbObjectiveWire;
  ownerScope: OwnerScopeKey;
  status: CbStatusKey;
  readinessPct: number;
  version: number;
  isDraft: boolean;
  rules: CbRuleWire[];
  multipliers: CbMultiplierWire[];
  /** The test run that still counts for the stored definition (CB-008); null after any edit. */
  lastTest: CbTestWire | null;
  lineItems: UsingLineItem[];
  /** Floodlight activities of the advertiser for `ACTIVITY:{id}` signals. */
  activities: { id: string; name: string }[];
}

export interface CbDeleteOutcome {
  deleted: boolean;
  usedBy: number;
}
