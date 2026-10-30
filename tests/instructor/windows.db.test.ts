import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Actor } from '@/lib/accounts/permissions';
import { tickAccessWindows } from '@/lib/access/windows';
import { prisma } from '@/lib/db';
import {
  closeClassNow,
  createAccessWindow,
  deleteAccessWindow,
  listWindows,
  openClassNow,
  updateAccessWindow,
} from '@/lib/instructor/windows';
import { InstructorError } from '@/lib/instructor/rules';
import { cleanup, createAccount, createClassroom, createStudent } from '../auth/fixtures';

const userIds: string[] = [];
const classroomIds: string[] = [];
let admin: Actor;
let other: Actor;
let superAdmin: Actor;
let classId: string;

const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    if (e instanceof InstructorError) return e.code;
    throw e;
  }
  return 'NO_ERROR';
};
const NOW = new Date('2026-11-02T06:00:00Z'); // 11:30 in Kolkata

beforeAll(async () => {
  const a = await createAccount(prisma, { tag: 'win-admin', role: 'ADMIN' });
  const b = await createAccount(prisma, { tag: 'win-other', role: 'ADMIN' });
  const s = await createAccount(prisma, { tag: 'win-super', role: 'SUPER_ADMIN' });
  userIds.push(a.user.id, b.user.id, s.user.id);
  admin = { id: a.user.id, role: 'ADMIN' };
  other = { id: b.user.id, role: 'ADMIN' };
  superAdmin = { id: s.user.id, role: 'SUPER_ADMIN' };
  const c = await createClassroom(prisma, { tag: 'win', ownerAdminId: a.user.id, windows: 'none' });
  classroomIds.push(c.id);
  classId = c.id;
});

afterAll(async () => {
  await prisma.accessWindow.deleteMany({ where: { classroomId: { in: classroomIds } } });
  await cleanup(prisma, { userIds, classroomIds });
});

describe('createAccessWindow', () => {
  it('stores a single window in UTC from the class time zone', async () => {
    const r = await createAccessWindow(admin, { classId, label: 'Lab 1', date: '2026-11-09', startTime: '10:00', endTime: '12:00' }, NOW);
    expect(r.ids).toHaveLength(1);
    const w = await prisma.accessWindow.findUniqueOrThrow({ where: { id: r.ids[0]! } });
    expect(w.opensAt.toISOString()).toBe('2026-11-09T04:30:00.000Z');
    expect(w.closesAt.toISOString()).toBe('2026-11-09T06:30:00.000Z');
    expect(w.status).toBe('SCHEDULED');
    expect(w.seriesId).toBeNull();
  });

  it('M18-AC7: a weekly repeat makes the right number of windows in one series', async () => {
    const r = await createAccessWindow(
      admin,
      { classId, label: 'Weekly', date: '2026-11-16', startTime: '09:00', endTime: '10:00', repeat: { byDay: ['MO', 'TH'], until: '2026-12-03' } },
      NOW,
    );
    // Mon 16, Thu 19, Mon 23, Thu 26, Mon 30 Nov, Thu 3 Dec
    expect(r.ids).toHaveLength(6);
    const rows = await prisma.accessWindow.findMany({ where: { id: { in: r.ids } } });
    expect(new Set(rows.map((x) => x.seriesId)).size).toBe(1);
    expect(rows[0]!.repeatRule).toEqual({ freq: 'WEEKLY', byDay: ['MO', 'TH'], until: '2026-12-03' });
  });

  it('warns on a window under 15 minutes (SIM-006) but saves it', async () => {
    const r = await createAccessWindow(admin, { classId, label: 'Quick', date: '2026-11-10', startTime: '10:00', endTime: '10:10' }, NOW);
    expect(r.warnings).toEqual(['This window is very short.']);
  });

  it('refuses an end before the start (SIM-005) and an unknown label (SIM-004)', async () => {
    expect(await code(createAccessWindow(admin, { classId, label: 'Bad', date: '2026-11-10', startTime: '12:00', endTime: '11:00' }, NOW))).toBe('SIM-005');
    expect(await code(createAccessWindow(admin, { classId, label: ' ', date: '2026-11-10', startTime: '10:00', endTime: '11:00' }, NOW))).toBe('SIM-004');
  });

  it('an instructor cannot reach another instructor\'s class; a Super admin can', async () => {
    const input = { classId, label: 'Mine', date: '2026-11-11', startTime: '10:00', endTime: '11:00' };
    expect(await code(createAccessWindow(other, input, NOW))).toBe('SIM-020');
    expect(await code(listWindows(other, classId, NOW))).toBe('SIM-020');
    expect((await createAccessWindow(superAdmin, input, NOW)).ids).toHaveLength(1);
  });
});

