// PROV-RACE2 (docs/gaps/prov-race2.md): provisioning steps overlap by design (the after() step of enqueue, the welcome
// page POST, page-load maybeAdvance, the 5 minute timer, the Super admin account page). This builds many sandboxes at
// once, each driven by 3 to 5 simultaneous callers of every kind in a loop with small random delays, and demands that
// every build ends READY with the same rows as a build nobody overlapped, and that a FAILED one names its cause.
//
// Knobs (env): STRESS_STUDENTS (default 12), STRESS_SEED (default random, printed), SANDBOX_ENGINE_DAYS (default 3).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { isTransientError } from '@/lib/db/transient';
import { maybeAdvance } from '@/lib/sandbox/maybe-advance';
import {
  advanceProvisioning,
  enqueueProvisionSandbox,
  retryProvisionSandbox,
  runProvisionStep,
} from '@/lib/sandbox/provision';
import { seedReferenceData } from '@/lib/seed/reference-db';
import { clearSandboxData } from '@/lib/seed/write';
import { cleanup, createAccount, createClassroom, uniq } from '../auth/fixtures';

const STUDENTS = Number(process.env.STRESS_STUDENTS ?? 12);
const FIXED_SEED_VALUE = 424242;
const NOISY_TABLES = new Set([
  'SimDailyMetric',
  'SimHourlyMetric',
  'DeliveryDiagnostic',
  'SimPacingSnapshot',
  'SimReachSnapshot',
  'SimConversionDaily',
  'Alert',
  'ChangeEntry',
  'ChangeGroup',
  'InboxMessage',
]);
const userIds: string[] = [];
const classroomIds: string[] = [];
const sandboxIds: string[] = [];
let adminId: string;

/** mulberry32: a seeded generator so a failing interleaving can be asked for again with STRESS_SEED. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Student {
  userId: string;
  sandboxId: string;
  cohortId: string;
}

async function newStudent(tag: string, cohortId: string): Promise<Student> {
  const { user } = await createAccount(prisma, { tag, role: 'USER', cohortId });
  await prisma.classroomMember.create({ data: { classroomId: cohortId, userId: user.id } });
  userIds.push(user.id);
  const sandboxId = (await enqueueProvisionSandbox(cohortId, user.id)).sandboxId as string;
  sandboxIds.push(sandboxId);
  // the same world for everybody, so the rows of an overlapped build can be compared with a quiet one
  await prisma.sandbox.update({ where: { id: sandboxId }, data: { seedValue: FIXED_SEED_VALUE } });
  return { userId: user.id, sandboxId, cohortId };
}

const stateRow = (sandboxId: string) =>
  prisma.sandbox.findUniqueOrThrow({
    where: { id: sandboxId },
    select: { provisionState: true, provisionError: true },
  });

/** Every table with a sandboxId column and its row count for one sandbox. */
async function rowCounts(sandboxId: string): Promise<Record<string, number>> {
  const tables = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'sandboxId' AND table_name NOT IN ('Sandbox')
    ORDER BY table_name`;
  const out: Record<string, number> = {};
  for (const { table_name } of tables) {
    const r = await prisma.$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "${table_name}" WHERE "sandboxId" = $1`,
      sandboxId,
    );
    out[table_name] = r[0]?.n ?? 0;
  }
  return out;
}

beforeAll(async () => {
  process.env.SANDBOX_ENGINE_DAYS ||= '3';
  await seedReferenceData(prisma);
  const a = await createAccount(prisma, { tag: uniq('ps-admin'), role: 'SUPER_ADMIN' });
  userIds.push(a.user.id);
  adminId = a.user.id;
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
}, 600_000);

