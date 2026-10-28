// Frequency model (engine.md 3.9): an exposure histogram per scope, not per user.

import type { FrequencyCap } from '../world';

export type ScopeKind = 'LI' | 'IO' | 'CAMPAIGN';

export interface FreqState {
  /** Reachable user pool of the scope. */
  U: number;
  cap: number;
  windowTicks: number;
  /** Id of the current window on the local tick grid; the histogram resets when it changes. */
  windowId: number;
  /** h[k] = users with k exposures in the window, k = 0..cap (cap absorbing). */
  h: number[];
  /** Lifetime exposure histogram, k = 0..10 (10 absorbing). */
  lifetime: number[];
}

export interface FreqScope {
  kind: ScopeKind;
  key: string;
  cap: number;
  windowTicks: number;
}

const UNIT_TICKS: Record<string, number> = { MINUTE: 1, HOUR: 1, DAY: 24, WEEK: 168, MONTH: 720 };

/** Window length in ticks. Minute and hour caps reset every tick (3.9); month is 30 days. */
export function windowTicksOf(cap: FrequencyCap): number {
  const unit = cap.unit ?? 'DAY';
  const base = UNIT_TICKS[unit] ?? 24;
  const count = Math.max(1, cap.unitCount ?? 1);
  return unit === 'MINUTE' || unit === 'HOUR'
    ? Math.max(1, unit === 'HOUR' ? count : 1)
    : base * count;
}

export function limited(cap: FrequencyCap): boolean {
  return cap.mode === 'LIMITED' && (cap.maxExposures ?? 0) > 0;
}

/** The caps that apply to a line item, in blame order LI, IO, campaign. */
export function scopesFor(
  li: { id: string; frequency: FrequencyCap },
  io: { id: string; frequency: FrequencyCap } | undefined,
  campaign: { id: string; frequency: FrequencyCap } | undefined,
): FreqScope[] {
  const out: FreqScope[] = [];
  const add = (kind: ScopeKind, id: string, cap: FrequencyCap) => {
    if (limited(cap)) {
      out.push({
        kind,
        key: `${kind}:${id}`,
        cap: cap.maxExposures as number,
        windowTicks: windowTicksOf(cap),
      });
    }
  };
  add('LI', li.id, li.frequency);
  if (io) add('IO', io.id, io.frequency);
  if (campaign) add('CAMPAIGN', campaign.id, campaign.frequency);
  return out;
}

export function cappedShare(s: FreqState | undefined): number {
  if (!s || s.U <= 0) return 0;
  return Math.min(1, Math.max(0, (s.h[s.cap] ?? 0) / s.U));
}

/** Exposures the users still below the cap can take in the current window. */
export function remainingCapacity(s: FreqState | undefined): number {
  if (!s) return Infinity;
  let c = 0;
  for (let k = 0; k < s.cap; k++) c += (s.cap - k) * (s.h[k] ?? 0);
  return c;
}

/**
 * Mean number of exposures among the users reached in the current window, for the CTR decay
 * (6.2). Zero when nobody has been reached yet.
 */
export function avgPriorExposures(s: FreqState | undefined): number {
  if (!s || s.U <= 0) return 0;
  let users = 0;
  let exp = 0;
  for (let k = 1; k < s.h.length; k++) {
    const h = s.h[k] ?? 0;
    users += h;
    exp += k * h;
  }
  return users > 1e-9 ? exp / users : 0;
}

export function newFreqState(scope: FreqScope, U: number, localTick: number): FreqState {
  const h = new Array<number>(scope.cap + 1).fill(0);
  h[0] = U;
  const lifetime = new Array<number>(11).fill(0);
  lifetime[0] = U;
  return {
    U,
    cap: scope.cap,
    windowTicks: scope.windowTicks,
    windowId: Math.floor(localTick / scope.windowTicks),
    h,
    lifetime,
  };
}

/** Keep the pool and window current; scale histograms when the pool changes size. */
export function refreshFreqState(
  s: FreqState,
  scope: FreqScope,
  U: number,
  localTick: number,
): FreqState {
  let next = s;
  if (s.cap !== scope.cap || s.windowTicks !== scope.windowTicks) {
    const fresh = newFreqState(scope, U, localTick);
    fresh.lifetime = s.lifetime.map((v) => (s.U > 0 ? (v * U) / s.U : 0));
    return fresh;
  }
  const windowId = Math.floor(localTick / scope.windowTicks);
  if (windowId !== s.windowId) {
    const h = new Array<number>(scope.cap + 1).fill(0);
    h[0] = U;
    next = { ...s, windowId, h };
  }
  if (U > 0 && Math.abs(U - next.U) > 1e-9 * Math.max(1, next.U)) {
    const k = next.U > 0 ? U / next.U : 1;
    next = { ...next, U, h: next.h.map((v) => v * k), lifetime: next.lifetime.map((v) => v * k) };
  }
  return next;
}

function spread(h: number[], top: number, e: number): number[] {
  const m = Math.floor(e);
  const frac = e - m;
  const out = new Array<number>(h.length).fill(0);
  for (let k = 0; k < h.length; k++) {
    const users = h[k] ?? 0;
    if (users === 0) continue;
    if (k >= top) {
      out[top] = (out[top] ?? 0) + users;
      continue;
    }
    const a = Math.min(top, k + m);
    const b = Math.min(top, k + m + 1);
    out[a] = (out[a] ?? 0) + users * (1 - frac);
    out[b] = (out[b] ?? 0) + users * frac;
  }
  return out;
}

/** Move users between bins after `wins` exposures in the scope this tick. */
export function applyWins(s: FreqState, wins: number): FreqState {
  if (wins <= 0 || s.U <= 0) return s;
  const below = s.U - (s.h[s.cap] ?? 0);
  let h = s.h;
  if (below > 1e-9) h = spread(s.h, s.cap, wins / below);
  const lifetime = spread(s.lifetime, 10, wins / s.U);
  return { ...s, h, lifetime };
}

/** Users with at least one lifetime exposure. */
export function lifetimeReached(s: FreqState): number {
  return Math.max(0, s.U - (s.lifetime[0] ?? 0));
}

/** Share of requests that come from users with no exposure in the window (new users). */
export function newUserShare(s: FreqState | undefined): number {
  if (!s || s.U <= 0) return 1;
  return Math.min(1, Math.max(0, (s.lifetime[0] ?? 0) / s.U));
}
