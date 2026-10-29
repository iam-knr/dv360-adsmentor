// Wire types of the metric layer (engine.md 9.2 to 9.4, build-plan 2.7). Counter names are the engine 9.2 column
// names (RC-023). Money is in major units of `MetricRow.currency`. Rates ("%" columns: CTR, viewability, VTR,
// completion, CVR, pacing) are percent numbers (0.15 means 0.15%), the unit KPI goals are stored in.

export type MetricLevel = 'advertiser' | 'campaign' | 'io' | 'li' | 'adGroup';

export interface DateRange {
  from: string; // YYYY-MM-DD, sim date in the advertiser time zone
  to: string;
}

/** `Kpi` enum of the schema (data-model 4). */
export type KpiType =
  | 'CPM'
  | 'CPV'
  | 'VIEWABLE_PCT'
  | 'CPIAVC'
  | 'CPC'
  | 'CPA'
  | 'CTR'
  | 'CPCL'
  | 'CPCV'
  | 'COMPL_AUDIO'
  | 'COMPL_VIDEO'
  | 'TOS10'
  | 'VCPM'
  | 'VTR'
  | 'VALUE_COST'
  | 'CLICK_CVR'
  | 'IMPR_CVR'
  | 'OTHER';

/** Additive counters summed from `SimDailyMetric` (`sliceKind = 'total'`). Money counters are converted. */
export const COUNTER_KEYS = [
  'impressions',
  'billableImpressions',
  'clicks',
  'engagements',
  'measurableImpressions',
  'viewableImpressions',
  'viewable10sImpressions',
  'audibleVisibleComplete',
  'videoStarts',
  'videoCompletions',
  'videoViews',
  'coViewedImpressions',
  'convPostClick',
  'convPostView',
  'convTotal',
  'lostBudget',
  'lostPacing',
  'lostBelowMinBid',
  'lostExternalBid',
  'customImpressionValue',
] as const;

export const MONEY_COUNTER_KEYS = [
  'mediaCost',
  'totalMediaCost',
  'revenue',
  'convRevenue',
  'customImpressionCost',
] as const;

export type CounterKey = (typeof COUNTER_KEYS)[number];
export type MoneyCounterKey = (typeof MONEY_COUNTER_KEYS)[number];
export type Counters = Record<CounterKey | MoneyCounterKey, number>;

/** Derived ratios, never stored (engine 9.2). `null` = empty metric, the grid shows "-" (AC-06-02). */
export interface Ratios {
  ctr: number | null;
  cpm: number | null;
  cpc: number | null;
  cpa: number | null;
  ecpm: number | null;
  vcpm: number | null;
  cpv: number | null;
  viewabilityPct: number | null;
  vtr: number | null;
  completionRate: number | null;
  clickCvr: number | null;
  imprCvr: number | null;
  /** "Custom impr. value / cost" column. */
  customValuePerCost: number | null;
}

/**
 * One grid row. The fields of the P3-09 stub (impressions ... dailyTarget) keep their names and `number` type so
 * the list pages written against the stub compile unchanged; they read 0 when empty. The nullable fields after
 * them carry the "-" rule: use `ratios`, `kpiActual`, `budgetAmount` and `hasData` to decide what to print.
 */
export interface MetricRow {
  impressions: number;
  clicks: number;
  /** `clicks + engagements` (engine 9.4 IO list). */
  interactions: number;
  conversions: number;
  /** Sum of `revenue`; the grid's "Spent" and "Revenue" columns (RC-038). */
  revenue: number;
  cpa: number;
  customImpressionValue: number;
  customImpressionCost: number;
  budget: number;
  pacingPct: number;
  budgetRemaining: number;
  dailyTarget: number;

  /** Currency of every money field in this row. */
  currency: string;
  /** At least one `SimDailyMetric` row in the range. False: every metric prints "-". */
  hasData: boolean;
  /** Same as `revenue` (RC-038), named after the Campaigns list column. */
  spent: number;
  totalMediaCost: number;
  counters: Counters;
  ratios: Ratios;
  /** KPI of the campaign (campaign level) or of the IO (IO, LI and ad group levels); null at advertiser level. */
  kpi: KpiType | null;
  kpiGoal: number | null;
  /** engine.md 4.6 formula over the range, null below the minimum sample. */
  kpiActual: number | null;
  /** TrueView KPI: CPV for cost KPIs, VTR for rate KPIs, from `videoViews` (engine 9.4). */
  kpiActualTrueView: number | null;
  /** null = "Unknown" (campaign without budget rows, LI with "Unlimited up to IO"). */
  budgetAmount: number | null;
  /** null when the level has no pacing snapshot (campaign, advertiser) or no data. */
  pacing: { pacingPct: number | null; budgetRemaining: number | null; dailyTarget: number | null };
}

export interface GridMetricsArgs {
  level: MetricLevel;
  ids: string[];
  range: DateRange;
  sandboxId: string;
  /** Convert all money to this currency with `FxRate`. Default: each row in its advertiser currency. */
  currency?: string;
}

/** Footer row: counters summed after conversion, ratios recomputed from the sums. */
export interface MetricTotals extends Omit<MetricRow, 'kpi' | 'pacing'> {
  kpi: KpiType | null;
  rowCount: number;
  pacing: { pacingPct: null; budgetRemaining: number | null; dailyTarget: number | null };
}

export type ChartCardId =
  | 'totalCost'
  | 'avgPerformance'
  | 'impressionsLost'
  | 'addedImpressionReach'
  | 'exploreBudgetOptions';

export interface DayPoint {
  date: string;
  value: number | null;
}

export type ChartCardData =
  | {
      id: 'totalCost';
      currency: string;
      total: number;
      today: number;
      /** Sum of the budgets of the ids, null when unknown. */
      budget: number | null;
      days: DayPoint[];
    }
  | {
      id: 'avgPerformance';
      currency: string;
      kpi: KpiType | null;
      goal: number | null;
      actual: number | null;
      days: DayPoint[];
    }
  | {
      id: 'impressionsLost';
      /** engine 9.4: lostBudget + lostPacing + lostBelowMinBid + lostExternalBid, in that reason order. */
      total: number;
      byReason: { budget: number; pacing: number; bid: number; other: number };
      days: DayPoint[];
    }
  | { id: 'addedImpressionReach' | 'exploreBudgetOptions'; empty: true };
