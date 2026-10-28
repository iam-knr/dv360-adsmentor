// MX-04 Bid strategy options per objective and per line item type (validation.md 3).
import type { BidStrategy, IoObjective, IoType } from './io-matrix';
import { AUTOMATED_STRATEGIES, ioBidStrategiesFor } from './io-matrix';
import type { LiType } from './li-compat';

/** Strategies that need a target value > 0 (advertiser currency unless noted). TARGET_ROAS is a percent. */
export const STRATEGIES_NEEDING_TARGET: readonly BidStrategy[] = [
  'TARGET_CPM',
  'TARGET_CPV',
  'TARGET_CPC',
  'TARGET_CPA',
  'TARGET_VIEWABLE_IMPRESSIONS',
  'TARGET_CUSTOM_VALUE_COST',
  'MAX_CPV',
  'TARGET_ROAS',
];

/** Strategies that count Floodlight conversions (LI-046, MX-11). */
export const CONVERSION_STRATEGIES: readonly BidStrategy[] = [
  'MAX_CONVERSIONS',
  'MAX_CONVERSION_VALUE',
  'TARGET_CPA',
  'TARGET_ROAS',
];

/** Strategies that need an active custom bidding algorithm (LI-047, MX-11, MX-15). */
export const CUSTOM_VALUE_STRATEGIES: readonly BidStrategy[] = [
  'MAX_CUSTOM_VALUE_COST',
  'TARGET_CUSTOM_VALUE_COST',
];

export type BidPriority = 'FULL_BUDGET' | 'TARGET';

/**
 * Automated "optimised towards" options for a line item. Objective lists come from MX-02 B;
 * the rows of the MX-04 table refine them. Fixed bid is a separate mode, not a strategy here.
 */
export function allowedBidStrategies(
  ioType: IoType,
  objective: IoObjective,
  liType: LiType,
): readonly BidStrategy[] {
  if (liType === 'DOOH_DISPLAY' || liType === 'DOOH_VIDEO') return [];
  // IO CLICKS, DISPLAY line item (MX-04 row 1)
  if (objective === 'CLICKS' && liType === 'DISPLAY')
    return ['MAX_CLICKS', 'MAX_CUSTOM_VALUE_COST'];
  // IO BRAND_AWARENESS, CTV line item (MX-04 row 3)
  if (objective === 'BRAND_AWARENESS' && liType === 'CTV') return ['MAX_REACH'];
  if (objective === 'NONE') return AUTOMATED_STRATEGIES;
  return ioBidStrategiesFor(ioType, objective);
}

export function strategyNeedsTarget(strategy: BidStrategy, priority?: BidPriority | null): boolean {
  if (STRATEGIES_NEEDING_TARGET.includes(strategy)) return true;
  // "Maximize clicks while prioritizing a target CPC" shows a target input.
  return strategy === 'MAX_CLICKS' && priority === 'TARGET';
}

/** New line items default to an automated bid, except Audio and DOOH which default to a fixed bid (RC-040). */
export function defaultBidMode(type: LiType): 'AUTOMATED' | 'FIXED' {
  return type === 'AUDIO' || type === 'DOOH_DISPLAY' || type === 'DOOH_VIDEO'
    ? 'FIXED'
    : 'AUTOMATED';
}
