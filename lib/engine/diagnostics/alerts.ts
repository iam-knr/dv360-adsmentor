// Alert decisions as data (engine.md 3.7, RC-013). The io layer persists them; the core only
// decides which alerts are active and when they raise or resolve.

import type { Params } from '../params/schema';
import type { AlertTracker } from '../state';
import type { AlertCode, AlertPrefs } from '../world';

export type AlertSeverity = 'CRITICAL' | 'NEEDS_ATTENTION';
export type AlertScopeKind = 'LINE_ITEM' | 'INSERTION_ORDER' | 'CREATIVE' | 'ADVERTISER';

export interface ActiveAlert {
  code: AlertCode;
  scopeKind: AlertScopeKind;
  scopeId: string;
  severity: AlertSeverity;
  /** Values for the text template (engine.md 3.7). */
  params: Record<string, string | number>;
}

export interface AlertDecision extends ActiveAlert {
  action: 'RAISE' | 'RESOLVE';
  raisedAtTick: number;
  resolvedAtTick?: number;
}

export interface LiAlertFacts {
  id: string;
  ioId: string;
  /** In flight, parents active, status active. */
  live: boolean;
  spendToday: number;
  spendYesterday: number;
  /** Live ticks so far today and yesterday. */
  liveTicksToday: number;
  liveTicksYesterday: number;
  conflicts: string[];
  eligibleRequestsPerHour: number;
  underpacingOn: boolean;
  allCreativesDisapproved: boolean;
  someCreativeDisapproved: boolean;
  creativeRestricted: boolean;
  restrictedAudience: boolean;
}

export interface IoAlertFacts {
  id: string;
  live: boolean;
  liIds: string[];
  conflicts: string[];
  underpacing: boolean;
  /** Actual and goal for the KPI, null when below the minimum sample. */
  underperforming: boolean;
}

export interface AlertContext {
  params: Params;
  prefs: AlertPrefs;
  lis: LiAlertFacts[];
  ios: IoAlertFacts[];
  advertiserId: string;
  advertiserSpendYesterday: number;
  /** Ticks into the advertiser day. */
  hourOfDay: number;
}

const enabled = (prefs: AlertPrefs, code: AlertCode): boolean => {
  const v = prefs.enabled?.[code];
  if (code === 'SPEND_THRESHOLD') return v === true && (prefs.spendThreshold ?? 0) > 0;
  return v !== false;
};

