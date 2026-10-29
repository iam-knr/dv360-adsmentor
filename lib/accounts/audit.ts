import 'server-only';
import type { AppRole, Prisma } from '@prisma/client';

// Account audit writer (module 19 4.11). Payload keys are an allow-list; values must be scalars.
export type AccountAuditAction =
  | 'ACCOUNT_CREATED'
  | 'ACCOUNT_UPDATED'
  | 'ACCOUNT_ROLE_CHANGED'
  | 'ACCOUNT_DISABLED'
  | 'ACCOUNT_ENABLED'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_UNLOCKED'
  | 'ACCOUNT_COHORT_MOVED'
  | 'ACCOUNT_OWNER_TRANSFERRED'
  | 'ACCOUNT_ARCHIVED'
  | 'ACCOUNT_RESTORED'
  | 'ACCOUNT_PURGED'
  | 'ACCOUNTS_IMPORTED'
  | 'PASSWORD_RESET'
  | 'PASSWORD_CHANGED'
  | 'SESSIONS_REVOKED'
  | 'COHORT_CREATED'
  | 'COHORT_UPDATED'
  | 'COHORT_ARCHIVED'
  | 'POLICY_CHANGED'
  | 'AUTHZ_DENIED';

export const ACCOUNT_AUDIT_KEYS = [
  'fromRole',
  'toRole',
  'fromStatus',
  'toStatus',
  'cohortId',
  'fromCohortId',
  'count',
  'fileName',
  'reason',
  'mustChangePassword',
  // keys already written by lib/auth/audit.ts
  'oldRole',
  'newRole',
  'oldStatus',
  'newStatus',
  'cohortName',
  'forced',
  'until',
] as const;

export interface AccountAuditInput {
  actorUserId?: string | null;
  actorRole?: AppRole | null;
  classroomId?: string | null;
  action: AccountAuditAction;
  targetType: string;
  targetId?: string | null;
  targetUserId?: string | null;
  result?: 'OK' | 'DENIED';
  payload?: Record<string, unknown>;
}

export function pickAuditPayload(
  payload: Record<string, unknown> | undefined,
): Prisma.InputJsonObject {
  const out: Record<string, string | number | boolean | null> = {};
  for (const key of ACCOUNT_AUDIT_KEYS) {
    const v = payload?.[key];
    if (v === undefined) continue;
    if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
      out[key] = v;
    else if (v instanceof Date) out[key] = v.toISOString();
  }
  return out;
}

type AuditDb = {
  auditLog: { create: (args: { data: Prisma.AuditLogUncheckedCreateInput }) => Promise<unknown> };
};

export async function writeAccountAudit(db: AuditDb, input: AccountAuditInput): Promise<void> {
  await db.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole ?? null,
      classroomId: input.classroomId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      targetUserId: input.targetUserId ?? null,
      result: input.result ?? 'OK',
      payload: pickAuditPayload(input.payload),
    },
  });
}

/** Retention (module 19 4.11): delete audit rows older than 365 days. Call it from the daily tick. */
export async function purgeOldAudit(
  now: Date,
  db: {
    auditLog: {
      deleteMany: (a: { where: { createdAt: { lt: Date } } }) => Promise<{ count: number }>;
    };
  },
): Promise<number> {
  const cutoff = new Date(now.getTime() - 365 * 24 * 3600_000);
  const { count } = await db.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return count;
}
