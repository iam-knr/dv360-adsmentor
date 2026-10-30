// PROD-CRASH. Supabase can switch row level security on for EVERY table in `public`. A global table that app_tenant may
// SELECT but that has no policy then returns zero rows, and serviceCtx() answered FORBIDDEN on Campaigns, Reports,
// Channels, Custom bidding and Floodlights. This test does what Supabase does (ENABLE, not FORCE: the owner role stays
// exempt), provisions two students with the real provisioning job, and loads the service functions behind those pages.
// It also proves that student A cannot read student B's Sandbox or Classroom row. The shared test database is left with
// RLS enabled on all tables, which changes nothing for the owner role the other tests use.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveClassContext } from '@/lib/access/class-context';
import type { SessionUser } from '@/lib/auth/types';
import { listCampaigns } from '@/lib/campaigns/service';
import { prisma, withBypass, withSandbox } from '@/lib/db';
import { listChannels } from '@/lib/resources/lists';
import { listCustomBidding } from '@/lib/resources/custom-bidding';
import { listPartnerFloodlightGroups } from '@/lib/resources/floodlight';
import { listReports, listTemplates, pageContext } from '@/lib/reporting/service';
import { advanceProvisioning, enqueueProvisionSandbox, getProvisionView } from '@/lib/sandbox/provision';
import { ensureReferenceData } from '@/lib/seed/ensure';
import { clearSandboxData } from '@/lib/seed/write';
import { cleanup, createAccount, createClassroom, uniq } from '../auth/fixtures';

const userIds: string[] = [];
const classroomIds: string[] = [];
const sandboxIds: string[] = [];

interface Student {
  user: SessionUser;
  userId: string;
  sandboxId: string;
  classroomId: string;
  partnerId: string;
  advertiserId: string;
}

async function student(tag: string, ownerAdminId: string): Promise<Student> {
  const cohort = await createClassroom(prisma, { tag, ownerAdminId });
  classroomIds.push(cohort.id);
  await prisma.classroom.update({
    where: { id: cohort.id },
    data: { defaultSeedTemplate: 'starter-agency' },
  });
  const { user } = await createAccount(prisma, { tag, role: 'USER', cohortId: cohort.id });
  userIds.push(user.id);
  await prisma.classroomMember.create({ data: { classroomId: cohort.id, userId: user.id } });
  const queued = await enqueueProvisionSandbox(cohort.id, user.id);
  const sandboxId = queued.sandboxId as string;
  sandboxIds.push(sandboxId);
  for (let i = 0; i < 8 && (await getProvisionView(user.id)).state !== 'READY'; i++) {
    await advanceProvisioning(Date.now() + 120_000, { limit: 50, classroomId: cohort.id });
  }
  expect((await getProvisionView(user.id)).state).toBe('READY');
  const ctx = await resolveClassContext(user.id);
  expect(ctx.sandboxId).toBe(sandboxId);
  const partner = await prisma.partner.findFirstOrThrow({ where: { sandboxId } });
  const adv = await prisma.advertiser.findFirstOrThrow({ where: { sandboxId } });
  return {
    userId: user.id,
    sandboxId,
    classroomId: cohort.id,
    partnerId: partner.publicId.toString(),
    advertiserId: adv.publicId.toString(),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      appRole: 'user',
      classroomId: cohort.id,
      sandboxId,
      partnerId: ctx.partnerId,
      dvRole: 'STANDARD',
    },
  };
}

let a: Student;
let b: Student;

