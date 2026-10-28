// Bid planning for one line item and tick (engine.md 4.1): predict, raw bid, net of fees, noise,
// clamp, and the expected consumption at full bidding rate used by pacing (7.4).

import type { ConsumptionLinear, FeeSchedule } from '../economics';
import { netOfFees } from '../economics';
import type { ElCell, LiElig } from '../eligibility/funnel';
import { newUserShare } from '../eligibility/frequency';
import { clamp } from '../math';
import type { Params } from '../params/schema';
import { rng } from '../rng/streams';
import { cellExpectation } from '../supply/landscape';
import type { LearningState } from '../state';
import type { FreqState } from '../eligibility/frequency';
import type { Cell } from '../types';
import type { FloodlightActivity, LineItemEntity } from '../world';
import { solveLambda } from './lambda';
import { cpmWeight, targetToBidScale, type CellRates, type Strategy } from './strategies';
import { activityMults, estimateRates, trueRates, type ValueInputs } from './valueModel';

export interface PlanInput {
  li: LineItemEntity;
  strategy: Strategy;
  elig: LiElig;
  params: Params;
  tick: number;
  sandboxSeed: string;
  fees: FeeSchedule;
  cons: ConsumptionLinear;
  fxToAdv: number;
  activities: FloodlightActivity[];
  learning: LearningState | undefined;
  prevLambda: number | undefined;
  /** Consumption units the plan should aim to spend this hour (maximize strategies). */
  allowance: number;
  reach: FreqState | undefined;
}

export interface BidPlan {
  /** CPM per elig cell (same order), computing currency; 0 means no bid. */
  bids: number[];
  lambda: number;
  saturated: 'hi' | 'lo' | null;
  /** Expected consumption at full bidding rate, in budget units. */
  sFull: number;
  /** Learning quality used for the estimates. */
  q: number;
  /** True when the strategy lacked an input and bid the p25 fallback. */
  fallback: boolean;
  strategy: Strategy;
}

export function medianClear(c: Cell): number {
  return Math.exp(c.external.mu);
}

export function ivtEffective(c: Cell, fraudVerifiedShare: number, params: Params): number {
  return (
    c.ivtRate *
    (1 - params.outcomes.ivtFraudVerifyCut * fraudVerifiedShare) *
    params.outcomes.ivtRefundShare
  );
}

