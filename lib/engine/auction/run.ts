// Auction for one line item and tick (engine.md 5 and the throttle of 7.4). Stages 4 to 8 of the
// funnel: budget, pacing, minimum bid, internal auction, external auction. Counts are integers
// with conservation; the external auction and the price noise are sampled from seeded streams.

import type { ConsumptionLinear } from '../economics';
import { largestRemainder } from '../math';
import type { Params } from '../params/schema';
import { binomial } from '../rng/sample';
import { rng } from '../rng/streams';
import { avgBelow, logNormCdf, shiftDist, winPrice } from '../supply/landscape';
import type { BidPlan, ElCell, LiElig } from '../bidding';
import { ownPass, type OwnEntry } from './internal';

/** Throttle decision handed in by the orchestrator (pacing module output, plain data). */
export interface ThrottleSpec {
  rBudget: number;
  r: number;
  budgetCode: string;
  paceCode: string;
  /** Realised consumption must stay below this (7.4). */
  spendCap: number;
  /** True when the budget (not the pace) is the binding limit of `spendCap`. */
  capIsBudget: boolean;
}

export interface CellAuction {
  elc: ElCell;
  bid: number;
  /** Bids submitted, bid responses, impressions won. */
  S: number;
  R: number;
  W: number;
  /** Filtered counts of stages 4 to 8, non-zero only. */
  codes: [string, number][];
  /** Average price paid per win (CPM, computing currency). */
  price: number;
  /** Media cost, computing currency. */
  media: number;
}

export interface AuctionResult {
  liId: string;
  cells: CellAuction[];
  /** Wins removed by the overshoot clip. */
  clipped: number;
}

export interface AuctionInput {
  liId: string;
  elig: LiElig;
  plan: BidPlan;
  throttle: ThrottleSpec;
  cons: ConsumptionLinear;
  fxToAdv: number;
  params: Params;
  tick: number;
  sandboxSeed: string;
  own: Map<string, OwnEntry[]>;
}

export function runAuction(inp: AuctionInput): AuctionResult {
  const { elig, plan, params, throttle } = inp;
  const presence = params.competitors.internalPresence;
  const shift = { ln: elig.rate.premiumLn };
  const shade = plan.strategy.kind === 'fixed' ? 0 : params.bidding.firstPriceShadeMax * plan.q;
  const out: CellAuction[] = [];
  const paceFrac = throttle.rBudget > 0 ? throttle.r / throttle.rBudget : 0;

  for (let i = 0; i < elig.cells.length; i++) {
    const ec = elig.cells[i] as ElCell;
    const bid = plan.bids[i] ?? 0;
    const n = ec.nSurv;
    if (n <= 0) {
      continue;
    }
    const codes: [string, number][] = [];
    // 4 and 5: budget and pacing, then bids submitted
    const bw = largestRemainder(n, [
      n * (1 - throttle.rBudget),
      n * throttle.rBudget * (1 - paceFrac),
      n * throttle.r,
    ]);
    const nB = bw[0] ?? 0;
    const nP = bw[1] ?? 0;
    const S = bw[2] ?? 0;
    if (nB > 0) codes.push([throttle.budgetCode, nB]);
    if (nP > 0) codes.push([throttle.paceCode, nP]);
    if (S <= 0) {
      out.push({ elc: ec, bid, S: 0, R: 0, W: 0, codes, price: 0, media: 0 });
      continue;
    }
    if (bid <= 0) {
      // a zero bid is a bid below every floor
      codes.push(['A.BELOW_MIN_BID', S]);
      out.push({ elc: ec, bid, S, R: 0, W: 0, codes, price: 0, media: 0 });
      continue;
    }
    const cell = ec.cell;
    const ex = params.exchanges[cell.exchangeId];
    if (!ex) throw new Error(`Exchange ${cell.exchangeId} missing from params`);

    // 6: minimum bid, 7: internal auction (other DV360 buyers, then own line items)
    const pf = logNormCdf(bid, cell.floor);
    const pOther = 1 - presence * (1 - logNormCdf(bid, shiftDist(cell.internal, shift.ln)));
    const pOwn = ownPass(inp.own.get(cell.id), inp.liId, bid);
    const w7 = largestRemainder(S, [
      S * (1 - pf),
      S * pf * (1 - pOther),
      S * pf * pOther * (1 - pOwn),
      S * pf * pOther * pOwn,
    ]);
    const below = w7[0] ?? 0;
    const lostOther = w7[1] ?? 0;
    const lostOwn = w7[2] ?? 0;
    const R = w7[3] ?? 0;
    if (below > 0) codes.push(['A.BELOW_MIN_BID', below]);
    if (lostOther > 0) codes.push(['A.LOST_INTERNAL', lostOther]);
    if (lostOwn > 0) codes.push(['A.LOST_INTERNAL:OWN_LINE_ITEM', lostOwn]);

    // 8: external auction
    const tech = largestRemainder(R, [
      R * ex.latencyDropRate,
      R * ex.creativeRejectRate,
      R * (1 - ex.latencyDropRate - ex.creativeRejectRate),
    ]);
    const other = tech[0] ?? 0;
    const creative = tech[1] ?? 0;
    const live = tech[2] ?? 0;
    if (other > 0) codes.push(['E.OTHER', other]);
    if (creative > 0) codes.push(['E.CREATIVE', creative]);
    const r = rng(inp.sandboxSeed, 'auction', inp.tick, inp.liId, cell.id);
    const pExt = logNormCdf(bid, shiftDist(cell.external, shift.ln));
    const W = binomial(r, live, pExt);
    const lost = live - W;
    const reported = Math.min(lost, Math.round(lost * ex.lossReportedShare));
    if (reported > 0) codes.push(['E.BID_TOO_LOW', reported]);
    if (lost - reported > 0) codes.push(['E.LOST_NOT_REPORTED', lost - reported]);

    let price = 0;
    let media = 0;
    if (W > 0) {
      price = winPrice(bid, cell, ex, shift, shade);
      const floorAvg = avgBelow(bid, cell.floor);
      const sd = (Math.sqrt(W) * 0.2 * price) / 1000;
      media = (W * price) / 1000 + sd * r.normal();
      media = Math.min((W * bid) / 1000, Math.max((W * Math.min(bid, floorAvg)) / 1000, media));
      price = (media * 1000) / W;
    }
    out.push({ elc: ec, bid, S, R, W, codes, price, media });
  }

  const clipped = clipOvershoot(out, inp);
  return { liId: inp.liId, cells: out, clipped };
}

