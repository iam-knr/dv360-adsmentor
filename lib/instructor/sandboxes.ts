import 'server-only';
import type { Classroom } from '@prisma/client';
import type { Actor } from '@/lib/accounts/permissions';
import { scopedUsers } from '@/lib/accounts/scope';
import { prisma } from '@/lib/db';
import { enqueueProvisionSandbox, runProvisionStep } from '@/lib/sandbox/provision';
import { seedValueFor } from '@/lib/seed/sandbox';
import { writeInstructorAudit } from './audit';
import { confirmsClassName, InstructorError } from './rules';
import { loadClass, type Db } from './scope';

// Sandbox create and reset for the console (module 18 4.4, 4.5, M18-09). Both queue the provisioning job of
// `lib/sandbox/provision.ts` (seed plus engine history) and run its first step.

export const RESET_CONFIRM = 'RESET';
const CONCURRENCY = 3;
/** One reset step; a longer build goes on in the background (see buildSandbox). */
const RESET_STEP_BUDGET_MS = 15_000;

interface Student {
  id: string;
  name: string;
  studentCode: string | null;
  status: string;
}

async function studentsOf(
  db: Db,
  actor: Actor,
  classId: string,
  userIds?: string[],
): Promise<Student[]> {
  const rows: unknown = await scopedUsers(db, actor).findMany({
    where: {
      cohortId: classId,
      appRole: 'USER',
      status: { not: 'ARCHIVED' },
      ...(userIds ? { id: { in: userIds } } : {}),
    },
    select: { id: true, name: true, studentCode: true, status: true },
    orderBy: { name: 'asc' },
  });
  return rows as Student[];
}

/**
 * Build (or rebuild) one student's sandbox through the provisioning job (lib/sandbox/provision.ts, M18-05): the row is
 * queued (PENDING) and one step runs within `budgetMs`; a build that needs more time ends BUILDING and is finished by
 * the student's welcome page, the engine timer or the next step. The student is made STANDARD on the partner by the job.
 */
async function buildSandbox(
  db: Db,
  cls: Classroom,
  student: Student,
  opts: { force: boolean; newMarketSeed: boolean; budgetMs: number },
): Promise<{ sandboxId: string; built: boolean }> {
  const existing = await db.sandbox.findFirst({
    where: { classroomId: cls.id, ownerUserId: student.id },
    select: { id: true, provisionState: true, resetCount: true },
  });
  if (existing && opts.force) {
    const seedLabel = opts.newMarketSeed
      ? `${cls.id}:${student.id}:${existing.resetCount + 1}`
      : `${cls.id}:${student.id}`;
    // a reset: queue the rebuild; the job clears the old data when it claims the row
    await db.sandbox.update({
      where: { id: existing.id },
      data: {
        provisionState: 'PENDING',
        provisionError: null,
        seedValue: seedValueFor(seedLabel),
        resetCount: { increment: 1 },
        lastResetAt: new Date(),
      },
    });
  } else if (existing?.provisionState === 'FAILED') {
    await db.sandbox.update({
      where: { id: existing.id },
      data: { provisionState: 'PENDING', provisionError: null },
    });
  }
  const queued = existing
    ? { sandboxId: existing.id }
    : await enqueueProvisionSandbox(cls.id, student.id, db);
  if (!queued.sandboxId) throw new Error('The sandbox could not be created.');
  const view = await runProvisionStep(queued.sandboxId, { db, budgetMs: opts.budgetMs });
  if (view.state === 'FAILED') throw new Error(view.error ?? 'The sandbox could not be built.');
  // a rebuilt clock starts PAUSED, so a remembered pre-freeze state no longer applies
  if (existing && opts.force)
    await db.sandbox.update({
      where: { id: queued.sandboxId },
      data: { clockStateBeforeFreeze: null },
    });
  return { sandboxId: queued.sandboxId, built: view.state === 'READY' };
}

export interface SandboxOutcome {
  userId: string;
  name: string;
  ok: boolean;
  error?: string;
}

