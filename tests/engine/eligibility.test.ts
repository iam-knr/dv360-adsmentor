import { describe, expect, it } from 'vitest';
import { tickToLocal } from '@/lib/engine/calendar';
import { runFunnel, type FunnelInput } from '@/lib/engine/eligibility/funnel';
import {
  applyWins,
  avgPriorExposures,
  cappedShare,
  lifetimeReached,
  newFreqState,
  newUserShare,
  refreshFreqState,
  remainingCapacity,
  scopesFor,
  windowTicksOf,
} from '@/lib/engine/eligibility/frequency';
import { creativeMask, creativeQuality } from '@/lib/engine/eligibility/creatives';
import { REASON_LABELS, reasonLabel, stageOfCode } from '@/lib/engine/eligibility/reasons';
import { supplyCells } from '@/lib/engine/supply/cells';
import { SIM_START_MS, baseWorld, creativeFor, ioOf, liOf } from '@/lib/engine/testing/fixtures';
import {
  indexWorld,
  type CreativeEntity,
  type LineItemEntity,
  type World,
} from '@/lib/engine/world';
import { params } from './helpers';

const P = params.params;

function funnel(li: LineItemEntity, world: World, over: Partial<FunnelInput> = {}) {
  const idx = indexWorld(world);
  const io = idx.ios.get(li.ioId);
  const cells = supplyCells(
    { country: 'IN', marketSeed: world.marketSeed, simStartMs: SIM_START_MS, tzOffsetMin: 330 },
    P,
    params.hash,
    12,
    li.type === 'DISPLAY' ? ['display', 'native'] : ['video_instream'],
  );
  return runFunnel({
    li,
    io,
    campaign: io ? idx.campaigns.get(io.campaignId) : undefined,
    advertiser: world.advertiser,
    index: idx,
    params: P,
    tick: 12,
    advLocal: tickToLocal(SIM_START_MS, 330, 12),
    cells: cells.filter((c) => c.requests > 0),
    freq: {},
    reach: undefined,
    liveTicks: 100,
    poolScale: 1,
    ...over,
  });
}

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
/** Display creatives that cover every slot size, so tests of targeting see no creative filtering. */
const fullCreatives = (): CreativeEntity[] => [
  ...SIZES.map((size, i) => ({ ...creativeFor('display', `full-${i}`), size })),
  ...SIZES.map((size, i) => ({ ...creativeFor('native', `nat-${i}`), size })),
];
const fullIds = [...SIZES.map((_, i) => `full-${i}`), ...SIZES.map((_, i) => `nat-${i}`)];
const world = (creatives: CreativeEntity[] = fullCreatives()): World =>
  baseWorld({ insertionOrders: [ioOf()], creatives });
/** Display line item with full creative coverage and the given targeting. */
const displayLi = (targeting: object = {}, over: Partial<LineItemEntity> = {}): LineItemEntity => ({
  ...liOf('li1', 'display'),
  creativeIds: fullIds,
  ...over,
  targeting: { formats: ['display'], ...targeting },
});

