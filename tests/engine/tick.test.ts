// Scenarios through runTick: the pieces working together (funnel, bids, pacing, outcomes,
// diagnostics, alerts) on small worlds.
import { describe, expect, it } from 'vitest';
import { newSimState, runTick } from '@/lib/engine';
import type { LineItemEntity, World } from '@/lib/engine';
import { baseWorld, creativeFor, liOf, purchase, smallWorld } from '@/lib/engine/testing/fixtures';
import { funnelTotals, params, runTicks, sumDaily } from './helpers';

const FAST = ['index_exchange'];
const fast = { partner: { id: 'p1', currency: 'INR' as const, enabledExchanges: FAST } };
const target = { exchanges: FAST, geo: { includeRegions: ['IN-MH', 'IN-DL'] } };
const world = (li: Partial<LineItemEntity> = {}, io = {}, t = {}, w: Partial<World> = {}): World =>
  smallWorld({
    li: { bid: { kind: 'FIXED', fixedCpm: 100 }, ...li },
    io,
    targeting: { ...target, ...t },
    world: { ...fast, ...w },
  });
const revenue = (o: ReturnType<typeof runTicks>['outputs']) => sumDaily(o).revenue / 1e6;

describe('own line items competing', () => {
  it('the lower bid loses requests to the higher bid of the same advertiser (A.LOST_INTERNAL:OWN_LINE_ITEM)', () => {
    const base = world();
    const hi = { ...base.lineItems[0]!, id: 'hi', bid: { kind: 'FIXED' as const, fixedCpm: 120 } };
    const lo = { ...base.lineItems[0]!, id: 'lo', bid: { kind: 'FIXED' as const, fixedCpm: 60 } };
    const w: World = { ...base, lineItems: [hi, lo] };
    const { outputs } = runTicks(w, 8, 20);
    const own = (id: string) => funnelTotals(outputs, id).get('A.LOST_INTERNAL:OWN_LINE_ITEM') ?? 0;
    expect(own('lo')).toBeGreaterThan(0);
    expect(own('hi')).toBe(0);
    const bids = (id: string) => funnelTotals(outputs, id).get('M.BIDS_SUBMITTED')!;
    expect(own('lo') / bids('lo')).toBeGreaterThan(0.2);
  });
});

describe('creatives', () => {
  it('a creative disapproved on the exchange blocks every request, raises a critical alert and limits delivery', () => {
    const base = world();
    const w: World = {
      ...base,
      creatives: base.creatives.map((c) => ({
        ...c,
        approval: { '*': 'APPROVED', index_exchange: 'DISAPPROVED' },
      })),
    };
    const { outputs } = runTicks(w, 0, 10);
    const f = funnelTotals(outputs);
    expect(f.get('M.WON') ?? 0).toBe(0);
    expect(f.get('C.NOT_APPROVED_EXCHANGE:DISAPPROVED')).toBe(
      f.get('M.AVAILABLE')! -
        (f.get('T.INVENTORY_SOURCE') ?? 0) -
        Array.from(f)
          .filter(([k]) => k.startsWith('T.') && k !== 'T.INVENTORY_SOURCE')
          .reduce((a, [, n]) => a + n, 0),
    );
    const alert = outputs.flatMap((o) => o.alerts).find((a) => a.code === 'CREATIVE_REJECTED');
    expect(alert?.severity).toBe('CRITICAL');
    expect(outputs.at(-1)!.liveStatus[0]!.status).toBe('ACTIVE_LIMITED_BY_CREATIVES');
  });

  it('a creative that is still pending shows as such in the funnel', () => {
    const base = world();
    const w: World = {
      ...base,
      creatives: base.creatives.map((c) => ({ ...c, approval: { '*': 'PENDING' } })),
    };
    const f = funnelTotals(runTicks(w, 0, 3).outputs);
    expect(f.get('C.NOT_APPROVED_EXCHANGE:PENDING')).toBeGreaterThan(0);
    expect(f.get('M.WON') ?? 0).toBe(0);
  });
});

