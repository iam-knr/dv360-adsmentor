import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { Rng, hashString, keyedNoise, mulberry32, stableId } from '@/lib/seed/prng';

describe('mulberry32', () => {
  it('gives the same sequence for the same seed', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('is pinned to known values (a change here changes every seeded world)', () => {
    const r = mulberry32(1);
    expect([r(), r(), r()].map((x) => Math.round(x * 1e6))).toEqual([627_074, 2_736, 527_447]);
  });

  it('differs between seeds and stays in [0, 1)', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
    const r = mulberry32(99);
    for (let i = 0; i < 1000; i++) {
      const x = r();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe('Rng', () => {
  it('int is inclusive on both ends and rejects an inverted range', () => {
    const rng = new Rng(5);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(rng.int(3, 6));
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
    expect(() => rng.int(5, 4)).toThrow(RangeError);
  });

  it('child streams are independent of how much the parent has drawn', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 17; i++) b.float();
    expect(a.child('x').float()).toBe(b.child('x').float());
    expect(a.child('x').float()).not.toBe(a.child('y').float());
  });

  it('shuffle keeps the items and is deterministic', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const s1 = new Rng(3).shuffle(items);
    const s2 = new Rng(3).shuffle(items);
    expect(s1).toEqual(s2);
    expect([...s1].sort()).toEqual(items);
  });

  it('weighted respects zero weights', () => {
    const rng = new Rng(8);
    for (let i = 0; i < 200; i++)
      expect(
        rng.weighted([
          ['a', 0],
          ['b', 1],
        ] as const),
      ).toBe('b');
  });

  it('lognormal centres on the median', () => {
    const rng = new Rng(11);
    const xs = Array.from({ length: 4000 }, () => rng.lognormal(100, 0.3)).sort((a, b) => a - b);
    expect(xs[2000]).toBeGreaterThan(90);
    expect(xs[2000]).toBeLessThan(110);
  });

  it('pick throws on an empty list', () => {
    expect(() => new Rng(1).pick([])).toThrow(RangeError);
  });
});

describe('ids and noise', () => {
  it('stableId is cuid shaped, stable and namespaced', () => {
    expect(stableId('a', 'k')).toMatch(/^c[0-9a-f]{24}$/);
    expect(stableId('a', 'k')).toBe(stableId('a', 'k'));
    expect(stableId('a', 'k')).not.toBe(stableId('b', 'k'));
  });

  it('keyedNoise depends only on its key', () => {
    expect(keyedNoise('k', 0.9, 1.1)).toBe(keyedNoise('k', 0.9, 1.1));
    fc.assert(
      fc.property(fc.string(), (key) => {
        const x = keyedNoise(key, 0.5, 1.5);
        return x >= 0.5 && x <= 1.5;
      }),
    );
    expect(hashString('a')).not.toBe(hashString('b'));
  });
});
