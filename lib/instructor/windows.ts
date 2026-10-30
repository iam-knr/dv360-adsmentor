import 'server-only';
import { randomUUID } from 'node:crypto';
import type { AccessWindow, Prisma } from '@prisma/client';
import { tickAccessWindows } from '@/lib/access/windows';
import type { Actor } from '@/lib/accounts/permissions';
import { prisma } from '@/lib/db';
import { writeInstructorAudit } from './audit';
import {
  localDateOf,
  localTimeOf,
  singleOccurrence,
  weeklyOccurrences,
  type Occurrence,
  type Weekday,
} from './recurrence';
import {
  InstructorError,
  OPEN_NOW_DEFAULT_HOURS,
  OPEN_NOW_MAX_HOURS,
  windowWarnings,
} from './rules';
import { loadClass, type Db } from './scope';

// Access windows (module 18 4.3). Rules that matter: only the window times decide whether a class is open, so a
// late tick never extends a class; an OPEN window cannot be edited or deleted (SIM-007), close the class first.

export interface WindowInput {
  classId: string;
  label: string;
  /** Local calendar date in the class time zone. */
  date: string;
  startTime: string;
  endTime: string;
  repeat?: { byDay: Weekday[]; until: string };
  note?: string;
}

export interface WindowRow {
  id: string;
  label: string;
  opensAt: Date;
  closesAt: Date;
  status: AccessWindow['status'];
  seriesId: string | null;
  note: string | null;
  closedBy: AccessWindow['closedBy'];
  /** Derived from the times, not the status column: a late tick does not make a window look open. */
  live: boolean;
}

const label = (raw: string) => {
  const t = raw.trim();
  if (!t) throw new InstructorError('SIM-004');
  if ([...t].length > 100) throw new InstructorError('SIM-004B');
  return t;
};

const noteOf = (raw: string | undefined) => {
  const t = raw?.trim();
  return t ? t.slice(0, 500) : null;
};

export async function listWindows(
  actor: Actor,
  classId: string,
  now: Date = new Date(),
  db: Db = prisma,
): Promise<{ timeZone: string; className: string; windows: WindowRow[] }> {
  const cls = await loadClass(db, actor, classId);
  const rows = await db.accessWindow.findMany({
    where: { classroomId: classId },
    orderBy: { opensAt: 'asc' },
    take: 300,
  });
  return {
    timeZone: cls.timeZone,
    className: cls.name,
    windows: rows.map((w) => ({
      id: w.id,
      label: w.label,
      opensAt: w.opensAt,
      closesAt: w.closesAt,
      status: w.status,
      seriesId: w.seriesId,
      note: w.note,
      closedBy: w.closedBy,
      live:
        (w.status === 'OPEN' || w.status === 'SCHEDULED') && w.opensAt <= now && w.closesAt > now,
    })),
  };
}

export async function createAccessWindow(
  actor: Actor,
  input: WindowInput,
  now: Date = new Date(),
  db: Db = prisma,
): Promise<{ ids: string[]; warnings: string[] }> {
  const cls = await loadClass(db, actor, input.classId);
  const name = label(input.label);
  const occurrences: Occurrence[] = input.repeat
    ? weeklyOccurrences(input.date, input.startTime, input.endTime, input.repeat, cls.timeZone)
    : [singleOccurrence(input.date, input.startTime, input.endTime, cls.timeZone)];
  const seriesId = input.repeat ? randomUUID() : null;
  const repeatRule: Prisma.InputJsonValue | undefined = input.repeat
    ? { freq: 'WEEKLY', byDay: input.repeat.byDay, until: input.repeat.until }
    : undefined;
  const warnings = windowWarnings(occurrences[0]!.opensAt, occurrences[0]!.closesAt);
  const ids = await db.$transaction(async (tx) => {
    const made: string[] = [];
    for (const o of occurrences) {
      const row = await tx.accessWindow.create({
        data: {
          classroomId: cls.id,
          label: name,
          opensAt: o.opensAt,
          closesAt: o.closesAt,
          status: o.opensAt <= now && o.closesAt > now ? 'OPEN' : 'SCHEDULED',
          seriesId,
          ...(repeatRule ? { repeatRule } : {}),
          note: noteOf(input.note),
          createdById: actor.id,
        },
        select: { id: true },
      });
      made.push(row.id);
    }
    await writeInstructorAudit(tx, {
      actorUserId: actor.id,
      actorRole: actor.role,
      classroomId: cls.id,
      action: 'WINDOW_CREATED',
      targetType: 'AccessWindow',
      targetId: made[0],
      payload: {
        label: name,
        count: made.length,
        opensAt: occurrences[0]!.opensAt,
        closesAt: occurrences[0]!.closesAt,
        seriesId,
      },
    });
    return made;
  });
  // A window that starts in the past or now opens the class at once; the tick also unfreezes the sandboxes.
  if (occurrences.some((o) => o.opensAt <= now && o.closesAt > now)) {
    await tickAccessWindows(now, db);
  }
  return { ids, warnings };
}

