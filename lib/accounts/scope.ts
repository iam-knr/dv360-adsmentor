import 'server-only';
import type { Prisma } from '@prisma/client';
import type { Actor } from './permissions';

/**
 * Row scope of module 19 3.4. Pure builders return a Prisma `where`; the only callers of `db.user` / `db.classroom`
 * outside lib/auth are in this folder (ESLint). USER gets nothing: the builders throw.
 */
export class ScopeError extends Error {
  constructor() {
    super('FORBIDDEN');
    this.name = 'ScopeError';
  }
}

export function userScopeWhere(actor: Actor): Prisma.UserWhereInput {
  if (actor.role === 'SUPER_ADMIN') return {};
  if (actor.role === 'ADMIN') {
    return {
      OR: [
        { id: actor.id },
        {
          appRole: 'USER',
          OR: [
            { ownerAdminId: actor.id },
            { cohort: { ownerAdminId: actor.id } },
            { cohort: { members: { some: { userId: actor.id, appRole: 'ADMIN' } } } },
          ],
        },
      ],
    };
  }
  throw new ScopeError();
}

export function cohortScopeWhere(actor: Actor): Prisma.ClassroomWhereInput {
  if (actor.role === 'SUPER_ADMIN') return {};
  if (actor.role === 'ADMIN') {
    return {
      OR: [
        { ownerAdminId: actor.id },
        { members: { some: { userId: actor.id, appRole: 'ADMIN' } } },
      ],
    };
  }
  throw new ScopeError();
}

type ScopeDb = {
  user: { findFirst: (a: Prisma.UserFindFirstArgs) => Promise<unknown> };
  classroom: { findFirst: (a: Prisma.ClassroomFindFirstArgs) => Promise<unknown> };
};

/** One user inside the actor's scope, or null (a missing id and an out-of-scope id look the same, ACC-022). */
export function scopedUsers(db: Pick<Prisma.TransactionClient, 'user'>, actor: Actor) {
  const where = userScopeWhere(actor);
  return {
    where,
    findMany: (args: Prisma.UserFindManyArgs = {}) =>
      db.user.findMany({ ...args, where: { AND: [where, args.where ?? {}] } }),
    count: (where2: Prisma.UserWhereInput = {}) =>
      db.user.count({ where: { AND: [where, where2] } }),
    findById: (id: string) =>
      db.user.findFirst({
        where: { AND: [where, { id }] },
        select: {
          id: true,
          email: true,
          name: true,
          appRole: true,
          status: true,
          cohortId: true,
          ownerAdminId: true,
          lockedUntil: true,
          cohort: { select: { ownerAdminId: true, name: true } },
        },
      }),
  };
}

export function scopedCohorts(db: Pick<Prisma.TransactionClient, 'classroom'>, actor: Actor) {
  const where = cohortScopeWhere(actor);
  return {
    where,
    findMany: (args: Prisma.ClassroomFindManyArgs = {}) =>
      db.classroom.findMany({ ...args, where: { AND: [where, args.where ?? {}] } }),
    findById: (id: string) => db.classroom.findFirst({ where: { AND: [where, { id }] } }),
  };
}

export type { ScopeDb };
