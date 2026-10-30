// M18-05: the sandbox provisioning job. Seeds with the engine's history mode (3 engine days here to keep it quick;
// production uses 90, see lib/sandbox/provision.ts).
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/db';
import {
  advanceProvisioning,
  enqueueProvisionSandbox,
  getProvisionView,
  retryProvisionSandbox,
  runProvisionStep,
} from '@/lib/sandbox/provision';
import { seedReferenceData } from '@/lib/seed/reference-db';
import { partnerIdOf } from '@/lib/seed/sandbox';
import { clearSandboxData } from '@/lib/seed/write';
import { cleanup, createAccount, createClassroom, uniq } from '../auth/fixtures';

// lets one test make the seed fail once
const failNext = vi.hoisted(() => ({ message: null as string | null }));
vi.mock('@/lib/seed/sandbox', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/seed/sandbox')>();
  return {
    ...real,
    provisionSandbox: (...args: Parameters<typeof real.provisionSandbox>) => {
      if (failNext.message) {
        const message = failNext.message;
        failNext.message = null;
        return Promise.reject(new Error(message));
      }
      return real.provisionSandbox(...args);
    },
  };
});

const userIds: string[] = [];
const classroomIds: string[] = [];
const sandboxIds: string[] = [];
let admin: { id: string };
let classroomId: string;

async function student(tag: string) {
  const { user } = await createAccount(prisma, { tag, role: 'USER', cohortId: classroomId });
  await prisma.classroomMember.create({ data: { classroomId, userId: user.id } });
  userIds.push(user.id);
  return user.id;
}

beforeAll(async () => {
  process.env.SANDBOX_ENGINE_DAYS = '3';
  await seedReferenceData(prisma);
  const a = await createAccount(prisma, { tag: uniq('prov-admin'), role: 'ADMIN' });
  admin = a.user;
  userIds.push(admin.id);
  const c = await createClassroom(prisma, { tag: 'prov', ownerAdminId: admin.id });
  classroomId = c.id;
  classroomIds.push(classroomId);
  await prisma.classroom.update({
    where: { id: classroomId },
    data: { defaultSeedTemplate: 'starter-agency' },
  });
}, 300_000);

afterAll(async () => {
  for (const id of sandboxIds) {
    await prisma.$transaction((tx) => clearSandboxData(tx, id), { timeout: 120_000 });
    await prisma.userAccessGrant.deleteMany({ where: { sandboxId: id } });
  }
  await cleanup(prisma, { classroomIds, userIds });
  await prisma.$disconnect();
}, 300_000);

