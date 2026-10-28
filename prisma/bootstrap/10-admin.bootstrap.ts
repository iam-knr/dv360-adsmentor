// Creates the first Super admin from SEED_SUPER_ADMIN_EMAIL and SEED_SUPER_ADMIN_PASSWORD (RC-071, module 19
// 4.6.4). Runs on every deploy (scripts/vercel-build.sh), so it is idempotent:
//  - a Super admin already exists: nothing happens, whatever the variables say (a leaked or old value cannot
//    reset an existing account, T16);
//  - none exists: one is created with mustChangePassword = true.
// Values come only from the environment (Vercel). Nothing here prints an email, a password or a hash.
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/argon';

const MIN_BOOTSTRAP_PASSWORD = 10;

function strict(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production';
}

export type BootstrapOutcome = 'created' | 'exists' | 'skipped';

/** Exported for tests: `env` is the environment to read, `db` the client to use. */
export async function bootstrapSuperAdmin(
  env: Record<string, string | undefined> = process.env,
  db: typeof prisma = prisma,
): Promise<BootstrapOutcome> {
  const must = strict(env as NodeJS.ProcessEnv);
  const fail = (message: string): never => {
    throw new Error(`bootstrap: ${message}`);
  };

  if ((await db.user.count({ where: { appRole: 'SUPER_ADMIN' } })) > 0) return 'exists';

  const emailRaw = env.SEED_SUPER_ADMIN_EMAIL?.trim();
  const password = env.SEED_SUPER_ADMIN_PASSWORD;
  const missing = [
    ...(emailRaw ? [] : ['SEED_SUPER_ADMIN_EMAIL']),
    ...(password ? [] : ['SEED_SUPER_ADMIN_PASSWORD']),
  ];
  if (missing.length) {
    if (must) return fail(`no Super admin exists and ${missing.join(' and ')} is not set`);
    console.warn(`bootstrap: ${missing.join(' and ')} not set; no Super admin created`);
    return 'skipped';
  }

  const email = z.string().email().max(254).safeParse(emailRaw);
  if (!email.success) return fail('SEED_SUPER_ADMIN_EMAIL is not a valid email address');
  if ((password as string).length < MIN_BOOTSTRAP_PASSWORD) {
    return fail(
      `SEED_SUPER_ADMIN_PASSWORD must have at least ${MIN_BOOTSTRAP_PASSWORD} characters`,
    );
  }
  const name = env.SEED_SUPER_ADMIN_NAME?.trim() || 'Super admin';

  const taken = await db.user.findUnique({
    where: { email: email.data.toLowerCase() },
    select: { id: true },
  });
  if (taken) {
    // Never change an existing account.
    if (must)
      return fail(
        'SEED_SUPER_ADMIN_EMAIL belongs to an existing account that is not a Super admin',
      );
    console.warn(
      'bootstrap: SEED_SUPER_ADMIN_EMAIL belongs to an existing account; nothing changed',
    );
    return 'skipped';
  }

  try {
    await db.user.create({
      data: {
        email: email.data.toLowerCase(),
        name,
        passwordHash: await hashPassword(password as string),
        appRole: 'SUPER_ADMIN',
        status: 'ACTIVE',
        mustChangePassword: true,
      },
    });
  } catch (err) {
    // A parallel build created it first (unique email): that is fine.
    if ((await db.user.count({ where: { appRole: 'SUPER_ADMIN' } })) > 0) return 'exists';
    throw err;
  }
  return 'created';
}

export async function run(): Promise<void> {
  try {
    const outcome = await bootstrapSuperAdmin();
    if (outcome === 'created') console.log('bootstrap: Super admin created');
    else if (outcome === 'exists') console.log('bootstrap: Super admin exists, nothing to do');
  } finally {
    await prisma.$disconnect();
  }
}
