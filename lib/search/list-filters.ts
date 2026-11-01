// The `f.*` filters the Search resolver emits, read by the target lists (routes.md 6.1). Pure: the list pages parse
// their searchParams here, filter the rows on the server and show one removable chip per extra filter. `f.status`
// stays with the grid's own Status select, which starts from `statusFromParams`.
import { EXPIRING_SOON_DAYS } from './suggestions';

export type RawParams = Record<string, string | string[] | undefined>;

export interface ListFilters {
  /** `f.status`: ACTIVE, PAUSED, DRAFT, ARCHIVED or `*`. Null = the list default. */
  status: string | null;
  types: string[];
  endsWithin: number | null;
  /** `f.pacing=UNDER`: spent less than the share of the flight that has passed. */
  pacingUnder: boolean;
  pacingType: string | null;
  cpcOver: number | null;
  cpaOver: number | null;
  q: string;
  d: string | null;
}

const STATUSES = ['ACTIVE', 'PAUSED', 'DRAFT', 'ARCHIVED', '*'];
const PACING_TYPES = ['AHEAD', 'EVEN', 'ASAP'];
const LI_TYPES = [
  'DISPLAY',
  'VIDEO',
  'CTV',
  'AUDIO',
  'MOBILE_APP_INSTALL',
  'ADS_IN_MOBILE_APPS',
  'YT_VIDEO',
  'YT_AUDIO',
  'YT_ON_CTV',
  'DEMAND_GEN',
  'DOOH_DISPLAY',
  'DOOH_VIDEO',
];

function all(p: RawParams, key: string): string[] {
  const v = p[key];
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
}
const one = (p: RawParams, key: string): string | null => all(p, key)[0] ?? null;
function positive(v: string | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseListFilters(p: RawParams): ListFilters {
  const status = one(p, 'f.status');
  const pacingType = one(p, 'f.pacingType');
  const q = one(p, 'q')?.trim().slice(0, 200) ?? '';
  return {
    status: status && STATUSES.includes(status) ? status : null,
    types: all(p, 'f.type').filter((t) => LI_TYPES.includes(t)),
    endsWithin: positive(one(p, 'f.endsWithin')),
    pacingUnder: one(p, 'f.pacing') === 'UNDER',
    pacingType: pacingType && PACING_TYPES.includes(pacingType) ? pacingType : null,
    cpcOver: positive(one(p, 'f.cpcOver')),
    cpaOver: positive(one(p, 'f.cpaOver')),
    q,
    d: one(p, 'd'),
  };
}

/** Initial value of a grid's Status select. */
export function statusFromParams(p: RawParams): string | null {
  return parseListFilters(p).status;
}

interface Named {
  name: string;
  publicId: string;
}
const matchesText = (r: Named, q: string) =>
  !q || r.name.toLowerCase().includes(q.toLowerCase()) || r.publicId === q;

export interface LiFilterRow extends Named {
  type: string;
  status: string;
  budget: number | null;
  revenue: number;
  clicks: number;
  cpa: number | null;
  pacingType?: string;
  flightStart?: string | null;
  flightEnd?: string | null;
}

const DAY_MS = 86_400_000;
const days = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);

/** Cost per click of the row in the metric range; null without clicks. */
export function rowCpc(r: { revenue: number; clicks: number }): number | null {
  return r.clicks > 0 ? r.revenue / r.clicks : null;
}

export function filterLineItemRows<T extends LiFilterRow>(
  rows: T[],
  f: ListFilters,
  today: string | undefined,
): T[] {
  return rows.filter((r) => {
    if (!matchesText(r, f.q)) return false;
    if (f.types.length && !f.types.includes(r.type)) return false;
    if (f.pacingType && r.pacingType !== f.pacingType) return false;
    if (f.endsWithin !== null) {
      if (r.status !== 'ACTIVE' || !r.flightEnd || !today) return false;
      const left = days(r.flightEnd) - days(today);
      if (left < 0 || left > f.endsWithin) return false;
    }
    if (f.pacingUnder) {
      if (r.status !== 'ACTIVE' || !today || !r.budget || !r.flightStart || !r.flightEnd)
        return false;
      const total = days(r.flightEnd) - days(r.flightStart) + 1;
      const elapsed = Math.min(total, Math.max(0, days(today) - days(r.flightStart) + 1));
      if (total <= 0 || elapsed <= 0) return false;
      // spent share more than 10 points behind the share of the flight that has passed
      if (r.revenue / r.budget >= elapsed / total - 0.1) return false;
    }
    if (f.cpcOver !== null) {
      const c = rowCpc(r);
      if (c === null || c <= f.cpcOver) return false;
    }
    if (f.cpaOver !== null && (r.cpa === null || r.cpa <= f.cpaOver)) return false;
    return true;
  });
}

export function filterIoRows<T extends Named & { pacingType?: string }>(
  rows: T[],
  f: ListFilters,
): T[] {
  return rows.filter(
    (r) => matchesText(r, f.q) && (!f.pacingType || r.pacingType === f.pacingType),
  );
}

export function filterNamedRows<T extends Named>(rows: T[], f: ListFilters): T[] {
  return rows.filter((r) => matchesText(r, f.q));
}

export interface FilterChip {
  key: string;
  label: string;
  /** Query keys the remove link drops. */
  drops: string[];
}

const TYPE_LABEL: Record<string, string> = {
  YT_VIDEO: 'YouTube video',
  YT_AUDIO: 'YouTube audio',
  YT_ON_CTV: 'YouTube on CTV',
};
const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/** One chip per filter beyond Status, with the params its remove button drops. */
export function extraFilterChips(f: ListFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  if (f.q) chips.push({ key: 'q', label: `Name/ID: ${f.q}`, drops: ['q'] });
  if (f.types.length) {
    const label =
      f.types.length > 1 && f.types.every((t) => t.startsWith('YT_'))
        ? 'YouTube'
        : f.types.map((t) => TYPE_LABEL[t] ?? cap(t.replace(/_/g, ' '))).join(', ');
    chips.push({ key: 'type', label: `Type: ${label}`, drops: ['f.type'] });
  }
  if (f.pacingType)
    chips.push({
      key: 'pacingType',
      label: `Pacing type: ${cap(f.pacingType)}`,
      drops: ['f.pacingType'],
    });
  if (f.endsWithin !== null)
    chips.push({
      key: 'endsWithin',
      label: `Expiring within ${f.endsWithin === EXPIRING_SOON_DAYS ? '7 days' : `${f.endsWithin} days`}`,
      drops: ['f.endsWithin'],
    });
  if (f.pacingUnder) chips.push({ key: 'pacing', label: 'Pacing: Unused', drops: ['f.pacing'] });
  if (f.cpcOver !== null)
    chips.push({ key: 'cpcOver', label: `CPC: over ${f.cpcOver}`, drops: ['f.cpcOver'] });
  if (f.cpaOver !== null)
    chips.push({ key: 'cpaOver', label: `CPA: over ${f.cpaOver}`, drops: ['f.cpaOver'] });
  return chips;
}
