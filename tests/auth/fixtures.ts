// Fixtures for the auth tests (vitest db project and Playwright). Everything is synthetic: @example.test
// addresses and passwords generated per run. Nothing here is committed with a real secret.
import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { generatePassword, hashPassword } from '@/lib/auth/argon';

let counter = 0;
export const uniq = (tag: string) =>
  `${tag}-${randomBytes(3).toString('hex')}-${(counter++).toString(36)}`;

export async function createAccount(
  db: PrismaClient,
  opts: {
    tag: string;
    role?: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
    password?: string;
    mustChangePassword?: boolean;
    status?: 'ACTIVE' | 'DISABLED' | 'LOCKED' | 'ARCHIVED';
    cohortId?: string | null;
    ownerAdminId?: string | null;
    accessStartsAt?: Date | null;
    accessEndsAt?: Date | null;
    name?: string;
  },
) {
  const password = opts.password ?? generatePassword();
  const t = uniq(opts.tag);
  const user = await db.user.create({
    data: {
      email: `${t}@example.test`,
      name: opts.name ?? `Test ${t}`,
      passwordHash: await hashPassword(password),
      appRole: opts.role ?? 'USER',
      status: opts.status ?? 'ACTIVE',
      mustChangePassword: opts.mustChangePassword ?? false,
      cohortId: opts.cohortId ?? null,
      ownerAdminId: opts.ownerAdminId ?? null,
      accessStartsAt: opts.accessStartsAt ?? null,
      accessEndsAt: opts.accessEndsAt ?? null,
    },
  });
  return { user, password };
}

export type WindowKind = 'open' | 'closed' | 'none' | 'closing-soon';

export async function createClassroom(
  db: PrismaClient,
  opts: {
    tag: string;
    ownerAdminId: string;
    windows?: WindowKind;
    timeZone?: string;
    capacity?: number;
    now?: Date;
  },
) {
  const now = opts.now ?? new Date();
  const t = uniq(opts.tag);
  const classroom = await db.classroom.create({
    data: {
      name: `Cohort ${t}`,
      code: `code-${t}`,
      ownerAdminId: opts.ownerAdminId,
      timeZone: opts.timeZone ?? 'Asia/Kolkata',
      capacity: opts.capacity ?? 25,
    },
  });
  const min = 60_000;
  const kind = opts.windows ?? 'open';
  if (kind === 'open') {
    await db.accessWindow.create({
      data: {
        classroomId: classroom.id,
        label: 'Open now',
        opensAt: new Date(now.getTime() - 30 * min),
        closesAt: new Date(now.getTime() + 90 * min),
        status: 'OPEN',
      },
    });
  } else if (kind === 'closing-soon') {
    await db.accessWindow.create({
      data: {
        classroomId: classroom.id,
        label: 'Ending',
        opensAt: new Date(now.getTime() - 60 * min),
        closesAt: new Date(now.getTime() + 3 * min),
        status: 'OPEN',
      },
    });
  } else if (kind === 'closed') {
    await db.accessWindow.create({
      data: {
        classroomId: classroom.id,
        label: 'Next class',
        opensAt: new Date(now.getTime() + 26 * 60 * min),
        closesAt: new Date(now.getTime() + 28 * 60 * min),
        status: 'SCHEDULED',
      },
    });
  }
  return classroom;
}

/** A student with membership, sandbox and clock, like the provisioning job will make. */
export async function createStudent(
  db: PrismaClient,
  opts: Parameters<typeof createAccount>[1] & {
    classroomId: string;
    clockState?: 'RUNNING' | 'PAUSED';
  },
) {
  const { user, password } = await createAccount(db, {
    ...opts,
    role: 'USER',
    cohortId: opts.classroomId,
  });
  await db.classroomMember.create({ data: { classroomId: opts.classroomId, userId: user.id } });
  const sandbox = await db.sandbox.create({
    data: {
      classroomId: opts.classroomId,
      ownerUserId: user.id,
      name: `Sandbox ${user.id}`,
      seedValue: 1,
      kind: 'STUDENT',
      provisionState: 'READY',
    },
  });
  await db.simClock.create({
    data: {
      sandboxId: sandbox.id,
      simStart: new Date('2026-01-01T00:00:00Z'),
      tickIndex: 48n,
      state: opts.clockState ?? 'RUNNING',
      marketSeed: 'm',
      sandboxSeed: 's',
      lastAdvanceRealAt: new Date(),
    },
  });
  return { user, password, sandbox };
}

export async function cleanup(
  db: PrismaClient,
  ids: { classroomIds?: string[]; userIds?: string[] },
) {
  const classroomIds = ids.classroomIds ?? [];
  const userIds = ids.userIds ?? [];
  await db.sandbox.deleteMany({ where: { classroomId: { in: classroomIds } } });
  await db.classroom.deleteMany({ where: { id: { in: classroomIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.auditLog.deleteMany({
    where: { OR: [{ targetUserId: { in: userIds } }, { actorUserId: { in: userIds } }] },
  });
}
