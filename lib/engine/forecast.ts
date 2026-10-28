// Pure forecasts that need no state (engine.md 1.6): inventory availability for a draft line item
// and the size of a targeting selection. Expected values only; nothing is sampled.

import { tickToLocal } from './calendar';
import { planBids, strategyFor } from './bidding';
import { consumptionLinear, fxToCurrency, resolveFees } from './economics';
import { runFunnel } from './eligibility/funnel';
import type { LoadedParams } from './params/load';
import { cellExpectation } from './supply/landscape';
import { supplyCells } from './supply/cells';
import { buildTargetingPlan } from './supply/shares';
import { formatsForType, type Format } from './types';
import { indexWorld, type LineItemEntity, type TargetingSpec, type World } from './world';

export interface ForecastBand {
  low: number;
  mid: number;
  high: number;
}

export interface ForecastWindow {
  startTick: number;
  days: number;
}

export interface ForecastResult {
  days: number;
  availableRequests: number;
  eligibleRequests: number;
  impressions: ForecastBand;
  /** Budget consumption (revenue for currency budgets) in the advertiser currency. */
  spend: ForecastBand;
  /** Average media CPM paid, advertiser currency. */
  avgCpm: number | null;
}

/**
 * Expected delivery of a draft line item over a window if it bid freely: representative days
 * (up to seven, so the day-of-week curve is covered) are scaled to the window length. Automated
 * strategies without a budget are forecast as a fixed bid at the market median (documented).
 */
export function forecast(
  world: World,
  liDraft: LineItemEntity,
  window: ForecastWindow,
  loaded: LoadedParams,
): ForecastResult {
  const { params } = loaded;
  const idx = indexWorld(world);
  const io = idx.ios.get(liDraft.ioId);
  const campaign = io ? idx.campaigns.get(io.campaignId) : undefined;
  const adv = world.advertiser;
  const market = params.markets[world.country];
  if (!market) throw new Error(`Unknown market ${world.country}`);
  const fx = fxToCurrency(params, adv.currency);
  const fees = resolveFees({
    li: liDraft,
    io,
    params,
    currency: adv.currency,
    audiences: idx.audiences,
    creatives: idx.creatives,
  });
  const cons = consumptionLinear(io?.budgetUnit ?? 'CURRENCY', fees);
  const mctx = {
    country: world.country,
    marketSeed: world.marketSeed,
    simStartMs: world.simStartMs,
    tzOffsetMin: world.tzOffsetMin,
  };
  const repDays = Math.max(1, Math.min(window.days, 7));
  let A = 0;
  let E = 0;
  let wins = 0;
  let media = 0;
  let spend = 0;
  const presence = params.competitors.internalPresence;
  const strategy = strategyFor(liDraft.bid.goal, liDraft.bid.kind === 'FIXED');
  for (let t = 0; t < repDays * 24; t++) {
    const tick = window.startTick + t;
    const adL = tickToLocal(world.simStartMs, adv.tzOffsetMin, tick);
    const cells = supplyCells(
      mctx,
      params,
      loaded.hash,
      tick,
      formatsForType(liDraft.type),
      world.partner.enabledExchanges,
    );
    const elig = runFunnel({
      li: liDraft,
      io,
      campaign,
      advertiser: adv,
      index: idx,
      params,
      tick,
      advLocal: adL,
      cells: cells.filter((c) => c.requests > 0),
      freq: {},
      reach: undefined,
      liveTicks: 1000,
      poolScale: market.volumeIdx,
    });
    A += elig.totals.A;
    E += elig.totals.E;
    const plan = planBids({
      li: liDraft,
      strategy: strategy.kind === 'fixed' ? strategy : { ...strategy, kind: 'fixed' },
      elig,
      params,
      tick,
      sandboxSeed: world.sandboxSeed,
      fees,
      cons,
      fxToAdv: fx,
      activities: [],
      learning: undefined,
      prevLambda: undefined,
      allowance: Infinity,
      reach: undefined,
    });
    elig.cells.forEach((ec, i) => {
      const bid = strategy.kind === 'fixed' ? (plan.bids[i] ?? 0) : Math.exp(ec.cell.external.mu);
      if (ec.nSurv <= 0 || bid <= 0) return;
      const ex = params.exchanges[ec.cell.exchangeId];
      if (!ex) return;
      const e = cellExpectation(
        bid,
        ec.nSurv,
        ec.cell,
        ex,
        presence,
        { ln: elig.rate.premiumLn },
        0,
      );
      const keep = 1 - ec.cell.ivtRate * params.outcomes.ivtRefundShare;
      wins += e.wins;
      media += e.media * fx;
      spend += (cons.a * e.media * fx + cons.b * e.wins) * keep;
    });
  }
  const scale = window.days / repDays;
  const sigma = params.supply.noiseSigma * 1.5 + 0.05;
  const band = (v: number): ForecastBand => ({
    low: v * Math.exp(-1.2816 * sigma),
    mid: v,
    high: v * Math.exp(1.2816 * sigma),
  });
  return {
    days: window.days,
    availableRequests: (A / repDays) * window.days,
    eligibleRequests: (E / repDays) * window.days,
    impressions: band(wins * scale),
    spend: band(spend * scale),
    avgCpm: wins > 0 ? (media / wins) * 1000 : null,
  };
}

