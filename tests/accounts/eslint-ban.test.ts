import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// The type aware config needs a real file in the TypeScript project, so each probe is written and removed.
async function lint(rel: string, code: string) {
  const file = join(process.cwd(), rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, code);
  try {
    const [res] = await new ESLint({ cwd: process.cwd() }).lintFiles([file]);
    return res?.messages.filter((m) => m.ruleId === 'no-restricted-syntax') ?? [];
  } finally {
    rmSync(file);
  }
}

describe('db.user / db.classroom ban (module 19 3.4)', () => {
  const user = `import { prisma } from '@/lib/db';\nexport const f = () => prisma.user.findMany();\n`;
  const classroom = user.replace('user', 'classroom');
  it('is reported in app and lib code', async () => {
    expect(await lint('app/manage/__probe.ts', user)).toHaveLength(1);
    expect(await lint('lib/campaigns/__probe.ts', classroom)).toHaveLength(1);
  }, 60_000);
  it('is allowed in lib/accounts and lib/auth', async () => {
    expect(await lint('lib/accounts/__probe.ts', user)).toHaveLength(0);
    expect(await lint('lib/auth/__probe.ts', user)).toHaveLength(0);
  }, 60_000);
});