/** Alerts whose condition holds at the end of this tick. */
export function evaluateAlerts(ctx: AlertContext): ActiveAlert[] {
  const out: ActiveAlert[] = [];
  const a = ctx.params.alerts;
  const push = (x: ActiveAlert) => {
    if (enabled(ctx.prefs, x.code)) out.push(x);
  };
  for (const li of ctx.lis) {
    if (li.live && li.liveTicksToday >= a.noSpendMinTicksIntoDay && li.spendToday <= 0) {
      const yesterdayOk = li.liveTicksYesterday === 0 ? false : li.spendYesterday <= 0;
      const startedToday = li.liveTicksYesterday === 0 && li.liveTicksToday >= 24;
      if (yesterdayOk || startedToday) {
        push({
          code: 'NO_SPEND_LI',
          scopeKind: 'LINE_ITEM',
          scopeId: li.id,
          severity: 'CRITICAL',
          params: { N: 1 },
        });
      }
    }
    if (li.conflicts.length > 0) {
      push({
        code: 'CONFLICT_LI',
        scopeKind: 'LINE_ITEM',
        scopeId: li.id,
        severity: 'NEEDS_ATTENTION',
        params: { N: 1, conflicts: li.conflicts.join(',') },
      });
    }
    if (
      li.live &&
      li.underpacingOn &&
      li.eligibleRequestsPerHour < a.limitedAudienceMinRequestsPerHour
    ) {
      push({
        code: 'LIMITED_AUDIENCE_LI',
        scopeKind: 'LINE_ITEM',
        scopeId: li.id,
        severity: 'NEEDS_ATTENTION',
        params: { N: 1 },
      });
    }
    if (li.restrictedAudience) {
      push({
        code: 'RESTRICTED_AUDIENCE_LIST_LI',
        scopeKind: 'LINE_ITEM',
        scopeId: li.id,
        severity: 'NEEDS_ATTENTION',
        params: { N: 1 },
      });
    }
    if (li.live && li.someCreativeDisapproved) {
      push({
        code: 'CREATIVE_REJECTED',
        scopeKind: 'LINE_ITEM',
        scopeId: li.id,
        severity: li.allCreativesDisapproved ? 'CRITICAL' : 'NEEDS_ATTENTION',
        params: { N: 1 },
      });
    }
    if (li.live && li.creativeRestricted) {
      push({
        code: 'CREATIVE_RESTRICTED',
        scopeKind: 'LINE_ITEM',
        scopeId: li.id,
        severity: 'NEEDS_ATTENTION',
        params: { N: 1 },
      });
    }
  }
  const liById = new Map(ctx.lis.map((l) => [l.id, l]));
  for (const io of ctx.ios) {
    if (io.live) {
      const kids = io.liIds
        .map((id) => liById.get(id))
        .filter((l): l is LiAlertFacts => !!l && l.live);
      const noSpend =
        kids.length > 0 &&
        kids.every(
          (l) =>
            l.liveTicksToday >= a.noSpendMinTicksIntoDay &&
            l.spendToday <= 0 &&
            (l.spendYesterday <= 0 || l.liveTicksYesterday === 0),
        );
      if (noSpend) {
        push({
          code: 'NO_SPEND_IO',
          scopeKind: 'INSERTION_ORDER',
          scopeId: io.id,
          severity: 'CRITICAL',
          params: { N: 1 },
        });
      }
      if (io.underpacing) {
        push({
          code: 'UNDERPACING_IO',
          scopeKind: 'INSERTION_ORDER',
          scopeId: io.id,
          severity: 'NEEDS_ATTENTION',
          params: { N: 1 },
        });
      }
      if (io.underperforming) {
        push({
          code: 'UNDERPERFORMING_IO',
          scopeKind: 'INSERTION_ORDER',
          scopeId: io.id,
          severity: 'NEEDS_ATTENTION',
          params: { N: 1 },
        });
      }
    }
    if (io.conflicts.length > 0) {
      push({
        code: 'CONFLICT_IO',
        scopeKind: 'INSERTION_ORDER',
        scopeId: io.id,
        severity: 'NEEDS_ATTENTION',
        params: { N: 1, conflicts: io.conflicts.join(',') },
      });
    }
  }
  if (
    ctx.prefs.spendThreshold !== undefined &&
    ctx.advertiserSpendYesterday > ctx.prefs.spendThreshold
  ) {
    push({
      code: 'SPEND_THRESHOLD',
      scopeKind: 'ADVERTISER',
      scopeId: ctx.advertiserId,
      severity: 'NEEDS_ATTENTION',
      params: { amount: ctx.prefs.spendThreshold },
    });
  }
  return out.sort((x, y) => keyOf(x).localeCompare(keyOf(y)));
}

export const keyOf = (a: { code: string; scopeKind: string; scopeId: string }): string =>
  `${a.code}|${a.scopeKind}|${a.scopeId}`;

/**
 * Compare active alerts with the trackers: new conditions raise, and a condition resolves after it
 * has been clear for `resolveAfterClearTicks` consecutive ticks (3.7). Returns decisions and the
 * next tracker map.
 */
export function reconcileAlerts(
  trackers: Record<string, AlertTracker>,
  active: readonly ActiveAlert[],
  tick: number,
  resolveAfter: number,
): { decisions: AlertDecision[]; next: Record<string, AlertTracker> } {
  const decisions: AlertDecision[] = [];
  const next: Record<string, AlertTracker> = {};
  const seen = new Set<string>();
  for (const al of active) {
    const k = keyOf(al);
    seen.add(k);
    const t = trackers[k];
    if (t?.active) {
      next[k] = {
        raisedAtTick: t.raisedAtTick,
        clearTicks: 0,
        active: true,
        severity: al.severity,
        params: al.params,
      };
    } else {
      next[k] = {
        raisedAtTick: tick,
        clearTicks: 0,
        active: true,
        severity: al.severity,
        params: al.params,
      };
      decisions.push({ ...al, action: 'RAISE', raisedAtTick: tick });
    }
  }
  for (const k of Object.keys(trackers).sort()) {
    if (seen.has(k)) continue;
    const t = trackers[k] as AlertTracker;
    if (!t.active) continue;
    const clear = t.clearTicks + 1;
    if (clear >= resolveAfter) {
      const [code, scopeKind, ...rest] = k.split('|');
      decisions.push({
        code: code as AlertCode,
        scopeKind: scopeKind as AlertScopeKind,
        scopeId: rest.join('|'),
        severity: t.severity,
        params: t.params,
        action: 'RESOLVE',
        raisedAtTick: t.raisedAtTick,
        resolvedAtTick: tick,
      });
    } else {
      next[k] = { ...t, clearTicks: clear };
    }
  }
  return { decisions, next };
}
