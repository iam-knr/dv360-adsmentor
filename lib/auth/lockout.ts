import 'server-only';
import type { PrismaClient, User } from '@prisma/client';
import { writeAudit } from './audit';
import type { PolicyValues } from './policy';
import { clearThrottle, throttleKey } from './throttle';

type Db = Pick<PrismaClient, 'user' | 'authThrottle' | 'auditLog'>;

/**
 * Count one failed password for a real account (sign in, or a wrong current password on the change form).
 * At the threshold the account is locked (ACTIVE becomes LOCKED; DISABLED stays DISABLED) and ACCOUNT_LOCKED is
 * audited. Returns the lock end when this failure locked the account.
 */
export async function registerUserFailure(
  db: Db,
  user: Pick<User, 'id' | 'status' | 'cohortId'>,
  policy: Pick<PolicyValues, 'lockoutThreshold' | 'lockoutMinutes'>,
  now: Date,
): Promise<Date | null> {
  const { failedLoginCount } = await db.user.update({
    where: { id: user.id },
    data: { failedLoginCount: { increment: 1 } },
    select: { failedLoginCount: true },
  });
  if (failedLoginCount < policy.lockoutThreshold) return null;
  const lockedUntil = new Date(now.getTime() + policy.lockoutMinutes * 60_000);
  await db.user.update({
    where: { id: user.id },
    data: { lockedUntil, ...(user.status === 'ACTIVE' ? { status: 'LOCKED' as const } : {}) },
  });
  await writeAudit(db, {
    action: 'ACCOUNT_LOCKED',
    targetType: 'User',
    targetId: user.id,
    targetUserId: user.id,
    classroomId: user.cohortId,
    payload: { until: lockedUntil },
  });
  return lockedUntil;
}

/**
 * A lock that has run out starts a fresh count (LOCKED goes back to ACTIVE, module 19 4.3). Returns the user as it
 * is afterwards. Sign in and the change password form both call it before they count another failure.
 */
export async function clearExpiredLock<U extends Pick<User, 'id' | 'status' | 'lockedUntil'>>(
  db: Pick<PrismaClient, 'user'>,
  user: U,
  now: Date,
): Promise<U> {
  if (!user.lockedUntil || user.lockedUntil > now) return user;
  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      ...(user.status === 'LOCKED' ? { status: 'ACTIVE' as const } : {}),
    },
  });
  return { ...user, ...updated };
}

/**
 * Clear a lock and the failure counter: the Unlock action and Reset password both call this (module 19 4.3).
 * LOCKED goes back to ACTIVE; DISABLED and ARCHIVED stay as they are.
 */
export async function clearLockout(db: Db, userId: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, status: true },
  });
  if (!user) return;
  await db.user.update({
    where: { id: userId },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      ...(user.status === 'LOCKED' ? { status: 'ACTIVE' as const } : {}),
    },
  });
  await clearThrottle(db, throttleKey('email', user.email));
}
