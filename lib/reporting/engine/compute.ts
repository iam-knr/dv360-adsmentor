// The pure part of the query engine: from loaded rows to the result table (module 16 4.3 steps 2 to 7).
// Same definition, range and data give identical rows (determinism, 4.3 step 7).
import { largestRemainder } from '@/lib/engine/math';
import { FIELD_BY_KEY, type ReportFieldDef, type SourceSpec } from '../catalogue';
import type {
  Cell,
  QueryColumn,
  QueryResult,
  ReportDefinition,
  ReportFilter,
  Warning,
} from '../types';
import { allocationTable, baseAllocation } from './allocations';
import { dimValue, segmentAt, type CellCtx } from './dimvalues';
import { MONEY_COLUMNS, type ReportPlan, type StoredKind } from './plan';
import { defaultPool, unionReach } from './reach';
import { targetCurrency, type LineItemInfo, type SegmentInfo, type World } from './world';

export type Values = Record<string, number>;
export interface RawSlice {
  sliceKey: string;
  v: Values;
}
/** `${lineItemId}|${YYYY-MM-DD}` to the rows of one slice kind for that line item and day. */
export type KindRows = Map<string, RawSlice[]>;

export interface HourlyRow {
  lineItemId: string;
  /** Epoch ms of the hour start (UTC). */
  hourStartMs: number;
  v: Values;
}

export interface ComputeInput {
  def: ReportDefinition;
  plan: ReportPlan;
  world: World;
  range: { from: string; to: string };
  /** Sim today in the partner time zone. */
  today: string;
  /** Daily rows by sliceKind: 'total', the stored kinds, and the pair slices. */
  daily: Map<string, KindRows>;
  hourly: HourlyRow[];
  /** Lifetime impressions per line item up to range.to, and the pool inferred from the latest snapshot. */
  reachPools: Map<string, number>;
  lifetimeImpressions: Map<string, number>;
  /** Pacing snapshot columns per `${segmentId}`: last value. */
  limit?: number;
}

/** Pacing snapshot columns are levels, not counts: they are copied to every part of a split, never divided. */
const SNAP_COLUMNS: ReadonlySet<string> = new Set([
  'liPacingPct',
  'ioPacingPct',
  'dailyTarget',
  'budgetSegmentBudget',
]);

const INTEGER_COLUMNS = (col: string): boolean =>
  !MONEY_COLUMNS.has(col) &&
  !col.startsWith('conv') &&
  col !== 'cartRevenue' &&
  !['liPacingPct', 'ioPacingPct', 'dailyTarget', 'budgetSegmentBudget'].includes(col);

// ---- small helpers -------------------------------------------------------------------------------------------------

const addDays = (iso: string, n: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Offset of a time zone from UTC in hours on a date (east positive). */
export function tzOffsetHours(timeZone: string, date: string): number {
  try {
    const at = new Date(`${date}T12:00:00Z`);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(at);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    const local = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour') % 24,
      get('minute'),
    );
    return Math.round(((local - at.getTime()) / 3_600_000) * 100) / 100;
  } catch {
    return 0;
  }
}

/** Split values by weights: integer columns by largest remainder (exact), the rest proportionally. */
function splitValues(v: Values, weights: readonly number[]): Values[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  const out: Values[] = weights.map(() => ({}));
  if (sum <= 0) return out;
  for (const [col, x] of Object.entries(v)) {
    if (x === 0) continue;
    if (SNAP_COLUMNS.has(col)) {
      weights.forEach((_, i) => ((out[i] as Values)[col] = x));
    } else if (INTEGER_COLUMNS(col) && Number.isInteger(x) && x > 0) {
      const parts = largestRemainder(x, weights);
      parts.forEach((p, i) => ((out[i] as Values)[col] = p));
    } else {
      weights.forEach((w, i) => ((out[i] as Values)[col] = (x * w) / sum));
    }
  }
  return out;
}

// ---- slice fallbacks for days that have no stored rows of a kind -------------------------------------------------------

