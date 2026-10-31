import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';
import { resolveClassContext, type ClassContext } from '@/lib/access/class-context';
import { defaultDvRole, isRetiredRole, toSessionRole } from './roles';
import { getAccountPolicy } from './policy';
import { evaluateSession, type SessionClaimsIn } from './session-check';
import type { DvRole, SessionFailureReason, SessionUser } from './types';
import { canViewAs, type ViewAsRequest } from './view-as';

export type ResolvedSession =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: SessionFailureReason };

/** lastSeenAt is rewritten at most this often (module 19 4.5). */
export const TOUCH_INTERVAL_MS = 5 * 60_000;

export interface ResolveInput {
  userId: string;
  claims: SessionClaimsIn;
  now: Date;
  viewAs?: ViewAsRequest | null;
}

type UserRow = NonNullable<Awaited<ReturnType<PrismaClient['user']['findUnique']>>>;

async function dvRoleFor(db: PrismaClient, user: UserRow, ctx: ClassContext): Promise<DvRole> {
  const base = defaultDvRole(toSessionRole(user.appRole));
  if (user.appRole !== 'USER' || !ctx.sandboxId) return base;
  // A scenario can override the level on the sandbox partner (RC-047); advertiser level grants are read by the
  // module services, not here.
  const grant = await db.userAccessGrant.findFirst({
    where: {
      userId: user.id,
      sandboxId: ctx.sandboxId,
      advertiserId: null,
      ...(ctx.partnerId ? { partnerId: ctx.partnerId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: { role: true },
  });
  return grant?.role ?? base;
}

function build(user: UserRow, ctx: ClassContext, dvRole: DvRole): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    appRole: toSessionRole(user.appRole),
    classroomId: ctx.classroomId ?? undefined,
    sandboxId: ctx.sandboxId,
    partnerId: ctx.partnerId,
    dvRole,
    mustChangePassword: user.mustChangePassword,
    screenshotsAllowed: user.screenshotsAllowed,
    timeZone: ctx.timeZone,
  };
}

/**
 * The authoritative check behind `requireUser()` (module 19 4.5): user exists and is not disabled or archived,
 * sessionVersion matches, single session sid matches, absolute and idle limits hold. Then class, sandbox and
 * view-as are resolved.
 */
export async function resolveSessionUser(
  input: ResolveInput,
  db: PrismaClient = prisma,
): Promise<ResolvedSession> {
  const { userId, claims, now } = input;
  const row = await db.user.findUnique({ where: { id: userId } });
  // The retired ADMIN level has no session: an old cookie of one is refused like a revoked one (ADM-FIX).
  if (row && isRetiredRole(row.appRole)) return { ok: false, reason: 'revoked' };
  const policy = await getAccountPolicy(db);
  const reason = evaluateSession(
    claims,
    row && {
      appRole: toSessionRole(row.appRole),
      status: row.status,
      sessionVersion: row.sessionVersion,
      activeSessionId: row.activeSessionId,
      lastSeenAt: row.lastSeenAt,
      accessSuspendedAt: row.accessSuspendedAt,
    },
    policy,
    now,
  );
  if (reason || !row) return { ok: false, reason: reason ?? 'revoked' };

  if (!row.lastSeenAt || now.getTime() - row.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.user.update({ where: { id: row.id }, data: { lastSeenAt: now } });
  }

  const appRole = toSessionRole(row.appRole);
  const actor = { id: row.id, email: row.email, name: row.name, appRole };

  if (input.viewAs && (await canViewAs({ id: row.id, appRole }, input.viewAs.userId, db))) {
    const target = await db.user.findUnique({ where: { id: input.viewAs.userId } });
    if (target) {
      const ctx = await resolveClassContext(target.id, db);
      return {
        ok: true,
        user: {
          ...build(target, ctx, await dvRoleFor(db, target, ctx)),
          mustChangePassword: row.mustChangePassword,
          viewAs: { userId: target.id, actAs: input.viewAs.actAs },
          actor,
        },
      };
    }
  }

  const ctx = await resolveClassContext(row.id, db);
  return { ok: true, user: { ...build(row, ctx, await dvRoleFor(db, row, ctx)), actor } };
}
