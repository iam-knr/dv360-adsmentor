import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma, withSandbox, PUBLIC_ID_START } from '@/lib/db';
import { parseModels, readSchemaText, tenantModels } from '@/lib/db/schema-info';
import { createWorld, dropWorld, type World } from './helpers';

const TENANT_TABLES = tenantModels(parseModels(readSchemaText())).map((m) => m.name);

async function code(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) return e.code;
    throw e;
  }
  return undefined;
}

describe('tenant model', () => {
  let a: World;
  let b: World;

  beforeAll(async () => {
    a = await createWorld('ten-a');
    b = await createWorld('ten-b');
  });

  afterAll(async () => {
    await dropWorld(a);
    await dropWorld(b);
    await prisma.$disconnect();
  });

  it('every table with a sandboxId column has RLS on, with both policies', async () => {
    const rows = await prisma.$queryRaw<{ table: string; rls: boolean; policies: number }[]>`
      SELECT c.relname AS "table", c.relrowsecurity AS rls,
             (SELECT count(*)::int FROM pg_policies p WHERE p.tablename = c.relname AND p.schemaname = 'public') AS policies
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      WHERE c.relkind = 'r'
        AND EXISTS (SELECT 1 FROM information_schema.columns k
                    WHERE k.table_schema = 'public' AND k.table_name = c.relname AND k.column_name = 'sandboxId')`;
    expect(rows.map((r) => r.table).sort()).toEqual([...TENANT_TABLES].sort());
    for (const r of rows) {
      expect(r.rls, `${r.table} has RLS`).toBe(true);
      expect(r.policies, `${r.table} policies`).toBe(2);
    }
  });

  it('the composite foreign key rejects a child that points to a parent of another sandbox', async () => {
    const campaign = prisma.campaign.create({
      data: {
        sandboxId: a.sandboxId,
        advertiserId: b.advertiserId, // advertiser lives in sandbox B
        name: 'cross',
        plannedStart: new Date(),
      },
    });
    expect(await code(campaign)).toBe('P2003');
    const lineItem = prisma.lineItem.create({
      data: {
        sandboxId: a.sandboxId,
        ioId: b.ioId,
        campaignId: a.campaignId,
        advertiserId: a.advertiserId,
        name: 'cross',
        type: 'DISPLAY',
      },
    });
    expect(await code(lineItem)).toBe('P2003');
  });

  it('accepts the same child under a parent of its own sandbox', async () => {
    const row = await prisma.campaign.create({
      data: {
        sandboxId: a.sandboxId,
        advertiserId: a.advertiserId,
        name: 'ok',
        plannedStart: new Date(),
      },
    });
    expect(row.sandboxId).toBe(a.sandboxId);
  });

  it('publicId comes from one global sequence and is unique across tables', async () => {
    const adv = await prisma.advertiser.findMany({
      where: { sandboxId: { in: [a.sandboxId, b.sandboxId] } },
      select: { publicId: true },
    });
    const camp = await prisma.campaign.findMany({
      where: { sandboxId: { in: [a.sandboxId, b.sandboxId] } },
      select: { publicId: true },
    });
    const all = [...adv, ...camp].map((r) => r.publicId);
    expect(new Set(all).size).toBe(all.length);
    for (const id of all) expect(id).toBeGreaterThanOrEqual(PUBLIC_ID_START);
    const first = await prisma.partner.create({ data: { sandboxId: a.sandboxId, name: 'p1' } });
    const second = await prisma.partner.create({ data: { sandboxId: b.sandboxId, name: 'p2' } });
    expect(second.publicId).toBeGreaterThan(first.publicId);
  });

  it('publicId is assigned inside a student session too', async () => {
    const row = await withSandbox(a.sandboxId, (tx) =>
      tx.partner.create({ data: { sandboxId: a.sandboxId, name: 'p3' } }),
    );
    expect(row.publicId).toBeGreaterThanOrEqual(PUBLIC_ID_START);
  });

  it('UserAccessGrant: NULLS NOT DISTINCT rejects a duplicate partner-level grant', async () => {
    const dup = prisma.userAccessGrant.create({
      data: { userId: a.userId, sandboxId: a.sandboxId, partnerId: a.partnerId, role: 'READ_ONLY' },
    });
    expect(await code(dup)).toBe('P2002');
    const other = await prisma.userAccessGrant.create({
      data: {
        userId: a.userId,
        sandboxId: a.sandboxId,
        advertiserId: a.advertiserId,
        role: 'READ_ONLY',
      },
    });
    expect(other.id).toBeTruthy();
  });

  it('DeliveryDiagnostic and SimHourlyMetric: nullable adGroupId is part of the unique key', async () => {
    const diag = prisma.deliveryDiagnostic.create({
      data: {
        sandboxId: a.sandboxId,
        lineItemId: a.lineItemId,
        date: new Date('2026-01-01'),
        exchangeId: 'test-exchange',
        stage: 'AVAILABLE',
        reasonCode: 'M.AVAILABLE',
      },
    });
    expect(await code(diag)).toBe('P2002');
    const hourly = prisma.simHourlyMetric.create({
      data: {
        sandboxId: a.sandboxId,
        lineItemId: a.lineItemId,
        simHour: new Date('2026-01-01T01:00:00Z'),
      },
    });
    expect(await code(hourly)).toBe('P2002');
  });

  it('SimDailyMetric key includes sliceKind (RC-022)', async () => {
    const total = await prisma.simDailyMetric.count({
      where: { lineItemId: a.lineItemId, sliceKind: 'total', sliceKey: '' },
    });
    expect(total).toBe(1);
    const device = await prisma.simDailyMetric.create({
      data: {
        sandboxId: a.sandboxId,
        classroomId: a.classroomId,
        lineItemId: a.lineItemId,
        simDate: new Date('2026-01-01'),
        sliceKind: 'device',
        sliceKey: 'MOBILE',
      },
    });
    expect(device.sliceKind).toBe('device');
  });

  it('TargetingAssignment and PartnerCost need exactly one owner', async () => {
    await expect(
      prisma.targetingAssignment.create({
        data: {
          sandboxId: a.sandboxId,
          ownerType: 'LINE_ITEM',
          lineItemId: a.lineItemId,
          advertiserId: a.advertiserId,
          dimension: 'GEOGRAPHY',
        },
      }),
    ).rejects.toThrow(/TargetingAssignment_one_owner/);
    await expect(
      prisma.targetingAssignment.create({
        data: { sandboxId: a.sandboxId, ownerType: 'LINE_ITEM', dimension: 'GEOGRAPHY' },
      }),
    ).rejects.toThrow(/TargetingAssignment_one_owner/);
    await expect(
      prisma.partnerCost.create({
        data: {
          sandboxId: a.sandboxId,
          ioId: a.ioId,
          lineItemId: a.lineItemId,
          kind: 'CPM_FEE',
          slot: 2,
        },
      }),
    ).rejects.toThrow(/PartnerCost_one_owner/);
  });

  it('versions start at 1 on editable entities (RC-020)', async () => {
    const adv = await prisma.advertiser.findUniqueOrThrow({ where: { id: a.advertiserId } });
    const li = await prisma.lineItem.findUniqueOrThrow({ where: { id: a.lineItemId } });
    expect([adv.version, li.version]).toEqual([1, 1]);
  });

  it('AccountPolicy has its default row (module 19)', async () => {
    const row = await prisma.accountPolicy.findUnique({ where: { id: 1 } });
    expect(row?.lockoutThreshold).toBe(5);
    expect(row?.minPasswordLength).toBe(10);
  });

  it('User defaults: role USER, forced password change, case-insensitive e-mail', async () => {
    const email = `Mixed-${Date.now()}@Example.Test`;
    const u = await prisma.user.create({ data: { email, name: 'Mixed' } });
    try {
      expect(u.appRole).toBe('USER');
      expect(u.mustChangePassword).toBe(true);
      expect(u.status).toBe('ACTIVE');
      const found = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      expect(found?.id).toBe(u.id);
      expect(
        await code(prisma.user.create({ data: { email: email.toUpperCase(), name: 'Dup' } })),
      ).toBe('P2002');
    } finally {
      await prisma.user.delete({ where: { id: u.id } });
    }
  });
});

describe('sandbox lifecycle', () => {
  it('deleting a sandbox removes every tenant row it owns', async () => {
    const w = await createWorld('cascade');
    const before = await prisma.advertiser.count({ where: { sandboxId: w.sandboxId } });
    expect(before).toBe(1);
    await prisma.sandbox.delete({ where: { id: w.sandboxId } });
    for (const table of TENANT_TABLES) {
      const rows = await prisma.$queryRawUnsafe<{ n: number }[]>(
        `SELECT count(*)::int AS n FROM "${table}" WHERE "sandboxId" = $1`,
        w.sandboxId,
      );
      expect(rows[0]?.n, `${table} rows left after sandbox delete`).toBe(0);
    }
    await dropWorld(w);
  });
});
