// Value model (engine.md 4.3): the true propensities of a cell, and the noisy estimate the bidder
// sees while the strategy is still learning.

import {
  audibleRateOf,
  ctrOf,
  cvrClickOf,
  cvrViewOf,
  formatOf,
  startRateOf,
  viewEventRateOf,
  viewMeanOf,
  type RateCtx,
} from '../params/rates';
import type { Params } from '../params/schema';
import type { Cell } from '../types';
import type { FloodlightActivity } from '../world';
import type { CellRates } from './strategies';

export interface ValueInputs {
  params: Params;
  rate: RateCtx;
  activities: FloodlightActivity[];
  /** Share of requests from users with no exposure yet. */
  newShare: number;
  /** Multiplier from computing currency to advertiser currency. */
  fxToAdv: number;
}

export interface ActivityMults {
  click: number;
  view: number;
  /** Expected conversion value in computing currency. */
  value: number;
  any: boolean;
}

export function activityMults(
  acts: FloodlightActivity[],
  params: Params,
  fxToAdv: number,
): ActivityMults {
  const live = acts.filter((a) => a.tagStatus === 'active');
  if (live.length === 0) return { click: 0, view: 0, value: 0, any: false };
  let click = 0;
  let view = 0;
  let value = 0;
  for (const a of live) {
    const cat = params.outcomes.categoryMult[a.category] ?? 1;
    click += cat * (a.cvrClickMult ?? 1);
    view += cat * (a.cvrViewMult ?? 1);
    value +=
      a.type === 'sale'
        ? (a.avgOrderValue ?? params.outcomes.defaultAverageOrderValue) / fxToAdv
        : 0;
  }
  const n = live.length;
  return { click: click / n, view: view / n, value: value / n, any: true };
}

/** True propensities of the cell for the line item. */
export function trueRates(
  cell: Cell,
  quality: number,
  v: ValueInputs,
  mults: ActivityMults,
): CellRates {
  const { params, rate } = v;
  const f = formatOf(params, cell.format);
  const ctr = ctrOf(params, cell, rate, quality);
  const viewable = viewMeanOf(cell, rate);
  const pview = f.measurable * viewable;
  const pconv = mults.any
    ? ctr * cvrClickOf(params, cell, rate) * mults.click +
      pview * cvrViewOf(params, cell, rate) * mults.view
    : 0;
  const quarts = f.quartiles;
  const complete = (quarts?.q4 ?? 0) * Math.pow(quality, 0.5);
  const startRate = startRateOf(params, cell);
  const viewEvent =
    f.skippableViewRate !== undefined
      ? viewEventRateOf(params, cell, rate, quality)
      : startRate * complete;
  const isVideo = startRate > 0;
  return {
    ctr,
    pconv,
    pview,
    pnew: v.newShare,
    pviewEvent: isVideo ? viewEvent : 0,
    pciva: isVideo ? pview * audibleRateOf(params, cell) * complete : 0,
    value: mults.value,
    tos10:
      cell.format === 'display' || cell.format === 'native'
        ? params.bidding.tos10Share.display
        : params.bidding.tos10Share.video,
  };
}

const KEYS: (keyof CellRates)[] = ['ctr', 'pconv', 'pview', 'pnew', 'pviewEvent', 'pciva'];

/**
 * p-hat = q * p_true * exp(N(0, sigma(q))) + (1 - q) * p_mean, with sigma shrinking as q rises (4.3).
 * `z` is one standard normal per cell so every rate of the cell moves together.
 */
export function estimateRates(
  truth: CellRates,
  mean: CellRates,
  q: number,
  z: number,
  params: Params,
): CellRates {
  if (q >= 1) return truth;
  const l = params.bidding.learning;
  const sigma = l.exploreSigmaEnd + (l.exploreSigmaStart - l.exploreSigmaEnd) * (1 - q);
  const noise = Math.exp(sigma * z);
  const out: CellRates = { ...truth };
  for (const k of KEYS) out[k] = q * truth[k] * noise + (1 - q) * mean[k];
  return out;
}
