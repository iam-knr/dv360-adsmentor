// Additive metric counters (engine.md 9.2, names from RC-023). Derived ratios are never stored.
// Counts are integers except the conversion columns, which can be fractional (counting methods,
// attribution credit). Money is integer micros of the advertiser currency (RC-025).

export const COUNT_KEYS = [
  // delivery
  'bidRequests',
  'eligibleRequests',
  'bidsSubmitted',
  'bidResponses',
  'impressions',
  'billableImpressions',
  'invalidImpressions',
  'beginToRenderImpressions',
  'blockedImpressions',
  'inactiveImpressions',
  // interactions
  'clicks',
  'invalidClicks',
  'engagements',
  'companionClicks',
  // active view
  'measurableImpressions',
  'viewableImpressions',
  'viewable10sImpressions',
  'audibleImpressions',
  // video and audio
  'videoStarts',
  'videoQ1',
  'videoMid',
  'videoQ3',
  'videoCompletions',
  'skips',
  'videoViews',
  'coViewedImpressions',
  'watchSecondsTotal',
  // win and loss (funnel stage counts rolled up)
  'lostTargeting',
  'lostCreative',
  'lostFrequency',
  'lostBudget',
  'lostPacing',
  'lostBelowMinBid',
  'lostInternal',
  'lostExternalBid',
  'lostExternalCreative',
  'lostExternalOther',
  'lostNotReported',
] as const;

export const CONVERSION_KEYS = [
  'convPostClick',
  'convPostView',
  'convTotal',
  'convRevenue',
  'convTransactions',
  'convItems',
] as const;

export const MONEY_KEYS = [
  'mediaCost',
  'refund',
  'cpmFee1',
  'cpmFee2',
  'mediaFee1',
  'mediaFee2',
  'dataCost',
  'verificationCost',
  'adServingCost',
  'totalMediaCost',
  'revenue',
  'profit',
  'clientCost',
] as const;

export const METRIC_KEYS = [...COUNT_KEYS, ...CONVERSION_KEYS, ...MONEY_KEYS] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];
export type Metrics = Record<MetricKey, number>;
export type CountKey = (typeof COUNT_KEYS)[number];
export type MoneyKey = (typeof MONEY_KEYS)[number];

export function emptyMetrics(): Metrics {
  const m = {} as Metrics;
  for (const k of METRIC_KEYS) m[k] = 0;
  return m;
}

export function addMetrics(into: Metrics, from: Partial<Metrics>): Metrics {
  for (const k of METRIC_KEYS) {
    const v = from[k];
    if (v) into[k] += v;
  }
  return into;
}

export function isZeroMetrics(m: Metrics): boolean {
  for (const k of METRIC_KEYS) if (m[k] !== 0) return false;
  return true;
}

const CONV_PRECISION = 1e6;
/** Conversion columns are carried at six decimals so regrouped sums stay stable. */
export const roundConv = (x: number): number => Math.round(x * CONV_PRECISION) / CONV_PRECISION;

/** Metric keys that must be integers. */
export const INTEGER_KEYS: readonly MetricKey[] = [...COUNT_KEYS, ...MONEY_KEYS];

/** Position of each metric in the flat arrays used for fast accumulation. */
export const METRIC_INDEX = Object.fromEntries(METRIC_KEYS.map((k, i) => [k, i])) as Record<
  MetricKey,
  number
>;
export const METRIC_COUNT = METRIC_KEYS.length;

export const newMetricArray = (): Float64Array => new Float64Array(METRIC_COUNT);

export function addArray(into: Float64Array, from: Float64Array): void {
  for (let i = 0; i < METRIC_COUNT; i++) into[i] = (into[i] as number) + (from[i] as number);
}

export function toMetrics(a: Float64Array): Metrics {
  const m = {} as Metrics;
  for (let i = 0; i < METRIC_COUNT; i++) m[METRIC_KEYS[i] as MetricKey] = a[i] as number;
  return m;
}

export function fromMetrics(m: Partial<Metrics>): Float64Array {
  const a = newMetricArray();
  for (let i = 0; i < METRIC_COUNT; i++) a[i] = m[METRIC_KEYS[i] as MetricKey] ?? 0;
  return a;
}

export function isZeroArray(a: Float64Array): boolean {
  for (let i = 0; i < METRIC_COUNT; i++) if (a[i] !== 0) return false;
  return true;
}
