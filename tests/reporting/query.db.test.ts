// The query engine against a seeded sandbox (module 16 6.1 items 3, 8, 9, 12, 13 and 6.3 aggregate / fx tests).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { fxRate, loadFxTable } from '@/lib/metrics/fx';
import { runQuery } from '@/lib/reporting/engine/query';
import { seedSandbox, TODAY, type Seeded } from './fixture';

let s: Seeded;
beforeAll(async () => {
  s = await seedSandbox('rq');
}, 240_000);
afterAll(async () => {
  await s.cleanup();
  await prisma.$disconnect();
});

const run = (over: Parameters<Seeded['def']>[0] = {}, limit = 5000) =>
  s.inSandbox((tx) =>
    runQuery(tx, s.sandboxId, s.partnerId, s.def(over), { allowPartnerCost: true, limit }),
  );

async function rawSum(col: string, from: string, to: string, extraWhere = ''): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ x: number }[]>(
    `SELECT coalesce(sum("${col}"),0)::float8 AS x FROM "SimDailyMetric"
      WHERE "sandboxId" = $1 AND "sliceKind" = 'total' AND "simDate" BETWEEN $2::date AND $3::date ${extraWhere}`,
    s.sandboxId,
    from,
    to,
  );
  return Number(rows[0]?.x);
}

