// A/B report maths (engine.md 6.7). Pure: counters in, tiles and significance out. `rate` metrics are k successes of
// n trials (pooled two-proportion z), `cost` metrics use the delta method, `count` metrics compare volumes per unit
// of audience split. Significant when |z| >= zCritical (two-sided).
import type { ConfidenceLevel } from '@prisma/client';
import { AB_METRICS, type AbMetric } from './constants';
import type { Tile, TileArm, TileKind } from './types';

export const Z_CRITICAL: Record<ConfidenceLevel, number> = { P90: 1.645, P95: 1.96 };
export const confidencePct = (c: ConfidenceLevel): 90 | 95 => (c === 'P95' ? 95 : 90);

/** Standard normal CDF (Abramowitz and Stegun 7.1.26 for erf). */
export function normalCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + 0.3275911 * (Math.abs(x) / Math.SQRT2));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-(x * x) / 2);
  return 0.5 * (1 + sign * y);
}
export const twoSidedP = (z: number): number => 2 * (1 - normalCdf(Math.abs(z)));

export interface ArmCounters {
  impressions: number;
  clicks: number;
  conversions: number;
  engagements: number;
  videoStarts: number;
  videoCompletions: number;
  videoViews: number;
  audibleVisibleComplete: number;
  customImpressionValue: number;
  /** Reached users and the pool they come from (reach rate). */
  reached: number;
  /** Money in the advertiser currency. */
  cost: number;
  revenue: number;
  /** Share of the audience the arm gets, 0 to 1. */
  split: number;
}

