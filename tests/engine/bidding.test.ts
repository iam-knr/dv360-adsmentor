import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  advanceLearning,
  automatedWeights,
  autoAllocateWeights,
  efficiency,
  exitEventsFor,
  FIXED_STRATEGY,
  learningSpendCap,
  newLearning,
  planBids,
  qualityFromEvents,
  signatureOf,
  STRATEGIES,
  strategyFor,
  type PlanInput,
} from '@/lib/engine/bidding';
import { solveLambda } from '@/lib/engine/bidding/lambda';
import { cpmWeight, targetToBidScale } from '@/lib/engine/bidding/strategies';
import { estimateRates } from '@/lib/engine/bidding/valueModel';
import { consumptionLinear, fxToCurrency, resolveFees } from '@/lib/engine/economics';
import { smallWorld, purchase } from '@/lib/engine/testing/fixtures';
import type { BidGoal } from '@/lib/engine/types';
import type { LineItemEntity } from '@/lib/engine/world';
import { funnelFor, params, property } from './helpers';

const P = params.params;

function planFor(over: Partial<LineItemEntity>, extra: Partial<PlanInput> = {}, worldOver = {}) {
  const world = smallWorld({
    li: over,
    targeting: {
      exchanges: ['google_ad_manager', 'openx'],
      geo: { includeRegions: ['IN-MH', 'IN-DL'] },
    },
    ...worldOver,
  });
  const { li, io, elig, idx } = funnelFor(world, 'li1');
  const fees = resolveFees({
    li,
    io,
    params: P,
    currency: 'INR',
    audiences: idx.audiences,
    creatives: idx.creatives,
  });
  const cons = consumptionLinear('CURRENCY', fees);
  const strategy = strategyFor(li.bid.goal, li.bid.kind === 'FIXED');
  const input: PlanInput = {
    li,
    strategy,
    elig,
    params: P,
    tick: 12,
    sandboxSeed: 'sandbox-1',
    fees,
    cons,
    fxToAdv: fxToCurrency(P, 'INR'),
    activities: li.floodlight.map(() => purchase),
    learning: { ...newLearning(0, P), phase: 'STABLE', q: 1 },
    prevLambda: undefined,
    allowance: 1e9,
    reach: undefined,
    ...extra,
  };
  return { plan: planBids(input), input, elig };
}

describe('strategy table (engine.md 4.2)', () => {
  it('covers every bid goal of the data model plus fixed', () => {
    const goals: BidGoal[] = [
      'MAX_CLICKS',
      'MAX_CONVERSIONS',
      'MAX_CONVERSION_VALUE',
      'MAX_VIEWABLE_IMPRESSIONS',
      'MAX_VIEWABLE_10S',
      'MAX_COMPLETED_IN_VIEW_AUDIBLE',
      'MAX_REACH',
      'MAX_CUSTOM_VALUE_COST',
      'MAX_CPV',
      'TARGET_CPM',
      'TARGET_CPV',
      'TARGET_CPC',
      'TARGET_CPA',
      'TARGET_ROAS',
      'TARGET_CUSTOM_VALUE_COST',
      'TARGET_VIEWABLE_IMPRESSIONS',
    ];
    for (const g of goals) expect(STRATEGIES[g], g).toBeDefined();
    expect(Object.keys(STRATEGIES)).toHaveLength(goals.length);
    expect(strategyFor(undefined, false)).toBe(FIXED_STRATEGY);
    expect(strategyFor('MAX_CLICKS', true)).toBe(FIXED_STRATEGY);
  });

  it('maximize strategies use lambda and target strategies use a user target', () => {
    for (const g of [
      'MAX_CLICKS',
      'MAX_CONVERSIONS',
      'MAX_REACH',
      'MAX_VIEWABLE_IMPRESSIONS',
    ] as const)
      expect(STRATEGIES[g].kind).toBe('maximize');
    for (const g of ['TARGET_CPA', 'TARGET_CPC', 'TARGET_CPM', 'TARGET_ROAS'] as const)
      expect(STRATEGIES[g].kind).toBe('target');
  });

  it('flags the goals mapped to the nearest implemented goal (no custom bidding)', () => {
    expect(STRATEGIES.MAX_CUSTOM_VALUE_COST.mappedFrom).toBe('MAX_CUSTOM_VALUE_COST');
    expect(STRATEGIES.TARGET_CUSTOM_VALUE_COST.mappedFrom).toBe('TARGET_CUSTOM_VALUE_COST');
    expect(STRATEGIES.MAX_CLICKS.mappedFrom).toBeUndefined();
  });

  it('weights TARGET_CPM around the mean and converts ROAS targets', () => {
    expect(cpmWeight(1, 1)).toBe(1);
    expect(cpmWeight(5, 1)).toBe(1.4);
    expect(cpmWeight(0.1, 1)).toBe(0.6);
    expect(cpmWeight(1, 0)).toBe(1);
    expect(targetToBidScale('TARGET_ROAS', 400)).toBeCloseTo(0.25, 9);
    expect(targetToBidScale('TARGET_CPA', 400)).toBe(400);
  });
});

