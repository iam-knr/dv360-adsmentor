// Metric layer on hand-built fixtures: time zone day boundaries, FxRate conversion, null vs zero, KPI Actual, budget
// "Unknown", ad group slices, and that another sandbox's ids never return rows.
import { beforeAll, describe, expect, it } from 'vitest';
import { prisma, withSandbox } from '@/lib/db';
import {
  FxRateMissingError,
  getChartCardData,
  getGridMetrics,
  getTotals,
  getGridMetricsTx,
  resolveRangeForEntity,
} from '@/lib/metrics';
import { createWorld, type World } from '../db/helpers';

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

async function addLi(w: World, advertiserId: string, ioId: string, campaignId: string, extra = {}) {
  return prisma.lineItem.create({
    data: {
      sandboxId: w.sandboxId,
      ioId,
      campaignId,
      advertiserId,
      name: `LI ${Math.random()}`,
      type: 'DISPLAY',
      ...extra,
    },
  });
}

async function metricRow(
  w: World,
  lineItemId: string,
  simDate: string,
  data: Record<string, unknown>,
) {
  await prisma.simDailyMetric.create({
    data: {
      sandboxId: w.sandboxId,
      classroomId: w.classroomId,
      lineItemId,
      simDate: day(simDate),
      ...data,
    },
  });
}

