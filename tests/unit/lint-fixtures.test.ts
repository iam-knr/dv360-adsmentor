// F5 and F6: prove the layering and determinism rules fail on violations and pass elsewhere.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { afterAll, describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../..');

describe('ESLint fixtures (F6)', () => {
  const eslint = new ESLint({
    cwd: root,
    // Fixtures are linted from text, so turn off type-aware parsing for them.
    overrideConfig: [
      { files: ['**/*.ts'], languageOptions: { parserOptions: { projectService: false } } },
      { ...tseslint.configs.disableTypeChecked, files: ['**/*.ts'] },
    ],
  });

  const lint = async (filePath: string, code: string) => {
    const [result] = await eslint.lintText(code, { filePath: resolve(root, filePath) });
    return result?.messages ?? [];
  };

  it('rejects Math.random in lib/engine', async () => {
    const messages = await lint('lib/engine/rng/fixture.ts', 'export const x = Math.random();\n');
    expect(messages.some((m) => m.message.includes('Math.random'))).toBe(true);
  });

  it('rejects Date.now, new Date() and performance.now in lib/engine', async () => {
    const code =
      'export const a = Date.now();\nexport const b = new Date();\nexport const c = performance.now();\n';
    const messages = await lint('lib/engine/clock/fixture.ts', code);
    expect(messages.filter((m) => m.ruleId === 'no-restricted-syntax')).toHaveLength(3);
  });

  it('accepts new Date(arg) in lib/engine', async () => {
    const messages = await lint('lib/engine/clock/fixture.ts', 'export const a = new Date(0);\n');
    expect(messages).toHaveLength(0);
  });

  it('accepts Math.random outside lib/engine', async () => {
    const messages = await lint('lib/other/fixture.ts', 'export const x = Math.random();\n');
    expect(messages).toHaveLength(0);
  });

  it('accepts Math.random in lib/engine/io', async () => {
    const messages = await lint('lib/engine/io/fixture.ts', 'export const x = Math.random();\n');
    expect(messages).toHaveLength(0);
  });

  it('rejects react imports in pure lib/validation files but not in client/', async () => {
    const bad = await lint(
      'lib/validation/rules/fixture.ts',
      "import 'react';\nexport const x = 1;\n",
    );
    expect(bad.some((m) => m.ruleId === 'no-restricted-imports')).toBe(true);
    const ok = await lint(
      'lib/validation/client/fixture.ts',
      "import 'react';\nexport const x = 1;\n",
    );
    expect(ok.some((m) => m.ruleId === 'no-restricted-imports')).toBe(false);
  });
});

describe('dependency-cruiser fixtures (F5)', () => {
  const dirs: string[] = [];
  afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

  function cruise(files: Record<string, string>): { status: number; out: string } {
    const dir = mkdtempSync(join(tmpdir(), 'depcruise-'));
    dirs.push(dir);
    copyFileSync(join(root, '.dependency-cruiser.cjs'), join(dir, '.dependency-cruiser.cjs'));
    writeFileSync(
      join(dir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          module: 'esnext',
          moduleResolution: 'bundler',
          baseUrl: '.',
          paths: { '@/*': ['./*'] },
        },
      }),
    );
    for (const [name, content] of Object.entries(files)) {
      const target = join(dir, name);
      mkdirSync(join(target, '..'), { recursive: true });
      writeFileSync(target, content);
    }
    try {
      const out = execFileSync(
        join(root, 'node_modules/.bin/depcruise'),
        ['lib', 'components', 'app', '--config', '.dependency-cruiser.cjs'],
        { cwd: dir, encoding: 'utf8', stdio: 'pipe' },
      );
      return { status: 0, out };
    } catch (err) {
      const e = err as { status?: number; stdout?: string };
      return { status: e.status ?? 1, out: e.stdout ?? '' };
    }
  }

  it('fails when a component imports lib/db', () => {
    const res = cruise({
      'lib/db/index.ts': 'export const prisma = 1;\n',
      'components/Bad.ts': "import { prisma } from '../lib/db';\nexport const x = prisma;\n",
      'app/.keep.ts': 'export {};\n',
    });
    expect(res.status).not.toBe(0);
    expect(res.out).toContain('components-no-db');
  });

  it('fails when lib imports components', () => {
    const res = cruise({
      'components/A.ts': 'export const a = 1;\n',
      'lib/bad.ts': "import { a } from '../components/A';\nexport const x = a;\n",
      'app/.keep.ts': 'export {};\n',
    });
    expect(res.status).not.toBe(0);
    expect(res.out).toContain('lib-no-ui');
  });

  it('fails when lib/engine/io is imported from components', () => {
    const res = cruise({
      'lib/engine/io/load.ts': 'export const load = 1;\n',
      'components/B.ts': "import { load } from '../lib/engine/io/load';\nexport const x = load;\n",
      'app/.keep.ts': 'export {};\n',
    });
    expect(res.status).not.toBe(0);
    expect(res.out).toContain('engine-io-isolated');
  });

  it('fails when an engine module imports against the dependency direction', () => {
    const res = cruise({
      'lib/engine/auction/a.ts': 'export const a = 1;\n',
      'lib/engine/supply/s.ts': "import { a } from '../auction/a';\nexport const x = a;\n",
      'components/.keep.ts': 'export {};\n',
      'app/.keep.ts': 'export {};\n',
    });
    expect(res.status).not.toBe(0);
    expect(res.out).toContain('engine-supply-direction');
  });

  it('passes on a clean tree', () => {
    const res = cruise({
      'lib/engine/params/p.ts': 'export const p = 1;\n',
      'lib/engine/supply/s.ts': "import { p } from '../params/p';\nexport const s = p;\n",
      'components/C.ts': 'export const c = 1;\n',
      'app/page.ts': "import { c } from '../components/C';\nexport const x = c;\n",
    });
    expect(res.status).toBe(0);
  });
});
