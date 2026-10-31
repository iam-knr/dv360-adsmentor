import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getSandboxSpeed, isAdminPaused } from './clock-run';

export interface SandboxClockView {
  sandboxId: string;
  state: 'RUNNING' | 'PAUSED' | 'STEPPING' | 'LOCKED';
  minutesPerSimDay: number;
  /** Sim days per real day, as the header chip shows it. */
  speedX: number;
  /** Paused by a Super admin: nothing resumes it automatically. */
  pausedByAdmin: boolean;
  /** Simulated time now. */
  simNow: string;
}

/** Clock of a student's current sandbox for the Super admin's account page; null when there is no clock yet. */
export async function getSandboxClockView(
  userId: string,
  db: PrismaClient = prisma,
): Promise<SandboxClockView | null> {
  const sb = await db.sandbox.findFirst({
    where: { ownerUserId: userId, kind: 'STUDENT', status: { not: 'ARCHIVED' } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, clock: true },
  });
  if (!sb?.clock) return null;
  const c = sb.clock;
  return {
    sandboxId: sb.id,
    state: c.state,
    minutesPerSimDay: c.minutesPerSimDay,
    speedX: Math.round((1440 / Math.max(1, c.minutesPerSimDay)) * 10) / 10,
    pausedByAdmin: await isAdminPaused(db, sb.id),
    simNow: new Date(c.simStart.getTime() + Number(c.tickIndex) * 3_600_000).toISOString(),
  };
}

export { getSandboxSpeed };

/** Counts of sandbox clocks for /manage/engine (ready sandboxes of live students). */
export async function countClocks(db: PrismaClient = prisma) {
  const rows = await db.simClock.groupBy({
    by: ['state'],
    where: { sandbox: { kind: 'STUDENT', status: { not: 'ARCHIVED' }, provisionState: 'READY' } },
    _count: { _all: true },
  });
  const out = { running: 0, paused: 0, other: 0, adminPaused: 0 };
  for (const r of rows) {
    if (r.state === 'RUNNING') out.running += r._count._all;
    else if (r.state === 'PAUSED') out.paused += r._count._all;
    else out.other += r._count._all;
  }
  out.adminPaused = await db.appMeta.count({ where: { key: { startsWith: 'sandbox-clock:admin-paused:' } } });
  return out;
}
