import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cloneState, newSimState, runTick, runTicks as advance, hashJson, rng } from '@/lib/engine';
import type { SimStateData, TickOutput, World } from '@/lib/engine';
import { determinismWorld } from '@/lib/engine/testing/fixtures';
import {
  computeGolden,
  GOLDEN_TICKS,
  snapshotOf,
  type GoldenSnapshot,
} from '@/lib/engine/testing/goldens';
import { loadParams, params, outputHash } from './helpers';

const seedState = () => newSimState();
const json = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const everything = (o: TickOutput) => [
  o.daily,
  o.hourly,
  o.funnel,
  o.alerts,
  o.recommendations,
  o.liveStatus,
  o.pacing,
  o.reach,
  o.learning,
];

function run(
  world: World,
  ticks: number,
  chunks: number[] = [ticks],
  viaJson = false,
): { outputs: TickOutput[]; state: SimStateData } {
  let state: SimStateData = seedState();
  const outputs: TickOutput[] = [];
  for (const n of chunks) {
    const r = advance(world, viaJson ? json(state) : state, params, n);
    outputs.push(...r.outputs);
    state = r.state;
  }
  expect(outputs.length).toBe(ticks);
  return { outputs, state };
}

const world = determinismWorld();
const base = run(world, GOLDEN_TICKS);

