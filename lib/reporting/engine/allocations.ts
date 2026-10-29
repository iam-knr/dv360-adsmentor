// Derived-dimension allocation tables (engine 9.3 tier three). A derived dimension splits its parent slice with fixed
// shares, so a sum over the derived values always equals the parent. The shares here are constants (the spec's
// `SimDimAllocation` tables are not built; the shares do not vary per classroom). Deterministic, no randomness.
import type { SliceKind } from '../catalogue';

export type Table = readonly (readonly [string, number])[];

const T = (pairs: Record<string, number>): Table => Object.entries(pairs);

const CITY_BY_REGION: Record<string, Table> = {
  'IN-MH': T({ Mumbai: 52, Pune: 18, Nagpur: 8, Thane: 10, Nashik: 7, 'Other Maharashtra': 5 }),
  'IN-DL': T({ 'New Delhi': 70, 'Delhi Cantonment': 12, Dwarka: 18 }),
  'IN-KA': T({ Bengaluru: 68, Mysuru: 12, Mangaluru: 10, 'Hubballi-Dharwad': 10 }),
  'IN-TN': T({ Chennai: 52, Coimbatore: 20, Madurai: 14, Tiruchirappalli: 14 }),
  'IN-TG': T({ Hyderabad: 80, Warangal: 12, Nizamabad: 8 }),
  'IN-WB': T({ Kolkata: 70, Howrah: 14, Siliguri: 9, Durgapur: 7 }),
  'IN-GJ': T({ Ahmedabad: 40, Surat: 30, Vadodara: 18, Rajkot: 12 }),
  'IN-RJ': T({ Jaipur: 50, Jodhpur: 20, Udaipur: 15, Kota: 15 }),
  'IN-UP': T({ Lucknow: 28, Noida: 24, Kanpur: 20, Ghaziabad: 16, Varanasi: 12 }),
  'SG-ALL': T({ Singapore: 100 }),
  'US-ALL': T({ 'New York': 40, 'Los Angeles': 30, Chicago: 30 }),
};
const CITY_DEFAULT: Table = T({ 'Metro area': 60, 'Other cities': 40 });

const DMA_BY_REGION: Record<string, Table> = {
  'IN-MH': T({ 'Mumbai Metro': 62, 'Pune Metro': 24, 'Other Maharashtra': 14 }),
  'IN-DL': T({ 'Delhi NCR': 100 }),
  'IN-KA': T({ 'Bengaluru Metro': 78, 'Other Karnataka': 22 }),
};
const DMA_DEFAULT: Table = T({ 'Primary metro': 70, 'Secondary metro': 30 });

