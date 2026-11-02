// The seven suggested templates (module 16 4.7). Names keep the DV360 template titles.
import type { ReportDefinition } from './types';

export interface TemplateDef {
  family: 'BASIC' | 'REACH' | 'VIDEO';
  key: string;
  title: string;
  description: string;
  definition: Pick<ReportDefinition, 'dimensions' | 'metrics' | 'dateRange'>;
}

export const TEMPLATES: readonly TemplateDef[] = [
  {
    family: 'BASIC',
    key: 'advertiser-overview',
    title: 'Advertiser Overview',
    description: 'Key performance metrics by advertiser',
    definition: {
      dimensions: ['advertiser'],
      metrics: [
        'impressions',
        'clicks',
        'click_rate_ctr',
        'total_conversions',
        'revenue_adv',
        'media_cost_ecpm_adv',
      ],
      dateRange: 'LAST_7_DAYS',
    },
  },
  {
    family: 'BASIC',
    key: 'io-pacing',
    title: 'Insertion Order Pacing',
    description: 'Budget pacing by insertion order',
    definition: {
      dimensions: [
        'insertion_order',
        'budget_segment_name',
        'budget_segment_start_date',
        'budget_segment_end_date',
      ],
      metrics: ['budget_segment_budget', 'revenue_adv', 'budget_segment_pacing_percentage'],
      dateRange: 'MONTH_TO_DATE',
    },
  },
  {
    family: 'BASIC',
    key: 'app-url-viewability',
    title: 'App/URL Viewability',
    description: 'Active View viewability performance by App or URL',
    definition: {
      dimensions: ['app_url'],
      metrics: [
        'impressions',
        'measurable_impressions',
        'viewable_impressions',
        'pct_viewable_impressions',
      ],
      dateRange: 'LAST_7_DAYS',
    },
  },
  {
    family: 'REACH',
    key: 'unique-reach',
    title: 'Unique Reach',
    description: 'Unique Reach performance by advertiser and line item',
    definition: {
      dimensions: ['advertiser', 'line_item'],
      metrics: ['impression_reach', 'average_impression_frequency'],
      dateRange: 'LAST_30_DAYS',
    },
  },
  {
    family: 'REACH',
    key: 'unique-reach-cost',
    title: 'Unique Reach and Cost',
    description: 'Unique Reach and cost performance by insertion order',
    definition: {
      dimensions: ['insertion_order'],
      metrics: [
        'impression_reach',
        'average_impression_frequency',
        'cost_per_unique_impression_reach_adv',
      ],
      dateRange: 'LAST_30_DAYS',
    },
  },
  {
    family: 'REACH',
    key: 'unique-household-reach',
    title: 'Unique Household Reach',
    description: 'Unique Household Reach by advertiser and line item',
    definition: {
      dimensions: ['advertiser', 'line_item'],
      metrics: ['unique_household_reach_impression', 'average_household_frequency'],
      dateRange: 'LAST_30_DAYS',
    },
  },
  {
    family: 'VIDEO',
    key: 'video-performance',
    title: 'Video Performance',
    description: 'Key video metrics by creative',
    definition: {
      dimensions: ['creative'],
      metrics: [
        'impressions',
        'video_starts',
        'video_completions',
        'video_completion_rate',
        'skips_video',
        'media_cost_ecpm_adv',
      ],
      dateRange: 'LAST_7_DAYS',
    },
  },
];

export const TEMPLATE_BY_KEY: ReadonlyMap<string, TemplateDef> = new Map(
  TEMPLATES.map((t) => [t.key, t]),
);

/** A new unsaved instant definition for a template (`?template=`). */
export function definitionFromTemplate(
  key: string,
  partnerPublicId: string,
): ReportDefinition | null {
  const t = TEMPLATE_BY_KEY.get(key);
  if (!t) return null;
  return {
    kind: 'INSTANT',
    name: t.title,
    timeZone: 'ADVERTISER',
    dateRange: t.definition.dateRange,
    filters: [{ field: 'partner', op: 'IN', values: [partnerPublicId] }],
    dimensions: [...t.definition.dimensions],
    metrics: [...t.definition.metrics],
    viz: { type: 'TABLE' },
    template: t.key,
  };
}

export interface OfflineTemplate {
  key: string;
  type: 'FLOODLIGHT' | 'INVENTORY_AVAILABILITY';
  title: string;
  dimensions: string[];
  metrics: string[];
  dateRange: string;
}

/** Offline report templates (module 16 S4 card 2): commonly prefilled settings. */
export const OFFLINE_TEMPLATES: readonly OfflineTemplate[] = [
  {
    key: 'floodlight-impressions',
    type: 'FLOODLIGHT',
    title: 'Floodlight Impressions',
    dimensions: ['date', 'advertiser'],
    metrics: ['floodlight_impressions'],
    dateRange: 'LAST_7_DAYS',
  },
  {
    key: 'floodlight-order-id',
    type: 'FLOODLIGHT',
    title: 'Order ID',
    dimensions: ['date', 'order_id', 'floodlight_activity'],
    metrics: ['total_conversions', 'post_click_conversions', 'post_view_conversions'],
    dateRange: 'LAST_7_DAYS',
  },
  {
    key: 'availability-exchange',
    type: 'INVENTORY_AVAILABILITY',
    title: 'Availability by exchange',
    dimensions: ['date', 'availability_exchange'],
    metrics: ['available_impressions', 'bid_able_impressions'],
    dateRange: 'LAST_7_DAYS',
  },
  {
    key: 'availability-device',
    type: 'INVENTORY_AVAILABILITY',
    title: 'Availability by device',
    dimensions: ['date', 'availability_device_type'],
    metrics: ['available_impressions', 'bid_able_impressions'],
    dateRange: 'LAST_7_DAYS',
  },
];
