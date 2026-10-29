// Unique reach (non-additive; engine 9.5). Reach for an arbitrary window comes from the negative binomial formula
//   reach(I, U) = U * (1 - (1 + I / (k * U)) ^ -k),  k = 1.5
// with the pool U of the line item inferred from its latest lifetime reach snapshot (the engine writes one per day),
// or a plain estimate when none exists. Parents use the union rule of engine 9.5.
export const NB_SHAPE = 1.5;

export function nbReach(impressions: number, pool: number): number {
  if (impressions <= 0 || pool <= 0) return 0;
  const r = pool * (1 - Math.pow(1 + impressions / (NB_SHAPE * pool), -NB_SHAPE));
  return Math.min(r, impressions, pool);
}

/** Invert nbReach: the pool for which `impressions` give `reach`. Bisection; monotonic in the pool. */
export function poolFromSnapshot(impressions: number, reach: number): number | null {
  if (impressions <= 0 || reach <= 0 || reach >= impressions) return null;
  let lo = reach;
  let hi = Math.max(reach * 2, impressions * 4);
  if (nbReach(impressions, hi) < reach) return hi;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (nbReach(impressions, mid) < reach) lo = mid;
    else hi = mid;
  }
  return Math.round((lo + hi) / 2);
}

/** Default pool when a line item has no snapshot yet: mean exposure around 2 over its lifetime. */
export function defaultPool(lifetimeImpressions: number): number {
  return Math.max(1000, Math.round(lifetimeImpressions / 2));
}

export interface LiExposure {
  pool: number;
  exposures: number;
}

/** Union of several line items' reach: U_parent * (1 - prod(1 - r_i / U_i)), U_parent = 1.15 * max(U_i). */
export function unionReach(items: LiExposure[]): number {
  const live = items.filter((i) => i.exposures > 0);
  if (live.length === 0) return 0;
  if (live.length === 1)
    return nbReach((live[0] as LiExposure).exposures, (live[0] as LiExposure).pool);
  const parentPool = 1.15 * Math.max(...live.map((i) => i.pool));
  const miss = live.reduce((p, i) => p * (1 - nbReach(i.exposures, i.pool) / i.pool), 1);
  const totalExposures = live.reduce((a, i) => a + i.exposures, 0);
  return Math.min(parentPool * (1 - miss), totalExposures);
}
