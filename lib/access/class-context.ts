import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { prisma, withSandbox } from '@/lib/db';

export interface ClassContext {
  /** The cohort the sandbox hangs on (a grouping; every student has one, see `ensureDefaultCohort`). */
  classroomId: string | null;
  sandboxId?: string;
  partnerId?: string;
  timeZone?: string;
}

/**
 * Resolve cohort, sandbox and partner for a person. There are no class windows (ADM-FIX): a student always has access,
 * and the sandbox is found by its owner, so moving a student to another cohort does not lose it.
 */
export async function resolveClassContext(
  userId: string,
  db: PrismaClient = prisma,
): Promise<ClassContext> {
  const [sandbox, user] = await Promise.all([
    db.sandbox.findFirst({
      where: {
        ownerUserId: userId,
        kind: 'STUDENT',
        status: { not: 'ARCHIVED' },
        // a sandbox that is still being built is not open to the student yet; /sim/welcome shows the progress
        provisionState: 'READY',
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, classroomId: true, classroom: { select: { timeZone: true } } },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: { cohortId: true, cohort: { select: { timeZone: true } } },
    }),
  ]);
  if (!sandbox) {
    return user?.cohortId
      ? { classroomId: user.cohortId, timeZone: user.cohort?.timeZone }
      : { classroomId: null };
  }
  const ctx: ClassContext = {
    classroomId: sandbox.classroomId,
    sandboxId: sandbox.id,
    timeZone: sandbox.classroom.timeZone,
  };
  const partner = await withSandbox(
    sandbox.id,
    (tx) => tx.partner.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } }),
    {},
    db,
  );
  if (partner) ctx.partnerId = partner.id;
  return ctx;
}
