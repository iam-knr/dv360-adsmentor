import { describe, expect, it } from 'vitest';
import {
  conflictsForIo,
  conflictsForLi,
  evaluateAlerts,
  lifecycleStatus,
  liveStatusFromFunnel,
  lostKeyOf,
  reconcileAlerts,
  reconcileSuggestions,
  suggestionsFor,
  totalsOf,
  type AlertContext,
  type FunnelRow,
  type LiAlertFacts,
} from '@/lib/engine/diagnostics';
import { baseWorld, ioOf, liOf, smallWorld } from '@/lib/engine/testing/fixtures';
import { funnelFor, params, runTicks } from './helpers';
import { recordFunnel } from '@/lib/engine/diagnostics';

const P = params.params;
const row = (reasonCode: string, count: number): FunnelRow => ({
  lineItemId: 'l',
  date: '2026-11-01',
  exchangeId: 'x',
  stage: 'AVAILABLE',
  reasonCode,
  count,
});

describe('funnel recorder (engine.md 3.5)', () => {
  it('writes milestones and non-zero reasons per exchange, sorted', () => {
    const { elig } = funnelFor(smallWorld(), 'li1');
    const rows = recordFunnel('li1', '2026-11-01', elig, undefined);
    expect(rows.length).toBeGreaterThan(5);
    expect(rows.every((r) => r.count > 0)).toBe(true);
    const A = rows.filter((r) => r.reasonCode === 'M.AVAILABLE').reduce((a, r) => a + r.count, 0);
    expect(A).toBe(elig.totals.A);
    const keys = rows.map((r) => `${r.exchangeId}|${r.reasonCode}`);
    expect(keys).toEqual([...keys].sort());
    expect(new Set(rows.map((r) => r.stage))).toContain('TARGETING');
  });

  it('maps reason codes to the win/loss metric columns (9.2)', () => {
    expect(lostKeyOf('T.GEO')).toBe('lostTargeting');
    expect(lostKeyOf('C.SIZE_MISMATCH')).toBe('lostCreative');
    expect(lostKeyOf('F.CAMPAIGN')).toBe('lostFrequency');
    expect(lostKeyOf('B.IO_DAILY')).toBe('lostBudget');
    expect(lostKeyOf('P.IO_ALLOCATION')).toBe('lostPacing');
    expect(lostKeyOf('A.BELOW_MIN_BID')).toBe('lostBelowMinBid');
    expect(lostKeyOf('A.LOST_INTERNAL:OWN_LINE_ITEM')).toBe('lostInternal');
    expect(lostKeyOf('E.BID_TOO_LOW')).toBe('lostExternalBid');
    expect(lostKeyOf('E.LOST_NOT_REPORTED')).toBe('lostNotReported');
    expect(lostKeyOf('M.WON')).toBeNull();
  });

  it('M.WON equals the impressions of the hourly rows before IVT refunds', () => {
    const { outputs } = runTicks(smallWorld(), 0, 6);
    const won = outputs
      .flatMap((o) => o.funnel)
      .filter((r) => r.reasonCode === 'M.WON')
      .reduce((a, r) => a + r.count, 0);
    const impr = outputs.flatMap((o) => o.hourly).reduce((a, h) => a + h.metrics.impressions, 0);
    const billable = outputs
      .flatMap((o) => o.hourly)
      .reduce((a, h) => a + h.metrics.billableImpressions, 0);
    expect(won).toBe(impr);
    expect(billable).toBeLessThan(impr);
  });

  it('adds up the totals by reason code', () => {
    const t = totalsOf([row('T.GEO', 5), row('T.GEO', 7), row('M.WON', 1)]);
    expect(t.get('T.GEO')).toBe(12);
  });
});