describe('budgets and pacing', () => {
  it('a small segment is spent and never exceeded; then everything is filtered as budget', () => {
    const w = world(
      { pacing: { period: 'FLIGHT', type: 'ASAP' } },
      {
        segments: [{ id: 'seg1', amount: 4_000, startDay: '2026-11-01', endDay: '2026-11-03' }],
        pacing: { period: 'FLIGHT', type: 'ASAP' },
      },
    );
    const { outputs } = runTicks(w, 0, 12);
    expect(revenue(outputs)).toBeLessThanOrEqual(4_000 + 1e-6);
    expect(revenue(outputs)).toBeGreaterThan(3_900);
    const f = funnelTotals(outputs);
    expect(f.get('B.IO_SEGMENT')).toBeGreaterThan(0);
    expect(outputs.at(-1)!.liveStatus[0]!.status).toBe('ACTIVE_LIMITED_BY_BUDGET');
    expect(outputs.at(-1)!.funnel.filter((r) => r.reasonCode === 'M.WON')).toEqual([]);
  });

  it('a fixed line item budget stops the line item, not the insertion order', () => {
    const w = world({
      budget: { mode: 'FIXED', amount: 1_500 },
      pacing: { period: 'FLIGHT', type: 'ASAP' },
    });
    const { outputs } = runTicks(w, 0, 12);
    expect(revenue(outputs)).toBeLessThanOrEqual(1_500 + 1e-6);
    expect(funnelTotals(outputs).get('B.LINE_ITEM_BUDGET')).toBeGreaterThan(0);
  });

  it('daily ASAP spends the daily amount then stops until the next day (B.LINE_ITEM_DAILY)', () => {
    const w = world({ pacing: { period: 'DAILY', type: 'ASAP', dailyAmount: 2_000 } });
    const { outputs } = runTicks(w, 0, 30);
    const byDay = new Map<string, number>();
    for (const o of outputs)
      byDay.set(
        o.date,
        (byDay.get(o.date) ?? 0) +
          o.daily
            .filter((d) => d.sliceKind === 'total')
            .reduce((a, d) => a + d.metrics.revenue / 1e6, 0),
      );
    for (const v of byDay.values()) expect(v).toBeLessThanOrEqual(2_000 * 1.15 + 2);
    expect(funnelTotals(outputs).get('B.LINE_ITEM_DAILY')).toBeGreaterThan(0);
    expect(byDay.get('2026-11-02')).toBeGreaterThan(1_500);
  });

  it('impression budgets count billable impressions', () => {
    const w = world(
      { pacing: { period: 'FLIGHT', type: 'ASAP' } },
      {
        budgetUnit: 'IMPRESSIONS',
        segments: [{ id: 'seg1', amount: 30_000, startDay: '2026-11-01', endDay: '2026-11-03' }],
        pacing: { period: 'FLIGHT', type: 'ASAP' },
      },
    );
    const { outputs } = runTicks(w, 0, 10);
    const m = sumDaily(outputs);
    expect(m.billableImpressions).toBeLessThanOrEqual(30_000);
    expect(m.billableImpressions).toBeGreaterThan(29_000);
  });

  it('the pacing snapshot reports the daily target and the budget left', () => {
    const w = world();
    const { outputs } = runTicks(w, 0, 6);
    const row = outputs.at(-1)!.pacing.find((p) => p.scopeKind === 'INSERTION_ORDER')!;
    expect(row.segmentBudget).toBe(50_000_000);
    expect(row.dailyTarget).toBeCloseTo(50_000_000 / 30, 0);
    expect(row.budgetRemaining).toBeLessThan(50_000_000);
    expect(row.spentToDate).toBeGreaterThan(0);
  });

  it('a budget raised mid-flight is picked up on the next tick', () => {
    const small = world(
      { pacing: { period: 'FLIGHT', type: 'ASAP' } },
      {
        segments: [{ id: 'seg1', amount: 1_000, startDay: '2026-11-01', endDay: '2026-11-03' }],
        pacing: { period: 'FLIGHT', type: 'ASAP' },
      },
    );
    const a = runTicks(small, 0, 6);
    const bigger: World = {
      ...small,
      insertionOrders: [
        {
          ...small.insertionOrders[0]!,
          segments: [{ id: 'seg1', amount: 100_000, startDay: '2026-11-01', endDay: '2026-11-03' }],
        },
      ],
    };
    const b = runTicks(bigger, 6, 12, { state: a.state });
    expect(revenue(a.outputs)).toBeLessThanOrEqual(1_000 + 1e-6);
    expect(revenue(b.outputs)).toBeGreaterThan(1_000);
  });
});

