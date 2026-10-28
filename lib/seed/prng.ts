// Seeded PRNG for the seed generator (data-model 3.1 step 2). Pure, no I/O.
import { createHash } from 'node:crypto';

/** mulberry32: 32-bit state, returns a function that yields floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 32-bit hash of a string. Used to derive child streams and per-day noise. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Stable cuid-shaped id: 'c' plus 24 hex characters of sha256(namespace + key). */
export function stableId(namespace: string, key: string): string {
  return `c${createHash('sha256').update(`${namespace}\u0000${key}`).digest('hex').slice(0, 24)}`;
}

export class Rng {
  private readonly next: () => number;

  constructor(readonly seed: number) {
    this.next = mulberry32(seed);
  }

  /** Independent stream for one section of the plan, so adding rows in one place never shifts another. */
  child(label: string): Rng {
    return new Rng(hashString(`${this.seed}:${label}`));
  }

  float(): number {
    return this.next();
  }

  /** Integer in [min, max], both included. */
  int(min: number, max: number): number {
    if (max < min) throw new RangeError(`Rng.int: max ${max} is below min ${min}`);
    return min + Math.floor(this.next() * (max - min + 1));
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError('Rng.pick: empty list');
    return items[Math.floor(this.next() * items.length)] as T;
  }

  weighted<T>(items: readonly (readonly [T, number])[]): T {
    const total = items.reduce((s, [, w]) => s + w, 0);
    let r = this.next() * total;
    for (const [item, w] of items) {
      r -= w;
      if (r < 0) return item;
    }
    return (items[items.length - 1] as readonly [T, number])[0];
  }

  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
  }

  /** Standard normal by Box-Muller. */
  normal(): number {
    const u = Math.max(this.next(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.next());
  }

  /** Log-normal draw with the given median and sigma (of the log). Budgets and CPMs use this (data-model 3.3). */
  lognormal(median: number, sigma: number): number {
    return median * Math.exp(sigma * this.normal());
  }
}

/** One noise value in [lo, hi] that depends only on the key, never on call order. */
export function keyedNoise(key: string, lo: number, hi: number): number {
  return lo + mulberry32(hashString(key))() * (hi - lo);
}