const NAMES: Record<string, Table> = {
  browser: T({ Chrome: 58, Safari: 24, 'Samsung Internet': 7, Firefox: 4, Edge: 4, Other: 3 }),
  os: T({ Android: 52, iOS: 22, Windows: 14, macOS: 6, Linux: 2, Other: 4 }),
  deviceMake: T({
    Samsung: 24,
    Apple: 20,
    Xiaomi: 16,
    Vivo: 10,
    Oppo: 8,
    Realme: 6,
    Dell: 6,
    HP: 5,
    Other: 5,
  }),
  deviceModel: T({
    'Galaxy A-series': 20,
    iPhone: 18,
    'Redmi Note': 14,
    'Vivo Y-series': 10,
    'Windows PC': 14,
    Mac: 6,
    iPad: 6,
    Other: 12,
  }),
  isp: T({ Jio: 34, Airtel: 28, 'Vodafone Idea': 12, BSNL: 6, ACT: 6, Hathway: 5, Other: 9 }),
  attributedEventPlatformType: T({ Web: 55, App: 45 }),
  appUrl: T({
    'news-daily.example': 14,
    'cricket-live.example': 12,
    'recipes-hub.example': 9,
    'finance-now.example': 8,
    'travel-guide.example': 7,
    'tech-reviews.example': 7,
    'puzzle-games.example': 12,
    'music-stream.example': 10,
    'Long tail': 21,
  }),
  appUrlExcluded: T({ No: 100 }),
  channel: T({
    News: 22,
    Sports: 20,
    Entertainment: 18,
    Finance: 12,
    Lifestyle: 14,
    Technology: 14,
  }),
  channelType: T({ Custom: 100 }),
  category: T({
    'News & Politics': 16,
    Sports: 16,
    Entertainment: 18,
    'Business & Finance': 12,
    'Food & Drink': 10,
    Travel: 8,
    Games: 12,
    Technology: 8,
  }),
  keyword: T({
    'brand terms': 30,
    'product terms': 30,
    'competitor terms': 10,
    'generic terms': 30,
  }),
  sellerId: T({ 'pub-1001': 30, 'pub-1002': 25, 'pub-1003': 20, 'pub-long-tail': 25 }),
  authorizedSellerState: T({ 'Authorized direct': 62, 'Authorized reseller': 30, Unknown: 8 }),
  pixelDensity: T({ '1x': 24, '2x': 46, '3x': 30 }),
  adPosition: T({ 'Above the fold': 46, 'Below the fold': 38, Unknown: 16 }),
  positionInContent: T({ 'In-feed': 50, 'In-article': 30, 'Banner slot': 20 }),
  videoAdPositionInStream: T({ 'Pre-roll': 64, 'Mid-roll': 24, 'Post-roll': 12 }),
  videoPlayerSize: T({ Small: 24, Medium: 40, Large: 24, 'Full screen': 12 }),
  videoContentDuration: T({ 'Under 1 min': 30, '1-5 min': 40, '5-20 min': 22, 'Over 20 min': 8 }),
  videoCreativeDuration: T({ '6 sec': 20, '15 sec': 40, '30 sec': 40 }),
  videoCreativeDurationSkippable: T({ Skippable: 70, 'Non-skippable': 30 }),
  maxVideoDuration: T({ '15 sec': 30, '30 sec': 50, '60 sec': 20 }),
  videoSkippableSupport: T({ Skippable: 72, 'Not skippable': 28 }),
  videoSkippableSupportIar: T({ Skippable: 72, 'Not skippable': 28 }),
  videoFormatSupport: T({ MP4: 70, WebM: 20, HLS: 10 }),
  videoContentLiveStream: T({ 'Not live': 92, Live: 8 }),
  digitalContentLabelIar: T({ 'DL-G': 80, 'DL-PG': 15, 'DL-T': 5 }),
  genre: T({ Drama: 24, Comedy: 20, Sports: 22, News: 18, Other: 16 }),
  language: T({ English: 46, Hindi: 34, Tamil: 6, Telugu: 6, Other: 8 }),
  audioFeedType: T({ Music: 60, Podcast: 25, Radio: 15 }),
  rewarded: T({ 'Not rewarded': 88, Rewarded: 12 }),
  mraid: T({ 'MRAID 2.0': 60, 'MRAID 3.0': 30, 'Not supported': 10 }),
  expectedViewability: T({ 'Under 40%': 20, '40-60%': 40, 'Over 60%': 40 }),
  targetedLocation: T({ Included: 100 }),
  targetedDataProviders: T({ None: 100 }),
  domain: T({
    'news-daily.example': 16,
    'cricket-live.example': 14,
    'recipes-hub.example': 10,
    'finance-now.example': 10,
    'travel-guide.example': 8,
    'Long tail': 42,
  }),
  digitalContentLabel: T({ 'DL-G': 82, 'DL-PG': 14, 'DL-T': 4 }),
  sensitiveCategory: T({
    None: 93,
    'Sensitive social issues': 3,
    'Tragedy and conflict': 2,
    'Adult themes': 2,
  }),
  subdomain: T({ www: 62, m: 20, amp: 10, app: 8 }),
  timeToConversion: T({
    'Less than 1 hour': 8,
    '1 to 24 hours': 22,
    '1 to 7 days': 40,
    '7 to 30 days': 30,
  }),
};

/** The allocation whose table a (possibly id) allocation splits by. */
export function baseAllocation(allocation: string): string {
  return ID_OF[allocation] ?? allocation;
}

/** Print an allocation value: id allocations print the stable id of the label of their base allocation. */
export function allocationPrint(allocation: string, label: string): string {
  return ID_OF[allocation] ? stableId(label) : label;
}

/** Allocation ids that print an id column: the label table of `of`, with a stable numeric id per label. */
const ID_OF: Record<string, string> = {
  cityId: 'city',
  dmaCode: 'dma',
  zipId: 'zip',
  appUrlId: 'appUrl',
  channelId: 'channel',
  ispId: 'isp',
};

export function stableId(label: string): string {
  let h = 2166136261;
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return String(1_000_000 + ((h >>> 0) % 9_000_000));
}

function regionTable(base: Record<string, Table>, dflt: Table, parentKey: string): Table {
  return base[parentKey] ?? dflt;
}

function zipTable(parentKey: string): Table {
  const city = regionTable(CITY_BY_REGION, CITY_DEFAULT, parentKey);
  return city.map(([c, w]) => [`${c} 100`, w] as const);
}

/**
 * The value table of an allocation for one parent slice key. Id allocations return the id of each label of their
 * name allocation, so the id and name columns of one report agree.
 */
export function allocationTable(allocation: string, parentKey: string): Table {
  switch (baseAllocation(allocation)) {
    case 'city':
      return regionTable(CITY_BY_REGION, CITY_DEFAULT, parentKey);
    case 'dma':
      return regionTable(DMA_BY_REGION, DMA_DEFAULT, parentKey);
    case 'zip':
      return zipTable(parentKey);
  }
  return NAMES[baseAllocation(allocation)] ?? T({ '-': 100 });
}

export const KNOWN_ALLOCATIONS: ReadonlySet<string> = new Set([
  ...Object.keys(NAMES),
  ...Object.keys(ID_OF),
  'city',
  'dma',
  'zip',
]);

/** Slice kinds a derived dimension may use as parent. */
export const DERIVED_PARENTS: readonly SliceKind[] = [
  'region',
  'device',
  'exchange',
  'format',
  'activity',
];