describe('lifecycle status (engine.md 3.1, 3.6)', () => {
  const w = baseWorld({ insertionOrders: [ioOf()] });
  const io = w.insertionOrders[0]!;
  const camp = w.campaigns[0]!;
  const li = liOf('l', 'display');
  const st = (l = li, i = io, c = camp, d = '2026-11-05') => lifecycleStatus(l, i, c, d);

  it('is null for a live line item', () => {
    expect(st()).toBeNull();
  });

  it('reports the entity states that keep a line item out of the funnel', () => {
    expect(st({ ...li, status: 'PAUSED' })).toBe('PAUSED');
    expect(st({ ...li, status: 'DRAFT' })).toBe('DRAFT');
    expect(st({ ...li, status: 'ARCHIVED' })).toBe('ARCHIVED');
    expect(st(li, { ...io, status: 'PAUSED' })).toBe('PARENT_PAUSED');
    expect(st(li, io, { ...camp, status: 'PAUSED' })).toBe('PARENT_PAUSED');
    expect(lifecycleStatus(li, undefined, camp, '2026-11-05')).toBe('PARENT_PAUSED');
  });

  it('reports flight dates and budget segments', () => {
    expect(st({ ...li, flight: { start: '2026-11-10', end: '2026-11-20' } })).toBe('NOT_STARTED');
    expect(st({ ...li, flight: { start: '2026-11-01', end: '2026-11-04' } })).toBe('ENDED');
    expect(st(li, io, camp, '2026-10-30')).toBe('NOT_STARTED');
    expect(st(li, io, camp, '2026-12-05')).toBe('ENDED');
    expect(st(li, { ...io, segments: [] })).toBe('NO_BUDGET_SEGMENT');
    const gap = {
      ...io,
      segments: [
        { id: 'a', amount: 1, startDay: '2026-11-01', endDay: '2026-11-03' },
        { id: 'b', amount: 1, startDay: '2026-11-10', endDay: '2026-11-20' },
      ],
    };
    expect(st(li, gap)).toBe('NO_BUDGET_SEGMENT');
  });
});

describe('live status from the funnel (engine.md 3.6)', () => {
  const rows = (o: Record<string, number>): FunnelRow[] =>
    Object.entries(o).map(([k, v]) => row(k, v));

  it('delivering when nothing dominates', () => {
    expect(
      liveStatusFromFunnel(
        rows({
          'M.AVAILABLE': 1000,
          'M.ELIGIBLE': 900,
          'M.BIDS_SUBMITTED': 800,
          'T.GEO': 100,
          'M.WON': 200,
        }),
      ).status,
    ).toBe('ACTIVE_DELIVERING');
  });

  it('limited by targeting above 95% of available', () => {
    const s = liveStatusFromFunnel(rows({ 'M.AVAILABLE': 1000, 'T.GEO': 970, 'M.ELIGIBLE': 30 }));
    expect(s.status).toBe('ACTIVE_LIMITED_BY_TARGETING');
    expect(s.topLoss).toBe('T.GEO');
  });

  it('limited by creatives above 50%', () => {
    expect(
      liveStatusFromFunnel(rows({ 'M.AVAILABLE': 1000, 'C.SIZE_MISMATCH': 600, 'M.ELIGIBLE': 400 }))
        .status,
    ).toBe('ACTIVE_LIMITED_BY_CREATIVES');
  });

  it('limited by budget when most survivors are filtered as budget', () => {
    expect(
      liveStatusFromFunnel(rows({ 'M.AVAILABLE': 1000, 'M.ELIGIBLE': 1000, 'B.IO_SEGMENT': 800 }))
        .status,
    ).toBe('ACTIVE_LIMITED_BY_BUDGET');
  });

  it('limited by bid when over 70% of bids are lost to floors or competitors', () => {
    expect(
      liveStatusFromFunnel(
        rows({
          'M.AVAILABLE': 1000,
          'M.ELIGIBLE': 1000,
          'M.BIDS_SUBMITTED': 1000,
          'A.BELOW_MIN_BID': 300,
          'E.BID_TOO_LOW': 500,
        }),
      ).status,
    ).toBe('ACTIVE_LIMITED_BY_BID');
  });
});

