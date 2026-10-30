import 'server-only';
import type { PrismaClient } from '@prisma/client';

// What the sandbox provisioning job (lib/sandbox/provision.ts) reads from the account tables. They live here because
// User and Classroom rows are read only through lib/accounts (module 19 3.4).

type Db = PrismaClient;

export interface ProvisionSource {
  appRole: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  studentCode: string | null;
  defaultSeedTemplate: string;
  classroomArchived: boolean;
}

/** The student and cohort a sandbox is built for, or null when either is missing. */
export async function getProvisionSource(
  db: Db,
  cohortId: string,
  userId: string,
): Promise<ProvisionSource | null> {
  const [user, classroom] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { appRole: true, studentCode: true } }),
    db.classroom.findUnique({
      where: { id: cohortId },
      select: { defaultSeedTemplate: true, archivedAt: true },
    }),
  ]);
  if (!user || !classroom) return null;
  return {
    appRole: user.appRole,
    studentCode: user.studentCode,
    defaultSeedTemplate: classroom.defaultSeedTemplate,
    classroomArchived: classroom.archivedAt !== null,
  };
}

/** Active students in a cohort who have no sandbox yet (accounts older than the job, or whose enqueue failed). */
export async function findStudentsWithoutSandbox(
  db: Db,
  limit: number,
  cohortId?: string,
): Promise<{ id: string; cohortId: string }[]> {
  const rows = await db.user.findMany({
    where: {
      appRole: 'USER',
      status: 'ACTIVE',
      cohortId: cohortId ?? { not: null },
      sandboxes: { none: {} },
    },
    select: { id: true, cohortId: true },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
  return rows.flatMap((r) => (r.cohortId ? [{ id: r.id, cohortId: r.cohortId }] : []));
}