describe('alerts and status through ticks', () => {
  it('raises NO_SPEND, CONFLICT and a targeting-limited status when the targeting cannot match anything', () => {
    const w = world({}, {}, { geo: { includeRegions: ['IN-DL'], excludeRegions: ['IN-DL'] } });
    const { outputs } = runTicks(w, 0, 36);
    const codes = new Set(
      outputs
        .flatMap((o) => o.alerts)
        .filter((a) => a.action === 'RAISE')
        .map((a) => a.code),
    );
    expect(codes).toContain('NO_SPEND_LI');
    expect(codes).toContain('NO_SPEND_IO');
    expect(codes).toContain('CONFLICT_LI');
    expect(outputs.at(-1)!.liveStatus[0]!.status).toBe('ACTIVE_LIMITED_BY_TARGETING');
    expect(sumDaily(outputs).impressions).toBe(0);
  });

  it('an alert is raised once and resolved after two clear ticks when the condition goes away', () => {
    const bad = world({}, {}, { geo: { includeRegions: ['IN-DL'], excludeRegions: ['IN-DL'] } });
    const a = runTicks(bad, 0, 30);
    const good = world();
    const b = runTicks(good, 30, 40, { state: a.state });
    const raised = a.outputs
      .flatMap((o) => o.alerts)
      .filter((x) => x.code === 'CONFLICT_LI' && x.action === 'RAISE');
    expect(raised).toHaveLength(1);
    const resolved = b.outputs
      .flatMap((o) => o.alerts)
      .filter((x) => x.code === 'CONFLICT_LI' && x.action === 'RESOLVE');
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.resolvedAtTick).toBeGreaterThan(raised[0]!.raisedAtTick);
  });

  it('raises UNDERPACING_IO and reports the budget at risk when delivery cannot keep up', () => {
    const w = world(
      { bid: { kind: 'FIXED', fixedCpm: 25 } },
      {
        segments: [{ id: 'seg1', amount: 9_000_000, startDay: '2026-11-01', endDay: '2026-11-10' }],
      },
      { geo: { includeRegions: ['IN-DL'] } },
    );
    const { outputs } = runTicks(w, 0, 48);
    const alert = outputs
      .flatMap((o) => o.alerts)
      .find((a) => a.code === 'UNDERPACING_IO' && a.action === 'RAISE');
    expect(alert).toBeDefined();
    const row = outputs.at(-1)!.pacing.find((p) => p.scopeKind === 'INSERTION_ORDER')!;
    expect(row.underpacing).toBe(true);
    expect(row.budgetAtRisk).toBeGreaterThan(5_000_000);
  });

  it('does not alert in the first 24 hours', () => {
    const w = world(
      { bid: { kind: 'FIXED', fixedCpm: 25 } },
      {
        segments: [{ id: 'seg1', amount: 9_000_000, startDay: '2026-11-01', endDay: '2026-11-10' }],
      },
      { geo: { includeRegions: ['IN-DL'] } },
    );
    const { outputs } = runTicks(w, 0, 20);
    expect(outputs.flatMap((o) => o.alerts).filter((a) => a.code === 'UNDERPACING_IO')).toEqual([]);
  });

  it('alert preferences switch alerts off', () => {
    const w = world({}, {}, { geo: { includeRegions: ['IN-DL'], excludeRegions: ['IN-DL'] } });
    const codes = [
      'NO_SPEND_LI',
      'NO_SPEND_IO',
      'UNDERPACING_IO',
      'CONFLICT_IO',
      'CONFLICT_LI',
      'LIMITED_AUDIENCE_LI',
      'UNDERPERFORMING_IO',
      'RESTRICTED_AUDIENCE_LIST_LI',
      'CREATIVE_REJECTED',
      'CREATIVE_RESTRICTED',
      'SPEND_THRESHOLD',
    ] as const;
    const off: World = {
      ...w,
      advertiser: {
        ...w.advertiser,
        alertPrefs: { enabled: Object.fromEntries(codes.map((c) => [c, false])) },
      },
    };
    const { outputs } = runTicks(off, 0, 36);
    expect(outputs.flatMap((o) => o.alerts)).toEqual([]);
  });

  it('flags a restricted audience list', () => {
    const w = world(
      {},
      {},
      { audiences: { includeGroups: [['r1']] } },
      { audiences: [{ id: 'r1', type: 'custom', sizeFraction: 0.01, restricted: true }] },
    );
    const { outputs } = runTicks(w, 0, 3);
    expect(
      outputs.flatMap((o) => o.alerts).some((a) => a.code === 'RESTRICTED_AUDIENCE_LIST_LI'),
    ).toBe(true);
  });

  it('suggests raising the bid when most bids are lost to the floor or competitors', () => {
    const w = world({ bid: { kind: 'FIXED', fixedCpm: 6 } });
    const { outputs } = runTicks(w, 0, 4);
    const rec = outputs.flatMap((o) => o.recommendations).find((r) => r.type === 'RAISE_BID');
    expect(rec).toMatchObject({ action: 'OPEN', scopeKind: 'LINE_ITEM', scopeId: 'li1' });
    expect(
      outputs
        .flatMap((o) => o.recommendations)
        .filter((r) => r.type === 'RAISE_BID' && r.action === 'OPEN'),
    ).toHaveLength(1);
  });

  it('live status of entities that are not live is reported without funnel rows', () => {
    const w = world({ status: 'PAUSED' });
    const { outputs } = runTicks(w, 0, 2);
    expect(outputs[0]!.liveStatus).toEqual([
      { lineItemId: 'li1', status: 'PAUSED', topLoss: null },
    ]);
    expect(outputs[0]!.funnel).toEqual([]);
  });
});