describe('alerts (engine.md 3.7, RC-013)', () => {
  const li = (over: Partial<LiAlertFacts> = {}): LiAlertFacts => ({
    id: 'l1',
    ioId: 'io1',
    live: true,
    spendToday: 0,
    spendYesterday: 0,
    liveTicksToday: 8,
    liveTicksYesterday: 24,
    conflicts: [],
    eligibleRequestsPerHour: 100_000,
    underpacingOn: false,
    allCreativesDisapproved: false,
    someCreativeDisapproved: false,
    creativeRestricted: false,
    restrictedAudience: false,
    ...over,
  });
  const ctx = (lis: LiAlertFacts[], over: Partial<AlertContext> = {}): AlertContext => ({
    params: P,
    prefs: {},
    lis,
    ios: [
      {
        id: 'io1',
        live: true,
        liIds: lis.map((l) => l.id),
        conflicts: [],
        underpacing: false,
        underperforming: false,
      },
    ],
    advertiserId: 'a1',
    advertiserSpendYesterday: 0,
    hourOfDay: 8,
    ...over,
  });
  const codes = (c: AlertContext) => evaluateAlerts(c).map((a) => `${a.code}:${a.scopeId}`);

  it('raises NO_SPEND for a line item and its insertion order', () => {
    expect(codes(ctx([li()]))).toEqual(
      expect.arrayContaining(['NO_SPEND_LI:l1', 'NO_SPEND_IO:io1']),
    );
    const a = evaluateAlerts(ctx([li()])).find((x) => x.code === 'NO_SPEND_LI')!;
    expect(a.severity).toBe('CRITICAL');
  });

  it('waits six ticks into the day and respects yesterday', () => {
    expect(codes(ctx([li({ liveTicksToday: 3 })]))).not.toContain('NO_SPEND_LI:l1');
    expect(codes(ctx([li({ spendYesterday: 50 })]))).not.toContain('NO_SPEND_LI:l1');
    expect(codes(ctx([li({ spendToday: 10 })]))).not.toContain('NO_SPEND_LI:l1');
    // started today: only alert after a full day of eligibility
    expect(codes(ctx([li({ liveTicksYesterday: 0, liveTicksToday: 10 })]))).not.toContain(
      'NO_SPEND_LI:l1',
    );
    expect(codes(ctx([li({ liveTicksYesterday: 0, liveTicksToday: 24 })]))).toContain(
      'NO_SPEND_LI:l1',
    );
  });

  it('an alert switched off in the preferences is never created', () => {
    expect(
      codes(ctx([li()], { prefs: { enabled: { NO_SPEND_LI: false, NO_SPEND_IO: false } } })),
    ).toEqual([]);
  });

  it('flags conflicts, limited audience, restricted lists, rejected and restricted creatives', () => {
    const c = codes(
      ctx([
        li({
          spendToday: 5,
          conflicts: ['CONF.X'],
          eligibleRequestsPerHour: 100,
          underpacingOn: true,
          restrictedAudience: true,
          someCreativeDisapproved: true,
          allCreativesDisapproved: true,
          creativeRestricted: true,
        }),
      ]),
    );
    expect(c).toEqual(
      expect.arrayContaining([
        'CONFLICT_LI:l1',
        'LIMITED_AUDIENCE_LI:l1',
        'RESTRICTED_AUDIENCE_LIST_LI:l1',
        'CREATIVE_REJECTED:l1',
        'CREATIVE_RESTRICTED:l1',
      ]),
    );
    const rej = evaluateAlerts(
      ctx([li({ spendToday: 5, someCreativeDisapproved: true, allCreativesDisapproved: false })]),
    ).find((a) => a.code === 'CREATIVE_REJECTED')!;
    expect(rej.severity).toBe('NEEDS_ATTENTION');
  });

  it('flags underpacing, underperforming and conflicting insertion orders', () => {
    const c = ctx([li({ spendToday: 5 })]);
    c.ios = [
      {
        id: 'io1',
        live: true,
        liIds: ['l1'],
        conflicts: ['CONF.Y'],
        underpacing: true,
        underperforming: true,
      },
    ];
    expect(codes(c)).toEqual(
      expect.arrayContaining(['UNDERPACING_IO:io1', 'UNDERPERFORMING_IO:io1', 'CONFLICT_IO:io1']),
    );
  });

  it('the spend threshold alert is off unless enabled with a threshold', () => {
    const base = ctx([li({ spendToday: 5 })], { advertiserSpendYesterday: 900 });
    expect(codes(base)).not.toContain('SPEND_THRESHOLD:a1');
    const on = { ...base, prefs: { enabled: { SPEND_THRESHOLD: true }, spendThreshold: 500 } };
    expect(codes(on)).toContain('SPEND_THRESHOLD:a1');
  });

  it('resolves only after the condition has been clear for two consecutive ticks', () => {
    const a = evaluateAlerts(ctx([li()])).filter((x) => x.code === 'NO_SPEND_LI');
    let tr = reconcileAlerts({}, a, 10, 2);
    expect(tr.decisions.map((d) => d.action)).toEqual(['RAISE']);
    expect(tr.decisions[0]!.raisedAtTick).toBe(10);
    tr = reconcileAlerts(tr.next, a, 11, 2);
    expect(tr.decisions).toEqual([]);
    tr = reconcileAlerts(tr.next, [], 12, 2);
    expect(tr.decisions).toEqual([]);
    tr = reconcileAlerts(tr.next, a, 13, 2);
    expect(tr.decisions).toEqual([]);
    tr = reconcileAlerts(tr.next, [], 14, 2);
    tr = reconcileAlerts(tr.next, [], 15, 2);
    expect(tr.decisions).toHaveLength(1);
    expect(tr.decisions[0]).toMatchObject({
      action: 'RESOLVE',
      code: 'NO_SPEND_LI',
      scopeId: 'l1',
      raisedAtTick: 10,
      resolvedAtTick: 15,
      severity: 'CRITICAL',
    });
    expect(Object.keys(tr.next)).toEqual([]);
  });
});

