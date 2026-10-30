import 'server-only';
import type { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Actor } from '@/lib/accounts/permissions';
import { scopedCohorts } from '@/lib/accounts/scope';
import { prisma } from '@/lib/db';
import { InstructorError } from './rules';
import type { Db } from './scope';

// Super admin pages (module 18 A3, A5, A6). A Super admin only: the pages check, and so does every function here.
function assertSuper(actor: Actor): void {
  if (actor.role !== 'SUPER_ADMIN') throw new InstructorError('FORBIDDEN');
}

export async function listAllClasses(actor: Actor, db: Db = prisma) {
  assertSuper(actor);
  const rows = await scopedCohorts(db, actor).findMany({
    orderBy: [{ archivedAt: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      timeZone: true,
      capacity: true,
      archivedAt: true,
      ownerAdmin: { select: { id: true, name: true } },
      _count: {
        select: {
          users: { where: { status: { in: ['ACTIVE', 'DISABLED', 'LOCKED'] }, appRole: 'USER' } },
          sandboxes: true,
        },
      },
    },
  });
  return rows as unknown as {
    id: string;
    name: string;
    timeZone: string;
    capacity: number;
    archivedAt: Date | null;
    ownerAdmin: { id: string; name: string };
    _count: { users: number; sandboxes: number };
  }[];
}

export interface AuditQuery {
  actorUserId?: string;
  classroomId?: string;
  action?: string;
  from?: Date;
  to?: Date;
  page?: number;
}

export const AUDIT_PAGE = 50;

export async function queryAudit(actor: Actor, q: AuditQuery, db: Db = prisma) {
  assertSuper(actor);
  const where: Prisma.AuditLogWhereInput = {
    ...(q.actorUserId ? { actorUserId: q.actorUserId } : {}),
    ...(q.classroomId ? { classroomId: q.classroomId } : {}),
    ...(q.action ? { action: q.action } : {}),
    ...(q.from || q.to
      ? { createdAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lt: q.to } : {}) } }
      : {}),
  };
  const page = Math.max(1, q.page ?? 1);
  const [rows, total, actions] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * AUDIT_PAGE,
      take: AUDIT_PAGE,
      select: {
        id: true,
        createdAt: true,
        action: true,
        result: true,
        actorUserId: true,
        actorRole: true,
        classroomId: true,
        targetType: true,
        targetId: true,
        payload: true,
      },
    }),
    db.auditLog.count({ where }),
    db.auditLog.findMany({ distinct: ['action'], select: { action: true }, orderBy: { action: 'asc' } }),
  ]);
  return { rows, total, actions: actions.map((a) => a.action), page };
}

/** Engine parameters, read only: the version is the content hash (engine.md 2.7). Editing is not in v1. */
export function readEngineParams(): { hash: string; bytes: number; top: [string, unknown][] } {
  const raw = readFileSync(join(process.cwd(), 'engine', 'params.json'), 'utf8');
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return {
    hash: createHash('sha256').update(raw).digest('hex').slice(0, 12),
    bytes: raw.length,
    top: Object.entries(parsed).map(([k, v]) => [k, v]),
  };
}
