// FIX-PROV-FLAKE (docs/gaps/fix-prov-flake.md): provisioning steps that overlap must not fail the build, and one
// student's build must not wait for anybody else's. Root cause of the flake: `ensureStudentGrant` checked and then
// created, two overlapping steps (the `after()` step of enqueue and the welcome page's POST) both created the grant, the
// loser hit the unique index and its catch marked the whole sandbox FAILED, which the welcome page treats as final.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import {
  advanceProvisioning,
  enqueueProvisionSandbox,
  runProvisionStep,
} from '@/lib/sandbox/provision';
import { seedReferenceData } from '@/lib/seed/reference-db';
import { clearSandboxData } from '@/lib/seed/write';
import { cleanup, createAccount, createClassroom, uniq } from '../auth/fixtures';

const userIds: string[] = [];
const classroomIds: string[] = [];
const sandboxIds: string[] = [];
let adminId: string;

async function newCohort(tag: string) {
  const id = (await createClassroom(prisma, { tag, ownerAdminId: adminId })).id;
  classroomIds.push(id);
  await prisma.classroom.update({ where: { id }, data: { defaultSeedTemplate: 'starter-agency' } });
  return id;
}

async function queuedStudent(tag: string, cohortId: string) {
  const { user } = await createAccount(prisma, { tag, role: 'USER', cohortId });
  await prisma.classroomMember.create({ data: { classroomId: cohortId, userId: user.id } });
  userIds.push(user.id);
  const sandboxId = (await enqueueProvisionSandbox(cohortId, user.id)).sandboxId as string;
  sandboxIds.push(sandboxId);
  return { userId: user.id, sandboxId };
}

const stateOf = async (sandboxId: string) =>
  prisma.sandbox.findUniqueOrThrow({ where: { id: sandboxId } });

beforeAll(async () => {
  process.env.SANDBOX_ENGINE_DAYS = '3';
  await seedReferenceData(prisma);
  const a = await createAccount(prisma, { tag: uniq('pc-admin'), role: 'SUPER_ADMIN' });
  userIds.push(a.user.id);
  adminId = a.user.id;
}, 300_000);

afterAll(async () => {
  for (const id of sandboxIds) {
    await prisma.$transaction((tx) => clearSandboxData(tx, id), { timeout: 120_000 });
    await prisma.userAccessGrant.deleteMany({ where: { sandboxId: id } });
  }
  await cleanup(prisma, { classroomIds, userIds });
  await prisma.$disconnect();
}, 300_000);

describe('overlapping steps on one sandbox', () => {
  it('never fail the build over the student grant, whoever creates it first', async () => {
    const cohort = await newCohort('pc-grant');
    const { userId, sandboxId } = await queuedStudent('pc-grant', cohort);
    await runProvisionStep(sandboxId, { budgetMs: 1 }); // seeds, starts the history, stops: BACKFILLING
    expect((await stateOf(sandboxId)).provisionState).toBe('BACKFILLING');
    // the moment the flake needs: nobody has the grant yet and several steps look for it at once. The window is a few
    // milliseconds wide, so open it again a few times (all of them failed before the fix, most single rounds do)
    for (let round = 0; round < 4; round++) {
      await prisma.userAccessGrant.deleteMany({ where: { userId, sandboxId } });
      const views = await Promise.all(
        Array.from({ length: 10 }, () => runProvisionStep(sandboxId, { budgetMs: 800 })),
      );
      expect(views.map((v) => v.state)).not.toContain('FAILED');
      const row = await stateOf(sandboxId);
      expect(row.provisionError).toBeNull();
      // a build that is still running has put the grant back exactly once; a READY one no longer looks
      if (row.provisionState !== 'READY')
        expect(await prisma.userAccessGrant.count({ where: { userId, sandboxId } })).toBe(1);
    }
  }, 300_000);

  it('a sandbox driven by three callers at once reaches READY with one history, no FAILED on the way', async () => {
    const cohort = await newCohort('pc-three');
    const { userId, sandboxId } = await queuedStudent('pc-three', cohort);
    const seen = new Set<string>();
    for (let round = 0; round < 60 && !seen.has('READY'); round++) {
      const views = await Promise.all(
        [0, 1, 2].map(() => runProvisionStep(sandboxId, { budgetMs: 2_000 })),
      );
      for (const v of views) seen.add(v.state);
      expect(seen.has('FAILED')).toBe(false);
    }
    expect(seen.has('READY')).toBe(true);
    const clock = await prisma.simClock.findUniqueOrThrow({ where: { sandboxId } });
    expect(Number(clock.tickIndex)).toBe(90 * 24); // a second history job would have run past today
    expect(await prisma.simJob.count({ where: { sandboxId, kind: 'FAST_FORWARD' } })).toBe(1);
    expect(await prisma.userAccessGrant.count({ where: { userId, sandboxId } })).toBe(1);
  }, 600_000);
});

describe('one build does not wait for the others', () => {
  it('a new student reaches READY by their own steps while older queued builds are untouched', async () => {
    const decoyCohort = await newCohort('pc-decoy');
    const decoys = [];
    for (const tag of ['pc-d1', 'pc-d2', 'pc-d3'])
      decoys.push(await queuedStudent(tag, decoyCohort));
    const cohort = await newCohort('pc-new');
    const { sandboxId } = await queuedStudent('pc-new', cohort);
    const started = Date.now();
    let state = '';
    for (let i = 0; i < 60 && state !== 'READY' && state !== 'FAILED'; i++)
      state = (await runProvisionStep(sandboxId, { budgetMs: 2_000 })).state;
    expect(state).toBe('READY');
    expect(Date.now() - started).toBeLessThan(120_000);
    // the decoys were not needed, and not started by this
    for (const d of decoys) expect((await stateOf(d.sandboxId)).provisionState).toBe('PENDING');
  }, 300_000);

  it('the global run, which is first come first served, moves a new cohort too once the older builds are done', async () => {
    // N builds at once, all of them must finish: no build is skipped for good by the 2 per run limit
    const cohort = await newCohort('pc-many');
    const mine = [];
    for (const tag of ['pc-m1', 'pc-m2', 'pc-m3', 'pc-m4'])
      mine.push(await queuedStudent(tag, cohort));
    for (let run = 0; run < 40; run++) {
      await advanceProvisioning(Date.now() + 20_000, {
        classroomId: cohort,
        limit: 2,
        orphans: false,
      });
      const states = await Promise.all(
        mine.map(async (m) => (await stateOf(m.sandboxId)).provisionState),
      );
      expect(states).not.toContain('FAILED');
      if (states.every((s) => s === 'READY')) return;
      // a step that ended on its budget has a fresh heartbeat; let the "abandoned" window pass as it would
      await prisma.$executeRaw`UPDATE "Sandbox" SET "updatedAt" = now() - interval '1 minute' WHERE "classroomId" = ${cohort} AND "provisionState" IN ('BACKFILLING','SEEDING')`;
    }
    throw new Error('not every build reached READY');
  }, 900_000);
});