describe('determinism (engine.md 11.1)', () => {
  const baseHash = outputHash(base.outputs, everything);

  it('1. replay: seven sim days twice give identical hashes', () => {
    const again = run(world, GOLDEN_TICKS);
    expect(outputHash(again.outputs, everything)).toBe(baseHash);
    expect(hashJson(again.state)).toBe(hashJson(base.state));
  });

  it('2. chunk independence: 168 ticks as 1 batch, 7 x 24 and 168 x 1 (state through JSON between batches)', () => {
    const chunked = run(world, GOLDEN_TICKS, Array(7).fill(24) as number[], true);
    expect(outputHash(chunked.outputs, everything)).toBe(baseHash);
    expect(hashJson(chunked.state)).toBe(hashJson(base.state));
    const singles = run(world, 36, Array(36).fill(1) as number[], true);
    expect(outputHash(singles.outputs, everything)).toBe(
      outputHash(base.outputs.slice(0, 36), everything),
    );
  });

  it('3. order independence: shuffling the entity arrays changes nothing', () => {
    const reverse = <T>(xs: T[]): T[] => [...xs].reverse();
    const shuffled: World = {
      ...world,
      lineItems: reverse(world.lineItems).map((l) => ({
        ...l,
        creativeIds: reverse(l.creativeIds),
        floodlight: reverse(l.floodlight),
      })),
      insertionOrders: reverse(world.insertionOrders),
      creatives: reverse(world.creatives),
      campaigns: reverse(world.campaigns),
      audiences: reverse(world.audiences),
      floodlightActivities: reverse(world.floodlightActivities),
    };
    const r = run(shuffled, 48);
    expect(outputHash(r.outputs, everything)).toBe(
      outputHash(base.outputs.slice(0, 48), everything),
    );
  });

  it('4. cross-sandbox isolation: running another sandbox first and in between changes nothing', () => {
    const other: World = { ...world, sandboxId: 'sb-2', sandboxSeed: 'sandbox-2' };
    let a: SimStateData = seedState();
    let b: SimStateData = seedState();
    const outA: TickOutput[] = [];
    for (let t = 0; t < 48; t++) {
      const rb = runTick(other, b, params, t);
      b = rb.state;
      const ra = runTick(world, a, params, t);
      a = ra.state;
      outA.push(ra.output);
    }
    expect(outputHash(outA, everything)).toBe(outputHash(base.outputs.slice(0, 48), everything));
    // the second sandbox sees the same market but its own outcome noise
    expect(hashJson(b)).not.toBe(hashJson(a));
  });

  it('5. stream independence: a new consumer of its own stream does not move existing outputs', () => {
    let state: SimStateData = seedState();
    const outputs: TickOutput[] = [];
    for (let t = 0; t < 36; t++) {
      // a hypothetical new module draws from its own streams
      for (let i = 0; i < 25; i++) rng(world.sandboxSeed, 'newThing', t, i).next();
      rng(world.marketSeed, 'newThing', t).normal();
      const r = runTick(world, state, params, t);
      state = r.state;
      outputs.push(r.output);
    }
    expect(outputHash(outputs, everything)).toBe(outputHash(base.outputs.slice(0, 36), everything));
  });

  it('6. idempotent tick: re-running an applied tick returns nothing and leaves the state alone', () => {
    const mid = run(world, 30);
    const before = hashJson(mid.state);
    const again = runTick(world, mid.state, params, 12);
    expect(again.output.applied).toBe(false);
    expect(again.output.daily).toEqual([]);
    expect(again.output.funnel).toEqual([]);
    expect(hashJson(again.state)).toBe(before);
    expect(again.state).toBe(mid.state);
    const last = runTick(world, mid.state, params, 29);
    expect(last.output.applied).toBe(false);
    // the next tick still applies
    expect(runTick(world, mid.state, params, 30).output.applied).toBe(true);
  });

  it('runTick never mutates the state or the world it is given', () => {
    const st = run(world, 20).state;
    const stBefore = hashJson(st);
    const worldBefore = hashJson(world);
    runTick(world, st, params, 20);
    expect(hashJson(st)).toBe(stBefore);
    expect(hashJson(world)).toBe(worldBefore);
    const copy = cloneState(st);
    expect(copy).not.toBe(st);
    expect(hashJson(copy)).toBe(stBefore);
  });

  it('refuses a gap in the tick sequence', () => {
    expect(() => runTick(world, seedState(), params, 5)).toThrow(/in order/);
  });

  it('7. catch-up equals live: 30 ticks one per call equals 30 ticks in one call', () => {
    let state: SimStateData = seedState();
    const one: TickOutput[] = [];
    for (let t = 0; t < 30; t++) {
      const r = runTick(world, json(state), params, t);
      state = r.state;
      one.push(r.output);
    }
    const all = advance(world, seedState(), params, 30);
    expect(outputHash(one, everything)).toBe(outputHash(all.outputs, everything));
    expect(hashJson(state)).toBe(hashJson(all.state));
  });

  it('the state survives a JSON round trip (no Infinity, NaN, Map or undefined)', () => {
    const st = base.state;
    expect(json(st)).toEqual(st);
    expect(JSON.stringify(st)).not.toMatch(/null,|NaN|Infinity/);
  });

  it('every number in the output is finite', () => {
    const bad: string[] = [];
    const walk = (x: unknown, path: string) => {
      if (typeof x === 'number' && !Number.isFinite(x)) bad.push(path);
      else if (x && typeof x === 'object')
        for (const [k, v] of Object.entries(x)) walk(v, `${path}.${k}`);
    };
    for (const o of base.outputs) walk(everything(o), `t${o.tick}`);
    expect(bad.slice(0, 5)).toEqual([]);
  });

  it('a different sandbox seed gives different outcomes, a different market seed a different market', () => {
    const s = run({ ...world, sandboxSeed: 'x' }, 12);
    const m = run({ ...world, marketSeed: 'y' }, 12);
    const first = base.outputs.slice(0, 12);
    expect(outputHash(s.outputs, everything)).not.toBe(outputHash(first, everything));
    expect(outputHash(m.outputs, everything)).not.toBe(outputHash(first, everything));
  });
});

describe('golden (engine.md 11.1 items 1 and 10)', () => {
  const golden = JSON.parse(
    readFileSync(
      resolve(__dirname, '../../lib/engine/testing/goldens/determinism.7d.json'),
      'utf8',
    ),
  ) as GoldenSnapshot;
  const now = snapshotOf(base.outputs, params, base.state);

  it('matches the stored golden for seven sim days (run "npm run engine:golden" after an intended change)', () => {
    expect(now).toEqual(golden);
  });

  it('a parameter change changes the params hash and the golden', () => {
    const patched = computeGolden(loadParams({ supply: { supplyScale: 1.02 } }), 24);
    expect(patched.paramsHash).not.toBe(golden.paramsHash);
    const same = computeGolden(params, 24);
    expect(patched.dailyHash).not.toBe(same.dailyHash);
  });
});
