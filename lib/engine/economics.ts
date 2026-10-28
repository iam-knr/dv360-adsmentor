// Fee schedule, revenue model and currency conversion shared by bidding (fee-aware bids,
// expected consumption) and costs (actual money). Pure functions of entities and params
// (engine.md 8.2 to 8.7).

import type { Params } from './params/schema';
import type {
  AudienceEntity,
  CreativeEntity,
  IoEntity,
  LineItemEntity,
  PartnerCost,
} from './world';

/** Multiplier from computing-currency (params.currency) amounts to the advertiser currency. */
export function fxToCurrency(params: Params, currency: string): number {
  const to = params.fx.perUSD[currency];
  const from = params.fx.perUSD[params.currency];
  if (!to || !from) throw new Error(`No FX rate for ${currency} or ${params.currency}`);
  return to / from;
}

/** Convert integer micros between currencies (derived at read time, RC-025). */
export function convertMicros(micros: number, from: string, to: string, params: Params): number {
  const f = params.fx.perUSD[from];
  const t = params.fx.perUSD[to];
  if (!f || !t) throw new Error(`No FX rate for ${from} or ${to}`);
  return Math.round((micros / f) * t);
}

export interface FeeSchedule {
  /** CPM fees in advertiser currency per 1,000 billable impressions. */
  cpm: { amount: number; invoiced: boolean }[];
  /** Media fee fractions: index 0 is the locked DV360 fee. */
  media: { pct: number; invoiced: boolean }[];
  /** Audience data cost, advertiser currency per 1,000 billable impressions. */
  dataCpm: number;
  /** Third-party verification cost, advertiser currency per 1,000 billable impressions. */
  verificationCpm: number;
  /** Advanced ad serving cost, advertiser currency per 1,000 impressions. */
  adServingCpm: number;
  revenue: { type: LineItemEntity['revenueModel']['type']; markup: number; cpm: number };
}

export interface FeeInputs {
  li: LineItemEntity;
  io: IoEntity | undefined;
  params: Params;
  currency: string;
  audiences: Map<string, AudienceEntity>;
  creatives: Map<string, CreativeEntity>;
}

export function resolveFees(inp: FeeInputs): FeeSchedule {
  const { li, io, params } = inp;
  const costs: PartnerCost[] = li.partnerCosts ?? io?.partnerCosts ?? [];
  const cpm = costs
    .filter((c) => c.kind === 'CPM_FEE')
    .sort((a, b) => a.slot - b.slot)
    .map((c) => ({ amount: c.amount, invoiced: c.invoiced }));
  const fee2 = costs.find((c) => c.kind === 'MEDIA_FEE' && c.slot === 2);
  const media = [{ pct: params.costs.dv360FeePct, invoiced: true }];
  if (fee2) media.push({ pct: fee2.amount, invoiced: fee2.invoiced });

  const fx = fxToCurrency(params, inp.currency);
  let data = 0;
  const ids = new Set<string>();
  for (const g of li.targeting.audiences?.includeGroups ?? []) for (const id of g) ids.add(id);
  for (const id of [...ids].sort()) {
    const a = inp.audiences.get(id);
    if (!a) continue;
    data += (a.dataCpm ?? params.costs.dataCpm[a.type] ?? 0) * fx;
  }
  const verified = new Set(li.targeting.verification ?? []);
  let ver = 0;
  for (const v of [...verified].sort()) {
    // ABS replaces the standard brand safety and fraud options (8.4)
    if (verified.has('dv_abs') && (v === 'dv_brand_safety' || v === 'dv_fraud')) continue;
    ver += (params.costs.verificationCpm[v] ?? 0) * fx;
  }
  let ad = params.costs.adServingCpm * fx;
  for (const id of li.creativeIds)
    ad = Math.max(ad, (inp.creatives.get(id)?.advancedAdServingCpm ?? 0) * fx);
  return {
    cpm,
    media,
    dataCpm: data,
    verificationCpm: ver,
    adServingCpm: ad,
    revenue: {
      type: li.revenueModel.type,
      markup: li.revenueModel.markup ?? 0,
      cpm: li.revenueModel.cpm ?? 0,
    },
  };
}

/** Invoiced fee parts, used by revenue and by fee-aware bidding. */
export function invoicedParts(s: FeeSchedule): { cpmPerImp: number; pct: number } {
  let cpm = s.dataCpm + s.verificationCpm;
  for (const c of s.cpm) if (c.invoiced) cpm += c.amount;
  let pct = 0;
  for (const m of s.media) if (m.invoiced) pct += m.pct;
  return { cpmPerImp: cpm / 1000, pct };
}

/**
 * Revenue as a linear function of net media cost and billable impressions (advertiser currency):
 * revenue = a * mediaNet + b * billable.
 */
export function revenueLinear(s: FeeSchedule): { a: number; b: number } {
  const inv = invoicedParts(s);
  switch (s.revenue.type) {
    case 'TOTAL_MEDIA_COST_MARKUP':
      return {
        a: (1 + s.revenue.markup) * (1 + inv.pct),
        b: (1 + s.revenue.markup) * inv.cpmPerImp,
      };
    case 'MEDIA_COST_MARKUP':
      return { a: 1 + s.revenue.markup + inv.pct, b: inv.cpmPerImp };
    case 'CPM_VALUE':
      return { a: 0, b: s.revenue.cpm / 1000 };
  }
}

/**
 * Convert a strategy bid (what the goal is worth, advertiser terms) to a media bid in computing
 * currency CPM so that targets such as CPA hold after fees (engine.md 4.1 step 3, 8.6).
 */
export function netOfFees(bidCpm: number, s: FeeSchedule, fx: number): number {
  const lin = revenueLinear(s);
  // revenue per 1,000 impressions at media bid m (adv currency): a * m * fx + b * 1000 ; solve for m
  const advBid = bidCpm * fx;
  const m = (advBid - lin.b * 1000) / Math.max(lin.a, 1e-9);
  return Math.max(0, m / fx);
}

export type ConsumptionLinear = { a: number; b: number };

/** Budget consumption of a block of activity (engine.md 7.1). */
export function consumptionLinear(unit: IoEntity['budgetUnit'], s: FeeSchedule): ConsumptionLinear {
  return unit === 'IMPRESSIONS' ? { a: 0, b: 1 } : revenueLinear(s);
}