const REGION_IN: [string, number][] = [
  ['IN-MH', 17],
  ['IN-DL', 12],
  ['IN-KA', 11],
  ['IN-TN', 9],
  ['IN-UP', 9],
  ['IN-TG', 6],
  ['IN-WB', 6],
  ['IN-GJ', 6],
  ['IN-RJ', 4],
  ['IN-ALL', 20],
];

function fallbackWeights(
  kind: StoredKind,
  li: LineItemInfo,
  world: World,
): [string, number][] | null {
  switch (kind) {
    case 'environment':
      return li.type === 'CTV' || li.type === 'YT_ON_CTV'
        ? [['APP', 1]]
        : li.type === 'VIDEO' || li.type === 'AUDIO'
          ? [
              ['WEB', 40],
              ['APP', 60],
            ]
          : [
              ['WEB', 55],
              ['APP', 45],
            ];
    case 'format':
      return [
        [
          li.type === 'AUDIO'
            ? 'audio'
            : li.type.includes('VIDEO') || li.type === 'CTV'
              ? 'video'
              : 'display',
          1,
        ],
      ];
    case 'region': {
      const cur = world.advertisers.get(li.advertiserId)?.currencyCode;
      return cur === 'INR' ? REGION_IN : cur === 'SGD' ? [['SG-ALL', 1]] : [['US-ALL', 1]];
    }
    case 'creative':
      return li.creativeIds.length
        ? li.creativeIds.map((id) => [id, 1] as [string, number])
        : [['(none)', 1]];
    default:
      return null;
  }
}

function kindRows(
  input: ComputeInput,
  kind: StoredKind,
  li: LineItemInfo,
  date: string,
  total: Values,
): { rows: RawSlice[]; stored: boolean } {
  const stored = input.daily.get(kind)?.get(`${li.id}|${date}`);
  if (stored && stored.length) return { rows: stored, stored: true };
  const w = fallbackWeights(kind, li, input.world);
  if (!w) return { rows: [{ sliceKey: '', v: total }], stored: false };
  const parts = splitValues(
    total,
    w.map(([, x]) => x),
  );
  return { rows: w.map(([key], i) => ({ sliceKey: key, v: parts[i] as Values })), stored: false };
}

/** Independence allocation of `cell` by the marginal rows of another kind (4.3 step 2). */
function allocateByMarginal(
  cell: Values,
  marginal: RawSlice[],
  total: Values,
): { key: string; v: Values }[] {
  return marginal.map((m) => {
    const out: Values = {};
    for (const [col, x] of Object.entries(cell)) {
      const t = total[col] ?? 0;
      out[col] = SNAP_COLUMNS.has(col) ? x : t === 0 ? 0 : (x * (m.v[col] ?? 0)) / t;
    }
    return { key: m.sliceKey, v: out };
  });
}

interface BaseCell {
  keys: Partial<Record<StoredKind, string>>;
  v: Values;
}

function baseCells(input: ComputeInput, li: LineItemInfo, date: string, total: Values): BaseCell[] {
  const { plan } = input;
  if (plan.kinds.length === 0) return [{ keys: {}, v: total }];
  if (plan.pair) {
    const stored = input.daily.get(plan.pair)?.get(`${li.id}|${date}`);
    const [a, b] =
      plan.pair === 'exchangeDevice'
        ? (['exchange', 'device'] as const)
        : (['region', 'device'] as const);
    if (stored && stored.length) {
      return stored.map((r) => {
        const [ka = '', kb = ''] = r.sliceKey.split('|');
        return { keys: { [a]: ka, [b]: kb }, v: r.v };
      });
    }
    // pair rows missing: independence of the two single kinds
    const ra = kindRows(input, a, li, date, total).rows;
    const rb = kindRows(input, b, li, date, total).rows;
    return ra.flatMap((x) =>
      allocateByMarginal(x.v, rb, total).map((y) => ({
        keys: { [a]: x.sliceKey, [b]: y.key },
        v: y.v,
      })),
    );
  }
  const [first, ...rest] = plan.kinds as [StoredKind, ...StoredKind[]];
  let cells: BaseCell[] = kindRows(input, first, li, date, total).rows.map((r) => ({
    keys: { [first]: r.sliceKey },
    v: r.v,
  }));
  for (const k of rest) {
    const marginal = kindRows(input, k, li, date, total).rows;
    cells = cells.flatMap((c) =>
      allocateByMarginal(c.v, marginal, total).map((y) => ({
        keys: { ...c.keys, [k]: y.key },
        v: y.v,
      })),
    );
  }
  return cells;
}

