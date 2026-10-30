// Constants of module 17 (Δ17-9, 3.3): goals per channel scope (MX-14), report metrics, lift metrics, languages and
// object types. Pure data: no server-only imports, the seed runs under tsx too.
import type { BrandLiftMetric, ExperimentChannelScope, ExperimentGoal } from '@prisma/client';

export const AB_MAX_ARMS = 5; // Q1 proposal
export const AB_NAME_MAX = 100;
export const AB_HYPOTHESIS_MAX = 400;
export const AB_ARM_NAME_MAX = 200;
export const LS_NAME_MAX = 128;
export const LS_BRAND_MAX = 30;
export const LS_MAX_METRICS = 3;
export const LS_MAX_COMPETITORS = 3;
export const LS_MAX_GROUPS = 5;
export const LS_MAX_TERMS = 3;
/** Fewer survey responses than this in a slice read "Not enough data". */
export const LS_MIN_SLICE_RESPONSES = 100;

export const GOAL_LABEL: Record<ExperimentGoal, string> = {
  CLICKS: 'Clicks',
  CONVERSIONS: 'Conversions',
  REACH: 'Reach',
  CUSTOM_IMPRESSION_VALUE: 'Custom impression value',
  VIDEO_COMPLETIONS: 'Video completions',
  VIEWS_YOUTUBE: 'Views (YouTube)',
};

/** MX-14: goals offered for the channel scope of the arms. */
export const AB_GOALS_BY_SCOPE: Record<ExperimentChannelScope, ExperimentGoal[]> = {
  CROSS_EXCHANGE: ['CLICKS', 'CONVERSIONS', 'REACH', 'CUSTOM_IMPRESSION_VALUE', 'VIDEO_COMPLETIONS'],
  YOUTUBE: ['CLICKS', 'CONVERSIONS', 'REACH', 'VIEWS_YOUTUBE'],
  DEMAND_GEN: ['CLICKS', 'CONVERSIONS', 'REACH'],
  MIXED: ['CLICKS', 'CONVERSIONS', 'REACH'],
};

export const STANDARD_GOALS: ExperimentGoal[] = ['CLICKS', 'CONVERSIONS', 'REACH'];

/** Report metric picker (S4). `scopes` limits the channel-specific ones. */
export type AbMetric =
  | 'IMPRESSIONS'
  | 'CLICKS'
  | 'CONVERSIONS'
  | 'REACH'
  | 'VIDEO_COMPLETIONS'
  | 'AVOC'
  | 'CUSTOM_IMPRESSION_VALUE'
  | 'ENGAGEMENTS'
  | 'VIEWS';

export const AB_METRICS: { key: AbMetric; label: string; scopes: ExperimentChannelScope[] | null }[] = [
  { key: 'IMPRESSIONS', label: 'Impressions', scopes: null },
  { key: 'CLICKS', label: 'Clicks', scopes: null },
  { key: 'CONVERSIONS', label: 'Conversions', scopes: null },
  { key: 'REACH', label: 'Reach', scopes: null },
  { key: 'VIDEO_COMPLETIONS', label: 'Video completions', scopes: ['CROSS_EXCHANGE', 'MIXED'] },
  { key: 'AVOC', label: 'AVOC', scopes: ['CROSS_EXCHANGE', 'MIXED'] },
  { key: 'CUSTOM_IMPRESSION_VALUE', label: 'Custom impression value', scopes: ['CROSS_EXCHANGE', 'MIXED'] },
  { key: 'ENGAGEMENTS', label: 'Engagements', scopes: ['CROSS_EXCHANGE', 'DEMAND_GEN', 'YOUTUBE', 'MIXED'] },
  { key: 'VIEWS', label: 'Views (YouTube)', scopes: ['YOUTUBE', 'MIXED'] },
];

export const metricsForScope = (scope: ExperimentChannelScope) =>
  AB_METRICS.filter((m) => !m.scopes || m.scopes.includes(scope));

export const GOAL_TO_METRIC: Record<ExperimentGoal, AbMetric> = {
  CLICKS: 'CLICKS',
  CONVERSIONS: 'CONVERSIONS',
  REACH: 'REACH',
  CUSTOM_IMPRESSION_VALUE: 'CUSTOM_IMPRESSION_VALUE',
  VIDEO_COMPLETIONS: 'VIDEO_COMPLETIONS',
  VIEWS_YOUTUBE: 'VIEWS',
};

export const BRAND_METRIC_LABEL: Record<BrandLiftMetric, string> = {
  VIDEO_AD_RECALL: 'Video ad recall',
  AWARENESS: 'Awareness',
  CONSIDERATION: 'Consideration',
  FAVORABILITY: 'Favorability',
  PURCHASE_INTENT: 'Purchase intent',
  ASSOCIATION: 'Association',
};
export const BRAND_METRICS = Object.keys(BRAND_METRIC_LABEL) as BrandLiftMetric[];

