import 'server-only';
import type { Actor } from '@/lib/accounts/permissions';
import { prisma } from '@/lib/db';
import { writeInstructorAudit } from './audit';
import { InstructorError } from './rules';
import { myClasses, type Db } from './scope';

// Announcement list for the console (module 18 I10). Create and delete are `createAnnouncement` and
// `deleteAnnouncement` of lib/history/notifications (P4-12); the server actions call them with the session user.
export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  className: string;
  learnMoreRoute: string | null;
  severity: string;
  publishedAt: Date;
  expiresAt: Date | null;
  expired: boolean;
}

export async function listAnnouncements(
  actor: Actor,
  now: Date = new Date(),
  db: Db = prisma,
): Promise<AnnouncementRow[]> {
  const classes = await myClasses(db, actor);
  const names = new Map(classes.map((c) => [c.id, c.name]));
  const rows = await db.notification.findMany({
    where: {
      kind: 'ANNOUNCEMENT',
      OR: [
        { classroomId: { in: [...names.keys()] } },
        ...(actor.role === 'SUPER_ADMIN' ? [{ classroomId: null }] : []),
      ],
    },
    orderBy: { publishedAt: 'desc' },
    take: 100,
  });
  return rows.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    className: n.classroomId ? (names.get(n.classroomId) ?? '') : 'All classes',
    learnMoreRoute: n.learnMoreRoute,
    severity: n.severity,
    publishedAt: n.publishedAt,
    expiresAt: n.expiresAt,
    expired: n.expiresAt !== null && n.expiresAt <= now,
  }));
}

export async function auditAnnouncement(
  actor: Actor,
  action: 'ANNOUNCEMENT_CREATED' | 'ANNOUNCEMENT_DELETED',
  classId: string | undefined,
  id: string,
  db: Db = prisma,
): Promise<void> {
  if (!id) throw new InstructorError('SIM-020');
  await writeInstructorAudit(db, {
    actorUserId: actor.id,
    actorRole: actor.role,
    classroomId: classId ?? null,
    action,
    targetType: 'Notification',
    targetId: id,
  });
}
