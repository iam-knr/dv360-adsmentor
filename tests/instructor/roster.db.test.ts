import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Actor } from '@/lib/accounts/permissions';
import { verifyPassword } from '@/lib/auth/argon';
import { prisma } from '@/lib/db';
import {
  addStudents,
  deactivateStudent,
  getRoster,
  parseRosterCsv,
  removeStudent,
  resetStudentPassword,
} from '@/lib/instructor/roster';
import { InstructorError } from '@/lib/instructor/rules';
import { cleanup, createAccount, createClassroom, createStudent, uniq } from '../auth/fixtures';

const userIds: string[] = [];
const classroomIds: string[] = [];
let admin: Actor;
let other: Actor;
let classId: string;
let small: string;

const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    if (e instanceof InstructorError) return e.code;
    if (e instanceof Error && 'code' in e) return String((e as { code: unknown }).code);
    throw e;
  }
  return 'NO_ERROR';
};
const mail = (t: string) => `${uniq(t)}@roster.example.test`;

beforeAll(async () => {
  const a = await createAccount(prisma, { tag: 'ros-admin', role: 'ADMIN' });
  const b = await createAccount(prisma, { tag: 'ros-other', role: 'ADMIN' });
  userIds.push(a.user.id, b.user.id);
  admin = { id: a.user.id, role: 'ADMIN' };
  other = { id: b.user.id, role: 'ADMIN' };
  const c = await createClassroom(prisma, { tag: 'ros', ownerAdminId: a.user.id, windows: 'none' });
  const s = await createClassroom(prisma, { tag: 'ros-small', ownerAdminId: a.user.id, windows: 'none', capacity: 2 });
  classroomIds.push(c.id, s.id);
  classId = c.id;
  small = s.id;
});

afterAll(async () => {
  const made = await prisma.user.findMany({ where: { email: { endsWith: '@roster.example.test' } }, select: { id: true } });
  const ids = [...userIds, ...made.map((u) => u.id)];
  await prisma.classroomMember.deleteMany({ where: { userId: { in: ids } } });
  await cleanup(prisma, { userIds: ids, classroomIds });
});

describe('addStudents (M18 acceptance 9)', () => {
  it('creates users, memberships and a generated password each, returned once and never stored', async () => {
    const input = [1, 2, 3].map((i) => ({ name: `Student ${i}`, email: mail(`add${i}`) }));
    const r = await addStudents(admin, classId, input);
    expect(r.created).toHaveLength(3);
    expect(r.skipped).toEqual([]);
    for (const c of r.created) {
      expect(c.password.length).toBeGreaterThanOrEqual(16);
      const u = await prisma.user.findUniqueOrThrow({ where: { id: c.userId } });
      expect(u).toMatchObject({ appRole: 'USER', cohortId: classId, mustChangePassword: true, status: 'ACTIVE' });
      expect(await verifyPassword(u.passwordHash!, c.password)).toBe(true);
      expect(u.passwordHash).not.toContain(c.password);
      expect(await prisma.classroomMember.count({ where: { classroomId: classId, userId: c.userId } })).toBe(1);
    }
    // passwords differ, and no audit row carries one
    expect(new Set(r.created.map((c) => c.password)).size).toBe(3);
    const audit = await prisma.auditLog.findMany({ where: { classroomId: classId } });
    const blob = JSON.stringify(audit);
    for (const c of r.created) expect(blob).not.toContain(c.password);
    expect(audit.some((a) => a.action === 'ROSTER_ADDED')).toBe(true);
  });

  it('a bad row does not stop the good rows; duplicates and existing emails are skipped with a reason', async () => {
    const dup = mail('dup');
    const exists = mail('exists');
    await addStudents(admin, classId, [{ name: 'Existing', email: exists }]);
    const r = await addStudents(admin, classId, [
      { name: 'Good', email: mail('good') },
      { name: 'Bad email', email: 'nope' },
      { name: 'Dup 1', email: dup },
      { name: 'Dup 2', email: dup.toUpperCase() },
      { name: 'Existing again', email: exists },
    ]);
    expect(r.created.map((c) => c.name).sort()).toEqual(['Dup 1', 'Good']);
    expect(r.skipped.map((s) => s.email).sort()).toEqual([dup, exists, 'nope'].sort());
    expect(r.skipped.find((s) => s.email === exists)!.reason).toMatch(/already exists/);
  });

  it('stops at the class capacity and reports the rest as skipped', async () => {
    const r = await addStudents(admin, small, [1, 2, 3, 4].map((i) => ({ name: `S${i}`, email: mail(`cap${i}`) })));
    expect(r.created).toHaveLength(2);
    expect(r.skipped).toHaveLength(2);
    expect(r.skipped.every((s) => /full/i.test(s.reason))).toBe(true);
  });

  it('CSV rows feed the same path (parse, then add)', async () => {
    const e = mail('csv');
    const parsed = parseRosterCsv(`name,email\nCsv Student,${e}\n,broken@example.test`);
    expect(parsed.errors).toHaveLength(1);
    const r = await addStudents(admin, classId, parsed.students);
    expect(r.created.map((c) => c.email)).toEqual([e]);
  });

  it('another instructor cannot add to the class (SIM-020) and nothing is created', async () => {
    const e = mail('forged');
    expect(await code(addStudents(other, classId, [{ name: 'Forged', email: e }]))).toBe('SIM-020');
    expect(await prisma.user.count({ where: { email: e } })).toBe(0);
  });

  it('an empty list is SIM-008', async () => {
    expect(await code(addStudents(admin, classId, []))).toBe('SIM-008');
  });
});

