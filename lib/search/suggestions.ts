// The 7 suggestion chips of the Search overlay (module 01 DELTA-01-10, explore 01). Code, not DB. Each chip is a saved
// filter link: `route` is relative to the advertiser (`explorerlis`), `query` the list params (routes.md 6.1, 6.2).
// The resolver of resolve.ts reuses the same query shapes, so a chip and the phrase it stands for land on one URL.

export interface SearchTarget {
  /** Path below the advertiser (or the partner): `explorerlis`, `explorerios`, `cs`, `advertisers`. */
  route: string;
  /** List params, keys as written in the URL (`f.status`, `d`, `q`). */
  query: Record<string, string[]>;
}

export interface SearchSuggestion {
  key: string;
  /** The chip text, as in the real DV360 (explore 01). */
  label: string;
  route: string;
  query: Record<string, string[]>;
  /** What the chip stands for, shown as "Showing {intent}". */
  intent: string;
}

/** Thresholds used when a chip or phrase says "over X" without a number. In the advertiser currency. */
export const DEFAULT_CPC_THRESHOLD = 1;
export const DEFAULT_CPA_THRESHOLD = 20;
/** "Expiring soon" = flight ends within this many sim days. */
export const EXPIRING_SOON_DAYS = 7;

export const YOUTUBE_LI_TYPES = ['YT_VIDEO', 'YT_AUDIO', 'YT_ON_CTV'] as const;

export const SEARCH_SUGGESTIONS: readonly SearchSuggestion[] = [
  {
    key: 'youtube',
    label: 'YouTube line items',
    route: 'explorerlis',
    query: { 'f.type': [...YOUTUBE_LI_TYPES], 'f.status': ['*'] },
    intent: 'YouTube line items',
  },
  {
    key: 'paused',
    label: 'Paused line items',
    route: 'explorerlis',
    query: { 'f.status': ['PAUSED'] },
    intent: 'paused line items',
  },
  {
    key: 'expiring',
    label: 'Line items expiring soon',
    route: 'explorerlis',
    query: { 'f.endsWithin': [String(EXPIRING_SOON_DAYS)] },
    intent: 'line items expiring soon',
  },
  {
    key: 'unused-pacing',
    label: 'Line items with unused pacing',
    route: 'explorerlis',
    query: { 'f.pacing': ['UNDER'], d: ['LIFETIME'] },
    intent: 'line items with unused pacing',
  },
  {
    key: 'pacing-ahead',
    label: 'IOs with pacing type AHEAD',
    route: 'explorerios',
    query: { 'f.pacingType': ['AHEAD'] },
    intent: 'insertion orders with pacing type AHEAD',
  },
  {
    key: 'cpc',
    label: 'LIs with CPC over X last week',
    route: 'explorerlis',
    query: { 'f.cpcOver': [String(DEFAULT_CPC_THRESHOLD)], d: ['LAST_WEEK'] },
    intent: `line items with CPC over ${DEFAULT_CPC_THRESHOLD} last week`,
  },
  {
    key: 'cpa',
    label: 'LIs with CPA over X last week',
    route: 'explorerlis',
    query: { 'f.cpaOver': [String(DEFAULT_CPA_THRESHOLD)], d: ['LAST_WEEK'] },
    intent: `line items with CPA over ${DEFAULT_CPA_THRESHOLD} last week`,
  },
];

/** Search text for a chip when the user clicks it (the "X" chips stay editable). */
export function suggestionPhrase(s: SearchSuggestion): string {
  return s.label;
}