type Scope = 'THIS' | 'SERIES';

async function loadWindow(db: Db, actor: Actor, id: string) {
  const w = await db.accessWindow.findUnique({ where: { id } });
  if (!w) throw new InstructorError('SIM-020');
  const cls = await loadClass(db, actor, w.classroomId); // out of scope looks the same as missing
  return { w, cls };
}

const isLive = (w: Pick<AccessWindow, 'status' | 'opensAt' | 'closesAt'>, now: Date) =>
  (w.status === 'OPEN' || w.status === 'SCHEDULED') && w.opensAt <= now && w.closesAt > now;

export interface WindowPatch {
  label?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  note?: string;
}

/**
 * THIS changes one window (any field). SERIES changes the label, note and time of day of this window and every
 * later window of the series that has not started; the dates of the series are kept.
 */
export async function updateAccessWindow(
  actor: Actor,
  id: string,
  patch: WindowPatch,
  scope: Scope = 'THIS',
  now: Date = new Date(),
  db: Db = prisma,
): Promise<{ updated: number; warnings: string[] }> {
  const { w, cls } = await loadWindow(db, actor, id);
  if (isLive(w, now) || w.status === 'OPEN') throw new InstructorError('SIM-007');
  if (w.status !== 'SCHEDULED') throw new InstructorError('SIM-018');
  const name = patch.label === undefined ? undefined : label(patch.label);
  const note = patch.note === undefined ? undefined : noteOf(patch.note);

  const targets =
    scope === 'SERIES' && w.seriesId
      ? await db.accessWindow.findMany({
          where: {
            seriesId: w.seriesId,
            status: 'SCHEDULED',
            opensAt: { gte: w.opensAt },
          },
          orderBy: { opensAt: 'asc' },
        })
      : [w];
  let warnings: string[] = [];
  await db.$transaction(async (tx) => {
    for (const t of targets) {
      const date = scope === 'THIS' && patch.date ? patch.date : localDateOf(t.opensAt, cls.timeZone);
      const start = patch.startTime ?? localTimeOf(t.opensAt, cls.timeZone);
      const end = patch.endTime ?? localTimeOf(t.closesAt, cls.timeZone);
      const o = singleOccurrence(date, start, end, cls.timeZone);
      if (t.id === w.id) warnings = windowWarnings(o.opensAt, o.closesAt);
      await tx.accessWindow.update({
        where: { id: t.id },
        data: {
          opensAt: o.opensAt,
          closesAt: o.closesAt,
          ...(name === undefined ? {} : { label: name }),
          ...(note === undefined ? {} : { note }),
        },
      });
    }
    await writeInstructorAudit(tx, {
      actorUserId: actor.id,
      actorRole: actor.role,
      classroomId: cls.id,
      action: 'WINDOW_UPDATED',
      targetType: 'AccessWindow',
      targetId: w.id,
      payload: { scope, count: targets.length, seriesId: w.seriesId },
    });
  });
  return { updated: targets.length, warnings };
}