describe('queryReport on a seeded sandbox', () => {
  it('sums impressions by advertiser to the raw total', async () => {
    const r = await run({ dateRange: '20260901:20260928' });
    expect(r.rows.length).toBe(2);
    const total = r.rows.reduce((a, row) => a + Number(row[1]), 0);
    expect(total).toBe(await rawSum('impressions', '2026-09-01', '2026-09-28'));
    expect(r.range).toEqual({ from: '2026-09-01', to: '2026-09-28' });
  });

  it('a preset changes the totals ("Yesterday" is the sim yesterday)', async () => {
    const y = await run({ dateRange: 'YESTERDAY', dimensions: ['date'] });
    expect(y.rows).toHaveLength(1);
    expect(y.rows[0]?.[0]).toBe('2026/10/27');
    const wide = await run({ dateRange: 'LAST_30_DAYS', dimensions: ['date'] });
    expect(wide.rows.length).toBe(30);
    expect(TODAY).toBe('2026-10-28');
  });

  it('ratios are computed after aggregation (CTR is not averaged)', async () => {
    const r = await run({
      dateRange: '20260901:20260928',
      dimensions: [],
      metrics: ['impressions', 'clicks', 'click_rate_ctr'],
    });
    expect(r.rows).toHaveLength(1);
    const [impr, clicks, ctr] = r.rows[0] as number[];
    expect(ctr).toBeCloseTo(((clicks as number) / (impr as number)) * 100, 2);
  });

  it('exchange and device slices add up to the total', async () => {
    for (const dim of ['exchange', 'device_type']) {
      const r = await run({ dateRange: '20260901:20260928', dimensions: [dim] });
      const sum = r.rows.reduce((a, row) => a + Number(row[1]), 0);
      expect(sum, dim).toBe(await rawSum('impressions', '2026-09-01', '2026-09-28'));
    }
  });

  it('a derived dimension sums to its parent and the pair of slices is approximated', async () => {
    const parent = await run({ dateRange: '20260901:20260928', dimensions: ['device_type'] });
    const child = await run({ dateRange: '20260901:20260928', dimensions: ['browser'] });
    expect(child.rows.length).toBeGreaterThan(3);
    const a = parent.rows.reduce((x, row) => x + Number(row[1]), 0);
    const b = child.rows.reduce((x, row) => x + Number(row[1]), 0);
    expect(b).toBe(a);
    const pivot = await run({
      dateRange: '20260901:20260928',
      dimensions: ['exchange', 'environment'],
    });
    expect(pivot.warnings).toContain('APPROXIMATED_PIVOT');
  });

  it('money in partner currency and USD equals the advertiser value times the fixed rate', async () => {
    const r = await run({
      dateRange: '20260901:20260928',
      dimensions: ['advertiser', 'advertiser_currency'],
      metrics: ['revenue_adv', 'revenue_partner', 'revenue_usd'],
    });
    expect(r.rows.length).toBe(2);
    // columns: advertiser, currency, revenue (advertiser), revenue (partner), revenue (USD); the partner is in INR.
    // Rates come from the FxRate table as it is (other suites add pairs of their own).
    const table = await s.inSandbox((tx) => loadFxTable(tx));
    for (const row of r.rows) {
      const [, cur, adv, partner, usd] = row as [string, string, number, number, number];
      expect(usd).toBeCloseTo(adv * fxRate(table, cur, 'USD'), 1);
      expect(partner).toBeCloseTo(adv * fxRate(table, cur, 'INR'), 1);
    }
  });

  it('reach metrics only break down by reach dimensions and frequency matches impressions / reach', async () => {
    const r = await run({
      dateRange: 'LAST_30_DAYS',
      dimensions: ['line_item'],
      metrics: ['impressions', 'impression_reach', 'average_impression_frequency'],
    });
    expect(r.rows.length).toBeGreaterThan(5);
    for (const row of r.rows) {
      const [, impr, reach, freq] = row as [string, number, number, number];
      if (!reach) continue;
      expect(reach).toBeLessThanOrEqual(impr);
      expect(Math.abs(freq - impr / reach) / freq).toBeLessThan(0.01);
    }
    await expect(run({ dimensions: ['exchange'], metrics: ['impression_reach'] })).rejects.toThrow(
      /can't be used with/,
    );
  });

  it('is deterministic', async () => {
    const a = await run({
      dimensions: ['insertion_order', 'date'],
      metrics: ['impressions', 'clicks', 'revenue_adv'],
    });
    const b = await run({
      dimensions: ['insertion_order', 'date'],
      metrics: ['impressions', 'clicks', 'revenue_adv'],
    });
    expect(a.rows).toEqual(b.rows);
  });

  it('UTC shifts totals at day boundaries but keeps the range total close', async () => {
    const adv = await run({ dateRange: '20260901:20260930', dimensions: ['date'] });
    const utc = await run({
      dateRange: '20260901:20260930',
      dimensions: ['date'],
      timeZone: 'UTC',
    });
    expect(utc.warnings).toContain('TIME_ZONE_APPROXIMATED');
    const a = adv.rows.reduce((x, r) => x + Number(r[1]), 0);
    const u = utc.rows.reduce((x, r) => x + Number(r[1]), 0);
    expect(Math.abs(a - u) / a).toBeLessThan(0.1);
    expect(adv.rows[5]).not.toEqual(utc.rows[5]);
  });

  it('the IO pacing template shape returns budget segments', async () => {
    const r = await run({
      dateRange: 'MONTH_TO_DATE',
      dimensions: [
        'insertion_order',
        'budget_segment_name',
        'budget_segment_start_date',
        'budget_segment_end_date',
      ],
      metrics: ['budget_segment_budget', 'revenue_adv', 'budget_segment_pacing_percentage'],
    });
    expect(r.rows.length).toBeGreaterThan(0);
    expect(r.rows[0]?.[4]).toBeGreaterThan(0);
  });

  it('filters narrow the result and the partner filter is required', async () => {
    const all = await run({ dimensions: ['device_type'], metrics: ['impressions'] });
    const mobile = await run({
      dimensions: ['device_type'],
      filters: [...s.def().filters, { field: 'device_type', op: 'IN', values: ['Smart Phone'] }],
    });
    expect(mobile.rows.length).toBe(1);
    expect(Number(mobile.rows[0]?.[1])).toBeLessThan(
      all.rows.reduce((x, r) => x + Number(r[1]), 0),
    );
    await expect(run({ filters: [] })).rejects.toThrow(/partner filter/);
  });

  it('hourly reports read SimHourlyMetric (instants, converted to the advertiser time zone)', async () => {
    const h = await run({ dateRange: 'YESTERDAY', dimensions: ['hour'], metrics: ['impressions'] });
    expect(h.rows.length).toBeLessThanOrEqual(24);
    const d = await run({ dateRange: 'YESTERDAY', dimensions: ['date'], metrics: ['impressions'] });
    // The history stub stores the wall clock hour as a UTC instant (docs/gaps/p4-07.md), so a seeded day can differ by
    // the hours that cross midnight; engine rows are exact.
    const hourly = h.rows.reduce((x, r) => x + Number(r[1]), 0);
    expect(Math.abs(hourly - Number(d.rows[0]?.[1])) / hourly).toBeLessThan(0.02);
    const both = await run({
      dateRange: 'LAST_7_DAYS',
      dimensions: ['date_and_hour'],
      metrics: ['impressions'],
    });
    expect(both.rows.length).toBeGreaterThan(24);
  });
});