describe('funnel conservation (engine.md 3.4)', () => {
  it('every cell adds up to its requests with non-negative integer counts', () => {
    const w = world();
    const li = displayLi({
      geo: { includeRegions: ['IN-MH', 'IN-KA'] },
      devices: ['smartphone'],
      keywords: { includeCount: 8 },
      languages: ['mr', 'kn', 'en'],
    });
    const e = funnel(li, w);
    expect(e.cells.length).toBeGreaterThan(100);
    for (const c of e.cells) {
      const cuts = c.codes
        .filter(([code]) => !code.startsWith('F.'))
        .reduce((a, [, n]) => a + n, 0);
      expect(cuts + c.nE).toBe(c.nA);
      expect(c.nSurv).toBe(c.nE);
      for (const [, n] of c.codes) {
        expect(Number.isInteger(n)).toBe(true);
        expect(n).toBeGreaterThan(0);
      }
    }
    expect(e.totals.A).toBe(e.cells.reduce((a, c) => a + c.nA, 0));
    expect(e.totals.E).toBeLessThan(e.totals.A);
  });

  it('blames the first failing dimension in canonical order', () => {
    const w = world();
    const li = displayLi({ devices: ['smartphone'], geo: { includeRegions: ['IN-MH'] } });
    const e = funnel(li, w);
    const cell = (pred: (c: (typeof e.cells)[number]['cell']) => boolean) =>
      e.cells.find((c) => pred(c.cell) && c.nA > 200)!;
    // not a smartphone and not Maharashtra: device type comes before geography
    const both = cell((c) => c.device === 'computer' && c.region !== 'IN-MH');
    expect(both.codes.map(([k]) => k)).toContain('T.DEVICE_TYPE');
    expect(both.codes.map(([k]) => k)).not.toContain('T.GEO');
    // smartphone outside Maharashtra: geography
    const geoOnly = cell((c) => c.device === 'smartphone' && c.region !== 'IN-MH');
    expect(
      geoOnly.codes.find(([k]) => k === 'T.GEO')![1] +
        (geoOnly.codes.find(([k]) => k === 'T.INVENTORY_SOURCE')?.[1] ?? 0),
    ).toBe(geoOnly.nA);
    // smartphone in Maharashtra passes
    const pass = cell((c) => c.device === 'smartphone' && c.region === 'IN-MH');
    expect(pass.nE).toBeGreaterThan(0.9 * pass.nA);
  });

  it('removing all targeting passes the format supply (quality ALL)', () => {
    const w = world();
    const li = displayLi({ formats: undefined }, { inventoryQuality: 'ALL' });
    const e = funnel({ ...li, targeting: {}, type: 'DISPLAY' }, w);
    expect(e.totals.E).toBe(e.totals.A);
    expect(e.cells.every((c) => c.codes.length === 0)).toBe(true);
  });

  it('single-region targeting filters most of the supply', () => {
    const w = world();
    const li = displayLi({ geo: { includeRegions: ['IN-MH'] } });
    const e = funnel(li, w);
    const filtered = 1 - e.totals.E / e.totals.A;
    expect(filtered).toBeGreaterThan(0.55);
    expect(filtered).toBeLessThan(0.95);
  });

  it('pools grow with wider targeting', () => {
    const w = world();
    const narrow = funnel(displayLi({ geo: { includeRegions: ['IN-MH'] } }), w);
    const wide = funnel(displayLi({}), w);
    expect(wide.pool).toBeGreaterThan(narrow.pool * 3);
  });
});