describe('fixed bids', () => {
  it('bid the fixed CPM on every cell that has requests and nothing elsewhere', () => {
    const { plan, elig } = planFor({ bid: { kind: 'FIXED', fixedCpm: 70 } });
    elig.cells.forEach((c, i) => expect(plan.bids[i]).toBe(c.nSurv > 0 ? 70 : 0));
    expect(plan.lambda).toBe(0);
    expect(plan.q).toBe(1);
    expect(plan.sFull).toBeGreaterThan(0);
  });

  it('expected consumption rises with the bid', () => {
    let prev = -1;
    for (const b of [10, 30, 60, 100, 200]) {
      const { plan } = planFor({ bid: { kind: 'FIXED', fixedCpm: b } });
      expect(plan.sFull).toBeGreaterThanOrEqual(prev);
      prev = plan.sFull;
    }
  });

  it('clamps to four times the clearing median', () => {
    const { plan, elig } = planFor({ bid: { kind: 'FIXED', fixedCpm: 1e6 } });
    elig.cells.forEach((c, i) => {
      if (c.nSurv > 0) expect(plan.bids[i]).toBeCloseTo(4 * Math.exp(c.cell.external.mu), 6);
    });
  });
});

describe('maximize strategies solve lambda for the allowance (engine.md 4.4)', () => {
  const mk = (allowance: number, extra: Partial<PlanInput> = {}) =>
    planFor({ bid: { kind: 'AUTOMATED', goal: 'MAX_CLICKS' } }, { allowance, ...extra });

  it('hits an allowance inside the feasible range within a few percent', () => {
    const wide = mk(1e9).plan.sFull;
    for (const frac of [0.05, 0.2, 0.5]) {
      const target = wide * frac;
      const { plan } = mk(target);
      expect(plan.saturated).toBeNull();
      expect(plan.sFull / target).toBeGreaterThan(0.97);
      expect(plan.sFull / target).toBeLessThan(1.03);
    }
  });

  it('saturates when the allowance exceeds what the bid cap can spend', () => {
    const { plan } = mk(1e15);
    expect(plan.saturated).toBe('hi');
  });

  it('bids more when the allowance is larger', () => {
    const lo = mk(2_000).plan;
    const hi = mk(20_000).plan;
    expect(hi.lambda).toBeGreaterThan(lo.lambda);
    const avg = (p: typeof lo) => p.bids.filter((b) => b > 0).reduce((a, b) => a + b, 0);
    expect(avg(hi)).toBeGreaterThan(avg(lo));
  });

  it('bids more on cells with a higher click rate', () => {
    const { plan, elig } = mk(10_000);
    const entries = elig.cells
      .map((c, i) => ({ c, b: plan.bids[i] as number }))
      .filter((x) => x.b > 0);
    const app = entries.filter(
      (x) =>
        x.c.cell.environment === 'app' &&
        x.c.cell.device === 'smartphone' &&
        x.c.cell.exchangeId === 'google_ad_manager',
    );
    const web = entries.filter(
      (x) =>
        x.c.cell.environment === 'web' &&
        x.c.cell.device === 'computer' &&
        x.c.cell.exchangeId === 'google_ad_manager',
    );
    const mean = (xs: typeof app) =>
      xs.reduce((a, x) => a + x.b / Math.exp(x.c.cell.external.mu), 0) / xs.length;
    expect(mean(app)).toBeGreaterThan(mean(web));
  });

  it('damps lambda while learning', () => {
    const base = mk(10_000, { learning: { ...newLearning(0, P), phase: 'LEARNING' } }).plan.lambda;
    const damped = mk(10_000, {
      learning: { ...newLearning(0, P), phase: 'LEARNING' },
      prevLambda: base * 100,
    }).plan.lambda;
    expect(damped).toBeGreaterThan(base);
    expect(damped).toBeLessThan(base * 100);
  });

  it('every bid is within [0, 4x clear]', () => {
    const { plan, elig } = mk(1e9);
    elig.cells.forEach((c, i) => {
      expect(plan.bids[i]).toBeGreaterThanOrEqual(0);
      expect(plan.bids[i]).toBeLessThanOrEqual(4 * Math.exp(c.cell.external.mu) + 1e-9);
    });
  });
});

