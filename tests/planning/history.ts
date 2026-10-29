import { prisma } from '@/lib/db';

/** Change groups written for one plan row id (survives the plan being deleted). */
export function getChangeGroupsFor(sandboxId: string, entityId: string) {
  return prisma.changeGroup.findMany({
    where: { sandboxId, entityType: 'PLAN', entityId },
    orderBy: { occurredAt: 'asc' },
  });
}
