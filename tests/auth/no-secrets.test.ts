import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// T10 (module 19 4.6.2): the repo is public. No hash, no real looking email, no real password value in a tracked file.
const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter(
    (f) => !/\.(png|jpg|jpeg|gif|ico|woff2?|pdf|lock)$/i.test(f) && f !== 'package-lock.json',
  );

function read(file: string): string {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

// Test files may mention the markers they look for; the check is about everything else.
const SELF = 'tests/auth/no-secrets.test.ts';
const scanned = tracked.filter((f) => f !== SELF);

describe('no secrets in tracked files', () => {
  it('has no PHC password hash', () => {
    const hits = scanned.filter(
      (f) =>
        /\$argon2(id|i|d)\$v=\d+\$m=\d+/.test(read(f)) ||
        /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/.test(read(f)),
    );
    expect(hits).toEqual([]);
  });

  it('has no real looking email outside example.test, .invalid and other reserved names', () => {
    const allowedDomain =
      /(^|\.)(example\.(test|com|org|net)|[a-z0-9-]+\.invalid|localhost|users\.noreply\.github\.com|anthropic\.com)$/i;
    const bad: string[] = [];
    for (const f of scanned) {
      if (f.startsWith('docs/')) continue; // specs quote vendor and brand addresses
      for (const m of read(f).matchAll(/[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g)) {
        const domain = (m[1] ?? '').toLowerCase();
        if (allowedDomain.test(domain)) continue;
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(domain)) continue; // connection strings user:pass@127.0.0.1
        if (/\.(png|jpg|svg|css|js|ts|tsx|json|md)$/.test(domain)) continue; // "@2x.png", package scopes
        bad.push(`${f}: ${m[0]}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('only has placeholder values after SEED_SUPER_ADMIN_PASSWORD=', () => {
    const placeholder = /^["']?(change-me-locally|ci-admin-password|\$\{\{.*\}\}|<.*>|)["']?$/;
    const bad: string[] = [];
    for (const f of scanned) {
      if (f.startsWith('docs/')) continue; // prose and examples in the specs
      for (const m of read(f).matchAll(/SEED_SUPER_ADMIN_PASSWORD=\s*([^\s#]*)/g)) {
        const value = (m[1] ?? '').trim();
        if (!placeholder.test(value)) bad.push(`${f}: SEED_SUPER_ADMIN_PASSWORD=<value>`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('does not track .env files other than .env.example', () => {
    expect(
      tracked.filter((f) => /(^|\/)\.env(\..*)?$/.test(f) && !f.endsWith('.env.example')),
    ).toEqual([]);
  });
});