export function planBids(inp: PlanInput): BidPlan {
  const { li, elig, params, strategy } = inp;
  const cells = elig.cells;
  const fx = inp.fxToAdv;
  const bidP = params.bidding;
  const q = strategy.kind === 'fixed' ? 1 : (inp.learning?.q ?? bidP.learning.initialQuality);

  const exParams = (c: Cell) => {
    const e = params.exchanges[c.exchangeId];
    if (!e) throw new Error(`Exchange ${c.exchangeId} missing from params`);
    return e;
  };
  const shift = { ln: elig.rate.premiumLn };
  const shade = strategy.kind === 'fixed' ? 0 : bidP.firstPriceShadeMax * q;
  const presence = params.competitors.internalPresence;

  const consumption = (bids: number[]): number => {
    let total = 0;
    for (let i = 0; i < cells.length; i++) {
      const ec = cells[i] as ElCell;
      const b = bids[i] ?? 0;
      if (ec.nSurv <= 0 || b <= 0) continue;
      const e = cellExpectation(b, ec.nSurv, ec.cell, exParams(ec.cell), presence, shift, shade);
      const keep = 1 - ivtEffective(ec.cell, elig.rate.fraudVerifiedShare, params);
      total += (inp.cons.a * e.media * fx + inp.cons.b * e.wins) * keep;
    }
    return total;
  };

  const maxBid = cells.map((c) => bidP.maxBidMultipleOfClear * medianClear(c.cell));
  const fixedBid = (li.bid.fixedCpm ?? 0) / fx;

  if (strategy.kind === 'fixed') {
    const bids = cells.map((c) =>
      c.nSurv > 0 ? Math.min(fixedBid, (maxBid[cells.indexOf(c)] as number) || fixedBid) : 0,
    );
    return {
      bids,
      lambda: 0,
      saturated: null,
      sFull: consumption(bids),
      q: 1,
      fallback: false,
      strategy,
    };
  }

  // value model: true rates, then the estimate the bidder sees
  const vin: ValueInputs = {
    params,
    rate: elig.rate,
    activities: inp.activities,
    newShare: newUserShare(inp.reach),
    fxToAdv: fx,
  };
  const mults = activityMults(inp.activities, params, fx);
  const truth: CellRates[] = cells.map((c) =>
    c.nSurv > 0 ? trueRates(c.cell, c.quality, vin, mults) : ZERO_RATES,
  );
  let wSum = 0;
  const mean: CellRates = { ...ZERO_RATES };
  for (let i = 0; i < cells.length; i++) {
    const w = (cells[i] as ElCell).nSurv;
    if (w <= 0) continue;
    wSum += w;
    const t = truth[i] as CellRates;
    mean.ctr += w * t.ctr;
    mean.pconv += w * t.pconv;
    mean.pview += w * t.pview;
    mean.pnew += w * t.pnew;
    mean.pviewEvent += w * t.pviewEvent;
    mean.pciva += w * t.pciva;
    mean.value = t.value;
    mean.tos10 = t.tos10;
  }
  if (wSum > 0) {
    mean.ctr /= wSum;
    mean.pconv /= wSum;
    mean.pview /= wSum;
    mean.pnew /= wSum;
    mean.pviewEvent /= wSum;
    mean.pciva /= wSum;
  }
  const noiseRng = rng(inp.sandboxSeed, 'bidestimate', inp.tick, li.id);
  const bidRng = rng(inp.sandboxSeed, 'bidnoise', inp.tick, li.id);
  const est: CellRates[] = cells.map((c, i) =>
    c.nSurv > 0
      ? estimateRates(truth[i] as CellRates, mean, q, noiseRng.normal(), params)
      : ZERO_RATES,
  );
  const noise = cells.map((c) => (c.nSurv > 0 ? 1 + bidP.bidNoise * bidRng.normal() : 1));

  // slope of the bid in the strategy variable (lambda or the target)
  const rateOf = (r: CellRates): number => (strategy.rate ? strategy.rate(r) : 0);
  const goal = strategy.goal === 'FIXED' ? 'MAX_CLICKS' : strategy.goal;
  let anyRate = false;
  const slope = est.map((r) => {
    const s = 1000 * rateOf(r);
    if (s > 0) anyRate = true;
    return s;
  });
  const weightMean = (() => {
    if (!strategy.weight) return 0;
    let a = 0;
    let n = 0;
    for (let i = 0; i < cells.length; i++) {
      const w = (cells[i] as ElCell).nSurv;
      if (w > 0) {
        a += w * strategy.weight(est[i] as CellRates);
        n += w;
      }
    }
    return n > 0 ? a / n : 0;
  })();
  const targetRaw = li.bid.targetValue ?? 0;
  const target = (strategy.kind === 'target' ? targetToBidScale(goal, targetRaw) : 0) / fx;
  const finish = (gross: number, i: number): number => {
    const net = bidP.feeAwareBids ? netOfFees(gross, inp.fees, fx) : gross;
    return clamp(net * (noise[i] as number), 0, maxBid[i] as number);
  };

  // no usable input (for example conversions without a Floodlight activity): bid p25 of clear
  const fallbackBids = (): number[] =>
    cells.map((c, i) =>
      c.nSurv > 0
        ? Math.min(
            maxBid[i] as number,
            Math.exp(c.cell.external.mu - 0.6745 * c.cell.external.sigma),
          )
        : 0,
    );
  const noInput = strategy.weight ? false : !anyRate;
  if (noInput || (strategy.kind === 'target' && !(target > 0))) {
    const bids = fallbackBids();
    return {
      bids,
      lambda: 0,
      saturated: null,
      sFull: consumption(bids),
      q,
      fallback: true,
      strategy,
    };
  }

  if (strategy.kind === 'target') {
    const bids = cells.map((c, i) => {
      if (c.nSurv <= 0) return 0;
      if (strategy.weight) {
        const w = cpmWeight(strategy.weight(est[i] as CellRates), weightMean);
        return finish(target * w, i);
      }
      return finish(target * (slope[i] as number), i);
    });
    return {
      bids,
      lambda: 0,
      saturated: null,
      sFull: consumption(bids),
      q,
      fallback: false,
      strategy,
    };
  }

  // maximize: lambda is the value of one goal event in computing currency
  const bidsAt = (lambda: number): number[] =>
    cells.map((c, i) =>
      c.nSurv > 0 && (slope[i] as number) > 0 ? finish(lambda * (slope[i] as number), i) : 0,
    );
  let hi = 0;
  for (let i = 0; i < cells.length; i++) {
    const s = slope[i] as number;
    if (s > 0 && (cells[i] as ElCell).nSurv > 0) hi = Math.max(hi, (maxBid[i] as number) / s);
  }
  hi *= 3;
  const allowance = Number.isFinite(inp.allowance) ? inp.allowance : 1e15;
  const solved = solveLambda((l) => consumption(bidsAt(l)), allowance, hi, bidP.lambdaIterations);
  let lambda = solved.lambda;
  if (inp.prevLambda && inp.prevLambda > 0 && inp.learning && inp.learning.phase !== 'STABLE') {
    // damping while learning avoids oscillation (4.3)
    const d = bidP.learning.lambdaDamping;
    lambda = Math.exp(d * Math.log(inp.prevLambda) + (1 - d) * Math.log(lambda));
  }
  const bids = bidsAt(lambda);
  return {
    bids,
    lambda,
    saturated: solved.saturated,
    sFull: consumption(bids),
    q,
    fallback: false,
    strategy,
  };
}

const ZERO_RATES: CellRates = {
  ctr: 0,
  pconv: 0,
  pview: 0,
  pnew: 0,
  pviewEvent: 0,
  pciva: 0,
  value: 0,
  tos10: 0,
};