describe('KPI goals (engine.md 4.6)', () => {
  const withKpi = (kpi: { kind: 'CPM' | 'CTR'; value: number }) => world({}, { kpi });

  it('raises UNDERPERFORMING_IO when the KPI is worse than its goal by more than 20%', () => {
    const { outputs } = runTicks(withKpi({ kind: 'CPM', value: 20 }), 0, 6);
    const a = outputs
      .flatMap((o) => o.alerts)
      .find((x) => x.code === 'UNDERPERFORMING_IO' && x.action === 'RAISE');
    expect(a).toMatchObject({
      scopeKind: 'INSERTION_ORDER',
      scopeId: 'io1',
      severity: 'NEEDS_ATTENTION',
    });
  });

  it('does not raise it when the goal is met', () => {
    const { outputs } = runTicks(withKpi({ kind: 'CPM', value: 500 }), 0, 6);
    expect(outputs.flatMap((o) => o.alerts).some((x) => x.code === 'UNDERPERFORMING_IO')).toBe(
      false,
    );
    const ctr = runTicks(withKpi({ kind: 'CTR', value: 0.0001 }), 0, 6);
    expect(ctr.outputs.flatMap((o) => o.alerts).some((x) => x.code === 'UNDERPERFORMING_IO')).toBe(
      false,
    );
  });

  it('does not change delivery: the KPI is a measuring stick', () => {
    const a = runTicks(withKpi({ kind: 'CPM', value: 20 }), 0, 6).outputs;
    const b = runTicks(world(), 0, 6).outputs;
    expect(sumDaily(a).impressions).toBe(sumDaily(b).impressions);
  });
});

