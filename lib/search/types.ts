// Wire types of the search API (module 01 4.6), shared by the service and the overlay.
import type { SearchScope } from './resolve';
import type { SearchTarget } from './suggestions';

export const DIRECT_RESULT_LIMIT = 10;

export type DirectKind =
  'advertiser' | 'campaign' | 'insertionOrder' | 'lineItem' | 'creative' | 'audience';

export interface DirectResult {
  kind: DirectKind;
  id: string;
  name: string;
  href: string;
  /** "Campaign", "Line item"… for the row's second line. */
  label: string;
}

export interface SearchResponse {
  interpretation: string;
  target: SearchTarget | null;
  /** Name/ID search link, always present. */
  fallback: SearchTarget;
  /** Where `target` and `fallback` are relative to: `/p/1/a/2` or `/p/1`. */
  base: string;
  scope: SearchScope;
  results: DirectResult[];
}
