// P3-05c. Introspection of the migrated database for the tables added by 0002_extended, plus behaviour checks.
import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma, withSandbox } from '@/lib/db';
import { parseModels, tenantModels } from '@/lib/db/schema-info';
import { extendedSchemaText } from '../../prisma/sql/extended-rls';
import { createWorld, dropWorld, type World } from './helpers';

const models = parseModels(extendedSchemaText());
const TENANT = tenantModels(models).map((m) => m.name);
const GLOBAL = models.map((m) => m.name).filter((n) => !TENANT.includes(n));

/** Global tables: no sandboxId, no RLS. Every one is a catalogue, a definition or a classroom level row. */
const GLOBAL_ALLOW_LIST = [
  'AppCatalog',
  'FxRate',
  'GoogleAudience',
  'HelpArticle',
  'InstructorNote',
  'MarketplaceProduct',
  'Notification',
  'NotificationDismissal',
  'Permission',
  'PlanCountry',
  'ReportField',
  'ReportTemplate',
  'Role',
  'RolePermission',
  'SandboxSnapshot',
  'Scenario',
  'ScenarioAssignment',
  'ScenarioEvent',
  'ScenarioSeedPatch',
  'ScenarioStep',
  'SeedTemplate',
  'SubLocation',
  'ThirdPartyVendor',
  'TvCampaign',
  'YoutubeVideo',
];

interface Fk {
  child: string;
  parent: string;
  cols: string[];
}

async function foreignKeys(): Promise<Fk[]> {
  const rows = await prisma.$queryRaw<{ child: string; parent: string; cols: string[] }[]>`
    SELECT c.conrelid::regclass::text AS child, c.confrelid::regclass::text AS parent,
           array_agg(a.attname ORDER BY k.ord) AS cols
    FROM pg_constraint c
    CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
    WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
    GROUP BY c.oid, c.conrelid, c.confrelid`;
  const unquote = (s: string) => s.replace(/^"|"$/g, '');
  return rows.map((r) => ({ child: unquote(r.child), parent: unquote(r.parent), cols: r.cols }));
}

