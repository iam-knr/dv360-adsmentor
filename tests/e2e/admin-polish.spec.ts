// Super admin polish (docs/gaps/admin-polish.md): S1 to S13 on /manage and /sim/me. Accounts are synthetic (@example.test).
import { PrismaClient } from '@prisma/client';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { generatePassword } from '@/lib/auth/argon';
import { clearSandboxData } from '@/lib/seed/write';
import { cleanup, createAccount, createClassroom } from '../auth/fixtures';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

let ipCounter = Math.floor(Math.random() * 200);
test.beforeEach(async ({ context }: { context: BrowserContext }) => {
  const ip = `10.${(ipCounter++ % 250) + 1}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  await context.setExtraHTTPHeaders({
    ...(bypass ? { 'x-vercel-protection-bypass': bypass } : {}),
    'x-forwarded-for': ip,
  });
});

const userIds: string[] = [];
const classroomIds: string[] = [];
test.afterAll(async () => {
  const made = await db.user.findMany({
    where: { email: { endsWith: '@acc-e2e.example.test' } },
    select: { id: true },
  });
  const ids = [...userIds, ...made.map((u) => u.id)];
  for (const sb of await db.sandbox.findMany({ where: { ownerUserId: { in: ids } } })) {
    await db.$transaction((tx) => clearSandboxData(tx, sb.id), { timeout: 120_000 });
    await db.userAccessGrant.deleteMany({ where: { sandboxId: sb.id } });
    await db.sandbox.delete({ where: { id: sb.id } });
  }
  const owned = await db.classroom.findMany({
    where: { ownerAdminId: { in: ids } },
    select: { id: true },
  });
  await db.classroomMember.deleteMany({ where: { userId: { in: ids } } });
  await cleanup(db, { userIds: ids, classroomIds: [...classroomIds, ...owned.map((c) => c.id)] });
  await db.$disconnect();
});

async function signedIn(page: Page, email: string, password: string) {
  await page.goto('/sim/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sim/login'));
}

async function superAdmin(name = 'Anita Admin') {
  const sa = await createAccount(db, { tag: 'acc-super', role: 'SUPER_ADMIN', name });
  userIds.push(sa.user.id);
  return sa;
}

/** A student made directly in the database (no sandbox job), optionally in a cohort. */
async function student(tag: string, cohortId?: string, name = 'Sam Student') {
  const pw = generatePassword();
  const st = await createAccount(db, {
    tag,
    role: 'USER',
    password: pw,
    cohortId: cohortId ?? null,
    name,
  });
  userIds.push(st.user.id);
  return { ...st, pw };
}

async function failedSandboxFor(
  ownerId: string,
  adminId: string,
  state: 'FAILED' | 'READY',
  error?: string,
) {
  const c = await createClassroom(db, { tag: 'polish', ownerAdminId: adminId });
  classroomIds.push(c.id);
  await db.user.update({ where: { id: ownerId }, data: { cohortId: c.id } });
  await db.sandbox.create({
    data: {
      classroomId: c.id,
      ownerUserId: ownerId,
      name: 'Sandbox polish',
      kind: 'STUDENT',
      status: 'ACTIVE',
      seedTemplateKey: 'starter-agency',
      seedValue: 7,
      provisionState: state,
      provisionError: error ?? null,
    },
  });
}

test('E2E-POL-01 S3: the logo and Back to accounts lead a Super admin out of My account; a student goes home', async ({
  page,
  browser,
}) => {
  const sa = await superAdmin();
  await signedIn(page, sa.user.email, sa.password);
  await page.goto('/sim/me');
  await page.getByRole('link', { name: 'Back to accounts', exact: true }).click();
  await expect(page).toHaveURL(/\/manage\/accounts/);
  await page.goto('/sim/me/password');
  await page.getByRole('link', { name: /Adsmetor, back to accounts/ }).click();
  await expect(page).toHaveURL(/\/manage\/accounts/);

  const st = await student('pol-home');
  const ctx = await browser.newContext();
  const p2 = await ctx.newPage();
  await signedIn(p2, st.user.email, st.pw);
  await p2.goto('/sim/me');
  await expect(p2.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
  await ctx.close();
});

test('E2E-POL-02 S1 and S7: a failed sandbox reads in plain words with Details; a ready one offers Rebuild with a warning', async ({
  page,
}) => {
  const sa = await superAdmin();
  const failed = await student('pol-failed', undefined, 'Fay Failed');
  const ready = await student('pol-ready', undefined, 'Rae Ready');
  await failedSandboxFor(
    failed.user.id,
    sa.user.id,
    'FAILED',
    'Reference data is missing: run the global seed (npm run db:seed) before building a sandbox',
  );
  await failedSandboxFor(ready.user.id, sa.user.id, 'READY');
  await signedIn(page, sa.user.email, sa.password);

  await page.goto(`/manage/accounts/${failed.user.id}`);
  await expect(page.getByText('State: Failed')).toBeVisible();
  await expect(page.getByText(/The sandbox could not be built\. Try Retry/)).toBeVisible();
  await expect(page.getByText(/run the global seed/)).toBeHidden();
  await page.getByText('Details', { exact: true }).click();
  await expect(page.getByText(/run the global seed/)).toBeVisible();

  await page.goto(`/manage/accounts/${ready.user.id}`);
  await expect(page.getByText('State: Ready')).toBeVisible();
  await page.getByRole('button', { name: 'Rebuild sandbox' }).click();
  await expect(page.getByText(/deletes everything Rae Ready has built/)).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('State: Ready')).toBeVisible();
});

test('E2E-POL-03 S4 to S6: the audit log has plain labels, a Target column and links to accounts and cohorts', async ({
  page,
}) => {
  const sa = await superAdmin();
  const st = await student('pol-audit', undefined, 'Archie Audit');
  await signedIn(page, sa.user.email, sa.password);
  await page.goto('/manage/cohorts/new');
  const name = `Polish cohort ${Date.now()}`;
  await page.getByLabel('Name').fill(name);
  await page.getByRole('button', { name: 'Create cohort' }).click();
  await page.waitForURL(/\/manage\/cohorts$/);
  const cohort = await db.classroom.findFirstOrThrow({ where: { name } });
  classroomIds.push(cohort.id);
  await db.auditLog.create({
    data: {
      actorUserId: sa.user.id,
      actorRole: 'SUPER_ADMIN',
      action: 'ACCOUNT_ARCHIVED',
      targetType: 'User',
      targetId: st.user.id,
      targetUserId: st.user.id,
      payload: { fromStatus: 'ACTIVE', toStatus: 'ARCHIVED' },
    },
  });
  await db.user.update({
    where: { id: st.user.id },
    data: { email: `archived-${Date.now()}@example.invalid` },
  });

  await page.goto('/manage/audit');
  await expect(page.getByRole('columnheader', { name: 'Target' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Account' })).toHaveCount(0);
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(
    /ACCOUNT_ARCHIVED|PASSWORD_CHANGED|COHORT_CREATED|active to archived|example\.invalid/,
  );
  await expect(page.getByRole('option', { name: 'Archived account' })).toHaveCount(1);
  const archivedRow = page.getByRole('row', { name: /Archived account/ }).first();
  await expect(archivedRow.getByRole('link', { name: 'Archie Audit' })).toHaveAttribute(
    'href',
    `/manage/accounts/${st.user.id}`,
  );
  await page
    .getByRole('link', { name: `Cohort: ${name}` })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`/manage/cohorts/${cohort.id}$`));
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();

  const csv = await page.request.get('/api/manage/audit.csv');
  expect(csv.ok()).toBe(true);
  const body = await csv.text();
  expect(body).toContain('Archived account');
  expect(body).not.toMatch(/ACCOUNT_ARCHIVED|example\.invalid/);
});

test('E2E-POL-04 S10, S11, S13: Seats used, the cohort name as heading, and the email under the name', async ({
  page,
}) => {
  const sa = await superAdmin();
  const c = await createClassroom(db, { tag: 'pol-seats', ownerAdminId: sa.user.id });
  classroomIds.push(c.id);
  const a = await student('pol-same-a', c.id, 'test manual');
  const b = await student('pol-same-b', c.id, 'test manual');
  await signedIn(page, sa.user.email, sa.password);
  await page.goto('/manage/cohorts');
  await expect(page.getByRole('columnheader', { name: 'Seats used' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Students' })).toHaveCount(0);
  await page.goto(`/manage/cohorts/${c.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(c.name);
  await page.goto('/manage/accounts?q=test%20manual');
  const emails = page.getByTestId('account-email');
  await expect(emails.filter({ hasText: a.user.email })).toHaveCount(1);
  await expect(emails.filter({ hasText: b.user.email })).toHaveCount(1);
});

test('E2E-POL-05 S12 and the seed page: a readable engine summary with the raw JSON collapsed, no class wording', async ({
  page,
}) => {
  const sa = await superAdmin();
  await signedIn(page, sa.user.email, sa.password);
  await page.goto('/manage/engine');
  await expect(page.getByText('Engine version')).toBeVisible();
  await expect(page.getByText('Tick cadence')).toBeVisible();
  await expect(page.getByText('Last run')).toBeVisible();
  await expect(page.getByTestId('engine-counts')).toContainText('Ready');
  await expect(page.getByRole('table', { name: 'Engine parameters' })).toBeVisible();
  const raw = page.getByTestId('engine-raw');
  await expect(raw.locator('pre')).toBeHidden();
  await raw.getByText('Show raw configuration').click();
  await expect(raw.locator('pre')).toBeVisible();

  for (const url of [
    '/manage/seed',
    '/manage/engine',
    '/manage/cohorts',
    '/manage/audit',
    '/manage/accounts',
  ]) {
    await page.goto(url);
    expect(await page.locator('main').innerText(), url).not.toMatch(
      /instructor|classes|scenario|Demo class/i,
    );
  }
});
