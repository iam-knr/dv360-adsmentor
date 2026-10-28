// Production guards. Seeds never run automatically against the production database from the Vercel build.

/** True when the process looks like a production deploy: NODE_ENV=production or a Vercel build/runtime. */
export function isProductionEnvironment(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production' || env.VERCEL === '1';
}

/** Throws unless seeds may run: not production, or SEED_ALLOW_PRODUCTION=1 was set on purpose. */
export function assertSeedAllowed(env: Record<string, string | undefined> = process.env): void {
  if (isProductionEnvironment(env) && env.SEED_ALLOW_PRODUCTION !== '1') {
    throw new Error(
      'Refusing to run seeds in a production environment. Set SEED_ALLOW_PRODUCTION=1 to override on purpose.',
    );
  }
}

/** The demo class bootstrap is skipped in production unless SEED_DEMO=1 (build-plan P3-05b item 5). */
export function shouldBootstrapDemoClass(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return !isProductionEnvironment(env) || env.SEED_DEMO === '1';
}
