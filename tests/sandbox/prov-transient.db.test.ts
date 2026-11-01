// PROV-RACE2: a transient error inside a build step is retried a bounded number of times instead of ending the build
// FAILED; a real error still ends FAILED with its message; the finish of a build runs once however many callers meet it.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/db';
import { advanceSandboxJobs } from '@/lib/engine/server';
import { enqueueProvisionSandbox, runProvisionStep } from '@/lib/sandbox/provision';
import { finishBackfill } from '@/lib/seed/after-history';
import { seedReferenceData } from '@/lib/seed/reference-db';
import { clearSandboxData } from '@/lib/seed/write';
import { cleanup, createAccount, createClassroom, uniq } from '../auth/fixtures';

const inject = vi.hoisted(() => ({ failures: [] as Error[] }));
vi.mock('@/lib/seed/sandbox', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/seed/sandbox')>();
  return {
    ...real,
    provisionSandbox: (...args: Parameters<typeof real.provisionSandbox>) => {
      const next = inject.failures.shift();
      return next ? Promise.reject(next) : real.provisionSandbox(...args);
    },
  };
});

const userIds: string[] = [];
const classroomIds: string[] = [];
const sandboxIds: string[] = [];
let cohortId: string;

async function queued(tag: string) {
  const { user } = await createAccount(prisma, { tag, role: 'USER', cohortId });
  await prisma.classroomMember.create({ data: { classroomId: cohortId, userId: user.id } });
  userIds.push(user.id);
  const sandboxId = (await enqueueProvisionSandbox(cohortId, user.id)).sandboxId as string;
  sandboxIds.push(sandboxId);
  return { userId: user.id, sandboxId };
}
const row = (id: string) => prisma.sandbox.findUniqueOrThrow({ where: { id } });
const uniqueViolation = () =>
  Object.assign(new Error('Unique constraint failed on the fields: (`id`)'), { code: 'P2002' });

beforeAll(async () => {
  process.env.SANDBOX_ENGINE_DAYS = '3';
  await seedReferenceData(prisma);
  const a = await createAccount(prisma, { tag: uniq('pt-admin'), role: 'SUPER_ADMIN' });
  userIds.push(a.user.id);
  const c = await createClassroom(prisma, { tag: 'pt', ownerAdminId: a.user.id });
  cohortId = c.id;
  classroomIds.push(cohortId);
  await prisma.classroom.update({
    where: { id: cohortId },
    data: { defaultSeedTemplate: 'starter-agency' },
  });
}, 300_000);

afterAll(async () => {
  for (const id of sandboxIds) {
    await prisma
      .$transaction((tx) => clearSandboxData(tx, id), { timeout: 120_000 })
      .catch(() => undefined);
    await prisma.userAccessGrant.deleteMany({ where: { sandboxId: id } });
  }
  await cleanup(prisma, { classroomIds, userIds });
  await prisma.$disconnect();
}, 300_000);

describe('transient errors in a step', () => {
  it('a unique violation or a dropped connection in the seed is retried and the build ends READY', async () => {
    const { sandboxId } = await queued('pt-t');
    inject.failures.push(uniqueViolation(), new Error('read ECONNRESET'));
    const v = await runProvisionStep(sandboxId, { budgetMs: 30_000 });
    expect(v.state).not.toBe('FAILED');
    for (let i = 0; i < 20 && (await row(sandboxId)).provisionState !== 'READY'; i++)
      await runProvisionStep(sandboxId, { budgetMs: 10_000 });
    const sb = await row(sandboxId);
    expect(sb.provisionState, sb.provisionError ?? '').toBe('READY');
    expect(sb.provisionError).toBeNull();
  }, 300_000);

  it('a transient error that never goes away ends FAILED with its message after a bounded number of tries', async () => {
    const { sandboxId } = await queued('pt-x');
    for (let i = 0; i < 10; i++) inject.failures.push(uniqueViolation());
    const v = await runProvisionStep(sandboxId, { budgetMs: 30_000 });
    expect(v).toMatchObject({ state: 'FAILED' });
    expect(v.error).toMatch(/Unique constraint/);
    expect(inject.failures.length).toBeGreaterThan(0); // not retried for ever
    inject.failures.length = 0;
  }, 300_000);

  it('a real error ends FAILED at once, with its message', async () => {
    const { sandboxId } = await queued('pt-r');
    inject.failures.push(new Error('seed exploded'));
    const v = await runProvisionStep(sandboxId, { budgetMs: 30_000 });
    expect(v).toMatchObject({ state: 'FAILED', error: 'seed exploded' });
    expect(inject.failures).toHaveLength(0);
  }, 300_000);
});

describe('the end of a build runs once', () => {
  it('many callers finishing the same BACKFILLING sandbox seed the reports and plans once and agree on READY', async () => {
    const quiet = await queued('pt-quiet');
    for (let i = 0; i < 40 && (await row(quiet.sandboxId)).provisionState !== 'READY'; i++)
      await runProvisionStep(quiet.sandboxId, { budgetMs: 10_000 });
    const expected = {
      reports: await prisma.report.count({ where: { sandboxId: quiet.sandboxId } }),
      plans: await prisma.plan.count({ where: { sandboxId: quiet.sandboxId } }),
      experiments: await prisma.experiment.count({ where: { sandboxId: quiet.sandboxId } }),
    };
    expect(expected.reports).toBeGreaterThan(0);

    const racer = await queued('pt-racer');
    await runProvisionStep(racer.sandboxId, { budgetMs: 1 }); // seeded, history job open, BACKFILLING
    expect((await row(racer.sandboxId)).provisionState).toBe('BACKFILLING');
    const today = new Date().toISOString().slice(0, 10);
    await Promise.all([
      ...Array.from({ length: 4 }, () => advanceSandboxJobs(racer.sandboxId, Date.now() + 60_000)),
      ...Array.from({ length: 4 }, () =>
        finishBackfill(prisma, racer.sandboxId, today).catch(() => false),
      ),
    ]);
    for (let i = 0; i < 20 && (await row(racer.sandboxId)).provisionState !== 'READY'; i++)
      await runProvisionStep(racer.sandboxId, { budgetMs: 10_000 });
    expect((await row(racer.sandboxId)).provisionState).toBe('READY');
    expect({
      reports: await prisma.report.count({ where: { sandboxId: racer.sandboxId } }),
      plans: await prisma.plan.count({ where: { sandboxId: racer.sandboxId } }),
      experiments: await prisma.experiment.count({ where: { sandboxId: racer.sandboxId } }),
    }).toEqual(expected);
    expect(await prisma.userAccessGrant.count({ where: { sandboxId: racer.sandboxId } })).toBe(1);
    expect(await prisma.simJob.count({ where: { sandboxId: racer.sandboxId } })).toBe(1);
  }, 300_000);
});
