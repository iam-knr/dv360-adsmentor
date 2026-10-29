// forecastPlan (module 04 4.8, C-04-3): the plan counterpart of the line item forecast. Pure and deterministic from
// the seed, the plan id and the inputs; expected values only. Parameters are in `params.ts`.
import {
  AGE_BRACKETS,
  PER_USD,
  ageShare,
  bracketsFor,
  demoShare,
  genderShare,
  planCountryOrDefault,
  type PlanDemographics,
} from './countries';
import { hex, unit } from './hash';
import { PLAN_PARAMS as P } from './params';
import type {
  ForecastTabKey,
  PlanBuyingMethodKey,
  PlanForecast,
  PlanRowForecast,
  ReachBasisKey,
  SeriesPoint,
} from './types';

export interface ForecastRowInput {
  /** Stable key of the row (its id, or its ordinal for unsaved rows). */
  key: string;
  name: string;
  buyingMethod: PlanBuyingMethodKey;
  budgetNet: number;
  feePct?: number | null;
  maxCpm?: number | null;
  audienceRefs?: string[];
  startDate?: string;
  endDate?: string;
}

export interface ForecastInput {
  seed: string;
  planId: string;
  country: string;
  currency: string;
  demographics: PlanDemographics;
  reachBasis: ReachBasisKey;
  includeYoutube: boolean;
  startDate: string;
  endDate: string;
  rows: ForecastRowInput[];
  asOf: string;
}

const round = (n: number, d = 2): number => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

interface RowModel {
  key: string;
  method: PlanBuyingMethodKey;
  cpm: number;
  fee: number;
  net: number;
  winShare: number;
  impr: number;
  onTarget: number;
  universe: number;
  maxCpm: number | null;
}

interface Aggregate {
  reachPct: number;
  reach: number;
  impressions: number;
  onTarget: number;
  budget: number;
  trps: number;
  avgFrequency: number;
  viewable: number;
  measurable: number;
  conversions: number;
  clickConversions: number;
}

/** Reach of one segment: U (1 - (1 + I / (k U))^-k), ENG 9.5. */
export function segmentReach(impr: number, universe: number, k: number = P.k): number {
  if (impr <= 0 || universe <= 0) return 0;
  return universe * (1 - Math.pow(1 + impr / (k * universe), -k));
}

/** Clearing CPM of the plan market in the plan currency (before method premium and noise). */
export function baseCpm(country: string, currency: string): number {
  const c = planCountryOrDefault(country);
  return c.cpmUsd * (PER_USD[currency] ?? 1);
}

export function audienceShare(refs: string[] | undefined): number {
  const n = refs?.length ?? 0;
  return n === 0 ? 1 : Math.max(P.audienceShareFloor, Math.pow(P.audienceShareEach, n));
}

function buildRows(input: ForecastInput, target: number): RowModel[] {
  const base = baseCpm(input.country, input.currency);
  return input.rows.map((r) => {
    const noise = 1 + (unit(`${input.seed}|${input.planId}|${r.key}`) - 0.5) * 2 * P.noise;
    const cpm = Math.max(0.0001, base * P.buyingMethodPremium[r.buyingMethod] * noise);
    const cap = r.buyingMethod === 'OPEN_AUCTION' ? (r.maxCpm ?? null) : null;
    const winShare = cap && cap < cpm ? Math.max(0.2, cap / cpm) : 1;
    const net = Math.max(0, r.budgetNet) * winShare;
    const impr = (net / cpm) * 1000;
    return {
      key: r.key,
      method: r.buyingMethod,
      cpm,
      fee: r.feePct ?? P.fees.default,
      net,
      winShare,
      impr,
      onTarget: impr * P.demoOnTargetShare,
      universe: target * audienceShare(r.audienceRefs),
      maxCpm: r.maxCpm ?? null,
    };
  });
}

