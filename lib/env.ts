import { z } from 'zod';

const bool = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().min(1).optional(),
  DATABASE_URL_TEST: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET must be at least 16 characters').optional(),
  AUTH_TRUST_HOST: bool.optional(),
  AUTH_DEV_BYPASS: bool.optional(),
  CRON_SECRET: z.string().min(1).optional(),
  CRON_MODE: z.enum(['github', 'manual']).default('github'),
  ENGINE_CRON_URL: z.string().url().optional(),
  SEED_SUPER_ADMIN_EMAIL: z.string().email().optional(),
  SEED_SUPER_ADMIN_PASSWORD: z.string().min(1).optional(),
  SEED_SUPER_ADMIN_NAME: z.string().min(1).optional(),
  ENABLE_GALLERY: z.string().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/** Parse an environment object. Throws one Error that names every bad variable. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  // Treat empty strings (from `FOO=` lines) as unset.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== ''));
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment variables:\n${lines.join('\n')}`);
  }
  const env = result.data;
  if (
    env.NODE_ENV === 'production' &&
    !env.AUTH_SECRET &&
    process.env.NEXT_PHASE !== 'phase-production-build'
  ) {
    throw new Error('Invalid environment variables:\n  AUTH_SECRET: required in production');
  }
  return env;
}

let cached: Env | undefined;

/** Lazy, validated access: `env.DATABASE_URL`. Parsing happens on first read, not at import. */
export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string) {
    cached ??= parseEnv(process.env);
    return cached[prop as keyof Env];
  },
});
