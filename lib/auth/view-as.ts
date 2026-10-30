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

/** May this person look at the simulator as `targetId`? Only a Super admin, and only at a student. */
export async function canViewAs(
  actor: { id: string; appRole: AppRole },
  targetId: string,
  db: PrismaClient = prisma,
): Promise<boolean> {
  if (actor.appRole !== 'super_admin' || actor.id === targetId) return false;
  const target = await db.user.findUnique({
    where: { id: targetId },
    select: { appRole: true, status: true },
  });
  return !!target && target.appRole === 'USER' && target.status !== 'ARCHIVED';
}
