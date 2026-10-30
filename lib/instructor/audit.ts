import 'server-only';
import type { AppRole, Prisma } from '@prisma/client';

// Audit writer for instructor and admin console actions (module 18 4.9, A6). Same table and the same rule as the
// account writer: payload keys are an allow-list and values must be scalars, so a password can never land here.
export type InstructorAuditAction =
  | 'WINDOW_CREATED'
  | 'WINDOW_UPDATED'
  | 'WINDOW_DELETED'
  | 'CLASS_OPENED'
  | 'CLASS_CLOSED'
  | 'ROSTER_ADDED'
  | 'STUDENT_REMOVED'
  | 'SANDBOX_CREATED'
  | 'SANDBOX_RESET'
  | 'CLASS_RESET'
  | 'ANNOUNCEMENT_CREATED'
  | 'ANNOUNCEMENT_DELETED'
  | 'CERTIFICATE_DECIDED'
  | 'AUTHZ_DENIED';

export const INSTRUCTOR_AUDIT_KEYS = [
  'label',
  'count',
  'scope',
  'opensAt',
  'closesAt',
  'seriesId',
  'until',
  'skipped',
  'decision',
  'kind',
  'resetCount',
  'keepEntities',
  'newMarketSeed',
  'reason',
  'cohortName',
] as const;

export interface InstructorAuditInput {
  actorUserId: string;
  actorRole: AppRole;
  classroomId?: string | null;
  action: InstructorAuditAction;
  targetType: string;
  targetId?: string | null;
  targetUserId?: string | null;
  result?: 'OK' | 'DENIED';
  payload?: Record<string, unknown>;
}

export function pickInstructorPayload(
  payload: Record<string, unknown> | undefined,
): Prisma.InputJsonObject {
  const out: Record<string, string | number | boolean | null> = {};
  for (const key of INSTRUCTOR_AUDIT_KEYS) {
    const v = payload?.[key];
    if (v === undefined) continue;
    if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
      out[key] = typeof v === 'string' ? v.slice(0, 200) : v;
    else if (v instanceof Date) out[key] = v.toISOString();
  }
  return out;
}

type AuditDb = {
  auditLog: { create: (args: { data: Prisma.AuditLogUncheckedCreateInput }) => Promise<unknown> };
};

export async function writeInstructorAudit(
  db: AuditDb,
  input: InstructorAuditInput,
): Promise<void> {
  await db.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      classroomId: input.classroomId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      targetUserId: input.targetUserId ?? null,
      result: input.result ?? 'OK',
      payload: pickInstructorPayload(input.payload),
    },
  });
}
