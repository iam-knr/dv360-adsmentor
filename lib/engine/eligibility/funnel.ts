// Stages 1 to 3 of the Troubleshooter funnel: targeting, creatives, frequency (engine.md 3.1 to 3.4).
// Every stage converts fractional cuts to integers with the largest remainder method, per cell,
// so the stage rows plus the survivors always add up to the stage input.

import type { LocalTime } from '../calendar';
import { largestRemainder } from '../math';
import type { RateCtx } from '../params/rates';
import type { Params } from '../params/schema';
import type { Cell } from '../types';
import type { TargetingPlan } from '../supply/shares';
import type {
  AdvertiserEntity,
  CampaignEntity,
  IoEntity,
  LineItemEntity,
  WorldIndex,
} from '../world';
import { creativeMask, type CreativeChoice, type CreativeMask } from './creatives';
import {
  avgPriorExposures,
  cappedShare,
  remainingCapacity,
  scopesFor,
  type FreqScope,
  type FreqState,
} from './frequency';
import { F_CODES, T_CODE } from './reasons';
import { compileTargeting, rateCtxFromPlan } from './targeting';

export interface ElCell {
  cell: Cell;
  /** Requests in the cell (A). */
  nA: number;
  /** Eligible after targeting and creatives (E). */
  nE: number;
  /** Survivors after frequency, the input of the budget and pacing stage. */
  nSurv: number;
  /** Filtered counts by reason code for stages 1 to 3, non-zero only. */
  codes: [string, number][];
  choices: CreativeChoice[];
  /** Share-weighted creative quality for this cell. */
  quality: number;
  /** Expected eligible share (product of pass fractions), used for pool sizes. */
  passProd: number;
}

export interface LiElig {
  liId: string;
  plan: TargetingPlan;
  rate: RateCtx;
  cells: ElCell[];
  scopes: FreqScope[];
  /** Reachable user pool of the line item (3.9). */
  pool: number;
  totals: { A: number; E: number; S0: number };
}

export interface FunnelInput {
  li: LineItemEntity;
  io: IoEntity | undefined;
  campaign: CampaignEntity | undefined;
  advertiser: AdvertiserEntity;
  index: WorldIndex;
  params: Params;
  tick: number;
  advLocal: LocalTime;
  /** Cells of the line item's formats, already restricted to the partner's enabled exchanges. */
  cells: Cell[];
  freq: Record<string, FreqState>;
  /** Lifetime exposure state of the line item, for the frequency decay. */
  reach: FreqState | undefined;
  liveTicks: number;
  poolScale: number;
}

export function runFunnel(inp: FunnelInput): LiElig {
  const { li, params } = inp;
  const tin = {
    li,
    advertiser: inp.advertiser,
    params,
    tick: inp.tick,
    advLocal: inp.advLocal,
    audiences: inp.index.audiences,
    poolScale: inp.poolScale,
  };
  const plan = compileTargeting(tin);
  const rate = rateCtxFromPlan(plan, tin);
  const scopes = scopesFor(li, inp.io, inp.campaign);
  const cctx = {
    params,
    creatives: inp.index.creatives,
    liveTicks: inp.liveTicks,
    date: inp.advLocal.date,
  };
  const maskMemo = new Map<string, CreativeMask>();
  const cells: ElCell[] = [];
  let pool = 0;
  let sumA = 0;
  let sumE = 0;

  const shares = scopes.map((s) => cappedShare(inp.freq[s.key]));

  for (const cell of inp.cells) {
    const nA = cell.requests;
    // expected cuts, first failing dimension takes the blame (3.4)
    const labels: string[] = [];
    const exp: number[] = [];
    let nPrev = nA;
    let passProd = 1;
    for (const d of plan.dims) {
      const pass = d.pass(cell);
      if (pass < 1) {
        labels.push(T_CODE[d.dim]);
        exp.push(nPrev * (1 - pass));
        nPrev *= pass;
        passProd *= pass;
      }
    }
    const mkey = `${cell.exchangeId}|${cell.region}|${cell.environment}|${cell.format}`;
    let mask = maskMemo.get(mkey);
    if (!mask) {
      mask = creativeMask(li, cell, cctx);
      maskMemo.set(mkey, mask);
    }
    for (const st of mask.steps) {
      if (st.failShare > 0) {
        labels.push(st.code);
        exp.push(nPrev * st.failShare);
        nPrev *= 1 - st.failShare;
        passProd *= 1 - st.failShare;
      }
    }
    exp.push(nPrev);
    const ints = nA > 0 ? largestRemainder(nA, exp) : exp.map(() => 0);
    const codes: [string, number][] = [];
    for (let i = 0; i < labels.length; i++) {
      const n = ints[i] ?? 0;
      if (n > 0) codes.push([labels[i] as string, n]);
    }
    const nE = ints[ints.length - 1] ?? 0;
    pool += cell.dayRequests * cell.uniqueUsersPerRequest * passProd;
    sumA += nA;
    sumE += nE;

    // 3. frequency caps in blame order
    let nSurv = nE;
    if (scopes.length > 0 && nE > 0) {
      const fl: string[] = [];
      const fe: number[] = [];
      let n = nE;
      scopes.forEach((s, i) => {
        const sh = shares[i] ?? 0;
        if (sh > 0) {
          fl.push(F_CODES[s.kind === 'LI' ? 'LI' : s.kind === 'IO' ? 'IO' : 'CAMPAIGN']);
          fe.push(n * sh);
          n *= 1 - sh;
        }
      });
      if (fl.length > 0) {
        fe.push(n);
        const fi = largestRemainder(nE, fe);
        for (let i = 0; i < fl.length; i++) {
          const c = fi[i] ?? 0;
          if (c > 0) codes.push([fl[i] as string, c]);
        }
        nSurv = fi[fi.length - 1] ?? 0;
      }
    }
    cells.push({
      cell,
      nA,
      nE,
      nSurv,
      codes,
      choices: mask.choices,
      quality: mask.quality,
      passProd,
    });
  }

  // remaining capacity of a capped scope bounds the wins it can still take (3.9)
  if (scopes.length > 0) {
    let limit = Infinity;
    let limitCode: string = F_CODES.LI;
    scopes.forEach((s) => {
      const cap = remainingCapacity(inp.freq[s.key]);
      if (cap < limit) {
        limit = cap;
        limitCode = F_CODES[s.kind === 'LI' ? 'LI' : s.kind === 'IO' ? 'IO' : 'CAMPAIGN'];
      }
    });
    let total = 0;
    for (const c of cells) total += c.nSurv;
    if (limit < total) {
      const excess = total - Math.max(0, Math.floor(limit));
      const w = cells.map((c) => c.nSurv);
      const cut = largestRemainder(excess, w);
      cells.forEach((c, i) => {
        const x = Math.min(c.nSurv, cut[i] ?? 0);
        if (x > 0) {
          c.nSurv -= x;
          c.codes.push([limitCode, x]);
        }
      });
    }
  }

  // creative quality and exposure level for the line item rates
  let qw = 0;
  let qs = 0;
  for (const c of cells) {
    qw += c.nSurv * c.quality;
    qs += c.nSurv;
  }
  const out = { ...rate, creativeQuality: qs > 0 ? qw / qs : 1 };
  let prior = avgPriorExposures(inp.reach);
  for (const s of scopes) prior = Math.max(prior, avgPriorExposures(inp.freq[s.key]));
  out.avgPriorExposures = prior;
  return {
    liId: li.id,
    plan,
    rate: out,
    cells,
    scopes,
    pool,
    totals: { A: sumA, E: sumE, S0: qs },
  };
}
