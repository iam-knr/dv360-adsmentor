// Limits of module 15 (validation.md MX-16, RC-037). Shared by the parsers, the rules and the UI counters.
export const RESOURCE_LIMITS = {
  /** CH-004: sites per channel. */
  CHANNEL_SITES_MAX: 10_000,
  /** KW-002 / `NEG_KW_LIMIT`. */
  KEYWORDS_MAX: 5_000,
  /** KW-004. */
  KEYWORD_LENGTH_MAX: 80,
  /** LOC-005 (RC-037: 5,000 per location list). */
  LOCATION_ENTRIES_MAX: 5_000,
  /** `GEO_RADIUS_RANGE` (km). */
  RADIUS_MIN_KM: 1,
  RADIUS_MAX_KM: 500,
  RADIUS_DEFAULT_KM: 5,
  /** FL-020 conversion windows in days. */
  WINDOW_MIN_DAYS: 1,
  WINDOW_MAX_DAYS: 90,
  /** FL-022 variable slots u1..u100. */
  VARIABLE_SLOTS_MAX: 100,
  /** Conversion event name (0/100). */
  EVENT_NAME_MAX: 100,
} as const;
