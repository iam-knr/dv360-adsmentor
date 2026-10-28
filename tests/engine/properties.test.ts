// Property tests of engine.md 11.2 (fast-check, 200 runs each unless noted, seeds logged).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { runAuction } from '@/lib/engine/auction';
import { newLearning, planBids, strategyFor } from '@/lib/engine/bidding';
import { consumptionLinear, resolveFees } from '@/lib/engine/economics';
import { advanceLearning, signatureOf } from '@/lib/engine/bidding';
import { avgBelow } from '@/lib/engine/supply/landscape';
import {
  applyWins,
  cappedShare,
  newFreqState,
  refreshFreqState,
  scopesFor,
} from '@/lib/engine/eligibility/frequency';
import { lagBuckets, countConversion } from '@/lib/engine/outcomes';
import { reachFromImpressions } from '@/lib/engine/aggregation';
import { METRIC_KEYS } from '@/lib/engine/metrics';
import { creativeFor, purchase, smallWorld } from '@/lib/engine/testing/fixtures';

const SIZES = [
  '300x250',
  '320x50',
  '728x90',
  '300x600',
  '160x600',
  '970x250',
  '336x280',
  '320x100',
  'other',
];
import type {
  FrequencyCap,
  IoEntity,
  LineItemEntity,
  TargetingSpec,
  World,
} from '@/lib/engine/world';
import {
  funnelFor,
  funnelTotals,
  loadParams,
  params,
  property,
  runTicks as runFull,
  sumDaily,
} from './helpers';

// slices are only needed by the reconciliation property; a parameter patch keeps the others cheap
const lite = loadParams({ aggregation: { dailySliceKinds: ['total'] } });
const runTicks = (w: World, from: number, to: number) => runFull(w, from, to, { loaded: lite });

const P = params.params;
const FAST = ['index_exchange'];
const REGIONS = ['IN-DL', 'IN-MH', 'IN-KA', 'IN-TN', 'IN-REST'];
const DEVICES = ['computer', 'smartphone', 'tablet'] as const;

interface Scenario {
  bid: number;
  regions: string[];
  devices: (typeof DEVICES)[number][];
  pacing: 'EVEN' | 'AHEAD' | 'ASAP';
  budget: number;
  quality: LineItemEntity['inventoryQuality'];
  cap: number | null;
  start: number;
}

const scenario: fc.Arbitrary<Scenario> = fc.record({
  bid: fc.integer({ min: 5, max: 400 }),
  regions: fc.subarray(REGIONS, { minLength: 1 }),
  devices: fc.subarray([...DEVICES], { minLength: 1 }),
  pacing: fc.constantFrom('EVEN', 'AHEAD', 'ASAP'),
  budget: fc.integer({ min: 1_500, max: 300_000 }),
  quality: fc.constantFrom('DIRECT_ONLY', 'DIRECT_AND_RESELLERS', 'ALL'),
  cap: fc.option(fc.integer({ min: 1, max: 6 }), { nil: null }),
  start: fc.integer({ min: 0, max: 40 }),
});

function build(
  s: Scenario,
  over: {
    li?: Partial<LineItemEntity>;
    io?: Partial<IoEntity>;
    targeting?: TargetingSpec;
    world?: Partial<World>;
  } = {},
): World {
  const frequency: FrequencyCap = s.cap
    ? { mode: 'LIMITED', maxExposures: s.cap, unit: 'DAY', unitCount: 1 }
    : { mode: 'INHERIT' };
  return smallWorld({
    li: {
      bid: { kind: 'FIXED', fixedCpm: s.bid },
      inventoryQuality: s.quality,
      frequency,
      pacing: { period: 'FLIGHT', type: s.pacing },
      ...over.li,
    },
    io: {
      segments: [{ id: 'seg1', amount: s.budget, startDay: '2026-11-01', endDay: '2026-11-03' }],
      pacing: { period: 'FLIGHT', type: s.pacing === 'ASAP' ? 'EVEN' : s.pacing },
      ...over.io,
    },
    targeting: {
      exchanges: FAST,
      geo: { includeRegions: s.regions },
      devices: s.devices,
      ...over.targeting,
    },
    world: { partner: { id: 'p1', currency: 'INR', enabledExchanges: FAST }, ...over.world },
  });
}

