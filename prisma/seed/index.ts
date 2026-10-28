// Runs prisma/seed/**/*.seed.ts in name order (P3-05b adds the files).
import { readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

async function main() {
  const dir = resolve(process.cwd(), 'prisma/seed');
  const files = existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.seed.ts'))
        .sort()
    : [];
  if (files.length === 0) {
    console.log('seed: nothing to run');
    return;
  }
  for (const file of files) {
    console.log(`seed: ${file}`);
    const mod = (await import(pathToFileURL(resolve(dir, file)).href)) as {
      run?: () => Promise<void>;
    };
    if (typeof mod.run !== 'function') throw new Error(`${file} must export async function run()`);
    await mod.run();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