describe('0002_extended: introspection', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('splits the new models into tenant tables and an allow-list of global ones', () => {
    expect(TENANT.length).toBeGreaterThan(70);
    expect([...GLOBAL].sort()).toEqual([...GLOBAL_ALLOW_LIST].sort());
  });

  it('every new table exists in the database', async () => {
    const rows = await prisma.$queryRaw<{ t: string }[]>`
      SELECT table_name AS t FROM information_schema.tables WHERE table_schema = 'public'`;
    const have = new Set(rows.map((r) => r.t));
    expect([...TENANT, ...GLOBAL].filter((n) => !have.has(n))).toEqual([]);
  });

  it('every tenant table has a NOT NULL sandboxId column', async () => {
    const rows = await prisma.$queryRaw<{ t: string; nullable: string }[]>`
      SELECT table_name AS t, is_nullable AS nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'sandboxId'`;
    const byTable = new Map(rows.map((r) => [r.t, r.nullable]));
    for (const t of TENANT) expect(byTable.get(t), `${t}.sandboxId`).toBe('NO');
  });

  it('no global table has a sandboxId column', async () => {
    const rows = await prisma.$queryRaw<{ t: string }[]>`
      SELECT table_name AS t FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'sandboxId'`;
    const withSandbox = new Set(rows.map((r) => r.t));
    expect(GLOBAL.filter((n) => withSandbox.has(n))).toEqual([]);
  });

  it('every tenant table has RLS on with exactly the two standard policies', async () => {
    const rows = await prisma.$queryRaw<{ t: string; rls: boolean; names: string[] }[]>`
      SELECT c.relname AS t, c.relrowsecurity AS rls,
             coalesce((SELECT array_agg(p.policyname ORDER BY p.policyname) FROM pg_policies p
                       WHERE p.schemaname = 'public' AND p.tablename = c.relname), '{}') AS names
      FROM pg_class c WHERE c.relkind = 'r' AND c.relnamespace = 'public'::regnamespace`;
    const byTable = new Map(rows.map((r) => [r.t, r]));
    for (const t of TENANT) {
      const r = byTable.get(t);
      expect(r?.rls, `${t} RLS`).toBe(true);
      expect(r?.names, `${t} policies`).toEqual(['engine_access', 'tenant_isolation']);
    }
    for (const t of GLOBAL) expect(byTable.get(t)?.rls, `${t} has no RLS`).toBe(false);
  });

  it('every tenant table is tied to a sandbox by a foreign key that carries sandboxId', async () => {
    const fks = await foreignKeys();
    for (const t of TENANT) {
      const own = fks.filter((f) => f.child === t);
      const tied = own.some((f) => f.cols.includes('sandboxId') && f.parent !== t);
      expect(tied, `${t} has a foreign key containing sandboxId`).toBe(true);
    }
  });

  it('every foreign key between two tenant tables is composite and includes sandboxId', async () => {
    const fks = await foreignKeys();
    const tenantAll = new Set(
      (
        await prisma.$queryRaw<{ t: string }[]>`
          SELECT table_name AS t FROM information_schema.columns
          WHERE table_schema = 'public' AND column_name = 'sandboxId'`
      ).map((r) => r.t),
    );
    const bad = fks
      .filter((f) => TENANT.includes(f.child) && tenantAll.has(f.parent) && f.parent !== 'Sandbox')
      .filter((f) => !(f.cols.length >= 2 && f.cols.includes('sandboxId')))
      .map((f) => `${f.child} -> ${f.parent} (${f.cols.join(', ')})`);
    expect(bad).toEqual([]);
  });

  it('a student session can read the catalogues and write none of them', async () => {
    const privs = await prisma.$queryRaw<{ t: string; priv: string }[]>`
      SELECT table_name AS t, privilege_type AS priv FROM information_schema.role_table_grants
      WHERE grantee = 'app_tenant' AND table_schema = 'public'`;
    const has = (t: string, p: string) => privs.some((x) => x.t === t && x.priv === p);
    for (const t of [
      'GoogleAudience',
      'ReportField',
      'MarketplaceProduct',
      'Scenario',
      'Notification',
    ]) {
      expect(has(t, 'SELECT'), `${t} select`).toBe(true);
      expect(has(t, 'INSERT'), `${t} insert`).toBe(false);
    }
    for (const t of [
      'InstructorNote',
      'SandboxSnapshot',
      'ScenarioAssignment',
      'NotificationDismissal',
    ]) {
      expect(has(t, 'SELECT'), `${t} select`).toBe(false);
    }
    for (const t of TENANT) {
      for (const p of ['SELECT', 'INSERT', 'UPDATE', 'DELETE'])
        expect(has(t, p), `${t} ${p}`).toBe(true);
    }
  });
});

async function code(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) return e.code;
    throw e;
  }
  return undefined;
}

