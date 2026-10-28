// Derived ratios (never stored, engine.md 9.2) and derived-dimension allocation (9.3).

import { largestRemainder } from '../math';
import { emptyMetrics, METRIC_KEYS, type Metrics } from '../metrics';

const div = (n: number, d: number): number | null => (d > 0 ? n / d : null);

export interface DerivedMetrics {
  ctr: number | null;
  /** Money per 1,000 impressions, in micros of the metrics' currency. */
  ecpm: number | null;
  ecpc: number | null;
  ecpa: number | null;
  viewableEcpm: number | null;
  viewabilityRate: number | null;
  measurableRate: number | null;
  vtr: number | null;
  completionRate: number | null;
  audibleRate: number | null;
  cvr: number | null;
  winRate: number | null;
  bidRate: number | null;
  profitMargin: number | null;
}

export function deriveMetrics(m: Metrics): DerivedMetrics {
  return {
    ctr: div(m.clicks, m.billableImpressions),
    ecpm: div(m.totalMediaCost * 1000, m.billableImpressions),
    ecpc: div(m.totalMediaCost, m.clicks),
    ecpa: div(m.totalMediaCost, m.convTotal),
    viewableEcpm: div(m.totalMediaCost * 1000, m.viewableImpressions),
    viewabilityRate: div(m.viewableImpressions, m.measurableImpressions),
    measurableRate: div(m.measurableImpressions, m.impressions),
    vtr: div(m.videoViews, m.billableImpressions),
    completionRate: div(m.videoCompletions, m.videoStarts),
    audibleRate: div(m.audibleImpressions, m.videoStarts),
    cvr: div(m.convTotal, m.clicks),
    winRate: div(m.impressions, m.bidResponses),
    bidRate: div(m.bidsSubmitted, m.eligibleRequests),
    profitMargin: div(m.profit, m.revenue),
  };
}

/**
 * Allocate a parent slice to the values of a derived dimension (city, browser, ...). The split uses
 * fixed shares and the largest remainder method per metric, so every metric of the children sums to
 * the parent exactly (9.3 "totals always reconcile"). Fractional conversion columns are scaled to
 * micro-units for the split.
 */
export function allocateDerived(
  parent: Metrics,
  shares: Record<string, number>,
): Record<string, Metrics> {
  const keys = Object.keys(shares).sort();
  const weights = keys.map((k) => shares[k] as number);
  const out: Record<string, Metrics> = {};
  for (const k of keys) out[k] = emptyMetrics();
  for (const mk of METRIC_KEYS) {
    const v = parent[mk];
    if (v === 0) continue;
    const fractional = !Number.isInteger(v);
    const scale = fractional ? 1e6 : 1;
    const parts = largestRemainder(Math.round(Math.abs(v) * scale), weights);
    const sign = v < 0 ? -1 : 1;
    parts.forEach((p, i) => {
      (out[keys[i] as string] as Metrics)[mk] = (sign * p) / scale;
    });
  }
  return out;
}
