// How an allowance becomes funnel counts (engine.md 7.4).

export interface CapEntry {
  /** Amount still spendable this hour under this limit, in consumption units. */
  amount: number;
  code: string;
}

export interface ThrottleInput {
  /** Expected consumption at r = 1 for the survivors, in consumption units. */
  sFull: number;
  budgetCaps: CapEntry[];
  paceCaps: CapEntry[];
  /** Cap on the realised consumption (overshoot clip). */
  overshootMax: number;
}

export interface ThrottleResult {
  rBudget: number;
  rPace: number;
  /** Combined fraction of survivors that bid. */
  r: number;
  budgetCode: string;
  paceCode: string;
  /** Smallest budget cap (hard limit). */
  budgetRemaining: number;
  /** Smallest pace cap. */
  allowance: number;
  /** Realised consumption must not exceed this (7.4: overshootMax times the binding amount, never past the budget). */
  spendCap: number;
}

function minEntry(xs: CapEntry[], fallbackCode: string): { amount: number; code: string } {
  let best = { amount: Infinity, code: fallbackCode };
  for (const x of xs) if (x.amount < best.amount) best = { amount: x.amount, code: x.code };
  return best;
}

export function throttle(i: ThrottleInput): ThrottleResult {
  const b = minEntry(i.budgetCaps, 'B.LINE_ITEM_BUDGET');
  const p = minEntry(i.paceCaps, 'P.LINE_ITEM_PACING');
  const s = Math.max(i.sFull, 1e-12);
  const budgetRemaining = Math.max(0, b.amount);
  const allowance = Math.max(0, p.amount);
  const rBudget = Math.min(1, budgetRemaining / s);
  const rPace = Math.min(1, allowance / s);
  const spendCap = Math.min(budgetRemaining, i.overshootMax * Math.min(allowance, budgetRemaining));
  return {
    rBudget,
    rPace,
    r: Math.min(rBudget, rPace),
    budgetCode: b.code,
    paceCode: p.code,
    budgetRemaining,
    allowance,
    spendCap,
  };
}
