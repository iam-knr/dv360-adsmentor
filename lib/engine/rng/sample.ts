import { clamp } from '../math';
import type { Rng } from './xoshiro';

/**
 * Poisson by inversion; only called with small means (below 30).
 */
export function poisson(r: Rng, mean: number): number {
  if (mean <= 0) return 0;
  if (mean > 30) return Math.max(0, Math.round(mean + Math.sqrt(mean) * r.normal()));
  const limit = Math.exp(-mean);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= r.next();
  } while (p > limit);
  return k - 1;
}

/**
 * Binomial(n, p). Exact Bernoulli sum up to n = 50, normal approximation above (engine.md 1.1).
 * Rare events (n*p or n*(1-p) below 10) use a Poisson draw instead; the normal approximation
 * is poor there and would bias small conversion counts.
 */
export function binomial(r: Rng, n: number, p: number): number {
  if (n <= 0 || p <= 0) return 0;
  if (p >= 1) return n;
  if (n <= 50) {
    let k = 0;
    for (let i = 0; i < n; i++) if (r.next() < p) k++;
    return k;
  }
  const np = n * p;
  const nq = n * (1 - p);
  if (np < 10) return Math.min(n, poisson(r, np));
  if (nq < 10) return Math.max(0, n - poisson(r, nq));
  const x = Math.round(np + Math.sqrt(np * (1 - p)) * r.normal());
  return clamp(x, 0, n);
}

export function lognormal(r: Rng, median: number, sigma: number): number {
  return median * Math.exp(sigma * r.normal());
}

function gamma(r: Rng, shape: number): number {
  if (shape < 1) return gamma(r, shape + 1) * Math.pow(r.nextOpen(), 1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = r.normal();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = r.nextOpen();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** Beta with the given mean and concentration kappa (alpha = mean*kappa, beta = (1-mean)*kappa). */
export function betaMean(r: Rng, mean: number, kappa: number): number {
  const m = clamp(mean, 0.001, 0.999);
  const a = gamma(r, m * kappa);
  const b = gamma(r, (1 - m) * kappa);
  return a / (a + b);
}

/** Sequential-binomial multinomial; probabilities need not sum to one (the remainder is dropped). */
export function multinomial(r: Rng, n: number, probs: readonly number[]): number[] {
  const out = new Array<number>(probs.length).fill(0);
  let left = n;
  let rest = 1;
  for (let i = 0; i < probs.length && left > 0 && rest > 1e-12; i++) {
    const p = clamp((probs[i] ?? 0) / rest, 0, 1);
    const k = binomial(r, left, p);
    out[i] = k;
    left -= k;
    rest -= probs[i] ?? 0;
  }
  return out;
}