describe('target strategies', () => {
  it('target CPA scales with the target and follows the conversion rate', () => {
    const a = planFor({ bid: { kind: 'AUTOMATED', goal: 'TARGET_CPA', targetValue: 500 } }).plan;
    const b = planFor({ bid: { kind: 'AUTOMATED', goal: 'TARGET_CPA', targetValue: 1000 } }).plan;
    expect(a.fallback).toBe(false);
    const sa = a.bids.reduce((x, y) => x + y, 0);
    const sb = b.bids.reduce((x, y) => x + y, 0);
    expect(sb / sa).toBeGreaterThan(1.5);
    expect(sb / sa).toBeLessThan(2.3); // clamp at four times clear bends the top end
  });

  it('without a Floodlight activity the conversion strategy bids the p25 fallback', () => {
    const { plan, elig } = planFor(
      { bid: { kind: 'AUTOMATED', goal: 'TARGET_CPA', targetValue: 500 } },
      { activities: [] },
    );
    expect(plan.fallback).toBe(true);
    elig.cells.forEach((c, i) => {
      if (c.nSurv > 0)
        expect(plan.bids[i]).toBeCloseTo(
          Math.exp(c.cell.external.mu - 0.6745 * c.cell.external.sigma),
          6,
        );
    });
  });

  it('a missing target falls back too', () => {
    expect(planFor({ bid: { kind: 'AUTOMATED', goal: 'TARGET_CPC' } }).plan.fallback).toBe(true);
  });

  it('target CPM keeps the mean bid near the target', () => {
    const { plan, elig } = planFor({
      bid: { kind: 'AUTOMATED', goal: 'TARGET_CPM', targetValue: 60 },
    });
    let w = 0;
    let acc = 0;
    elig.cells.forEach((c, i) => {
      if (c.nSurv > 0) {
        w += c.nSurv;
        acc += c.nSurv * (plan.bids[i] as number);
      }
    });
    // fee-aware bids net out the DV360 fee, so the mean media bid is below the target
    expect(acc / w).toBeGreaterThan(30);
    expect(acc / w).toBeLessThan(60);
  });
});

describe('lambda solver', () => {
  property(
    'finds the lambda where a monotone spend function equals the target',
    [
      fc.double({ min: 0.1, max: 50, noNaN: true }),
      fc.double({ min: 0.05, max: 0.95, noNaN: true }),
    ],
    (k, frac) => {
      const hi = 100;
      const spend = (l: number) => k * l * l;
      const target = spend(hi) * frac;
      const r = solveLambda(spend, target, hi, 20);
      expect(r.saturated).toBeNull();
      expect(spend(r.lambda) / target).toBeGreaterThan(0.98);
      expect(spend(r.lambda) / target).toBeLessThan(1.02);
    },
  );

  it('reports saturation at both ends', () => {
    expect(solveLambda((l) => l, 1000, 10, 14).saturated).toBe('hi');
    expect(solveLambda((l) => l + 5, 1, 10, 14).saturated).toBe('lo');
    expect(solveLambda((l) => l, 1, 0, 14).saturated).toBe('hi');
  });
});