/** Key of a metric in `engine/params.json` lift.baseline / lift.maxRelLift. */
export const BRAND_PARAM_KEY: Record<BrandLiftMetric, string> = {
  VIDEO_AD_RECALL: 'ad_recall',
  AWARENESS: 'awareness',
  CONSIDERATION: 'consideration',
  FAVORABILITY: 'favorability',
  PURCHASE_INTENT: 'purchase_intent',
  ASSOCIATION: 'association',
};

export const LIFT_LANGUAGES: { value: string; label: string; experimental?: boolean }[] = [
  ['en-US', 'English (US)'], ['en-GB', 'English (UK)'], ['en-AU', 'English (Australia)'],
  ['ar', 'Arabic'], ['cs', 'Czech'], ['da', 'Danish'], ['de', 'German'], ['el', 'Greek'],
  ['es', 'Spanish'], ['es-419', 'Spanish (Latin America)'], ['fi', 'Finnish'], ['fr', 'French'],
  ['he', 'Hebrew'], ['hu', 'Hungarian'], ['id', 'Indonesian'], ['it', 'Italian'], ['ja', 'Japanese'],
  ['ko', 'Korean'], ['ms', 'Malay'], ['nl', 'Dutch'], ['no', 'Norwegian'], ['pl', 'Polish'],
  ['pt-BR', 'Portuguese (Brazil)'], ['pt-PT', 'Portuguese (Portugal)'], ['ro', 'Romanian'],
  ['ru', 'Russian'], ['sk', 'Slovak'], ['sv', 'Swedish'], ['th', 'Thai'], ['tr', 'Turkish'],
  ['uk', 'Ukrainian'], ['vi', 'Vietnamese'], ['zh-CN', 'Chinese (Simplified)'],
  ['zh-TW', 'Chinese (Traditional)'], ['fil', 'Filipino'],
].map(([value, label]) => ({ value: value as string, label: label as string })).concat(
  [
    ['hi', 'Hindi'], ['ta', 'Tamil'], ['te', 'Telugu'], ['kn', 'Kannada'], ['ml', 'Malayalam'],
    ['mr', 'Marathi'], ['bn', 'Bangla'], ['ur', 'Urdu'], ['gu', 'Gujarati'], ['pa', 'Punjabi'],
  ].map(([value, label]) => ({ value: value as string, label: label as string, experimental: true })),
);

export const LIFT_OBJECT_TYPES: string[] = [
  'Accommodations', 'Airline', 'App', 'Apparel', 'Automotive brand', 'Automotive product', 'Bank',
  'Beauty brand', 'Beauty product', 'Beverage', 'Book', 'Brand', 'Building materials', 'Business service',
  'Cable and satellite TV', 'Car rental', 'Casino', 'Charity', 'Cleaning product', 'Clothing store',
  'Coffee shop', 'Company', 'Computer hardware', 'Computer software', 'Consumer electronics',
  'Convenience store', 'Credit card', 'Dating service', 'Department store', 'Education', 'Energy',
  'Entertainment', 'Event', 'Fast food', 'Financial service', 'Food', 'Footwear', 'Furniture', 'Game',
  'Grocery store', 'Health service', 'Home appliance', 'Home improvement', 'Insurance', 'Jewellery',
  'Kitchen product', 'Luxury brand', 'Magazine', 'Mobile carrier', 'Mobile phone', 'Movie', 'Music',
  'Online retailer', 'Personal care product', 'Pet product', 'Pharmacy', 'Political campaign',
  'Restaurant', 'Sports team', 'Streaming service', 'Telecom', 'Toy', 'Travel service', 'TV show',
  'Video game',
];

/** Brand lift needs one of these line item types; Search lift only the YouTube and Demand Gen ones (MX-13). */
export const BRAND_MEASURABLE_TYPES = ['YT_VIDEO', 'YT_AUDIO', 'DEMAND_GEN', 'DISPLAY', 'AUDIO', 'VIDEO'] as const;
export const SEARCH_MEASURABLE_TYPES = ['YT_VIDEO', 'YT_AUDIO', 'DEMAND_GEN'] as const;
export const YT_DG_TYPES = ['YT_VIDEO', 'YT_AUDIO', 'DEMAND_GEN'] as const;

export const BRAND_WINDOW_DAYS = 10;
export const SEARCH_WINDOW_DAYS = 28;
/** Search lift base requirement (INR, Q5 `[SIM]`); the brand lift number is computed from the engine params. */
export const SEARCH_BASE_INR = 600_000;
export const ENHANCED_FACTOR = 3;

export const AGE_BANDS = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
