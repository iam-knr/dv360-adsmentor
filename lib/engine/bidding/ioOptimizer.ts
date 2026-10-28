// IO-level optimisation (engine.md 4.5): the allocation weights that split an insertion order's
// allowance across its line items.

import type { Params } from '../params/schema';

export interface EffStat {
  events: number;
  spend: number;
}

/** Credibility-weighted events per currency unit: (n e + n0 e_io) / (n + n0). */
export function efficiency(stat: EffStat | undefined, io: EffStat, params: Params): number {
  const n0 = params.bidding.ioOptimizer.credibilityEvents;
  const eIo = io.spend > 0 ? io.events / io.spend : 0;
  const n = stat?.events ?? 0;
  const e = stat && stat.spend > 0 ? stat.events / stat.spend : eIo;
  return (n * e + n0 * eIo) / (n + n0);
}

function normalise(w: Record<string, number>, floor: number): Record<string, number> {
  const ids = Object.keys(w).sort();
  let sum = 0;
  for (const id of ids) sum += Math.max(0, w[id] as number);
  const out: Record<string, number> = {};
  if (sum <= 0) {
    for (const id of ids) out[id] = 1 / ids.length;
    return out;
  }
  for (const id of ids) out[id] = Math.max(floor, (w[id] as number) / sum);
  let sum2 = 0;
  for (const id of ids) sum2 += out[id] as number;
  for (const id of ids) out[id] = (out[id] as number) / sum2;
  return out;
}

/** Automate bid and budget at IO level: weights proportional to efficiency^1.5, floor 5%. */
export function automatedWeights(
  liIds: readonly string[],
  effs: Record<string, EffStat>,
  params: Params,
): Record<string, number> {
  const io: EffStat = { events: 0, spend: 0 };
  for (const id of liIds) {
    io.events += effs[id]?.events ?? 0;
    io.spend += effs[id]?.spend ?? 0;
  }
  const raw: Record<string, number> = {};
  for (const id of liIds)
    raw[id] = Math.pow(
      Math.max(efficiency(effs[id], io, params), 1e-12),
      params.bidding.ioOptimizer.exponent,
    );
  if (io.events <= 0) {
    const eq: Record<string, number> = {};
    for (const id of liIds) eq[id] = 1;
    return normalise(eq, 0);
  }
  return normalise(raw, params.bidding.ioOptimizer.minShare);
}

/** Automatic budget allocation at midnight: nudge weights by (eff / avg)^0.5 within 0.8x to 1.25x. */
export function autoAllocateWeights(
  prev: Record<string, number>,
  liIds: readonly string[],
  effs: Record<string, EffStat>,
  params: Params,
): Record<string, number> {
  const io: EffStat = { events: 0, spend: 0 };
  for (const id of liIds) {
    io.events += effs[id]?.events ?? 0;
    io.spend += effs[id]?.spend ?? 0;
  }
  const effAvg = io.spend > 0 ? io.events / io.spend : 0;
  const next: Record<string, number> = {};
  for (const id of liIds) {
    const w = prev[id] ?? 1 / liIds.length;
    const e = efficiency(effs[id], io, params);
    const k = effAvg > 0 ? Math.pow(e / effAvg, 0.5) : 1;
    const step = params.bidding.ioOptimizer.autoAllocateStep;
    next[id] = Math.min((1 + step) * w, Math.max((1 - 0.2) * w, k * w));
  }
  return normalise(next, params.bidding.ioOptimizer.minShare);
}
