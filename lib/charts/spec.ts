// Custom chart definitions, starters and the canned prompt parser (module 11 2.5, 2.6, K16..K19). Client safe.
export type ChartKind = 'BAR' | 'LINE' | 'PIE' | 'BUBBLE' | 'KPI' | 'BUILT_IN' | 'NOTE';
export type BuiltInChart =
  'TOTAL_COST' | 'AVG_KPI' | 'IMPRESSIONS_LOST' | 'ADDED_REACH' | 'EXPLORE_BUDGET';
export type MetricKey =
  | 'IMPRESSIONS'
  | 'CLICKS'
  | 'REVENUE'
  | 'COST'
  | 'CTR'
  | 'CPM'
  | 'CPC'
  | 'CPA'
  | 'CONVERSIONS'
  | 'VIEWABILITY'
  | 'VTR'
  | 'CPV'
  | 'VIDEO_VIEWS'
  | 'ENGAGEMENTS';
export type ChartDimension =
  'DATE' | 'INSERTION_ORDER' | 'LINE_ITEM' | 'CAMPAIGN' | 'EXCHANGE' | 'DEVICE';
export type ChartScope = 'ADVERTISER' | 'CAMPAIGN' | 'IO' | 'LI';

export interface ChartCardSpec {
  id: string;
  kind: ChartKind;
  title: string;
  ordinal: number;
  builtIn?: BuiltInChart;
  metrics?: { x?: MetricKey; y: MetricKey; size?: MetricKey; extra?: MetricKey[] };
  dimension?: ChartDimension;
  topN?: { by: MetricKey; n: number; entity: 'INSERTION_ORDER' | 'LINE_ITEM' | 'CAMPAIGN' };
  note?: string;
}

export const METRIC_LABEL: Record<MetricKey, string> = {
  IMPRESSIONS: 'Impressions',
  CLICKS: 'Clicks',
  REVENUE: 'Revenue',
  COST: 'Total media cost',
  CTR: 'CTR',
  CPM: 'CPM',
  CPC: 'CPC',
  CPA: 'CPA',
  CONVERSIONS: 'Conversions',
  VIEWABILITY: 'Viewability',
  VTR: 'View rate',
  CPV: 'CPV',
  VIDEO_VIEWS: 'Video views',
  ENGAGEMENTS: 'Engagements',
};

export const BUILT_IN_LABEL: Record<BuiltInChart, string> = {
  TOTAL_COST: 'Total cost',
  AVG_KPI: 'Avg. KPI',
  IMPRESSIONS_LOST: 'Impressions lost',
  ADDED_REACH: 'Added reach',
  EXPLORE_BUDGET: 'Explore budget options',
};

let seq = 0;
export const newCardId = () => `c${Date.now().toString(36)}${(seq++).toString(36)}`;

export interface Starter {
  key: string;
  label: string;
  make: () => Omit<ChartCardSpec, 'id' | 'ordinal'>;
}

export const STARTERS: readonly Starter[] = [
  {
    key: 'daily-revenue',
    label: 'Daily Revenue Trend (Bar chart)',
    make: () => ({
      kind: 'BAR',
      title: 'Daily Revenue Trend',
      metrics: { y: 'REVENUE' },
      dimension: 'DATE',
    }),
  },
  {
    key: 'ctr-trend',
    label: 'CTR Trend (Line chart)',
    make: () => ({ kind: 'LINE', title: 'CTR Trend', metrics: { y: 'CTR' }, dimension: 'DATE' }),
  },
  {
    key: 'revenue-breakdown',
    label: 'Revenue breakdown (Pie chart)',
    make: () => ({
      kind: 'PIE',
      title: 'Revenue breakdown',
      metrics: { y: 'REVENUE' },
      dimension: 'LINE_ITEM',
    }),
  },
  {
    key: 'engagement-revenue',
    label: 'Ad Engagement & Revenue (Bubble chart)',
    make: () => ({
      kind: 'BUBBLE',
      title: 'Ad Engagement & Revenue',
      metrics: { x: 'CLICKS', y: 'CTR', size: 'REVENUE' },
      dimension: 'LINE_ITEM',
    }),
  },
];

export const BUILT_INS: readonly BuiltInChart[] = [
  'TOTAL_COST',
  'AVG_KPI',
  'IMPRESSIONS_LOST',
  'ADDED_REACH',
  'EXPLORE_BUDGET',
];

export const AI_DISCLAIMER = 'Tutor suggestions can be wrong. Check the numbers.';
export const AI_FAILURE =
  "I couldn't build a chart from that. Try naming metrics, for example CTR and revenue by day.";

const METRIC_WORDS: [RegExp, MetricKey][] = [
  [/\bimpr(essions?)?\b/, 'IMPRESSIONS'],
  [/\bclicks?\b/, 'CLICKS'],
  [/\b(revenue|spend|spent)\b/, 'REVENUE'],
  [/\bcost\b/, 'COST'],
  [/\bctrs?\b/, 'CTR'],
  [/\bcpms?\b/, 'CPM'],
  [/\bcpcs?\b/, 'CPC'],
  [/\bcpas?\b/, 'CPA'],
  [/\b(conversions?|convs?)\b/, 'CONVERSIONS'],
  [/\bviewab\w*\b/, 'VIEWABILITY'],
  [/\bviews?\b/, 'VIDEO_VIEWS'],
  [/\bengagements?\b/, 'ENGAGEMENTS'],
];

