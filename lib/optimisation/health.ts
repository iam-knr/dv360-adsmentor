// Intelligence rows (module 01 4.8, module 11 4.9): text, ordering and Investigate routes. Pure, no database.
import type { ScopeIds } from '@/lib/routes/paths';
import { advertiserPath, campaignPath, ioPath, liPath } from '@/lib/routes/paths';
import { SUGGESTIONS, SUGGESTION_ORDER, type SuggestionType } from './catalog';

export type HealthSeverity = 'error' | 'warning' | 'suggestion';

export interface AlertFacts {
  id: string;
  type: string;
  diagnosticCode: string | null;
  severity: string;
  title: string;
  lineItemId: string | null;
  ioId: string | null;
  campaignId: string | null;
  payload?: unknown;
}

export interface HealthRowData {
  id: string;
  severity: HealthSeverity;
  text: string;
  /** Alert type key for `f.alert`, absent on suggestions. */
  alertType?: string;
  /** Path to open for Investigate (relative, starts with `/p/`). */
  investigateHref: string;
  /** History link of the alert row (clock icon), when the entity is known. */
  historyHref?: string;
  /** A conflicting-settings row for exactly one entity opens the Investigate drawer instead of a list. */
  drawer?: { scope: 'io' | 'li'; id: string };
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
const verb = (n: number, one: string, many: string): string => (n === 1 ? one : many);

/** Row text per engine code; `{name}` rows (deal, spend threshold) keep the stored title. */
export function alertText(code: string | null, n: number, fallback: string): string {
  switch (code) {
    case 'NO_SPEND_IO':
      return `${plural(n, 'insertion order', 'insertion orders')} ${verb(n, "hasn't", "haven't")} spent anything today or yesterday`;
    case 'NO_SPEND_LI':
      return `${plural(n, 'line item', 'line items')} ${verb(n, "hasn't", "haven't")} spent anything today or yesterday`;
    case 'UNDERPACING_IO':
      return `${plural(n, 'insertion order', 'insertion orders')} ${verb(n, 'is', 'are')} underpacing`;
    case 'CONFLICT_IO':
      return `${plural(n, 'insertion order', 'insertion orders')} ${verb(n, 'has', 'have')} conflicting settings which may prevent your budget from being spent`;
    case 'CONFLICT_LI':
      return `${plural(n, 'line item', 'line items')} ${verb(n, 'has', 'have')} conflicting settings which may prevent your budget from being spent`;
    case 'LIMITED_AUDIENCE_LI':
      return `${plural(n, 'line item', 'line items')} ${verb(n, 'has', 'have')} a very limited audience`;
    case 'UNDERPERFORMING_IO':
      return `${plural(n, 'insertion order', 'insertion orders')} ${verb(n, 'is', 'are')} underperforming`;
    case 'RESTRICTED_AUDIENCE_LIST_LI':
      return `${plural(n, 'line item', 'line items')} ${verb(n, 'uses a restricted audience list', 'use restricted audience lists')}`;
    case 'CREATIVE_REJECTED':
      return `${plural(n, 'creative', 'creatives')} rejected`;
    case 'CREATIVE_RESTRICTED':
      return `${plural(n, 'creative', 'creatives')} restricted`;
    default:
      return fallback;
  }
}

/** `f.alert` list route of the Investigate link (module 01 4.8 table). */
function investigatePath(
  code: string | null,
  type: string,
  ids: Required<Pick<ScopeIds, 'partnerId' | 'advertiserId'>>,
): string {
  const q = `f.alert=${type}`;
  const a = (...sub: string[]) => advertiserPath(ids.partnerId, ids.advertiserId, ...sub);
  switch (code) {
    case 'NO_SPEND_IO':
    case 'CONFLICT_IO':
    case 'UNDERPERFORMING_IO':
      return `${a('explorerios')}?${q}`;
    case 'UNDERPACING_IO':
      return `${a('explorerios')}?${q}&cv=pacing`;
    case 'SPEND_THRESHOLD':
      return a('history');
    default:
      return type === 'DEALS_OFFLINE'
        ? `${a('marketplace', 'inventory')}?${q}`
        : `${a('explorerlis')}?${q}`;
  }
}

const SEVERITY_RANK: Record<string, number> = { CRITICAL: 0, NEEDS_ATTENTION: 1 };

/** Aggregate open alerts by engine code into one row each, errors first, then by count. */
export function healthRows(
  alerts: readonly AlertFacts[],
  ids: Required<Pick<ScopeIds, 'partnerId' | 'advertiserId'>>,
): HealthRowData[] {
  const groups = new Map<string, AlertFacts[]>();
  for (const a of alerts) {
    const key = a.diagnosticCode ?? a.type;
    const g = groups.get(key);
    if (g) g.push(a);
    else groups.set(key, [a]);
  }
  const rows = [...groups.entries()].map(([key, g]) => {
    const first = g[0] as AlertFacts;
    const worst = Math.min(...g.map((a) => SEVERITY_RANK[a.severity] ?? 1));
    return {
      worst,
      n: g.length,
      row: {
        id: key,
        severity: worst === 0 ? 'error' : 'warning',
        text: alertText(first.diagnosticCode, g.length, first.title),
        alertType: first.type,
        investigateHref: investigatePath(first.diagnosticCode, first.type, ids),
        ...(g.length === 1 &&
        first.type === 'CONFLICTING_SETTINGS' &&
        (first.lineItemId ?? first.ioId)
          ? {
              drawer: first.lineItemId
                ? { scope: 'li' as const, id: first.lineItemId }
                : { scope: 'io' as const, id: first.ioId as string },
            }
          : {}),
      } satisfies HealthRowData,
    };
  });
  rows.sort((x, y) => x.worst - y.worst || y.n - x.n || (x.row.id < y.row.id ? -1 : 1));
  return rows.map((r) => r.row);
}

export interface SuggestionFacts {
  id: string;
  type: SuggestionType;
  scopeType: 'LINE_ITEM' | 'IO';
  scopeId: string;
  title: string;
  status: 'OPEN' | 'DISMISSED' | 'APPLIED';
  updatedAt: Date;
}

export interface SuggestionRowData {
  id: string;
  type: SuggestionType;
  text: string;
  scope: 'IO' | 'LI';
  scopeId: string;
  applicable: boolean;
  dismissable: boolean;
  investigateHref: string;
}

/** Entity path pieces needed to build Investigate links for IO and LI scoped suggestions. */
export interface SuggestionPaths {
  io: (ioRowId: string) => string | null;
  li: (liRowId: string) => string | null;
}

export function suggestionRows(
  suggestions: readonly SuggestionFacts[],
  paths: SuggestionPaths,
  now: Date,
): SuggestionRowData[] {
  const rows: SuggestionRowData[] = [];
  for (const s of suggestions) {
    if (s.status === 'APPLIED') continue;
    if (s.status === 'DISMISSED' && !dismissalOver(s.updatedAt, now)) continue;
    const info = SUGGESTIONS[s.type];
    const base = info.scope === 'IO' ? paths.io(s.scopeId) : paths.li(s.scopeId);
    if (!base) continue;
    const href =
      info.investigate === 'troubleshooter'
        ? `${base}/troubleshooter`
        : info.investigate === 'li-targeting'
          ? `${base}/details#targeting`
          : info.investigate === 'li-creatives'
            ? `${base}/details#creatives`
            : `${base}/details`;
    rows.push({
      id: s.id,
      type: s.type,
      text: info.title,
      scope: info.scope,
      scopeId: s.scopeId,
      applicable: info.applicable,
      dismissable: info.dismissable,
      investigateHref: href,
    });
  }
  const rank = (t: SuggestionType) => SUGGESTION_ORDER.indexOf(t);
  rows.sort((a, b) => rank(a.type) - rank(b.type) || (a.id < b.id ? -1 : 1));
  return rows;
}

/** True once a dismissal is older than seven sim days (4.9). */
export function dismissalOver(dismissedAt: Date, now: Date, days = 7): boolean {
  return now.getTime() - dismissedAt.getTime() >= days * 86_400_000;
}

export { campaignPath, ioPath, liPath };