// ---- group state -----------------------------------------------------------------------------------------------------

interface Group {
  dims: (string | number | null)[];
  acc: Values;
  /** Per line item: exposure sums for the reach formula. */
  reach: Map<string, { impressions: number; clicks: number; viewable: number; coViewed: number }>;
  segments: Map<string, SegmentInfo>;
  snap: Record<string, { date: string; value: number }>;
  firstDate: string;
  lastDate: string;
  advertisers: Set<string>;
}

function newGroup(dims: Group['dims']): Group {
  return {
    dims,
    acc: {},
    reach: new Map(),
    segments: new Map(),
    snap: {},
    firstDate: '9999-99-99',
    lastDate: '0000-00-00',
    advertisers: new Set(),
  };
}

const ID_FILTER_PATH: Record<string, string> = {
  partner: 'partner.id',
  advertiser: 'advertiser.id',
  campaign: 'campaign.id',
  insertion_order: 'io.id',
  line_item: 'lineItem.id',
};

/** The value a filter compares: ids for entity names (chips show "name (id)"), the printed value for the rest. */
export function filterValue(field: ReportFieldDef, ctx: CellCtx): string {
  const path = ID_FILTER_PATH[field.key];
  if (path) {
    const f = { ...field, source: { t: 'ENTITY', path } } as ReportFieldDef;
    return String(dimValue(f, ctx) ?? '');
  }
  return String(dimValue(field, ctx) ?? '');
}

function passes(
  filters: ReportFilter[],
  fields: Map<string, ReportFieldDef>,
  ctx: CellCtx,
): boolean {
  for (const f of filters) {
    const field = fields.get(f.field);
    if (!field || f.values.length === 0) continue;
    const v = filterValue(field, ctx);
    const hit = f.values.includes(v);
    if (f.op === 'NOT_IN' ? hit : !hit) return false;
  }
  return true;
}

// ---- evaluation ------------------------------------------------------------------------------------------------------

const DIGITS: Record<string, number> = { INT: 0, DECIMAL: 2, PERCENT: 2, MONEY: 2 };

function roundTo(x: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round((x + Number.EPSILON) * f) / f;
}

interface EvalEnv {
  world: World;
  plan: ReportPlan;
  today: string;
  range: { from: string; to: string };
  pools: Map<string, number>;
  lifetime: Map<string, number>;
}

function reachOf(g: Group, col: string, env: EvalEnv): number {
  const items = [...g.reach.entries()].map(([liId, e]) => ({
    pool: env.pools.get(liId) ?? defaultPool(env.lifetime.get(liId) ?? e.impressions),
    exposures:
      col === 'clickReach'
        ? e.clicks
        : col === 'viewableReach'
          ? e.viewable
          : col === 'coViewedReach'
            ? e.coViewed
            : e.impressions,
  }));
  return unionReach(items);
}