describe('creative stage (engine.md 3.4, 6.2)', () => {
  const li = (ids: string[]) => ({ ...liOf('li1', 'display'), creativeIds: ids, targeting: {} });
  const cell = supplyCells(
    { country: 'IN', marketSeed: 'm', simStartMs: SIM_START_MS, tzOffsetMin: 330 },
    P,
    params.hash,
    12,
    ['display'],
  ).find((c) => c.exchangeId === 'google_ad_manager')!;
  const ctx = (creatives: CreativeEntity[]) => ({
    params: P,
    creatives: new Map(creatives.map((c) => [c.id, c])),
    liveTicks: 100,
    date: '2026-11-01',
  });

  it('assigned nothing: everything is C.NONE_ASSIGNED', () => {
    const m = creativeMask(li([]), cell, ctx([]));
    expect(m.steps).toEqual([{ code: 'C.NONE_ASSIGNED', failShare: 1 }]);
    const archived = creativeMask(
      li(['x']),
      cell,
      ctx([{ ...creativeFor('display', 'x'), status: 'ARCHIVED' }]),
    );
    expect(archived.steps[0]!.code).toBe('C.NONE_ASSIGNED');
  });

  it('classifies the approval problem', () => {
    const mk = (over: Partial<CreativeEntity>) =>
      creativeMask(li(['x']), cell, ctx([{ ...creativeFor('display', 'x'), ...over }])).steps[0]!
        .code;
    expect(mk({ approval: { '*': 'PENDING' } })).toBe('C.NOT_APPROVED_EXCHANGE:PENDING');
    expect(mk({ approval: { '*': 'DISAPPROVED' } })).toBe('C.NOT_APPROVED_EXCHANGE:DISAPPROVED');
    expect(mk({ dv360Servable: false })).toBe('C.NOT_APPROVED_EXCHANGE:DV360_NOT_SERVABLE');
    expect(mk({ approval: { '*': 'APPROVED', google_ad_manager: 'DISAPPROVED' } })).toBe(
      'C.NOT_APPROVED_EXCHANGE:DISAPPROVED',
    );
  });

  it('fails the slot mass the creative sizes do not cover', () => {
    const one = creativeMask(
      li(['x']),
      cell,
      ctx([{ ...creativeFor('display', 'x'), size: '300x250' }]),
    );
    expect(one.steps.find((s) => s.code === 'C.SIZE_MISMATCH')!.failShare).toBeCloseTo(0.7, 9);
    const two = creativeMask(
      li(['x', 'y']),
      cell,
      ctx([
        { ...creativeFor('display', 'x'), size: '300x250' },
        { ...creativeFor('display', 'y'), size: '320x50' },
      ]),
    );
    expect(two.steps.find((s) => s.code === 'C.SIZE_MISMATCH')!.failShare).toBeCloseTo(0.52, 9);
  });

  it('geo policy, format mismatch and environment requirement', () => {
    const geo = creativeMask(
      li(['x']),
      cell,
      ctx([{ ...creativeFor('display', 'x'), restrictedRegions: [cell.region] }]),
    );
    expect(geo.steps.at(-1)!.code).toBe('C.GEO_POLICY');
    const fmt = creativeMask(li(['x']), cell, ctx([creativeFor('audio', 'x')]));
    expect(fmt.steps.at(-1)!.code).toBe('C.FORMAT_MISMATCH');
    const web = { ...cell, environment: 'web' as const };
    const env = creativeMask(
      li(['x']),
      web,
      ctx([{ ...creativeFor('display', 'x'), mraid: true }]),
    );
    expect(env.steps.at(-1)!.code).toBe('C.ENV_REQUIREMENT');
    expect(env.choices).toHaveLength(0);
  });

  it('splits wins evenly during the exploration period and by quality afterwards', () => {
    const a = { ...creativeFor('display', 'a'), qualityOverride: 1.3 };
    const b = { ...creativeFor('display', 'b'), qualityOverride: 0.7 };
    const early = creativeMask(li(['a', 'b']), cell, { ...ctx([a, b]), liveTicks: 3 });
    expect(early.choices.map((c) => c.share)).toEqual([0.5, 0.5]);
    const late = creativeMask(li(['a', 'b']), cell, ctx([a, b]));
    expect(late.choices[0]!.share).toBeGreaterThan(0.6);
    expect(late.choices.reduce((s, c) => s + c.share, 0)).toBeCloseTo(1, 9);
    expect(late.quality).toBeGreaterThan(1);
  });

  it('quality stays in 0.7 to 1.3 and honours overrides', () => {
    for (let i = 0; i < 200; i++) {
      const q = creativeQuality(creativeFor('display', `c${i}`), P);
      expect(q).toBeGreaterThanOrEqual(0.7);
      expect(q).toBeLessThanOrEqual(1.3);
    }
    expect(creativeQuality({ ...creativeFor('display', 'z'), qualityOverride: 0.8 }, P)).toBe(0.8);
    expect(creativeQuality({ ...creativeFor('display', 'z'), qualityOverride: 5 }, P)).toBe(1.3);
  });

  it('funnel blames the creative stage when nothing can serve', () => {
    const w = world([]);
    const e = funnel({ ...liOf('li1', 'display'), creativeIds: [], targeting: {} }, w);
    expect(e.totals.E).toBe(0);
    expect(e.cells.every((c) => c.nA === 0 || c.codes.some(([k]) => k === 'C.NONE_ASSIGNED'))).toBe(
      true,
    );
  });
});

