import 'server-only';
import type { Actor } from '@/lib/accounts/permissions';
import { scopedUsers } from '@/lib/accounts/scope';
import { getClassAccessState, type ClassAccessState } from '@/lib/access/windows';
import { prisma } from '@/lib/db';
import { loadClass, myClasses, type Db } from './scope';

// Instructor dashboard (module 18 I1). Read only. The clock card shows state; the controls are the clock page (P5-03).
const HOUR_MS = 3_600_000;
const ONLINE_MS = 5 * 60_000;

export interface DashboardData {
  classes: { id: string; name: string }[];
  selected: { id: string; name: string; timeZone: string } | null;
  access: ClassAccessState | null;
  students: { active: number; online: number };
  sandboxes: { total: number; ready: number; frozen: number; failed: number; notCreated: number };
  clock: { states: Record<string, number>; simNow: Date | null };
  alerts: string[];
  recent: { id: string; occurredAt: Date; source: string; summary: string; entityName: string | null }[];
  studentEdits24h: number;
}

export async function getDashboard(
  actor: Actor,
  classId: string | undefined,
  now: Date = new Date(),
  db: Db = prisma,
): Promise<DashboardData> {
  const classes = await myClasses(db, actor);
  const list = classes.map((c) => ({ id: c.id, name: c.name }));
  const pick = classes.find((c) => c.id === classId) ?? classes[0];
  const empty: DashboardData = {
    classes: list,
    selected: null,
    access: null,
    students: { active: 0, online: 0 },
    sandboxes: { total: 0, ready: 0, frozen: 0, failed: 0, notCreated: 0 },
    clock: { states: {}, simNow: null },
    alerts: [],
    recent: [],
    studentEdits24h: 0,
  };
  if (!pick) return empty;
  const cls = await loadClass(db, actor, pick.id);

  const users = scopedUsers(db, actor);
  const [active, online, sandboxes, access] = await Promise.all([
    users.count({ cohortId: cls.id, appRole: 'USER', status: 'ACTIVE' }),
    users.count({
      cohortId: cls.id,
      appRole: 'USER',
      status: 'ACTIVE',
      lastSeenAt: { gte: new Date(now.getTime() - ONLINE_MS) },
    }),
    db.sandbox.findMany({
      where: { classroomId: cls.id, kind: 'STUDENT', status: { not: 'ARCHIVED' } },
      select: {
        id: true,
        status: true,
        provisionState: true,
        clock: { select: { state: true, simStart: true, tickIndex: true } },
      },
    }),
    getClassAccessState(cls.id, now, db),
  ]);

  const states: Record<string, number> = {};
  let simNow: Date | null = null;
  for (const s of sandboxes) {
    if (!s.clock) continue;
    states[s.clock.state] = (states[s.clock.state] ?? 0) + 1;
    const at = new Date(s.clock.simStart.getTime() + Number(s.clock.tickIndex) * HOUR_MS);
    if (!simNow || at > simNow) simNow = at;
  }
  const frozen = sandboxes.filter((s) => s.status === 'FROZEN').length;
  const failed = sandboxes.filter((s) => s.provisionState === 'FAILED').length;
  const ready = sandboxes.filter((s) => s.provisionState === 'READY').length;
  const [recent, studentEdits24h] = await Promise.all([
    db.changeGroup.findMany({
      where: { classroomId: cls.id, source: { in: ['INSTRUCTOR', 'SCENARIO'] } },
      orderBy: { occurredAt: 'desc' },
      take: 20,
      select: { id: true, occurredAt: true, source: true, summary: true, entityName: true },
    }),
    db.changeGroup.count({
      where: {
        classroomId: cls.id,
        source: 'UI',
        actorType: 'USER',
        occurredAt: { gte: new Date(now.getTime() - 24 * HOUR_MS) },
      },
    }),
  ]);
  const alerts: string[] = [];
  if (failed) alerts.push(`${failed} sandbox${failed === 1 ? '' : 'es'} failed to build.`);
  if (frozen && access.open) alerts.push(`${frozen} sandbox${frozen === 1 ? ' is' : 'es are'} frozen while the class is open.`);

  return {
    classes: list,
    selected: { id: cls.id, name: cls.name, timeZone: cls.timeZone },
    access,
    students: { active, online },
    sandboxes: {
      total: sandboxes.length,
      ready,
      frozen,
      failed,
      notCreated: Math.max(0, active - sandboxes.length),
    },
    clock: { states, simNow },
    alerts,
    recent: recent.map((r) => ({ ...r, source: r.source })),
    studentEdits24h,
  };
}
