// The report field catalogue (module 16 4.2): FIELDS, FIELD_BY_KEY, CATEGORY_COUNTS, assertCatalogue().
import { PLANNED_COUNTS, SEEN_COUNTS } from './categories';
import { computerSystemFields, dateFields, generalFields, locationFields } from './general';
import { costFields, conversionFields, feeFields, profitFields } from './money';
import {
  customBiddingFields,
  customImpressionValueFields,
  impressionLossFields,
  invalidTrafficFields,
  performanceFields,
  pgSavingsFields,
  refundFields,
  savingsFields,
  winLossFields,
} from './performance';
import {
  overlapFields,
  uniqueHouseholdReachFields,
  uniqueReachAudienceFields,
  uniqueReachFields,
} from './reach';
import {
  activeViewFields,
  audienceFields,
  brandControlFields,
  inStreamAudioFields,
  inStreamVideoFields,
  youtubeFields,
} from './views';
import {
  cm360Fields,
  doohFields,
  inventoryAvailabilityFields,
  richMediaFields,
  tvFields,
} from './misc';
import { ENTITY_PATHS } from './paths';
import {
  CATEGORIES,
  type OfflineType,
  type ReportCategory,
  type ReportFieldDef,
  type SourceSpec,
} from './types';

export * from './types';
export { PLANNED_COUNTS, SEEN_COUNTS } from './categories';
export { ENTITY_PATHS } from './paths';
export { HOUSEHOLD_FACTOR } from './reach';

/** Field keys that the Floodlight offline report can use besides those tagged in the category files. */
const FLOODLIGHT_EXTRA = [
  'partner',
  'advertiser',
  'campaign',
  'insertion_order',
  'line_item',
  'creative',
  'date',
  'total_conversions',
  'post_click_conversions',
  'post_view_conversions',
  'impressions',
  'clicks',
];
const AVAILABILITY_EXTRA = ['date', 'partner', 'advertiser'];

function build(): ReportFieldDef[] {
  const o = overlapFields();
  const all: ReportFieldDef[] = [
    ...generalFields(),
    ...performanceFields(),
    ...locationFields(),
    ...computerSystemFields(),
    ...dateFields(),
    ...costFields(),
    ...feeFields(),
    ...profitFields(),
    ...conversionFields(),
    ...activeViewFields(),
    ...audienceFields(),
    ...brandControlFields(),
    ...winLossFields(),
    ...impressionLossFields(),
    ...invalidTrafficFields(),
    ...customBiddingFields(),
    ...customImpressionValueFields(),
    ...inStreamVideoFields(),
    ...inStreamAudioFields(),
    ...youtubeFields(),
    ...uniqueReachFields(),
    ...uniqueReachAudienceFields(),
    ...uniqueHouseholdReachFields(),
    ...o.overlap,
    ...o.overlapPivoted,
    ...o.frequencyPivoted,
    ...pgSavingsFields(),
    ...savingsFields(),
    ...refundFields(),
    ...doohFields(),
    ...richMediaFields(),
    ...tvFields(),
    ...cm360Fields(),
    ...inventoryAvailabilityFields(),
  ];
  const byKey = new Map(all.map((f) => [f.key, f]));
  for (const k of FLOODLIGHT_EXTRA) {
    const f = byKey.get(k);
    if (f) f.offline = [...new Set<OfflineType>([...(f.offline ?? []), 'FLOODLIGHT'])];
  }
  for (const k of AVAILABILITY_EXTRA) {
    const f = byKey.get(k);
    if (f) f.offline = [...new Set<OfflineType>([...(f.offline ?? []), 'INVENTORY_AVAILABILITY'])];
  }
  // Frequently used (explore 12)
  for (const k of [
    'advertiser',
    'advertiser_currency',
    'clicks',
    'impressions',
    'insertion_order',
    'revenue_adv',
  ]) {
    const f = byKey.get(k);
    if (f) f.frequentlyUsed = true;
  }
  deriveCompat(all, byKey);
  return all;
}

