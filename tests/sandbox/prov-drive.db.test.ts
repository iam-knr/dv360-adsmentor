// PROV-DRIVE: provisioning and the engine move without the GitHub Actions timer (docs/gaps/prov-drive.md). The rate
// limited "maybe advance", two callers that must not both run a step, and a build that reaches READY by repeated step
// calls alone (3 engine days here, as in provision.db.test.ts).
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/db';
import { GLOBAL_KEY, claimSlot, maybeAdvance } from '@/lib/sandbox/maybe-advance';
import {
  advanceProvisioning,
  enqueueProvisionSandbox,
  getProvisionView,
  runProvisionStep,
} from '@/lib/sandbox/provision';
import { seedReferenceData } from '@/lib/seed/reference-db';
import { clearSandboxData } from '@/lib/seed/write';
import { cleanup, createAccount, createClassroom, uniq } from '../auth/fixtures';

// records the owner of each seed run: a claimed step calls it once, a step that lost the claim not at all. Other test
// files may leave queued sandboxes that a global run also moves, so every count is per student.
const seeds = vi.hoisted(() => ({ owners: [] as (string | null | undefined)[] }));
const seedsFor = (userId: string) => seeds.owners.filter((o) => o === userId).length;
vi.mock('@/lib/seed/sandbox', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/seed/sandbox')>();
  return {
    ...real,
    provisionSandbox: (...args: Parameters<typeof real.provisionSandbox>) => {
      seeds.owners.push(args[1].ownerUserId);
      return real.provisionSandbox(...args);
    },
  };
});

const userIds: string[] = [];
const classroomIds: string[] = [];
const sandboxIds: string[] = [];
let classroomId: string;

async function queuedStudent(tag: string) {
  const { user } = await createAccount(prisma, { tag, role: 'USER', cohortId: classroomId });
  await prisma.classroomMember.create({ data: { classroomId, userId: user.id } });
  userIds.push(user.id);
  const sandboxId = (await enqueueProvisionSandbox(classroomId, user.id)).sandboxId as string;
  sandboxIds.push(sandboxId);
  return { userId: user.id, sandboxId };
}

beforeAll(async () => {
  process.env.SANDBOX_ENGINE_DAYS = '3';
  await seedReferenceData(prisma);
  const a = await createAccount(prisma, { tag: uniq('pd-admin'), role: 'SUPER_ADMIN' });
  userIds.push(a.user.id);
  classroomId = (await createClassroom(prisma, { tag: 'pd', ownerAdminId: a.user.id })).id;
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
  await prisma.appMeta.deleteMany({ where: { key: { startsWith: 'prov-drive:test' } } });
  await cleanup(prisma, { classroomIds, userIds });
  await prisma.$disconnect();
}, 300_000);

describe('claimSlot', () => {
  it('lets one of many concurrent callers take the slot', async () => {
    const key = `prov-drive:test:${uniq('race')}`;
    const wins = await Promise.all(Array.from({ length: 12 }, () => claimSlot(key, 60_000)));
    expect(wins.filter(Boolean)).toHaveLength(1);
  });

  it('refuses inside the interval and grants again after it', async () => {
    const key = `prov-drive:test:${uniq('rate')}`;
    const t = 1_000_000_000_000;
    expect(await claimSlot(key, 60_000, { now: t })).toBe(true);
    expect(await claimSlot(key, 60_000, { now: t + 59_999 })).toBe(false);
    expect(await claimSlot(key, 60_000, { now: t + 60_000 })).toBe(true);
    // a refused call does not move the clock: the interval counts from the last grant
    expect(await claimSlot(key, 60_000, { now: t + 90_000 })).toBe(false);
    expect(await claimSlot(key, 60_000, { now: t + 120_000 })).toBe(true);
  });
});

describe('maybeAdvance', () => {
  it('runs once for two simultaneous callers and starts a queued build exactly once', async () => {
    await prisma.appMeta.deleteMany({ where: { key: GLOBAL_KEY } });
    const { userId } = await queuedStudent('pd-race');
    const [a, b] = await Promise.all([
      maybeAdvance({ budgetMs: 60_000 }),
      maybeAdvance({ budgetMs: 60_000 }),
    ]);
    expect([a.global, b.global].filter(Boolean)).toHaveLength(1);
    expect(seedsFor(userId)).toBe(1);
    expect((await getProvisionView(userId)).state).not.toBe('QUEUED');
    // inside the interval nothing runs again
    const c = await maybeAdvance();
    expect(c.global).toBe(false);
  }, 300_000);

  it('does not run a build step twice when two steps meet on the same sandbox', async () => {
    const { userId, sandboxId } = await queuedStudent('pd-step');
    await Promise.all([
      runProvisionStep(sandboxId, { budgetMs: 1_500 }),
      runProvisionStep(sandboxId, { budgetMs: 1_500 }),
    ]);
    expect(seedsFor(userId)).toBe(1);
  }, 300_000);

  it('continues an abandoned BACKFILLING build', async () => {
    const { sandboxId } = await queuedStudent('pd-back');
    await runProvisionStep(sandboxId, { budgetMs: 1 }); // seeds, starts the history job, stops
    const stuck = await prisma.sandbox.findUniqueOrThrow({ where: { id: sandboxId } });
    expect(stuck.provisionState).toBe('BACKFILLING');
    // a live build (fresh heartbeat) is left alone
    expect((await advanceProvisioning(Date.now() + 60_000, { classroomId })).stepped).toBe(0);
    await prisma.$executeRaw`UPDATE "Sandbox" SET "updatedAt" = now() - interval '5 minutes' WHERE "id" = ${sandboxId}`;
    const r = await advanceProvisioning(Date.now() + 120_000, { classroomId });
    expect(r.stepped).toBeGreaterThan(0);
    expect(
      (await prisma.sandbox.findUniqueOrThrow({ where: { id: sandboxId } })).provisionState,
    ).toBe('READY');
  }, 300_000);
});

describe('lazy path', () => {
  it('moves existing builds but does not start students who have no sandbox', async () => {
    const { user } = await createAccount(prisma, {
      tag: 'pd-orphan',
      role: 'USER',
      cohortId: classroomId,
    });
    await prisma.classroomMember.create({ data: { classroomId, userId: user.id } });
    userIds.push(user.id);
    const r = await advanceProvisioning(Date.now() + 30_000, { classroomId, orphans: false });
    expect(r.started).toBe(0);
    expect(await prisma.sandbox.count({ where: { ownerUserId: user.id } })).toBe(0);
  }, 120_000);
});

describe('no timer', () => {
  it('a build reaches READY by repeated step calls alone', async () => {
    const { userId, sandboxId } = await queuedStudent('pd-ready');
    let calls = 0;
    let view = await getProvisionView(userId);
    while (view.state !== 'READY' && view.state !== 'FAILED' && calls < 200) {
      view = await runProvisionStep(sandboxId, { budgetMs: 1_500 });
      calls++;
    }
    expect(view.state).toBe('READY');
    expect(calls).toBeGreaterThan(1); // several short steps, not one big one
    expect((await prisma.sandbox.findUniqueOrThrow({ where: { id: sandboxId } })).resetCount).toBe(
      0,
    );
  }, 600_000);
});
