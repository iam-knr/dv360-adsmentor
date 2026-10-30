// Module 05 4.7: audience, expiry, dismissal, ordering and the instructor actions (AC-05-24, 25).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SessionUser } from '@/lib/auth/types';
import { prisma } from '@/lib/db';
import {
  createAnnouncement,
  deleteAnnouncement,
  dismissNotification,
  listNotifications,
} from '@/lib/history/notifications';
import { createWorld, dropWorld, type World } from '../db/helpers';

let a: World;
let b: World;
const student = (world: World): SessionUser => ({
  id: world.userId,
  email: `${world.tag}-user@example.test`,
  name: 'S',
  appRole: 'user',
  dvRole: 'STANDARD',
  classroomId: world.classroomId,
  sandboxId: world.sandboxId,
});
const instructor = (world: World): SessionUser => ({
  id: world.ownerId,
  email: `${world.tag}-admin@example.test`,
  name: 'I',
  appRole: 'admin',
  dvRole: 'ADMIN',
  classroomId: world.classroomId,
});
const superAdmin: SessionUser = { id: 'super', email: 'super@example.test', name: 'Root', appRole: 'super_admin', dvRole: 'ADMIN' };
const titles = async (u: SessionUser, now?: Date) => (await listNotifications(u, now)).map((n) => n.title);

beforeAll(async () => {
  a = await createWorld('nta');
  b = await createWorld('ntb');
});
afterAll(async () => {
  await prisma.notification.deleteMany({ where: { title: { startsWith: 'hist-' } } });
  await dropWorld(a);
  await dropWorld(b);
  await prisma.$disconnect();
});

describe('notifications', () => {
  it('shows class and platform announcements to the right people, newest first (AC-05-24, 25)', async () => {
    const t0 = new Date(Date.now() - 3 * 3_600_000);
    await prisma.notification.create({ data: { classroomId: null, title: 'hist-platform', body: 'b', createdById: a.ownerId, publishedAt: new Date(Date.now() - 9 * 86_400_000) } });
    await prisma.notification.create({ data: { classroomId: a.classroomId, title: 'hist-class-a', body: 'b', createdById: a.ownerId, publishedAt: t0 } });
    await prisma.notification.create({ data: { classroomId: b.classroomId, title: 'hist-class-b', body: 'b', createdById: b.ownerId } });
    expect((await titles(student(a))).filter((t) => t.startsWith('hist-'))).toEqual(['hist-class-a', 'hist-platform']);
    expect((await titles(student(b))).filter((t) => t.startsWith('hist-'))).toEqual(['hist-class-b', 'hist-platform']);
    const dto = (await listNotifications(student(a))).find((n) => n.title === 'hist-class-a')!;
    expect(dto).toMatchObject({ kind: 'Announcement', ageLabel: '3 h', severity: 'INFO' });
    expect((await listNotifications(student(a))).find((n) => n.title === 'hist-platform')!.ageLabel).toBe('9 d');
  });

  it('hides expired and not yet published announcements', async () => {
    await prisma.notification.create({ data: { classroomId: a.classroomId, title: 'hist-expired', body: 'b', createdById: a.ownerId, expiresAt: new Date(Date.now() - 1000) } });
    await prisma.notification.create({ data: { classroomId: a.classroomId, title: 'hist-future', body: 'b', createdById: a.ownerId, publishedAt: new Date(Date.now() + 3_600_000) } });
    const now = await titles(student(a));
    expect(now).not.toContain('hist-expired');
    expect(now).not.toContain('hist-future');
    expect(await titles(student(a), new Date(Date.now() + 2 * 3_600_000))).toContain('hist-future');
  });

  it('honours the audience role', async () => {
    await prisma.notification.create({ data: { classroomId: a.classroomId, title: 'hist-staff-only', body: 'b', createdById: a.ownerId, audienceRole: 'INSTRUCTOR' } });
    expect(await titles(student(a))).not.toContain('hist-staff-only');
    expect(await titles(instructor(a))).toContain('hist-staff-only');
  });

  it('dismisses for one person only', async () => {
    const id = (await listNotifications(student(a))).find((n) => n.title === 'hist-class-a')!.id;
    await dismissNotification(student(a), id);
    await dismissNotification(student(a), id); // twice is fine
    expect(await titles(student(a))).not.toContain('hist-class-a');
    const peer = await prisma.user.create({ data: { email: `peer-${Date.now()}@example.test`, name: 'P', ownerAdminId: a.ownerId } });
    expect(await titles({ ...student(a), id: peer.id })).toContain('hist-class-a');
    await prisma.user.delete({ where: { id: peer.id } }).catch(() => undefined);
  });

  it('cannot dismiss an announcement of another class', async () => {
    const id = (await prisma.notification.findFirstOrThrow({ where: { title: 'hist-class-b' } })).id;
    await expect(dismissNotification(student(a), id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('shows at most 20', async () => {
    await prisma.notification.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({ classroomId: b.classroomId, title: `hist-bulk-${i}`, body: 'b', createdById: b.ownerId })),
    });
    expect((await listNotifications(student(b))).length).toBe(20);
  });
});

describe('announcement actions (HIS-010, HIS-011)', () => {
  it('lets an instructor announce to their own class and delete it', async () => {
    const { id } = await createAnnouncement(instructor(a), { classId: a.classroomId, title: 'hist-new', body: 'Hello', learnMoreRoute: '/help', severity: 'WARNING', expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString() });
    const shown = (await listNotifications(student(a))).find((n) => n.id === id)!;
    expect(shown).toMatchObject({ title: 'hist-new', learnMoreRoute: '/help', severity: 'WARNING' });
    await expect(deleteAnnouncement(instructor(b), id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(deleteAnnouncement(instructor(a), id)).resolves.toBeNull();
    expect(await titles(student(a))).not.toContain('hist-new');
  });

  it('refuses a student, another class, and platform-wide from an instructor', async () => {
    const input = { title: 'hist-no', body: 'b' };
    await expect(createAnnouncement(student(a), { ...input, classId: a.classroomId })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(createAnnouncement(instructor(a), { ...input, classId: b.classroomId })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(createAnnouncement(instructor(a), input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(createAnnouncement(superAdmin, input)).resolves.toBeTruthy();
  });

  it('validates title, body and the learn more path', async () => {
    const ok = { classId: a.classroomId, title: 'hist-v', body: 'b' };
    await expect(createAnnouncement(instructor(a), { ...ok, title: ' ' })).rejects.toMatchObject({ issues: [{ code: 'HIS-010', message: 'Enter a value' }] });
    await expect(createAnnouncement(instructor(a), { ...ok, title: 'x'.repeat(121) })).rejects.toMatchObject({ issues: [{ code: 'HIS-010' }] });
    await expect(createAnnouncement(instructor(a), { ...ok, body: 'x'.repeat(1001) })).rejects.toMatchObject({ issues: [{ code: 'HIS-010' }] });
    await expect(createAnnouncement(instructor(a), { ...ok, learnMoreRoute: 'https://evil.test' })).rejects.toMatchObject({ issues: [{ code: 'HIS-011', message: '[SIM] Enter an app path that starts with /.' }] });
    await expect(createAnnouncement(instructor(a), { ...ok, learnMoreRoute: '//evil.test' })).rejects.toMatchObject({ issues: [{ code: 'HIS-011' }] });
  });
});
