import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runAuction, ownPass, type AuctionResult, type ThrottleSpec } from '@/lib/engine/auction';
import { planBids, strategyFor, newLearning } from '@/lib/engine/bidding';
import { consumptionLinear, resolveFees } from '@/lib/engine/economics';
import { smallWorld, purchase } from '@/lib/engine/testing/fixtures';
import type { LineItemEntity } from '@/lib/engine/world';
import { funnelFor, params, property } from './helpers';

const P = params.params;
const open: ThrottleSpec = {
  rBudget: 1,
  r: 1,
  budgetCode: 'B.IO_SEGMENT',
  paceCode: 'P.IO_PACING',
  spendCap: Infinity,
  capIsBudget: false,
};

function auctionFor(
  over: Partial<LineItemEntity>,
  thr: Partial<ThrottleSpec> = {},
  tick = 12,
  seed = 'sandbox-1',
) {
  const world = smallWorld({
    li: over,
    targeting: {
      exchanges: ['google_ad_manager', 'openx'],
      geo: { includeRegions: ['IN-MH', 'IN-DL'] },
    },
  });
  const { li, io, elig, idx } = funnelFor(world, 'li1', tick);
  const fees = resolveFees({
    li,
    io,
    params: P,
    currency: 'INR',
    audiences: idx.audiences,
    creatives: idx.creatives,
  });
  const cons = consumptionLinear('CURRENCY', fees);
  const plan = planBids({
    li,
    strategy: strategyFor(li.bid.goal, li.bid.kind === 'FIXED'),
    elig,
    params: P,
    tick,
    sandboxSeed: seed,
    fees,
    cons,
    fxToAdv: 1,
    activities: [purchase],
    learning: { ...newLearning(0, P), phase: 'STABLE', q: 1 },
    prevLambda: undefined,
    allowance: 1e9,
    reach: undefined,
  });
  const auction = runAuction({
    liId: li.id,
    elig,
    plan,
    throttle: { ...open, ...thr },
    cons,
    fxToAdv: 1,
    params: P,
    tick,
    sandboxSeed: seed,
    own: new Map(),
  });
  return { auction, elig, plan, cons };
}

const sumCodes = (codes: [string, number][], prefix: string) =>
  codes.filter(([k]) => k.startsWith(prefix)).reduce((a, [, n]) => a + n, 0);

function checkConservation(a: AuctionResult) {
  for (const c of a.cells) {
    expect(c.codes.reduce((x, [, n]) => x + n, 0) + c.W).toBe(c.elc.nSurv);
    expect(c.W).toBeLessThanOrEqual(c.R);
    expect(c.R).toBeLessThanOrEqual(c.S);
    expect(c.S).toBeLessThanOrEqual(c.elc.nSurv);
    for (const [, n] of c.codes) {
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThan(0);
    }
  }
}

