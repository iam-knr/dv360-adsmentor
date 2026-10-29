// "Generate report" (module 16 4.8) `[SIM]`: a fixed phrase matcher behind the signature a model call can replace later.
import type { ReportDefinition, VizType } from './types';

export interface GenerateResult {
  definition: ReportDefinition;
  explanation: string;
  matched: string[];
  ignored: string[];
}

const DIMENSION_PHRASES: [RegExp, string, string][] = [
  [/\bby (device|device type)\b/, 'device_type', 'Device Type'],
  [/\bby (creative|creatives)\b/, 'creative', 'Creative'],
  [/\bby exchange\b/, 'exchange', 'Exchange'],
  [/\bby (region|state)\b/, 'region', 'Region'],
  [/\bby (day|date|daily)\b/, 'date', 'Date'],
  [/\bby (line item|line items)\b/, 'line_item', 'Line Item'],
  [/\bby (insertion order|io)\b/, 'insertion_order', 'Insertion Order'],
  [/\bby campaign\b/, 'campaign', 'Campaign'],
  [/\bby advertiser\b/, 'advertiser', 'Advertiser'],
  [/\bby (environment)\b/, 'environment', 'Environment'],
  [/\bby country\b/, 'country', 'Country'],
  [/\bby (creative size|size)\b/, 'creative_size', 'Creative Size'],
];

const METRIC_PHRASES: [RegExp, string[], string][] = [
  [/\bimpressions?\b/, ['impressions'], 'Impressions'],
  [/\bclicks?\b/, ['clicks'], 'Clicks'],
  [/\b(ctr|click rate)\b/, ['click_rate_ctr'], 'Click Rate (CTR)'],
  [/\bconversions?\b/, ['total_conversions'], 'Total Conversions'],
  [/\b(spend|revenue|cost)\b/, ['revenue_adv'], 'Revenue (Advertiser Currency)'],
  [/\bcpm\b/, ['media_cost_ecpm_adv'], 'Media Cost eCPM (Advertiser Currency)'],
  [/\bviewab/, ['viewable_impressions', 'pct_viewable_impressions'], 'Viewability'],
  [/\bpacing\b/, ['budget_segment_budget', 'revenue_adv', 'budget_segment_pacing_percentage'], 'Pacing'],
  [/\b(reach|frequency)\b/, ['impression_reach', 'average_impression_frequency'], 'Unique reach'],
  [/\bvideo\b/, ['video_starts', 'video_completions', 'video_completion_rate'], 'Video'],
];

const STOP = new Set([
  'a', 'an', 'the', 'and', 'by', 'for', 'of', 'in', 'last', 'days', 'day', 'show', 'me', 'report',
  'give', 'my', 'with', 'on', 'to', 'please', 'get', 'make', 'total', 'this', 'month', 'yesterday',
  'week', 'daily', 'date', 'device', 'type', 'creative', 'creatives', 'exchange', 'region', 'state',
  'line', 'item', 'items', 'insertion', 'order', 'io', 'campaign', 'advertiser', 'environment',
  'country', 'size', 'rate', 'click', 'cost', 'spend', 'revenue', 'cpm', 'pacing', 'frequency',
  'reach', 'video', 'chart', 'line', 'time', 'series', 'column', 'pie', 'table',
]);

function rangeFrom(p: string): { range: string; label: string } | null {
  const n = /\blast (\d{1,3}) days?\b/.exec(p);
  if (n) return { range: `${Number(n[1])}D_YESTERDAY`, label: `Last ${Number(n[1])} days` };
  if (/\byesterday\b/.test(p)) return { range: 'YESTERDAY', label: 'Yesterday' };
  if (/\blast month\b/.test(p)) return { range: 'LAST_MONTH', label: 'Last month' };
  if (/\bthis month\b|\bmonth to date\b/.test(p)) return { range: 'MONTH_TO_DATE', label: 'Month to date' };
  if (/\blast week\b/.test(p)) return { range: 'LAST_WEEK', label: 'Last week' };
  if (/\btoday\b/.test(p)) return { range: 'TODAY', label: 'Today' };
  return null;
}

export function generateReport(prompt: string, partnerPublicId: string): GenerateResult {
  const p = prompt.toLowerCase();
  const matched: string[] = [];
  const dimensions: string[] = [];
  const metrics: string[] = [];
  for (const [re, key, label] of DIMENSION_PHRASES) {
    if (re.test(p) && !dimensions.includes(key)) {
      dimensions.push(key);
      matched.push(label);
    }
  }
  for (const [re, keys, label] of METRIC_PHRASES) {
    if (re.test(p)) {
      for (const k of keys) if (!metrics.includes(k)) metrics.push(k);
      matched.push(label);
    }
  }
  if (metrics.length === 0) {
    metrics.push('impressions', 'clicks');
    matched.push('Impressions', 'Clicks (default)');
  }
  const range = rangeFrom(p);
  if (range) matched.push(range.label);
  let viz: VizType = 'TABLE';
  if (/\btime series\b|\bover time\b|\btrend\b/.test(p)) {
    viz = 'TIME_SERIES';
    if (!dimensions.includes('date')) dimensions.unshift('date');
  } else if (/\bpie\b/.test(p)) viz = 'PIE';
  else if (/\bcolumn\b|\bbar\b/.test(p)) viz = 'COLUMN';
  else if (/\bscatter\b/.test(p)) viz = 'SCATTER';
  const ignored = [
    ...new Set(
      p
        .replace(/[^a-z0-9% ]+/g, ' ')
        .split(/\s+/)
        .filter((w) => w && !STOP.has(w) && !/^\d+$/.test(w))
        .filter((w) => !METRIC_PHRASES.some(([re]) => re.test(w))),
    ),
  ];
  const definition: ReportDefinition = {
    kind: 'INSTANT',
    name: 'Generated report',
    timeZone: 'ADVERTISER',
    dateRange: range?.range ?? 'LAST_7_DAYS',
    filters: [{ field: 'partner', op: 'IN', values: [partnerPublicId] }],
    dimensions,
    metrics,
    viz: { type: viz },
  };
  const explanation = `${dimensions.length ? 'Grouped by ' + dimensions.join(', ') : 'Totals'} with ${metrics.join(', ')} for ${range?.label ?? 'the last 7 days'}.`;
  return { definition, explanation, matched, ignored };
}