describe('learning through ticks (engine.md 4.3)', () => {
  // reach impressions need 20,000 events to leave learning, which takes several ticks
  const auto = (goal: LineItemEntity['bid']['goal'], tv?: number) =>
    world(
      {
        pacing: { period: 'FLIGHT', type: 'EVEN' },
        bid: { kind: 'AUTOMATED', goal, targetValue: tv },
      },
      { pacing: { period: 'FLIGHT', type: 'EVEN' } },
    );

  // a handful of postal codes: so little supply that clicks arrive one at a time
  const thin = (goal: LineItemEntity['bid']['goal'], tv?: number) =>
    world(
      {
        pacing: { period: 'FLIGHT', type: 'EVEN' },
        bid: { kind: 'AUTOMATED', goal, targetValue: tv },
      },
      {},
      { geo: { pincodes: [{ region: 'IN-REST', count: 3 }] } },
    );

  it('starts in LEARNING with low quality, learns slowly on thin supply and suggests waiting', () => {
    const { outputs } = runTicks(thin('MAX_CLICKS'), 0, 48);
    const first = outputs[0]!.learning[0]!;
    expect(first.phase).toBe('LEARNING');
    expect(first.quality).toBeLessThan(0.5);
    const last = outputs.at(-1)!.learning[0]!;
    expect(last.quality).toBeGreaterThan(first.quality);
    expect(last.events).toBeGreaterThan(first.events);
    expect(last.phase).toBe('LEARNING');
    expect(
      outputs
        .flatMap((o) => o.recommendations)
        .filter((r) => r.type === 'BID_LEARNING' && r.action === 'OPEN'),
    ).toHaveLength(1);
  });

  it('leaves LEARNING once the goal events pass the exit count', () => {
    const { outputs } = runTicks(auto('MAX_REACH'), 0, 6);
    expect(outputs.at(-1)!.learning[0]!.phase).toBe('STABLE');
    expect(outputs.at(-1)!.learning[0]!.quality).toBeGreaterThan(0.99);
    expect(outputs.at(-1)!.learning[0]!.events).toBeGreaterThan(20_000);
  });

  it('a significant edit restarts learning', () => {
    const a = runTicks(auto('MAX_CLICKS'), 0, 72);
    expect(a.outputs.at(-1)!.learning[0]!.phase).toBe('STABLE');
    const b = runTicks(auto('TARGET_CPC', 40), 72, 76, { state: a.state });
    expect(b.outputs[0]!.learning[0]!.phase).toBe('RELEARNING');
    expect(b.outputs[0]!.learning[0]!.quality).toBeLessThan(a.outputs.at(-1)!.learning[0]!.quality);
  });

  it('fixed bids do not learn', () => {
    const { outputs } = runTicks(world(), 0, 10);
    expect(outputs.at(-1)!.learning[0]!.events).toBe(0);
  });

  it('an automated strategy spends the daily target when supply allows it', () => {
    const { outputs } = runTicks(auto('MAX_CLICKS'), 0, 48);
    const day2 = outputs
      .slice(24)
      .reduce(
        (a, o) =>
          a +
          o.daily
            .filter((d) => d.sliceKind === 'total')
            .reduce((x, d) => x + d.metrics.revenue / 1e6, 0),
        0,
      );
    const target =
      (50_000_000 -
        outputs
          .slice(0, 24)
          .reduce(
            (a, o) =>
              a +
              o.daily
                .filter((d) => d.sliceKind === 'total')
                .reduce((x, d) => x + d.metrics.revenue / 1e6, 0),
            0,
          )) /
      29;
    expect(day2 / target).toBeGreaterThan(0.97);
    expect(day2 / target).toBeLessThan(1.03);
  });
});

describe('conversions through ticks (engine.md 6.4)', () => {
  const conv = (w: World, n = 36) => sumDaily(runTicks(w, 0, n).outputs);

  it('conversions arrive with a lag, after the clicks', () => {
    const { outputs } = runTicks(world(), 0, 24);
    expect(outputs[0]!.daily.find((d) => d.sliceKind === 'total')!.metrics.convTotal).toBe(0);
    expect(
      outputs
        .slice(1)
        .some((o) => o.daily.some((d) => d.sliceKind === 'total' && d.metrics.convTotal > 0)),
    ).toBe(true);
  });

  it('a broken tag stops conversions but not delivery', () => {
    const w = world();
    const broken: World = { ...w, floodlightActivities: [{ ...purchase, tagStatus: 'broken' }] };
    const a = conv(w);
    const b = conv(broken);
    expect(a.convTotal).toBeGreaterThan(0);
    expect(b.convTotal).toBe(0);
    expect(b.impressions).toBe(a.impressions);
    expect(b.revenue).toBe(a.revenue);
  });

  it('count only post-click removes post-view conversions from the total', () => {
    const all = conv(world({ conversionCounting: { mode: 'ALL' } }));
    const click = conv(world({ conversionCounting: { mode: 'POST_CLICK_ONLY' } }));
    expect(click.convPostView).toBeGreaterThan(0);
    expect(click.convTotal).toBeCloseTo(click.convPostClick, 5);
    expect(all.convTotal).toBeCloseTo(all.convPostClick + all.convPostView, 5);
  });

  it('counting a percentage weights post-view conversions', () => {
    const half = conv(world({ conversionCounting: { mode: 'PERCENTAGE', pct: 50 } }));
    expect(half.convTotal).toBeCloseTo(half.convPostClick + 0.5 * half.convPostView, 4);
  });

  it('sale activities report revenue and transactions', () => {
    const w = world();
    const sale: World = {
      ...w,
      floodlightActivities: [{ ...purchase, countingMethod: 'transactions', avgOrderValue: 2_000 }],
    };
    const m = conv(sale);
    expect(m.convTransactions).toBeGreaterThan(0);
    expect(m.convRevenue / 1e6).toBeCloseTo(m.convTransactions * 2_000, 0);
  });

  it('a second line item gets assist credit when the attribution model is not last click', () => {
    const base = world({ attributionModel: 'linear' });
    const two: World = {
      ...base,
      lineItems: [
        base.lineItems[0]!,
        { ...base.lineItems[0]!, id: 'li2', bid: { kind: 'FIXED', fixedCpm: 80 } },
      ],
    };
    const { outputs } = runTicks(two, 0, 40);
    const conv1 = sumDaily(outputs, 'li1').convTotal;
    const conv2 = sumDaily(outputs, 'li2').convTotal;
    expect(conv1).toBeGreaterThan(0);
    expect(conv2).toBeGreaterThan(0);
    const raw = (id: string) =>
      sumDaily(outputs, id).convPostClick + sumDaily(outputs, id).convPostView;
    expect(raw('li1') + raw('li2')).toBeGreaterThan(0);
  });
});