describe('11.2 funnel', () => {
  property(
    'conservation: A = sum(T,C,F,B,P,A,E) + W per line item, tick and exchange; counts are non-negative integers',
    [scenario],
    (s) => {
      const { outputs } = runTicks(build(s), s.start, s.start + 3);
      for (const o of outputs) {
        const byEx = new Map<string, Map<string, number>>();
        for (const r of o.funnel) {
          expect(Number.isInteger(r.count)).toBe(true);
          expect(r.count).toBeGreaterThan(0);
          const m = byEx.get(r.exchangeId) ?? new Map<string, number>();
          m.set(r.reasonCode, (m.get(r.reasonCode) ?? 0) + r.count);
          byEx.set(r.exchangeId, m);
        }
        for (const m of byEx.values()) {
          let filtered = 0;
          for (const [code, n] of m) if (!code.startsWith('M.')) filtered += n;
          expect(filtered + (m.get('M.WON') ?? 0)).toBe(m.get('M.AVAILABLE') ?? 0);
        }
      }
    },
  );

  property('stage ordering: A >= E >= S >= R >= W', [scenario], (s) => {
    const { outputs } = runTicks(build(s), s.start, s.start + 3);
    for (const o of outputs) {
      const byEx = new Map<string, Map<string, number>>();
      for (const r of o.funnel) {
        const m = byEx.get(r.exchangeId) ?? new Map<string, number>();
        m.set(r.reasonCode, (m.get(r.reasonCode) ?? 0) + r.count);
        byEx.set(r.exchangeId, m);
      }
      for (const m of byEx.values()) {
        const g = (k: string) => m.get(k) ?? 0;
        expect(g('M.AVAILABLE')).toBeGreaterThanOrEqual(g('M.ELIGIBLE'));
        expect(g('M.ELIGIBLE')).toBeGreaterThanOrEqual(g('M.BIDS_SUBMITTED'));
        expect(g('M.BIDS_SUBMITTED')).toBeGreaterThanOrEqual(g('M.BID_RESPONSES'));
        expect(g('M.BID_RESPONSES')).toBeGreaterThanOrEqual(g('M.WON'));
      }
    }
  });

  property(
    'no spend when not live: paused, draft, archived, out of flight and parent-paused entities have no funnel rows and no spend',
    [
      scenario,
      fc.constantFrom(
        'li-paused',
        'li-draft',
        'li-archived',
        'li-before',
        'li-after',
        'io-paused',
        'io-draft',
        'campaign-paused',
        'no-segment',
      ),
    ],
    (s, kind) => {
      const w = build(s);
      const world: World = { ...w };
      if (kind === 'li-paused')
        world.lineItems = w.lineItems.map((l) => ({ ...l, status: 'PAUSED' }));
      if (kind === 'li-draft')
        world.lineItems = w.lineItems.map((l) => ({ ...l, status: 'DRAFT' }));
      if (kind === 'li-archived')
        world.lineItems = w.lineItems.map((l) => ({ ...l, status: 'ARCHIVED' }));
      if (kind === 'li-before')
        world.lineItems = w.lineItems.map((l) => ({
          ...l,
          flight: { start: '2027-01-01', end: '2027-02-01' },
        }));
      if (kind === 'li-after')
        world.lineItems = w.lineItems.map((l) => ({
          ...l,
          flight: { start: '2025-01-01', end: '2025-02-01' },
        }));
      if (kind === 'io-paused')
        world.insertionOrders = w.insertionOrders.map((i) => ({ ...i, status: 'PAUSED' }));
      if (kind === 'io-draft')
        world.insertionOrders = w.insertionOrders.map((i) => ({ ...i, status: 'DRAFT' }));
      if (kind === 'campaign-paused')
        world.campaigns = w.campaigns.map((c) => ({ ...c, status: 'PAUSED' }));
      if (kind === 'no-segment')
        world.insertionOrders = w.insertionOrders.map((i) => ({ ...i, segments: [] }));
      const { outputs } = runTicks(world, s.start, s.start + 3);
      for (const o of outputs) {
        expect(o.funnel).toEqual([]);
        expect(o.hourly).toEqual([]);
        expect(o.liveStatus[0]!.status).not.toBe('ACTIVE_DELIVERING');
      }
      expect(sumDaily(outputs).revenue).toBe(0);
    },
  );

  property(
    'targeting monotonicity: adding an include or an exclude never raises the passing share; no targeting passes everything',
    [
      fc.subarray(['IN-DL', 'IN-MH', 'IN-KA', 'IN-TN', 'IN-UP', 'IN-REST'], {
        minLength: 1,
        maxLength: 5,
      }),
      fc.constantFrom(
        'device',
        'environment',
        'language',
        'browser',
        'keyword',
        'viewability',
        'brand',
        'geoExclude',
        'audience',
      ),
    ],
    (regions, extra) => {
      const share = (t: TargetingSpec) => {
        const w = smallWorld({
          li: { inventoryQuality: 'ALL' },
          world: {
            partner: { id: 'p1', currency: 'INR', enabledExchanges: FAST },
            audiences: [{ id: 'a1', type: 'affinity', sizeFraction: 0.05 }],
          },
        });
        const li = w.lineItems[0]!;
        // exact targeting, full creative coverage so only targeting filters
        w.lineItems[0] = {
          ...li,
          targeting: { formats: ['display'], ...t },
          creativeIds: SIZES.map((_, i) => `full-${i}`),
        };
        w.creatives = [
          ...w.creatives,
          ...SIZES.map((size, i) => ({ ...creativeFor('display', `full-${i}`), size })),
        ];
        const e = funnelFor(w, 'li1').elig;
        return e.totals.E / e.totals.A;
      };
      const base: TargetingSpec = { exchanges: FAST, geo: { includeRegions: regions } };
      const more: Record<string, TargetingSpec> = {
        device: { ...base, devices: ['smartphone'] },
        environment: { ...base, environment: ['app'] },
        language: { ...base, languages: ['hi', 'en'] },
        browser: { ...base, browser: { include: ['chrome'] } },
        keyword: { ...base, keywords: { includeCount: 5 } },
        viewability: { ...base, viewabilityMin: 0.7 },
        brand: { ...base, brandSuitability: { mode: 'limited' } },
        geoExclude: { ...base, geo: { includeRegions: regions, excludeRegions: [regions[0]!] } },
        audience: { ...base, audiences: { includeGroups: [['a1']] } },
      };
      expect(share(more[extra]!)).toBeLessThanOrEqual(share(base) + 1e-3);
      expect(share({})).toBeGreaterThan(0.999);
    },
  );
});