beforeAll(async () => {
  process.env.SANDBOX_ENGINE_DAYS = '3';
  await ensureReferenceData(prisma);
  // what Supabase does
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  for (const t of tables) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "${t.tablename}" ENABLE ROW LEVEL SECURITY`);
  }
  const admin = await createAccount(prisma, { tag: uniq('rls-admin'), role: 'SUPER_ADMIN' });
  userIds.push(admin.user.id);
  a = await student(uniq('rls-a'), admin.user.id);
  b = await student(uniq('rls-b'), admin.user.id);
}, 600_000);

afterAll(async () => {
  for (const id of sandboxIds) {
    await prisma.$transaction((tx) => clearSandboxData(tx, id), { timeout: 120_000 });
    await prisma.userAccessGrant.deleteMany({ where: { sandboxId: id } });
  }
  await cleanup(prisma, { classroomIds, userIds });
  await prisma.$disconnect();
}, 300_000);

describe('RLS enabled on every public table (Supabase)', () => {
  it('every table has RLS on', async () => {
    const off = await prisma.$queryRaw<{ relname: string }[]>`
      SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity AND c.relname <> '_prisma_migrations'`;
    expect(off).toEqual([]);
  });

  it('every table app_tenant may SELECT has a policy for app_tenant (guards future migrations)', async () => {
    const bare = await prisma.$queryRaw<{ t: string }[]>`
      SELECT g.table_name AS t FROM information_schema.role_table_grants g
      WHERE g.grantee = 'app_tenant' AND g.table_schema = 'public' AND g.privilege_type = 'SELECT'
        AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = g.table_name
                        AND 'app_tenant' = ANY (p.roles))`;
    expect(bare).toEqual([]);
  });

  it.each([
    ['a', () => a],
    ['b', () => b],
  ])('the service functions behind the five crashing pages work for student %s', async (_n, get) => {
    const s = get();
    const campaigns = await listCampaigns(s.user, s.advertiserId, { status: ['*'], pageSize: 1000 });
    expect(campaigns.rows.length).toBeGreaterThan(0);
    await expect(listChannels(s.user, { level: 'partner', id: s.partnerId })).resolves.toBeInstanceOf(Array);
    await expect(listCustomBidding(s.user, { level: 'partner', id: s.partnerId })).resolves.toBeInstanceOf(Array);
    await expect(listPartnerFloodlightGroups(s.user, s.partnerId)).resolves.toBeInstanceOf(Array);
    const ctx = await pageContext(s.user, s.partnerId);
    expect(ctx.partner.publicId).toBe(s.partnerId);
    await listReports(s.user, s.partnerId, { kind: 'instant', createdBy: 'me', q: '', page: 1 });
    expect(listTemplates().length).toBeGreaterThan(0);
  }, 120_000);

  it('global catalogues stay readable for a student session', async () => {
    const counts = await withSandbox(a.sandboxId, async (tx) => ({
      exchanges: await tx.exchange.count(),
      options: await tx.targetingOption.count(),
      market: await tx.marketplaceProduct.count(),
      fields: await tx.reportField.count(),
    }));
    for (const v of Object.values(counts)) expect(v).toBeGreaterThan(0);
  });

  it('student A reads only their own Sandbox and Classroom row', async () => {
    const seen = await withSandbox(a.sandboxId, async (tx) => ({
      sandboxes: (await tx.sandbox.findMany({ select: { id: true } })).map((r) => r.id),
      classrooms: (await tx.classroom.findMany({ select: { id: true } })).map((r) => r.id),
      other: await tx.sandbox.findUnique({ where: { id: b.sandboxId } }),
      otherClassroom: await tx.classroom.findUnique({ where: { id: b.classroomId } }),
    }));
    expect(seen.sandboxes).toEqual([a.sandboxId]);
    expect(seen.classrooms).toEqual([a.classroomId]);
    expect(seen.other).toBeNull();
    expect(seen.otherClassroom).toBeNull();
  });

  it('the engine role (withBypass) still sees every sandbox and the catalogues', async () => {
    const r = await withBypass(async (tx) => ({
      sandboxes: await tx.sandbox.count({ where: { id: { in: [a.sandboxId, b.sandboxId] } } }),
      exchanges: await tx.exchange.count(),
    }));
    expect(r.sandboxes).toBe(2);
    expect(r.exchanges).toBeGreaterThan(0);
  });

  it('a student session cannot write a policy covered table', async () => {
    await expect(
      withSandbox(a.sandboxId, (tx) => tx.sandbox.update({ where: { id: a.sandboxId }, data: { name: 'x' } })),
    ).rejects.toThrow();
  });

  it('a notice of another classroom is not visible, a platform wide one is', async () => {
    const own = await prisma.notification.create({
      data: { classroomId: b.classroomId, title: 'b only', body: 'x', createdById: b.userId },
    });
    const global = await prisma.notification.create({
      data: { classroomId: null, title: 'everyone', body: 'x', createdById: b.userId },
    });
    try {
      const ids = await withSandbox(a.sandboxId, async (tx) =>
        (await tx.notification.findMany({ select: { id: true } })).map((r) => r.id),
      );
      expect(ids).toContain(global.id);
      expect(ids).not.toContain(own.id);
    } finally {
      await prisma.notification.deleteMany({ where: { id: { in: [own.id, global.id] } } });
    }
  });
});