function aggregate(rows: RowModel[], target: number, scale = 1): Aggregate {
  let miss = 1;
  let impressions = 0;
  let onTarget = 0;
  let budget = 0;
  let viewable = 0;
  let measurable = 0;
  let conversions = 0;
  let clickConversions = 0;
  for (const r of rows) {
    const onT = r.onTarget * scale;
    const impr = r.impr * scale;
    const reach = segmentReach(onT, r.universe);
    miss *= 1 - (target > 0 ? reach / target : 0);
    impressions += impr;
    onTarget += onT;
    budget += r.net * scale * (1 + r.fee);
    const meas = impr * P.measurable;
    measurable += meas;
    viewable += meas * P.viewability[r.method];
    clickConversions += impr * P.ctr * P.clickCvr;
    conversions += impr * P.ctr * P.clickCvr + meas * P.viewability[r.method] * P.postViewCvr;
  }
  const reach = target * (1 - miss);
  const reachPct = target > 0 ? (reach / target) * 100 : 0;
  const avgFrequency = reach > 0 ? onTarget / reach : 0;
  return {
    reachPct,
    reach,
    impressions,
    onTarget,
    budget,
    trps: target > 0 ? (onTarget / target) * 100 : 0,
    avgFrequency,
    viewable,
    measurable,
    conversions,
    clickConversions,
  };
}

/** Reach at 1+ .. 10+ from a negative binomial with the plan's mean and clustering k, scaled to the plan reach. */
export function reachByFrequency(mean: number, reachPct: number, k: number = P.k): number[] {
  if (mean <= 0 || reachPct <= 0) return Array.from({ length: 10 }, () => 0);
  const q = mean / (k + mean);
  let p = Math.pow(1 + mean / k, -k);
  const atLeast1 = 1 - p;
  const out: number[] = [];
  let cdf = p;
  for (let f = 1; f <= 10; f++) {
    out.push(round(((1 - cdf) / atLeast1) * reachPct, 3));
    p = p * ((k + f - 1) / f) * q;
    cdf += p;
  }
  return out;
}

function weeksOf(startDate: string, endDate: string): number {
  const days = Math.max(1, Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000) + 1);
  return Math.max(1, Math.min(12, Math.ceil(days / 7)));
}

