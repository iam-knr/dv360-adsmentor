// Bid strategy table (engine.md 4.2). "maximize" strategies use the budget multiplier lambda,
// "target" strategies bid from a user target and are throttled by pacing instead.

import { clamp } from '../math';
import type { BidGoal } from '../types';

export type GoalEvent =
  | 'none'
  | 'clicks'
  | 'conversions'
  | 'viewable_impressions'
  | 'reach_impressions'
  | 'completed_views';

/** Estimated propensities of one cell, per impression. */
export interface CellRates {
  ctr: number;
  pconv: number;
  /** Viewable impressions per impression (measurable share times viewable share). */
  pview: number;
  /** Share of requests from users with no exposure yet. */
  pnew: number;
  /** Video view event (30 s, completion or interaction) per impression. */
  pviewEvent: number;
  /** In-view and audible completion per impression. */
  pciva: number;
  /** Expected conversion value per conversion, computing currency. */
  value: number;
  /** Share of viewable impressions with at least 10 s on screen. */
  tos10: number;
}

export interface Strategy {
  goal: BidGoal | 'FIXED';
  kind: 'fixed' | 'maximize' | 'target';
  event: GoalEvent;
  /** Rate the bid multiplies (CPM per unit of x), or undefined for fixed and shaped strategies. */
  rate?: (r: CellRates) => number;
  /** For TARGET_CPM: the bid is the target scaled by this relative weight. */
  weight?: (r: CellRates) => number;
  /** Goal maps to a nearest implemented goal (README table). */
  mappedFrom?: BidGoal;
}

const M = (goal: BidGoal, event: GoalEvent, rate: (r: CellRates) => number): Strategy => ({
  goal,
  kind: 'maximize',
  event,
  rate,
});
const T = (goal: BidGoal, event: GoalEvent, rate: (r: CellRates) => number): Strategy => ({
  goal,
  kind: 'target',
  event,
  rate,
});

export const STRATEGIES: Record<BidGoal, Strategy> = {
  MAX_CLICKS: M('MAX_CLICKS', 'clicks', (r) => r.ctr),
  TARGET_CPC: T('TARGET_CPC', 'clicks', (r) => r.ctr),
  MAX_CONVERSIONS: M('MAX_CONVERSIONS', 'conversions', (r) => r.pconv),
  TARGET_CPA: T('TARGET_CPA', 'conversions', (r) => r.pconv),
  MAX_CONVERSION_VALUE: M('MAX_CONVERSION_VALUE', 'conversions', (r) => r.pconv * r.value),
  TARGET_ROAS: T('TARGET_ROAS', 'conversions', (r) => r.pconv * r.value),
  MAX_REACH: M('MAX_REACH', 'reach_impressions', (r) => r.pnew),
  TARGET_CPM: {
    goal: 'TARGET_CPM',
    kind: 'target',
    event: 'reach_impressions',
    weight: (r) => r.pnew * r.pview,
  },
  MAX_VIEWABLE_IMPRESSIONS: M('MAX_VIEWABLE_IMPRESSIONS', 'viewable_impressions', (r) => r.pview),
  TARGET_VIEWABLE_IMPRESSIONS: T(
    'TARGET_VIEWABLE_IMPRESSIONS',
    'viewable_impressions',
    (r) => r.pview,
  ),
  MAX_VIEWABLE_10S: M('MAX_VIEWABLE_10S', 'viewable_impressions', (r) => r.pview * r.tos10),
  MAX_COMPLETED_IN_VIEW_AUDIBLE: M(
    'MAX_COMPLETED_IN_VIEW_AUDIBLE',
    'completed_views',
    (r) => r.pciva,
  ),
  MAX_CPV: T('MAX_CPV', 'completed_views', (r) => r.pviewEvent),
  TARGET_CPV: T('TARGET_CPV', 'completed_views', (r) => r.pviewEvent),
  // Custom bidding scripts are out of scope: the nearest implemented goal is used.
  MAX_CUSTOM_VALUE_COST: {
    ...M('MAX_CUSTOM_VALUE_COST', 'viewable_impressions', (r) => r.pview),
    mappedFrom: 'MAX_CUSTOM_VALUE_COST',
  },
  TARGET_CUSTOM_VALUE_COST: {
    goal: 'TARGET_CUSTOM_VALUE_COST',
    kind: 'target',
    event: 'reach_impressions',
    weight: (r) => r.pnew * r.pview,
    mappedFrom: 'TARGET_CUSTOM_VALUE_COST',
  },
};

export const FIXED_STRATEGY: Strategy = { goal: 'FIXED', kind: 'fixed', event: 'none' };

/** Strategy a line item uses, honouring IO-level automation (4.5). */
export function strategyFor(goal: BidGoal | undefined, fixed: boolean): Strategy {
  if (fixed || !goal) return FIXED_STRATEGY;
  return STRATEGIES[goal];
}

/** Relative weight for TARGET_CPM, clamped around the mean (4.2). */
export function cpmWeight(w: number, mean: number): number {
  if (mean <= 0) return 1;
  return clamp(w / mean, 0.6, 1.4);
}

/** Targets that are ratios rather than currency: ROAS arrives as a percent (400 = 4.0). */
export function targetToBidScale(goal: BidGoal, target: number): number {
  if (goal === 'TARGET_ROAS') return 1 / Math.max(target / 100, 1e-9);
  return target;
}
