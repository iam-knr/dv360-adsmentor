import 'server-only';
import type { Classroom, PrismaClient } from '@prisma/client';
import type { Actor } from '@/lib/accounts/permissions';
import { scopedCohorts } from '@/lib/accounts/scope';
import { InstructorError } from './rules';

export type Db = PrismaClient;

/**
 * One class the actor teaches (owner, or Admin member of it); a Super admin reaches every class. A missing id and
 * a class of someone else look the same (SIM-020), so an id cannot be probed. Archived classes are not returned.
 */
export async function loadClass(db: Db, actor: Actor, classId: string): Promise<Classroom> {
  const row = (await scopedCohorts(db, actor).findById(classId)) as Classroom | null;
  if (!row || row.archivedAt) throw new InstructorError('SIM-020');
  return row;
}

export async function myClasses(db: Db, actor: Actor): Promise<ClassSummary[]> {
  const rows = await scopedCohorts(db, actor).findMany({
    where: { archivedAt: null },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      code: true,
      timeZone: true,
      capacity: true,
      defaultSeedTemplate: true,
      ownerAdmin: { select: { id: true, name: true } },
      _count: {
        select: {
          users: { where: { status: { in: ['ACTIVE', 'DISABLED', 'LOCKED'] }, appRole: 'USER' } },
        },
      },
    },
  });
  return rows as unknown as ClassSummary[];
}

export interface ClassSummary {
  id: string;
  name: string;
  code: string;
  timeZone: string;
  capacity: number;
  defaultSeedTemplate: string;
  ownerAdmin: { id: string; name: string };
  _count: { users: number };
}