describe('update and delete', () => {
  it('M18-AC7: editing THIS changes one window, SERIES changes this and later ones', async () => {
    const r = await createAccessWindow(
      admin,
      { classId, label: 'Series A', date: '2027-01-04', startTime: '10:00', endTime: '11:00', repeat: { byDay: ['MO'], until: '2027-01-25' } },
      NOW,
    );
    expect(r.ids).toHaveLength(4);
    const rows = (await prisma.accessWindow.findMany({ where: { id: { in: r.ids } }, orderBy: { opensAt: 'asc' } }));
    // Edit only the second window
    await updateAccessWindow(admin, rows[1]!.id, { label: 'Moved', startTime: '14:00', endTime: '15:00' }, 'THIS', NOW);
    let now = await prisma.accessWindow.findMany({ where: { id: { in: r.ids } }, orderBy: { opensAt: 'asc' } });
    expect(now.map((w) => w.label)).toEqual(['Series A', 'Moved', 'Series A', 'Series A']);
    // Edit the third and later
    const res = await updateAccessWindow(admin, rows[2]!.id, { label: 'Later', startTime: '08:00', endTime: '09:30' }, 'SERIES', NOW);
    expect(res.updated).toBe(2);
    now = await prisma.accessWindow.findMany({ where: { id: { in: r.ids } }, orderBy: { opensAt: 'asc' } });
    expect(now.map((w) => w.label)).toEqual(['Series A', 'Moved', 'Later', 'Later']);
    expect(now[2]!.opensAt.toISOString()).toBe('2027-01-18T02:30:00.000Z'); // 08:00 Kolkata, date kept
    expect(now[1]!.opensAt.toISOString()).toBe('2027-01-11T08:30:00.000Z'); // the THIS edit kept
  });

  it('M18-AC7 / SIM-007: an open window cannot be edited or deleted', async () => {
    const o = await openClassNow(admin, classId, {}, NOW);
    expect(await code(deleteAccessWindow(admin, o.windowId, 'THIS', NOW))).toBe('SIM-007');
    expect(await code(updateAccessWindow(admin, o.windowId, { label: 'x' }, 'THIS', NOW))).toBe('SIM-007');
    await closeClassNow(admin, classId, NOW);
  });

  it('delete cancels upcoming windows (THIS or the rest of the series) and keeps the rows', async () => {
    const r = await createAccessWindow(
      admin,
      { classId, label: 'Gone', date: '2027-03-01', startTime: '10:00', endTime: '11:00', repeat: { byDay: ['MO'], until: '2027-03-22' } },
      NOW,
    );
    const rows = await prisma.accessWindow.findMany({ where: { id: { in: r.ids } }, orderBy: { opensAt: 'asc' } });
    expect((await deleteAccessWindow(admin, rows[3]!.id, 'THIS', NOW)).deleted).toBe(1);
    expect((await deleteAccessWindow(admin, rows[1]!.id, 'SERIES', NOW)).deleted).toBe(2);
    const after = await prisma.accessWindow.findMany({ where: { id: { in: r.ids } }, orderBy: { opensAt: 'asc' } });
    expect(after.map((w) => w.status)).toEqual(['SCHEDULED', 'CANCELLED', 'CANCELLED', 'CANCELLED']);
  });

  it('only upcoming windows can be changed (SIM-018)', async () => {
    const past = await prisma.accessWindow.create({
      data: { classroomId: classId, label: 'Old', opensAt: new Date('2026-01-01T04:00:00Z'), closesAt: new Date('2026-01-01T06:00:00Z'), status: 'CLOSED' },
    });
    expect(await code(deleteAccessWindow(admin, past.id, 'THIS', NOW))).toBe('SIM-018');
    expect(await code(updateAccessWindow(admin, past.id, { label: 'x' }, 'THIS', NOW))).toBe('SIM-018');
  });
});