describe('11.2 auction and price', () => {
  property(
    'win monotonicity: raising a fixed bid never lowers W/R nor pushes the average price above the bid',
    [scenario, fc.double({ min: 1.3, max: 3, noNaN: true })],
    (s, k) => {
      const lo = Math.max(5, s.bid);
      const rate = (bid: number) => {
        const { outputs } = runTicks(build({ ...s, bid }), 12, 13);
        const f = funnelTotals(outputs);
        const R = f.get('M.BID_RESPONSES') ?? 0;
        const W = f.get('M.WON') ?? 0;
        const t = sumDaily(outputs);
        return {
          R,
          W,
          rate: R > 0 ? W / R : 0,
          price: t.impressions > 0 ? (t.mediaCost / 1e6 / t.impressions) * 1000 : 0,
          bid,
        };
      };
      const a = rate(lo);
      const b = rate(lo * k);
      if (a.R > 400 && b.R > 400) {
        const sd = Math.sqrt(0.25 / a.R) + Math.sqrt(0.25 / b.R);
        expect(b.rate).toBeGreaterThanOrEqual(a.rate - 4 * sd);
      }
      if (a.price > 0) expect(a.price).toBeLessThanOrEqual(a.bid + 1e-3);
      if (b.price > 0) expect(b.price).toBeLessThanOrEqual(b.bid + 1e-3);
    },
  );

  property(
    'price bound: in every cell the average winning price is at most the bid and not below the average floor it cleared',
    [
      fc.integer({ min: 4, max: 600 }),
      fc.integer({ min: 0, max: 60 }),
      fc.constantFrom('google_ad_manager', 'openx', 'index_exchange'),
    ],
    (bid, tick, ex) => {
      const world = smallWorld({
        li: { bid: { kind: 'FIXED', fixedCpm: bid } },
        targeting: { exchanges: [ex], geo: { includeRegions: ['IN-MH', 'IN-DL', 'IN-REST'] } },
        world: { partner: { id: 'p', currency: 'INR', enabledExchanges: [ex] } },
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
        strategy: strategyFor(undefined, true),
        elig,
        params: P,
        tick,
        sandboxSeed: 's',
        fees,
        cons,
        fxToAdv: 1,
        activities: [purchase],
        learning: { ...newLearning(0, P), phase: 'STABLE', q: 1 },
        prevLambda: undefined,
        allowance: 1e9,
        reach: undefined,
      });
      const a = runAuction({
        liId: li.id,
        elig,
        plan,
        throttle: {
          rBudget: 1,
          r: 1,
          budgetCode: 'B.IO_SEGMENT',
          paceCode: 'P.IO_PACING',
          spendCap: Infinity,
          capIsBudget: false,
        },
        cons,
        fxToAdv: 1,
        params: P,
        tick,
        sandboxSeed: 's',
        own: new Map(),
      });
      for (const c of a.cells) {
        if (c.W === 0) continue;
        expect(c.price).toBeLessThanOrEqual(c.bid * (1 + 1e-9));
        expect(c.price).toBeGreaterThanOrEqual(
          Math.min(c.bid, avgBelow(c.bid, c.elc.cell.floor)) * (1 - 1e-9),
        );
      }
    },
  );
});

