import { Rng } from './xoshiro';

/** `rng(seed, ...path)` hashes `seed + path.join('/')` (engine.md 1.3). */
export const rng = (seed: string, ...path: (string | number)[]): Rng =>
  new Rng(`${seed}/${path.join('/')}`);

/** One standard normal draw from its own stream. */
export const hashNormal = (seed: string, ...path: (string | number)[]): number =>
  rng(seed, ...path).normal();

/** One uniform draw from its own stream. */
export const hashUniform = (seed: string, ...path: (string | number)[]): number =>
  rng(seed, ...path).next();