export function forecastPlan(input: ForecastInput): PlanForecast {
  const country = planCountryOrDefault(input.country);
  const basis = input.reachBasis === 'DIGITAL' ? country.digital : country.census;
  const target = basis * demoShare(input.demographics);
  const rows = buildRows(input, target);
  const agg = aggregate(rows, target);
  const sumNet = rows.reduce((s, r) => s + r.net, 0);
  const budgetShareBase = input.rows.reduce((s, r) => s + Math.max(0, r.budgetNet), 0);
  const perRow: Record<string, PlanRowForecast> = {};
  for (const r of rows) {
    const one = aggregate([r], target);
    const meas = r.impr * P.measurable;
    const view = meas * P.viewability[r.method];
    const conv = r.impr * P.ctr * P.clickCvr + view * P.postViewCvr;
    const gross = r.net * (1 + r.fee);
    const locked = r.method !== 'OPEN_AUCTION';
    perRow[r.key] = {
      onTargetReachPct: round(one.reachPct, 2),
      onTargetFrequency: round(one.avgFrequency, 2),
      trps: round(one.trps, 1),
      costPerReach: one.reach > 0 ? round(gross / one.reach, 4) : 0,
      cpa: conv >= 1 ? round(gross / conv, 2) : null,
      onTargetImpressions: Math.round(one.onTarget),
      billableUnits: Math.round(r.impr),
      billableUnitLabel: 'impr',
      avgCost: round(r.cpm * (1 + r.fee), 2),
      avgCostLabel: 'CPM',
      maxCpm: locked ? null : r.maxCpm,
      viewableCpm: view > 0 ? round(gross / view * 1000, 2) : 0,
      viewabilityRate: meas > 0 ? round((view / meas) * 100, 1) : null,
      budgetSharePct: budgetShareBase > 0 ? round((r.net / (budgetShareBase || 1)) * 100, 1) : 0,
    };
  }
  const meanPerPerson = target > 0 ? agg.onTarget / target : 0;
  const hasRows = rows.length > 0 && sumNet > 0;
  const weeks = weeksOf(input.startDate, input.endDate);

  const tabs: Record<ForecastTabKey, SeriesPoint[]> = {
    REACH: P.budgetPoints.map((f) => {
      const a = aggregate(rows, target, f);
      return {
        label: `${Math.round(f * 100)}%`,
        budget: round(a.budget, 2),
        reachPct: round(a.reachPct, 2),
        reach: Math.round(a.reach),
        avgFrequency: round(a.avgFrequency, 2),
      };
    }),
    TRUEVIEW: [],
    CONVERSIONS: [],
    DEMOGRAPHICS: [],
    DEVICES: [],
  };
  const ytImpr = input.includeYoutube ? agg.impressions * P.youtubeShare : 0;
  const ytViews = ytImpr * P.viewThroughRate;
  const ytBudget = input.includeYoutube ? agg.budget * P.youtubeShare : 0;
  const weights = Array.from({ length: weeks }, (_, w) => 1 + 0.25 * Math.sin(((w + 0.5) / weeks) * Math.PI));
  const weightSum = weights.reduce((s, x) => s + x, 0);
  for (let w = 0; w < weeks; w++) {
    const wShare = (weights[w] as number) / weightSum;
    const views = ytViews * wShare;
    const conv = agg.conversions * wShare;
    tabs.TRUEVIEW.push({
      label: `Week ${w + 1}`,
      views: Math.round(views),
      cpv: ytViews > 0 ? round(ytBudget / ytViews, 4) : 0,
    });
    tabs.CONVERSIONS.push({
      label: `Week ${w + 1}`,
      conversions: round(conv, 1),
      cpa: agg.conversions >= 1 ? round(agg.budget / agg.conversions, 2) : 0,
    });
  }
  const brackets = bracketsFor(input.demographics);
  const bracketSkew: Record<string, number> = {
    '18-24': 0.92,
    '25-34': 1.08,
    '35-44': 1.1,
    '45-54': 1.02,
    '55-64': 0.95,
    '65+': 0.8,
  };
  const bracketTotal = brackets.reduce((s, b) => s + ageShare(b), 0) || 1;
  for (const b of AGE_BRACKETS.filter((x) => brackets.includes(x))) {
    const point: SeriesPoint = { label: b };
    for (const g of ['MALE', 'FEMALE'] as const) {
      const sexOk = input.demographics.genders.includes(g);
      const share = sexOk ? ageShare(b) / bracketTotal : 0;
      const skew = (bracketSkew[b] ?? 1) * (g === 'MALE' ? 1.02 : 0.98);
      const key = g === 'MALE' ? 'Male' : 'Female';
      point[`reachPct_${key}`] = sexOk ? round(agg.reachPct * skew, 2) : 0;
      point[`impressions_${key}`] = Math.round(agg.impressions * share * (genderShare(g) / 0.98));
    }
    tabs.DEMOGRAPHICS.push(point);
  }
  for (const [device, share] of Object.entries(P.deviceShare)) {
    tabs.DEVICES.push({
      label: device,
      reachPct_all: round(Math.min(100, agg.reachPct * (0.55 + share * 0.9)), 2),
      impressions_all: Math.round(agg.impressions * share),
    });
  }

  const totalCpm = agg.impressions > 0 ? (agg.budget / agg.impressions) * 1000 : 0;
  const forecast: PlanForecast = {
    asOf: input.asOf,
    reachPct: round(agg.reachPct, 2),
    reach: Math.round(agg.reach),
    avgFrequency: round(agg.avgFrequency, 2),
    totalCpm: round(totalCpm, 4),
    onTargetCpm: agg.onTarget > 0 ? round((agg.budget / agg.onTarget) * 1000, 4) : 0,
    trps: round(agg.trps, 1),
    cpp: agg.trps > 0 ? round(agg.budget / agg.trps, 2) : 0,
    population: {
      census: country.census,
      digital: country.digital,
      tv: country.tv,
      youtube: country.youtube,
    },
    cpa: agg.conversions >= 1 ? round(agg.budget / agg.conversions, 2) : null,
    actionCpa: agg.clickConversions >= 1 ? round(agg.budget / agg.clickConversions, 2) : null,
    viewableCpm: agg.viewable > 0 ? round((agg.budget / agg.viewable) * 1000, 4) : 0,
    viewabilityRate: agg.measurable > 0 ? round((agg.viewable / agg.measurable) * 100, 1) : null,
    reachByFrequency: hasRows ? reachByFrequency(meanPerPerson, agg.reachPct) : reachByFrequency(0, 0),
    budget: round(agg.budget, 2),
    impressions: Math.round(agg.impressions),
    perRow,
    tabs,
    inputsHash: hexOfInputs(input),
  };
  return forecast;
}

export function hexOfInputs(i: ForecastInput): string {
  return hex(
    JSON.stringify([
      i.country,
      i.currency,
      i.demographics,
      i.reachBasis,
      i.includeYoutube,
      i.startDate,
      i.endDate,
      i.rows.map((r) => [
        r.key,
        r.buyingMethod,
        r.budgetNet,
        r.feePct ?? null,
        r.maxCpm ?? null,
        r.audienceRefs ?? [],
      ]),
    ]),
  );
}