/** Compatibility groups (4.3): derived from the source, so a ratio over a reach metric is a reach metric too. */
function deriveCompat(all: ReportFieldDef[], byKey: Map<string, ReportFieldDef>): void {
  const memo = new Map<string, Set<string>>();
  const groupsOf = (f: ReportFieldDef, seen: Set<string>): Set<string> => {
    const cached = memo.get(f.key);
    if (cached) return cached;
    const out = new Set<string>();
    if (seen.has(f.key)) return out;
    seen.add(f.key);
    const s = f.source;
    if (f.kind === 'METRIC') {
      const refs: string[] = [];
      if (s.t === 'REACH') out.add('REACH');
      else if (s.t === 'RATIO') refs.push(s.num, s.den);
      else if (s.t === 'DIFF' || s.t === 'SUM_OF') refs.push(...s.of);
      else if (s.t === 'SNAPSHOT' && s.scope === 'SEGMENT') out.add('SEGMENT');
      for (const r of refs) {
        const rf = byKey.get(r);
        if (rf) for (const g of groupsOf(rf, seen)) out.add(g);
      }
      if (f.category === 'Unique Reach Audience') out.add('REACH_AUDIENCE');
      if (f.category === 'Conversions' && f.status === 'LIVE') out.add('CONVERSION');
    } else {
      if (s.t === 'SLICE' && s.kind === 'hour') out.add('HOURLY');
      if (s.t === 'SLICE' && s.kind === 'activity') out.add('ACTIVITY');
      if (s.t === 'SLICE' && (s.kind === 'adGroup' || s.kind === 'ad')) out.add('YOUTUBE_DIM');
      if (s.t === 'DERIVED' && s.parent === 'activity') out.add('ACTIVITY');
      if (s.t === 'ENTITY' && s.path.startsWith('segment.')) out.add('SEGMENT');
    }
    memo.set(f.key, out);
    return out;
  };
  for (const f of all) {
    const g = [...groupsOf(f, new Set())].sort();
    if (g.length) f.compat = g;
  }
}

export const FIELDS: readonly ReportFieldDef[] = Object.freeze(build());
export const FIELD_BY_KEY: ReadonlyMap<string, ReportFieldDef> = new Map(
  FIELDS.map((f) => [f.key, f]),
);

export const CATEGORY_COUNTS: Readonly<Record<ReportCategory, number>> = (() => {
  const out = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<ReportCategory, number>;
  for (const f of FIELDS) out[f.category] += 1;
  return out;
})();

export function fieldsOf(category: ReportCategory): ReportFieldDef[] {
  return FIELDS.filter((f) => f.category === category);
}

export function sourceRefs(f: ReportFieldDef): string[] {
  if (f.kind !== 'METRIC') return [];
  const s = f.source as SourceSpec;
  if (s.t === 'RATIO') return [s.num, s.den];
  if (s.t === 'DIFF' || s.t === 'SUM_OF') return s.of;
  return [];
}

/**
 * Throws a list of problems when the catalogue is not coherent. Used by the catalogue test and by the seed before it
 * writes `ReportField` rows.
 */
export function assertCatalogue(): void {
  const problems: string[] = [];
  const keys = new Set<string>();
  for (const f of FIELDS) {
    if (keys.has(f.key)) problems.push(`duplicate key ${f.key}`);
    keys.add(f.key);
  }
  for (const f of FIELDS) {
    for (const r of sourceRefs(f))
      if (!keys.has(r)) problems.push(`${f.key}: unknown reference ${r}`);
    if (f.source.t === 'ENTITY' && !(ENTITY_PATHS as readonly string[]).includes(f.source.path))
      problems.push(`${f.key}: unknown entity path ${f.source.path}`);
  }
  for (const c of CATEGORIES) {
    if (CATEGORY_COUNTS[c] !== PLANNED_COUNTS[c])
      problems.push(`${c}: ${CATEGORY_COUNTS[c]} fields, planned ${PLANNED_COUNTS[c]}`);
  }
  for (const [c, n] of Object.entries(SEEN_COUNTS)) {
    if (CATEGORY_COUNTS[c as ReportCategory] < (n))
      problems.push(`${c}: fewer than the ${n} seen in the demo`);
  }
  if (problems.length) throw new Error(`Report catalogue problems:\n${problems.join('\n')}`);
}