describe('value model and learning (engine.md 4.3)', () => {
  const truth = {
    ctr: 0.002,
    pconv: 0.0001,
    pview: 0.5,
    pnew: 0.8,
    pviewEvent: 0,
    pciva: 0,
    value: 0,
    tos10: 0.55,
  };
  const mean = { ...truth, ctr: 0.0015 };

  it('a fully learned estimate is the truth; an unlearned one leans on the mean', () => {
    expect(estimateRates(truth, mean, 1, 2, P)).toBe(truth);
    const early = estimateRates(truth, mean, 0.25, 0, P);
    expect(early.ctr).toBeLessThan(truth.ctr);
    expect(early.ctr).toBeGreaterThan(mean.ctr * 0.9);
  });

  it('the estimate gets closer to the truth as quality rises', () => {
    const error = (q: number) => {
      const zs = [-1.5, -1, -0.5, 0, 0.5, 1, 1.5];
      return (
        zs.reduce((a, z) => a + Math.abs(estimateRates(truth, mean, q, z, P).ctr - truth.ctr), 0) /
        zs.length
      );
    };
    expect(error(0.95)).toBeLessThan(error(0.6));
    expect(error(0.6)).toBeLessThan(error(0.25));
  });

  it('quality follows 1 - (1 - q0) exp(-events / tau)', () => {
    expect(qualityFromEvents(0, 'clicks', P)).toBeCloseTo(0.25, 9);
    expect(qualityFromEvents(150, 'clicks', P)).toBeCloseTo(1 - 0.75 * Math.exp(-1), 9);
    expect(qualityFromEvents(1e9, 'clicks', P)).toBeCloseTo(1, 9);
    expect(exitEventsFor('clicks', P)).toBe(200);
    expect(exitEventsFor('conversions', P)).toBe(30);
    expect(exitEventsFor('viewable_impressions', P)).toBe(5000);
  });

  const li = smallWorld({ li: { bid: { kind: 'AUTOMATED', goal: 'MAX_CLICKS' } } }).lineItems[0]!;
  const io = smallWorld().insertionOrders[0]!;
  const step = (ls = newLearning(0, P), edit = li, events = 10, tick = 1, opt = false) =>
    advanceLearning(ls, signatureOf(edit, io), events, 'clicks', opt, tick, P, 'seed', 'li1');

  it('quality never drops without an edit and the phase leaves LEARNING at the exit events', () => {
    let ls = step(newLearning(0, P), li, 0, 0);
    let prev = ls.q;
    for (let t = 1; t < 80; t++) {
      ls = step(ls, li, 10, t);
      expect(ls.q).toBeGreaterThanOrEqual(prev);
      prev = ls.q;
    }
    expect(ls.phase).toBe('STABLE');
    expect(ls.events).toBeGreaterThanOrEqual(200);
  });

  it('a significant edit restarts learning for 24 to 72 hours with at most half the quality', () => {
    let ls = step(newLearning(0, P), li, 0, 0);
    for (let t = 1; t < 60; t++) ls = step(ls, li, 10, t);
    const before = ls.q;
    const edited = step(
      ls,
      { ...li, bid: { kind: 'AUTOMATED', goal: 'TARGET_CPA', targetValue: 100 } },
      0,
      60,
    );
    expect(edited.phase).toBe('RELEARNING');
    expect(edited.q).toBeLessThanOrEqual(
      Math.max(P.bidding.learning.relearnQualityFloor, 0.5 * before) + 1e-9,
    );
    expect(edited.relearnUntilTick - 60).toBeGreaterThanOrEqual(24);
    expect(edited.relearnUntilTick - 60).toBeLessThanOrEqual(72);
  });

  it('small edits and renames do not reset learning', () => {
    let ls = step(
      newLearning(0, P),
      { ...li, bid: { kind: 'AUTOMATED', goal: 'TARGET_CPA', targetValue: 100 } },
      0,
      0,
    );
    ls = step(
      ls,
      { ...li, bid: { kind: 'AUTOMATED', goal: 'TARGET_CPA', targetValue: 100 } },
      50,
      1,
    );
    const q = ls.q;
    const nudged = step(
      ls,
      { ...li, bid: { kind: 'AUTOMATED', goal: 'TARGET_CPA', targetValue: 110 } },
      0,
      2,
    );
    expect(nudged.phase).not.toBe('RELEARNING');
    expect(nudged.q).toBeGreaterThanOrEqual(q - 1e-9);
    const big = step(
      ls,
      { ...li, bid: { kind: 'AUTOMATED', goal: 'TARGET_CPA', targetValue: 150 } },
      0,
      2,
    );
    expect(big.phase).toBe('RELEARNING');
  });

  it('other significant edits: optimized targeting, creative set, audience dimension, budget change over 30%', () => {
    const base = step(step(newLearning(0, P), li, 0, 0), li, 5, 1);
    const changed = (e: LineItemEntity) => step(base, e, 0, 2).phase;
    expect(changed({ ...li, optimizedTargeting: true })).toBe('RELEARNING');
    expect(changed({ ...li, creativeIds: ['other'] })).toBe('RELEARNING');
    expect(
      changed({ ...li, targeting: { ...li.targeting, audiences: { includeGroups: [['a']] } } }),
    ).toBe('RELEARNING');
    expect(changed({ ...li, floodlight: [] })).toBe('RELEARNING');
    expect(changed({ ...li, budget: { mode: 'FIXED', amount: 1000 } })).toBe('RELEARNING');
    expect(changed({ ...li, name: 'x' } as LineItemEntity)).not.toBe('RELEARNING');
  });

  it('optimized targeting counts events 1.4 times', () => {
    const a = step(step(newLearning(0, P), li, 0, 0, true), li, 100, 1, true);
    const b = step(step(newLearning(0, P), li, 0, 0, false), li, 100, 1, false);
    expect(a.events).toBeCloseTo(140, 9);
    expect(b.events).toBe(100);
  });

  it('spends at most 75% of the allowance in the first day of a learning state', () => {
    const ls = newLearning(10, P);
    expect(learningSpendCap(ls, 10, P)).toBe(0.75);
    expect(learningSpendCap(ls, 33, P)).toBe(0.75);
    expect(learningSpendCap(ls, 34, P)).toBe(1);
    expect(learningSpendCap({ ...ls, phase: 'STABLE' }, 10, P)).toBe(1);
    expect(learningSpendCap(undefined, 10, P)).toBe(1);
  });

  it('a learning strategy ends up worse than a learned one on the same cells (sanity of the model)', () => {
    const learned = planFor(
      { bid: { kind: 'AUTOMATED', goal: 'MAX_CLICKS' } },
      { allowance: 10_000, learning: { ...newLearning(0, P), phase: 'STABLE', q: 1 } },
    );
    const learning = planFor(
      { bid: { kind: 'AUTOMATED', goal: 'MAX_CLICKS' } },
      { allowance: 10_000, learning: { ...newLearning(0, P), q: 0.25 } },
    );
    expect(learned.plan.q).toBe(1);
    expect(learning.plan.q).toBe(0.25);
    expect(learning.plan.bids).not.toEqual(learned.plan.bids);
  });
});

