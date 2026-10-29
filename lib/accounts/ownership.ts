import 'server-only';
import type { Prisma } from '@prisma/client';

/** Move every User and cohort owned by `fromAdminId` to `toAdminId` in one transaction (module 19 4.1). */
export async function transferOwnership(
  tx: Prisma.TransactionClient,
  fromAdminId: string,
  toAdminId: string,
): Promise<{ users: number; cohorts: number }> {
  const users = await tx.user.updateMany({
    where: { ownerAdminId: fromAdminId },
    data: { ownerAdminId: toAdminId },
  });
  const cohorts = await tx.classroom.updateMany({
    where: { ownerAdminId: fromAdminId },
    data: { ownerAdminId: toAdminId },
  });
  return { users: users.count, cohorts: cohorts.count };
}

/** How many users and cohorts an Admin still owns (ACC-025 / ACC-027). */
export async function ownedCounts(tx: Prisma.TransactionClient, adminId: string) {
  const [users, cohorts] = await Promise.all([
    tx.user.count({ where: { ownerAdminId: adminId, status: { not: 'ARCHIVED' } } }),
    tx.classroom.count({ where: { ownerAdminId: adminId, archivedAt: null } }),
  ]);
  return { users, cohorts };
}