export interface AudienceSize {
  /** Requests per sim day that pass the targeting. */
  requestsPerDay: number;
  /** Distinct users per sim day that pass the targeting. */
  usersPerDay: number;
  /** Share of the formats' supply that passes (0 to 1). */
  share: number;
}

/** Size of a targeting selection for a set of formats (the targeting panel size bars). */
export function estimateAudienceSize(
  world: World,
  targeting: TargetingSpec,
  formats: Format[],
  loaded: LoadedParams,
): AudienceSize {
  const { params } = loaded;
  const idx = indexWorld(world);
  const market = params.markets[world.country];
  if (!market) throw new Error(`Unknown market ${world.country}`);
  const adv = world.advertiser;
  const probe: LineItemEntity = {
    id: '__size__',
    ioId: '',
    status: 'ACTIVE',
    type: 'DISPLAY',
    inventoryQuality: 'ALL',
    budget: { mode: 'UNLIMITED_UP_TO_IO' },
    pacing: { period: 'FLIGHT', type: 'EVEN' },
    bid: { kind: 'FIXED', fixedCpm: 1 },
    frequency: { mode: 'UNLIMITED' },
    targeting,
    creativeIds: [],
    floodlight: [],
    conversionCounting: { mode: 'ALL' },
    attributionModel: 'last_click',
    revenueModel: { type: 'TOTAL_MEDIA_COST_MARKUP' },
    optimizedTargeting: false,
    creativeOptimization: true,
  };
  const mctx = {
    country: world.country,
    marketSeed: world.marketSeed,
    simStartMs: world.simStartMs,
    tzOffsetMin: world.tzOffsetMin,
  };
  const cells = supplyCells(mctx, params, loaded.hash, 0, formats, world.partner.enabledExchanges);
  const l = tickToLocal(world.simStartMs, adv.tzOffsetMin, 0);
  const plan = buildTargetingPlan(
    probe,
    { params, tick: 0, advHour: l.hour, advDow: l.dow, audiences: idx.audiences },
    market.volumeIdx,
  );
  let all = 0;
  let pass = 0;
  let users = 0;
  for (const c of cells) {
    let p = 1;
    for (const d of plan.dims) p *= d.pass(c);
    all += c.dayRequests;
    pass += c.dayRequests * p;
    users += c.dayRequests * c.uniqueUsersPerRequest * p;
  }
  return { requestsPerDay: pass, usersPerDay: users, share: all > 0 ? pass / all : 0 };
}
