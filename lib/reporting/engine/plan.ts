// Planner (module 16 4.3 steps 1 and 2): from a ReportDefinition to the stored slices that must be read, whether the
// result is an approximation, and which SimDailyMetric columns are needed.
import {
  FIELD_BY_KEY,
  type DimSource,
  type ReportFieldDef,
  type SliceKind,
  type SourceSpec,
} from '../catalogue';
import type { ReportDefinition } from '../types';

/** Slice kinds the engine stores (SimDailyMetric.sliceKind) besides `total`. */
export type StoredKind =
  | 'exchange'
  | 'device'
  | 'environment'
  | 'region'
  | 'format'
  | 'creative'
  | 'activity'
  | 'audience'
  | 'deal'
  | 'adGroup'
  | 'ad'
  | 'creativeSize';

export const STORED_KINDS: ReadonlySet<string> = new Set<StoredKind>([
  'exchange',
  'device',
  'environment',
  'region',
  'format',
  'creative',
  'activity',
  'audience',
  'deal',
  'adGroup',
  'ad',
  'creativeSize',
]);

export interface DimPlan {
  field: ReportFieldDef;
  /** The slice kind the value comes from (SLICE or DERIVED parent), or null for entity and calendar dimensions. */
  kind: StoredKind | null;
}

export interface ReportPlan {
  dims: DimPlan[];
  /** Slice kinds the dimensions and slice filters need, in first-use order. */
  kinds: StoredKind[];
  /** A stored pair slice that covers two of the kinds. */
  pair: 'exchangeDevice' | 'regionDevice' | null;
  approximated: boolean;
  hourly: boolean;
  reach: boolean;
  segment: boolean;
  /** SimDailyMetric columns to read. */
  columns: string[];
  /** Money columns among `columns`, and the currencies each one is needed in. */
  moneyColumns: Map<string, Set<'ADV' | 'PARTNER' | 'USD'>>;
  /** Pacing snapshot columns (last value wins). */
  snapshotColumns: string[];
}

export const MONEY_COLUMNS: ReadonlySet<string> = new Set([
  'convRevenue',
  'cartRevenue',
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
  'dealSavings',
  'customImpressionValue',
  'customImpressionCost',
]);

const SNAPSHOT_COLS = ['liPacingPct', 'ioPacingPct', 'dailyTarget', 'budgetSegmentBudget'];

/** Columns (and currencies) a metric needs, following RATIO / SUM_OF / DIFF references. */
export function metricNeeds(
  key: string,
  out: {
    cols: Set<string>;
    money: Map<string, Set<'ADV' | 'PARTNER' | 'USD'>>;
    snap: Set<string>;
    reach: boolean;
    segment: boolean;
  },
  seen = new Set<string>(),
): void {
  if (seen.has(key)) return;
  seen.add(key);
  const f = FIELD_BY_KEY.get(key);
  if (!f || f.kind !== 'METRIC') return;
  const s = f.source as SourceSpec;
  switch (s.t) {
    case 'COUNTER':
      if (SNAPSHOT_COLS.includes(s.col)) out.snap.add(s.col);
      else out.cols.add(s.col);
      break;
    case 'COUNTER_FX': {
      out.cols.add(s.col);
      const set = out.money.get(s.col) ?? new Set();
      set.add(s.currency);
      out.money.set(s.col, set);
      break;
    }
    case 'RATIO':
      metricNeeds(s.num, out, seen);
      metricNeeds(s.den, out, seen);
      break;
    case 'DIFF':
    case 'SUM_OF':
      for (const r of s.of) metricNeeds(r, out, seen);
      break;
    case 'SNAPSHOT':
      if (s.scope === 'SEGMENT') out.segment = true;
      else
        out.snap.add(
          s.col === 'pacingPct' ? (s.scope === 'LI' ? 'liPacingPct' : 'ioPacingPct') : s.col,
        );
      break;
    case 'REACH':
      out.reach = true;
      out.cols.add('impressions');
      if (s.col === 'clickReach') out.cols.add('clicks');
      if (s.col === 'viewableReach') out.cols.add('viewableImpressions');
      if (s.col === 'coViewedReach') out.cols.add('coViewedImpressions');
      break;
    case 'CONST':
      break;
  }
}

function kindOf(src: SourceSpec | DimSource): StoredKind | null {
  if (src.t === 'SLICE') {
    const k: SliceKind = src.kind;
    return STORED_KINDS.has(k) ? (k as StoredKind) : null;
  }
  if (src.t === 'DERIVED') return STORED_KINDS.has(src.parent) ? (src.parent as StoredKind) : null;
  return null;
}

export function plan(
  def: Pick<ReportDefinition, 'dimensions' | 'metrics' | 'filters'>,
  filterKinds: StoredKind[] = [],
): ReportPlan {
  const dims: DimPlan[] = def.dimensions.map((k) => {
    const field = FIELD_BY_KEY.get(k);
    if (!field) throw new Error(`Unknown field ${k}`);
    return { field, kind: kindOf(field.source) };
  });
  const kinds: StoredKind[] = [];
  for (const d of dims) if (d.kind && !kinds.includes(d.kind)) kinds.push(d.kind);
  for (const k of filterKinds) if (!kinds.includes(k)) kinds.push(k);

  let pair: ReportPlan['pair'] = null;
  if (kinds.length === 2) {
    const s = new Set(kinds);
    if (s.has('exchange') && s.has('device')) pair = 'exchangeDevice';
    else if (s.has('region') && s.has('device')) pair = 'regionDevice';
  }
  // Several derived dimensions with different allocations multiply their shares; a second stored kind that is not
  // covered by a pair slice is allocated by independence. Both are approximations (footer "Approximated pivot").
  const approximated = kinds.length > 2 || (kinds.length === 2 && pair === null);

  const needs = {
    cols: new Set<string>(),
    money: new Map<string, Set<'ADV' | 'PARTNER' | 'USD'>>(),
    snap: new Set<string>(),
    reach: false,
    segment: false,
  };
  for (const m of def.metrics) metricNeeds(m, needs);
  // dimensions that read the pacing snapshot need nothing extra; the line item pacing column is a dimension of its own
  const hourly = dims.some((d) => d.field.compat?.includes('HOURLY'));
  return {
    dims,
    kinds,
    pair,
    approximated,
    hourly,
    reach: needs.reach,
    segment:
      needs.segment ||
      dims.some((d) => d.field.source.t === 'ENTITY' && d.field.source.path.startsWith('segment.')),
    columns: [...needs.cols].sort(),
    moneyColumns: needs.money,
    snapshotColumns: [...needs.snap].sort(),
  };
}
