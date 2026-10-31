// Seeds sandboxes into the test database and checks counts, stories, idempotency, integrity, RLS and reconciliation.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma, withSandbox, PUBLIC_ID_START } from '@/lib/db';
import { buildSandboxPlan } from '@/lib/seed/plan';
import { seedReferenceData } from '@/lib/seed/reference-db';
import { provisionSandbox, partnerIdOf, type ProvisionResult } from '@/lib/seed/sandbox';
import { hashValue } from '@/lib/seed/hash';
import { buildHistory } from '@/lib/seed/history-stub';
import { DELIVERY_STORIES, TEMPLATE_KEYS, type TemplateKey } from '@/lib/seed/knobs';
import { EXCHANGES, TARGETING_OPTIONS } from '@/lib/seed/reference';
import { clearSandboxData } from '@/lib/seed/write';

const TODAY = '2026-10-28';
const SEED = 4242;

interface Built {
  template: TemplateKey;
  seed: number;
  result: ProvisionResult;
}

// Module 09 (P4-06) adds seven YouTube line items and one Demand Gen line item and four ad group targeting rows after the plan is inserted.
const YT_LINE_ITEMS = 8;
/** Lists the module 14 seed adds per advertiser (lib/audiences/seed.ts): 2 small tag-based, processing, YouTube, lookalike, 2 combined, 2 partner. */
/** Lists seedAudiences adds per advertiser (plan-parity: custom affinity, custom intent, a third combined and more). */
const AUDIENCES_PER_ADVERTISER = 19;
const YT_TARGETING_ROWS = 4;

