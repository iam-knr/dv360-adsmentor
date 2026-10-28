// Reach formulas (engine.md 9.5): negative-binomial reach from impressions and a pool, and the
// union of overlapping pools.

/** reach(I, U) = U * (1 - (1 + I / (k U)) ^ -k), capped by the pool. */
export function reachFromImpressions(impressions: number, pool: number, k = 1.5): number {
  if (impressions <= 0 || pool <= 0) return 0;
  const r = pool * (1 - Math.pow(1 + impressions / (k * pool), -k));
  return Math.min(r, pool, impressions);
}

/** reach_parent = U_parent * (1 - prod(1 - r_i / U_i)) with U_parent = 1.15 * max U_i (9.5). */
export function unionReach(children: readonly { reach: number; pool: number }[]): {
  reach: number;
  pool: number;
} {
  if (children.length === 0) return { reach: 0, pool: 0 };
  const pool = 1.15 * Math.max(...children.map((c) => c.pool));
  let miss = 1;
  for (const c of children) miss *= 1 - (c.pool > 0 ? Math.min(1, c.reach / c.pool) : 0);
  return { reach: Math.min(pool, pool * (1 - miss)), pool };
}
