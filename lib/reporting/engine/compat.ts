// Field compatibility (module 16 4.3 step 5). `incompatibility(key, selected)` returns the message of RPT-011 for one
// selected field, or null. `incompatibleWith(selected)` returns the map the picker greys out.
import { FIELDS, FIELD_BY_KEY, type ReportFieldDef } from '../catalogue';

/** Dimensions a reach metric can be broken down by (engine 9.5, spec 4.3). */
export const REACH_DIMENSION_KEYS: ReadonlySet<string> = new Set([
  'partner',
  'partner_id',
  'advertiser',
  'advertiser_id',
  'advertiser_currency',
  'campaign',
  'campaign_id',
  'insertion_order',
  'io_id',
  'line_item',
  'li_id',
  'date',
]);

const AUDIENCE_DIMS = new Set(['unique_reach_audience_list', 'unique_reach_audience_list_id']);

const pair = (a: ReportFieldDef, b: ReportFieldDef) => `${a.label} can't be used with ${b.label}.`;

function conflict(f: ReportFieldDef, g: ReportFieldDef): string | null {
  const fm = f.kind === 'METRIC';
  const gm = g.kind === 'METRIC';
  const reachM = (x: ReportFieldDef) => x.kind === 'METRIC' && x.compat?.includes('REACH');
  const dimOf = (a: ReportFieldDef, b: ReportFieldDef) => (a.kind === 'DIMENSION' ? a : b);
  // reach metric with a dimension outside the reach set
  if ((reachM(f) && !gm) || (reachM(g) && !fm)) {
    const m = reachM(f) ? f : g;
    const d = dimOf(f, g);
    if (d.kind === 'DIMENSION') {
      const audience = m.compat?.includes('REACH_AUDIENCE') && AUDIENCE_DIMS.has(d.key);
      if (!REACH_DIMENSION_KEYS.has(d.key) && !audience) return pair(m, d);
    }
  }
  // audience reach metrics only with their audience dimension: handled by the pair rule above
  // hourly dimensions cannot combine with slice dimensions (SimHourlyMetric holds totals only)
  if (!fm && !gm) {
    const hourly = (x: ReportFieldDef) => x.compat?.includes('HOURLY');
    const sliceLike = (x: ReportFieldDef) =>
      (x.source.t === 'SLICE' && x.source.kind !== 'date' && x.source.kind !== 'hour') ||
      x.source.t === 'DERIVED';
    if (hourly(f) && sliceLike(g)) return pair(f, g);
    if (hourly(g) && sliceLike(f)) return pair(g, f);
    // Hour and Date and Hour do not combine with a Date dimension twice
    if (f.key === 'date_and_hour' && g.key === 'date') return pair(f, g);
    if (g.key === 'date_and_hour' && f.key === 'date') return pair(g, f);
  }
  // hourly dimension with a non-additive metric
  const hourlyDim =
    (!fm && f.compat?.includes('HOURLY') ? f : null) ??
    (!gm && g.compat?.includes('HOURLY') ? g : null);
  if (hourlyDim) {
    const m = fm ? f : gm ? g : null;
    if (m && (reachM(m) || m.compat?.includes('SEGMENT'))) return pair(m, hourlyDim);
  }
  // activity dimensions need conversion metrics only
  const activityDim = (x: ReportFieldDef) =>
    x.kind === 'DIMENSION' && x.compat?.includes('ACTIVITY');
  if ((activityDim(f) && gm) || (activityDim(g) && fm)) {
    const d = activityDim(f) ? f : g;
    const m = activityDim(f) ? g : f;
    if (!m.compat?.includes('CONVERSION') && m.source.t !== 'RATIO') return pair(m, d);
    if (m.source.t === 'RATIO' && !m.compat?.includes('CONVERSION')) {
      const convRef = ['total_conversions', 'post_click_conversions', 'post_view_conversions'];
      const s = m.source;
      if (!convRef.includes(s.num) && !convRef.includes(s.den)) return pair(m, d);
    }
  }
  // Budget segment fields are per IO: they do not combine with creative or slice dimensions that split a segment
  // YouTube ad group / ad dimensions only combine with additive metrics
  const yt = (x: ReportFieldDef) => x.kind === 'DIMENSION' && x.compat?.includes('YOUTUBE_DIM');
  if (
    (yt(f) && gm && (reachM(g) || g.compat?.includes('SEGMENT'))) ||
    (yt(g) && fm && (reachM(f) || f.compat?.includes('SEGMENT')))
  ) {
    return yt(f) ? pair(g, f) : pair(f, g);
  }
  return null;
}

/** The first conflict of `key` with another selected field, or null. */
export function incompatibility(key: string, selected: readonly string[]): string | null {
  const f = FIELD_BY_KEY.get(key);
  if (!f) return null;
  for (const other of selected) {
    if (other === key) continue;
    const g = FIELD_BY_KEY.get(other);
    if (!g) continue;
    const reason = conflict(f, g);
    if (reason) return reason;
  }
  return null;
}

/** For every catalogue field that would conflict with the current selection, the reason (picker greys it out). */
export function incompatibleWith(selected: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  if (selected.length === 0) return out;
  for (const f of FIELDS) {
    if (selected.includes(f.key)) continue;
    const reason = incompatibility(f.key, selected);
    if (reason) out[f.key] = reason;
  }
  return out;
}