/** Metrics in the order they appear in the text. */
function metricsIn(text: string): MetricKey[] {
  const found: { at: number; key: MetricKey }[] = [];
  for (const [re, key] of METRIC_WORDS) {
    const m = re.exec(text);
    if (m) found.push({ at: m.index, key });
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.key);
}

const ENTITY_WORDS: [RegExp, 'LINE_ITEM' | 'INSERTION_ORDER' | 'CAMPAIGN'][] = [
  [/\b(line ?items?|lis?)\b/, 'LINE_ITEM'],
  [/\b(insertion orders?|ios?)\b/, 'INSERTION_ORDER'],
  [/\bcampaigns?\b/, 'CAMPAIGN'],
];

const DIMENSION_WORDS: [RegExp, ChartDimension][] = [
  [/\bby (day|date|week)\b|\bdaily\b|\btrend\b|\bover time\b/, 'DATE'],
  [/\bby (line ?item|li)\b/, 'LINE_ITEM'],
  [/\bby (insertion order|io)\b/, 'INSERTION_ORDER'],
  [/\bby campaign\b/, 'CAMPAIGN'],
  [/\bby exchange\b/, 'EXCHANGE'],
  [/\bby device\b/, 'DEVICE'],
];

export type PromptResult =
  { ok: true; spec: Omit<ChartCardSpec, 'id' | 'ordinal'> } | { ok: false; message: string };

/**
 * Deterministic prompt grammar (2.6): kind words, metric synonyms, "top N", "by {dimension}", "vs".
 * "Bubble chart of CPA vs conversions", "Conversions for top 5 LIs by revenue", "Compare CPMs and CTRs".
 */
export function parseChartPrompt(input: string): PromptResult {
  const text = input.toLowerCase().trim();
  const fail: PromptResult = { ok: false, message: AI_FAILURE };
  if (!text) return fail;
  const metrics = metricsIn(text);
  if (metrics.length === 0) return fail;

  const kind: ChartKind | null = /\bbubble\b/.test(text)
    ? 'BUBBLE'
    : /\bpie\b|\bbreakdown\b/.test(text)
      ? 'PIE'
      : /\bline\b|\btrend\b|\bcompare\b|\bover time\b/.test(text)
        ? 'LINE'
        : /\bbar\b|\btop\b|\bdaily\b/.test(text)
          ? 'BAR'
          : null;

  const top = /\btop\s+(\d{1,2})\b/.exec(text);
  const entity = ENTITY_WORDS.find(([re]) => re.test(text))?.[1];
  const byWord = DIMENSION_WORDS.find(([re]) => re.test(text))?.[1];

  if (top) {
    const n = Math.max(1, Math.min(20, Number(top[1])));
    // "Conversions for top 5 LIs by revenue": the metric before "for" is plotted, the one after "by" ranks
    const byRank = /\bby\s+([a-z ]+)$/.exec(text)?.[1];
    const rank = byRank ? (metricsIn(byRank)[0] ?? metrics[0]!) : metrics[0]!;
    const plotted = metrics[0]!;
    return {
      ok: true,
      spec: {
        kind: kind === 'PIE' || kind === 'LINE' ? kind : 'BAR',
        title: `${METRIC_LABEL[plotted]} for top ${n} ${entity === 'INSERTION_ORDER' ? 'insertion orders' : entity === 'CAMPAIGN' ? 'campaigns' : 'line items'}`,
        metrics: { y: plotted },
        dimension: entity ?? 'LINE_ITEM',
        topN: { by: rank, n, entity: entity ?? 'LINE_ITEM' },
      },
    };
  }
  if (kind === 'BUBBLE') {
    const [first, second, third] = metrics;
    // "CPA vs conversions": y is the first named metric, x the second
    const y = first!;
    const x = second ?? 'IMPRESSIONS';
    const size = third ?? (y === 'REVENUE' || x === 'REVENUE' ? 'IMPRESSIONS' : 'REVENUE');
    return {
      ok: true,
      spec: {
        kind,
        title: `${METRIC_LABEL[y]} vs ${METRIC_LABEL[x].toLowerCase()}`,
        metrics: { x, y, size },
        dimension: entity ?? 'LINE_ITEM',
      },
    };
  }
  const dimension = byWord ?? (kind === 'PIE' ? (entity ?? 'LINE_ITEM') : 'DATE');
  const [y, ...rest] = metrics;
  return {
    ok: true,
    spec: {
      kind: kind ?? (dimension === 'DATE' ? 'LINE' : 'BAR'),
      title:
        metrics.map((m) => METRIC_LABEL[m]).join(' and ') + (dimension === 'DATE' ? ' by day' : ''),
      metrics: { y: y!, ...(rest.length ? { extra: rest } : {}) },
      dimension,
    },
  };
}

/** Max 500 characters (K16), 12 cards. */
export function validateCards(
  cards: readonly ChartCardSpec[],
  noteMax = 500,
  cardMax = 12,
): string | null {
  if (cards.length > cardMax) return `You can have up to ${cardMax} charts.`;
  for (const c of cards)
    if (c.kind === 'NOTE' && (c.note ?? '').length > noteMax)
      return `Use ${noteMax} characters or fewer.`;
  return null;
}
