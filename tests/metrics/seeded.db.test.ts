// Metric layer against a seeded sandbox (P3-05b history stub): aggregation equals raw SQL sums for random ranges,
// totals reconcile, one query per level, and the grid query uses the (lineItemId, simDate, ...) unique index.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { prisma, withSandbox, type Tx } from '@/lib/db';
import { getGridMetricsTx, getTotalsTx, getChartCardDataTx, type MetricLevel } from '@/lib/metrics';
import { addDaysIso } from '@/lib/metrics/date-range';
import { aggregateSql } from '@/lib/metrics/query';
import { seedReferenceData } from '@/lib/seed/reference-db';
import { provisionSandbox } from '@/lib/seed/sandbox';
import { clearSandboxData } from '@/lib/seed/write';

const TODAY = '2026-10-28';
const INDEX = 'SimDailyMetric_lineItemId_simDate_sliceKind_sliceKey_key';

const KEY_COLUMN: Record<Exclude<MetricLevel, 'adGroup'>, string> = {
  li: 'id',
  io: 'ioId',
  campaign: 'campaignId',
  advertiser: 'advertiserId',
};

describe('metrics on a seeded sandbox', () => {
  let sandboxId: string;
  let classroomId: string;
  let ownerId: string;
  const ids: Record<Exclude<MetricLevel, 'adGroup'>, string[]> = {
    li: [],
    io: [],
    campaign: [],
    advertiser: [],
  };
  /** Ids under INR advertisers (the seed also has an SGD advertiser; FxRate is not seeded yet, P3-05c). */
  const inr: Record<Exclude<MetricLevel, 'adGroup'>, string[]> = {
    li: [],
    io: [],
    campaign: [],
    advertiser: [],
  };

  const inSandbox = <T>(fn: (tx: Tx) => Promise<T>) =>
    withSandbox(sandboxId, fn, { timeout: 60_000 });

  /** Independent reference: plain SUM over the raw rows, grouped by the level's key. */
  const rawSums = async (level: Exclude<MetricLevel, 'adGroup'>, from: string, to: string) => {
    const col = KEY_COLUMN[level];
    const rows = await prisma.$queryRawUnsafe<
      { key: string; impressions: number; clicks: number; revenue: number; conv: number }[]
    >(
      `SELECT li."${col}" AS key, sum(m.impressions)::float8 AS impressions, sum(m.clicks)::float8 AS clicks,
              sum(m.revenue)::float8 AS revenue, sum(m."convTotal")::float8 AS conv
         FROM "SimDailyMetric" m JOIN "LineItem" li ON li.id = m."lineItemId"
        WHERE m."sandboxId" = $1 AND m."sliceKind" = 'total' AND m."simDate" BETWEEN $2::date AND $3::date
        GROUP BY 1`,
      sandboxId,
      from,
      to,
    );
    return new Map(rows.map((r) => [r.key, r]));
  };

  beforeAll(async () => {
    await seedReferenceData(prisma);
    const owner = await prisma.user.create({
      data: {
        email: `metrics-${Date.now()}@example.test`,
        name: 'Metrics admin',
        appRole: 'ADMIN',
      },
    });
    ownerId = owner.id;
    const classroom = await prisma.classroom.create({
      data: { name: 'Metrics class', code: `metrics-${Date.now()}`, ownerAdminId: owner.id },
    });
    classroomId = classroom.id;
    const r = await provisionSandbox(prisma, {
      classroomId,
      ownerUserId: null,
      name: 'Metrics seeded',
      template: 'starter-agency',
      kind: 'DEMO',
      seedValue: 909,
      partnerName: 'Metrics partner',
      today: TODAY,
    });
    sandboxId = r.sandboxId;
    const lis = await prisma.lineItem.findMany({
      where: { sandboxId },
      select: {
        id: true,
        ioId: true,
        campaignId: true,
        advertiserId: true,
        advertiser: { select: { currencyCode: true } },
      },
    });
    const inrLis = lis.filter((l) => l.advertiser.currencyCode === 'INR');
    inr.li = inrLis.map((l) => l.id);
    inr.io = [...new Set(inrLis.map((l) => l.ioId))];
    inr.campaign = [...new Set(inrLis.map((l) => l.campaignId))];
    inr.advertiser = [...new Set(inrLis.map((l) => l.advertiserId))];
    ids.li = lis.map((l) => l.id);
    ids.io = [...new Set(lis.map((l) => l.ioId))];
    ids.campaign = [...new Set(lis.map((l) => l.campaignId))];
    ids.advertiser = [...new Set(lis.map((l) => l.advertiserId))];
  }, 240_000);

  afterAll(async () => {
    await prisma.$transaction((tx) => clearSandboxData(tx, sandboxId), { timeout: 60_000 });
    await prisma.sandbox.deleteMany({ where: { classroomId } });
    await prisma.classroom.deleteMany({ where: { id: classroomId } });
    await prisma.user.deleteMany({ where: { id: ownerId } });
  });

  it('has seeded history to aggregate', async () => {
    const n = await prisma.simDailyMetric.count({ where: { sandboxId, sliceKind: 'total' } });
    expect(n).toBeGreaterThan(100);
  });

  it('aggregation equals a raw SQL sum for random ranges at every level', async () => {
    const offset = fc.integer({ min: 0, max: 95 });
    await fc.assert(
      fc.asyncProperty(
        offset,
        offset,
        fc.constantFrom<Exclude<MetricLevel, 'adGroup'>>('li', 'io', 'campaign', 'advertiser'),
        async (a, b, level) => {
          const from = addDaysIso(TODAY, -Math.max(a, b));
          const to = addDaysIso(TODAY, -Math.min(a, b));
          const [rows, raw] = await Promise.all([
            inSandbox((tx) =>
              getGridMetricsTx(tx, { level, ids: ids[level], range: { from, to }, sandboxId }),
            ),
            rawSums(level, from, to),
          ]);
          for (const id of ids[level]) {
            const r = rows[id]!;
            const ref = raw.get(id);
            expect(r.hasData).toBe(Boolean(ref));
            expect(r.impressions).toBe(ref?.impressions ?? 0);
            expect(r.clicks).toBe(ref?.clicks ?? 0);
            expect(r.revenue).toBeCloseTo(ref?.revenue ?? 0, 4);
            expect(r.conversions).toBeCloseTo(ref?.conv ?? 0, 4);
          }
        },
      ),
      { numRuns: 25 },
    );
  }, 120_000);

  it('shows non-zero Impr., Clicks, Spent and CPM for active line items yesterday', async () => {
    const active = await prisma.lineItem.findMany({
      where: { sandboxId, status: 'ACTIVE' },
      select: { id: true },
    });
    const y = addDaysIso(TODAY, -1);
    const rows = await inSandbox((tx) =>
      getGridMetricsTx(tx, {
        level: 'li',
        ids: active.map((a) => a.id),
        range: { from: y, to: y },
        sandboxId,
      }),
    );
    const delivering = Object.values(rows).filter((r) => r.impressions > 0);
    expect(delivering.length).toBeGreaterThan(0);
    for (const r of delivering) {
      expect(r.spent).toBeGreaterThan(0);
      expect(r.ratios.cpm).toBeGreaterThan(0);
    }
    expect(delivering.some((r) => r.clicks > 0)).toBe(true);
  });

  it('totals reconcile with the sum of the rows', async () => {
    const range = { from: addDaysIso(TODAY, -30), to: TODAY };
    for (const level of ['li', 'io', 'campaign'] as const) {
      const [rows, totals] = await inSandbox(
        async (tx) =>
          [
            await getGridMetricsTx(tx, { level, ids: inr[level], range, sandboxId }),
            await getTotalsTx(tx, { level, ids: inr[level], range, sandboxId }),
          ] as const,
      );
      const list = Object.values(rows);
      expect(totals.impressions).toBe(list.reduce((s, r) => s + r.impressions, 0));
      expect(totals.clicks).toBe(list.reduce((s, r) => s + r.clicks, 0));
      expect(totals.revenue).toBeCloseTo(
        list.reduce((s, r) => s + r.revenue, 0),
        4,
      );
      expect(totals.ratios.cpm).toBeCloseTo((totals.revenue / totals.impressions) * 1000, 6);
    }
  });

  it('chart cards: Total cost equals the grid revenue; reach and forecast cards are empty', async () => {
    const range = { from: addDaysIso(TODAY, -6), to: TODAY };
    const [cards, totals] = await inSandbox(
      async (tx) =>
        [
          await getChartCardDataTx(tx, {
            level: 'io',
            ids: inr.io,
            range,
            sandboxId,
            today: TODAY,
          }),
          await getTotalsTx(tx, { level: 'io', ids: inr.io, range, sandboxId }),
        ] as const,
    );
    const cost = cards.find((c) => c.id === 'totalCost');
    expect(cost && 'total' in cost && cost.total).toBeCloseTo(totals.revenue, 4);
    expect(cost && 'days' in cost && cost.days).toHaveLength(7);
    expect(cards.find((c) => c.id === 'addedImpressionReach')).toEqual({
      id: 'addedImpressionReach',
      empty: true,
    });
    expect(cards.find((c) => c.id === 'exploreBudgetOptions')).toEqual({
      id: 'exploreBudgetOptions',
      empty: true,
    });
  });

  it('batches 500 ids into one aggregate query and one entity query', async () => {
    const many = [
      ...ids.li,
      ...Array.from({ length: 500 - ids.li.length }, (_, i) => `missing-${i}`),
    ];
    expect(many).toHaveLength(500);
    const calls: string[] = [];
    const rows = await inSandbox((tx) => {
      const counted = new Proxy(tx, {
        get(target, prop, receiver) {
          const v = Reflect.get(target, prop, receiver) as unknown;
          if (prop === '$queryRaw') {
            return (...a: unknown[]) => {
              calls.push('$queryRaw');
              return (v as (...x: unknown[]) => unknown).apply(target, a);
            };
          }
          if (typeof prop === 'string' && !prop.startsWith('$') && v && typeof v === 'object') {
            return new Proxy(v, {
              get(model, op, r2) {
                const fn = Reflect.get(model, op, r2) as unknown;
                if (typeof fn !== 'function') return fn;
                return (...a: unknown[]) => {
                  calls.push(`${prop}.${String(op)}`);
                  return (fn as (...x: unknown[]) => unknown).apply(model, a);
                };
              },
            });
          }
          return v;
        },
      });
      return getGridMetricsTx(counted, {
        level: 'li',
        ids: many,
        range: { from: addDaysIso(TODAY, -30), to: TODAY },
        sandboxId,
      });
    });
    expect(calls.sort()).toEqual(['$queryRaw', 'lineItem.findMany']);
    expect(Object.keys(rows)).toHaveLength(ids.li.length); // unknown ids are left out
  });

  it('EXPLAIN: the grid query uses the (lineItemId, simDate, sliceKind, sliceKey) index', async () => {
    for (const level of ['li', 'io'] as const) {
      const sql = aggregateSql(
        level,
        ids[level],
        { from: addDaysIso(TODAY, -7), to: TODAY },
        sandboxId,
      );
      const plan = await prisma.$transaction(async (tx) => {
        // One seeded sandbox is a few thousand rows, where a sequential scan is cheapest. With 60 sandboxes
        // (data-model 8 Q2) the table is large; disabling seq scans makes the planner show the access path it
        // takes at that size.
        await tx.$executeRawUnsafe('ANALYZE "SimDailyMetric"');
        await tx.$executeRawUnsafe('SET LOCAL enable_seqscan = off');
        const rows = await tx.$queryRawUnsafe<{ 'QUERY PLAN': unknown }[]>(
          `EXPLAIN (FORMAT JSON) ${sql.text}`,
          ...sql.values,
        );
        return JSON.stringify(rows[0]!['QUERY PLAN']);
      });
      expect(plan).toContain(INDEX);
      expect(plan).not.toMatch(/"Seq Scan"[^}]*"Relation Name":"SimDailyMetric"/);
    }
  });
});
