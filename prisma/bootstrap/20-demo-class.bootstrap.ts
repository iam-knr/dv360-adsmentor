// Demo cohort for local work and CI (build-plan P3-05b item 5): cohort "Demo cohort" owned by the Super admin, three
// student accounts and a sandbox per student built from `starter-agency`. There are no class windows (ADM-FIX).
// Idempotent. Skipped when NODE_ENV=production (or on Vercel) unless SEED_DEMO=1. Passwords come from SEED_STUDENT_PASSWORD;
// without it a random value is printed once to the terminal of a non-production run and never to production logs (module 19 4.4).
import { randomBytes } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import type { PrismaClient } from '@prisma/client';
import { shouldBootstrapDemoClass, isProductionEnvironment } from '../../lib/seed/guard';
import { seedReferenceData } from '../../lib/seed/reference-db';
import { partnerIdOf, provisionSandbox, seedValueFor } from '../../lib/seed/sandbox';

export const DEMO_CLASS = { name: 'Demo cohort', code: 'DEMO' } as const;
export const DEMO_STUDENTS = [1, 2, 3].map((n) => ({
  email: `student${n}@example.test`,
  name: `Demo Student ${n}`,
  studentCode: `ST-00${n}`,
}));

type Env = Record<string, string | undefined>;

export interface DemoBootstrapResult {
  skipped: boolean;
  classroomId?: string;
  sandboxes?: { studentCode: string; sandboxId: string; built: boolean }[];
  /** Passwords generated in this run (never set in production). */
  generatedPasswords?: Record<string, string>;
}

async function passwordHash(password: string): Promise<string> {
  return hash(password, { memoryCost: 19_456, timeCost: 2, parallelism: 1 });
}

export async function runDemoClass(
  db: PrismaClient,
  env: Env = process.env,
  log: (line: string) => void = console.log,
): Promise<DemoBootstrapResult> {
  if (!shouldBootstrapDemoClass(env)) {
    log('  demo class: skipped (production environment; set SEED_DEMO=1 to build it on purpose)');
    return { skipped: true };
  }
  const production = isProductionEnvironment(env);
  const fixed = env.SEED_STUDENT_PASSWORD;
  if (production && !fixed) {
    throw new Error(
      'SEED_DEMO=1 in production needs SEED_STUDENT_PASSWORD; a random password would have to be printed to production logs.',
    );
  }
  if (fixed && fixed.length < 10)
    throw new Error(
      'SEED_STUDENT_PASSWORD must have at least 10 characters (AccountPolicy.minPasswordLength).',
    );
  const generated: Record<string, string> = {};
  const passwordFor = (email: string) => {
    if (fixed) return fixed;
    const value = randomBytes(9).toString('base64url');
    generated[email] = value;
    return value;
  };

  // Exchanges and the targeting catalogue must exist before a sandbox can reference them.
  await seedReferenceData(db);

  const ensureUser = async (data: {
    email: string;
    name: string;
    appRole: 'USER';
    studentCode?: string;
    cohortId?: string;
    ownerAdminId?: string;
  }) => {
    const existing = await db.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return db.user.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          cohortId: data.cohortId ?? null,
          ownerAdminId: data.ownerAdminId ?? null,
          studentCode: data.studentCode ?? null,
        },
      });
    }
    return db.user.create({
      data: {
        ...data,
        passwordHash: await passwordHash(passwordFor(data.email)),
        status: 'ACTIVE',
        mustChangePassword: production,
        passwordChangedAt: new Date(),
      },
    });
  };

  // The Super admin owns the cohort; the first one is used (db:bootstrap creates it before this step).
  const owner = await db.user.findFirst({
    where: { appRole: 'SUPER_ADMIN', status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!owner) throw new Error('The demo cohort needs a Super admin. Run `npm run db:bootstrap` first.');
  const classroom = await db.classroom.upsert({
    where: { code: DEMO_CLASS.code },
    update: { name: DEMO_CLASS.name, ownerAdminId: owner.id },
    create: {
      name: DEMO_CLASS.name,
      code: DEMO_CLASS.code,
      ownerAdminId: owner.id,
      defaultSeedTemplate: 'starter-agency',
      capacity: 25,
    },
  });

  const sandboxes: NonNullable<DemoBootstrapResult['sandboxes']> = [];
  for (const s of DEMO_STUDENTS) {
    const student = await ensureUser({
      email: s.email,
      name: s.name,
      appRole: 'USER',
      studentCode: s.studentCode,
      cohortId: classroom.id,
      ownerAdminId: owner.id,
    });
    await db.classroomMember.upsert({
      where: { classroomId_userId: { classroomId: classroom.id, userId: student.id } },
      update: {},
      create: { classroomId: classroom.id, userId: student.id, appRole: 'USER' },
    });
    const result = await provisionSandbox(db, {
      classroomId: classroom.id,
      ownerUserId: student.id,
      name: `Sandbox ${s.studentCode}`,
      template: 'starter-agency',
      kind: 'STUDENT',
      seedValue: seedValueFor(`demo:${s.studentCode}`),
      partnerName: `Sandbox ${s.studentCode}`,
    });
    // A student is STANDARD on their own partner (RC-047).
    const partnerId = partnerIdOf(result.sandboxId);
    const grant = await db.userAccessGrant.findFirst({
      where: { userId: student.id, sandboxId: result.sandboxId, partnerId, advertiserId: null },
    });
    if (!grant)
      await db.userAccessGrant.create({
        data: { userId: student.id, sandboxId: result.sandboxId, partnerId, role: 'STANDARD' },
      });
    sandboxes.push({
      studentCode: s.studentCode,
      sandboxId: result.sandboxId,
      built: result.built,
    });
    log(`  ${s.studentCode}: ${result.built ? `built in ${result.ms} ms` : 'up to date'}`);
  }

  if (!production && Object.keys(generated).length > 0) {
    log('  demo class: generated passwords (shown once, store them now):');
    for (const [email, password] of Object.entries(generated)) log(`    ${email}  ${password}`);
  }
  return {
    skipped: false,
    classroomId: classroom.id,
    sandboxes,
    generatedPasswords: production ? undefined : generated,
  };
}

export async function run(): Promise<void> {
  const { prisma } = await import('../../lib/db/client');
  await runDemoClass(prisma);
}