describe('conflicting settings (engine.md 3.8)', () => {
  const io = ioOf();
  const enabled = Object.keys(P.exchanges);
  const li = liOf('l', 'display');

  it('flags contradictory targeting and flights', () => {
    expect(
      conflictsForLi(
        { ...li, targeting: { geo: { includeRegions: ['IN-DL'], excludeRegions: ['IN-DL'] } } },
        io,
        P,
        '2026-11-05',
        enabled,
      ),
    ).toContain('CONF.TARGET_ZERO_OVERLAP');
    expect(
      conflictsForLi(
        { ...li, flight: { start: '2027-01-01', end: '2027-02-01' } },
        io,
        P,
        '2026-11-05',
        enabled,
      ),
    ).toContain('CONF.LI_FLIGHT_OUTSIDE_IO');
  });

  it('flags IO automation with a paced line item and missing conversion inputs', () => {
    expect(
      conflictsForLi(
        { ...li, pacing: { period: 'FLIGHT', type: 'EVEN' } },
        { ...io, bidBudgetControl: 'IO_AUTOMATED' },
        P,
        '2026-11-05',
        enabled,
      ),
    ).toContain('CONF.ASAP_VS_AUTOMATION');
    expect(
      conflictsForLi(
        { ...li, bid: { kind: 'AUTOMATED', goal: 'TARGET_CPA', targetValue: 500 }, floodlight: [] },
        io,
        P,
        '2026-11-05',
        enabled,
      ),
    ).toContain('CONF.NO_CONVERSION_ACTIVITY');
  });

  it('flags a fixed bid under every floor and an unrealistic target', () => {
    expect(
      conflictsForLi(
        { ...li, bid: { kind: 'FIXED', fixedCpm: 0.5 } },
        io,
        P,
        '2026-11-05',
        enabled,
      ),
    ).toContain('CONF.BID_BELOW_FLOOR');
    expect(
      conflictsForLi({ ...li, bid: { kind: 'FIXED', fixedCpm: 78 } }, io, P, '2026-11-05', enabled),
    ).not.toContain('CONF.BID_BELOW_FLOOR');
    expect(
      conflictsForLi(
        { ...li, bid: { kind: 'AUTOMATED', goal: 'TARGET_CPA', targetValue: 5 } },
        io,
        P,
        '2026-11-05',
        enabled,
      ),
    ).toContain('CONF.TARGET_CPA_UNREALISTIC');
  });

  it('flags a daily cap too low for the remaining budget, and line item budgets below the IO budget', () => {
    expect(
      conflictsForLi(
        {
          ...li,
          pacing: { period: 'DAILY', type: 'EVEN', dailyAmount: 10 },
          budget: { mode: 'FIXED', amount: 100_000 },
        },
        io,
        P,
        '2026-11-05',
        enabled,
      ),
    ).toContain('CONF.DAILY_CAP_TOO_LOW');
    const fixed = [{ ...li, id: 'a', budget: { mode: 'FIXED' as const, amount: 1000 } }];
    expect(conflictsForIo(io, fixed, '2026-11-05')).toContain('CONF.LI_BUDGETS_BELOW_IO');
    expect(conflictsForIo(io, [li], '2026-11-05')).toEqual([]);
    expect(
      conflictsForIo(
        { ...io, pacing: { period: 'DAILY', type: 'EVEN', dailyAmount: 100 } },
        [li],
        '2026-11-05',
      ),
    ).toContain('CONF.DAILY_CAP_TOO_LOW');
  });

  it('a clean line item has no conflicts', () => {
    expect(conflictsForLi(li, io, P, '2026-11-05', enabled)).toEqual([]);
  });
});

