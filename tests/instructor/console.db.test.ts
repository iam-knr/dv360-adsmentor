import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Actor } from '@/lib/accounts/permissions';
import type { SessionUser } from '@/lib/auth/types';
import { prisma } from '@/lib/db';
import { createAnnouncement, deleteAnnouncement, listNotifications } from '@/lib/history/notifications';
import { listAllClasses, queryAudit, readEngineParams } from '@/lib/instructor/admin';
import { auditAnnouncement, listAnnouncements } from '@/lib/instructor/announcements';
import { getDashboard } from '@/lib/instructor/dashboard';
import { InstructorError } from '@/lib/instructor/rules';
import { writeInstructorAudit } from '@/lib/instructor/audit';
import { cleanup, createAccount, createClassroom, createStudent } from '../auth/fixtures';

const userIds: string[] = [];
const classroomIds: string[] = [];
let admin: Actor;
let other: Actor;
let superAdmin: Actor;
let adminUser: SessionUser;
let studentUser: SessionUser;
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

const asSession = (u: { id: string; email: string; name: string }, appRole: 'admin' | 'user' | 'super_admin', classroomId?: string): SessionUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
  appRole,
  dvRole: appRole === 'user' ? 'STANDARD' : 'ADMIN',
  ...(classroomId ? { classroomId } : {}),
});

beforeAll(async () => {
  const a = await createAccount(prisma, { tag: 'con-admin', role: 'ADMIN' });
  const b = await createAccount(prisma, { tag: 'con-other', role: 'ADMIN' });
  const s = await createAccount(prisma, { tag: 'con-super', role: 'SUPER_ADMIN' });
  userIds.push(a.user.id, b.user.id, s.user.id);
  admin = { id: a.user.id, role: 'ADMIN' };
  other = { id: b.user.id, role: 'ADMIN' };
  superAdmin = { id: s.user.id, role: 'SUPER_ADMIN' };
  adminUser = asSession(a.user, 'admin');
  const c = await createClassroom(prisma, { tag: 'con', ownerAdminId: a.user.id, windows: 'open' });
  classroomIds.push(c.id);
  classId = c.id;
  const st = await createStudent(prisma, { tag: 'con-stu', classroomId: c.id });
  userIds.push(st.user.id);
  studentUser = asSession(st.user, 'user', c.id);
});

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { createdById: { in: userIds } } });
  await prisma.classroomMember.deleteMany({ where: { userId: { in: userIds } } });
  await cleanup(prisma, { userIds, classroomIds });
});

describe('dashboard (I1)', () => {
  it('shows the class status, students, sandboxes and clock for the instructor\'s own class', async () => {
    const d = await getDashboard(admin, undefined);
    expect(d.selected?.id).toBe(classId);
    expect(d.access?.open).toBe(true);
    expect(d.students.active).toBe(1);
    expect(d.sandboxes).toMatchObject({ total: 1, ready: 1, failed: 0 });
    expect(d.clock.states).toEqual({ RUNNING: 1 });
    expect(d.clock.simNow).not.toBeNull();
  });

  it('counts a student seen in the last 5 minutes as online', async () => {
    await prisma.user.update({ where: { id: studentUser.id }, data: { lastSeenAt: new Date() } });
    expect((await getDashboard(admin, classId)).students.online).toBe(1);
    await prisma.user.update({ where: { id: studentUser.id }, data: { lastSeenAt: new Date(Date.now() - 10 * 60_000) } });
    expect((await getDashboard(admin, classId)).students.online).toBe(0);
  });

  it('alerts on a FAILED sandbox', async () => {
    const sb = await prisma.sandbox.findFirstOrThrow({ where: { classroomId: classId } });
    await prisma.sandbox.update({ where: { id: sb.id }, data: { provisionState: 'FAILED', provisionError: 'boom' } });
    const d = await getDashboard(admin, classId);
    expect(d.sandboxes.failed).toBe(1);
    expect(d.alerts.join(' ')).toMatch(/failed to build/);
    await prisma.sandbox.update({ where: { id: sb.id }, data: { provisionState: 'READY', provisionError: null } });
  });

  it('another instructor sees no data of this class, and a class id from outside falls back to their own', async () => {
    const d = await getDashboard(other, classId);
    expect(d.selected).toBeNull();
    expect(d.classes).toEqual([]);
  });
});

describe('announcements (I10)', () => {
  it('an instructor announces to their own class; students of the class see it in the bell; audit row written', async () => {
    const created = await createAnnouncement(adminUser, { classId, title: 'Lab moved', body: 'Room 4 today.' });
    await auditAnnouncement(admin, 'ANNOUNCEMENT_CREATED', classId, created.id);
    const mine = await listAnnouncements(admin);
    expect(mine.map((a) => a.title)).toContain('Lab moved');
    expect((await listNotifications(studentUser)).map((n) => n.title)).toContain('Lab moved');
    expect((await listAnnouncements(other)).map((a) => a.title)).not.toContain('Lab moved');
    expect(await prisma.auditLog.count({ where: { action: 'ANNOUNCEMENT_CREATED', targetId: created.id } })).toBe(1);
    await deleteAnnouncement(adminUser, created.id);
    expect((await listAnnouncements(admin)).map((a) => a.title)).not.toContain('Lab moved');
  });

  it('an instructor cannot announce to another class or platform wide', async () => {
    const otherUser = asSession({ id: other.id, email: 'o@example.test', name: 'Other' }, 'admin');
    await expect(createAnnouncement(otherUser, { classId, title: 'x', body: 'y' })).rejects.toThrow();
    await expect(createAnnouncement(otherUser, { title: 'x', body: 'y' })).rejects.toThrow();
  });
});

describe('admin pages (A3, A5, A6)', () => {
  it('only a Super admin lists all classes, queries the audit log and reads engine parameters', async () => {
    expect((await listAllClasses(superAdmin)).some((c) => c.id === classId)).toBe(true);
    expect(await code(listAllClasses(admin))).toBe('FORBIDDEN');
    expect(await code(queryAudit(admin, {}))).toBe('FORBIDDEN');
  });

  it('filters the audit log by action, class and actor and pages it', async () => {
    await writeInstructorAudit(prisma, { actorUserId: admin.id, actorRole: 'ADMIN', classroomId: classId, action: 'WINDOW_CREATED', targetType: 'AccessWindow', payload: { count: 1 } });
    await writeInstructorAudit(prisma, { actorUserId: other.id, actorRole: 'ADMIN', action: 'CLASS_CLOSED', targetType: 'Classroom' });
    const byAction = await queryAudit(superAdmin, { action: 'WINDOW_CREATED', classroomId: classId });
    expect(byAction.rows.every((r) => r.action === 'WINDOW_CREATED' && r.classroomId === classId)).toBe(true);
    expect(byAction.total).toBeGreaterThanOrEqual(1);
    const byActor = await queryAudit(superAdmin, { actorUserId: other.id });
    expect(byActor.rows.map((r) => r.action)).toEqual(['CLASS_CLOSED']);
    const future = await queryAudit(superAdmin, { from: new Date(Date.now() + 86_400_000) });
    expect(future.total).toBe(0);
    expect(byAction.actions).toEqual(expect.arrayContaining(['WINDOW_CREATED', 'CLASS_CLOSED']));
  });

  it('reads the engine parameter file with a stable version', () => {
    const a = readEngineParams();
    const b = readEngineParams();
    expect(a.hash).toMatch(/^[0-9a-f]{12}$/);
    expect(a.hash).toBe(b.hash);
    expect(a.top.length).toBeGreaterThan(0);
  });
});
