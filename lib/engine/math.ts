// Small numeric helpers shared by every engine module. Pure, no randomness.

export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);

/** Round half to even (banker's rounding), used once when money is written (engine.md 1.3). */
export function roundHalfEven(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  if (d < 0.5) return f;
  if (d > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}

// erfc with fractional error below 1.2e-7 everywhere (Numerical Recipes, Chebyshev fit).
function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t *
                              (-1.13520398 +
                                t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}

/** Standard normal CDF. */
export const Phi = (x: number): number => 0.5 * erfc(-x / Math.SQRT2);

/**
 * Split `total` (a non-negative integer) into integers following `weights` using the largest
 * remainder method. The result always sums to `total`. Ties go to the lower index so the
 * outcome never depends on anything but the inputs. Weights need not be normalised.
 */
export function largestRemainder(total: number, weights: readonly number[]): number[] {
  const n = weights.length;
  const out = new Array<number>(n).fill(0);
  if (n === 0 || total <= 0) return out;
  let sum = 0;
  for (const w of weights) sum += w > 0 ? w : 0;
  if (sum <= 0) {
    out[n - 1] = total;
    return out;
  }
  const rem: number[] = new Array<number>(n).fill(0);
  let given = 0;
  for (let i = 0; i < n; i++) {
    const w = weights[i] ?? 0;
    const exact = ((w > 0 ? w : 0) / sum) * total;
    const fl = Math.floor(exact + 1e-9);
    out[i] = fl;
    rem[i] = exact - fl;
    given += fl;
  }
  let left = total - given;
  if (left > 0) {
    // hand the remaining units to the largest remainders, lower index first on ties
    const taken = new Uint8Array(n);
    while (left > 0) {
      let best = -1;
      let bestRem = -1;
      for (let i = 0; i < n; i++) {
        if (!taken[i] && (rem[i] as number) > bestRem) {
          bestRem = rem[i] as number;
          best = i;
        }
      }
      if (best < 0) {
        out[n - 1]! += left;
        break;
      }
      taken[best] = 1;
      out[best]! += 1;
      left--;
    }
  } else if (left < 0) {
    // floating error pushed us over; take back from the largest buckets
    for (let i = n - 1; i >= 0 && left < 0; i--) {
      const take = Math.min(out[i] as number, -left);
      out[i]! -= take;
      left += take;
    }
  }
  return out;
}

/** Sum helper that keeps `noUncheckedIndexedAccess` quiet. */
export function sum(xs: readonly number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}

export function sortedKeys<T>(rec: Record<string, T>): string[] {
  return Object.keys(rec).sort();
}

export const byId = <T extends { id: string }>(a: T, b: T): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