describe('stress: many sandboxes, overlapping callers', () => {
  it('every build ends READY with the rows of a quiet build, and a FAILED one names its cause', async () => {
    const seed = Number(process.env.STRESS_SEED ?? Math.floor(Math.random() * 1e9));
    console.log(
      `prov-stress seed ${seed} students ${STUDENTS} engineDays ${process.env.SANDBOX_ENGINE_DAYS}`,
    );
    const rand = rng(seed);

    const cohortIds: string[] = [];
    for (const tag of ['ps-a', 'ps-b']) {
      const id = (await createClassroom(prisma, { tag, ownerAdminId: adminId })).id;
      classroomIds.push(id);
      await prisma.classroom.update({
        where: { id },
        data: { defaultSeedTemplate: 'starter-agency' },
      });
      cohortIds.push(id);
    }

    // the quiet reference: one build, one caller
    const ref = await newStudent('ps-ref', cohortIds[0] as string);
    for (let i = 0; i < 60 && (await stateRow(ref.sandboxId)).provisionState !== 'READY'; i++)
      await runProvisionStep(ref.sandboxId, { budgetMs: 5_000 });
    expect((await stateRow(ref.sandboxId)).provisionState).toBe('READY');
    const reference = await rowCounts(ref.sandboxId);

    const students: Student[] = [];
    for (let i = 0; i < STUDENTS; i++)
      students.push(await newStudent(`ps-${i}`, cohortIds[i % 2] as string));

    const failures: string[] = [];
    const note = (s: Student, what: string, state: string, error?: string | null) => {
      if (state === 'FAILED')
        failures.push(`${s.sandboxId} ${what}: FAILED provisionError=${error ?? '(none kept)'}`);
    };
    const stop = { value: false };
    const deadline = Date.now() + 480_000;

    // one caller: a loop of random step kinds with small random delays, until the build is READY or FAILED
    const caller = async (s: Student, id: number) => {
      await sleep(Math.floor(rand() * 60));
      while (!stop.value && Date.now() < deadline) {
        const row = await stateRow(s.sandboxId);
        if (row.provisionState === 'READY' || row.provisionState === 'FAILED') {
          note(s, `caller ${id} saw`, row.provisionState, row.provisionError);
          return;
        }
        const kind = Math.floor(rand() * 5);
        const budgetMs = 300 + Math.floor(rand() * 3_000);
        try {
          if (kind === 0 || kind === 1) {
            // the welcome page / account page step (same function), and the after() step of enqueue
            const v = await runProvisionStep(s.sandboxId, { budgetMs });
            note(s, 'runProvisionStep', v.state, v.error);
          } else if (kind === 2) {
            // the 5 minute timer
            await advanceProvisioning(Date.now() + budgetMs + 6_000, {
              limit: 3,
              classroomId: s.cohortId,
              orphans: rand() < 0.5,
            });
          } else if (kind === 3) {
            // page-load maybe-advance (slot interval 0: every caller is a winner)
            await maybeAdvance({
              sandboxId: s.sandboxId,
              classroomId: s.cohortId,
              globalIntervalMs: 0,
              budgetMs: budgetMs + 6_000,
            });
          } else {
            // the student pressing "Try again" while a build runs (restarts only FAILED / abandoned builds)
            const v = await retryProvisionSandbox(s.cohortId, s.userId, { budgetMs });
            note(s, 'retryProvisionSandbox', v.state, v.error);
          }
        } catch (err) {
          // a call that cannot get a connection (~48 callers share a pool of 9 here) is a 500 that the page driver retries;
          // the build itself must still end READY, which is asserted below
          if (isTransientError(err)) {
            await sleep(100);
            continue;
          }
          failures.push(
            `${s.sandboxId} caller ${id} threw: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        await sleep(Math.floor(rand() * 40));
      }
    };

    const all: Promise<void>[] = [];
    for (const s of students) {
      const callers = 3 + Math.floor(rand() * 3); // 3 to 5
      for (let c = 0; c < callers; c++) all.push(caller(s, c));
    }
    await Promise.all(all);
    stop.value = true;

    const problems: string[] = [...failures];
    for (const s of students) {
      const row = await stateRow(s.sandboxId);
      if (row.provisionState !== 'READY') {
        problems.push(
          `${s.sandboxId}: ${row.provisionState} provisionError=${row.provisionError ?? '(none)'}`,
        );
        continue;
      }
      const grants = await prisma.userAccessGrant.count({
        where: { userId: s.userId, sandboxId: s.sandboxId },
      });
      if (grants !== 1) problems.push(`${s.sandboxId}: ${grants} access grants`);
      const clocks = await prisma.simClock.findMany({ where: { sandboxId: s.sandboxId } });
      if (clocks.length !== 1) problems.push(`${s.sandboxId}: ${clocks.length} clocks`);
      else if (Number(clocks[0]?.tickIndex) !== 90 * 24)
        problems.push(`${s.sandboxId}: clock at tick ${clocks[0]?.tickIndex}, not ${90 * 24}`);
      else if (clocks[0]?.state !== 'RUNNING')
        problems.push(`${s.sandboxId}: clock ${clocks[0]?.state}, not RUNNING`);
      const histories = await prisma.simJob.findMany({
        where: { sandboxId: s.sandboxId },
        select: { kind: true, status: true },
      });
      if (histories.length !== 1 || histories[0]?.status !== 'DONE')
        problems.push(`${s.sandboxId}: history jobs ${JSON.stringify(histories)}`);
      const counts = await rowCounts(s.sandboxId);
      for (const [table, n] of Object.entries(reference)) {
        // metric rows depend on the sandbox's own random streams (they differ a little between sandboxes of one seed
        // value), a repeated history job or seed doubles them; entity rows must match exactly
        const got = counts[table] ?? 0;
        const ok = NOISY_TABLES.has(table) ? Math.abs(got - n) <= Math.max(3, n * 0.03) : got === n;
        if (!ok)
          problems.push(
            `${s.sandboxId}: ${table} has ${counts[table]} rows, a quiet build has ${n}`,
          );
      }
      const sb = await prisma.sandbox.findUniqueOrThrow({ where: { id: s.sandboxId } });
      if (sb.resetCount !== 0) problems.push(`${s.sandboxId}: resetCount ${sb.resetCount}`);
    }
    // the message carries every provisionError and the seed that reproduces the interleaving
    expect(problems, `seed ${seed}\n${problems.join('\n')}`).toEqual([]);
  }, 900_000);
});