describe('roster view and the three aliased actions', () => {
  it('lists the class with the sandbox state and no password or hash field', async () => {
    const c = await createClassroom(prisma, { tag: 'ros-view', ownerAdminId: admin.id, windows: 'none' });
    classroomIds.push(c.id);
    const st = await createStudent(prisma, { tag: 'ros-v1', classroomId: c.id });
    const nobox = await addStudents(admin, c.id, [{ name: 'No Box', email: mail('nobox') }]);
    userIds.push(st.user.id);
    const roster = await getRoster(admin, c.id);
    const byName = new Map(roster.rows.map((r) => [r.name, r]));
    expect(byName.get(st.user.name)!.sandbox).toBe('READY');
    expect(byName.get('No Box')!.sandbox).toBe('NOT CREATED');
    expect(nobox.created).toHaveLength(1);
    expect(JSON.stringify(roster)).not.toMatch(/passwordHash|argon2/);
    expect(await code(getRoster(other, c.id))).toBe('SIM-020');
  });

  it('resetStudentPassword returns a new password once, ends sessions and forces a change', async () => {
    const [made] = (await addStudents(admin, classId, [{ name: 'Reset Me', email: mail('rst') }])).created;
    const before = await prisma.user.findUniqueOrThrow({ where: { id: made!.userId } });
    const r = await resetStudentPassword(admin, made!.userId);
    expect(r.tempPassword).toBeTruthy();
    expect(r.tempPassword).not.toBe(made!.password);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: made!.userId } });
    expect(after.sessionVersion).toBe(before.sessionVersion + 1);
    expect(after.mustChangePassword).toBe(true);
    expect(await verifyPassword(after.passwordHash!, r.tempPassword!)).toBe(true);
    expect(await verifyPassword(after.passwordHash!, made!.password)).toBe(false);
  });

  it('another instructor cannot reset, deactivate or remove this class\'s students', async () => {
    const [made] = (await addStudents(admin, classId, [{ name: 'Safe', email: mail('safe') }])).created;
    expect(await code(resetStudentPassword(other, made!.userId))).toBe('ACC-022');
    expect(await code(deactivateStudent(other, made!.userId))).toBe('ACC-022');
    expect(await code(removeStudent(other, classId, made!.userId))).toBe('SIM-020');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: made!.userId } })).status).toBe('ACTIVE');
  });

  it('deactivate disables the account; remove archives it and the sandbox and writes an audit row', async () => {
    const c = await createClassroom(prisma, { tag: 'ros-rm', ownerAdminId: admin.id, windows: 'none' });
    classroomIds.push(c.id);
    const st = await createStudent(prisma, { tag: 'ros-rm1', classroomId: c.id });
    const st2 = await createStudent(prisma, { tag: 'ros-rm2', classroomId: c.id });
    userIds.push(st.user.id, st2.user.id);
    await deactivateStudent(admin, st.user.id);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: st.user.id } })).status).toBe('DISABLED');
    await removeStudent(admin, c.id, st2.user.id);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: st2.user.id } })).status).toBe('ARCHIVED');
    expect((await prisma.sandbox.findUniqueOrThrow({ where: { id: st2.sandbox.id } })).status).toBe('ARCHIVED');
    const roster = await getRoster(admin, c.id);
    expect(roster.rows.map((r) => r.id)).not.toContain(st2.user.id);
    expect(await prisma.auditLog.count({ where: { classroomId: c.id, action: 'STUDENT_REMOVED' } })).toBe(1);
  });
});
