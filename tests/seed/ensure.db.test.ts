// Production data flow (docs/gaps/prod-seed.md): a database with migrations only gets its reference data from the
// ensure step, twice without change, and a student sandbox builds on it. Bootstrap creates no demo accounts.
// Runs in its own scratch database (migrations only) so it cannot disturb the shared test database.
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureReferenceData, referenceDataMissing } from '@/lib/seed/ensure';
import { EXCHANGES, TARGETING_OPTIONS } from '@/lib/seed/reference';
import { partnerIdOf, provisionSandbox } from '@/lib/seed/sandbox';
import { runDemoClass } from '../../prisma/bootstrap/20-demo-class.bootstrap';
import { createAccount, createClassroom, uniq } from '../auth/fixtures';

let prisma: PrismaClient;
let scratch: string;
let adminUrl: URL;

/** Wipes the global reference tables (and their dependants) to look like a fresh production database. */
async function wipeReference() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Exchange", "TargetingOption", "MarketplaceProduct" RESTART IDENTITY CASCADE',
  );
}

describe('ensureReferenceData', () => {
  beforeAll(async () => {
    const raw = process.env.DATABASE_URL_TEST as string;
    const base = new URL(raw);
    scratch = `${base.pathname.replace(/^\//, '')}_ensure`;
    adminUrl = new URL(raw);
    adminUrl.pathname = '/postgres';
    const admin = new Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS "${scratch}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${scratch}"`);
    await admin.end();
    base.pathname = `/${scratch}`;
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: base.toString(), DIRECT_URL: base.toString() },
    });
    prisma = new PrismaClient({ datasourceUrl: base.toString() });
  }, 300_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    const admin = new Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS "${scratch}" WITH (FORCE)`);
    await admin.end();
  });

  it('starts from no reference data', async () => {
    expect(await referenceDataMissing(prisma)).toBe(true);
    expect(await prisma.exchange.count()).toBe(0);
  });

  it('writes the reference data and is idempotent', async () => {
    const first = await ensureReferenceData(prisma);
    expect(first.exchanges.created).toBe(EXCHANGES.length);
    expect(first.targetingOptions.created).toBe(TARGETING_OPTIONS.length);
    const counts = async () => [
      await prisma.exchange.count(),
      await prisma.targetingOption.count(),
      await prisma.marketplaceProduct.count(),
    ];
    const before = await counts();
    const second = await ensureReferenceData(prisma);
    expect(second.exchanges).toEqual({ created: 0, updated: 0 });
    expect(second.targetingOptions).toEqual({ created: 0, updated: 0 });
    expect(await counts()).toEqual(before);
    expect(await referenceDataMissing(prisma)).toBe(false);
  }, 120_000);

  it('survives two concurrent runs', async () => {
    await wipeReference();
    await Promise.all([ensureReferenceData(prisma), ensureReferenceData(prisma)]);
    expect(await prisma.exchange.count()).toBe(EXCHANGES.length);
  }, 120_000);

  it('creates no account, classroom or sandbox', async () => {
    const [u, c, s] = [
      await prisma.user.count(),
      await prisma.classroom.count(),
      await prisma.sandbox.count(),
    ];
    await ensureReferenceData(prisma);
    expect([
      await prisma.user.count(),
      await prisma.classroom.count(),
      await prisma.sandbox.count(),
    ]).toEqual([u, c, s]);
  });

  it('the production-guarded demo class creates nothing', async () => {
    const users = await prisma.user.count({
      where: { email: { endsWith: '@example.test' }, appRole: { in: ['ADMIN', 'USER'] } },
    });
    const before = await prisma.classroom.count({ where: { code: 'DEMO' } });
    const result = await runDemoClass(
      prisma,
      { NODE_ENV: 'production', VERCEL_ENV: 'production' },
      () => {},
    );
    expect(result.skipped).toBe(true);
    expect(await prisma.classroom.count({ where: { code: 'DEMO' } })).toBe(before);
    expect(
      await prisma.user.count({
        where: { email: { endsWith: '@example.test' }, appRole: { in: ['ADMIN', 'USER'] } },
      }),
    ).toBe(users);
  });

  it('builds a student sandbox after the ensure step', async () => {
    const a = await createAccount(prisma, { tag: uniq('ps-admin'), role: 'ADMIN' });
    const c = await createClassroom(prisma, { tag: 'ps', ownerAdminId: a.user.id });
    const r = await provisionSandbox(prisma, {
      classroomId: c.id,
      ownerUserId: null,
      name: uniq('ps-sandbox'),
      template: 'starter-agency',
      kind: 'STUDENT',
      seedValue: 11,
      partnerName: 'Sandbox PS',
      knobs: { historyDays: 7, hourlyDays: 1 },
    });
    expect(r.built).toBe(true);
    expect(await prisma.partner.count({ where: { id: partnerIdOf(r.sandboxId) } })).toBe(1);
  }, 300_000);

  it('self-heals: provisioning on an empty database ensures the reference data first', async () => {
    await wipeReference();
    const a = await createAccount(prisma, { tag: uniq('ps-admin2'), role: 'ADMIN' });
    const c = await createClassroom(prisma, { tag: 'ps2', ownerAdminId: a.user.id });
    const r = await provisionSandbox(prisma, {
      classroomId: c.id,
      ownerUserId: null,
      name: uniq('ps-sandbox2'),
      template: 'starter-agency',
      kind: 'STUDENT',
      seedValue: 12,
      partnerName: 'Sandbox PS2',
      knobs: { historyDays: 7, hourlyDays: 1 },
    });
    expect(r.built).toBe(true);
    expect(await referenceDataMissing(prisma)).toBe(false);
  }, 300_000);
});
