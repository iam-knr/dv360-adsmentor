import { defaultParams, hashJson, loadParams, newSimState, runTick } from '@/lib/engine';
import type { LoadedParams, SimStateData, TickOutput, World } from '@/lib/engine';
import { emptyMetrics, METRIC_KEYS, type Metrics } from '@/lib/engine/metrics';
import fc from 'fast-check';
import { it } from 'vitest';

export const params: LoadedParams = defaultParams();

export function runTicks(
  world: World,
  from: number,
  to: number,
  opts: { state?: SimStateData; loaded?: LoadedParams } = {},
): { outputs: TickOutput[]; state: SimStateData } {
  let state = opts.state ?? { ...newSimState(), nextTick: from };
  const outputs: TickOutput[] = [];
  for (let t = from; t < to; t++) {
    const r = runTick(world, state, opts.loaded ?? params, t);
    state = r.state;
    outputs.push(r.output);
  }
  return { outputs, state };
}

/** Sum of a metrics column over daily rows of one slice kind (default the day total). */
export function sumDaily(outputs: TickOutput[], liId?: string, kind = 'total'): Metrics {
  const m = emptyMetrics();
  for (const o of outputs) {
    for (const d of o.daily) {
      if (d.sliceKind !== kind || (liId && d.lineItemId !== liId)) continue;
      for (const k of METRIC_KEYS) m[k] += d.metrics[k];
    }
  }
  return m;
}

export function funnelTotals(outputs: TickOutput[], liId?: string): Map<string, number> {
  const t = new Map<string, number>();
  for (const o of outputs) {
    for (const r of o.funnel) {
      if (liId && r.lineItemId !== liId) continue;
      t.set(r.reasonCode, (t.get(r.reasonCode) ?? 0) + r.count);
    }
  }
  return t;
}

/** Hash of everything the io layer would persist for the given ticks. */
export function outputHash(
  outputs: TickOutput[],
  pick: (o: TickOutput) => unknown = (o) => o.daily,
): string {
  return hashJson(outputs.map(pick));
}

export { loadParams };

/** Property test runner: 200 runs, fixed seed per property, seed logged (engine.md 11.2). */
export function property<T extends unknown[]>(
  name: string,
  arbs: { [K in keyof T]: fc.Arbitrary<T[K]> },
  predicate: (...args: T) => void,
  opts: { runs?: number; seed?: number } = {},
): void {
  const seed = opts.seed ?? hashSeed(name);
  it(name, () => {
    console.log(`[fast-check] ${name} seed=${seed}`);
    fc.assert(
      fc.property(...(arbs as [fc.Arbitrary<unknown>]), predicate as (...a: unknown[]) => void),
      {
        numRuns: opts.runs ?? 200,
        seed,
      },
    );
  });
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

import { tickToLocal } from '@/lib/engine/calendar';
import { runFunnel } from '@/lib/engine/eligibility/funnel';
import { supplyCells } from '@/lib/engine/supply/cells';
import { formatsForType } from '@/lib/engine/types';
import { indexWorld } from '@/lib/engine/world';

/** Eligibility for one line item of a world at a tick, with no frequency state. */
export function funnelFor(world: World, liId: string, tick = 12) {
  const idx = indexWorld(world);
  const li = idx.lis.get(liId)!;
  const io = idx.ios.get(li.ioId);
  const cells = supplyCells(
    {
      country: world.country,
      marketSeed: world.marketSeed,
      simStartMs: world.simStartMs,
      tzOffsetMin: world.tzOffsetMin,
    },
    params.params,
    params.hash,
    tick,
    formatsForType(li.type),
    world.partner.enabledExchanges,
  );
  return {
    li,
    io,
    elig: runFunnel({
      li,
      io,
      campaign: io ? idx.campaigns.get(io.campaignId) : undefined,
      advertiser: world.advertiser,
      index: idx,
      params: params.params,
      tick,
      advLocal: tickToLocal(world.simStartMs, world.advertiser.tzOffsetMin, tick),
      cells: cells.filter((c) => c.requests > 0),
      freq: {},
      reach: undefined,
      liveTicks: 1000,
      poolScale: 1,
    }),
    idx,
  };
}
