// Labels, option lists and defaults of the partner and advertiser settings pages (modules 02 and 03).
// Client safe: plain data only.
import type { DvRole } from '@/lib/auth/types';

export const SDF_VERSIONS = [
  { key: 'V9', label: '9' },
  { key: 'V9_1', label: '9.1' },
  { key: 'V9_2', label: '9.2' },
  { key: 'V10', label: '10' },
  { key: 'V10_1', label: '10.1' },
  { key: 'V11', label: '11' },
] as const;
export type SdfKey = (typeof SDF_VERSIONS)[number]['key'];
export const SDF_KEYS: readonly string[] = SDF_VERSIONS.map((v) => v.key);
/** Wire text of a version ("9.1") to the enum key (RC-045). */
export const sdfLabel = (key: string): string =>
  SDF_VERSIONS.find((v) => v.key === key)?.label ?? key;
export const sdfKeyOf = (label: string): SdfKey | null =>
  SDF_VERSIONS.find((v) => v.label === label)?.key ?? null;

// DELTA-02-3 and Q4: dropdown order and labels.
export const DV_ROLE_ORDER: readonly DvRole[] = [
  'ADMIN',
  'STANDARD',
  'READ_ONLY',
  'REPORTING_ONLY',
  'PARTNER_CLIENT',
  'CREATIVE',
];
export const DV_ROLE_LABEL: Record<DvRole, string> = {
  ADMIN: 'Admin',
  STANDARD: 'Standard',
  READ_ONLY: 'Read only',
  REPORTING_ONLY: 'Reporting only',
  PARTNER_CLIENT: 'Partner client',
  CREATIVE: 'Creative',
};

/** Module 02 Q2. */
export const INDUSTRIES = [
  { key: 'ECOMMERCE', label: 'E-commerce' },
  { key: 'LEAD_GEN', label: 'Lead generation' },
  { key: 'TRAVEL', label: 'Travel' },
  { key: 'FINANCE', label: 'Finance' },
  { key: 'AUTO', label: 'Auto' },
  { key: 'CPG', label: 'CPG' },
  { key: 'MEDIA', label: 'Media' },
  { key: 'OTHER', label: 'Other' },
] as const;

export const CONTACT_ROLES = [
  { key: 'PRIMARY', label: 'Primary contact' },
  { key: 'DATA_PROTECTION_OFFICER', label: 'Data protection officer' },
  { key: 'EU_REPRESENTATIVE', label: 'EU representative' },
] as const;
export type ContactKey = (typeof CONTACT_ROLES)[number]['key'];

/** Module 02 2.6: the six cards of Advertiser configurations. */
export const CONFIG_CARDS = [
  {
    key: 'ENHANCED_AUTOMATION',
    title: 'Enhanced automation settings',
    recommended: true,
    checkbox: 'Enable Enhanced Automation',
    terms: true,
  },
  {
    key: 'PRODUCT_IMPROVEMENT',
    title: 'Product improvement',
    recommended: false,
    checkbox: 'Allow Adsmetor to use service data to improve the product',
    terms: false,
  },
  {
    key: 'GOOGLE_PARTNER_INVENTORY',
    title: 'Google & partner inventory',
    recommended: false,
    checkbox: 'Allow line items to buy Google & partner inventory',
    terms: true,
  },
  {
    key: 'YOUTUBE_GUARANTEED_INSTANT_DEALS',
    title: 'YouTube guaranteed instant deals',
    recommended: false,
    checkbox: 'Use YouTube guaranteed instant deals',
    terms: true,
  },
  {
    key: 'AUTO_TAGGING',
    title: 'Auto-tagging',
    recommended: true,
    checkbox: 'Enable auto-tagging',
    terms: false,
  },
  {
    key: 'ADVANCED_AD_SERVING',
    title: 'Advanced ad serving',
    recommended: false,
    checkbox: 'Accept advanced creative fees',
    terms: false,
  },
] as const;
export type ConfigKey = (typeof CONFIG_CARDS)[number]['key'];
/** Keys whose terms dialog must be accepted before the flag can be turned on (module 02 4.7). */
export const TERMS_KEYS = [
  'ENHANCED_AUTOMATION',
  'GOOGLE_PARTNER_INVENTORY',
  'YOUTUBE_GUARANTEED_INSTANT_DEALS',
  'ADVANCED_AD_SERVING',
] as const;

