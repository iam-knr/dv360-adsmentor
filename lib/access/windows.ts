import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { SIM_010 } from '@/lib/auth/messages';
import { prisma } from '@/lib/db';
import type { SessionUser } from '@/lib/auth/types';
import { openUntil, warningBanner } from './window-rules';

export {
  WINDOW_WARNING_MINUTES,
  isWindowActive,
  openUntil,
  statusAt,
  warningBanner,
} from './window-rules';

type Db = PrismaClient;

export interface ClassAccessState {
  open: boolean;
  /** When the class stops being open (end of the chain of windows), if open. */
  closesAt: Date | null;
  /** The next window that has not started yet. */
  nextWindow: { id: string; label: string; opensAt: Date; closesAt: Date } | null;
  timeZone: string;
}

const LIVE = ['SCHEDULED', 'OPEN'] as const;

export async function getClassAccessState(
  classroomId: string,
  now: Date = new Date(),
  db: Db = prisma,
): Promise<ClassAccessState> {
  const classroom = await db.classroom.findUnique({
    where: { id: classroomId },
    select: { timeZone: true },
  });
  const windows = await db.accessWindow.findMany({
    where: { classroomId, status: { in: [...LIVE] }, closesAt: { gt: now } },
    orderBy: { opensAt: 'asc' },
    select: { id: true, label: true, status: true, opensAt: true, closesAt: true },
    take: 200,
  });
  const closesAt = openUntil(windows, now);
  const next = windows.find((w) => w.opensAt > now) ?? null;
  return {
    open: closesAt !== null,
    closesAt,
    nextWindow: next && {
      id: next.id,
      label: next.label,
      opensAt: next.opensAt,
      closesAt: next.closesAt,
    },
    timeZone: classroom?.timeZone ?? 'Asia/Kolkata',
  };
}

/** True while some window of the class covers `now`. */
export async function isClassOpen(
  classroomId: string,
  now: Date = new Date(),
  db: Db = prisma,
): Promise<boolean> {
  const hit = await db.accessWindow.findFirst({
    where: {
      classroomId,
      status: { in: [...LIVE] },
      opensAt: { lte: now },
      closesAt: { gt: now },
    },
    select: { id: true },
  });
  return hit !== null;
}

/** People above the User level skip the class window; so does an admin acting through view-as. */
export function bypassesWindow(user: Pick<SessionUser, 'appRole' | 'actor'>): boolean {
  return (user.actor?.appRole ?? user.appRole) !== 'user';
}

export async function getWindowBanner(
  user: SessionUser,
  now: Date = new Date(),
  db: Db = prisma,
): Promise<string | null> {
  if (bypassesWindow(user) || !user.classroomId) return null;
  const state = await getClassAccessState(user.classroomId, now, db);
  return warningBanner(state.closesAt, now, state.timeZone);
}

export class AccessWindowClosedError extends Error {
  readonly code = 'ACCESS_WINDOW_CLOSED';
  constructor() {
    super(SIM_010);
    this.name = 'AccessWindowClosedError';
  }
}

export interface WindowClosed {
  code: 'ACCESS_WINDOW_CLOSED';
  message: string;
}

/** Non-throwing form for server actions that return a `Result`. Null means the write may go ahead. */
export async function checkWindowOpen(
  user: Pick<SessionUser, 'appRole' | 'actor' | 'classroomId'>,
  now: Date = new Date(),
  db: Db = prisma,
): Promise<WindowClosed | null> {
  if (bypassesWindow(user)) return null;
  if (user.classroomId && (await isClassOpen(user.classroomId, now, db))) return null;
  return { code: 'ACCESS_WINDOW_CLOSED', message: SIM_010 };
}

/** Every server action that writes calls this first (routes.md 7.4): a tab left open must stop writing at close. */
export async function assertWindowOpen(
  user: Pick<SessionUser, 'appRole' | 'actor' | 'classroomId'>,
  now: Date = new Date(),
  db: Db = prisma,
): Promise<void> {
  if (await checkWindowOpen(user, now, db)) throw new AccessWindowClosedError();
}

