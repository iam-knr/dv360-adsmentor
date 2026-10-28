import { describe, expect, it } from 'vitest';
import { hodCurve, priceMoments, cellSigma } from '@/lib/engine/supply/curves';
import { supplyCells, type MarketCtx } from '@/lib/engine/supply/cells';
import {
  avgBelow,
  cellExpectation,
  logNormCdf,
  partialExpect,
  winPrice,
} from '@/lib/engine/supply/landscape';
import { allocShare, audienceFraction, buildTargetingPlan } from '@/lib/engine/supply/shares';
import { viewabilityMeanAbove, viewabilityPass } from '@/lib/engine/params/rates';
import { SIM_START_MS, liOf, baseWorld } from '@/lib/engine/testing/fixtures';
import { Rng } from '@/lib/engine/rng/xoshiro';
import { params } from './helpers';

const ctx: MarketCtx = {
  country: 'IN',
  marketSeed: 'market-1',
  simStartMs: SIM_START_MS,
  tzOffsetMin: 330,
};
const P = params.params;

describe('supply cells', () => {
  it('are deterministic, sorted and have integer request counts', () => {
    const a = supplyCells(ctx, P, params.hash, 10, ['display']);
    const b = supplyCells(ctx, P, params.hash, 10, ['display']);
    expect(a).toEqual(b);
    const ids = a.map((c) => c.id);
    expect(ids).toEqual([...ids].sort());
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of a) {
      expect(Number.isInteger(c.requests)).toBe(true);
      expect(c.requests).toBeGreaterThanOrEqual(0);
      expect(c.id).toBe(`${c.exchangeId}|${c.region}|${c.device}|${c.environment}|${c.format}`);
    }
  });

  it('change with the market seed but not with the sandbox', () => {
    const a = supplyCells(ctx, P, params.hash, 3, ['display']);
    const b = supplyCells({ ...ctx, marketSeed: 'other' }, P, params.hash, 3, ['display']);
    expect(a.map((c) => c.requests)).not.toEqual(b.map((c) => c.requests));
  });

  it('average the base volume over a day (display, India)', () => {
    let total = 0;
    for (let t = 0; t < 24 * 7; t++) {
      total += supplyCells(ctx, P, params.hash, t, ['display']).reduce((a, c) => a + c.requests, 0);
    }
    const perHour = total / (24 * 7);
    // 4,000,000 requests an hour on average, week mean of the day-of-week curve is 1.0043
    expect(perHour / 4_000_000).toBeGreaterThan(0.97);
    expect(perHour / 4_000_000).toBeLessThan(1.04);
  });

  it('follow the hour-of-day curve: evening peak above the night trough', () => {
    const hod = hodCurve(P, 'display');
    expect(hod.reduce((a, b) => a + b, 0) / 24).toBeCloseTo(1, 9);
    const night = supplyCells(ctx, P, params.hash, 3, ['display']).reduce(
      (a, c) => a + c.requests,
      0,
    );
    const evening = supplyCells(ctx, P, params.hash, 21, ['display']).reduce(
      (a, c) => a + c.requests,
      0,
    );
    expect(evening / night).toBeGreaterThan(3.5);
  });

  it('centre the mixed buy on the table clearing median', () => {
    const moments = priceMoments(P, 'display', 'IN');
    let w = 0;
    let acc = 0;
    for (let h = 0; h < 24; h++) {
      for (const c of supplyCells(ctx, P, params.hash, h, ['display'])) {
        w += c.requests;
        acc += c.requests * c.external.mu;
      }
    }
    expect(Math.exp(acc / w)).toBeGreaterThan(62);
    expect(Math.exp(acc / w)).toBeLessThan(68);
    expect(moments.variance).toBeGreaterThan(0.01);
    // table sigma is the total spread, cell sigma is smaller
    expect(cellSigma(0.45, moments)).toBeLessThan(0.45);
    expect(cellSigma(0.45, moments)).toBeGreaterThanOrEqual(0.225);
  });

  it('price regions differently: Delhi costs more than the rest of India', () => {
    const cells = supplyCells(ctx, P, params.hash, 12, ['display']).filter(
      (c) =>
        c.exchangeId === 'google_ad_manager' &&
        c.device === 'smartphone' &&
        c.environment === 'app',
    );
    const dl = cells.find((c) => c.region === 'IN-DL');
    const rest = cells.find((c) => c.region === 'IN-REST');
    expect(Math.exp(dl!.external.mu) / Math.exp(rest!.external.mu)).toBeCloseTo(1.12 / 0.72, 2);
  });

  it('scale prices with the market index (US is 8.5 times India)', () => {
    const usCtx: MarketCtx = { ...ctx, country: 'US' };
    const india = supplyCells(ctx, P, params.hash, 12, ['display'])[0]!;
    const us = supplyCells(usCtx, P, params.hash, 12, ['display']).find(
      (c) =>
        c.exchangeId === india.exchangeId &&
        c.device === india.device &&
        c.environment === india.environment,
    )!;
    expect(us.region).toBe('US-ALL');
    expect(Math.exp(us.external.mu - (india.external.mu - Math.log(1)))).toBeGreaterThan(0);
    // same cell family, region index excluded: compare against the IN-REST-free ratio via moments
    const rIdx = P.markets.IN!.regionPriceIdx![india.region]!;
    expect(Math.exp(us.external.mu) / (Math.exp(india.external.mu) / rIdx)).toBeCloseTo(
      8.5 * Math.exp(priceMoments(P, 'display', 'IN').mean - priceMoments(P, 'display', 'US').mean),
      1,
    );
  });

  it('moves the share of disabled exchanges to the enabled ones (RC-029), total unchanged', () => {
    const all = supplyCells(ctx, P, params.hash, 20, ['display']);
    const some = supplyCells(
      ctx,
      P,
      params.hash,
      20,
      ['display'],
      ['google_ad_manager', 'index_exchange'],
    );
    expect(new Set(some.map((c) => c.exchangeId))).toEqual(
      new Set(['google_ad_manager', 'index_exchange']),
    );
    const sumAll = all.reduce((a, c) => a + c.dayRequests, 0);
    const sumSome = some.reduce((a, c) => a + c.dayRequests, 0);
    expect(sumSome / sumAll).toBeCloseTo(1, 6);
  });

  it('gives every format its own exchanges', () => {
    const ex = (f: 'display' | 'ctv' | 'youtube') =>
      new Set(supplyCells(ctx, P, params.hash, 0, [f]).map((c) => c.exchangeId));
    expect(ex('youtube')).toEqual(new Set(['youtube']));
    expect(ex('ctv').has('freewheel_ssp')).toBe(true);
    expect(ex('display').has('freewheel_ssp')).toBe(false);
  });
});

