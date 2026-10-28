// MX-08 Conversion counting (validation.md 3).

export const FLOODLIGHT_COUNTING_METHODS = [
  'STANDARD',
  'UNIQUE',
  'PER_SESSION',
  'TRANSACTIONS',
  'ITEMS_SOLD',
] as const;
export type FloodlightCountingMethod = (typeof FLOODLIGHT_COUNTING_METHODS)[number];

export type FloodlightActivityType = 'COUNTER' | 'SALE';

/** Which methods each activity type accepts (from public docs). */
export const COUNTING_METHODS_BY_ACTIVITY: Record<FloodlightActivityType, readonly FloodlightCountingMethod[]> = {
  COUNTER: ['STANDARD', 'UNIQUE', 'PER_SESSION'],
  SALE: ['TRANSACTIONS', 'ITEMS_SOLD'],
};

/** Line item conversion counting (LI-071, LI-072). */
export const LI_COUNTING_MODES = ['ALL', 'POST_CLICK_ONLY', 'PERCENTAGE'] as const;
export type LiCountingMode = (typeof LI_COUNTING_MODES)[number];

export const POST_VIEW_PCT_DEFAULT = 100;
export const DEFAULT_ATTRIBUTION_MODEL = 'PRIMARY';
export const FLOODLIGHT_WINDOW_DAYS = { min: 1, max: 90 } as const;