describe('enqueue', () => {
  it('creates one PENDING sandbox per student and is idempotent', async () => {
    const id = await student('prov-a');
    const first = await enqueueProvisionSandbox(classroomId, id);
    expect(first.state).toBe('QUEUED');
    expect(first.sandboxId).toBeTruthy();
    sandboxIds.push(first.sandboxId as string);
    const again = await enqueueProvisionSandbox(classroomId, id);
    expect(again.sandboxId).toBe(first.sandboxId);
    const rows = await prisma.sandbox.findMany({ where: { classroomId, ownerUserId: id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: 'STUDENT',
      provisionState: 'PENDING',
      seedTemplateKey: 'starter-agency',
      resetCount: 0,
    });
    expect(rows[0]?.name).toMatch(/^Sandbox /);
  });

  it('gives an Admin no sandbox and an unknown id none either', async () => {
    expect((await enqueueProvisionSandbox(classroomId, admin.id)).state).toBe('NOT_CREATED');
    expect((await getProvisionView('nobody', classroomId)).state).toBe('NOT_CREATED');
  });
});

describe('build', () => {
  it('seeds, backfills with the engine, grants access and ends READY without counting a reset', async () => {
    const id = await student('prov-b');
    const queued = await enqueueProvisionSandbox(classroomId, id);
    const sandboxId = queued.sandboxId as string;
    sandboxIds.push(sandboxId);

    const t = Date.now();
    const view = await runProvisionStep(sandboxId);
    console.log(`provision step (3 engine days) took ${Date.now() - t} ms`);
    expect(view).toMatchObject({ state: 'READY', percent: 100, sandboxId });

    const sb = await prisma.sandbox.findUniqueOrThrow({ where: { id: sandboxId } });
    expect(sb).toMatchObject({ provisionState: 'READY', resetCount: 0, provisionError: null });
    const clock = await prisma.simClock.findUniqueOrThrow({ where: { sandboxId } });
    expect(Number(clock.tickIndex)).toBe(90 * 24);
    expect(clock.state).toBe('PAUSED');
    const grant = await prisma.userAccessGrant.findFirst({
      where: { userId: id, sandboxId, partnerId: partnerIdOf(sandboxId), advertiserId: null },
    });
    expect(grant?.role).toBe('STANDARD');
    const jobs = await prisma.simJob.findMany({ where: { sandboxId } });
    expect(jobs.map((j) => [j.kind, j.status])).toEqual([['FAST_FORWARD', 'DONE']]);
    // reports, plans, bulk views and experiments were seeded after the history
    expect(await prisma.report.count({ where: { sandboxId } })).toBeGreaterThan(0);
    expect(await prisma.experiment.count({ where: { sandboxId } })).toBeGreaterThan(0);
    // the session finds the partner through the owner's sandbox
    expect(await prisma.partner.count({ where: { sandboxId } })).toBe(1);
    // a finished sandbox is not touched again
    expect((await runProvisionStep(sandboxId)).state).toBe('READY');
    expect(await prisma.simJob.count({ where: { sandboxId } })).toBe(1);
  }, 600_000);

  it('works in chunks: a spent budget leaves BUILDING and the next steps finish the same job', async () => {
    const id = await student('prov-c');
    const sandboxId = (await enqueueProvisionSandbox(classroomId, id)).sandboxId as string;
    sandboxIds.push(sandboxId);

    // a spent budget still seeds and starts the history job; the job waits for the next step
    let view = await runProvisionStep(sandboxId, { budgetMs: 1 });
    expect(view).toMatchObject({ state: 'BUILDING', percent: 10 });
    expect(
      await prisma.simJob.count({ where: { sandboxId, status: { in: ['QUEUED', 'RUNNING'] } } }),
    ).toBe(1);
    // each later step moves the job on; it never restarts
    for (let i = 0; i < 20 && view.state === 'BUILDING'; i++) {
      view = await runProvisionStep(sandboxId);
    }
    expect(view).toMatchObject({ state: 'READY', percent: 100 });
    expect(await prisma.simJob.count({ where: { sandboxId } })).toBe(1);
  }, 600_000);

  it('builds one sandbox when two callers step at once', async () => {
    const id = await student('prov-d');
    const sandboxId = (await enqueueProvisionSandbox(classroomId, id)).sandboxId as string;
    sandboxIds.push(sandboxId);
    const [a, b] = await Promise.all([runProvisionStep(sandboxId), runProvisionStep(sandboxId)]);
    expect([a.state, b.state]).toContain('READY');
    // the loser may report BUILDING; one more step settles it
    expect((await runProvisionStep(sandboxId)).state).toBe('READY');
    expect(await prisma.partner.count({ where: { sandboxId } })).toBe(1);
    expect(await prisma.userAccessGrant.count({ where: { sandboxId, userId: id } })).toBe(1);
  }, 600_000);
});

describe('failure and retry', () => {
  it('ends FAILED with the message, keeps it until a retry, and the retry builds it', async () => {
    const id = await student('prov-e');
    const sandboxId = (await enqueueProvisionSandbox(classroomId, id)).sandboxId as string;
    sandboxIds.push(sandboxId);

    failNext.message = 'seed exploded';
    const failed = await runProvisionStep(sandboxId);
    expect(failed).toMatchObject({ state: 'FAILED', error: 'seed exploded' });
    // stepping does not restart a failed build by itself
    expect((await runProvisionStep(sandboxId)).state).toBe('FAILED');

    const retried = await retryProvisionSandbox(classroomId, id);
    expect(retried.state).toBe('READY');
    const sb = await prisma.sandbox.findUniqueOrThrow({ where: { id: sandboxId } });
    expect(sb.provisionError).toBeNull();
  }, 600_000);

  it('creates the sandbox on retry when the student has none', async () => {
    const id = await student('prov-f');
    const view = await retryProvisionSandbox(classroomId, id);
    expect(view.state).toBe('READY');
    if (view.sandboxId) sandboxIds.push(view.sandboxId);
  }, 600_000);
});

describe('timer', () => {
  it('starts students who have an account but no sandbox and builds queued ones', async () => {
    const id = await student('prov-g');
    expect(await prisma.sandbox.count({ where: { ownerUserId: id } })).toBe(0);
    const r = await advanceProvisioning(Date.now() + 120_000, { limit: 50, classroomId });
    expect(r.started).toBeGreaterThan(0);
    const sb = await prisma.sandbox.findFirstOrThrow({ where: { ownerUserId: id } });
    sandboxIds.push(sb.id);
    for (
      let i = 0;
      i < 5 && sb && (await getProvisionView(id, classroomId)).state !== 'READY';
      i++
    ) {
      await advanceProvisioning(Date.now() + 120_000, { limit: 50, classroomId });
    }
    expect((await getProvisionView(id, classroomId)).state).toBe('READY');
  }, 900_000);
});