async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

const messageOf = (err: unknown) =>
  err instanceof Error ? err.message.slice(0, 200) : 'The sandbox could not be built.';

/** Roster action "Create sandbox" and "Retry" for a student whose sandbox is missing or FAILED. */
export async function createSandboxFor(
  actor: Actor,
  classId: string,
  userId: string,
  db: Db = prisma,
): Promise<SandboxOutcome> {
  const cls = await loadClass(db, actor, classId);
  const [student] = await studentsOf(db, actor, classId, [userId]);
  if (!student) throw new InstructorError('SIM-020');
  let outcome: SandboxOutcome;
  try {
    await buildSandbox(db, cls, student, { force: false, newMarketSeed: false, budgetMs: 25_000 });
    outcome = { userId, name: student.name, ok: true };
  } catch (err) {
    outcome = { userId, name: student.name, ok: false, error: messageOf(err) };
  }
  await writeInstructorAudit(db, {
    actorUserId: actor.id,
    actorRole: actor.role,
    classroomId: cls.id,
    action: 'SANDBOX_CREATED',
    targetType: 'Sandbox',
    targetUserId: userId,
    result: 'OK',
    payload: { reason: outcome.ok ? 'built' : 'failed' },
  });
  return outcome;
}

export interface ResetRequest {
  classId: string;
  scope: 'USER' | 'CLASS';
  /** USER scope: the students to reset (one or many). */
  userIds?: string[];
  /** `RESET` for USER scope; the class name for CLASS scope (SIM-009). */
  confirm?: string;
  /** Build the market from a new seed instead of the student's current one. */
  newMarketSeed?: boolean;
}

/**
 * Reset to the seed state. Student work is not recoverable (no snapshots in v1, see docs/gaps/p5-01.md). The
 * confirmation is checked here, not in the form: a forged request without it is refused (SIM-009).
 */
export async function resetSandboxes(
  actor: Actor,
  req: ResetRequest,
  db: Db = prisma,
): Promise<{ outcomes: SandboxOutcome[] }> {
  const cls = await loadClass(db, actor, req.classId);
  if (req.scope === 'CLASS') {
    if (!confirmsClassName(req.confirm, cls.name)) throw new InstructorError('SIM-009');
  } else {
    if (!req.userIds?.length) throw new InstructorError('SIM-021');
    if (req.confirm !== RESET_CONFIRM)
      throw new InstructorError('SIM-009', 'Type RESET to confirm.');
  }
  const students = await studentsOf(
    db,
    actor,
    cls.id,
    req.scope === 'USER' ? req.userIds : undefined,
  );
  if (req.scope === 'USER' && students.length === 0) throw new InstructorError('SIM-021');

  const outcomes = await pool(students, CONCURRENCY, async (s): Promise<SandboxOutcome> => {
    try {
      await buildSandbox(db, cls, s, {
        force: true,
        newMarketSeed: req.newMarketSeed === true,
        budgetMs: RESET_STEP_BUDGET_MS,
      });
      return { userId: s.id, name: s.name, ok: true };
    } catch (err) {
      return { userId: s.id, name: s.name, ok: false, error: messageOf(err) };
    }
  });

  await writeInstructorAudit(db, {
    actorUserId: actor.id,
    actorRole: actor.role,
    classroomId: cls.id,
    action: req.scope === 'CLASS' ? 'CLASS_RESET' : 'SANDBOX_RESET',
    targetType: req.scope === 'CLASS' ? 'Classroom' : 'Sandbox',
    targetId: cls.id,
    targetUserId: req.scope === 'USER' && students.length === 1 ? students[0]!.id : null,
    payload: {
      count: outcomes.filter((o) => o.ok).length,
      skipped: outcomes.filter((o) => !o.ok).length,
      scope: req.scope,
      newMarketSeed: req.newMarketSeed === true,
      cohortName: cls.name,
    },
  });
  return { outcomes };
}
