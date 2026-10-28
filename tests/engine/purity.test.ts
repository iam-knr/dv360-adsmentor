import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../lib/engine');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

// the lint rule exempts io/ and testing/; the core is everything else (engine.md 1.3)
const core = files(root).filter((f) => {
  const rel = relative(root, f);
  return !rel.startsWith('io/') && !rel.startsWith('testing/') && rel !== 'server.ts';
});

describe('the engine core is pure (engine.md 1.3, build-plan P3-08a)', () => {
  it('finds the core files', () => {
    expect(core.length).toBeGreaterThan(60);
  });

  it('never reads the real clock or the global random generator', () => {
    const banned = [
      /Math\.random/,
      /Date\.now/,
      /new Date\(\s*\)/,
      /performance\.now/,
      /process\.hrtime/,
    ];
    for (const f of core) {
      const src = readFileSync(f, 'utf8')
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');
      for (const re of banned)
        expect(re.test(src), `${relative(root, f)} matches ${String(re)}`).toBe(false);
    }
  });

  it('imports no database, UI framework or Node built-in', () => {
    const banned =
      /from\s+['"](@prisma\/client|react|react-dom|next|next\/[^'"]*|node:[^'"]*|fs|path|crypto|server-only)['"]/;
    const db = /from\s+['"][^'"]*(\/lib\/db|\.\.\/db|prisma)[^'"]*['"]/;
    for (const f of core) {
      const src = readFileSync(f, 'utf8');
      expect(banned.test(src), `${relative(root, f)} imports a banned package`).toBe(false);
      expect(db.test(src), `${relative(root, f)} imports the database layer`).toBe(false);
    }
  });

  it('has no default exports (project rule) and no console output', () => {
    for (const f of core) {
      const src = readFileSync(f, 'utf8');
      expect(/export default/.test(src), relative(root, f)).toBe(false);
      expect(/console\.(log|info|debug)/.test(src), relative(root, f)).toBe(false);
    }
  });

  it('keeps every engine module folder of engine.md 1.5 except io', () => {
    const folders = readdirSync(root).filter((f) => statSync(join(root, f)).isDirectory());
    for (const m of [
      'params',
      'rng',
      'clock',
      'supply',
      'eligibility',
      'bidding',
      'auction',
      'outcomes',
      'pacing',
      'costs',
      'diagnostics',
      'aggregation',
      'scenario',
      'testing',
    ]) {
      expect(folders, m).toContain(m);
    }
    expect(folders).not.toContain('io');
  });
});
