// Brand controls coverage (module 15 4.4, RC-037): pure computation over line item facts. No database, so the
// rows and the breakdown are testable with fixtures.
import type { BrandBreakdownRow, BrandCoverageRow, BrandRowKey } from './wire';

export interface TargetFact {
  dimension: string;
  mode: 'INCLUDE' | 'EXCLUDE';
  refType?: string | null;
}

export interface BrandLineItem {
  id: string;
  name: string;
  status: string;
  type: string;
  inventoryQuality: string;
  /** Rows owned by the line item. */
  targets: TargetFact[];
}

export interface BrandInputs {
  lineItems: BrandLineItem[];
  /** Locked rows of the advertiser and the partner (they apply to every line item). */
  advertiserRows: TargetFact[];
  partnerRows: TargetFact[];
}

export const YOUTUBE_TYPES: readonly string[] = ['YT_VIDEO', 'YT_AUDIO', 'YT_ON_CTV', 'DEMAND_GEN'];

export const ROW_ORDER: readonly BrandRowKey[] = [
  'CONTENT_LABEL',
  'APPS_URLS_CHANNELS',
  'KEYWORDS',
  'AUTHORIZED_SELLERS',
  'VERIFICATION',
];

export const ROW_TITLE: Record<BrandRowKey, string> = {
  CONTENT_LABEL: 'Digital content label exclusions',
  APPS_URLS_CHANNELS: 'Apps, URL, and channel exclusions',
  KEYWORDS: 'Keyword exclusions',
  AUTHORIZED_SELLERS: 'Authorized sellers',
  VERIFICATION: 'Verification services',
};

type Source = BrandBreakdownRow['source'];

const matchers: Record<Exclude<BrandRowKey, 'AUTHORIZED_SELLERS'>, (t: TargetFact) => boolean> = {
  CONTENT_LABEL: (t) => t.dimension === 'DIGITAL_CONTENT_LABEL' && t.mode === 'EXCLUDE',
  APPS_URLS_CHANNELS: (t) =>
    (t.dimension === 'APPS_AND_URLS' || t.dimension === 'CHANNEL') && t.mode === 'EXCLUDE',
  KEYWORDS: (t) =>
    t.dimension === 'NEGATIVE_KEYWORD_LIST' ||
    t.refType === 'KEYWORD_LIST' ||
    (t.dimension === 'KEYWORD' && t.mode === 'EXCLUDE'),
  VERIFICATION: (t) => t.dimension === 'THIRD_PARTY_VERIFIER',
};

/** Where a line item gets the setting from: its own row first, then the advertiser, then the partner. */
export function sourceOf(
  key: BrandRowKey,
  li: BrandLineItem,
  advertiserRows: TargetFact[],
  partnerRows: TargetFact[],
): Source {
  if (key === 'AUTHORIZED_SELLERS') {
    return li.inventoryQuality === 'AUTHORIZED_DIRECT_SELLERS' ||
      li.inventoryQuality === 'AUTHORIZED_DIRECT_SELLERS_AND_RESELLERS'
      ? 'Line item'
      : '-';
  }
  const m = matchers[key];
  if (li.targets.some(m)) return 'Line item';
  if (advertiserRows.some(m)) return 'Advertiser';
  if (partnerRows.some(m)) return 'Partner';
  return '-';
}

export function tabOf(type: string): 'display' | 'youtube' {
  return YOUTUBE_TYPES.includes(type) ? 'youtube' : 'display';
}

/** Line items of the tab, not archived and not draft (4.4). `filter: active` keeps only serving statuses. */
export function eligibleLineItems(
  lineItems: readonly BrandLineItem[],
  tab: 'display' | 'youtube',
  filter: 'active' | 'all',
): BrandLineItem[] {
  return lineItems.filter(
    (li) =>
      tabOf(li.type) === tab &&
      li.status !== 'ARCHIVED' &&
      li.status !== 'DRAFT' &&
      li.status !== 'SCHEDULED_FOR_DELETION' &&
      (filter === 'all' || li.status === 'ACTIVE'),
  );
}

function restrictionsText(rows: TargetFact[], key: BrandRowKey, who: string): string {
  if (key === 'AUTHORIZED_SELLERS') return '';
  return `${who} restrictions: ${rows.some(matchers[key]) ? 'enabled' : 'none'}`;
}

export interface BrandComputation {
  rows: BrandCoverageRow[];
  breakdown: Record<BrandRowKey, BrandBreakdownRow[]>;
  total: number;
}

/**
 * Five rows at advertiser level, four at partner level (`level: 'partner'` drops Authorized sellers, RC-037).
 * `pct` is a whole number; an empty tab is 0 % with "No line items yet".
 */
export function computeBrandControls(
  inputs: BrandInputs,
  tab: 'display' | 'youtube',
  filter: 'active' | 'all',
  level: 'advertiser' | 'partner' = 'advertiser',
): BrandComputation {
  const lis = eligibleLineItems(inputs.lineItems, tab, filter);
  const keys = ROW_ORDER.filter((k) => level === 'advertiser' || k !== 'AUTHORIZED_SELLERS');
  const breakdown = {} as Record<BrandRowKey, BrandBreakdownRow[]>;
  const rows: BrandCoverageRow[] = keys.map((key) => {
    const list = lis.map((li): BrandBreakdownRow => {
      const source = sourceOf(key, li, inputs.advertiserRows, inputs.partnerRows);
      return {
        lineItemId: li.id,
        name: li.name,
        status: li.status,
        enabled: source !== '-',
        source,
      };
    });
    breakdown[key] = list;
    const enabled = list.filter((r) => r.enabled).length;
    const total = list.length;
    const summary =
      total === 0
        ? 'No line items yet'
        : key === 'AUTHORIZED_SELLERS'
          ? `${total - enabled} line items include non-participating publishers`
          : level === 'partner'
            ? restrictionsText(inputs.partnerRows, key, 'Partner')
            : `${restrictionsText(inputs.partnerRows, key, 'Partner')} · ${restrictionsText(inputs.advertiserRows, key, 'Advertiser')}`;
    return {
      key,
      title: ROW_TITLE[key],
      enabled,
      total,
      pct: total === 0 ? 0 : Math.round((enabled / total) * 100),
      label: `${enabled}/${total} Line items`,
      summary,
    };
  });
  return { rows, breakdown, total: lis.length };
}

/** IVT card (4.4): blocked / (blocked + impressions) per day; no rows or zero blocked gives an empty series. */
export function ivtSeries(
  days: { date: string; blocked: number; impressions: number }[],
): { date: string; blockedPct: number }[] {
  const out = days
    .map((d) => ({
      date: d.date,
      blockedPct:
        d.blocked + d.impressions === 0 ? 0 : (d.blocked / (d.blocked + d.impressions)) * 100,
      blocked: d.blocked,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!out.some((d) => d.blocked > 0)) return [];
  return out.map(({ date, blockedPct }) => ({
    date,
    blockedPct: Math.round(blockedPct * 100) / 100,
  }));
}
