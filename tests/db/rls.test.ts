import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma, withBypass, withSandbox } from '@/lib/db';
import { parseModels, readCoreSchemaText, tenantModels } from '@/lib/db/schema-info';
import { createWorld, dropWorld, type World } from './helpers';

const TENANT_TABLES = tenantModels(parseModels(readCoreSchemaText())).map((m) => m.name);

describe('row level security', () => {
  let a: World;
  let b: World;

  beforeAll(async () => {
    a = await createWorld('rls-a');
    b = await createWorld('rls-b');
  });

  afterAll(async () => {
    await dropWorld(a);
    await dropWorld(b);
    await prisma.$disconnect();
  });

  it('covers every tenant table the schema defines', () => {
    expect(TENANT_TABLES.length).toBeGreaterThanOrEqual(26);
  });

  it.each(TENANT_TABLES)(
    '%s: a session set to sandbox A reads no row of sandbox B',
    async (table) => {
      const own = await prisma.$queryRawUnsafe<{ n: number }[]>(
        `SELECT count(*)::int AS n FROM "${table}" WHERE "sandboxId" = $1`,
        a.sandboxId,
      );
      expect(own[0]?.n).toBeGreaterThan(0); // the fixture put a row in this table
      const seen = await withSandbox(a.sandboxId, (tx) =>
        tx.$queryRawUnsafe<{ mine: number; others: number }[]>(
          `SELECT count(*) FILTER (WHERE "sandboxId" = $1)::int AS mine,
                count(*) FILTER (WHERE "sandboxId" <> $1)::int AS others FROM "${table}"`,
          a.sandboxId,
        ),
      );
      expect(seen[0]?.others).toBe(0);
      expect(seen[0]?.mine).toBe(own[0]?.n);
    },
  );

  it('shows nothing when no sandbox is set', async () => {
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL ROLE app_tenant`;
      return tx.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM "Advertiser"`;
    });
    expect(rows[0]?.n).toBe(0);
  });

  it('shows nothing when the sandbox id is empty', async () => {
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.sandbox_id', '', true)`;
      await tx.$executeRaw`SET LOCAL ROLE app_tenant`;
      return tx.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM "Advertiser"`;
    });
    expect(rows[0]?.n).toBe(0);
  });

  it('refuses to insert a row into another sandbox', async () => {
    await expect(
      withSandbox(a.sandboxId, (tx) =>
        tx.partner.create({ data: { sandboxId: b.sandboxId, name: 'smuggled' } }),
      ),
    ).rejects.toThrow(/row-level security|violates/i);
  });

  it('cannot update or delete rows of another sandbox', async () => {
    const res = await withSandbox(a.sandboxId, async (tx) => ({
      updated: await tx.advertiser.updateMany({
        where: { id: b.advertiserId },
        data: { name: 'hacked' },
      }),
      deleted: await tx.alert.deleteMany({ where: { sandboxId: b.sandboxId } }),
    }));
    expect(res.updated.count).toBe(0);
    expect(res.deleted.count).toBe(0);
    const still = await prisma.advertiser.findUniqueOrThrow({ where: { id: b.advertiserId } });
    expect(still.name).not.toBe('hacked');
  });

  it('runs as role app_tenant inside withSandbox and resets afterwards', async () => {
    const inside = await withSandbox(
      a.sandboxId,
      (tx) =>
        tx.$queryRaw<
          { who: string; sb: string }[]
        >`SELECT current_user AS who, current_setting('app.sandbox_id') AS sb`,
    );
    expect(inside[0]).toEqual({ who: 'app_tenant', sb: a.sandboxId });
    const after = await prisma.$queryRaw<{ who: string }[]>`SELECT current_user AS who`;
    expect(after[0]?.who).not.toBe('app_tenant');
  });

  it('withBypass sees every sandbox', async () => {
    const rows = await withBypass(
      (tx) =>
        tx.$queryRaw<
          { n: number }[]
        >`SELECT count(DISTINCT "sandboxId")::int AS n FROM "Advertiser" WHERE "sandboxId" IN (${a.sandboxId}, ${b.sandboxId})`,
    );
    expect(rows[0]?.n).toBe(2);
  });

  it('a student session cannot read accounts or write global tables', async () => {
    await expect(
      withSandbox(a.sandboxId, (tx) => tx.$queryRaw`SELECT "passwordHash" FROM "User" LIMIT 1`),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      withSandbox(a.sandboxId, (tx) =>
        tx.exchange.create({ data: { code: `x-${Date.now()}`, name: 'nope' } }),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('a student session may read the global reference tables', async () => {
    const n = await withSandbox(a.sandboxId, (tx) => tx.exchange.count());
    expect(n).toBeGreaterThan(0);
  });

  it('RLS_ENABLED=false keeps the sandbox setting but does not switch role (fallback F-4)', async () => {
    const prev = process.env.RLS_ENABLED;
    process.env.RLS_ENABLED = 'false';
    try {
      const rows = await withSandbox(
        a.sandboxId,
        (tx) =>
          tx.$queryRaw<
            { who: string; sb: string }[]
          >`SELECT current_user AS who, current_setting('app.sandbox_id') AS sb`,
      );
      expect(rows[0]?.who).not.toBe('app_tenant');
      expect(rows[0]?.sb).toBe(a.sandboxId);
    } finally {
      if (prev === undefined) delete process.env.RLS_ENABLED;
      else process.env.RLS_ENABLED = prev;
    }
  });
});
