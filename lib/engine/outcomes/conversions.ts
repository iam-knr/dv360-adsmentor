// Floodlight conversions: generation with lag, windows and the three counting methods
// (engine.md 6.4). Counting happens when a conversion is released, not when it is generated.

import { Phi, roundHalfEven } from '../math';
import type { Params } from '../params/schema';
import { binomial, multinomial } from '../rng/sample';
import type { Rng } from '../rng/xoshiro';
import type { FloodlightActivity, LineItemEntity } from '../world';

export interface LagBucket {
  /** Ticks after the ad event at which the conversions are released. */
  dueOffset: number;
  prob: number;
}

const bucketCache = new WeakMap<Params, Map<string, LagBucket[]>>();

/**
 * Lag distribution LogNormal(ln median, sigma) in hours, as buckets: hourly for the first 48 hours
 * and daily after that, up to the attribution window. Mass beyond the window is not in the list,
 * so those conversions are dropped (window rule).
 */
export function lagBuckets(
  kind: 'click' | 'view',
  windowHours: number,
  params: Params,
): LagBucket[] {
  let per = bucketCache.get(params);
  if (!per) {
    per = new Map();
    bucketCache.set(params, per);
  }
  const key = `${kind}|${windowHours}`;
  const hit = per.get(key);
  if (hit) return hit;
  const { medianHours, sigma } = params.outcomes.lag[kind];
  const F = (h: number) => (h <= 0 ? 0 : Phi((Math.log(h) - Math.log(medianHours)) / sigma));
  const out: LagBucket[] = [];
  const hourly = Math.min(48, Math.floor(windowHours));
  for (let j = 1; j <= hourly; j++) out.push({ dueOffset: j, prob: F(j) - F(j - 1) });
  const days = Math.floor(windowHours / 24);
  for (let d = 3; d <= days; d++) {
    const lo = Math.max(48, 24 * (d - 1));
    const hi = 24 * d;
    if (hi <= 48) continue;
    out.push({ dueOffset: 24 * d - 12, prob: F(hi) - F(lo) });
  }
  per.set(key, out);
  return out;
}

export interface RawConversions {
  activityId: string;
  kind: 'click' | 'view';
  count: number;
}

/** Spread `count` raw conversions over their lags; returns (dueOffset, n) pairs. */
export function scheduleLags(
  r: Rng,
  count: number,
  kind: 'click' | 'view',
  windowHours: number,
  params: Params,
): { dueOffset: number; n: number }[] {
  if (count <= 0) return [];
  const buckets = lagBuckets(kind, windowHours, params);
  const draws = multinomial(
    r,
    count,
    buckets.map((b) => b.prob),
  );
  const out: { dueOffset: number; n: number }[] = [];
  draws.forEach((n, i) => {
    if (n > 0) out.push({ dueOffset: (buckets[i] as { dueOffset: number }).dueOffset, n });
  });
  return out;
}

/** Windows in hours for a line item's activity (days from the Floodlight configuration). */
export function windowHours(
  li: LineItemEntity,
  activityId: string,
  kind: 'click' | 'view',
  params: Params,
): number {
  const sel = li.floodlight.find((f) => f.activityId === activityId);
  const days =
    kind === 'click'
      ? (sel?.postClickWindowDays ?? params.outcomes.windows.clickDays)
      : (sel?.postViewWindowDays ?? params.outcomes.windows.viewDays);
  return Math.round(days * 24);
}

export function generateForActivity(
  r: Rng,
  clicks: number,
  viewNotClick: number,
  cvrClick: number,
  cvrView: number,
  act: FloodlightActivity,
  params: Params,
): { click: number; view: number } {
  if (act.tagStatus !== 'active') return { click: 0, view: 0 };
  const cat = params.outcomes.categoryMult[act.category] ?? 1;
  return {
    click: binomial(r.fork('cc'), clicks, Math.min(1, cvrClick * cat * (act.cvrClickMult ?? 1))),
    view: binomial(
      r.fork('vc'),
      Math.max(0, viewNotClick),
      Math.min(1, cvrView * cat * (act.cvrViewMult ?? 1)),
    ),
  };
}

export interface CountedConversion {
  /** Conversions counted by the activity's counting method. */
  counted: number;
  transactions: number;
  items: number;
  revenue: number;
}

/** Counting method of 6.4 applied to `raw` released conversions. Money in advertiser currency. */
export function countConversion(
  raw: number,
  act: FloodlightActivity,
  params: Params,
  fxToAdv: number,
): CountedConversion {
  const repeatDay =
    act.repeatPerUserDay ??
    params.outcomes.repeatPerUserDay[act.category] ??
    params.outcomes.repeatPerUserDay.default ??
    0.04;
  const repeatSession = act.repeatPerSession ?? repeatDay / 3;
  const aov =
    (act.avgOrderValue ?? params.outcomes.defaultAverageOrderValue) *
    (act.avgOrderValue === undefined ? fxToAdv : 1);
  const itemsPerTxn = act.itemsPerTxn ?? params.outcomes.defaultItemsPerTransaction;
  switch (act.countingMethod) {
    case 'standard':
      return { counted: raw, transactions: 0, items: 0, revenue: 0 };
    case 'unique':
      return { counted: raw / (1 + repeatDay), transactions: 0, items: 0, revenue: 0 };
    case 'perSession':
      return { counted: raw / (1 + repeatSession), transactions: 0, items: 0, revenue: 0 };
    case 'transactions':
      return {
        counted: raw,
        transactions: raw,
        items: 0,
        revenue: act.type === 'sale' ? raw * aov : 0,
      };
    case 'itemsSold': {
      const items = raw * itemsPerTxn;
      return {
        counted: raw,
        transactions: raw,
        items,
        revenue: act.type === 'sale' ? items * (aov / itemsPerTxn) : 0,
      };
    }
  }
}

/** Weight of post-view conversions in the line item's total (6.4 "Conversion counting"). */
export function postViewWeight(li: LineItemEntity): number {
  switch (li.conversionCounting.mode) {
    case 'ALL':
      return 1;
    case 'POST_CLICK_ONLY':
      return 0;
    case 'PERCENTAGE':
      return Math.min(1, Math.max(0, (li.conversionCounting.pct ?? 0) / 100));
  }
}

export const roundCount = roundHalfEven;