export interface TickResult {
  opened: number;
  closed: number;
  frozen: number;
  unfrozen: number;
}

/**
 * Move window statuses with the clock and freeze or unfreeze student sandboxes (module 18 4.3 rules 1, 4, 5).
 * Idempotent: running it twice changes nothing the second time. Sim time never advances here: `tickIndex` is
 * untouched, and on unfreeze `lastAdvanceRealAt` moves to `now`, so the closed hours are not owed to the clock.
 * A sandbox frozen for another reason (`ACCOUNT`) is never unfrozen by a window.
 */
export async function tickAccessWindows(
  now: Date = new Date(),
  db: Db = prisma,
): Promise<TickResult> {
  const opened = await db.accessWindow.updateMany({
    where: { status: 'SCHEDULED', opensAt: { lte: now }, closesAt: { gt: now } },
    data: { status: 'OPEN' },
  });
  const closed = await db.accessWindow.updateMany({
    where: { status: { in: [...LIVE] }, closesAt: { lte: now } },
    data: { status: 'CLOSED', closedBy: 'SCHEDULE' },
  });

  // Which classrooms are open right now?
  const classes = await db.sandbox.findMany({
    where: {
      kind: 'STUDENT',
      status: { in: ['ACTIVE', 'FROZEN'] },
      classroom: { archivedAt: null },
    },
    select: { classroomId: true },
    distinct: ['classroomId'],
  });
  const ids = classes.map((c) => c.classroomId);
  const activeRows = ids.length
    ? await db.accessWindow.findMany({
        where: {
          classroomId: { in: ids },
          status: { in: [...LIVE] },
          opensAt: { lte: now },
          closesAt: { gt: now },
        },
        select: { classroomId: true },
        distinct: ['classroomId'],
      })
    : [];
  const openIds = new Set(activeRows.map((r) => r.classroomId));
  const closedIds = ids.filter((id) => !openIds.has(id));

  let frozen = 0;
  let unfrozen = 0;

  if (closedIds.length) {
    const toFreeze = await db.sandbox.findMany({
      where: { kind: 'STUDENT', status: 'ACTIVE', classroomId: { in: closedIds } },
      select: { id: true, clock: { select: { state: true, runOutsideSession: true } } },
    });
    for (const sb of toFreeze) {
      await db.$transaction(async (tx) => {
        const res = await tx.sandbox.updateMany({
          where: { id: sb.id, status: 'ACTIVE' },
          data: {
            status: 'FROZEN',
            frozenAt: now,
            frozenReason: 'WINDOW',
            clockStateBeforeFreeze: sb.clock?.state ?? null,
          },
        });
        if (res.count && sb.clock && !sb.clock.runOutsideSession) {
          await tx.simClock.update({ where: { sandboxId: sb.id }, data: { state: 'PAUSED' } });
        }
        frozen += res.count;
      });
    }
  }

  if (openIds.size) {
    const toThaw = await db.sandbox.findMany({
      where: {
        kind: 'STUDENT',
        status: 'FROZEN',
        frozenReason: 'WINDOW',
        classroomId: { in: [...openIds] },
      },
      select: {
        id: true,
        clockStateBeforeFreeze: true,
        clock: { select: { runOutsideSession: true } },
      },
    });
    for (const sb of toThaw) {
      await db.$transaction(async (tx) => {
        const res = await tx.sandbox.updateMany({
          where: { id: sb.id, status: 'FROZEN', frozenReason: 'WINDOW' },
          data: {
            status: 'ACTIVE',
            frozenAt: null,
            frozenReason: null,
            clockStateBeforeFreeze: null,
          },
        });
        if (res.count && sb.clock) {
          await tx.simClock.update({
            where: { sandboxId: sb.id },
            data: {
              ...(sb.clock.runOutsideSession
                ? {}
                : { state: sb.clockStateBeforeFreeze ?? 'PAUSED' }),
              // paused real time is not owed to the clock (engine.md 1.2)
              lastAdvanceRealAt: now,
              remainderMs: 0,
            },
          });
        }
        unfrozen += res.count;
      });
    }
  }

  return { opened: opened.count, closed: closed.count, frozen, unfrozen };
}