/**
 * Realised consumption is clipped to the throttle's cap by dropping wins (7.4): first a share of
 * every cell in proportion to its wins, then single wins from the dearest cells until the total is
 * at or below the cap. Dropped wins are re-classified as filtered by the binding budget or pacing
 * limit, so the funnel still adds up.
 */
function clipOvershoot(cells: CellAuction[], inp: AuctionInput): number {
  const { cons, fxToAdv, throttle } = inp;
  const consumption = () =>
    cells.reduce((a, c) => a + cons.a * c.media * fxToAdv + cons.b * c.W, 0);
  const est = consumption();
  const cap = Math.max(0, throttle.spendCap);
  if (!(est > cap) || est <= 0) return 0;
  const code = throttle.capIsBudget ? throttle.budgetCode : throttle.paceCode;
  const wins = cells.map((c) => c.W);
  const total = wins.reduce((a, b) => a + b, 0);
  const first = largestRemainder(Math.min(total, Math.ceil(total * (1 - cap / est))), wins);
  let clipped = 0;
  const dropFrom = (i: number, d: number) => {
    const c = cells[i] as CellAuction;
    if (d <= 0 || c.W <= 0) return;
    d = Math.min(d, c.W);
    c.media *= (c.W - d) / c.W;
    c.W -= d;
    c.R -= d;
    c.S -= d;
    clipped += d;
    const hit = c.codes.find((x) => x[0] === code);
    if (hit) hit[1] += d;
    else c.codes.push([code, d]);
  };
  first.forEach((d, i) => dropFrom(i, d));
  // single wins from the cell where one win is worth the most, until the cap holds
  for (let guard = 0; guard < 100_000 && consumption() > cap; guard++) {
    let best = -1;
    let bestValue = -1;
    cells.forEach((c, i) => {
      if (c.W <= 0) return;
      const v = cons.a * (c.media / c.W) * fxToAdv + cons.b;
      if (v > bestValue) {
        bestValue = v;
        best = i;
      }
    });
    if (best < 0) break;
    dropFrom(best, 1);
  }
  for (const c of cells) c.price = c.W > 0 ? (c.media * 1000) / c.W : 0;
  return clipped;
}
