export type MetricLevel = 'advertiser' | 'campaign' | 'io' | 'li' | 'adGroup';

export interface DateRange {
  from: string; // YYYY-MM-DD, sim date
  to: string;
}

/** Columns of engine.md 9.4. */
export interface MetricRow {
  impressions: number;
  clicks: number;
  interactions: number;
  conversions: number;
  revenue: number;
  cpa: number;
  customImpressionValue: number;
  customImpressionCost: number;
  budget: number;
  pacingPct: number;
  budgetRemaining: number;
  dailyTarget: number;
}

export interface GridMetricsArgs {
  level: MetricLevel;
  ids: string[];
  range: DateRange;
  sandboxId: string;
}

const zeroRow = (): MetricRow => ({
  impressions: 0,
  clicks: 0,
  interactions: 0,
  conversions: 0,
  revenue: 0,
  cpa: 0,
  customImpressionValue: 0,
  customImpressionCost: 0,
  budget: 0,
  pacingPct: 0,
  budgetRemaining: 0,
  dailyTarget: 0,
});

/** Stub (P3-09 replaces it): returns zeros. */
export async function getGridMetrics(args: GridMetricsArgs): Promise<Record<string, MetricRow>> {
  return await Promise.resolve(Object.fromEntries(args.ids.map((id) => [id, zeroRow()])));
}
