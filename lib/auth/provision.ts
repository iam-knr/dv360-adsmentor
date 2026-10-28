import 'server-only';
import type { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { writeAudit } from './audit';
import { checkPassword, generatePassword, hashPassword } from './password';
import { getAccountPolicy } from './policy';

export class ProvisionError extends Error {
  constructor(
    readonly code:
      'ACC-001' | 'ACC-002' | 'ACC-003' | 'ACC-010' | 'ACC-011' | 'ACC-012' | 'ACC-031' | 'ACC-032',
    message: string,
  ) {
    super(message);
    this.name = 'ProvisionError';
  }
}

const inputSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().min(1).max(100),
});

export interface ProvisionStudentInput {
  email: string;
  name: string;
  /** A password the creator typed. Leave out to generate one (returned once, never stored in plaintext). */
  password?: string;
  mustChangePassword?: boolean;
  ownerAdminId?: string;
  createdById?: string;
  accessStartsAt?: Date | null;
  accessEndsAt?: Date | null;
}

export interface ProvisionedStudent {
  user: { id: string; email: string; name: string };
  /** Present only when the password was generated. The caller shows it once and drops it. */
  password?: string;
}

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Create a USER account in a classroom (cohort): the account, the membership and a password.
 * Callers: the /manage dashboard (P3-02b) and the roster UI (Phase 5). The sandbox is created by the
 * provisioning job (module 18 4.4), not here.
 */
export async function provisionStudent(
  db: Db,
  classroomId: string,
  input: ProvisionStudentInput,
): Promise<ProvisionedStudent> {
  // Account, membership and audit row succeed or fail together. A caller that already holds a transaction passes
  // it in and keeps control of the commit.
  if ('$transaction' in db) {
    return db.$transaction((tx) => createStudent(tx, classroomId, input), { timeout: 15_000 });
  }
  return createStudent(db, classroomId, input);
}

async function createStudent(
  db: Prisma.TransactionClient,
  classroomId: string,
  input: ProvisionStudentInput,
): Promise<ProvisionedStudent> {
  const parsed = inputSchema.safeParse({ email: input.email, name: input.name });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    if (field === 'name') throw new ProvisionError('ACC-003', 'Enter a value');
    throw new ProvisionError('ACC-001', 'Enter a valid email address.');
  }
  const { email, name } = parsed.data;

  // One provisioning at a time per cohort, so two requests cannot both take the last seat.
  await db.$queryRaw`SELECT "id" FROM "Classroom" WHERE "id" = ${classroomId} FOR UPDATE`;
  const classroom = await db.classroom.findUnique({
    where: { id: classroomId },
    select: { id: true, capacity: true, archivedAt: true, ownerAdminId: true },
  });
  if (!classroom || classroom.archivedAt) throw new ProvisionError('ACC-031', 'Cohort not found.');
  const used = await db.user.count({
    where: {
      cohortId: classroomId,
      appRole: 'USER',
      status: { in: ['ACTIVE', 'DISABLED', 'LOCKED'] },
    },
  });
  if (used >= classroom.capacity) {
    throw new ProvisionError('ACC-032', `This cohort is full (${used} of ${classroom.capacity}).`);
  }
  const existing = await db.user.findUnique({ where: { email }, select: { status: true } });
  if (existing) {
    throw new ProvisionError(
      'ACC-002',
      existing.status === 'ARCHIVED'
        ? 'This email belongs to an archived account. Restore it instead.'
        : 'An account with this email already exists.',
    );
  }

  const policy = await getAccountPolicy(db);
  const generated = input.password === undefined;
  const plaintext = input.password ?? generatePassword();
  if (!generated) {
    const check = checkPassword(plaintext, { email, minLength: policy.minPasswordLength });
    const first = check.issues[0];
    if (first) throw new ProvisionError(first.code, first.message);
  }
  const passwordHash = await hashPassword(plaintext);

  const user = await db.user.create({
    data: {
      email,
      name,
      passwordHash,
      appRole: 'USER',
      mustChangePassword: input.mustChangePassword ?? policy.defaultMustChange,
      passwordChangedAt: new Date(),
      cohortId: classroomId,
      ownerAdminId: input.ownerAdminId ?? classroom.ownerAdminId,
      createdById: input.createdById ?? null,
      accessStartsAt: input.accessStartsAt ?? null,
      accessEndsAt: input.accessEndsAt ?? null,
    },
    select: { id: true, email: true, name: true },
  });
  await db.classroomMember.create({ data: { classroomId, userId: user.id, appRole: 'USER' } });
  await writeAudit(db, {
    actorUserId: input.createdById ?? null,
    action: 'ACCOUNT_CREATED',
    targetType: 'User',
    targetId: user.id,
    targetUserId: user.id,
    classroomId,
    payload: { newRole: 'USER', cohortId: classroomId },
  });
  return generated ? { user, password: plaintext } : { user };
}
