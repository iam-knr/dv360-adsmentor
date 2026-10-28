// Creates a fresh test database from DATABASE_URL_TEST and applies migrations.
import { execFileSync } from 'node:child_process';
import { config } from 'dotenv';
import { Client } from 'pg';

config({ path: '.env.local', quiet: true });

export default async function setup() {
  const raw = process.env.DATABASE_URL_TEST;
  if (!raw) throw new Error('DATABASE_URL_TEST is required for the db test project');
  const url = new URL(raw);
  const dbName = url.pathname.replace(/^\//, '');
  if (!/^[A-Za-z0-9_]+$/.test(dbName) || !dbName.includes('test')) {
    throw new Error(`Refusing to reset database "${dbName}": the name must contain "test"`);
  }
  const admin = new URL(raw);
  admin.pathname = '/postgres';
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await client.end();
  }
  process.env.DATABASE_URL = raw;
  process.env.DIRECT_URL = raw;
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: raw, DIRECT_URL: raw },
  });
}
