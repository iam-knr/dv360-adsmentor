import { describe, expect, it } from 'vitest';
import { rng } from '@/lib/engine/rng/streams';
import { Rng, cyrb128 } from '@/lib/engine/rng/xoshiro';
import { betaMean, binomial, lognormal, multinomial, poisson } from '@/lib/engine/rng/sample';

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const variance = (xs: number[]) => {
  const m = mean(xs);
  return xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length;
};

describe('rng streams', () => {
  it('is deterministic for the same key', () => {
    const a = rng('seed', 'supply', 5, 'cell');
    const b = rng('seed', 'supply', 5, 'cell');
    for (let i = 0; i < 20; i++) expect(a.next()).toBe(b.next());
  });

  it('gives independent streams for different paths', () => {
    const a = Array.from({ length: 5 }, () => rng('seed', 'a').next());
    const b = rng('seed', 'b');
    expect(a.every((x) => x === a[0])).toBe(true);
    expect(b.next()).not.toBe(a[0]);
  });

  it('fork does not depend on how many numbers were drawn', () => {
    const base = rng('s', 'x');
    const f1 = base.fork('y').next();
    for (let i = 0; i < 100; i++) base.next();
    expect(base.fork('y').next()).toBe(f1);
  });

  it('cyrb128 returns four unsigned 32-bit words', () => {
    const h = cyrb128('hello');
    expect(h).toHaveLength(4);
    for (const w of h) {
      expect(Number.isInteger(w)).toBe(true);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThan(2 ** 32);
    }
    expect(cyrb128('hello')).toEqual(h);
    expect(cyrb128('hellp')).not.toEqual(h);
  });

  it('uniform draws are in [0,1) with mean near 0.5', () => {
    const r = new Rng('uniform');
    const xs = Array.from({ length: 20000 }, () => r.next());
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    expect(mean(xs)).toBeCloseTo(0.5, 1);
  });

  it('normal draws have mean 0 and variance 1', () => {
    const r = new Rng('normal');
    const xs = Array.from({ length: 30000 }, () => r.normal());
    expect(mean(xs)).toBeCloseTo(0, 1);
    expect(variance(xs)).toBeCloseTo(1, 1);
  });
});

describe('samplers', () => {
  it('binomial matches its mean in the exact, poisson and normal regimes', () => {
    for (const [n, p] of [
      [30, 0.3],
      [100000, 0.00005],
      [1000000, 0.4],
    ] as const) {
      const r = new Rng(`bin-${n}-${p}`);
      const xs = Array.from({ length: 4000 }, () => binomial(r, n, p));
      expect(mean(xs) / (n * p)).toBeGreaterThan(0.97);
      expect(mean(xs) / (n * p)).toBeLessThan(1.03);
      for (const x of xs) {
        expect(Number.isInteger(x)).toBe(true);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(n);
      }
    }
  });

  it('binomial handles the edges', () => {
    const r = new Rng('edges');
    expect(binomial(r, 0, 0.5)).toBe(0);
    expect(binomial(r, 10, 0)).toBe(0);
    expect(binomial(r, 10, 1)).toBe(10);
    expect(binomial(r, 1000, 1)).toBe(1000);
  });

  it('poisson matches its mean', () => {
    const r = new Rng('poisson');
    const xs = Array.from({ length: 6000 }, () => poisson(r, 4));
    expect(mean(xs)).toBeCloseTo(4, 0);
  });

  it('lognormal has the requested median', () => {
    const r = new Rng('ln');
    const xs = Array.from({ length: 6001 }, () => lognormal(r, 65, 0.45)).sort((a, b) => a - b);
    expect(xs[3000]).toBeGreaterThan(60);
    expect(xs[3000]).toBeLessThan(70);
  });

  it('beta has the requested mean and stays in (0,1)', () => {
    const r = new Rng('beta');
    const xs = Array.from({ length: 6000 }, () => betaMean(r, 0.52, 12));
    expect(mean(xs)).toBeCloseTo(0.52, 1);
    expect(Math.min(...xs)).toBeGreaterThan(0);
    expect(Math.max(...xs)).toBeLessThan(1);
  });

  it('multinomial never exceeds n and follows the weights', () => {
    const r = new Rng('multi');
    const out = multinomial(r, 100000, [0.5, 0.3, 0.1]);
    expect(out.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(100000);
    expect(out[0]! / 100000).toBeGreaterThan(0.48);
    expect(out[0]! / 100000).toBeLessThan(0.52);
    expect(out[2]! / 100000).toBeGreaterThan(0.09);
  });
});
