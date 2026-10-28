import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { prisma, withSandbox } from '@/lib/db';
import type { AppRole } from '@/lib/auth/types';
import { isWindowActive, type WindowLike } from './window-rules';

export interface ClassChoice {
  classroomId: string;
  joinedAt: Date;
  open: boolean;
}

/**
 * Which class a person works in when they belong to several (RC-061): the one with an open window (the most
 * recently joined if several), else the most recent membership. `preferred` wins when it is one of the choices.
 */
export function pickClassroom(choices: ClassChoice[], preferred?: string | null): string | null {
  if (choices.length === 0) return null;
  if (preferred && choices.some((c) => c.classroomId === preferred)) return preferred;
  const byRecent = [...choices].sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime());
  return (byRecent.find((c) => c.open) ?? byRecent[0])?.classroomId ?? null;
}

export interface ClassContext {
  classroomId: string | null;
  sandboxId?: string;
  partnerId?: string;
  timeZone?: string;
}

/**
 * Resolve class, sandbox and partner for a person. `override` is `?sim_class=`: only an Admin who teaches the
 * class or a Super admin may use it (the caller passes the role of the signed in person).
 */
export async function resolveClassContext(
  userId: string,
  now: Date,
  opts: { override?: string | null; actorId?: string; actorRole?: AppRole } = {},
  db: PrismaClient = prisma,
): Promise<ClassContext> {
  const [memberships, user] = await Promise.all([
    db.classroomMember.findMany({
      where: { userId, classroom: { archivedAt: null } },
      select: { classroomId: true, joinedAt: true },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: { cohortId: true, createdAt: true, cohort: { select: { archivedAt: true } } },
    }),
  ]);
  const choices = new Map<string, { classroomId: string; joinedAt: Date }>();
  for (const m of memberships) choices.set(m.classroomId, m);
  if (user?.cohortId && !user.cohort?.archivedAt && !choices.has(user.cohortId)) {
    choices.set(user.cohortId, { classroomId: user.cohortId, joinedAt: user.createdAt });
  }

  let override: string | null = null;
  if (opts.override && opts.actorId && opts.actorRole && opts.actorRole !== 'user') {
    const target = await db.classroom.findUnique({
      where: { id: opts.override },
      select: { id: true, ownerAdminId: true, archivedAt: true },
    });
    if (target && !target.archivedAt) {
      const teaches =
        opts.actorRole === 'super_admin' ||
        target.ownerAdminId === opts.actorId ||
        (await db.classroomMember.count({
          where: { classroomId: target.id, userId: opts.actorId, appRole: 'ADMIN' },
        })) > 0;
      if (teaches) {
        override = target.id;
        if (!choices.has(target.id))
          choices.set(target.id, { classroomId: target.id, joinedAt: new Date(0) });
      }
    }
  }

  const ids = [...choices.keys()];
  const windows = ids.length
    ? await db.accessWindow.findMany({
        where: {
          classroomId: { in: ids },
          status: { in: ['SCHEDULED', 'OPEN'] },
          closesAt: { gt: now },
        },
        select: { classroomId: true, status: true, opensAt: true, closesAt: true },
      })
    : [];
  const openIds = new Set(
    windows.filter((w) => isWindowActive(w as WindowLike, now)).map((w) => w.classroomId),
  );
  const classroomId = pickClassroom(
    [...choices.values()].map((c) => ({ ...c, open: openIds.has(c.classroomId) })),
    override,
  );
  if (!classroomId) return { classroomId: null };

  const [classroom, sandbox] = await Promise.all([
    db.classroom.findUnique({ where: { id: classroomId }, select: { timeZone: true } }),
    db.sandbox.findFirst({
      where: { classroomId, ownerUserId: userId, status: { not: 'ARCHIVED' } },
      select: { id: true },
    }),
  ]);
  const ctx: ClassContext = { classroomId, timeZone: classroom?.timeZone };
  if (sandbox) {
    ctx.sandboxId = sandbox.id;
    const partner = await withSandbox(
      sandbox.id,
      (tx) => tx.partner.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } }),
      {},
      db,
    );
    if (partner) ctx.partnerId = partner.id;
  }
  return ctx;
}

/** The person who runs a class, shown to students on the "class is closed" page. */
export async function getClassInstructor(
  classroomId: string,
  db: PrismaClient = prisma,
): Promise<{ name: string; email: string } | null> {
  const row = await db.classroom.findUnique({
    where: { id: classroomId },
    select: { ownerAdmin: { select: { name: true, email: true } } },
  });
  return row?.ownerAdmin ?? null;
}
