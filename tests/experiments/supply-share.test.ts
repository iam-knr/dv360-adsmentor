// Arm supply share in the engine funnel (engine 6.7, module 17 5): an entity in an active test sees only its share of
// the requests; entities outside a test are unchanged (no `supplyShare`).
import { describe, expect, it } from 'vitest';
import { smallWorld } from '@/lib/engine/testing/fixtures';
import { funnelTotals, runTicks } from '../engine/helpers';

const total = (m: Map<string, number>): number => [...m.values()].reduce((a, b) => a + b, 0);

describe('supplyShare', () => {
  const plain = runTicks(smallWorld(), 0, 24).outputs;
  const half = runTicks(smallWorld({ li: { supplyShare: 0.5 } }), 0, 24).outputs;
  const same = runTicks(smallWorld({ li: { supplyShare: 1 } }), 0, 24).outputs;

  it('a share of 1 or no share changes nothing', () => {
    expect(total(funnelTotals(same))).toBe(total(funnelTotals(plain)));
  });
  it('half the share gives about half the available requests', () => {
    const a = total(funnelTotals(plain));
    const b = total(funnelTotals(half));
    expect(a).toBeGreaterThan(0);
    expect(b / a).toBeGreaterThan(0.45);
    expect(b / a).toBeLessThan(0.55);
  });
  it('funnel counts stay integers', () => {
    for (const n of funnelTotals(half).values()) expect(Number.isInteger(n)).toBe(true);
  });
});