describe('frequency model (engine.md 3.9)', () => {
  const li = {
    id: 'l',
    frequency: { mode: 'LIMITED' as const, maxExposures: 3, unit: 'DAY' as const, unitCount: 1 },
  };
  const scope = scopesFor(li, undefined, undefined)[0]!;

  it('resolves scopes in blame order and ignores unlimited caps', () => {
    const io = {
      id: 'i',
      frequency: { mode: 'LIMITED' as const, maxExposures: 5, unit: 'WEEK' as const },
    };
    const camp = { id: 'c', frequency: { mode: 'UNLIMITED' as const } };
    expect(scopesFor(li, io, camp).map((s) => s.kind)).toEqual(['LI', 'IO']);
    expect(scopesFor({ id: 'l', frequency: { mode: 'INHERIT' } }, undefined, undefined)).toEqual(
      [],
    );
    expect(windowTicksOf({ mode: 'LIMITED', maxExposures: 1, unit: 'HOUR', unitCount: 3 })).toBe(3);
    expect(windowTicksOf({ mode: 'LIMITED', maxExposures: 1, unit: 'MINUTE', unitCount: 30 })).toBe(
      1,
    );
    expect(windowTicksOf({ mode: 'LIMITED', maxExposures: 1, unit: 'WEEK', unitCount: 2 })).toBe(
      336,
    );
    expect(windowTicksOf({ mode: 'LIMITED', maxExposures: 1, unit: 'MONTH', unitCount: 1 })).toBe(
      720,
    );
  });

  it('conserves users, caps exposures and never exceeds the cap on average', () => {
    let s = newFreqState(scope, 1000, 0);
    let wins = 0;
    for (let i = 0; i < 40; i++) {
      s = applyWins(s, 300);
      wins += 300;
      expect(s.h.reduce((a, b) => a + b, 0)).toBeCloseTo(1000, 6);
      const reached = 1000 - s.h[0]!;
      const exposures = s.h.reduce((a, n, k) => a + k * n, 0);
      if (reached > 0) expect(exposures / reached).toBeLessThanOrEqual(3 + 1e-9);
    }
    expect(wins).toBeGreaterThan(3000);
    expect(s.h[3]).toBeGreaterThan(900);
    expect(cappedShare(s)).toBeGreaterThan(0.9);
    expect(remainingCapacity(s)).toBeLessThan(150);
  });

  it('capped share grows monotonically inside a window and resets when it rolls', () => {
    let s = newFreqState(scope, 5000, 0);
    let prev = 0;
    for (let i = 0; i < 10; i++) {
      s = applyWins(s, 500);
      const c = cappedShare(s);
      expect(c).toBeGreaterThanOrEqual(prev);
      prev = c;
    }
    expect(prev).toBeGreaterThan(0);
    const rolled = refreshFreqState(s, scope, 5000, 24);
    expect(cappedShare(rolled)).toBe(0);
    expect(rolled.lifetime).toEqual(s.lifetime);
  });

  it('keeps a lifetime histogram for reach and new-user share', () => {
    let s = newFreqState(scope, 10_000, 0);
    expect(newUserShare(s)).toBe(1);
    s = applyWins(s, 4000);
    expect(lifetimeReached(s)).toBeGreaterThan(3000);
    expect(newUserShare(s)).toBeLessThan(0.7);
    expect(avgPriorExposures(s)).toBeGreaterThanOrEqual(0);
  });

  it('rescales histograms when the pool changes', () => {
    let s = newFreqState(scope, 1000, 0);
    s = applyWins(s, 500);
    const bigger = refreshFreqState(s, scope, 2000, 0);
    expect(bigger.U).toBe(2000);
    expect(bigger.h.reduce((a, b) => a + b, 0)).toBeCloseTo(2000, 6);
  });

  it('F codes appear in the funnel when users are capped, and wins fit the remaining capacity', () => {
    const w = world();
    const cap = { mode: 'LIMITED' as const, maxExposures: 2, unit: 'DAY' as const, unitCount: 1 };
    const l = displayLi(
      { geo: { includeRegions: ['IN-MH'] }, exchanges: ['google_ad_manager'] },
      { frequency: cap },
    );
    const first = funnel(l, w);
    let st = newFreqState(first.scopes[0]!, first.pool, 12);
    st = applyWins(st, first.pool * 1.8);
    const e = funnel(l, w, { freq: { [first.scopes[0]!.key]: st } });
    const f = e.cells.flatMap((c) => c.codes).filter(([k]) => k.startsWith('F.'));
    expect(f.length).toBeGreaterThan(0);
    const surv = e.cells.reduce((a, c) => a + c.nSurv, 0);
    expect(surv).toBeLessThanOrEqual(Math.ceil(remainingCapacity(st)) + 1);
    for (const c of e.cells) expect(c.nSurv + c.codes.reduce((a, [, n]) => a + n, 0)).toBe(c.nA);
  });
});

describe('reason codes', () => {
  it('map to stages and labels', () => {
    expect(stageOfCode('T.GEO')).toBe('TARGETING');
    expect(stageOfCode('C.SIZE_MISMATCH')).toBe('CREATIVE');
    expect(stageOfCode('F.LINE_ITEM')).toBe('FREQUENCY');
    expect(stageOfCode('B.IO_SEGMENT')).toBe('BUDGET');
    expect(stageOfCode('P.IO_PACING')).toBe('PACING');
    expect(stageOfCode('A.BELOW_MIN_BID')).toBe('AUCTION');
    expect(stageOfCode('E.OTHER')).toBe('EXTERNAL');
    expect(stageOfCode('M.AVAILABLE')).toBe('AVAILABLE');
    expect(stageOfCode('M.WON')).toBe('WON');
    expect(reasonLabel('T.GEO')).toBe('Geography');
    expect(reasonLabel('X.UNKNOWN')).toBe('X.UNKNOWN');
    expect(Object.keys(REASON_LABELS).length).toBeGreaterThan(40);
  });
});