describe('11.2 budget and pacing', () => {
  property(
    'budget safety: segment spend never exceeds the segment budget; daily spend stays within 1.15 x the daily cap',
    [scenario, fc.integer({ min: 200, max: 4_000 })],
    (s, cap) => {
      const budget = Math.max(800, Math.round(s.budget / 20));
      const world = build(
        { ...s, budget },
        {
          li: {
            pacing: {
              period: 'DAILY',
              type: s.pacing === 'AHEAD' ? 'EVEN' : s.pacing,
              dailyAmount: cap,
            },
          },
        },
      );
      const { outputs } = runTicks(world, 20, 30);
      let total = 0;
      const perDay = new Map<string, number>();
      for (const o of outputs) {
        for (const d of o.daily) {
          if (d.sliceKind !== 'total') continue;
          total += d.metrics.revenue / 1e6;
          perDay.set(d.date, (perDay.get(d.date) ?? 0) + d.metrics.revenue / 1e6);
        }
      }
      expect(total).toBeLessThanOrEqual(budget + 1e-6);
      for (const v of perDay.values()) expect(v).toBeLessThanOrEqual(cap * 1.15 + 2);
    },
  );

  property(
    'hourly overshoot is bounded: a tick spends at most 1.15 x its allowance (daily even pacing)',
    [scenario, fc.integer({ min: 600, max: 6_000 })],
    (s, cap) => {
      const world = build(
        { ...s, budget: 1e6 },
        {
          li: {
            pacing: { period: 'DAILY', type: 'EVEN', dailyAmount: cap },
            bid: { kind: 'FIXED', fixedCpm: s.bid },
          },
        },
      );
      const { outputs } = runTicks(world, 0, 12);
      let spentToday = 0;
      for (const o of outputs) {
        if (o.hour === 0) spentToday = 0;
        const allowance = Math.max(0, cap - spentToday) / (24 - o.hour);
        const spend = o.daily
          .filter((d) => d.sliceKind === 'total')
          .reduce((a, d) => a + d.metrics.revenue / 1e6, 0);
        expect(spend).toBeLessThanOrEqual(allowance * 1.15 + 2);
        spentToday += spend;
      }
    },
  );

  property(
    'pacing convergence: with ample supply Flight Even ends within 98% to 102% of budget; Ahead is never below Even and never above the budget',
    [fc.integer({ min: 1, max: 2 }), fc.integer({ min: 2_500, max: 9_000 })],
    (days, perDay) => {
      const budget = perDay * days;
      const mk = (type: 'EVEN' | 'AHEAD') =>
        smallWorld({
          li: { bid: { kind: 'FIXED', fixedCpm: 100 } },
          io: {
            segments: [
              { id: 'seg1', amount: budget, startDay: '2026-11-01', endDay: `2026-11-0${days}` },
            ],
            pacing: { period: 'FLIGHT', type },
          },
          targeting: {
            exchanges: ['index_exchange'],
            geo: { includeRegions: ['IN-MH', 'IN-DL', 'IN-REST'] },
          },
          world: { partner: { id: 'p', currency: 'INR', enabledExchanges: ['index_exchange'] } },
        });
      const cumulative = (type: 'EVEN' | 'AHEAD') => {
        const { outputs } = runTicks(mk(type), 0, days * 24);
        let acc = 0;
        return outputs.map(
          (o) =>
            (acc += o.daily
              .filter((d) => d.sliceKind === 'total')
              .reduce((a, d) => a + d.metrics.revenue / 1e6, 0)),
        );
      };
      const even = cumulative('EVEN');
      const ahead = cumulative('AHEAD');
      expect(even.at(-1)! / budget).toBeGreaterThan(0.98);
      expect(even.at(-1)! / budget).toBeLessThan(1.02);
      expect(ahead.at(-1)!).toBeLessThanOrEqual(budget + 1e-6);
      ahead.forEach((v, i) => expect(v).toBeGreaterThanOrEqual(even[i]! * 0.985 - 2));
    },
    { runs: 40 },
  );
});