describe('optimisation suggestions (engine.md 3.7, RC-014)', () => {
  const rows = (o: Record<string, number>) => Object.entries(o).map(([k, v]) => row(k, v));

  it('suggests raising the bid, adding sizes, broadening targeting and learning', () => {
    const s = suggestionsFor(
      {
        liId: 'l',
        learning: true,
        rows: rows({
          'M.AVAILABLE': 1000,
          'M.BIDS_SUBMITTED': 100,
          'A.BELOW_MIN_BID': 40,
          'E.BID_TOO_LOW': 40,
          'C.SIZE_MISMATCH': 400,
          'T.GEO': 960,
        }),
      },
      P,
    );
    expect(s).toEqual(
      expect.arrayContaining(['RAISE_BID', 'ADD_CREATIVES', 'BROADEN_TARGETING', 'BID_LEARNING']),
    );
    expect(
      suggestionsFor(
        {
          liId: 'l',
          learning: false,
          rows: rows({ 'M.AVAILABLE': 1000, 'M.BIDS_SUBMITTED': 100 }),
        },
        P,
      ),
    ).toEqual([]);
  });

  it('suggests optimized targeting from 60% targeting loss when it is off (module 11 4.9)', () => {
    const at = (t: number, optimizedTargeting?: boolean) =>
      suggestionsFor(
        {
          liId: 'l',
          learning: false,
          ...(optimizedTargeting === undefined ? {} : { optimizedTargeting }),
          rows: rows({ 'M.AVAILABLE': 1000, 'T.GEO': t }),
        },
        P,
      );
    expect(at(600, false)).toEqual(['USE_OPTIMIZED_TARGETING']);
    expect(at(599, false)).toEqual([]);
    expect(at(600, true)).toEqual([]);
    expect(at(600)).toEqual([]);
  });

  it('opens a suggestion once and closes it when the condition clears', () => {
    const facts = new Map([
      [
        'RAISE_BID|LINE_ITEM|l',
        { type: 'RAISE_BID' as const, scopeKind: 'LINE_ITEM' as const, scopeId: 'l' },
      ],
    ]);
    const first = reconcileSuggestions({}, new Set(facts.keys()), facts);
    expect(first.decisions.map((d) => d.action)).toEqual(['OPEN']);
    const again = reconcileSuggestions(first.next, new Set(facts.keys()), facts);
    expect(again.decisions).toEqual([]);
    const closed = reconcileSuggestions(again.next, new Set(), new Map());
    expect(closed.decisions).toMatchObject([{ action: 'CLOSE', type: 'RAISE_BID', scopeId: 'l' }]);
    expect(closed.next).toEqual({});
  });
});
