// List URL state (routes.md 6.1, 6.2, 6.4): d, q, f.*, sort, rows, page, cv, seg. Pure parse and serialise so the
// round trip is unit tested; `useListParams` wraps them with the router.

export const DATE_PRESETS = [
  'TODAY',
  'YESTERDAY',
  'THIS_WEEK',
  'LAST_WEEK',
  'LAST_7_DAYS',
  'LAST_14_DAYS',
  'LAST_30_DAYS',
  'THIS_MONTH',
  'LAST_MONTH',
  'MONTH_TO_DATE',
  'QUARTER_TO_DATE',
  'YEAR_TO_DATE',
  'LAST_2_YEARS',
  'LIFETIME',
] as const;

export const PAGE_SIZES = [20, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export interface SortKey {
  field: string;
  dir: 'asc' | 'desc';
}

export interface ListParams {
  /** Date range token or `YYYYMMDD:YYYYMMDD`. Null = the page default. */
  d: string | null;
  q: string;
  /** `f.status=ACTIVE&f.status=PAUSED` → `{ status: ['ACTIVE', 'PAUSED'] }`. `['*']` = filter removed. */
  f: Record<string, string[]>;
  sort: SortKey[];
  rows: PageSize;
  page: number;
  cv: string;
  seg: string;
}

export const LIST_DEFAULTS: ListParams = {
  d: null,
  q: '',
  f: {},
  sort: [],
  rows: 20,
  page: 1,
  cv: 'performance',
  seg: 'none',
};

const LIST_KEYS = ['d', 'q', 'sort', 'rows', 'page', 'cv', 'seg'];
const CV_FIXED = ['performance', 'summary', 'pacing', 'optimization'];

function validDay(s: string): boolean {
  if (!/^\d{8}$/.test(s)) return false;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(4, 6));
  const d = Number(s.slice(6, 8));
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function isDateParam(v: string): boolean {
  if ((DATE_PRESETS as readonly string[]).includes(v)) return true;
  if (/^[1-9]\d{0,3}D_(TODAY|YESTERDAY)$/.test(v)) return true;
  const m = /^(\d{8}):(\d{8})$/.exec(v);
  return Boolean(m && validDay(m[1] ?? '') && validDay(m[2] ?? '') && (m[1] ?? '') <= (m[2] ?? ''));
}

function parseSort(v: string): SortKey[] | null {
  const out: SortKey[] = [];
  for (const part of v.split(',')) {
    const m = /^([A-Za-z][A-Za-z0-9_.]{0,63}):(asc|desc)$/.exec(part);
    if (!m) return null;
    out.push({ field: m[1] ?? '', dir: m[2] as SortKey['dir'] });
  }
  return out;
}

export interface ParsedList {
  params: ListParams;
  /** True when a value was dropped, so the caller cleans the URL with `router.replace` (routes.md 6.4). */
  dirty: boolean;
}

export function parseListParams(
  search: URLSearchParams,
  defaults: Partial<ListParams> = {},
): ParsedList {
  const base: ListParams = { ...LIST_DEFAULTS, ...defaults, f: { ...(defaults.f ?? {}) } };
  const out: ListParams = { ...base, f: { ...base.f } };
  let dirty = false;

  const d = search.get('d');
  if (d !== null) {
    if (isDateParam(d)) out.d = d;
    else dirty = true;
  }
  const q = search.get('q');
  if (q !== null) {
    if (q.length <= 200) out.q = q;
    else dirty = true;
  }
  const filters: Record<string, string[]> = {};
  for (const [k, v] of search.entries()) {
    if (!k.startsWith('f.')) continue;
    const key = k.slice(2);
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key) || v === '' || v.length > 200) {
      dirty = true;
      continue;
    }
    (filters[key] ??= []).push(v);
  }
  if (Object.keys(filters).length) out.f = { ...out.f, ...filters };

  const sort = search.get('sort');
  if (sort !== null) {
    const parsed = parseSort(sort);
    if (parsed) out.sort = parsed;
    else dirty = true;
  }
  const rows = search.get('rows');
  if (rows !== null) {
    const n = Number(rows);
    if ((PAGE_SIZES as readonly number[]).includes(n)) out.rows = n as PageSize;
    else dirty = true;
  }
  const page = search.get('page');
  if (page !== null) {
    if (/^[1-9]\d{0,5}$/.test(page)) out.page = Number(page);
    else dirty = true;
  }
  const cv = search.get('cv');
  if (cv !== null) {
    if (CV_FIXED.includes(cv) || /^c_[A-Za-z0-9_-]{1,64}$/.test(cv)) out.cv = cv;
    else dirty = true;
  }
  const seg = search.get('seg');
  if (seg !== null) {
    if (/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(seg)) out.seg = seg;
    else dirty = true;
  }
  return { params: out, dirty };
}

/**
 * Write list state into `search` (other params such as `sim_*` are kept). Values equal to the defaults are left out,
 * so a clean list has a clean URL. Keys are written in a fixed order.
 */
export function serializeListParams(
  params: ListParams,
  defaults: Partial<ListParams> = {},
  search: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  const base: ListParams = { ...LIST_DEFAULTS, ...defaults, f: { ...(defaults.f ?? {}) } };
  const out = new URLSearchParams();
  for (const [k, v] of search.entries()) {
    if (!LIST_KEYS.includes(k) && !k.startsWith('f.')) out.append(k, v);
  }
  if (params.d && params.d !== base.d) out.set('d', params.d);
  if (params.q && params.q !== base.q) out.set('q', params.q);
  for (const key of Object.keys(params.f).sort()) {
    const values = params.f[key] ?? [];
    const def = base.f[key] ?? [];
    if (values.length === def.length && values.every((v, i) => v === def[i])) continue;
    for (const v of values) out.append(`f.${key}`, v);
  }
  const sort = params.sort.map((s) => `${s.field}:${s.dir}`).join(',');
  if (sort && sort !== base.sort.map((s) => `${s.field}:${s.dir}`).join(',')) out.set('sort', sort);
  if (params.rows !== base.rows) out.set('rows', String(params.rows));
  if (params.page !== base.page) out.set('page', String(params.page));
  if (params.cv !== base.cv) out.set('cv', params.cv);
  if (params.seg !== base.seg) out.set('seg', params.seg);
  return out;
}