/** Defaults of module 02 3.3 "Feature flags". */
export const CONFIG_DEFAULTS: Record<string, boolean> = {
  ENHANCED_AUTOMATION: true,
  PRODUCT_IMPROVEMENT: true,
  GOOGLE_PARTNER_INVENTORY: true,
  YOUTUBE_GUARANTEED_INSTANT_DEALS: false,
  AUTO_TAGGING: true,
  ADVANCED_AD_SERVING: true,
};

/** Adsmetor-written terms (not Google text, module 02 1.3). */
export const TERMS_TEXT =
  'These are training terms written for the Adsmetor classroom simulator. Accepting them changes nothing outside your sandbox and carries no cost.';

export const AUTHORIZATIONS = [
  { key: 'productImprovement', group: 'General', label: 'Product improvement' },
  { key: 'orderIdReporting', group: 'General', label: 'Enable Order ID reporting for pixels' },
  { key: 'adBadging', group: 'Ad badging', label: 'Use ad badging, transparency and reporting' },
  {
    key: 'shareDataWithCommercePartners',
    group: 'Commerce partners',
    label: 'Share spend and performance data with commerce partners',
  },
  {
    key: 'creativesContainTracking',
    group: 'Creatives',
    label: 'Creatives from this advertiser contain tracking activities',
  },
  {
    key: 'authorizeVideoForTvReporting',
    group: 'Creatives',
    label: 'Authorize use of video creatives for TV campaign reporting',
  },
  {
    key: 'prismaEnabled',
    group: 'Third-party integrations',
    label: 'Authorize a media-planning system to send budget segment plans',
  },
] as const;
export type AuthorizationKey = (typeof AUTHORIZATIONS)[number]['key'];

/** Module 03 2.6: the 10 alert preferences in page order. */
export const ALERT_ROWS = [
  { type: 'NO_SPEND', group: 'Budget and pacing', label: 'No spend', default: true },
  { type: 'UNDERPACING', group: 'Budget and pacing', label: 'Underpacing', default: true },
  { type: 'UNDERPERFORMING', group: 'Performance', label: 'Underperforming', default: true },
  {
    type: 'LIMITED_AUDIENCE_SIZE',
    group: 'Targeting changes',
    label: 'Limited audience size',
    default: true,
  },
  { type: 'DEALS_OFFLINE', group: 'Targeting changes', label: 'Deals offline', default: true },
  {
    type: 'RESTRICTED_AUDIENCE_LIST',
    group: 'Targeting changes',
    label: 'Restricted audience list',
    default: true,
  },
  {
    type: 'REJECTED_CREATIVE',
    group: 'Creative or YouTube & partners ad',
    label: 'Rejected creative',
    default: true,
  },
  {
    type: 'RESTRICTED_CREATIVE',
    group: 'Creative or YouTube & partners ad',
    label: 'Restricted creative',
    default: true,
  },
  {
    type: 'EXCEEDED_SPEND_THRESHOLD',
    group: 'Advertiser spend threshold exceeded',
    label: 'Exceeded spend threshold',
    default: false,
  },
  {
    type: 'CONFLICTING_SETTINGS',
    group: 'Mismatched settings',
    label: 'Insertion order / line item settings',
    default: true,
  },
] as const;
export type AlertKey = (typeof ALERT_ROWS)[number]['type'];
export const UNDERPACING_DEFAULT_PCT = 90;
/** Alerts that need Underpacing on (ADV-019). */
export const NEEDS_UNDERPACING: readonly AlertKey[] = ['LIMITED_AUDIENCE_SIZE', 'DEALS_OFFLINE'];

