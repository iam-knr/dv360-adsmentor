import 'server-only';
import type { Prisma } from '@prisma/client';
import type { AppRole } from '@prisma/client';

// AuditLog rows for account actions (module 19 4.11). The payload has an allow-list of keys and never carries a
// password, hash, token or session secret, whatever the caller passes.
export type AuditAction =
  | 'ACCOUNT_CREATED'
  | 'ACCOUNT_UPDATED'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_UNLOCKED'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET'
  | 'SESSIONS_REVOKED'
  | 'AUTHZ_DENIED';

export const AUDIT_PAYLOAD_KEYS = [
  'oldRole',
  'newRole',
  'oldStatus',
  'newStatus',
  'cohortId',
  'cohortName',
  'count',
  'reason',
  'forced',
  'until',
] as const;

export interface AuditInput {
  actorUserId?: string | null;
  actorRole?: AppRole | null;
  classroomId?: string | null;
  action: AuditAction;
  targetType: string;
  targetId?: string | null;
  targetUserId?: string | null;
  result?: 'OK' | 'DENIED';
  requestId?: string | null;
  payload?: Record<string, unknown>;
}

export function sanitizeAuditPayload(
  payload: Record<string, unknown> | undefined,
): Prisma.InputJsonObject {
  const out: Record<string, string | number | boolean | null> = {};
  for (const key of AUDIT_PAYLOAD_KEYS) {
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

export async function writeAudit(db: AuditDb, input: AuditInput): Promise<void> {
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
      requestId: input.requestId ?? null,
      payload: sanitizeAuditPayload(input.payload),
    },
  });
}