/** z of a difference between two proportions (pooled). Null when a trial count is zero. */
export function proportionZ(k1: number, n1: number, k2: number, n2: number): number | null {
  if (n1 <= 0 || n2 <= 0) return null;
  const p = (k1 + k2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (se === 0) return 0;
  return (k1 / n1 - k2 / n2) / se;
}

/** Delta method for cost per success: se_i = r_i * sqrt(cv^2 / n_i + 1 / k_i). */
export function costZ(
  r1: number,
  k1: number,
  n1: number,
  r2: number,
  k2: number,
  n2: number,
  cv = 0.3,
): number | null {
  if (k1 <= 0 || k2 <= 0 || n1 <= 0 || n2 <= 0) return null;
  const se1 = r1 * Math.sqrt((cv * cv) / n1 + 1 / k1);
  const se2 = r2 * Math.sqrt((cv * cv) / n2 + 1 / k2);
  const se = Math.sqrt(se1 * se1 + se2 * se2);
  return se === 0 ? 0 : (r1 - r2) / se;
}

/** Volume per unit of split compared as Poisson counts. */
export function countZ(x1: number, s1: number, x2: number, s2: number): number | null {
  if (s1 <= 0 || s2 <= 0) return null;
  const a = x1 / s1;
  const b = x2 / s2;
  const se = Math.sqrt(x1 / (s1 * s1) + x2 / (s2 * s2));
  return se === 0 ? 0 : (a - b) / se;
}

interface TileDef {
  key: string;
  label: string;
  kind: TileKind;
  /** Value of the tile for one arm (null = empty). */
  value: (c: ArmCounters) => number | null;
  /** z of an arm against the control. Null: no significance for this tile. */
  z?: (a: ArmCounters, control: ArmCounters) => number | null;
  lowerIsBetter?: boolean;
  money?: boolean;
}

const div = (a: number, b: number): number | null => (b > 0 ? a / b : null);

const T = {
  impressions: {
    key: 'impressions', label: 'Impressions', kind: 'count',
    value: (c) => c.impressions,
    z: (a, b) => countZ(a.impressions, a.split, b.impressions, b.split),
  },
  clicks: {
    key: 'clicks', label: 'Clicks', kind: 'count', value: (c) => c.clicks,
    z: (a, b) => countZ(a.clicks, a.split, b.clicks, b.split),
  },
  ctr: {
    key: 'ctr', label: 'Click through rate', kind: 'percent',
    value: (c) => { const v = div(c.clicks, c.impressions); return v === null ? null : v * 100; },
    z: (a, b) => proportionZ(a.clicks, a.impressions, b.clicks, b.impressions),
  },
  cpc: {
    key: 'cpc', label: 'Cost per click', kind: 'money', money: true, lowerIsBetter: true,
    value: (c) => div(c.revenue, c.clicks),
    z: (a, b) => {
      const ra = div(a.revenue, a.clicks); const rb = div(b.revenue, b.clicks);
      return ra === null || rb === null ? null : costZ(ra, a.clicks, a.impressions, rb, b.clicks, b.impressions);
    },
  },
  revenue: {
    key: 'revenue', label: 'Revenue', kind: 'money', money: true, value: (c) => c.revenue,
  },
  conversions: {
    key: 'conversions', label: 'Conversions', kind: 'count', value: (c) => c.conversions,
    z: (a, b) => countZ(a.conversions, a.split, b.conversions, b.split),
  },
  cvr: {
    key: 'cvr', label: 'Conversion rate', kind: 'percent',
    value: (c) => { const v = div(c.conversions, c.impressions); return v === null ? null : v * 100; },
    z: (a, b) => proportionZ(a.conversions, a.impressions, b.conversions, b.impressions),
  },
  cpa: {
    key: 'cpa', label: 'Cost per conversion', kind: 'money', money: true, lowerIsBetter: true,
    value: (c) => div(c.revenue, c.conversions),
    z: (a, b) => {
      const ra = div(a.revenue, a.conversions); const rb = div(b.revenue, b.conversions);
      return ra === null || rb === null ? null : costZ(ra, a.conversions, a.impressions, rb, b.conversions, b.impressions);
    },
  },
  reach: {
    key: 'reach', label: 'Reach', kind: 'count', value: (c) => c.reached,
    z: (a, b) => countZ(a.reached, a.split, b.reached, b.split),
  },
  reachRate: {
    key: 'reachRate', label: 'Reach per impression', kind: 'percent',
    value: (c) => { const v = div(c.reached, c.impressions); return v === null ? null : v * 100; },
    z: (a, b) => proportionZ(a.reached, a.impressions, b.reached, b.impressions),
  },
  frequency: {
    key: 'frequency', label: 'Average frequency', kind: 'decimal', value: (c) => div(c.impressions, c.reached),
  },
  cpm: {
    key: 'cpm', label: 'CPM', kind: 'money', money: true, lowerIsBetter: true,
    value: (c) => { const v = div(c.revenue, c.impressions); return v === null ? null : v * 1000; },
  },
  completions: {
    key: 'completions', label: 'Video completions', kind: 'count', value: (c) => c.videoCompletions,
    z: (a, b) => countZ(a.videoCompletions, a.split, b.videoCompletions, b.split),
  },
  completionRate: {
    key: 'completionRate', label: 'Completion rate', kind: 'percent',
    value: (c) => { const v = div(c.videoCompletions, c.videoStarts || c.impressions); return v === null ? null : v * 100; },
    z: (a, b) => proportionZ(a.videoCompletions, a.videoStarts || a.impressions, b.videoCompletions, b.videoStarts || b.impressions),
  },
  cpcv: {
    key: 'cpcv', label: 'Cost per completed view', kind: 'money', money: true, lowerIsBetter: true,
    value: (c) => div(c.revenue, c.videoCompletions),
    z: (a, b) => {
      const ra = div(a.revenue, a.videoCompletions); const rb = div(b.revenue, b.videoCompletions);
      return ra === null || rb === null ? null : costZ(ra, a.videoCompletions, a.impressions, rb, b.videoCompletions, b.impressions);
    },
  },
  avoc: {
    key: 'avoc', label: 'AVOC', kind: 'count', value: (c) => c.audibleVisibleComplete,
    z: (a, b) => countZ(a.audibleVisibleComplete, a.split, b.audibleVisibleComplete, b.split),
  },
  avocRate: {
    key: 'avocRate', label: 'AVOC rate', kind: 'percent',
    value: (c) => { const v = div(c.audibleVisibleComplete, c.impressions); return v === null ? null : v * 100; },
    z: (a, b) => proportionZ(a.audibleVisibleComplete, a.impressions, b.audibleVisibleComplete, b.impressions),
  },
  customValue: {
    key: 'customValue', label: 'Custom impression value', kind: 'decimal', value: (c) => c.customImpressionValue,
    z: (a, b) => countZ(a.customImpressionValue, a.split, b.customImpressionValue, b.split),
  },
  valuePerImpr: {
    key: 'valuePerImpr', label: 'Value per 1,000 impressions', kind: 'decimal',
    value: (c) => { const v = div(c.customImpressionValue, c.impressions); return v === null ? null : v * 1000; },
  },
  engagements: {
    key: 'engagements', label: 'Engagements', kind: 'count', value: (c) => c.engagements,
    z: (a, b) => countZ(a.engagements, a.split, b.engagements, b.split),
  },
  engagementRate: {
    key: 'engagementRate', label: 'Engagement rate', kind: 'percent',
    value: (c) => { const v = div(c.engagements, c.impressions); return v === null ? null : v * 100; },
    z: (a, b) => proportionZ(a.engagements, a.impressions, b.engagements, b.impressions),
  },
  views: {
    key: 'views', label: 'Views', kind: 'count', value: (c) => c.videoViews,
    z: (a, b) => countZ(a.videoViews, a.split, b.videoViews, b.split),
  },
  viewRate: {
    key: 'viewRate', label: 'View rate', kind: 'percent',
    value: (c) => { const v = div(c.videoViews, c.impressions); return v === null ? null : v * 100; },
    z: (a, b) => proportionZ(a.videoViews, a.impressions, b.videoViews, b.impressions),
  },
  cpv: {
    key: 'cpv', label: 'Cost per view', kind: 'money', money: true, lowerIsBetter: true,
    value: (c) => div(c.revenue, c.videoViews),
    z: (a, b) => {
      const ra = div(a.revenue, a.videoViews); const rb = div(b.revenue, b.videoViews);
      return ra === null || rb === null ? null : costZ(ra, a.videoViews, a.impressions, rb, b.videoViews, b.impressions);
    },
  },
} satisfies Record<string, TileDef>;

/** Tiles per metric (S4: "Clicks · Click through rate · Cost per click · Revenue"). The first tile decides "Best". */
export const TILES_BY_METRIC: Record<AbMetric, TileDef[]> = {
  IMPRESSIONS: [T.impressions, T.cpm, T.reach, T.revenue],
  CLICKS: [T.clicks, T.ctr, T.cpc, T.revenue],
  CONVERSIONS: [T.conversions, T.cvr, T.cpa, T.revenue],
  REACH: [T.reach, T.reachRate, T.frequency, T.impressions],
  VIDEO_COMPLETIONS: [T.completions, T.completionRate, T.cpcv, T.revenue],
  AVOC: [T.avoc, T.avocRate, T.impressions, T.revenue],
  CUSTOM_IMPRESSION_VALUE: [T.customValue, T.valuePerImpr, T.impressions, T.revenue],
  ENGAGEMENTS: [T.engagements, T.engagementRate, T.impressions, T.revenue],
  VIEWS: [T.views, T.viewRate, T.cpv, T.revenue],
};

/** The tile whose significance feeds the report-level "Best" (the rate or volume of the chosen metric). */
export const PRIMARY_TILE: Record<AbMetric, string> = {
  IMPRESSIONS: 'impressions',
  CLICKS: 'ctr',
  CONVERSIONS: 'cvr',
  REACH: 'reachRate',
  VIDEO_COMPLETIONS: 'completionRate',
  AVOC: 'avocRate',
  CUSTOM_IMPRESSION_VALUE: 'customValue',
  ENGAGEMENTS: 'engagementRate',
  VIEWS: 'viewRate',
};

export interface ArmInput {
  armId: string;
  name: string;
  isControl: boolean;
  counters: ArmCounters;
}

export interface TileResult {
  tiles: Tile[];
  best: { armId: string; name: string } | 'N/A';
  significance: Record<string, { z: number | null; p: number | null; significant: boolean }>;
}

/**
 * "Best" among arms significantly different from the control: the better value of the control and of the arms whose
 * |z| reaches the critical value. No significant arm: "N/A".
 */
function pickBest(
  arms: ArmInput[],
  values: Map<string, number | null>,
  zs: Map<string, number | null>,
  crit: number,
  lowerIsBetter: boolean,
): { armId: string; name: string } | 'N/A' {
  const control = arms.find((a) => a.isControl);
  if (!control) return 'N/A';
  const sig = arms.filter((a) => !a.isControl && (zs.get(a.armId) ?? 0) !== null && Math.abs(zs.get(a.armId) ?? 0) >= crit);
  if (sig.length === 0) return 'N/A';
  const pool = [control, ...sig].filter((a) => values.get(a.armId) !== null && values.get(a.armId) !== undefined);
  if (pool.length === 0) return 'N/A';
  pool.sort((a, b) => {
    const d = (values.get(a.armId) as number) - (values.get(b.armId) as number);
    return lowerIsBetter ? d : -d;
  });
  const top = pool[0] as ArmInput;
  return { armId: top.armId, name: top.name };
}

export function buildTiles(
  metric: AbMetric,
  arms: ArmInput[],
  confidence: ConfidenceLevel,
  currency: string,
): TileResult {
  const crit = Z_CRITICAL[confidence];
  const control = arms.find((a) => a.isControl) ?? arms[0];
  if (!control) return { tiles: [], best: 'N/A', significance: {} };
  const defs = TILES_BY_METRIC[metric];
  const tiles: Tile[] = [];
  let reportBest: TileResult['best'] = 'N/A';
  const significance: TileResult['significance'] = {};
  const primary = PRIMARY_TILE[metric];

  for (const def of defs) {
    const values = new Map<string, number | null>();
    const zs = new Map<string, number | null>();
    for (const a of arms) {
      values.set(a.armId, def.value(a.counters));
      zs.set(a.armId, a.armId === control.armId || !def.z ? null : def.z(a.counters, control.counters));
    }
    const cv = values.get(control.armId) ?? null;
    const armsOut: TileArm[] = arms.map((a) => {
      const v = values.get(a.armId) ?? null;
      const z = zs.get(a.armId) ?? null;
      return {
        armId: a.armId,
        value: v,
        diffPct: a.armId === control.armId || v === null || cv === null || cv === 0 ? null : ((v - cv) / Math.abs(cv)) * 100,
        significant: z !== null && Math.abs(z) >= crit,
        z,
      };
    });
    const best = def.z
      ? pickBest(arms, values, zs, crit, def.lowerIsBetter === true)
      : null;
    tiles.push({ key: def.key, label: def.label, kind: def.kind, ...(def.money ? { currency } : {}), arms: armsOut, best });
    if (def.key === primary) {
      reportBest = best ?? 'N/A';
      for (const a of arms) {
        const z = zs.get(a.armId) ?? null;
        significance[a.armId] = {
          z,
          p: z === null ? null : twoSidedP(z),
          significant: z !== null && Math.abs(z) >= crit,
        };
      }
    }
  }
  return { tiles, best: reportBest, significance };
}

export const metricLabel = (m: AbMetric): string => AB_METRICS.find((x) => x.key === m)?.label ?? m;
