// Golden snapshot of seven sim days on the determinism world (engine.md 11.1 item 1). The numbers
// are regenerated with `npm run engine:golden`; a changed parameter file changes every hash.

import { defaultParams, hashJson, newSimState, runTick } from '../index';
import type { LoadedParams, TickOutput } from '../index';
import { METRIC_KEYS } from '../metrics';
import { determinismWorld } from './fixtures';

export interface GoldenSnapshot {
  paramsHash: string;
  ticks: number;
  dailyHash: string;
  hourlyHash: string;
  funnelHash: string;
  stateHash: string;
  totals: Record<string, number>;
}

export const GOLDEN_TICKS = 168;

export function snapshotOf(
  outputs: TickOutput[],
  loaded: LoadedParams,
  stateJson: unknown,
): GoldenSnapshot {
  const totals: Record<string, number> = {};
  for (const o of outputs) {
    for (const d of o.daily) {
      if (d.sliceKind !== 'total') continue;
      for (const k of METRIC_KEYS) totals[k] = (totals[k] ?? 0) + d.metrics[k];
    }
  }
  const keep = [
    'impressions',
    'clicks',
    'revenue',
    'mediaCost',
    'convTotal',
    'bidRequests',
    'lostTargeting',
    'lostBudget',
    'lostPacing',
    'lostFrequency',
    'lostInternal',
  ];
  return {
    paramsHash: loaded.hash,
    ticks: outputs.length,
    dailyHash: hashJson(outputs.map((o) => o.daily)),
    hourlyHash: hashJson(outputs.map((o) => o.hourly)),
    funnelHash: hashJson(outputs.map((o) => o.funnel)),
    stateHash: hashJson(stateJson),
    totals: Object.fromEntries(keep.map((k) => [k, Math.round((totals[k] ?? 0) * 1e6) / 1e6])),
  };
}

export function computeGolden(
  loaded: LoadedParams = defaultParams(),
  ticks = GOLDEN_TICKS,
): GoldenSnapshot {
  const world = determinismWorld();
  let state = newSimState();
  const outputs: TickOutput[] = [];
  for (let t = 0; t < ticks; t++) {
    const r = runTick(world, state, loaded, t);
    state = r.state;
    outputs.push(r.output);
  }
  return snapshotOf(outputs, loaded, state);
}
