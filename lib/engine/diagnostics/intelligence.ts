// Optimisation suggestions of the Intelligence panel (engine.md 3.7, RC-014), as data. The io layer
// writes them as Recommendation rows; the engine owns the triggers.

import type { Params } from '../params/schema';
import type { FunnelRow } from './recorder';
import { totalsOf } from './recorder';

export type RecommendationType =
  | 'ENABLE_AUTO_BUDGET_ALLOCATION'
  | 'RAISE_BID'
  | 'ADD_CREATIVES'
  | 'BROADEN_TARGETING'
  | 'BID_LEARNING';

export interface RecommendationFacts {
  liId: string;
  rows: readonly FunnelRow[];
  learning: boolean;
}

export interface RecommendationDecision {
  action: 'OPEN' | 'CLOSE';
  type: RecommendationType;
  scopeKind: 'LINE_ITEM' | 'INSERTION_ORDER';
  scopeId: string;
  key: string;
  title: string;
}

const TITLE: Record<RecommendationType, string> = {
  ENABLE_AUTO_BUDGET_ALLOCATION: 'Enable automatic budget allocation',
  RAISE_BID: 'Raise bid, bids are below typical clearing price',
  ADD_CREATIVES: 'Add creative sizes',
  BROADEN_TARGETING: 'Broaden targeting',
  BID_LEARNING: 'Bid strategy still learning',
};

/** Suggestion conditions that hold for a line item given the tick's funnel. */
export function suggestionsFor(f: RecommendationFacts, p: Params): RecommendationType[] {
  const t = totalsOf(f.rows);
  const A = t.get('M.AVAILABLE') ?? 0;
  const S = t.get('M.BIDS_SUBMITTED') ?? 0;
  const out: RecommendationType[] = [];
  const bidLoss = (t.get('A.BELOW_MIN_BID') ?? 0) + (t.get('E.BID_TOO_LOW') ?? 0);
  if (S > 0 && bidLoss / S > p.alerts.suggestions.rateThreshold) out.push('RAISE_BID');
  if (A > 0) {
    const size = t.get('C.SIZE_MISMATCH') ?? 0;
    if (size / A > p.alerts.suggestions.sizeMismatchThreshold) out.push('ADD_CREATIVES');
    let tCount = 0;
    for (const [code, n] of t) if (code.startsWith('T.')) tCount += n;
    if (tCount / A > p.alerts.suggestions.targetingThreshold) out.push('BROADEN_TARGETING');
  }
  if (f.learning) out.push('BID_LEARNING');
  return out;
}

/** Open or close suggestion rows by comparing against the open set in the state. */
export function reconcileSuggestions(
  open: Record<string, boolean>,
  current: ReadonlySet<string>,
  facts: ReadonlyMap<
    string,
    { type: RecommendationType; scopeKind: 'LINE_ITEM' | 'INSERTION_ORDER'; scopeId: string }
  >,
): { decisions: RecommendationDecision[]; next: Record<string, boolean> } {
  const decisions: RecommendationDecision[] = [];
  const next: Record<string, boolean> = {};
  for (const key of [...current].sort()) {
    const f = facts.get(key);
    if (!f) continue;
    next[key] = true;
    if (!open[key]) {
      decisions.push({
        action: 'OPEN',
        type: f.type,
        scopeKind: f.scopeKind,
        scopeId: f.scopeId,
        key,
        title: TITLE[f.type],
      });
    }
  }
  for (const key of Object.keys(open).sort()) {
    if (open[key] && !current.has(key)) {
      const [type, scopeKind, ...rest] = key.split('|');
      decisions.push({
        action: 'CLOSE',
        type: type as RecommendationType,
        scopeKind: scopeKind as 'LINE_ITEM' | 'INSERTION_ORDER',
        scopeId: rest.join('|'),
        key,
        title: TITLE[type as RecommendationType],
      });
    }
  }
  return { decisions, next };
}