function evalMetric(
  key: string,
  g: Group,
  env: EvalEnv,
  memo: Map<string, number | null>,
): number | null {
  if (memo.has(key)) return memo.get(key) as number | null;
  const f = FIELD_BY_KEY.get(key);
  let out: number | null = null;
  if (f && f.kind === 'METRIC') {
    const s = f.source as SourceSpec;
    switch (s.t) {
      case 'COUNTER':
        out = g.acc[s.col] ?? 0;
        break;
      case 'COUNTER_FX':
        out = g.acc[`${s.col}@${s.currency}`] ?? 0;
        break;
      case 'RATIO': {
        const n = evalMetric(s.num, g, env, memo);
        const d = evalMetric(s.den, g, env, memo);
        out = n === null || d === null || d === 0 ? null : (n / d) * (s.scale ?? 1);
        break;
      }
      case 'DIFF': {
        const [first, ...others] = s.of;
        let v = evalMetric(first as string, g, env, memo) ?? 0;
        for (const o of others) v -= evalMetric(o, g, env, memo) ?? 0;
        out = v;
        break;
      }
      case 'SUM_OF':
        out = s.of.reduce((a, k) => a + (evalMetric(k, g, env, memo) ?? 0), 0);
        break;
      case 'CONST':
        out = typeof s.value === 'number' ? s.value : 0;
        break;
      case 'REACH': {
        if (s.col === 'avgFrequency') {
          const r = reachOf(g, 'impressionReach', env);
          out = r > 0 ? (g.acc.impressions ?? 0) / r : null;
        } else {
          out = reachOf(g, s.col, env) * (s.factor ?? 1);
        }
        break;
      }
      case 'SNAPSHOT': {
        if (s.scope === 'SEGMENT') {
          const segs = [...g.segments.values()];
          if (s.col === 'budget') {
            out = segs.length ? segs.reduce((a, x) => a + x.amount, 0) : null;
          } else {
            // pacing %: the last stored IO pacing value, else spend over the even plan of the days in the report
            const last = g.snap.ioPacingPct;
            if (last) out = last.value;
            else if (segs.length) {
              const planned = segs.reduce((a, x) => {
                const from = x.start > env.range.from ? x.start : env.range.from;
                const to = x.end < env.range.to ? x.end : env.range.to;
                const days = Math.max(0, daysBetween(from, to) + 1);
                const total = Math.max(1, daysBetween(x.start, x.end) + 1);
                return a + (x.amount * days) / total;
              }, 0);
              const spent = g.acc['revenue@ADV'] ?? g.acc.revenue ?? 0;
              out = planned > 0 ? (spent / planned) * 100 : null;
            }
          }
        } else {
          const col =
            s.col === 'pacingPct' ? (s.scope === 'LI' ? 'liPacingPct' : 'ioPacingPct') : s.col;
          out = g.snap[col]?.value ?? null;
        }
        break;
      }
    }
  }
  memo.set(key, out);
  return out;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

function formatMetric(f: ReportFieldDef, v: number | null): Cell {
  if (v === null || Number.isNaN(v) || !Number.isFinite(v)) return null;
  return roundTo(v, DIGITS[f.dataType] ?? 2);
}

// ---- main ------------------------------------------------------------------------------------------------------------

export function columnsOf(def: ReportDefinition): QueryColumn[] {
  return [...def.dimensions, ...def.metrics].map((k) => {
    const f = FIELD_BY_KEY.get(k) as ReportFieldDef;
    return { key: f.key, label: f.label, kind: f.kind, dataType: f.dataType };
  });
}

export function compute(input: ComputeInput): QueryResult {
  const { def, plan, world, range } = input;
  const fieldByKey = new Map<string, ReportFieldDef>();
  for (const f of def.filters) {
    const field = FIELD_BY_KEY.get(f.field);
    if (field) fieldByKey.set(f.field, field);
  }
  const dimFields = plan.dims.map((d) => d.field);
  const derivedAllocs = new Map<string, StoredKind>();
  for (const f of [...dimFields, ...fieldByKey.values()]) {
    if (f.source.t === 'DERIVED')
      derivedAllocs.set(baseAllocation(f.source.allocation), f.source.parent as StoredKind);
  }
  const groups = new Map<string, Group>();
  const utc = def.timeZone === 'UTC';
  const warnings = new Set<Warning>();
  if (plan.approximated) warnings.add('APPROXIMATED_PIVOT');
  const fetchFrom = utc ? addDays(range.from, -1) : range.from;
  const fetchTo = utc ? addDays(range.to, 1) : range.to;

  const moneyCurrencies = plan.moneyColumns;

  function addToGroup(ctx: CellCtx, v: Values, weight: number, liInfo: LineItemInfo): void {
    const dims = plan.dims.map((d) => dimValue(d.field, ctx));
    const gkey = dims.map((x) => `${x ?? ''}`).join('\u0001');
    let g = groups.get(gkey);
    if (!g) {
      g = newGroup(dims);
      groups.set(gkey, g);
    }
    const adv = world.advertisers.get(liInfo.advertiserId);
    const advCur = adv?.currencyCode ?? world.partner.currencyCode;
    g.advertisers.add(liInfo.advertiserId);
    for (const col of plan.columns) {
      const x = (v[col] ?? 0) * weight;
      if (x === 0) continue;
      g.acc[col] = (g.acc[col] ?? 0) + x;
      const cur = moneyCurrencies.get(col);
      if (cur) {
        for (const c of cur) {
          const k = `${col}@${c}`;
          g.acc[k] = (g.acc[k] ?? 0) + x * targetCurrency(world, advCur, c);
        }
      }
    }
    for (const col of plan.snapshotColumns) {
      const x = v[col];
      if (x === undefined || x === null) continue;
      const prev = g.snap[col];
      if (!prev || ctx.date >= prev.date) g.snap[col] = { date: ctx.date, value: x };
    }
    if (plan.reach) {
      const e = g.reach.get(liInfo.id) ?? { impressions: 0, clicks: 0, viewable: 0, coViewed: 0 };
      e.impressions += (v.impressions ?? 0) * weight;
      e.clicks += (v.clicks ?? 0) * weight;
      e.viewable += (v.viewableImpressions ?? 0) * weight;
      e.coViewed += (v.coViewedImpressions ?? 0) * weight;
      g.reach.set(liInfo.id, e);
    }
    if (ctx.segment) g.segments.set(ctx.segment.id, ctx.segment);
    if (ctx.date < g.firstDate) g.firstDate = ctx.date;
    if (ctx.date > g.lastDate) g.lastDate = ctx.date;
  }

  function emit(
    li: LineItemInfo,
    date: string,
    hour: number | undefined,
    keys: BaseCell['keys'],
    v: Values,
    weight: number,
  ): void {
    if (date < range.from || date > range.to) return;
    const baseCtx: CellCtx = {
      world,
      li,
      date,
      keys,
      derived: {},
      segment: plan.segment ? segmentAt(world, li.ioId, date) : null,
      ...(hour !== undefined ? { hour } : {}),
    };
    // derived allocations: split the cell by each allocation in turn
    let parts: { derived: Record<string, string>; v: Values }[] = [{ derived: {}, v }];
    for (const [alloc, parent] of derivedAllocs) {
      const table = allocationTable(alloc, keys[parent] ?? '');
      parts = parts.flatMap((p) => {
        const shares = splitValues(
          p.v,
          table.map(([, w]) => w),
        );
        return table.map(([label], i) => ({
          derived: { ...p.derived, [alloc]: label },
          v: shares[i] as Values,
        }));
      });
    }
    for (const p of parts) {
      const ctx: CellCtx = { ...baseCtx, derived: p.derived };
      if (!passes(def.filters, fieldByKey, ctx)) continue;
      addToGroup(ctx, p.v, weight, li);
    }
  }

  // Which line items can match the entity filters (cheap pre-filter; slice filters run per cell).
  const lis = [...world.lineItems.values()].filter((li) =>
    passes(
      def.filters.filter((f) => FIELD_BY_KEY.get(f.field)?.source.t === 'ENTITY'),
      fieldByKey,
      { world, li, date: range.from, keys: {}, derived: {}, segment: null },
    ),
  );

  if (plan.hourly) {
    const byLi = new Map(lis.map((l) => [l.id, l]));
    for (const row of input.hourly) {
      const li = byLi.get(row.lineItemId);
      if (!li) continue;
      const adv = world.advertisers.get(li.advertiserId);
      const tz = utc ? 'UTC' : (adv?.timeZone ?? world.partner.timeZone);
      const local = new Date(row.hourStartMs);
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
      }).formatToParts(local);
      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
      const date = `${get('year')}-${get('month')}-${get('day')}`;
      emit(li, date, Number(get('hour')) % 24, {}, row.v, 1);
    }
  } else {
    const totals: KindRows = input.daily.get('total') ?? new Map<string, RawSlice[]>();
    for (const li of lis) {
      const adv = world.advertisers.get(li.advertiserId);
      for (let d = fetchFrom; d <= fetchTo; d = addDays(d, 1)) {
        const t = totals.get(`${li.id}|${d}`)?.[0];
        if (!t) continue;
        const total = t.v;
        const cells = baseCells(input, li, d, total);
        let shift = 0;
        if (utc) {
          shift = tzOffsetHours(adv?.timeZone ?? world.partner.timeZone, d);
          if (shift !== 0) warnings.add('TIME_ZONE_APPROXIMATED');
        }
        for (const c of cells) {
          if (shift === 0) {
            emit(li, d, undefined, c.keys, c.v, 1);
          } else {
            // local day d spans UTC [d - shift, d + 24h - shift): |shift|/24 of it falls on the neighbouring UTC day
            const p = Math.min(1, Math.abs(shift) / 24);
            const other = addDays(d, shift > 0 ? -1 : 1);
            emit(li, d, undefined, c.keys, c.v, 1 - p);
            emit(li, other, undefined, c.keys, c.v, p);
          }
        }
      }
    }
  }

  // evaluate
  const env: EvalEnv = {
    world,
    plan,
    today: input.today,
    range,
    pools: input.reachPools,
    lifetime: input.lifetimeImpressions,
  };
  const metricFields = def.metrics.map((k) => FIELD_BY_KEY.get(k) as ReportFieldDef);
  const rows: Cell[][] = [];
  const sortKeys: number[] = [];
  for (const g of groups.values()) {
    const memo = new Map<string, number | null>();
    const values = metricFields.map((f) => evalMetric(f.key, g, env, memo));
    const dimCells = g.dims.map((x, i) => {
      const f = dimFields[i] as ReportFieldDef;
      if (typeof x === 'number' && f.dataType === 'MONEY') return roundTo(x, 2);
      return x;
    });
    rows.push([...dimCells, ...metricFields.map((f, i) => formatMetric(f, values[i] ?? null))]);
    sortKeys.push(values[0] ?? 0);
  }
  const order = rows.map((_, i) => i);
  const nd = dimFields.length;
  order.sort((a, b) => {
    for (let i = 0; i < nd; i++) {
      const x = (rows[a] as Cell[])[i];
      const y = (rows[b] as Cell[])[i];
      if (x === y) continue;
      if (x === null) return 1;
      if (y === null) return -1;
      if (typeof x === 'number' && typeof y === 'number') return x - y;
      return String(x) < String(y) ? -1 : 1;
    }
    return (sortKeys[b] as number) - (sortKeys[a] as number);
  });
  const sorted = order.map((i) => rows[i] as Cell[]);

  if (
    def.metrics.some((k) => FIELD_BY_KEY.get(k)?.compat?.includes('CONVERSION')) &&
    range.to >= addDays(input.today, -1)
  ) {
    warnings.add('LATE_CONVERSIONS');
  }
  const limit = input.limit ?? 1000;
  const truncated = sorted.length > limit;
  if (truncated) warnings.add('TRUNCATED');
  return {
    columns: columnsOf(def),
    rows: truncated ? sorted.slice(0, limit) : sorted,
    truncated,
    totalRows: sorted.length,
    warnings: [...warnings],
    asOf: world.simNow.toISOString(),
    range,
  };
}
