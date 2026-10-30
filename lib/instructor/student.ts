import 'server-only';
import type { Actor } from '@/lib/accounts/permissions';
import { scopedUsers } from '@/lib/accounts/scope';
import { prisma } from '@/lib/db';
import { InstructorError } from './rules';
import { sandboxLabel, type SandboxLabel } from './roster';
import { loadClass, type Db } from './scope';

// Student detail (module 18 I6): the sandbox, the seed, the last changes. Notes and attempts need tables that do not
// exist yet (see docs/gaps/p5-01.md).
export interface StudentDetail {
  className: string;
  student: { id: string; name: string; email: string; status: string; lastLoginAt: Date | null };
  sandbox: {
    label: SandboxLabel;
    template: string;
    resetCount: number;
    lastResetAt: Date | null;
    error: string | null;
    simNow: Date | null;
    clockState: string | null;
  } | null;
  viewAsHref: string | null;
  changes: { id: string; occurredAt: Date; source: string; summary: string; entityName: string | null }[];
}

export async function getStudentDetail(
  actor: Actor,
  classId: string,
  userId: string,
  db: Db = prisma,
): Promise<StudentDetail> {
  const cls = await loadClass(db, actor, classId);
  const [student] = (await scopedUsers(db, actor).findMany({
    where: { id: userId, cohortId: cls.id, appRole: 'USER' },
    select: { id: true, name: true, email: true, status: true, lastLoginAt: true },
  })) as StudentDetail['student'][];
  if (!student) throw new InstructorError('SIM-020');
  const sb = await db.sandbox.findFirst({
    where: { classroomId: cls.id, ownerUserId: userId },
    include: { clock: { select: { state: true, simStart: true, tickIndex: true } } },
  });
  const partner = sb
    ? await db.partner.findFirst({ where: { sandboxId: sb.id }, select: { publicId: true } })
    : null;
  const changes = sb
    ? await db.changeGroup.findMany({
        where: { sandboxId: sb.id, isHidden: false },
        orderBy: { occurredAt: 'desc' },
        take: 50,
        select: { id: true, occurredAt: true, source: true, summary: true, entityName: true },
      })
    : [];
  return {
    className: cls.name,
    student,
    sandbox: sb
      ? {
          label: sandboxLabel(sb),
          template: sb.seedTemplateKey,
          resetCount: sb.resetCount,
          lastResetAt: sb.lastResetAt,
          error: sb.provisionError,
          simNow: sb.clock
            ? new Date(sb.clock.simStart.getTime() + Number(sb.clock.tickIndex) * 3_600_000)
            : null,
          clockState: sb.clock?.state ?? null,
        }
      : null,
    viewAsHref: partner ? `/p/${partner.publicId.toString()}/home_v3?sim_as=${userId}` : null,
    changes,
  };
}

/** Rows for the sandboxes page: every active student with the sandbox state and reset count. */
export async function getSandboxRows(actor: Actor, classId: string, db: Db = prisma) {
  const cls = await loadClass(db, actor, classId);
  const students = (await scopedUsers(db, actor).findMany({
    where: { cohortId: cls.id, appRole: 'USER', status: { not: 'ARCHIVED' } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })) as { id: string; name: string }[];
  const sandboxes = await db.sandbox.findMany({
    where: { classroomId: cls.id, ownerUserId: { in: students.map((s) => s.id) } },
    select: { ownerUserId: true, status: true, provisionState: true, resetCount: true, lastResetAt: true },
  });
  const by = new Map(sandboxes.map((s) => [s.ownerUserId, s]));
  return {
    className: cls.name,
    items: students.map((s) => {
      const sb = by.get(s.id);
      return {
        userId: s.id,
        name: s.name,
        sandbox: sandboxLabel(sb),
        resetCount: sb?.resetCount ?? 0,
        lastResetAt: sb?.lastResetAt ? sb.lastResetAt.toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : '',
      };
    }),
  };
}