describe('11.2 frequency and reach', () => {
  property(
    'frequency cap: average exposures per reached user stay within the cap and the capped share only grows inside a window',
    [
      fc.integer({ min: 1, max: 6 }),
      fc.integer({ min: 100, max: 100_000 }),
      fc.array(fc.integer({ min: 0, max: 400_000 }), { minLength: 1, maxLength: 8 }),
    ],
    (cap, U, winsPerTick) => {
      const scope = scopesFor(
        { id: 'l', frequency: { mode: 'LIMITED', maxExposures: cap, unit: 'DAY', unitCount: 1 } },
        undefined,
        undefined,
      )[0]!;
      let s = newFreqState(scope, U, 0);
      let prev = 0;
      for (const w of winsPerTick) {
        s = applyWins(s, w);
        const reached = U - s.h[0]!;
        const exposures = s.h.reduce((a, n, k) => a + k * n, 0);
        if (reached > 1e-9) expect(exposures / reached).toBeLessThanOrEqual(cap + 1e-9);
        expect(s.h.reduce((a, b) => a + b, 0)).toBeCloseTo(U, 4);
        const c = cappedShare(s);
        expect(c).toBeGreaterThanOrEqual(prev - 1e-12);
        prev = c;
      }
      expect(cappedShare(refreshFreqState(s, scope, U, 24))).toBe(0);
    },
  );

  property(
    'wins in a window never exceed cap x pool when the funnel enforces the remaining capacity',
    [fc.integer({ min: 1, max: 4 })],
    (cap) => {
      const world = build(
        {
          bid: 150,
          regions: ['IN-MH'],
          devices: ['smartphone'],
          pacing: 'ASAP',
          budget: 5e6,
          quality: 'ALL',
          cap,
          start: 0,
        },
        {
          targeting: {
            exchanges: FAST,
            geo: { includeRegions: ['IN-MH'] },
            devices: ['smartphone'],
            environment: ['app'],
          },
        },
      );
      const { outputs, state } = runTicks(world, 0, 24);
      const wins = sumDaily(outputs).impressions;
      const U = state.freq['LI:li1']!.U;
      expect(wins).toBeLessThanOrEqual(cap * U * 1.02 + 5);
    },
    { runs: 8 },
  );

  property(
    'reach: 0 < reach <= pool, reach <= impressions, and it does not fall as impressions grow',
    [fc.integer({ min: 1, max: 1e9 }), fc.integer({ min: 1, max: 1e8 })],
    (impr, pool) => {
      const r = reachFromImpressions(impr, pool);
      expect(r).toBeGreaterThan(0);
      expect(r).toBeLessThanOrEqual(pool);
      expect(r).toBeLessThanOrEqual(impr);
      expect(reachFromImpressions(impr * 2, pool)).toBeGreaterThanOrEqual(r);
    },
  );

  it('lifetime reach in a run is positive, bounded by the pool and by the impressions', () => {
    const s: Scenario = {
      bid: 120,
      regions: ['IN-MH'],
      devices: ['smartphone'],
      pacing: 'ASAP',
      budget: 1e6,
      quality: 'ALL',
      cap: null,
      start: 0,
    };
    const { outputs, state } = runTicks(build(s), 0, 24);
    const rs = state.reach.li1!;
    const reached = rs.U - rs.lifetime[0]!;
    expect(reached).toBeGreaterThan(0);
    expect(reached).toBeLessThanOrEqual(rs.U);
    expect(reached).toBeLessThanOrEqual(sumDaily(outputs).impressions);
    const snap = outputs.flatMap((o) => o.reach)[0]!;
    expect(snap.impressionReach).toBeGreaterThan(0);
    expect(snap.avgFrequency).toBeGreaterThanOrEqual(1);
  });
});