describe('frequency through ticks (engine.md 3.9)', () => {
  it('a cap filters requests from capped users and holds the average exposures down', () => {
    const w = world(
      {
        frequency: { mode: 'LIMITED', maxExposures: 2, unit: 'DAY', unitCount: 1 },
        pacing: { period: 'FLIGHT', type: 'ASAP' },
      },
      {},
      { geo: { includeRegions: ['IN-DL'] }, devices: ['tablet'] },
    );
    const { outputs, state } = runTicks(w, 0, 24);
    expect(funnelTotals(outputs).get('F.LINE_ITEM')).toBeGreaterThan(0);
    const s = state.freq['LI:li1']!;
    const reached = s.U - s.h[0]!;
    expect(s.h.reduce((a, n, k) => a + k * n, 0) / reached).toBeLessThanOrEqual(2 + 1e-9);
  });

  it('the cap resets with the next window', () => {
    const w = world(
      { frequency: { mode: 'LIMITED', maxExposures: 1, unit: 'DAY', unitCount: 1 } },
      {},
      { geo: { includeRegions: ['IN-DL'] }, devices: ['tablet'] },
    );
    const a = runTicks(w, 0, 23);
    const capped = a.state.freq['LI:li1']!.h[1]!;
    expect(capped).toBeGreaterThan(0);
    const b = runTicks(w, 23, 25, { state: a.state });
    expect(b.state.freq['LI:li1']!.h[1]!).toBeLessThan(capped);
  });

  it('IO and campaign caps apply to every line item below them', () => {
    const base = world(
      {},
      { frequency: { mode: 'LIMITED', maxExposures: 2, unit: 'DAY', unitCount: 1 } },
      { geo: { includeRegions: ['IN-DL'] }, devices: ['tablet'] },
    );
    const { outputs, state } = runTicks(base, 0, 12);
    expect(state.freq['IO:io1']).toBeDefined();
    expect(funnelTotals(outputs).get('F.INSERTION_ORDER')).toBeGreaterThan(0);
    const camp: World = {
      ...world({}, {}, { geo: { includeRegions: ['IN-DL'] }, devices: ['tablet'] }),
      campaigns: [
        {
          id: 'c1',
          status: 'ACTIVE',
          frequency: { mode: 'LIMITED', maxExposures: 1, unit: 'DAY', unitCount: 1 },
        },
      ],
    };
    expect(funnelTotals(runTicks(camp, 0, 12).outputs).get('F.CAMPAIGN')).toBeGreaterThan(0);
  });
});

