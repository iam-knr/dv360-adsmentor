// F7 and F12: .env.example lists every variable of build-plan 1.10; vercel.json has no cron.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../..');
const read = (f: string) => readFileSync(resolve(root, f), 'utf8');

const REQUIRED = [
  'DATABASE_URL',
  'DIRECT_URL',
  'AUTH_SECRET',
  'AUTH_TRUST_HOST',
  'CRON_SECRET',
  'SEED_SUPER_ADMIN_EMAIL',
  'SEED_SUPER_ADMIN_PASSWORD',
  'SEED_SUPER_ADMIN_NAME',
  'CRON_MODE',
  'ENABLE_GALLERY',
  'BLOB_READ_WRITE_TOKEN',
  'DATABASE_URL_TEST',
  'AUTH_DEV_BYPASS',
  'ENGINE_CRON_URL',
  'E2E_BASE_URL',
  'VERCEL_AUTOMATION_BYPASS_SECRET',
];

describe('config files', () => {
  it('.env.example lists every variable', () => {
    const lines = read('.env.example').split('\n');
    for (const name of REQUIRED) {
      expect(
        lines.some((l) => l.startsWith(`${name}=`)),
        name,
      ).toBe(true);
    }
  });

  it('.env.example holds no real-looking secrets', () => {
    expect(read('.env.example')).not.toMatch(/supabase\.co|sk_live|-----BEGIN/);
  });

  it('.gitignore excludes .env files except .env.example', () => {
    const gi = read('.gitignore');
    expect(gi).toMatch(/^\.env\*$/m);
    expect(gi).toMatch(/^!\.env\.example$/m);
  });

  it('vercel.json has no cron entry', () => {
    const json = JSON.parse(read('vercel.json')) as Record<string, unknown>;
    expect(json.crons).toBeUndefined();
  });
});
