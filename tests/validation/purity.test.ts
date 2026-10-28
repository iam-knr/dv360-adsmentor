// lib/validation outside client/ and server/ imports nothing from react, next/*, @prisma/client or node:* (build-plan 2.4).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from './docs';

const LIB = resolve(ROOT, 'lib/validation');
const FORBIDDEN =
  /from\s+['"](react|react-dom|next|next\/[^'"]*|@prisma\/client|node:[^'"]*|server-only)['"]/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = resolve(dir, name);
    if (statSync(path).isDirectory())
      return name === 'client' || name === 'server' ? [] : files(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

describe('purity', () => {
  it.each(files(LIB).map((f) => f.replace(`${LIB}/`, '')))('%s has no framework imports', (rel) => {
    const text = readFileSync(resolve(LIB, rel), 'utf8');
    expect(FORBIDDEN.test(text)).toBe(false);
    expect(text).not.toMatch(/Math\.random|Date\.now\(|new Date\(\)/);
  });
});