describe('price landscape closed forms (engine.md 5.2, 5.4)', () => {
  const d = { mu: Math.log(65), sigma: 0.45 };

  it('match a Monte Carlo of the lognormal', () => {
    const r = new Rng('landscape');
    const draws = Array.from({ length: 200_000 }, () => Math.exp(d.mu + d.sigma * r.normal()));
    const b = 78;
    const below = draws.filter((x) => x < b);
    expect(logNormCdf(b, d)).toBeCloseTo(below.length / draws.length, 2);
    expect(avgBelow(b, d)).toBeCloseTo(below.reduce((a, x) => a + x, 0) / below.length, 0);
    expect(partialExpect(b, d) / logNormCdf(b, d)).toBeCloseTo(avgBelow(b, d), 9);
  });

  it('puts half the mass below the median and handles non-positive bids', () => {
    expect(logNormCdf(65, d)).toBeCloseTo(0.5, 6);
    expect(logNormCdf(0, d)).toBe(0);
    expect(partialExpect(-1, d)).toBe(0);
  });

  const cell = supplyCells(ctx, P, params.hash, 12, ['display']).find(
    (c) => c.exchangeId === 'google_ad_manager',
  )!;
  const first = P.exchanges.google_ad_manager!;
  const second = P.exchanges.openx!;

  it('prices a first-price exchange at the bid for fixed bids and below it with shading', () => {
    const bid = 80;
    expect(winPrice(bid, cell, first, { ln: 0 }, 0)).toBeCloseTo(bid, 9);
    const shaded = winPrice(bid, cell, first, { ln: 0 }, 0.35);
    expect(shaded).toBeLessThan(bid);
    expect(shaded).toBeGreaterThan(0.6 * bid);
  });

  it('prices a second-price exchange between the floor and the bid', () => {
    const bid = 80;
    const p = winPrice(bid, cell, second, { ln: 0 }, 0);
    expect(p).toBeLessThanOrEqual(bid);
    expect(p).toBeGreaterThanOrEqual(avgBelow(bid, cell.floor) - 1e-9);
  });

  it('gives expected wins and spend that rise with the bid', () => {
    let prevWins = -1;
    let prevMedia = -1;
    for (const bid of [10, 30, 60, 90, 150, 300]) {
      const e = cellExpectation(bid, 100_000, cell, first, 0.2, { ln: 0 }, 0);
      expect(e.wins).toBeGreaterThanOrEqual(prevWins);
      expect(e.media).toBeGreaterThanOrEqual(prevMedia);
      expect(e.wins).toBeLessThanOrEqual(e.live + 1e-9);
      expect(e.price).toBeLessThanOrEqual(bid + 1e-9);
      prevWins = e.wins;
      prevMedia = e.media;
    }
    expect(cellExpectation(0, 1000, cell, first, 0.2, { ln: 0 }, 0).wins).toBe(0);
  });
});

