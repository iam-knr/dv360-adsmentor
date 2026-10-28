// Runs prisma/seed/**/*.seed.ts in name order (P3-05b adds the files; P3-02 adds auth.seed.ts, which may be absent).
// Seeds never run from the Vercel build and refuse to touch a production database unless SEED_ALLOW_PRODUCTION=1.
import { readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { config } from 'dotenv';
import { assertSeedAllowed } from '../../lib/seed/guard';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

function seedFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...seedFiles(full));
    else if (name.endsWith('.seed.ts')) out.push(full);
  }
  return out.sort((a, b) => relative(dir, a).localeCompare(relative(dir, b)));
}

async function main() {
  assertSeedAllowed();
  const dir = resolve(process.cwd(), 'prisma/seed');
  const files = existsSync(dir) ? seedFiles(dir) : [];
  if (files.length === 0) {
    console.log('seed: nothing to run');
    return;
  }
  for (const file of files) {
    console.log(`seed: ${relative(dir, file)}`);
    const mod = (await import(pathToFileURL(file).href)) as { run?: () => Promise<void> };
    if (typeof mod.run !== 'function') throw new Error(`${file} must export async function run()`);
    await mod.run();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