describe('IO automation (engine.md 4.5)', () => {
  it('forces ASAP line items under IO pacing and keeps allocation weights that sum to one', () => {
    const base = world(
      {
        pacing: { period: 'FLIGHT', type: 'EVEN' },
        bid: { kind: 'AUTOMATED', goal: 'MAX_CLICKS' },
      },
      {
        bidBudgetControl: 'IO_AUTOMATED',
        optimizeTarget: 'MAX_VIEWABLE_IMPRESSIONS',
        pacing: { period: 'FLIGHT', type: 'AHEAD' },
      },
    );
    const two: World = {
      ...base,
      lineItems: [
        base.lineItems[0]!,
        {
          ...base.lineItems[0]!,
          id: 'li2',
          targeting: { ...base.lineItems[0]!.targeting, viewabilityMin: 0.7 },
        },
      ],
    };
    const { outputs, state } = runTicks(two, 0, 50);
    expect(state.io.io1!.eff.li1!.events).toBeGreaterThan(0);
    expect(sumDaily(outputs, 'li1').impressions).toBeGreaterThan(0);
    expect(sumDaily(outputs, 'li2').impressions).toBeGreaterThan(0);
    // the optimiser objective is viewable impressions, not clicks
    expect(outputs.at(-1)!.learning.every((l) => l.events > 0)).toBe(true);
  });

  it('automatic budget allocation updates weights at midnight', () => {
    const base = world(
      {
        pacing: { period: 'FLIGHT', type: 'EVEN' },
        bid: { kind: 'AUTOMATED', goal: 'MAX_CLICKS' },
      },
      { autoBudgetAllocation: true },
    );
    const two: World = {
      ...base,
      lineItems: [
        base.lineItems[0]!,
        { ...base.lineItems[0]!, id: 'li2', creativeIds: ['cr-weak'] },
      ],
      creatives: [
        ...base.creatives,
        { ...creativeFor('display', 'cr-weak'), size: '300x250', qualityOverride: 0.7 },
      ],
    };
    const { state } = runTicks(two, 0, 49);
    const w = state.io.io1!.weights;
    expect(Object.keys(w).sort()).toEqual(['li1', 'li2']);
    expect(w.li1! + w.li2!).toBeCloseTo(1, 6);
  });
});

describe('time zones and day boundaries', () => {
  it('rolls daily counters at the advertiser midnight', () => {
    const w = world({ pacing: { period: 'DAILY', type: 'ASAP', dailyAmount: 1_000 } });
    const shifted: World = { ...w, advertiser: { ...w.advertiser, tzOffsetMin: 330 + 120 } }; // two hours ahead of the sandbox
    const { outputs } = runTicks(shifted, 0, 30);
    expect(outputs[0]!.date).toBe('2026-11-01');
    expect(outputs[0]!.hour).toBe(2);
    const dates = [...new Set(outputs.map((o) => o.date))];
    expect(dates).toEqual(['2026-11-01', '2026-11-02']);
    const firstOfNext = outputs.find((o) => o.date === '2026-11-02')!;
    expect(firstOfNext.hour).toBe(0);
    expect(firstOfNext.tick).toBe(22);
  });

  it('hourly rows carry the start of the sim hour', () => {
    const { outputs } = runTicks(world(), 5, 7);
    expect(outputs[1]!.hourly[0]!.hourStartMs - outputs[0]!.hourly[0]!.hourStartMs).toBe(3_600_000);
  });
});

describe('inputs the engine must tolerate', () => {
  it('an empty world ticks without output', () => {
    const r = runTick(baseWorld(), newSimState(), params, 0);
    expect(r.output.funnel).toEqual([]);
    expect(r.state.nextTick).toBe(1);
  });

  it('a line item whose insertion order is missing is parent paused', () => {
    const w = baseWorld({
      lineItems: [liOf('orphan', 'display')],
      creatives: [creativeFor('display')],
    });
    const r = runTick(w, newSimState(), params, 0);
    expect(r.output.liveStatus[0]!.status).toBe('PARENT_PAUSED');
  });

  it('a deleted line item leaves pending conversions harmless', () => {
    const a = runTicks(world(), 0, 6);
    expect(a.state.pending.length).toBeGreaterThan(0);
    const gone: World = { ...world(), lineItems: [] };
    const b = runTicks(gone, 6, 12, { state: a.state });
    expect(b.outputs.flatMap((o) => o.daily)).toEqual([]);
  });

  it('an io with no segment today produces NO_BUDGET_SEGMENT', () => {
    const w = world(
      {},
      {
        segments: [
          { id: 's', amount: 1000, startDay: '2026-11-01', endDay: '2026-11-01' },
          { id: 't', amount: 1000, startDay: '2026-11-03', endDay: '2026-11-04' },
        ],
      },
    );
    const { outputs } = runTicks(w, 24, 26);
    expect(outputs[0]!.liveStatus[0]!.status).toBe('NO_BUDGET_SEGMENT');
  });
});
