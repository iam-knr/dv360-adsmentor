// Cross-media arithmetic (module 04 AC-04-25): unique reach = rD + rT - overlap, within [max(rD, rT), min(1, rD + rT)].
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { crossMediaMath, overlapOf, unionReach } from '@/lib/planning/cross-media';

describe('cross-media math', () => {
  it('union of independent reaches', () => {
    expect(unionReach([])).toBe(0);
    expect(unionReach([0.5, 0.5])).toBeCloseTo(0.75);
    expect(unionReach([2, -1])).toBe(1);
  });

  it('overlap never exceeds the smaller reach', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (a, b) => {
          const o = overlapOf(a, b);
          expect(o).toBeGreaterThanOrEqual(0);
          expect(o).toBeLessThanOrEqual(Math.min(a, b) + 1e-12);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('unique reach is rD + rT - overlap and stays inside its bounds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5_000_000 }),
        fc.double({ min: 0, max: 95, noNaN: true }),
        fc.double({ min: 0, max: 1500, noNaN: true }),
        (impr, tvReach, grps) => {
          const m = crossMediaMath({
            population: 3_680_000,
            digital: [{ impressions: impr }],
            tv: [{ reachPct: tvReach, grps, impressions: 1000 }],
          });
          const rD = m.digital.reachPct;
          const rT = m.tv.reachPct;
          const u = m.combined.uniqueReachPct;
          expect(u).toBeGreaterThanOrEqual(Math.max(rD, rT) - 0.02);
          expect(u).toBeLessThanOrEqual(Math.min(100, rD + rT) + 0.02);
          expect(Math.abs(u - (rD + rT - m.combined.overlapPct))).toBeLessThanOrEqual(0.03);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('sub-location scale shrinks people counts only', () => {
    const input = {
      population: 1_000_000,
      digital: [{ impressions: 400_000 }],
      tv: [{ reachPct: 40, grps: 120, impressions: 500_000 }],
    };
    const nat = crossMediaMath(input);
    const sub = crossMediaMath({ ...input, scale: 0.25 });
    expect(sub.digital.reachPct).toBe(nat.digital.reachPct);
    expect(sub.digital.reach).toBe(Math.round(nat.digital.reach * 0.25));
  });
});