describe('open now and close now (M18-AC8, AC5, AC6)', () => {
  it('Open now makes a 2 hour window "Opened manually" and the class is open', async () => {
    const c = await createClassroom(prisma, { tag: 'win-now', ownerAdminId: admin.id, windows: 'none' });
    classroomIds.push(c.id);
    const now = new Date();
    const r = await openClassNow(admin, c.id, {}, now);
    expect(r.closesAt.getTime() - now.getTime()).toBe(2 * 3_600_000);
    const w = await prisma.accessWindow.findUniqueOrThrow({ where: { id: r.windowId } });
    expect(w).toMatchObject({ label: 'Opened manually', status: 'OPEN' });
    const list = await listWindows(admin, c.id, now);
    expect(list.windows[0]!.live).toBe(true);
  });

  it('caps Open now at 8 hours', async () => {
    const c = await createClassroom(prisma, { tag: 'win-cap', ownerAdminId: admin.id, windows: 'none' });
    classroomIds.push(c.id);
    const now = new Date();
    const r = await openClassNow(admin, c.id, { hours: 24 }, now);
    expect(r.closesAt.getTime() - now.getTime()).toBe(8 * 3_600_000);
  });

  it('Close now ends the window at once, freezes the sandbox and pauses the clock; reopening restores it with no sim time lost', async () => {
    const c = await createClassroom(prisma, { tag: 'win-freeze', ownerAdminId: admin.id, windows: 'open' });
    classroomIds.push(c.id);
    const st = await createStudent(prisma, { tag: 'win-stu', classroomId: c.id, clockState: 'RUNNING' });
    userIds.push(st.user.id);
    const before = await prisma.simClock.findUniqueOrThrow({ where: { sandboxId: st.sandbox.id } });
    const now = new Date();
    const closed = await closeClassNow(admin, c.id, now);
    expect(closed.closed).toBeGreaterThanOrEqual(1);
    const w = await prisma.accessWindow.findFirstOrThrow({ where: { classroomId: c.id } });
    expect(w).toMatchObject({ status: 'CLOSED', closedBy: 'INSTRUCTOR' });
    let sb = await prisma.sandbox.findUniqueOrThrow({ where: { id: st.sandbox.id }, include: { clock: true } });
    expect(sb.status).toBe('FROZEN');
    expect(sb.clock?.state).toBe('PAUSED');
    expect(sb.clockStateBeforeFreeze).toBe('RUNNING');
    expect(sb.clock?.tickIndex).toBe(before.tickIndex);

    await openClassNow(admin, c.id, {}, new Date(now.getTime() + 60_000));
    sb = await prisma.sandbox.findUniqueOrThrow({ where: { id: st.sandbox.id }, include: { clock: true } });
    expect(sb.status).toBe('ACTIVE');
    expect(sb.clock?.state).toBe('RUNNING');
    expect(sb.clock?.tickIndex).toBe(before.tickIndex); // no sim time passed while closed
    await tickAccessWindows(new Date(now.getTime() + 61_000)); // idempotent
    expect((await prisma.sandbox.findUniqueOrThrow({ where: { id: st.sandbox.id } })).status).toBe('ACTIVE');
  });

  it('every console action leaves an audit row without a secret', async () => {
    const rows = await prisma.auditLog.findMany({ where: { classroomId: classId, actorUserId: admin.id } });
    const actions = new Set(rows.map((r) => r.action));
    for (const a of ['WINDOW_CREATED', 'WINDOW_UPDATED', 'WINDOW_DELETED', 'CLASS_OPENED', 'CLASS_CLOSED']) {
      expect(actions.has(a), a).toBe(true);
    }
    expect(JSON.stringify(rows)).not.toMatch(/password|hash/i);
  });
});