describe('seeded sandboxes', () => {
  let classroomId: string;
  let ownerId: string;
  const built = new Map<string, Built>();
  const key = (template: string, seed: number, label = '') => `${template}:${seed}${label}`;

  const provision = async (template: TemplateKey, seed: number, label: string, force = false) => {
    const result = await provisionSandbox(prisma, {
      classroomId,
      ownerUserId: null,
      name: `Seed test ${template} ${seed}${label}`,
      template,
      kind: 'DEMO',
      seedValue: seed,
      partnerName: `Sandbox TEST-${seed}`,
      today: TODAY,
      force,
    });
    built.set(key(template, seed, label), { template, seed, result });
    return result;
  };
  const sbx = (template: string, seed: number, label = '') =>
    built.get(key(template, seed, label))!.result.sandboxId;
  const count = async (table: string, sandboxId: string) => {
    const rows = await prisma.$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "${table}" WHERE "sandboxId" = $1`,
      sandboxId,
    );
    return rows[0]!.n;
  };

  beforeAll(async () => {
    await seedReferenceData(prisma);
    const owner = await prisma.user.create({
      data: {
        email: `seed-test-${Date.now()}@example.test`,
        name: 'Seed test admin',
        appRole: 'ADMIN',
      },
    });
    ownerId = owner.id;
    const classroom = await prisma.classroom.create({
      data: { name: 'Seed test class', code: `seed-test-${Date.now()}`, ownerAdminId: owner.id },
    });
    classroomId = classroom.id;
    for (const template of TEMPLATE_KEYS) await provision(template, SEED, '');
    await provision('starter-agency', SEED, ' twin');
    await provision('starter-agency', SEED + 1, '');
  }, 240_000);

  afterAll(async () => {
    for (const b of built.values()) {
      await prisma.$transaction((tx) => clearSandboxData(tx, b.result.sandboxId), {
        timeout: 60_000,
      });
    }
    await prisma.sandbox.deleteMany({ where: { classroomId } });
    await prisma.classroom.deleteMany({ where: { id: classroomId } });
    await prisma.user.deleteMany({ where: { id: ownerId } });
    await prisma.$disconnect();
  }, 120_000);

  it('loads the reference data once and keeps it idempotent', async () => {
    expect(
      await prisma.exchange.count({ where: { code: { in: EXCHANGES.map((e) => e.code) } } }),
    ).toBe(EXCHANGES.length);
    expect(
      await prisma.exchange.count({
        where: { enabledByDefault: true, code: { in: EXCHANGES.map((e) => e.code) } },
      }),
    ).toBe(54);
    expect(await prisma.targetingOption.count()).toBe(TARGETING_OPTIONS.length);
    const again = await seedReferenceData(prisma);
    expect(again).toEqual({
      exchanges: { created: 0, updated: 0 },
      targetingOptions: { created: 0, updated: 0 },
    });
    const gam = await prisma.exchange.findUniqueOrThrow({ where: { code: 'google-ad-manager' } });
    expect(gam.needsNetworkId).toBe(true);
  });

  it.each(TEMPLATE_KEYS)('%s: row counts match the plan', async (template) => {
    const id = sbx(template, SEED);
    const plan = buildSandboxPlan({
      template,
      seedValue: SEED,
      sandboxId: id,
      classroomId,
      today: TODAY,
      partnerName: `Sandbox TEST-${SEED}`,
    });
    const history = buildHistory(plan);
    const expected: [string, number][] = [
      ['Partner', 1],
      ['PartnerExchange', plan.partnerExchanges.length],
      ['Advertiser', plan.advertisers.length],
      ['Campaign', plan.campaigns.length],
      ['CampaignBudget', plan.campaignBudgets.length],
      ['InsertionOrder', plan.insertionOrders.length],
      ['BudgetSegment', plan.budgetSegments.length],
      ['PartnerCost', plan.partnerCosts.length],
      ['LineItem', plan.lineItems.length + YT_LINE_ITEMS],
      ['Creative', plan.creatives.length],
      ['CreativeAsset', plan.creativeAssets.length],
      ['CreativeReview', plan.creativeReviews.length],
      ['CreativeAssignment', plan.creativeAssignments.length],
      ['Audience', plan.audiences.length + AUDIENCES_PER_ADVERTISER * plan.advertisers.length],
      ['TargetingTemplate', plan.targetingTemplates.length],
      ['TargetingAssignment', plan.targetingAssignments.length + YT_TARGETING_ROWS],
      ['Alert', plan.alerts.length],
      ['ChangeGroup', plan.changeGroups.length],
      ['ChangeEntry', plan.changeEntries.length],
      ['SimDailyMetric', history.daily.length],
      ['SimHourlyMetric', history.hourly.length],
      ['DeliveryDiagnostic', history.diagnostics.length],
      ['SimClock', 1],
    ];
    for (const [table, n] of expected) expect(await count(table, id), table).toBe(n);
    expect(plan.lineItems).toHaveLength(36);
    expect(plan.coverageGaps).toEqual([]);
  });

  it.each(TEMPLATE_KEYS)(
    '%s: has every line item type and status, and the sandbox clock sits at today',
    async (template) => {
      const id = sbx(template, SEED);
      const types = await prisma.lineItem.groupBy({ by: ['type'], where: { sandboxId: id } });
      expect(new Set(types.map((t) => t.type))).toEqual(
        new Set([
          'DISPLAY',
          'VIDEO',
          'CTV',
          'AUDIO',
          'MOBILE_APP_INSTALL',
          'ADS_IN_MOBILE_APPS',
          'DEMAND_GEN',
          'DOOH_DISPLAY',
          'DOOH_VIDEO',
          'YT_VIDEO',
          'YT_AUDIO',
        ]),
      );
      const statuses = await prisma.lineItem.groupBy({ by: ['status'], where: { sandboxId: id } });
      expect(new Set(statuses.map((s) => s.status))).toEqual(
        new Set(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']),
      );
      const completed = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM "LineItem" l JOIN "InsertionOrder" i ON i.id = l."ioId" AND i."sandboxId" = l."sandboxId"
      JOIN "BudgetSegment" s ON s."ioId" = i.id AND s."sandboxId" = i."sandboxId"
      WHERE l."sandboxId" = ${id} AND l.status = 'ACTIVE' AND l."flightMode" = 'INHERIT_IO'
      GROUP BY l.id HAVING max(s."endDate") < ${TODAY}::date`;
      expect(completed.length).toBeGreaterThan(0); // Completed is derived from an ended flight
      const clock = await prisma.simClock.findUniqueOrThrow({ where: { sandboxId: id } });
      const simNow = new Date(clock.simStart.getTime() + Number(clock.tickIndex) * 3_600_000);
      expect(simNow.toISOString().slice(0, 10)).toBe(TODAY);
      expect(clock.state).toBe('PAUSED');
      const sandbox = await prisma.sandbox.findUniqueOrThrow({ where: { id } });
      expect(sandbox.provisionState).toBe('READY');
    },
  );

  it.each(TEMPLATE_KEYS)(
    '%s: planted problems are present with the right tags on the right entities',
    async (template) => {
      const id = sbx(template, SEED);
      const groups = await prisma.changeGroup.findMany({
        where: { sandboxId: id, summary: { startsWith: 'Seed story: ' } },
      });
      const tags = new Set(groups.map((g) => g.summary.replace('Seed story: ', '')));
      if (template === 'healthy') expect([...tags]).toEqual(['healthy']);
      else for (const story of DELIVERY_STORIES) expect(tags.has(story), story).toBe(true);
      for (const g of groups) {
        expect(g.isHidden).toBe(true);
        expect(g.systemActor).toBe('SIM_SEED');
        expect(g.source).toBe('SEED');
        const exists =
          g.entityType === 'LINE_ITEM'
            ? await prisma.lineItem.count({ where: { id: g.entityId, sandboxId: id } })
            : await prisma.insertionOrder.count({ where: { id: g.entityId, sandboxId: id } });
        expect(exists, g.summary).toBe(1);
      }
      const byTag = (tag: string) => groups.filter((g) => g.summary === `Seed story: ${tag}`);
      if (template === 'healthy') {
        expect(await count('Alert', id)).toBe(0);
        return;
      }
      // facts that make each story real in the data
      const li = (tag: string) =>
        prisma.lineItem.findFirstOrThrow({ where: { id: byTag(tag)[0]!.entityId } });
      expect((await li('bid-too-low')).bidKind).toBe('FIXED');
      expect((await li('frequency-cap-too-tight')).freqMaxExposures).toBe(1);
      expect((await li('paused-li')).status).toBe('PAUSED');
      const pausedParent = await prisma.insertionOrder.findFirstOrThrow({
        where: { id: (await li('li-under-paused-io')).ioId },
      });
      expect(pausedParent.status).toBe('PAUSED');
      expect(
        await prisma.creativeAssignment.count({
          where: { lineItemId: byTag('li-no-creatives')[0]!.entityId },
        }),
      ).toBe(0);
      expect((await li('li-future-flight')).flightStart!.toISOString().slice(0, 10) > TODAY).toBe(
        true,
      );
      expect((await li('budget-exhausted')).budgetMode).toBe('FIXED');
      const disapproved = await prisma.creativeReview.count({
        where: { sandboxId: id, status: 'DISAPPROVED' },
      });
      expect(disapproved).toBeGreaterThan(0);
      expect(
        await prisma.alert.count({
          where: { sandboxId: id, type: 'NO_SPEND', severity: 'CRITICAL' },
        }),
      ).toBeGreaterThan(0);
      expect(await prisma.alert.count({ where: { sandboxId: id, type: 'UNDERPACING' } })).toBe(2);
      if (template === 'troubleshooting-lab') {
        expect(tags.has('io-conflicting-settings') && tags.has('audience-too-small')).toBe(true);
        expect(
          await prisma.alert.count({ where: { sandboxId: id, type: 'CONFLICTING_SETTINGS' } }),
        ).toBe(1);
      }
    },
  );

  it('a second run changes nothing (idempotent) and a forced rebuild gives the same rows', async () => {
    const id = sbx('starter-agency', SEED);
    const before = await prisma.lineItem.findMany({
      where: { sandboxId: id },
      orderBy: { id: 'asc' },
      select: { id: true, publicId: true },
    });
    const again = await provisionSandbox(prisma, {
      classroomId,
      ownerUserId: null,
      name: `Seed test starter-agency ${SEED}`,
      template: 'starter-agency',
      kind: 'DEMO',
      seedValue: SEED,
      partnerName: `Sandbox TEST-${SEED}`,
      today: TODAY,
    });
    expect(again).toEqual({ sandboxId: id, built: false });
    const unchanged = await prisma.lineItem.findMany({
      where: { sandboxId: id },
      orderBy: { id: 'asc' },
      select: { id: true, publicId: true },
    });
    expect(unchanged).toEqual(before);
    const partnerBefore = await prisma.partner.findUniqueOrThrow({
      where: { id: partnerIdOf(id) },
    });

    const rebuilt = await provision('starter-agency', SEED, '', true);
    expect(rebuilt.built).toBe(true);
    const after = await prisma.lineItem.findMany({
      where: { sandboxId: id },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    expect(after.map((x) => x.id)).toEqual(before.map((x) => x.id));
    expect(await count('SimDailyMetric', id)).toBeGreaterThan(0);
    expect((await prisma.partner.findUniqueOrThrow({ where: { id: partnerIdOf(id) } })).name).toBe(
      partnerBefore.name,
    );
    const sandbox = await prisma.sandbox.findUniqueOrThrow({ where: { id } });
    expect(sandbox.resetCount).toBe(1);
    expect(sandbox.provisionState).toBe('READY');
  }, 120_000);

  /** Rows of a sandbox without ids, sandbox ids and timestamps: what "the same world" means across two sandboxes. */
  async function fingerprint(id: string): Promise<string> {
    const lis = await prisma.lineItem.findMany({
      where: { sandboxId: id },
      orderBy: { name: 'asc' },
      include: { io: { select: { name: true } } },
    });
    const metrics = await prisma.$queryRaw<unknown[]>`
      SELECT l.name, m."simDate", m."sliceKind", m."sliceKey", m.impressions, m.clicks, m."mediaCost", m."bidRequests", m."lostTargeting"
      FROM "SimDailyMetric" m JOIN "LineItem" l ON l.id = m."lineItemId" AND l."sandboxId" = m."sandboxId"
      WHERE m."sandboxId" = ${id} ORDER BY l.name, m."simDate", m."sliceKind", m."sliceKey"`;
    const hourly = await prisma.$queryRaw<unknown[]>`
      SELECT l.name, h."simHour", h.impressions, h."mediaCost" FROM "SimHourlyMetric" h JOIN "LineItem" l ON l.id = h."lineItemId" AND l."sandboxId" = h."sandboxId"
      WHERE h."sandboxId" = ${id} ORDER BY l.name, h."simHour"`;
    const adv = await prisma.advertiser.findMany({
      where: { sandboxId: id },
      orderBy: { name: 'asc' },
      select: { name: true, currencyCode: true, websiteUrl: true },
    });
    return hashValue({
      lis: lis.map((l) => ({
        name: l.name,
        io: l.io.name,
        type: l.type,
        status: l.status,
        bid: l.fixedBidCpm?.toString(),
        budget: l.budgetAmount?.toString(),
        freq: l.freqMaxExposures,
      })),
      metrics,
      hourly,
      adv,
    });
  }

  it('determinism: the same template, seed and knobs give the same rows in two sandboxes; a different seed differs', async () => {
    const a = await fingerprint(sbx('starter-agency', SEED));
    const twin = await fingerprint(sbx('starter-agency', SEED, ' twin'));
    const other = await fingerprint(sbx('starter-agency', SEED + 1));
    expect(twin).toBe(a);
    expect(other).not.toBe(a);
    const idsA = await prisma.lineItem.findMany({
      where: { sandboxId: sbx('starter-agency', SEED) },
      select: { id: true },
    });
    const idsB = await prisma.lineItem.findMany({
      where: { sandboxId: sbx('starter-agency', SEED, ' twin') },
      select: { id: true },
    });
    expect(new Set([...idsA, ...idsB].map((x) => x.id)).size).toBe(idsA.length + idsB.length);
  });

  it('every row has the right sandbox and every foreign and soft reference resolves', async () => {
    const id = sbx('troubleshooting-lab', SEED);
    const q = async (sql: string) => (await prisma.$queryRawUnsafe<{ n: number }[]>(sql, id))[0]!.n;
    // children point at parents of the same sandbox (the composite keys enforce it; the check proves the seed did not rely on luck)
    expect(
      await q(
        `SELECT count(*)::int n FROM "LineItem" l JOIN "InsertionOrder" i ON i.id = l."ioId" WHERE l."sandboxId" = $1 AND i."sandboxId" <> l."sandboxId"`,
      ),
    ).toBe(0);
    expect(
      await q(
        `SELECT count(*)::int n FROM "TargetingAssignment" t WHERE t."sandboxId" = $1 AND t."refType" = 'AUDIENCE' AND NOT EXISTS (SELECT 1 FROM "Audience" a WHERE a.id = t."refId" AND a."sandboxId" = t."sandboxId")`,
      ),
    ).toBe(0);
    expect(
      await q(
        `SELECT count(*)::int n FROM "TargetingAssignment" t WHERE t."sandboxId" = $1 AND t."optionId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "TargetingOption" o WHERE o.id = t."optionId")`,
      ),
    ).toBe(0);
    expect(
      await q(
        `SELECT count(*)::int n FROM "Alert" a WHERE a."sandboxId" = $1 AND a."lineItemId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "LineItem" l WHERE l.id = a."lineItemId" AND l."sandboxId" = a."sandboxId")`,
      ),
    ).toBe(0);
    expect(
      await q(
        `SELECT count(*)::int n FROM "Alert" a WHERE a."sandboxId" = $1 AND a."ioId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "InsertionOrder" l WHERE l.id = a."ioId" AND l."sandboxId" = a."sandboxId")`,
      ),
    ).toBe(0);
    expect(
      await q(
        `SELECT count(*)::int n FROM "CreativeReview" r WHERE r."sandboxId" = $1 AND NOT EXISTS (SELECT 1 FROM "Exchange" e WHERE e.id = r."exchangeId")`,
      ),
    ).toBe(0);
    expect(
      await q(
        `SELECT count(*)::int n FROM "SimDailyMetric" m WHERE m."sandboxId" = $1 AND m."exchangeId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Exchange" e WHERE e.id = m."exchangeId")`,
      ),
    ).toBe(0);
    expect(
      await q(
        `SELECT count(*)::int n FROM "DeliveryDiagnostic" d WHERE d."sandboxId" = $1 AND NOT EXISTS (SELECT 1 FROM "Exchange" e WHERE e.id = d."exchangeId")`,
      ),
    ).toBe(0);
    expect(
      await q(
        `SELECT count(*)::int n FROM "ChangeGroup" g WHERE g."sandboxId" = $1 AND g."entityType" = 'LINE_ITEM' AND NOT EXISTS (SELECT 1 FROM "LineItem" l WHERE l.id = g."entityId" AND l."sandboxId" = g."sandboxId")`,
      ),
    ).toBe(0);
    expect(
      await q(
        `SELECT count(*)::int n FROM "SimDailyMetric" m WHERE m."sandboxId" = $1 AND m."classroomId" <> '${classroomId}'`,
      ),
    ).toBe(0);
    expect(
      await q(
        `SELECT count(*)::int n FROM "ChangeGroup" g WHERE g."sandboxId" = $1 AND g."classroomId" <> '${classroomId}'`,
      ),
    ).toBe(0);
    // the partner has the exchanges of the global list, 54 enabled
    expect(
      await q(`SELECT count(*)::int n FROM "PartnerExchange" WHERE "sandboxId" = $1 AND enabled`),
    ).toBe(54);
    // flights and segments
    expect(
      await q(
        `SELECT count(*)::int n FROM "BudgetSegment" WHERE "sandboxId" = $1 AND "startDate" > "endDate"`,
      ),
    ).toBe(0);
    expect(
      await q(
        `SELECT count(*)::int n FROM "BudgetSegment" s JOIN "InsertionOrder" i ON i.id = s."ioId" JOIN "Campaign" c ON c.id = i."campaignId" WHERE s."sandboxId" = $1 AND (s."startDate" < c."plannedStart" OR (c."plannedEnd" IS NOT NULL AND s."endDate" > c."plannedEnd"))`,
      ),
    ).toBe(0);
  });

  it('public ids are unique, ten digits and come from the global sequence', async () => {
    const rows = await prisma.$queryRaw<{ table: string; n: number; d: number; lo: bigint }[]>`
      SELECT t AS "table", count(*)::int AS n, count(DISTINCT "publicId")::int AS d, min("publicId") AS lo FROM (
        SELECT 'Partner' t, "publicId" FROM "Partner" UNION ALL SELECT 'Advertiser', "publicId" FROM "Advertiser" UNION ALL
        SELECT 'Campaign', "publicId" FROM "Campaign" UNION ALL SELECT 'InsertionOrder', "publicId" FROM "InsertionOrder" UNION ALL
        SELECT 'LineItem', "publicId" FROM "LineItem" UNION ALL SELECT 'Creative', "publicId" FROM "Creative") x GROUP BY t`;
    for (const r of rows) {
      expect(r.d).toBe(r.n);
      expect(BigInt(r.lo) >= PUBLIC_ID_START).toBe(true);
    }
    const all = await prisma.$queryRaw<{ dup: number }[]>`
      SELECT count(*)::int AS dup FROM (SELECT "publicId" FROM "Partner" UNION ALL SELECT "publicId" FROM "Advertiser" UNION ALL SELECT "publicId" FROM "Campaign"
        UNION ALL SELECT "publicId" FROM "InsertionOrder" UNION ALL SELECT "publicId" FROM "LineItem" UNION ALL SELECT "publicId" FROM "Creative"
        UNION ALL SELECT "publicId" FROM "Audience" UNION ALL SELECT "publicId" FROM "TargetingTemplate") u GROUP BY "publicId" HAVING count(*) > 1`;
    expect(all).toHaveLength(0);
  });

  it('row level security: the sandbox role reads the same rows as the owner and nothing of another sandbox', async () => {
    const mine = sbx('starter-agency', SEED);
    const other = sbx('healthy', SEED);
    for (const table of [
      'Partner',
      'Advertiser',
      'Campaign',
      'InsertionOrder',
      'LineItem',
      'Creative',
      'TargetingAssignment',
      'SimDailyMetric',
      'SimHourlyMetric',
      'DeliveryDiagnostic',
      'ChangeGroup',
      'Alert',
    ]) {
      const owner = await count(table, mine);
      const asTenant = await withSandbox(mine, (tx) =>
        tx.$queryRawUnsafe<{ own: number; foreign: number }[]>(
          `SELECT count(*) FILTER (WHERE "sandboxId" = $1)::int AS own, count(*) FILTER (WHERE "sandboxId" <> $1)::int AS foreign FROM "${table}"`,
          mine,
        ),
      );
      expect(asTenant[0]!.own, table).toBe(owner);
      expect(asTenant[0]!.foreign, table).toBe(0);
    }
    const asOther = await withSandbox(other, (tx) =>
      tx.lineItem.count({ where: { sandboxId: mine } }),
    );
    expect(asOther).toBe(0);
  });

  it('history reconciles in the database: daily total = sum of slices, hourly = daily', async () => {
    const id = sbx('starter-agency', SEED);
    const slices = await prisma.$queryRaw<{ bad: number }[]>`
      WITH t AS (SELECT "lineItemId", "simDate", impressions, "bidRequests", "mediaCost", clicks FROM "SimDailyMetric" WHERE "sandboxId" = ${id} AND "sliceKind" = 'total'),
           s AS (SELECT "lineItemId", "simDate", "sliceKind", sum(impressions) impressions, sum("bidRequests") "bidRequests", sum("mediaCost") "mediaCost", sum(clicks) clicks
                 FROM "SimDailyMetric" WHERE "sandboxId" = ${id} AND "sliceKind" <> 'total' GROUP BY 1, 2, 3)
      SELECT count(*)::int AS bad FROM s JOIN t USING ("lineItemId", "simDate")
      WHERE s.impressions <> t.impressions OR s."bidRequests" <> t."bidRequests" OR s.clicks <> t.clicks OR s."mediaCost" <> t."mediaCost"`;
    expect(slices[0]!.bad).toBe(0);
    const sliceCount = await prisma.simDailyMetric.count({
      where: { sandboxId: id, sliceKind: { not: 'total' } },
    });
    expect(sliceCount).toBeGreaterThan(0);
    const hourly = await prisma.$queryRaw<{ bad: number; days: number }[]>`
      WITH h AS (SELECT "lineItemId", ("simHour")::date AS d, sum(impressions) impressions, sum("bidRequests") "bidRequests", sum("mediaCost") "mediaCost", sum(clicks) clicks, sum("lostTargeting") "lostTargeting"
                 FROM "SimHourlyMetric" WHERE "sandboxId" = ${id} GROUP BY 1, 2)
      SELECT count(*)::int AS days, count(*) FILTER (WHERE m.impressions IS NULL OR h.impressions <> m.impressions OR h."bidRequests" <> m."bidRequests" OR h.clicks <> m.clicks OR h."mediaCost" <> m."mediaCost" OR h."lostTargeting" <> m."lostTargeting")::int AS bad
      FROM h LEFT JOIN "SimDailyMetric" m ON m."sandboxId" = ${id} AND m."lineItemId" = h."lineItemId" AND m."simDate" = h.d AND m."sliceKind" = 'total'`;
    expect(hourly[0]!.days).toBeGreaterThan(100);
    expect(hourly[0]!.bad).toBe(0);
    const outside = await prisma.$queryRaw<
      { n: number }[]
    >`SELECT count(*)::int AS n FROM "SimHourlyMetric" WHERE "sandboxId" = ${id} AND "simHour" < ${TODAY}::date - 14`;
    expect(outside[0]!.n).toBe(0);
  });

  it('builds one sandbox in under 60 seconds', () => {
    for (const b of built.values()) {
      if (b.result.ms !== undefined)
        expect(b.result.ms, `${b.template} ${b.seed}`).toBeLessThan(60_000);
    }
    expect([...built.values()].some((b) => b.result.ms !== undefined)).toBe(true);
  });

  it('a failed build leaves the sandbox FAILED with a message, and a re-run repairs it', async () => {
    const name = 'Seed test failing';
    await expect(
      provisionSandbox(prisma, {
        classroomId,
        ownerUserId: null,
        name,
        template: 'healthy',
        kind: 'DEMO',
        seedValue: 9,
        partnerName: 'Sandbox X',
        today: TODAY,
        knobs: { advertisers: 99 },
      }),
    ).rejects.toThrow(/advertisers/);
    // the failure happens before the sandbox row is touched by the plan, so nothing is half written
    const row = await prisma.sandbox.findFirst({ where: { classroomId, name } });
    expect(row?.provisionState).toBe('FAILED');
    expect(row?.provisionError).toMatch(/advertisers/);
    expect(await count('LineItem', row!.id)).toBe(0);
    const repaired = await provisionSandbox(prisma, {
      classroomId,
      ownerUserId: null,
      name,
      template: 'healthy',
      kind: 'DEMO',
      seedValue: 9,
      partnerName: 'Sandbox X',
      today: TODAY,
    });
    expect(repaired.built).toBe(true);
    built.set('repaired', { template: 'healthy', seed: 9, result: repaired });
    expect(
      (await prisma.sandbox.findUniqueOrThrow({ where: { id: row!.id } })).provisionState,
    ).toBe('READY');
  }, 120_000);
});
