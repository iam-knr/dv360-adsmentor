// Derived ratios and KPI Actual (engine.md 4.6, 9.2), pure. Cost in every cost KPI is `revenue`, the advertiser cost
// the grids call "Spent" (RC-038) and the engine paces on. Rates are percent numbers, the unit of the stored goals.
import {
  COUNTER_KEYS,
  MONEY_COUNTER_KEYS,
  type Counters,
  type KpiType,
  type Ratios,
} from './types';

/** engine.md 4.6 minimum sample (`alerts.minSample` in engine/params.json). Below it KPI Actual is "-". */
export const MIN_SAMPLE = { impressions: 1000, clicks: 30, conversions: 10, views: 100 } as const;

export const emptyCounters = (): Counters =>
  Object.fromEntries([...COUNTER_KEYS, ...MONEY_COUNTER_KEYS].map((k) => [k, 0])) as Counters;

export function addCounters(a: Counters, b: Counters): Counters {
  const out = emptyCounters();
  for (const k of Object.keys(out) as (keyof Counters)[]) out[k] = a[k] + b[k];
  return out;
}

export function scaleMoney(c: Counters, rate: number): Counters {
  if (rate === 1) return c;
  const out = { ...c };
  for (const k of MONEY_COUNTER_KEYS) out[k] = c[k] * rate;
  return out;
}

const div = (n: number, d: number): number | null => (d > 0 ? n / d : null);
const pct = (n: number, d: number): number | null => (d > 0 ? (n / d) * 100 : null);

export function deriveRatios(c: Counters): Ratios {
  return {
    ctr: pct(c.clicks, c.impressions),
    cpm: div(c.revenue * 1000, c.impressions),
    cpc: div(c.revenue, c.clicks),
    cpa: div(c.revenue, c.convTotal),
    ecpm: div(c.totalMediaCost * 1000, c.impressions),
    vcpm: div(c.revenue * 1000, c.viewableImpressions),
    cpv: div(c.revenue, c.videoViews),
    viewabilityPct: pct(c.viewableImpressions, c.measurableImpressions),
    vtr: pct(c.videoViews, c.impressions),
    completionRate: pct(c.videoCompletions, c.videoStarts),
    clickCvr: pct(c.convPostClick, c.clicks),
    imprCvr: pct(c.convTotal, c.impressions),
    customValuePerCost: div(c.customImpressionValue, c.customImpressionCost),
  };
}

/** Money KPIs: the goal is in the advertiser currency and converts with the row. */
export const MONEY_KPIS: ReadonlySet<KpiType> = new Set([
  'CPM',
  'CPV',
  'CPIAVC',
  'CPC',
  'CPA',
  'CPCL',
  'CPCV',
  'VCPM',
]);

const enough = (n: number, min: number) => n >= min;

/** KPI Actual per engine.md 4.6, null below the minimum sample or for OTHER. */
export function kpiActual(kpi: KpiType | null, c: Counters): number | null {
  const imp = enough(c.impressions, MIN_SAMPLE.impressions);
  switch (kpi) {
    case 'CPM':
      return imp ? div(c.revenue * 1000, c.impressions) : null;
    case 'CPC':
      return enough(c.clicks, MIN_SAMPLE.clicks) ? div(c.revenue, c.clicks) : null;
    case 'CTR':
      return imp ? pct(c.clicks, c.impressions) : null;
    case 'CPA':
      return enough(c.convTotal, MIN_SAMPLE.conversions) ? div(c.revenue, c.convTotal) : null;
    case 'CLICK_CVR':
      return enough(c.clicks, MIN_SAMPLE.clicks) ? pct(c.convPostClick, c.clicks) : null;
    case 'IMPR_CVR':
      return imp ? pct(c.convTotal, c.impressions) : null;
    case 'VCPM':
      return enough(c.viewableImpressions, MIN_SAMPLE.impressions)
        ? div(c.revenue * 1000, c.viewableImpressions)
        : null;
    case 'VIEWABLE_PCT':
      return enough(c.measurableImpressions, MIN_SAMPLE.impressions)
        ? pct(c.viewableImpressions, c.measurableImpressions)
        : null;
    case 'CPV':
      return enough(c.videoViews, MIN_SAMPLE.views) ? div(c.revenue, c.videoViews) : null;
    case 'VTR':
      return imp ? pct(c.videoViews, c.impressions) : null;
    case 'CPCV':
    case 'CPCL':
      // complete video views / complete audio listens: both are `videoCompletions` rows of their LI type
      return enough(c.videoCompletions, MIN_SAMPLE.views)
        ? div(c.revenue, c.videoCompletions)
        : null;
    case 'COMPL_VIDEO':
    case 'COMPL_AUDIO':
      return enough(c.videoStarts, MIN_SAMPLE.views)
        ? pct(c.videoCompletions, c.videoStarts)
        : null;
    case 'CPIAVC':
      return enough(c.audibleVisibleComplete, MIN_SAMPLE.views)
        ? div(c.revenue, c.audibleVisibleComplete)
        : null;
    case 'TOS10':
      return enough(c.measurableImpressions, MIN_SAMPLE.impressions)
        ? pct(c.viewable10sImpressions, c.measurableImpressions)
        : null;
    case 'VALUE_COST':
      return imp ? div(c.customImpressionValue, c.revenue) : null;
    case 'OTHER':
    case null:
      return null;
  }
}

/** "KPI Actual TrueView" (engine 9.4): cost KPIs read as CPV, rate KPIs as VTR, both from `videoViews`. */
export function kpiActualTrueView(kpi: KpiType | null, c: Counters): number | null {
  if (!kpi || kpi === 'OTHER' || c.videoViews === 0) return null;
  return MONEY_KPIS.has(kpi) ? kpiActual('CPV', c) : kpiActual('VTR', c);
}
