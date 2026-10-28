// Run several consecutive ticks (catch-up after downtime, fast-forward). The result is the same as
// calling runTick one tick at a time: chunking never changes the numbers (engine.md 11.1).

import type { LoadedParams } from './params/load';
import type { TickOutput } from './output';
import type { SimStateData } from './state';
import { runTick } from './tick';
import type { World } from './world';

export function runTicks(
  world: World,
  state: SimStateData,
  loaded: LoadedParams,
  count: number,
): { outputs: TickOutput[]; state: SimStateData } {
  const outputs: TickOutput[] = [];
  let s = state;
  for (let i = 0; i < count; i++) {
    const r = runTick(world, s, loaded, s.nextTick);
    outputs.push(r.output);
    s = r.state;
  }
  return { outputs, state: s };
}
