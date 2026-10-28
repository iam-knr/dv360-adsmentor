// Auction price landscape closed forms (engine.md 5.2 and 5.4). They live in supply/ because both
// bidding (expected spend, lambda solving) and auction (realised draws) need them and the layering
// allows bidding -> supply but not bidding -> auction.

import { Phi } from '../math';
import type { Params } from '../params/schema';
import type { Cell, Dist } from '../types';

type ExchangeParams = Params['exchanges'][string];

/** P(X <= x) for X ~ LogNormal(mu, sigma). */
export const logNormCdf = (x: number, d: Dist): number =>
  x <= 0 ? 0 : Phi((Math.log(x) - d.mu) / d.sigma);

/** E[X ; X < x], the partial expectation. */
export const partialExpect = (x: number, d: Dist): number =>
  x <= 0
    ? 0
    : Math.exp(d.mu + (d.sigma * d.sigma) / 2) *
      Phi((Math.log(x) - d.mu - d.sigma * d.sigma) / d.sigma);

/** E[X | X < x]. */
export function avgBelow(x: number, d: Dist): number {
  const f = logNormCdf(x, d);
  if (f < 1e-12) return Math.min(x, Math.exp(d.mu));
  return partialExpect(x, d) / f;
}

export const shiftDist = (d: Dist, lnShift: number): Dist => ({
  mu: d.mu + lnShift,
  sigma: d.sigma,
});

/** Competitor bids shift for a line item's matched audience and viewability premium (2.4). */
export interface PriceShift {
  /** ln of the combined audience and viewability premium. */
  ln: number;
}

/**
 * Winning price per impression (CPM) for a bid (engine.md 5.4). `shade` is
 * `firstPriceShadeMax * q` for auto strategies and 0 for fixed bids, which pay what they bid on
 * first-price exchanges.
 */
export function winPrice(
  bid: number,
  cell: Cell,
  ex: ExchangeParams,
  shift: PriceShift,
  shade: number,
): number {
  if (bid <= 0) return 0;
  const ext = shiftDist(cell.external, shift.ln);
  const second = avgBelow(bid, ext);
  if (ex.auctionType === 'first') {
    return Math.min(bid, Math.max(second * 1.02, bid * (1 - shade)));
  }
  const floorAvg = avgBelow(bid, cell.floor);
  return Math.min(bid, Math.max(second, floorAvg) * 1.03);
}

export interface CellExpectation {
  /** Bids submitted. */
  bids: number;
  afterFloor: number;
  responses: number;
  /** Responses that survive technical drops. */
  live: number;
  wins: number;
  /** Expected media spend in market currency. */
  media: number;
  price: number;
}

/**
 * Expected counts and media spend for `n` bids at CPM `bid` on a cell (engine.md 5.2). Own-line-item
 * competition is not modelled here (it is applied by the auction on realised counts).
 */
export function cellExpectation(
  bid: number,
  n: number,
  cell: Cell,
  ex: ExchangeParams,
  presence: number,
  shift: PriceShift,
  shade: number,
): CellExpectation {
  if (bid <= 0 || n <= 0)
    return { bids: n, afterFloor: 0, responses: 0, live: 0, wins: 0, media: 0, price: 0 };
  const pf = logNormCdf(bid, cell.floor);
  const pInt = 1 - presence * (1 - logNormCdf(bid, shiftDist(cell.internal, shift.ln)));
  const afterFloor = n * pf;
  const responses = afterFloor * pInt;
  const live = responses * (1 - ex.latencyDropRate - ex.creativeRejectRate);
  const pExt = logNormCdf(bid, shiftDist(cell.external, shift.ln));
  const wins = live * pExt;
  const price = wins > 0 ? winPrice(bid, cell, ex, shift, shade) : 0;
  return { bids: n, afterFloor, responses, live, wins, media: (wins * price) / 1000, price };
}
