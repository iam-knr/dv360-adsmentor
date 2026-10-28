import 'server-only';
import type { Prisma } from '@prisma/client';
import { ACC_024 } from './messages';

export class LastSuperAdminError extends Error {
  readonly code = 'ACC-024';
  constructor() {
    super(ACC_024);
    this.name = 'LastSuperAdminError';
  }
}

/**
 * Refuse a change that would leave no ACTIVE Super admin (ACC-024, T11). Call it inside the transaction that
 * disables, archives or demotes `userId`. The Super admin rows are locked with FOR UPDATE, so two concurrent
 * changes cannot both pass.
 */
export async function assertNotLastActiveSuperAdmin(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "User" WHERE "appRole" = 'SUPER_ADMIN' AND "status" = 'ACTIVE' FOR UPDATE`;
  // Changing someone who is not an active Super admin cannot lower the count.
  if (!rows.some((r) => r.id === userId)) return;
  if (rows.length === 1) throw new LastSuperAdminError();
}
