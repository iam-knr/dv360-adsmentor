// Solving lambda for "maximize" strategies (engine.md 4.4): bisection on a geometric scale so the
// expected consumption equals the hour's allowance.

export interface LambdaResult {
  lambda: number;
  /** 'hi' when even the highest bids cannot reach the allowance (limited by bid). */
  saturated: 'hi' | 'lo' | null;
}

export function solveLambda(
  spend: (lambda: number) => number,
  target: number,
  hi: number,
  iterations: number,
  lowRatio = 1e-5,
): LambdaResult {
  if (!(hi > 0)) return { lambda: 0, saturated: 'hi' };
  const lo0 = hi * lowRatio;
  if (spend(hi) <= target) return { lambda: hi, saturated: 'hi' };
  if (spend(lo0) >= target) return { lambda: lo0, saturated: 'lo' };
  let lo = Math.log(lo0);
  let up = Math.log(hi);
  for (let i = 0; i < iterations; i++) {
    const mid = (lo + up) / 2;
    if (spend(Math.exp(mid)) < target) lo = mid;
    else up = mid;
  }
  return { lambda: Math.exp((lo + up) / 2), saturated: null };
}
