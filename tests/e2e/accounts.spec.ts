// Playwright flows for P3-02b (/manage). Reduced scope: accounts list, add account with the one-time reveal, reset
// password, disable and enable, role guards. Accounts are synthetic (@example.test) and passwords are generated per run.
import { PrismaClient } from '@prisma/client';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { generatePassword } from '@/lib/auth/argon';
import { cleanup, createAccount, createClassroom, uniq } from '../auth/fixtures';

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
  await db.classroomMember.deleteMany({ where: { userId: { in: ids } } });
  await cleanup(db, { userIds: ids, classroomIds });
  await db.$disconnect();
});

async function signedIn(page: Page, email: string, password: string) {
  await page.goto('/sim/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sim/login'));
}

async function adminWithCohort() {
  const admin = await createAccount(db, { tag: 'acc-admin', role: 'ADMIN', name: 'Anita Admin' });
  const cohort = await createClassroom(db, { tag: 'acc', ownerAdminId: admin.user.id });
  await db.classroomMember.create({
    data: { classroomId: cohort.id, userId: admin.user.id, appRole: 'ADMIN' },
  });
  userIds.push(admin.user.id);
  classroomIds.push(cohort.id);
  return { admin, cohort };
}

test('E2E-ACC-01 an Admin adds a User; the password is shown once and the User must change it', async ({
  page,
  browser,
}) => {
  const { admin, cohort } = await adminWithCohort();
  await signedIn(page, admin.user.email, admin.password);
  await page.goto('/manage/accounts/new');
  const email = `${uniq('new')}@acc-e2e.example.test`;
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Display name').fill('Nia Newcomer');
  await expect(page.getByText('Admins can add users only.')).toBeVisible();
  await page.getByRole('button', { name: 'Create account' }).click();

  const dialog = page.getByRole('dialog', { name: 'Account created' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Show' }).click();
  const password = (await dialog.getByTestId('secret-value').innerText()).trim();
  expect(password).toHaveLength(16);
  // Done stays blocked until the box is ticked
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('I have saved the password').check();
  await dialog.getByRole('button', { name: 'Done' }).click();
  await page.waitForURL('**/manage/accounts');
  await expect(page.getByText(email)).toBeVisible();
  // the secret is gone from the page, the URL and browser storage
  expect(await page.content()).not.toContain(password);
  expect(page.url()).not.toContain(password);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(password);

  // the new User signs in with it and is sent to the forced password change
  const ctx = await browser.newContext();
  await ctx.setExtraHTTPHeaders({ 'x-forwarded-for': '10.77.1.1', ...(bypass ? { 'x-vercel-protection-bypass': bypass } : {}) });
  const other = await ctx.newPage();
  await other.goto('/sim/login');
  await other.getByLabel('Email').fill(email);
  await other.getByLabel('Password').fill(password);
  await other.getByRole('button', { name: 'Sign in' }).click();
  await other.waitForURL('**/sim/me/password**');
  await ctx.close();
  const row = await db.user.findUniqueOrThrow({ where: { email } });
  expect(row.cohortId).toBe(cohort.id);
  expect(row.ownerAdminId).toBe(admin.user.id);
});

test('E2E-ACC-02 disable blocks sign in with ACC-070; enable restores it; reset password issues a new secret', async ({
  page,
  browser,
}) => {
  const { admin, cohort } = await adminWithCohort();
  const pw = generatePassword();
  const student = await createAccount(db, {
    tag: 'acc-stu',
    role: 'USER',
    password: pw,
    cohortId: cohort.id,
    ownerAdminId: admin.user.id,
    name: 'Sam Student',
  });
  userIds.push(student.user.id);
  await signedIn(page, admin.user.email, admin.password);
  await page.goto(`/manage/accounts/${student.user.id}`);
  await page.getByRole('button', { name: 'Disable' }).click();
  await expect(page.getByRole('button', { name: 'Enable' })).toBeVisible();

  const ctx = await browser.newContext();
  await ctx.setExtraHTTPHeaders({ 'x-forwarded-for': '10.78.1.1', ...(bypass ? { 'x-vercel-protection-bypass': bypass } : {}) });
  const other = await ctx.newPage();
  await other.goto('/sim/login');
  await other.getByLabel('Email').fill(student.user.email);
  await other.getByLabel('Password').fill(pw);
  await other.getByRole('button', { name: 'Sign in' }).click();
  await expect(other.getByRole('main').getByRole('alert')).toContainText('Your account is disabled. Contact your admin.');
  await ctx.close();

  await page.getByRole('button', { name: 'Enable' }).click();
  await expect(page.getByRole('button', { name: 'Disable' })).toBeVisible();
  await page.getByRole('button', { name: 'Reset password' }).click();
  const dialog = page.getByRole('dialog', { name: 'Password reset' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Show' }).click();
  expect((await dialog.getByTestId('secret-value').innerText()).trim()).toHaveLength(16);
});

test('E2E-ACC-03 role guards: a User and an Admin on settings go to /sim/forbidden; an Admin never sees another Admin’s users', async ({
  page,
  browser,
}) => {
  const { admin: a, cohort } = await adminWithCohort();
  const { admin: b } = await adminWithCohort();
  const pw = generatePassword();
  const student = await createAccount(db, { tag: 'acc-g', role: 'USER', password: pw, cohortId: cohort.id, ownerAdminId: a.user.id });
  userIds.push(student.user.id);

  const ctx = await browser.newContext();
  await ctx.setExtraHTTPHeaders({ 'x-forwarded-for': '10.79.1.1', ...(bypass ? { 'x-vercel-protection-bypass': bypass } : {}) });
  const u = await ctx.newPage();
  await signedIn(u, student.user.email, pw);
  await u.goto('/manage/accounts');
  await u.waitForURL('**/sim/forbidden');
  await ctx.close();

  await signedIn(page, b.user.email, b.password);
  await page.goto('/manage/settings');
  await page.waitForURL('**/sim/forbidden');
  await page.goto(`/manage/accounts/${student.user.id}`);
  await expect(page.getByText('Account not found').or(page.getByText('This page could not be found'))).toBeVisible();
  await page.goto('/manage/accounts');
  await expect(page.getByText(student.user.email)).toHaveCount(0);
});