describe('11.2 reconciliation, conversions and learning', () => {
  property(
    'slices reconcile to the day total for every metric, and money rows add up',
    [scenario],
    (s) => {
      const { outputs } = runFull(build(s), s.start, s.start + 1);
      for (const o of outputs) {
        const sums = new Map<string, Record<string, number>>();
        for (const d of o.daily) {
          const acc = sums.get(d.sliceKind) ?? {};
          for (const k of METRIC_KEYS) acc[k] = (acc[k] ?? 0) + d.metrics[k];
          sums.set(d.sliceKind, acc);
        }
        const total = sums.get('total');
        for (const [kind, acc] of sums) {
          if (kind === 'total' || kind === 'activity') continue;
          for (const k of METRIC_KEYS)
            expect(Math.abs((acc[k] ?? 0) - (total![k] ?? 0)), `${kind}.${k}`).toBeLessThanOrEqual(
              2e-6,
            );
        }
      }
    },
  );

  property(
    'counting methods: unique <= per session <= standard, transactions revenue = raw x order value',
    [
      fc.integer({ min: 0, max: 100_000 }),
      fc.double({ min: 0, max: 0.5, noNaN: true }),
      fc.integer({ min: 100, max: 50_000 }),
    ],
    (raw, repeat, aov) => {
      const act = {
        ...purchase,
        repeatPerUserDay: repeat,
        repeatPerSession: repeat / 3,
        avgOrderValue: aov,
      };
      const std = countConversion(raw, { ...act, countingMethod: 'standard' }, P, 1).counted;
      const per = countConversion(raw, { ...act, countingMethod: 'perSession' }, P, 1).counted;
      const uni = countConversion(raw, { ...act, countingMethod: 'unique' }, P, 1).counted;
      expect(uni).toBeLessThanOrEqual(per + 1e-9);
      expect(per).toBeLessThanOrEqual(std + 1e-9);
      const t = countConversion(raw, { ...act, countingMethod: 'transactions' }, P, 1);
      expect(t.revenue).toBeCloseTo(raw * aov, 4);
    },
  );

  property(
    'window rule: no conversion is released after its attribution window',
    [fc.integer({ min: 1, max: 90 }), fc.constantFrom('click', 'view')],
    (days, kind) => {
      const hours = days * 24;
      const b = lagBuckets(kind, hours, P);
      for (const x of b) {
        expect(x.dueOffset).toBeLessThanOrEqual(hours);
        expect(x.dueOffset).toBeGreaterThanOrEqual(1);
        expect(x.prob).toBeGreaterThanOrEqual(0);
      }
      expect(b.reduce((a, x) => a + x.prob, 0)).toBeLessThanOrEqual(1);
    },
  );

  property(
    'learning: quality never falls without a significant edit and only drops on one',
    [
      fc.array(fc.integer({ min: 0, max: 80 }), { minLength: 1, maxLength: 40 }),
      fc.integer({ min: 0, max: 39 }),
    ],
    (events, editAt) => {
      const w = smallWorld({ li: { bid: { kind: 'AUTOMATED', goal: 'MAX_CLICKS' } } });
      const li = w.lineItems[0]!;
      const io = w.insertionOrders[0]!;
      let ls = newLearning(0, P);
      ls = advanceLearning(ls, signatureOf(li, io), 0, 'clicks', false, 0, P, 's', 'li1');
      let edited = li;
      events.forEach((e, i) => {
        const tick = i + 1;
        const isEdit = i === editAt;
        if (isEdit)
          edited = { ...li, bid: { kind: 'AUTOMATED', goal: 'TARGET_CPA', targetValue: 100 } };
        const next = advanceLearning(
          ls,
          signatureOf(edited, io),
          e,
          'clicks',
          false,
          tick,
          P,
          's',
          'li1',
        );
        if (isEdit) expect(next.phase).toBe('RELEARNING');
        else expect(next.q).toBeGreaterThanOrEqual(ls.q - 1e-12);
        ls = next;
      });
    },
  );
});