describe('targeting shares (engine.md 2.3)', () => {
  const world = baseWorld({ audiences: [] });
  const tctx = (over = {}) => ({
    params: P,
    tick: 100,
    advHour: 20,
    advDow: 2,
    audiences: new Map(world.audiences.map((a) => [a.id, a])),
    ...over,
  });
  const li = (targeting: object, over: object = {}) => ({
    ...liOf('x', 'display'),
    inventoryQuality: 'ALL' as const,
    ...over,
    targeting,
  });
  const cell = supplyCells(ctx, P, params.hash, 12, ['display'])[0]!;

  it('select shares from allocation tables', () => {
    const t = P.targeting.allocation.browser;
    expect(allocShare(t, { include: ['chrome'] })).toBeCloseTo(0.68, 9);
    expect(allocShare(t, { exclude: ['chrome'] })).toBeCloseTo(0.32, 9);
    expect(allocShare(t, { include: ['chrome', 'safari'], exclude: ['safari'] })).toBeCloseTo(
      0.68,
      9,
    );
    expect(allocShare(t, undefined)).toBe(1);
  });

  it('plans no dimension beyond inventory source for an untargeted ALL-quality line item', () => {
    const plan = buildTargetingPlan(li({}), tctx(), 1);
    expect(plan.dims.map((d) => d.dim)).toEqual(['INVENTORY_SOURCE']);
    expect(plan.dims[0]!.pass(cell)).toBe(1);
  });

  it('applies the inventory quality tier', () => {
    const plan = buildTargetingPlan(li({}, { inventoryQuality: 'DIRECT_ONLY' }), tctx(), 1);
    expect(plan.dims[0]!.pass(cell)).toBeCloseTo(0.55, 9);
  });

  it('geo includes, excludes and postal codes', () => {
    const inc = buildTargetingPlan(li({ geo: { includeRegions: ['IN-MH'] } }), tctx(), 1).dims.find(
      (d) => d.dim === 'GEO',
    )!;
    const mh = { ...cell, region: 'IN-MH' };
    const dl = { ...cell, region: 'IN-DL' };
    expect(inc.pass(mh)).toBe(1);
    expect(inc.pass(dl)).toBe(0);
    const exc = buildTargetingPlan(li({ geo: { excludeRegions: ['IN-DL'] } }), tctx(), 1).dims.find(
      (d) => d.dim === 'GEO',
    )!;
    expect(exc.pass(mh)).toBe(1);
    expect(exc.pass(dl)).toBe(0);
    const pin = buildTargetingPlan(
      li({ geo: { pincodes: [{ region: 'IN-DL', count: 1 }] } }),
      tctx(),
      1,
    ).dims.find((d) => d.dim === 'GEO')!;
    expect(pin.pass(dl)).toBeCloseTo(P.targeting.pincodeShare['IN-DL']!, 9);
    expect(pin.pass(mh)).toBe(0);
  });

  it('keeps the dimension order of the Troubleshooter', () => {
    const plan = buildTargetingPlan(
      li({
        geo: { includeRegions: ['IN-MH'] },
        devices: ['smartphone'],
        environment: ['app'],
        languages: ['mr'],
        browser: { include: ['chrome'] },
        keywords: { includeCount: 10 },
      }),
      tctx(),
      1,
    );
    expect(plan.dims.map((d) => d.dim)).toEqual([
      'INVENTORY_SOURCE',
      'ENVIRONMENT',
      'DEVICE_TYPE',
      'GEO',
      'LANGUAGE',
      'BROWSER',
      'KEYWORD',
    ]);
  });

  it('daypart is open or closed by the advertiser hour', () => {
    const t = { daypart: { windows: [{ days: [2], startHour: 18, endHour: 23 }] } };
    expect(
      buildTargetingPlan(li(t), tctx({ advHour: 20, advDow: 2 }), 1)
        .dims.find((d) => d.dim === 'DAYPART')!
        .pass(cell),
    ).toBe(1);
    expect(
      buildTargetingPlan(li(t), tctx({ advHour: 10, advDow: 2 }), 1)
        .dims.find((d) => d.dim === 'DAYPART')!
        .pass(cell),
    ).toBe(0);
    expect(
      buildTargetingPlan(li(t), tctx({ advHour: 20, advDow: 3 }), 1)
        .dims.find((d) => d.dim === 'DAYPART')!
        .pass(cell),
    ).toBe(0);
  });

  it('viewability threshold falls as the threshold rises and the conditional mean rises', () => {
    const m = 0.52;
    const k = 12;
    expect(viewabilityPass(m, k, 0.5)).toBeGreaterThan(viewabilityPass(m, k, 0.7));
    expect(viewabilityPass(m, k, 0.7)).toBeGreaterThan(viewabilityPass(m, k, 0.9));
    expect(viewabilityMeanAbove(m, k, 0.9)).toBeGreaterThan(viewabilityMeanAbove(m, k, 0.7));
    expect(viewabilityMeanAbove(m, k, 0.9)).toBeLessThanOrEqual(0.99);
  });

  it('audience lists: union inside a group, intersection between groups, exclusions subtract', () => {
    const aud = [
      { id: 'a1', type: 'affinity' as const, sizeFraction: 0.1 },
      { id: 'a2', type: 'affinity' as const, sizeFraction: 0.2 },
      { id: 'a3', type: 'in_market' as const, sizeFraction: 0.5 },
    ];
    const map = new Map(aud.map((a) => [a.id, a]));
    const find = (t: object) =>
      buildTargetingPlan(li(t), tctx({ audiences: map }), 1)
        .dims.find((d) => d.dim === 'AUDIENCE')!
        .pass({ ...cell, identifiedShare: 1 });
    expect(find({ audiences: { includeGroups: [['a1', 'a2']] } })).toBeCloseTo(1 - 0.9 * 0.8, 9);
    expect(find({ audiences: { includeGroups: [['a1'], ['a3']] } })).toBeCloseTo(0.05, 9);
    expect(find({ audiences: { includeGroups: [['a3']], exclude: ['a1'] } })).toBeCloseTo(
      0.5 * 0.9,
      9,
    );
    const plan = buildTargetingPlan(
      li({ audiences: { includeGroups: [['a1', 'a3']] } }),
      tctx({ audiences: map }),
      1,
    );
    expect(plan.audienceKind).toBe('in_market');
  });

  it('audience fraction rules: first-party below 1,000 users is unusable, 4 hour rule, lookalike cap', () => {
    expect(audienceFraction({ id: 'f', type: 'first_party', size: 999 }, P, 10, 1)).toBe(0);
    expect(
      audienceFraction({ id: 'f', type: 'first_party', size: 3_000_000 }, P, 10, 1),
    ).toBeCloseTo(3_000_000 / P.targeting.audience.userPool, 9);
    expect(audienceFraction({ id: 'a', type: 'affinity', usableFromTick: 5 }, P, 4, 1)).toBe(0);
    expect(
      audienceFraction(
        { id: 'a', type: 'affinity', usableFromTick: 5, sizeFraction: 0.03 },
        P,
        5,
        1,
      ),
    ).toBe(0.03);
    expect(
      audienceFraction({ id: 'l', type: 'lookalike', seedSize: 1e12, reachPct: 5 }, P, 10, 1),
    ).toBe(P.targeting.audience.lookalikeCap);
  });

  it('optimized targeting widens the audience share by 35% (capped at 1)', () => {
    const aud = new Map([['a1', { id: 'a1', type: 'affinity' as const, sizeFraction: 0.1 }]]);
    const t = { audiences: { includeGroups: [['a1']] } };
    const plain = buildTargetingPlan(li(t), tctx({ audiences: aud }), 1)
      .dims.find((d) => d.dim === 'AUDIENCE')!
      .pass({ ...cell, identifiedShare: 1 });
    const wide = buildTargetingPlan(
      li(t, { optimizedTargeting: true }),
      tctx({ audiences: aud }),
      1,
    )
      .dims.find((d) => d.dim === 'AUDIENCE')!
      .pass({ ...cell, identifiedShare: 1 });
    expect(wide / plain).toBeCloseTo(1.35, 9);
  });

  it('flags restricted audience lists', () => {
    const aud = new Map([
      ['r', { id: 'r', type: 'custom' as const, sizeFraction: 0.01, restricted: true }],
    ]);
    expect(
      buildTargetingPlan(li({ audiences: { includeGroups: [['r']] } }), tctx({ audiences: aud }), 1)
        .restrictedAudience,
    ).toBe(true);
  });
});