/** Module 03 2.7 in the order of explore 14. `country`: the request asks for a country (ADV-027). */
export const CERT_KINDS = [
  { kind: 'ADDICTION_SERVICES', title: 'Addiction service providers', country: false },
  {
    kind: 'CRYPTOCURRENCY',
    title: 'Cryptocurrency exchanges and software wallets',
    country: false,
  },
  { kind: 'PHARMA_DRUG_SALES', title: 'Pharmaceutical manufacturer drug sales', country: false },
  { kind: 'SPECULATIVE_FINANCIAL', title: 'Speculative financial products', country: false },
  { kind: 'GAMBLING', title: 'Gambling and games', country: true },
  { kind: 'ONLINE_PHARMACY', title: 'Online pharmacy', country: false },
  { kind: 'PHARMA_MANUFACTURER', title: 'Pharmaceutical manufacturer', country: false },
  {
    kind: 'PHARMA_NON_PRESCRIPTION',
    title: 'Pharmaceutical non-prescription drug sales',
    country: false,
  },
  { kind: 'POLITICAL_EU', title: 'Political advertising: European Union', country: true },
  { kind: 'POLITICAL_INDIA', title: 'Political advertising: India', country: true },
  { kind: 'POLITICAL_US', title: 'Political advertising: United States', country: true },
  { kind: 'NEW_YORK_REGISTRATION', title: 'New York state registration documents', country: false },
  {
    kind: 'CALIFORNIA_ELECTIONS',
    title: 'California elections advertisement information',
    country: false,
  },
  { kind: 'SOCIAL_CASINO', title: 'Social casino games', country: true },
] as const;
export type CertKind = (typeof CERT_KINDS)[number]['kind'];
export const CERT_COUNTRIES = [
  { code: 'IN', label: 'India' },
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'DE', label: 'Germany' },
  { code: 'SG', label: 'Singapore' },
] as const;
export const CERT_STATUS_LABEL = {
  NONE: 'No certificates.',
  REQUESTED: 'Requested',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
} as const;

/** Module 03 2.5: Link new account menu. */
export const LINK_TYPES = [
  { type: 'ADS_DATA_HUB', label: 'Ads Data Hub' },
  { type: 'EXTERNAL_DATA_PARTNER', label: 'External Data Partner' },
  { type: 'YOUTUBE_CHANNEL', label: 'YouTube channels' },
  { type: 'YOUTUBE_CREATOR_VIDEOS', label: 'YouTube creator videos' },
  { type: 'GOOGLE_ADS', label: 'Google Ads' },
  { type: 'BIGQUERY_EXPORTER', label: 'BigQuery Exporter' },
] as const;
export type LinkType = (typeof LINK_TYPES)[number]['type'];

export const VENDOR_GROUPS = [
  { group: 'VIEWABILITY', title: 'Third-party viewability vendors' },
  { group: 'BRAND_SAFETY', title: 'Brand safety vendors' },
  { group: 'REACH', title: 'Reach vendors' },
  { group: 'BRAND_LIFT', title: 'Brand lift vendors' },
  { group: 'CONVERSION_ATTRIBUTION', title: 'Conversion attribution vendors' },
  { group: 'YT_MEASUREMENT', title: 'Measurement vendors for YouTube & partners line items' },
] as const;

export const PARTNER_STATUS_OPTIONS = [
  { key: 'ACTIVE', label: 'Active' },
  { key: 'PAUSED', label: 'Paused' },
] as const;

export const MAX_ADVERTISERS_PER_PARTNER = 50; // ADV-023
export const NAME_MAX = 240;
export const BUSINESS_NAME_MAX = 25;
export const INTEGRATION_CODE_MAX = 500;
export const NOTE_MAX = 500;

export const CURRENCIES = ['INR', 'SGD', 'USD', 'EUR', 'GBP', 'AUD', 'JPY'] as const;
export const TIME_ZONES = [
  'Asia/Calcutta',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney',
  'UTC',
] as const;
