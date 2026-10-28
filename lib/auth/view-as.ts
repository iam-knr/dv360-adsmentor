import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { AppRole } from './types';
import { VIEW_AS_ACT_HEADER, VIEW_AS_HEADER } from './view-as-headers';

export { VIEW_AS_HEADER, VIEW_AS_ACT_HEADER, SIM_CLASS_HEADER } from './view-as-headers';

export interface ViewAsRequest {
  userId: string;
  actAs: boolean;
}

export function parseViewAs(get: (name: string) => string | null): ViewAsRequest | null {
  const userId = get(VIEW_AS_HEADER)?.trim();
  if (!userId || userId.length > 64) return null;
  return { userId, actAs: get(VIEW_AS_ACT_HEADER) === '1' };
}

/**
 * May this person look at the simulator as `targetId`? A Super admin may view any User; an Admin only Users of
 * their own cohorts (owner admin, or admin member of the cohort). A User never may.
 */
export async function canViewAs(
  actor: { id: string; appRole: AppRole },
  targetId: string,
  db: PrismaClient = prisma,
): Promise<boolean> {
  if (actor.appRole === 'user' || actor.id === targetId) return false;
  const target = await db.user.findUnique({
    where: { id: targetId },
    select: { appRole: true, status: true, ownerAdminId: true, cohortId: true },
  });
  if (!target || target.appRole !== 'USER' || target.status === 'ARCHIVED') return false;
  if (actor.appRole === 'super_admin') return true;
  if (target.ownerAdminId === actor.id) return true;
  const cohortIds = [
    ...(target.cohortId ? [target.cohortId] : []),
    ...(
      await db.classroomMember.findMany({
        where: { userId: targetId },
        select: { classroomId: true },
      })
    ).map((m) => m.classroomId),
  ];
  if (cohortIds.length === 0) return false;
  const owned = await db.classroom.count({
    where: { id: { in: cohortIds }, ownerAdminId: actor.id },
  });
  if (owned > 0) return true;
  return (
    (await db.classroomMember.count({
      where: { classroomId: { in: cohortIds }, userId: actor.id, appRole: 'ADMIN' },
    })) > 0
  );
}