describe('IO-level optimisation (engine.md 4.5)', () => {
  const ids = ['a', 'b', 'c'];

  it('splits evenly with no data', () => {
    const w = automatedWeights(ids, {}, P);
    for (const id of ids) expect(w[id]).toBeCloseTo(1 / 3, 9);
  });

  it('gives more to the efficient line item, with a 5% floor, summing to one', () => {
    const w = automatedWeights(
      ids,
      {
        a: { events: 400, spend: 100 },
        b: { events: 100, spend: 100 },
        c: { events: 0, spend: 100 },
      },
      P,
    );
    // a line item with no events yet is credited with the IO average, so it sits between the others
    expect(w.a).toBeGreaterThan(w.c!);
    expect(w.c).toBeGreaterThan(w.b!);
    expect(w.b).toBeGreaterThanOrEqual(0.05 - 1e-9);
    expect(Object.values(w).reduce((x, y) => x + y, 0)).toBeCloseTo(1, 9);
  });

  it('credibility weighting pulls small samples towards the IO average', () => {
    const io = { events: 1000, spend: 1000 };
    expect(efficiency({ events: 1, spend: 0.1 }, io, P)).toBeLessThan(5);
    expect(efficiency({ events: 100000, spend: 10000 }, io, P)).toBeGreaterThan(9);
  });

  it('automatic allocation moves weights by at most 0.8x to 1.25x a day and keeps a floor', () => {
    const prev = { a: 0.4, b: 0.4, c: 0.2 };
    const next = autoAllocateWeights(
      prev,
      ids,
      {
        a: { events: 900, spend: 100 },
        b: { events: 10, spend: 100 },
        c: { events: 100, spend: 100 },
      },
      P,
    );
    expect(Object.values(next).reduce((x, y) => x + y, 0)).toBeCloseTo(1, 9);
    expect(next.a).toBeGreaterThan(prev.a);
    expect(next.b).toBeLessThan(prev.b);
    expect(next.a! / prev.a).toBeLessThanOrEqual(1.25 / (1 - 0) + 0.2);
    for (const id of ids) expect(next[id]).toBeGreaterThanOrEqual(0.05 - 1e-9);
  });
});