describe('0002_extended: behaviour', () => {
  let a: World;
  let b: World;

  beforeAll(async () => {
    a = await createWorld('ext-a');
    b = await createWorld('ext-b');
  });

  afterAll(async () => {
    await dropWorld(a);
    await dropWorld(b);
    await prisma.$disconnect();
  });

  async function floodlight(w: World, name: string) {
    const group = await prisma.floodlightGroup.create({
      data: { sandboxId: w.sandboxId, advertiserId: w.advertiserId, name },
    });
    const activity = await prisma.floodlightActivity.create({
      data: { sandboxId: w.sandboxId, groupId: group.id, name: `${name} activity` },
    });
    return { group, activity };
  }

  it('a session set to sandbox A reads none of the rows of sandbox B', async () => {
    const fa = await floodlight(a, 'A group');
    await floodlight(b, 'B group');
    await prisma.channel.create({
      data: { sandboxId: a.sandboxId, advertiserId: a.advertiserId, name: 'A channel' },
    });
    await prisma.channel.create({
      data: { sandboxId: b.sandboxId, advertiserId: b.advertiserId, name: 'B channel' },
    });
    const seen = await withSandbox(a.sandboxId, async (tx) => ({
      groups: await tx.floodlightGroup.findMany(),
      activities: await tx.floodlightActivity.findMany(),
      channels: await tx.channel.findMany(),
    }));
    expect(seen.groups.map((g) => g.id)).toEqual([fa.group.id]);
    expect(seen.activities.map((x) => x.id)).toEqual([fa.activity.id]);
    expect(seen.channels.map((c) => c.sandboxId)).toEqual([a.sandboxId]);
  });

  it('a session cannot write a row into another sandbox', async () => {
    const attempt = withSandbox(a.sandboxId, (tx) =>
      tx.keywordList.create({
        data: { sandboxId: b.sandboxId, advertiserId: b.advertiserId, name: 'sneaky' },
      }),
    );
    await expect(attempt).rejects.toThrow();
  });

  it('the composite foreign key rejects a child that points to a parent of another sandbox', async () => {
    const fb = await floodlight(b, 'B other group');
    const crossActivity = prisma.floodlightActivity.create({
      data: { sandboxId: a.sandboxId, groupId: fb.group.id, name: 'cross' },
    });
    expect(await code(crossActivity)).toBe('P2003');
    const crossList = prisma.locationList.create({
      data: {
        sandboxId: a.sandboxId,
        advertiserId: b.advertiserId,
        name: 'cross',
        type: 'REGIONAL',
      },
    });
    expect(await code(crossList)).toBe('P2003');
  });

  it('deleting a parent removes its children and the lists that belong to it', async () => {
    const list = await prisma.keywordList.create({
      data: { sandboxId: a.sandboxId, advertiserId: a.advertiserId, name: 'negatives' },
    });
    await prisma.keywordListEntry.create({
      data: { sandboxId: a.sandboxId, keywordListId: list.id, keyword: 'free' },
    });
    expect(
      await code(
        prisma.keywordListEntry.create({
          data: { sandboxId: a.sandboxId, keywordListId: list.id, keyword: 'free' },
        }),
      ),
    ).toBe('P2002');
    await prisma.keywordList.delete({ where: { id: list.id } });
    expect(await prisma.keywordListEntry.count({ where: { keywordListId: list.id } })).toBe(0);
  });

  it('numbers PID tables from the shared public id sequence', async () => {
    const group = await prisma.floodlightGroup.findFirstOrThrow({
      where: { sandboxId: a.sandboxId },
    });
    expect(group.publicId >= 5100000001n).toBe(true);
  });

  it('enforces the one-owner and range checks', async () => {
    const both = prisma.thirdPartyRateCard.create({
      data: {
        sandboxId: a.sandboxId,
        partnerId: a.partnerId,
        advertiserId: a.advertiserId,
        vendorKey: 'v',
        vendorName: 'Vendor',
        rateMediaFeePct: '5',
      },
    });
    await expect(both).rejects.toThrow(/one_owner/);
    const none = prisma.channel.create({ data: { sandboxId: a.sandboxId, name: 'orphan' } });
    await expect(none).rejects.toThrow(/one_owner/);
    const split = prisma.experiment.create({
      data: {
        sandboxId: a.sandboxId,
        advertiserId: a.advertiserId,
        name: 'e',
        startDate: new Date('2026-02-01'),
        target: 'LINE_ITEM',
      },
    });
    const exp = await split;
    const badArm = prisma.experimentArm.create({
      data: { sandboxId: a.sandboxId, experimentId: exp.id, splitPct: 120 },
    });
    await expect(badArm).rejects.toThrow(/split_range/);
  });

  it('keeps a line item out of two arms of one experiment', async () => {
    const exp = await prisma.experiment.create({
      data: {
        sandboxId: a.sandboxId,
        advertiserId: a.advertiserId,
        name: 'ab',
        startDate: new Date('2026-02-01'),
        target: 'LINE_ITEM',
      },
    });
    const arm1 = await prisma.experimentArm.create({
      data: { sandboxId: a.sandboxId, experimentId: exp.id, name: 'Arm 1', isControl: true },
    });
    const arm2 = await prisma.experimentArm.create({
      data: { sandboxId: a.sandboxId, experimentId: exp.id, name: 'Arm 2', ordinal: 1 },
    });
    await prisma.experimentArmEntity.create({
      data: {
        sandboxId: a.sandboxId,
        experimentId: exp.id,
        armId: arm1.id,
        lineItemId: a.lineItemId,
      },
    });
    const again = prisma.experimentArmEntity.create({
      data: {
        sandboxId: a.sandboxId,
        experimentId: exp.id,
        armId: arm2.id,
        lineItemId: a.lineItemId,
      },
    });
    expect(await code(again)).toBe('P2002');
  });
});

