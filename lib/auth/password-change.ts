import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';
import { writeAudit } from './audit';
import { clearExpiredLock, registerUserFailure } from './lockout';
import { ACC_013, ACC_014, ACC_015, simLocked } from './messages';
import { checkPassword, hashPassword, verifyPassword } from './password';
import { getAccountPolicy } from './policy';

export type ChangePasswordResult =
  | { ok: true; email: string }
  | {
      ok: false;
      code:
        | 'ACC-010'
        | 'ACC-011'
        | 'ACC-012'
        | 'ACC-013'
        | 'ACC-014'
        | 'ACC-015'
        | 'LOCKED'
        | 'NOT_FOUND';
      message: string;
    };

export interface ChangePasswordInput {
  userId: string;
  /** Omitted when the sign in forced the change (mustChangePassword). */
  current?: string;
  next: string;
  confirm: string;
  /** The person signed in, when an admin acts through view-as; only used for the audit row. */
  actorUserId?: string;
}

/**
 * Change the signed in person's own password (module 19 2.10, M18-AC3). On success `sessionVersion` goes up, so
 * every existing session stops working; the caller signs the person in again to issue a fresh one.
 * A wrong current password counts toward the lockout (ACC-015).
 */
export async function changePassword(
  input: ChangePasswordInput,
  deps: { db?: PrismaClient; now?: Date } = {},
): Promise<ChangePasswordResult> {
  const db = deps.db ?? prisma;
  const now = deps.now ?? new Date();
  const found = await db.user.findUnique({ where: { id: input.userId } });
  if (!found || !found.passwordHash || found.status === 'ARCHIVED' || found.status === 'DISABLED') {
    return { ok: false, code: 'NOT_FOUND', message: 'Account not found.' };
  }
  const user = await clearExpiredLock(db, found, now);
  if (!user.passwordHash) return { ok: false, code: 'NOT_FOUND', message: 'Account not found.' };
  const policy = await getAccountPolicy(db);

  if (user.lockedUntil && user.lockedUntil > now) {
    const minutes = (user.lockedUntil.getTime() - now.getTime()) / 60_000;
    return { ok: false, code: 'LOCKED', message: simLocked(minutes) };
  }

  if (!user.mustChangePassword) {
    const given = input.current ?? '';
    if (!(await verifyPassword(user.passwordHash, given))) {
      const lockedUntil = await registerUserFailure(db, user, policy, now);
      if (lockedUntil) {
        return { ok: false, code: 'LOCKED', message: simLocked(policy.lockoutMinutes) };
      }
      return { ok: false, code: 'ACC-015', message: ACC_015 };
    }
  }

  const check = checkPassword(input.next, {
    email: user.email,
    minLength: policy.minPasswordLength,
  });
  const first = check.issues[0];
  if (first) return { ok: false, code: first.code, message: first.message };
  if (input.next !== input.confirm) return { ok: false, code: 'ACC-013', message: ACC_013 };
  if (await verifyPassword(user.passwordHash, input.next)) {
    return { ok: false, code: 'ACC-014', message: ACC_014 };
  }

  const passwordHash = await hashPassword(input.next);
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        passwordChangedAt: now,
        sessionVersion: { increment: 1 },
        activeSessionId: null,
        failedLoginCount: 0,
        lockedUntil: null,
        ...(user.status === 'LOCKED' ? { status: 'ACTIVE' as const } : {}),
      },
    });
    await writeAudit(tx, {
      actorUserId: input.actorUserId ?? user.id,
      actorRole: user.appRole,
      action: 'PASSWORD_CHANGED',
      targetType: 'User',
      targetId: user.id,
      targetUserId: user.id,
      classroomId: user.cohortId,
      payload: { forced: user.mustChangePassword },
    });
  });
  return { ok: true, email: user.email };
}
