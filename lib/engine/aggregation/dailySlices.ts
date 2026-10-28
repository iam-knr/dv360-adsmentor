// Daily slices (engine.md 9.3). A slice breaks the same additive metrics down by one dimension;
// every slice kind sums to the `total` row. Released conversions are attributed to the tick's
// delivery mix, because the ad event of a lagged conversion is no longer in the tick.
// Accumulation uses flat arrays (one slot per metric) because a tick touches thousands of cells.

import { largestRemainder } from '../math';
import {
  addArray,
  isZeroArray,
  METRIC_COUNT,
  METRIC_INDEX,
  newMetricArray,
  roundConv,
  toMetrics,
  type Metrics,
} from '../metrics';
import type { CreativeChoice, ElCell } from '../auction';

export const SLICE_KINDS = [
  'total',
  'exchange',
  'device',
  'environment',
  'region',
  'format',
  'hourOfDay',
  'creative',
  'activity',
  'exchangeDevice',
  'regionDevice',
] as const;
export type SliceKind = (typeof SLICE_KINDS)[number];

export interface SliceRow {
  sliceKind: string;
  sliceKey: string;
  metrics: Metrics;
}

export interface CellRow {
  elc: ElCell;
  metrics: Float64Array;
}

/** Conversion columns as integer micro-units (count * 1e6); convRevenue is money micros. */
export type ConvMicros = Partial<
  Pick<
    Metrics,
    | 'convPostClick'
    | 'convPostView'
    | 'convTotal'
    | 'convTransactions'
    | 'convItems'
    | 'convRevenue'
  >
>;

const CONV_SCALED = [
  'convPostClick',
  'convPostView',
  'convTotal',
  'convTransactions',
  'convItems',
] as const;
const CONV_ALL = [...CONV_SCALED, 'convRevenue'] as const;
const IMPRESSIONS = METRIC_INDEX.impressions;

/** Split an array of metrics across keys proportionally to `weights`, slot by slot, with exact integers. */
function splitArray(m: Float64Array, weights: readonly number[]): Float64Array[] {
  const out = weights.map(() => newMetricArray());
  for (let i = 0; i < METRIC_COUNT; i++) {
    const v = m[i] as number;
    if (v === 0) continue;
    const parts = largestRemainder(Math.abs(v), weights);
    const sign = v < 0 ? -1 : 1;
    for (let k = 0; k < parts.length; k++)
      (out[k] as Float64Array)[i] = sign * (parts[k] as number);
  }
  return out;
}

function convArray(c: ConvMicros): Float64Array {
  const a = newMetricArray();
  for (const k of CONV_SCALED) a[METRIC_INDEX[k]] = (c[k] ?? 0) / 1e6;
  a[METRIC_INDEX.convRevenue] = c.convRevenue ?? 0;
  return a;
}

function splitConv(c: ConvMicros, weights: readonly number[]): ConvMicros[] {
  const out: ConvMicros[] = weights.map(() => ({}));
  for (const k of CONV_ALL) {
    const v = c[k];
    if (!v) continue;
    largestRemainder(Math.abs(v), weights).forEach((p, i) => {
      (out[i] as ConvMicros)[k] = (v < 0 ? -1 : 1) * p;
    });
  }
  return out;
}

export function buildSlices(
  rows: readonly CellRow[],
  hourKey: string,
  kinds: readonly string[],
  conv: { total: ConvMicros; byActivity: Map<string, ConvMicros> },
): { total: Metrics; slices: SliceRow[] } {
  const want = new Set(kinds);
  const acc = new Map<string, { kind: string; key: string; m: Float64Array }>();
  const winsBy = new Map<string, Map<string, number>>();
  const slot = (kind: string, key: string): Float64Array => {
    const k = `${kind}\u0000${key}`;
    let row = acc.get(k);
    if (!row) {
      row = { kind, key, m: newMetricArray() };
      acc.set(k, row);
    }
    return row.m;
  };
  const bump = (kind: string, key: string, m: Float64Array) => {
    addArray(slot(kind, key), m);
    let w = winsBy.get(kind);
    if (!w) {
      w = new Map();
      winsBy.set(kind, w);
    }
    w.set(key, (w.get(key) ?? 0) + (m[IMPRESSIONS] as number));
  };

  const total = newMetricArray();
  const byMask = new Map<readonly CreativeChoice[], Float64Array>();
  const wantEx = want.has('exchange');
  const wantDev = want.has('device');
  const wantEnv = want.has('environment');
  const wantReg = want.has('region');
  const wantFmt = want.has('format');
  const wantExDev = want.has('exchangeDevice');
  const wantRegDev = want.has('regionDevice');
  const wantCre = want.has('creative');
  for (const { elc, metrics: m } of rows) {
    addArray(total, m);
    const c = elc.cell;
    if (wantEx) bump('exchange', c.exchangeId, m);
    if (wantDev) bump('device', c.device, m);
    if (wantEnv) bump('environment', c.environment, m);
    if (wantReg) bump('region', c.region, m);
    if (wantFmt) bump('format', c.format, m);
    if (wantExDev) bump('exchangeDevice', `${c.exchangeId}|${c.device}`, m);
    if (wantRegDev) bump('regionDevice', `${c.region}|${c.device}`, m);
    if (wantCre) {
      let g = byMask.get(elc.choices);
      if (!g) {
        g = newMetricArray();
        byMask.set(elc.choices, g);
      }
      addArray(g, m);
    }
  }
  if (want.has('hourOfDay')) bump('hourOfDay', hourKey, total);
  if (wantCre) {
    for (const [choices, g] of byMask) {
      if (choices.length === 0) {
        bump('creative', '(none)', g);
        continue;
      }
      const parts = splitArray(
        g,
        choices.map((ch) => ch.share),
      );
      choices.forEach((ch, i) => bump('creative', ch.creative.id, parts[i] as Float64Array));
    }
  }

  // released conversions
  const hasConv = CONV_ALL.some((k) => (conv.total[k] ?? 0) !== 0);
  if (hasConv) {
    addArray(total, convArray(conv.total));
    for (const [kind, wins] of [...winsBy.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      if (kind === 'hourOfDay') {
        addArray(slot(kind, hourKey), convArray(conv.total));
        continue;
      }
      const keys = [...wins.keys()].sort();
      const weights = keys.map((k) => wins.get(k) as number);
      if (weights.reduce((a, b) => a + b, 0) <= 0) {
        addArray(slot(kind, 'unattributed'), convArray(conv.total));
        continue;
      }
      const parts = splitConv(conv.total, weights);
      keys.forEach((k, i) => addArray(slot(kind, k), convArray(parts[i] as ConvMicros)));
    }
    if (want.has('hourOfDay') && !winsBy.has('hourOfDay'))
      addArray(slot('hourOfDay', hourKey), convArray(conv.total));
  }
  if (want.has('activity')) {
    for (const [id, c] of [...conv.byActivity.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      addArray(slot('activity', id), convArray(c));
    }
  }

  const slices: SliceRow[] = [];
  for (const r of [...acc.values()].sort((a, b) => (a.kind + a.key < b.kind + b.key ? -1 : 1))) {
    if (isZeroArray(r.m)) continue;
    slices.push({ sliceKind: r.kind, sliceKey: r.key, metrics: roundedConv(toMetrics(r.m)) });
  }
  return { total: roundedConv(toMetrics(total)), slices };
}

function roundedConv(m: Metrics): Metrics {
  for (const k of CONV_SCALED) m[k] = roundConv(m[k]);
  return m;
}
