// True propensities of a cell for a line item (engine.md 6.1 to 6.4). The outcomes module samples
// from these and the bidder only sees noisy estimates of them (4.3), so they live in params/ where
// every module may import them.

import type { Cell, Format } from '../types';
import { Phi, clamp } from '../math';
import type { Params } from './schema';

/** Beta(mean, kappa) approximated by a normal for the threshold share (documented simplification). */
function betaSd(m: number, kappa: number): number {
  return Math.sqrt((m * (1 - m)) / (kappa + 1));
}

export function viewabilityPass(mean: number, kappa: number, t: number): number {
  const sd = betaSd(mean, kappa);
  return clamp(1 - Phi((t - mean) / sd), 0, 1);
}

/** E[X | X >= t] for the same normal approximation, capped to 0.99. */
export function viewabilityMeanAbove(mean: number, kappa: number, t: number): number {
  const sd = betaSd(mean, kappa);
  const z = (t - mean) / sd;
  const tail = 1 - Phi(z);
  if (tail < 1e-6) return Math.min(0.99, Math.max(mean, t));
  const phi = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  return clamp(mean + (sd * phi) / tail, mean, 0.99);
}

/** Line-item level inputs to the rates, computed once per line item per tick by the funnel. */
export interface RateCtx {
  audienceKind: string;
  /** Rate factor for the widened audience of optimized targeting (4.3, 2.3). */
  optimizedFactor: number;
  positionMult: { price: number; ctr: number; view: number };
  /** Share-weighted creative quality multiplier, 0.7 to 1.3. */
  creativeQuality: number;
  /** Minimum predicted viewability targeted (0 when none). */
  viewabilityMin: number;
  /** Advertiser vertical multiplier on click and view conversion rates. */
  vertical: number;
  /** Average prior exposures in the frequency scope, for the decay terms (6.2). */
  avgPriorExposures: number;
  fraudVerifiedShare: number;
  /** ln of the audience premium times the viewability premium, applied to competitor bids (2.4). */
  premiumLn: number;
}

const NEUTRAL_MULT = { price: 1, ctr: 1, view: 1 } as const;

/** Environment multipliers; connected TV is always app inventory, so it takes none. */
export function envMult(
  params: Params,
  device: string,
  env: string,
): { price: number; ctr: number; view: number } {
  if (device === 'ctv') return NEUTRAL_MULT;
  return params.multipliers.environment[env] ?? NEUTRAL_MULT;
}

export function marketOf(params: Params, country: string): Params['markets'][string] {
  const m = params.markets[country];
  if (!m) throw new Error(`Unknown market ${country}`);
  return m;
}

export function formatOf(params: Params, format: Format): Params['formats'][string] {
  const f = params.formats[format];
  if (!f) throw new Error(`Unknown format ${format}`);
  return f;
}

export function neutralRateCtx(): RateCtx {
  return {
    audienceKind: 'none',
    optimizedFactor: 1,
    positionMult: { price: 1, ctr: 1, view: 1 },
    creativeQuality: 1,
    viewabilityMin: 0,
    vertical: 1,
    avgPriorExposures: 0,
    fraudVerifiedShare: 0,
    premiumLn: 0,
  };
}

export function freqCtrDecay(params: Params, ctx: RateCtx): number {
  return Math.pow(params.outcomes.frequencyCtrDecay, Math.max(0, ctx.avgPriorExposures - 1));
}

export function freqCvrDecay(params: Params, ctx: RateCtx): number {
  return Math.pow(params.outcomes.frequencyCvrDecay, Math.max(0, ctx.avgPriorExposures - 1));
}

/** Click-through rate per billable impression. */
export function ctrOf(
  params: Params,
  cell: Cell,
  ctx: RateCtx,
  quality: number = ctx.creativeQuality,
): number {
  const f = formatOf(params, cell.format);
  const m = marketOf(params, cell.country);
  const dm = params.multipliers.device[cell.device];
  const em = envMult(params, cell.device, cell.environment);
  return clamp(
    f.ctr *
      m.ctrIdx *
      (dm?.ctr ?? 1) *
      em.ctr *
      (params.outcomes.hodCtr[cell.hour] ?? 1) *
      (params.outcomes.audienceLift[ctx.audienceKind] ?? 1) *
      quality *
      ctx.positionMult.ctr *
      ctx.optimizedFactor *
      freqCtrDecay(params, ctx),
    0,
    0.5,
  );
}

/** Mean predicted viewability of the cell before the line item's position and creative effects. */
export function viewMeanOf(cell: Cell, ctx: RateCtx): number {
  const base = cell.predictedViewability.mean;
  const m =
    ctx.viewabilityMin > 0
      ? viewabilityMeanAbove(base, cell.predictedViewability.kappa, ctx.viewabilityMin)
      : base;
  return clamp(m * ctx.positionMult.view, 0.02, 0.99);
}

export function cvrClickOf(params: Params, cell: Cell, ctx: RateCtx): number {
  const f = formatOf(params, cell.format);
  return clamp(
    f.cvrClick *
      ctx.vertical *
      marketOf(params, cell.country).cvrIdx *
      (params.outcomes.audienceCvrLift[ctx.audienceKind] ?? 1) *
      freqCvrDecay(params, ctx) *
      ctx.optimizedFactor,
    0,
    1,
  );
}

export function cvrViewOf(params: Params, cell: Cell, ctx: RateCtx): number {
  const f = formatOf(params, cell.format);
  return clamp(
    f.cvrView *
      ctx.vertical *
      marketOf(params, cell.country).cvrIdx *
      (params.outcomes.audienceCvrLift[ctx.audienceKind] ?? 1) *
      ctx.optimizedFactor,
    0,
    1,
  );
}

/** Share of billable impressions that start a video (formats without video return 0). */
export function startRateOf(params: Params, cell: Cell): number {
  return formatOf(params, cell.format).startRate ?? 0;
}

/** Skippable video view rate per impression (30 s, completion or interaction). */
export function viewEventRateOf(
  params: Params,
  cell: Cell,
  ctx: RateCtx,
  quality: number = ctx.creativeQuality,
): number {
  const f = formatOf(params, cell.format);
  if (f.skippableViewRate === undefined) return 0;
  return clamp(f.skippableViewRate * quality, 0, 1);
}

/** Audible share of video impressions (6.3). */
export function audibleRateOf(params: Params, cell: Cell): number {
  if (cell.device === 'ctv') return params.bidding.audibleRate.ctv;
  return cell.environment === 'app'
    ? params.bidding.audibleRate.app
    : params.bidding.audibleRate.web;
}
