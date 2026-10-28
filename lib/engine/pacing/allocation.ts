// Allocation of an insertion order's allowance across its line items (engine.md 7.5, 4.5).

/**
 * Water-filling: every line item gets its weighted share of `total`, never more than its capacity,
 * and what a capped item cannot take is redistributed to the others. Returns amounts in input order.
 */
export function waterFill(
  total: number,
  weights: readonly number[],
  capacities: readonly number[],
): number[] {
  const n = weights.length;
  const out = new Array<number>(n).fill(0);
  if (n === 0) return out;
  if (!Number.isFinite(total)) {
    for (let i = 0; i < n; i++) out[i] = capacities[i] ?? Infinity;
    return out;
  }
  let remaining = Math.max(0, total);
  let active = weights.map((_, i) => i);
  for (let round = 0; round < n + 1 && remaining > 1e-12 && active.length > 0; round++) {
    let wsum = 0;
    for (const i of active) wsum += Math.max(0, weights[i] ?? 0);
    if (wsum <= 0) break;
    const saturated: number[] = [];
    let used = 0;
    for (const i of active) {
      const share = (Math.max(0, weights[i] ?? 0) / wsum) * remaining;
      const room = (capacities[i] ?? Infinity) - (out[i] ?? 0);
      if (share >= room) {
        out[i] = (out[i] ?? 0) + Math.max(0, room);
        used += Math.max(0, room);
        saturated.push(i);
      }
    }
    if (saturated.length === 0) {
      for (const i of active)
        out[i] = (out[i] ?? 0) + (Math.max(0, weights[i] ?? 0) / wsum) * remaining;
      remaining = 0;
      break;
    }
    remaining -= used;
    active = active.filter((i) => !saturated.includes(i));
  }
  return out;
}