describe('0002_extended on a database that already holds 0001 data', () => {
  const raw = process.env.DATABASE_URL_TEST ?? '';
  const dbName = 'dv360_test_ext_upgrade';
  let admin: Client;
  let db: Client;

  beforeAll(async () => {
    const adminUrl = new URL(raw);
    adminUrl.pathname = '/postgres';
    admin = new Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${dbName}"`);
    const url = new URL(raw);
    url.pathname = `/${dbName}`;
    db = new Client({ connectionString: url.toString() });
    await db.connect();
  });

  afterAll(async () => {
    await db.end();
    await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await admin.end();
  });

  it('applies on top of 0001 and keeps every existing row', async () => {
    await db.query(readFileSync('prisma/migrations/0000_base/migration.sql', 'utf8'));
    await db.query(readFileSync('prisma/migrations/0001_core/migration.sql', 'utf8'));
    await db.query(
      `INSERT INTO "User" ("id","email","name","updatedAt") VALUES ('u1','seed-admin@example.test','Seed Admin',now())`,
    );
    await db.query(
      `INSERT INTO "Classroom" ("id","name","code","ownerAdminId","updatedAt") VALUES ('c1','Seed class','seed-code','u1',now())`,
    );
    await db.query(
      `INSERT INTO "Sandbox" ("id","classroomId","name","seedValue","updatedAt") VALUES ('s1','c1','Seed sandbox',7,now())`,
    );
    await db.query(
      `INSERT INTO "Partner" ("id","sandboxId","name","updatedAt") VALUES ('p1','s1','Seed partner',now())`,
    );
    await db.query(
      `INSERT INTO "Advertiser" ("id","sandboxId","partnerId","name","websiteUrl","currencyCode","timeZone","updatedAt")
       VALUES ('a1','s1','p1','Seed advertiser','https://example.test','INR','Asia/Calcutta',now())`,
    );
    const before = await db.query(
      `SELECT (SELECT count(*) FROM "Advertiser")::int AS n, (SELECT count(*) FROM "Sandbox")::int AS s`,
    );

    await db.query(readFileSync('prisma/migrations/0002_extended/migration.sql', 'utf8'));

    const after = await db.query(
      `SELECT (SELECT count(*) FROM "Advertiser")::int AS n, (SELECT count(*) FROM "Sandbox")::int AS s`,
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
    // the seeded advertiser can now own the new rows, and the old rows are untouched
    await db.query(
      `INSERT INTO "FloodlightGroup" ("id","sandboxId","advertiserId","name","updatedAt") VALUES ('f1','s1','a1','Group',now())`,
    );
    const adv = await db.query<{ name: string }>(
      `SELECT "name" FROM "Advertiser" WHERE "id" = 'a1'`,
    );
    expect(adv.rows[0]?.name).toBe('Seed advertiser');
    const rls = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_class WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace AND relrowsecurity`,
    );
    expect(rls.rows[0]?.n).toBe(TENANT.length + 26);
  });
});
