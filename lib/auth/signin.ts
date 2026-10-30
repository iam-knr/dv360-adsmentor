import 'server-only';
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';
import { clearExpiredLock, registerUserFailure } from './lockout';
import { acc071, acc072, ACC_070, SIM_001, simLocked } from './messages';
import { needsRehash, hashPassword, verifyDummy, verifyPassword } from './password';
import { getAccountPolicy } from './policy';
import { toSessionRole } from './roles';
import {
  IP_FAILURE_LIMIT,
  IP_WINDOW_MS,
  lockRemainingMs,
  recordFailure,
  throttleKey,
} from './throttle';
import type { AppRole } from './types';

type Db = Pick<PrismaClient, 'user' | 'authThrottle' | 'accountPolicy' | 'auditLog' | 'classroom'>;

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  appRole: AppRole;
  sessionVersion: number;
  sid: string;
  mustChangePassword: boolean;
}

export type SignInFailure =
  | { ok: false; code: 'invalid' }
  | { ok: false; code: 'locked'; minutes: number }
  | { ok: false; code: 'disabled' }
  | { ok: false; code: 'not_started'; at: Date; timeZone?: string }
  | { ok: false; code: 'ended'; at: Date; timeZone?: string };

export type SignInResult = { ok: true; user: AuthenticatedUser } | SignInFailure;

export function signInMessage(failure: SignInFailure): string {
  switch (failure.code) {
    case 'invalid':
      return SIM_001;
    case 'locked':
      return simLocked(failure.minutes);
    case 'disabled':
      return ACC_070;
    case 'not_started':
      return acc071(failure.at, failure.timeZone);
    case 'ended':
      return acc072(failure.at, failure.timeZone);
  }
}

export interface SignInInput {
  email: unknown;
  password: unknown;
  /** Client address for the per IP failure limit; skipped when unknown. */
  ip?: string | null;
}

const MAX_EMAIL = 254;
const MAX_PASSWORD = 1024;

const locked = (ms: number): SignInFailure => ({
  ok: false,
  code: 'locked',
  minutes: Math.ceil(ms / 60_000),
});

/**
 * The one sign in routine (module 18 4.1, module 19 4.5). Unknown, archived and password-less accounts take the
 * same path as a wrong password: one dummy hash verify, one counted failure, the same message (T3, T18).
 * A specific message (disabled, access period) is only returned after the right password.
 */
export async function authenticate(
  input: SignInInput,
  deps: { db?: Db; now?: Date } = {},
): Promise<SignInResult> {
  const db = deps.db ?? prisma;
  const now = deps.now ?? new Date();
  const email = (typeof input.email === 'string' ? input.email : '')
    .trim()
    .toLowerCase()
    .slice(0, MAX_EMAIL + 1);
  const password = typeof input.password === 'string' ? input.password : '';
  const policy = await getAccountPolicy(db);
  const lockMs = policy.lockoutMinutes * 60_000;
  const ipKey = input.ip ? throttleKey('ip', input.ip) : null;
  const emailKey = throttleKey('email', email);

  if (ipKey) {
    const ms = await lockRemainingMs(db, ipKey, now);
    if (ms > 0) return locked(ms);
  }

  const found =
    email.length > 0 && email.length <= MAX_EMAIL
      ? await db.user.findUnique({ where: { email } })
      : null;
  // The retired ADMIN level cannot sign in: it answers like an unknown account (ADM-FIX).
  let user =
    found && found.status !== 'ARCHIVED' && found.passwordHash && found.appRole !== 'ADMIN'
      ? found
      : null;

  if (user) {
    if (user.lockedUntil && user.lockedUntil > now)
      return locked(user.lockedUntil.getTime() - now.getTime());
    user = await clearExpiredLock(db, user, now); // a lock that ran out starts a fresh count
  } else {
    const ms = await lockRemainingMs(db, emailKey, now);
    if (ms > 0) return locked(ms);
  }

  const submitted = password.slice(0, MAX_PASSWORD);
  const correct =
    password.length <= MAX_PASSWORD &&
    (user && user.passwordHash
      ? await verifyPassword(user.passwordHash, submitted)
      : await verifyDummy(submitted));

  if (!correct) {
    let lockedUntil: Date | null = null;
    if (user) {
      lockedUntil = await registerUserFailure(db, user, policy, now);
    } else {
      lockedUntil = await recordFailure(
        db,
        emailKey,
        { limit: policy.lockoutThreshold, lockMs },
        now,
      );
    }
    if (ipKey) {
      const ipLock = await recordFailure(
        db,
        ipKey,
        { limit: IP_FAILURE_LIMIT, lockMs: IP_WINDOW_MS, windowMs: IP_WINDOW_MS },
        now,
      );
      if (!lockedUntil && ipLock) lockedUntil = ipLock;
    }
    return lockedUntil
      ? locked(lockedUntil.getTime() - now.getTime())
      : { ok: false, code: 'invalid' };
  }

  // Right password from here on: the person has proven they own the account, so messages may be specific.
  const account = user as NonNullable<typeof user>;
  const reset =
    account.failedLoginCount > 0 || account.lockedUntil
      ? { failedLoginCount: 0, lockedUntil: null }
      : {};

  if (account.status === 'DISABLED') {
    if (Object.keys(reset).length) await db.user.update({ where: { id: account.id }, data: reset });
    return { ok: false, code: 'disabled' };
  }
  const sid = randomUUID();
  const rehash =
    account.passwordHash && needsRehash(account.passwordHash) ? await hashPassword(password) : null;
  await db.user.update({
    where: { id: account.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: now,
      lastSeenAt: now,
      activeSessionId: sid,
      ...(rehash ? { passwordHash: rehash } : {}),
    },
  });

  return {
    ok: true,
    user: {
      id: account.id,
      email: account.email,
      name: account.name,
      appRole: toSessionRole(account.appRole),
      sessionVersion: account.sessionVersion,
      sid,
      mustChangePassword: account.mustChangePassword,
    },
  };
}