/**
 * Upcoming windows are cancelled (the row stays, status CANCELLED, so the audit trail keeps its target). An OPEN
 * window cannot be deleted: use closeClassNow (SIM-007).
 */
export async function deleteAccessWindow(
  actor: Actor,
  id: string,
  scope: Scope = 'THIS',
  now: Date = new Date(),
  db: Db = prisma,
): Promise<{ deleted: number }> {
  const { w, cls } = await loadWindow(db, actor, id);
  if (isLive(w, now) || w.status === 'OPEN') throw new InstructorError('SIM-007');
  if (w.status !== 'SCHEDULED') throw new InstructorError('SIM-018');
  const res = await db.$transaction(async (tx) => {
    const r = await tx.accessWindow.updateMany({
      where:
        scope === 'SERIES' && w.seriesId
          ? { seriesId: w.seriesId, status: 'SCHEDULED', opensAt: { gte: w.opensAt } }
          : { id: w.id, status: 'SCHEDULED' },
      data: { status: 'CANCELLED' },
    });
    await writeInstructorAudit(tx, {
      actorUserId: actor.id,
      actorRole: actor.role,
      classroomId: cls.id,
      action: 'WINDOW_DELETED',
      targetType: 'AccessWindow',
      targetId: w.id,
      payload: { scope, count: r.count, seriesId: w.seriesId, label: w.label },
    });
    return r;
  });
  return { deleted: res.count };
}

/** Opens the class now for `hours` (default 2, at most 8) with a window "Opened manually". */
export async function openClassNow(
  actor: Actor,
  classId: string,
  req: { hours?: number } = {},
  now: Date = new Date(),
  db: Db = prisma,
): Promise<{ windowId: string; closesAt: Date }> {
  const cls = await loadClass(db, actor, classId);
  const hours = Math.min(Math.max(req.hours ?? OPEN_NOW_DEFAULT_HOURS, 0.25), OPEN_NOW_MAX_HOURS);
  const closesAt = new Date(now.getTime() + hours * 3_600_000);
  const row = await db.$transaction(async (tx) => {
    const created = await tx.accessWindow.create({
      data: {
        classroomId: cls.id,
        label: 'Opened manually',
        opensAt: now,
        closesAt,
        status: 'OPEN',
        createdById: actor.id,
      },
      select: { id: true },
    });
    await writeInstructorAudit(tx, {
      actorUserId: actor.id,
      actorRole: actor.role,
      classroomId: cls.id,
      action: 'CLASS_OPENED',
      targetType: 'AccessWindow',
      targetId: created.id,
      payload: { closesAt, count: hours },
    });
    return created;
  });
  await tickAccessWindows(now, db); // unfreezes the sandboxes and restores the clock state
  return { windowId: row.id, closesAt };
}

/** Closes the class at once: every window that covers `now` ends now and the sandboxes freeze. */
export async function closeClassNow(
  actor: Actor,
  classId: string,
  now: Date = new Date(),
  db: Db = prisma,
): Promise<{ closed: number }> {
  const cls = await loadClass(db, actor, classId);
  const res = await db.$transaction(async (tx) => {
    const r = await tx.accessWindow.updateMany({
      where: {
        classroomId: cls.id,
        status: { in: ['OPEN', 'SCHEDULED'] },
        opensAt: { lte: now },
        closesAt: { gt: now },
      },
      data: { status: 'CLOSED', closesAt: now, closedBy: 'INSTRUCTOR' },
    });
    await writeInstructorAudit(tx, {
      actorUserId: actor.id,
      actorRole: actor.role,
      classroomId: cls.id,
      action: 'CLASS_CLOSED',
      targetType: 'Classroom',
      targetId: cls.id,
      payload: { count: r.count },
    });
    return r;
  });
  await tickAccessWindows(now, db);
  return { closed: res.count };
}