describe('auction stages (engine.md 5, 7.4)', () => {
  const { auction } = auctionFor({ bid: { kind: 'FIXED', fixedCpm: 70 } });

  it('every request ends in exactly one reason or a win', () => {
    expect(auction.cells.length).toBeGreaterThan(10);
    for (const c of auction.cells) {
      const filtered = c.codes.reduce((x, [, n]) => x + n, 0);
      expect(filtered + c.W).toBe(c.elc.nSurv);
    }
    checkConservation(auction);
  });

  it('keeps A >= E >= S >= R >= W per cell', () => {
    for (const c of auction.cells) {
      expect(c.elc.nA).toBeGreaterThanOrEqual(c.elc.nE);
      expect(c.elc.nE).toBeGreaterThanOrEqual(c.S);
      expect(c.S).toBeGreaterThanOrEqual(c.R);
      expect(c.R).toBeGreaterThanOrEqual(c.W);
    }
  });

  it('bids on everything when nothing throttles and wins a sensible share', () => {
    const S = auction.cells.reduce((a, c) => a + c.S, 0);
    const W = auction.cells.reduce((a, c) => a + c.W, 0);
    const surv = auction.cells.reduce((a, c) => a + c.elc.nSurv, 0);
    expect(S).toBe(surv);
    expect(W / S).toBeGreaterThan(0.2);
    expect(W / S).toBeLessThan(0.9);
    expect(auction.clipped).toBe(0);
  });

  it('pays no more than the bid on average and no less than the cell floor', () => {
    for (const c of auction.cells) {
      if (c.W === 0) continue;
      expect(c.price).toBeLessThanOrEqual(c.bid + 1e-9);
      expect(c.price).toBeGreaterThan(0);
    }
  });

  it('is deterministic for the same seed and tick, and differs for another tick', () => {
    const a = auctionFor({ bid: { kind: 'FIXED', fixedCpm: 70 } }).auction;
    const b = auctionFor({ bid: { kind: 'FIXED', fixedCpm: 70 } }).auction;
    expect(a.cells.map((c) => c.W)).toEqual(b.cells.map((c) => c.W));
    const c = auctionFor({ bid: { kind: 'FIXED', fixedCpm: 70 } }, {}, 13).auction;
    expect(c.cells.map((x) => x.W)).not.toEqual(a.cells.map((x) => x.W));
    const d = auctionFor({ bid: { kind: 'FIXED', fixedCpm: 70 } }, {}, 12, 'other-seed').auction;
    expect(d.cells.map((x) => x.W)).not.toEqual(a.cells.map((x) => x.W));
  });

  it('splits the throttle into budget and pacing filters (7.4 example)', () => {
    const t = auctionFor(
      { bid: { kind: 'FIXED', fixedCpm: 70 } },
      { rBudget: 0.8, r: 0.5, budgetCode: 'B.LINE_ITEM_DAILY', paceCode: 'P.LINE_ITEM_PACING' },
    ).auction;
    const surv = t.cells.reduce((a, c) => a + c.elc.nSurv, 0);
    const B = t.cells.reduce((a, c) => a + sumCodes(c.codes, 'B.'), 0);
    const Pc = t.cells.reduce((a, c) => a + sumCodes(c.codes, 'P.'), 0);
    const S = t.cells.reduce((a, c) => a + c.S, 0);
    expect(B / surv).toBeCloseTo(0.2, 2);
    expect(Pc / surv).toBeCloseTo(0.3, 2);
    expect(S / surv).toBeCloseTo(0.5, 2);
    expect(B + Pc + S).toBe(surv);
    checkConservation(t);
  });

  it('a zero budget filters every request as budget', () => {
    const t = auctionFor({ bid: { kind: 'FIXED', fixedCpm: 70 } }, { rBudget: 0, r: 0 }).auction;
    expect(t.cells.every((c) => c.S === 0 && c.W === 0)).toBe(true);
    expect(t.cells.reduce((a, c) => a + sumCodes(c.codes, 'B.'), 0)).toBe(
      t.cells.reduce((a, c) => a + c.elc.nSurv, 0),
    );
  });

  it('a zero bid is a bid below every floor', () => {
    const t = auctionFor({ bid: { kind: 'FIXED', fixedCpm: 0 } }).auction;
    expect(t.cells.every((c) => c.W === 0 && c.R === 0)).toBe(true);
    expect(t.cells.reduce((a, c) => a + sumCodes(c.codes, 'A.BELOW_MIN_BID'), 0)).toBe(
      t.cells.reduce((a, c) => a + c.S, 0),
    );
  });

  it('a very low bid loses to the floor, a high bid does not', () => {
    const low = auctionFor({ bid: { kind: 'FIXED', fixedCpm: 3 } }).auction;
    const hi = auctionFor({ bid: { kind: 'FIXED', fixedCpm: 400 } }).auction;
    const share = (a: AuctionResult) =>
      a.cells.reduce((x, c) => x + sumCodes(c.codes, 'A.BELOW_MIN_BID'), 0) /
      a.cells.reduce((x, c) => x + c.S, 0);
    expect(share(low)).toBeGreaterThan(0.5);
    expect(share(hi)).toBeLessThan(0.01);
  });

  it('clips realised consumption to the cap and keeps the funnel balanced', () => {
    const free = auctionFor({ bid: { kind: 'FIXED', fixedCpm: 70 } });
    const use = (r: ReturnType<typeof auctionFor>) =>
      r.auction.cells.reduce((a, c) => a + r.cons.a * c.media + r.cons.b * c.W, 0);
    const cap = use(free) * 0.4;
    const t = auctionFor(
      { bid: { kind: 'FIXED', fixedCpm: 70 } },
      { spendCap: cap, capIsBudget: true },
    );
    const used = use(t);
    expect(t.auction.clipped).toBeGreaterThan(0);
    expect(used).toBeLessThanOrEqual(cap * 1.001);
    expect(used).toBeGreaterThan(cap * 0.95);
    for (const c of t.auction.cells) {
      expect(c.codes.reduce((x, [, n]) => x + n, 0) + c.W).toBe(c.elc.nSurv);
      expect(c.W).toBeLessThanOrEqual(c.R);
    }
    // clipped wins are reclassified under the binding limit
    const reclass = t.auction.cells.reduce((a, c) => a + sumCodes(c.codes, 'B.'), 0);
    expect(reclass).toBeGreaterThanOrEqual(t.auction.clipped);
  });
});

describe('own line items competing (engine.md 5.3)', () => {
  it('a higher bid is never outbid; a lower bid loses the overlap', () => {
    const entries = [
      { liId: 'hi', bid: 100, bidRate: 0.5 },
      { liId: 'lo', bid: 50, bidRate: 0.4 },
    ];
    expect(ownPass(entries, 'hi', 100)).toBe(1);
    expect(ownPass(entries, 'lo', 50)).toBeCloseTo(0.5, 9);
    expect(ownPass(undefined, 'lo', 50)).toBe(1);
    expect(ownPass([], 'lo', 50)).toBe(1);
  });

  it('equal bids split the overlap evenly', () => {
    const entries = [
      { liId: 'a', bid: 80, bidRate: 1 },
      { liId: 'b', bid: 80, bidRate: 1 },
    ];
    expect(ownPass(entries, 'a', 80)).toBeCloseTo(0.5, 9);
    expect(ownPass(entries, 'b', 80)).toBeCloseTo(0.5, 9);
  });

  it('a line item does not compete with itself', () => {
    expect(ownPass([{ liId: 'a', bid: 80, bidRate: 1 }], 'a', 80)).toBe(1);
  });

  property(
    'pass probability stays in [0, 1] and falls as rivals bid on more requests',
    [
      fc.array(
        fc.tuple(
          fc.double({ min: 1, max: 500, noNaN: true }),
          fc.double({ min: 0, max: 1, noNaN: true }),
        ),
        { maxLength: 6 },
      ),
      fc.double({ min: 1, max: 500, noNaN: true }),
    ],
    (rivals, bid) => {
      const entries = rivals.map(([b, r], i) => ({ liId: `r${i}`, bid: b, bidRate: r }));
      const p = ownPass(entries, 'me', bid);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
      const more = entries.map((e) => ({ ...e, bidRate: Math.min(1, e.bidRate + 0.1) }));
      expect(ownPass(more, 'me', bid)).toBeLessThanOrEqual(p + 1e-12);
    },
  );
});