describe('metrics fixtures', () => {
  let w: World;
  let other: World;
  let sgd: { advertiserId: string; campaignId: string; ioId: string; liId: string };
  let inrLiId: string;

  beforeAll(async () => {
    w = await createWorld('metrics');
    other = await createWorld('metrics-other');
    // INR advertiser (IST): IO KPI CPM 90, a fixed-budget LI with two days of data
    await prisma.insertionOrder.update({
      where: { id: w.ioId },
      data: { kpi: 'CPM', kpiValue: '90' },
    });
    await prisma.campaign.update({
      where: { id: w.campaignId },
      data: { kpi: 'CTR', kpiValue: '0.15' },
    });
    const li = await addLi(w, w.advertiserId, w.ioId, w.campaignId, {
      budgetMode: 'FIXED',
      budgetAmount: '300',
    });
    inrLiId = li.id;
    await metricRow(w, li.id, '2026-03-01', {
      impressions: 10_000n,
      clicks: 20n,
      revenue: '900',
      totalMediaCost: '700',
      convTotal: '4',
    });
    await metricRow(w, li.id, '2026-03-02', {
      impressions: 10_000n,
      clicks: 10n,
      revenue: '900',
      totalMediaCost: '700',
      convTotal: '8',
    });
    // a slice row that the grid must ignore
    await metricRow(w, li.id, '2026-03-01', {
      sliceKind: 'device',
      sliceKey: 'MOBILE',
      impressions: 99_999n,
    });
    // ad group slice (the world's ad group belongs to the world's line item)
    await metricRow(w, w.lineItemId, '2026-03-01', {
      sliceKind: 'adGroup',
      sliceKey: w.adGroupId,
      impressions: 1_234n,
      videoViews: 200n,
      revenue: '50',
    });

    // SGD advertiser in the INR partner
    const adv = await prisma.advertiser.create({
      data: {
        sandboxId: w.sandboxId,
        partnerId: w.partnerId,
        name: 'SG advertiser',
        websiteUrl: 'https://sg.example.test',
        currencyCode: 'SGD',
        timeZone: 'Asia/Singapore',
      },
    });
    const camp = await prisma.campaign.create({
      data: {
        sandboxId: w.sandboxId,
        advertiserId: adv.id,
        name: 'SG campaign',
        plannedStart: day('2026-01-01'),
      },
    });
    const io = await prisma.insertionOrder.create({
      data: {
        sandboxId: w.sandboxId,
        campaignId: camp.id,
        advertiserId: adv.id,
        name: 'SG IO',
        objective: 'CLICKS',
        kpi: 'CPC',
        kpiValue: '0.5',
      },
    });
    await prisma.budgetSegment.create({
      data: {
        sandboxId: w.sandboxId,
        ioId: io.id,
        amount: '100',
        startDate: day('2026-01-01'),
        endDate: day('2026-12-31'),
      },
    });
    const sgLi = await addLi(w, adv.id, io.id, camp.id);
    await metricRow(w, sgLi.id, '2026-03-01', {
      impressions: 5_000n,
      clicks: 50n,
      revenue: '20',
      totalMediaCost: '15',
    });
    sgd = { advertiserId: adv.id, campaignId: camp.id, ioId: io.id, liId: sgLi.id };

    await prisma.fxRate.upsert({
      where: {
        fromCurrency_toCurrency_validFrom: {
          fromCurrency: 'SGD',
          toCurrency: 'INR',
          validFrom: day('2000-01-01'),
        },
      },
      create: {
        fromCurrency: 'SGD',
        toCurrency: 'INR',
        rate: '62.5',
        validFrom: day('2000-01-01'),
      },
      update: { rate: '62.5' },
    });
  });

  const range = { from: '2026-03-01', to: '2026-03-02' };

  it('sums day totals only and derives ratios; Spent = revenue', async () => {
    const rows = await getGridMetrics({
      level: 'li',
      ids: [inrLiId],
      range,
      sandboxId: w.sandboxId,
    });
    const r = rows[inrLiId]!;
    expect(r.impressions).toBe(20_000);
    expect(r.clicks).toBe(30);
    expect(r.spent).toBe(1_800);
    expect(r.totalMediaCost).toBe(1_400);
    expect(r.ratios.cpm).toBeCloseTo(90);
    expect(r.ratios.ctr).toBeCloseTo(0.15);
    expect(r.ratios.cpa).toBeCloseTo(150);
    expect(r.currency).toBe('INR');
  });

  it('KPI Actual follows engine 4.6 (CPM on the IO KPI, CTR on the campaign KPI, CPA)', async () => {
    const [io, camp] = await Promise.all([
      getGridMetrics({ level: 'io', ids: [w.ioId], range, sandboxId: w.sandboxId }),
      getGridMetrics({ level: 'campaign', ids: [w.campaignId], range, sandboxId: w.sandboxId }),
    ]);
    expect(io[w.ioId]!.kpi).toBe('CPM');
    expect(io[w.ioId]!.kpiGoal).toBe(90);
    expect(io[w.ioId]!.kpiActual).toBeCloseTo(90);
    expect(camp[w.campaignId]!.kpi).toBe('CTR');
    expect(camp[w.campaignId]!.kpiActual).toBeCloseTo(0.15);
    await prisma.insertionOrder.update({
      where: { id: w.ioId },
      data: { kpi: 'CPA', kpiValue: '480' },
    });
    const cpa = await getGridMetrics({ level: 'io', ids: [w.ioId], range, sandboxId: w.sandboxId });
    expect(cpa[w.ioId]!.kpiActual).toBeCloseTo(150); // 12 conversions >= minimum sample 10
    const oneDay = await getGridMetrics({
      level: 'io',
      ids: [w.ioId],
      range: { from: range.from, to: range.from },
      sandboxId: w.sandboxId,
    });
    expect(oneDay[w.ioId]!.kpiActual).toBeNull(); // 4 conversions < 10
    await prisma.insertionOrder.update({
      where: { id: w.ioId },
      data: { kpi: 'CPM', kpiValue: '90' },
    });
  });

  it('null vs zero: no rows gives "-" values; budget Unknown without budget rows', async () => {
    const empty = await prisma.campaign.create({
      data: {
        sandboxId: w.sandboxId,
        advertiserId: w.advertiserId,
        name: 'No budget',
        plannedStart: day('2026-01-01'),
      },
    });
    const rows = await getGridMetrics({
      level: 'campaign',
      ids: [empty.id, w.campaignId],
      range,
      sandboxId: w.sandboxId,
    });
    const r = rows[empty.id]!;
    expect(r.hasData).toBe(false);
    expect(r.impressions).toBe(0);
    expect(r.ratios.ctr).toBeNull();
    expect(r.kpiActual).toBeNull();
    expect(r.budgetAmount).toBeNull(); // "Unknown"
    expect(rows[w.campaignId]!.budgetAmount).toBe(1000);
    // the world's zero row on 2026-01-01: data present, ratios still null
    const z = await getGridMetrics({
      level: 'li',
      ids: [w.lineItemId],
      range: { from: '2026-01-01', to: '2026-01-01' },
      sandboxId: w.sandboxId,
    });
    expect(z[w.lineItemId]!.hasData).toBe(true);
    expect(z[w.lineItemId]!.ratios.cpm).toBeNull();
    expect(z[w.lineItemId]!.budgetAmount).toBeNull(); // "Unlimited up to IO"
  });

  it('LI budget and budget remaining', async () => {
    const rows = await getGridMetrics({
      level: 'li',
      ids: [inrLiId],
      range: { from: '2026-03-01', to: '2026-03-01' },
      sandboxId: w.sandboxId,
    });
    expect(rows[inrLiId]!.budgetAmount).toBe(300);
    expect(rows[inrLiId]!.pacing.budgetRemaining).toBe(0); // 900 spent > 300
  });

  it('ad group level reads the adGroup slice', async () => {
    const rows = await getGridMetrics({
      level: 'adGroup',
      ids: [w.adGroupId],
      range,
      sandboxId: w.sandboxId,
    });
    expect(rows[w.adGroupId]!.impressions).toBe(1_234);
    expect(rows[w.adGroupId]!.counters.videoViews).toBe(200);
    expect(rows[w.adGroupId]!.kpiActualTrueView).toBeCloseTo(0.25); // CPV = 50 / 200
  });

  it('converts money with FxRate; totals equal the sum of converted rows (AC-01-5)', async () => {
    const ids = [w.advertiserId, sgd.advertiserId];
    const native = await getGridMetrics({
      level: 'advertiser',
      ids,
      range,
      sandboxId: w.sandboxId,
    });
    expect(native[sgd.advertiserId]!.currency).toBe('SGD');
    expect(native[sgd.advertiserId]!.revenue).toBe(20);
    const inr = await getGridMetrics({
      level: 'advertiser',
      ids,
      range,
      sandboxId: w.sandboxId,
      currency: 'INR',
    });
    expect(inr[sgd.advertiserId]!.currency).toBe('INR');
    expect(inr[sgd.advertiserId]!.revenue).toBeCloseTo(1_250);
    expect(inr[sgd.advertiserId]!.ratios.cpm).toBeCloseTo(250);
    expect(inr[sgd.advertiserId]!.impressions).toBe(5_000); // counters do not convert
    const totals = await getTotals({
      level: 'advertiser',
      ids,
      range,
      sandboxId: w.sandboxId,
      currency: 'INR',
    });
    const sum = Object.values(inr).reduce((s, r) => s + r.revenue, 0);
    expect(totals.revenue).toBeCloseTo(sum);
    expect(totals.impressions).toBe(Object.values(inr).reduce((s, r) => s + r.impressions, 0));
    await expect(
      getTotals({ level: 'advertiser', ids, range, sandboxId: w.sandboxId }),
    ).rejects.toThrow(/currency/);
    // KPI goal and budget of a money KPI convert too
    const io = await getGridMetrics({
      level: 'io',
      ids: [sgd.ioId],
      range,
      sandboxId: w.sandboxId,
      currency: 'INR',
    });
    expect(io[sgd.ioId]!.kpiGoal).toBeCloseTo(31.25);
    expect(io[sgd.ioId]!.budgetAmount).toBeCloseTo(6_250);
    await expect(
      getGridMetrics({
        level: 'io',
        ids: [sgd.ioId],
        range,
        sandboxId: w.sandboxId,
        currency: 'JPY',
      }),
    ).rejects.toThrow(FxRateMissingError);
  });

  it('chart cards convert mixed currencies and mark the reach card empty', async () => {
    const cards = await getChartCardData({
      level: 'advertiser',
      ids: [w.advertiserId, sgd.advertiserId],
      range,
      sandboxId: w.sandboxId,
      currency: 'INR',
      today: '2026-03-02',
    });
    const cost = cards.find((c) => c.id === 'totalCost');
    expect(cost).toMatchObject({ currency: 'INR', today: 900 });
    expect(cost && 'total' in cost ? cost.total : 0).toBeCloseTo(1_800 + 1_250);
    expect(cards.find((c) => c.id === 'addedImpressionReach')).toEqual({
      id: 'addedImpressionReach',
      empty: true,
    });
  });

  it('time zone day boundaries: "yesterday" follows the sim clock in the advertiser time zone', async () => {
    // simNow 2026-03-02T20:00Z: IST (UTC+5:30) is already 2026-03-03, UTC is still 2026-03-02
    await prisma.simClock.update({
      where: { sandboxId: w.sandboxId },
      data: { simStart: new Date('2026-03-02T00:00:00Z'), tickIndex: 20n },
    });
    const utcAdv = await prisma.advertiser.create({
      data: {
        sandboxId: w.sandboxId,
        partnerId: w.partnerId,
        name: 'UTC adv',
        websiteUrl: 'https://u.example.test',
        currencyCode: 'INR',
        timeZone: 'UTC',
      },
    });
    const ist = await withSandbox(w.sandboxId, (tx) =>
      resolveRangeForEntity(tx, w.sandboxId, 'li', inrLiId, 'YESTERDAY'),
    );
    const utc = await withSandbox(w.sandboxId, (tx) =>
      resolveRangeForEntity(tx, w.sandboxId, 'campaign', undefined, 'YESTERDAY'),
    );
    expect(ist.today).toBe('2026-03-03');
    expect(ist.range).toEqual({ from: '2026-03-02', to: '2026-03-02' });
    expect(ist.partnerCurrency).toBe('INR');
    const utcToday = await withSandbox(w.sandboxId, (tx) =>
      resolveRangeForEntity(tx, w.sandboxId, 'advertiser', utcAdv.id, 'TODAY'),
    );
    // advertiser level uses the partner time zone (Asia/Calcutta default)
    expect(utcToday.today).toBe('2026-03-03');
    expect(utc.today).toBe('2026-03-03'); // no entity: Asia/Calcutta default
    const rows = await withSandbox(w.sandboxId, (tx) =>
      getGridMetricsTx(tx, {
        level: 'li',
        ids: [inrLiId],
        range: ist.range,
        sandboxId: w.sandboxId,
      }),
    );
    expect(rows[inrLiId]!.impressions).toBe(10_000); // only the 2026-03-02 row
  });

  it("another sandbox's ids return no rows", async () => {
    const rows = await getGridMetrics({
      level: 'li',
      ids: [inrLiId, other.lineItemId],
      range,
      sandboxId: other.sandboxId,
    });
    expect(Object.keys(rows)).toEqual([other.lineItemId]);
  });
});
