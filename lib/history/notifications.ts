import 'server-only';
// Notification service behind the bell (module 05 4.7). Announcements are platform data, not tenant data, so there is
// no sandbox scope and no change log; the audience is the viewer's classroom (or everyone) and role.
import type { NotificationAudience } from '@prisma/client';
import type { SessionUser } from '@/lib/auth/types';
import { ServiceFailure, forbidden, notFound } from '@/lib/campaigns/service-kit';
import { scopedCohorts } from '@/lib/accounts/scope';
import { prisma } from '@/lib/db';
import { ageLabel } from './age';
import type { NotificationDto } from './types';

export const MAX_SHOWN = 20;
export const HIS_011 = '[SIM] Enter an app path that starts with /.';
export const HIS_010_TITLE = 'Enter a value';

const reject = (path: string, code: string, message: string) =>
  new ServiceFailure('INVALID', [{ path, severity: 'error', code, message }]);

const audiencesFor = (user: SessionUser): NotificationAudience[] =>
  user.appRole === 'user' ? ['ALL', 'STUDENT'] : ['ALL', 'INSTRUCTOR'];

export async function listNotifications(
  user: SessionUser,
  now: Date = new Date(),
): Promise<NotificationDto[]> {
  const me = (user.actor ?? user).id;
  const rows = await prisma.notification.findMany({
    where: {
      publishedAt: { lte: now },
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        { OR: [{ classroomId: null }, ...(user.classroomId ? [{ classroomId: user.classroomId }] : [])] },
      ],
      audienceRole: { in: audiencesFor(user) },
      dismissals: { none: { userId: me } },
    },
    orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
    take: MAX_SHOWN,
  });
  return rows.map((n) => ({
    id: n.id,
    kind: 'Announcement' as const,
    title: n.title,
    body: n.body,
    ageLabel: ageLabel(n.publishedAt, now),
    ...(n.learnMoreRoute ? { learnMoreRoute: n.learnMoreRoute } : {}),
    severity: n.severity,
  }));
}

/** Dismissal is per user. Dismissing twice, or an announcement the person cannot see, is a no-op / not found. */
export async function dismissNotification(user: SessionUser, id: string): Promise<null> {
  const me = (user.actor ?? user).id;
  const visible = await prisma.notification.findFirst({
    where: {
      id,
      audienceRole: { in: audiencesFor(user) },
      OR: [{ classroomId: null }, ...(user.classroomId ? [{ classroomId: user.classroomId }] : [])],
    },
    select: { id: true },
  });
  if (!visible) throw notFound();
  await prisma.notificationDismissal.upsert({
    where: { notificationId_userId: { notificationId: id, userId: me } },
    create: { notificationId: id, userId: me },
    update: {},
  });
  return null;
}

export interface AnnouncementInput {
  classId?: string;
  title: string;
  body: string;
  learnMoreRoute?: string;
  expiresAt?: string;
  severity?: 'INFO' | 'WARNING';
}

/** Only the Super admin announces (ADM-FIX): to any cohort, or platform-wide. */
async function canAnnounceTo(user: SessionUser, classId: string | undefined): Promise<boolean> {
  const actor = user.actor ?? user;
  if (actor.appRole !== 'super_admin') return false;
  if (!classId) return true;
  return !!(await scopedCohorts(prisma, { id: actor.id, role: 'SUPER_ADMIN' }).findById(classId));
}

export async function createAnnouncement(
  user: SessionUser,
  input: AnnouncementInput,
): Promise<{ id: string }> {
  const actor = user.actor ?? user;
  if (actor.appRole === 'user') throw forbidden();
  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length < 1 || title.length > 120) {
    throw reject('title', 'HIS-010', title ? '[SIM] Use 120 characters or fewer.' : 'Enter a value');
  }
  if (body.length < 1 || body.length > 1000) {
    throw reject('body', 'HIS-010', body ? '[SIM] Use 1000 characters or fewer.' : 'Enter a value');
  }
  const route = input.learnMoreRoute?.trim();
  if (route && (!route.startsWith('/') || route.startsWith('//'))) throw reject('learnMoreRoute', 'HIS-011', HIS_011);
  let expiresAt: Date | null = null;
  if (input.expiresAt) {
    expiresAt = new Date(input.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) throw reject('expiresAt', 'HIS-010', '[SIM] Enter a valid date.');
  }
  if (!(await canAnnounceTo(user, input.classId))) throw forbidden();
  const row = await prisma.notification.create({
    data: {
      classroomId: input.classId ?? null,
      title,
      body,
      learnMoreRoute: route || null,
      expiresAt,
      severity: input.severity ?? 'INFO',
      createdById: actor.id,
    },
    select: { id: true },
  });
  return row;
}

export async function deleteAnnouncement(user: SessionUser, id: string): Promise<null> {
  const actor = user.actor ?? user;
  if (actor.appRole === 'user') throw forbidden();
  const row = await prisma.notification.findUnique({ where: { id }, select: { id: true, classroomId: true } });
  if (!row) throw notFound();
  if (!(await canAnnounceTo(user, row.classroomId ?? undefined))) throw forbidden();
  await prisma.notification.delete({ where: { id } });
  return null;
}
