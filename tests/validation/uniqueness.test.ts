// IDs are unique and well formed; no rule text is an inline copy of an MSG value (validation.md 6.7).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allRules, MSG } from '@/lib/validation';
import { assertRegistry } from '@/lib/validation/registry';
import { ROOT } from './docs';

const LIB = resolve(ROOT, 'lib/validation');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = resolve(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

describe('registry', () => {
  it('has unique IDs in the documented format', () => {
    expect(() => assertRegistry()).not.toThrow();
    const ids = allRules().map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[A-Z]+(-[A-Z]+)?-\d{3}$/);
  });

  it('gives every rule a kind, severity, triggers and reads', () => {
    for (const rule of allRules()) {
      expect(['error', 'warning', 'info']).toContain(rule.severity);
      expect(Array.isArray(rule.triggers)).toBe(true);
      expect(rule.reads.length, rule.id).toBeGreaterThan(0);
      expect(rule.kind).toBeTruthy();
    }
  });
});

describe('messages', () => {
  const values = new Set<string>(Object.values(MSG));
  const catalogueOnly = [...values];

  it('are not inlined in other source files', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(LIB)) {
      if (file.endsWith('messages.ts')) continue;
      const text = readFileSync(file, 'utf8');
      for (const value of catalogueOnly) {
        // a quoted literal that equals a catalogue value; template placeholders make the value specific enough
        const patterns = [`'${value}'`, `"${value}"`, `'${value.replace(/'/g, "\\'")}'`];
        if (patterns.some((p) => text.includes(p))) offenders.push(`${file.replace(ROOT, '')}: ${value}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('are what the rules carry', () => {
    for (const rule of allRules()) {
      if (rule.message !== null) expect(typeof rule.message).toBe('string');
    }
  });
});
