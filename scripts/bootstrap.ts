// Runs prisma/bootstrap/*.bootstrap.ts in name order. Every bootstrap file must be idempotent.
import { readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

async function main() {
  const dir = resolve(process.cwd(), 'prisma/bootstrap');
  const files = existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.bootstrap.ts'))
        .sort()
    : [];
  if (files.length === 0) {
    console.log('bootstrap: nothing to run');
    return;
  }
  for (const file of files) {
    console.log(`bootstrap: ${file}`);
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
