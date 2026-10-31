// Playwright flows for /manage (P3-02b, reshaped by ADM-FIX): there is one Super admin level and students. Accounts
// list with a bookmarkable search and no sideways scroll, add a student with the one-time reveal, reset password,
// disable and enable, cohorts as an optional grouping with a detail page, a readable audit log, the 404 home link and
// the role guards. Accounts are synthetic (@example.test) and passwords are generated per run.
import { PrismaClient } from '@prisma/client';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { generatePassword } from '@/lib/auth/argon';
import { clearSandboxData } from '@/lib/seed/write';
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

test('E2E-ACC-01 the Super admin adds a student; the password is shown once and the student must change it', async ({
  page,
  browser,
}) => {
  const sa = await superAdmin();
  await signedIn(page, sa.user.email, sa.password);
  await page.goto('/manage/accounts/new');
  const email = `${uniq('new')}@acc-e2e.example.test`;
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Display name').fill('Nia Newcomer');
  await expect(page.getByRole('heading', { name: 'Add account' })).toBeVisible();
  // the form offers two levels and no Admin
  await page.getByLabel('Level').click();
  await expect(page.getByRole('option', { name: 'Student' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Super admin' })).toBeVisible();
  await expect(page.getByRole('option', { name: /^Admin$/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
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
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toContain(password);

  // the new student signs in with it and is sent to the forced password change
  const ctx = await browser.newContext();
  await ctx.setExtraHTTPHeaders({
    'x-forwarded-for': '10.77.1.1',
    ...(bypass ? { 'x-vercel-protection-bypass': bypass } : {}),
  });
  const other = await ctx.newPage();
  await other.goto('/sim/login');
  await other.getByLabel('Email').fill(email);
  await other.getByLabel('Password').fill(password);
  await other.getByRole('button', { name: 'Sign in' }).click();
  await other.waitForURL('**/sim/me/password**');
  await ctx.close();
  // no cohort was chosen: the student sits in the default cohort and a sandbox row exists for them
  const row = await db.user.findUniqueOrThrow({ where: { email }, include: { cohort: true } });
  expect(row.appRole).toBe('USER');
  expect(row.cohort?.code).toBe('students');
  expect(await db.sandbox.count({ where: { ownerUserId: row.id } })).toBe(1);
});

test('E2E-ACC-02 disable blocks sign in; enable restores it; reset password issues a new secret', async ({
  page,
  browser,
}) => {
  const sa = await superAdmin();
  const st = await student('acc-stu');
  await signedIn(page, sa.user.email, sa.password);
  await page.goto(`/manage/accounts/${st.user.id}`);
  await page.getByRole('button', { name: 'Disable' }).click();
  await expect(page.getByRole('button', { name: 'Enable' })).toBeVisible();

  const ctx = await browser.newContext();
  await ctx.setExtraHTTPHeaders({
    'x-forwarded-for': '10.78.1.1',
    ...(bypass ? { 'x-vercel-protection-bypass': bypass } : {}),
  });
  const other = await ctx.newPage();
  await other.goto('/sim/login');
  await other.getByLabel('Email').fill(st.user.email);
  await other.getByLabel('Password').fill(st.pw);
  await other.getByRole('button', { name: 'Sign in' }).click();
  await expect(other.getByRole('main').getByRole('alert')).toContainText(
    'Your account is disabled. Contact your admin.',
  );
  await ctx.close();

  await page.getByRole('button', { name: 'Enable' }).click();
  await expect(page.getByRole('button', { name: 'Disable' })).toBeVisible();
  await page.getByRole('button', { name: 'Reset password' }).click();
  const dialog = page.getByRole('dialog', { name: 'Password reset' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Show' }).click();
  expect((await dialog.getByTestId('secret-value').innerText()).trim()).toHaveLength(16);
});

test('E2E-ACC-03 role guards: a student cannot open /manage, its APIs or the removed instructor pages', async ({
  page,
}) => {
  const st = await student('acc-g');
  await signedIn(page, st.user.email, st.pw);
  await page.goto('/manage/accounts');
  await page.waitForURL('**/sim/forbidden');
  await page.goto(`/manage/accounts/${st.user.id}`);
  await page.waitForURL('**/sim/forbidden');
  expect((await page.request.get('/api/manage/accounts')).status()).toBe(403);
  expect((await page.goto('/sim/instructor'))?.status()).toBe(404);
  expect((await page.goto('/sim/admin'))?.status()).toBe(404);
});

test('E2E-ACC-04 the account search lives in the URL (?q=) and can be bookmarked', async ({
  page,
}) => {
  const sa = await superAdmin();
  const needle = uniq('zq').replace(/[^a-z0-9]/gi, '');
  const a = await student('acc-q1', undefined, `Findable ${needle}`);
  const b = await student('acc-q2', undefined, 'Somebody Else');
  await signedIn(page, sa.user.email, sa.password);

  // a bookmarked address filters on first load
  await page.goto(`/manage/accounts?q=${needle}`);
  await expect(page.getByLabel('Search accounts')).toHaveValue(needle);
  await expect(page.getByText(a.user.email)).toBeVisible();
  await expect(page.getByText(b.user.email)).toHaveCount(0);

  // typing a search writes it to the URL, and the old ?search= name still works
  await page.goto('/manage/accounts');
  await page.getByLabel('Search accounts').fill(needle);
  await page.getByLabel('Search accounts').press('Enter');
  await expect(page).toHaveURL(new RegExp(`[?&]q=${needle}`));
  await expect(page.getByText(b.user.email)).toHaveCount(0);
  await page.goto(`/manage/accounts?search=${needle}`);
  await expect(page.getByText(a.user.email)).toBeVisible();
  await expect(page.getByText(b.user.email)).toHaveCount(0);
});

test('E2E-ACC-05 the accounts table fits at 1094 px without a sideways scroll', async ({ page }) => {
  const sa = await superAdmin();
  await student('acc-w');
  await page.setViewportSize({ width: 1094, height: 800 });
  await signedIn(page, sa.user.email, sa.password);
  await page.goto('/manage/accounts');
  const grid = page.getByRole('table', { name: 'Accounts' }).or(page.getByRole('grid', { name: 'Accounts' }));
  await expect(grid.first()).toBeVisible();
  const overflow = await page.evaluate(() => {
    const scrollers = [...document.querySelectorAll<HTMLElement>('main *')].filter(
      (el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible',
    );
    return {
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      scrollers: scrollers.map((el) => `${el.tagName}.${el.className.toString().slice(0, 40)}`),
    };
  });
  expect(overflow.page).toBeLessThanOrEqual(0);
  expect(overflow.scrollers).toEqual([]);
  // the owner column and the access period are gone; the secondary columns return on a wide screen
  await expect(page.getByRole('columnheader', { name: 'Owner admin' })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Access period' })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Cohort' })).toHaveCount(0);
  await page.setViewportSize({ width: 1500, height: 800 });
  await expect(page.getByRole('columnheader', { name: 'Cohort' })).toBeVisible();
});

test('E2E-ACC-06 a cohort is an optional group with a detail page; archiving keeps its students', async ({
  page,
}) => {
  const sa = await superAdmin();
  const cohort = await createClassroom(db, { tag: 'acc-co', ownerAdminId: sa.user.id });
  classroomIds.push(cohort.id);
  const m1 = await student('acc-m1', cohort.id, 'Member One');
  await student('acc-m2', cohort.id, 'Member Two');
  await signedIn(page, sa.user.email, sa.password);

  await page.goto('/manage/cohorts');
  await expect(page.getByText('Owner admin')).toHaveCount(0);
  await page.getByRole('link', { name: cohort.name }).click();
  await expect(page).toHaveURL(new RegExp(`/manage/cohorts/${cohort.id}$`));
  await expect(page.getByRole('heading', { name: cohort.name })).toBeVisible();
  const members = page.getByRole('table', { name: 'Cohort students' });
  await expect(members.getByRole('link', { name: 'Member One' })).toBeVisible();
  await expect(members.getByRole('link', { name: 'Member Two' })).toBeVisible();

  // edit
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Name').fill(`${cohort.name} renamed`);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: `${cohort.name} renamed` })).toBeVisible();

  // a member links to the account page
  await members.getByRole('link', { name: 'Member One' }).click();
  await expect(page).toHaveURL(new RegExp(`/manage/accounts/${m1.user.id}$`));
  await page.goBack();

  // archive: the students stay, in the default cohort
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Archive' }).click();
  await page.waitForURL('**/manage/cohorts');
  await expect(page.getByRole('link', { name: `${cohort.name} renamed` })).toHaveCount(0);
  const kept = await db.user.findUniqueOrThrow({
    where: { id: m1.user.id },
    include: { cohort: true },
  });
  expect([kept.status, kept.cohort?.code]).toEqual(['ACTIVE', 'students']);
  // an unknown cohort id is the 404 page
  expect((await page.goto('/manage/cohorts/does-not-exist'))?.status()).toBe(404);
});

test('E2E-ACC-07 the audit log names the actor and the target and reads as sentences', async ({
  page,
}) => {
  const sa = await superAdmin('Audit Admin');
  const st = await student('acc-aud', undefined, 'Audited Student');
  await signedIn(page, sa.user.email, sa.password);
  await page.goto(`/manage/accounts/${st.user.id}`);
  await page.getByRole('button', { name: 'Disable' }).click();
  await expect(page.getByRole('button', { name: 'Enable' })).toBeVisible();

  await page.goto(`/manage/audit?q=${encodeURIComponent(st.user.email)}`);
  const table = page.getByRole('table', { name: 'Audit log' });
  const row = table.getByRole('row').filter({ hasText: 'Disabled account' });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Audit Admin');
  await expect(row).toContainText(sa.user.email);
  await expect(row).toContainText('Audited Student');
  await expect(row).toContainText(st.user.email);
  await expect(row).toContainText('Disabled account');
  // no raw JSON
  expect(await table.innerText()).not.toMatch(/[{}"]/);
  await expect(page.getByLabel('Action')).toBeVisible();
});

test('E2E-ACC-08 the 404 page sends each person to their own landing', async ({ browser }) => {
  // a student goes to the sandbox home (a real partner), a Super admin to /manage
  const { createShellWorld } = await import('../shell/e2e-world');
  const w = await createShellWorld(db, { tag: `acc-404-${Date.now().toString(36)}` });
  userIds.push(...w.userIds);
  classroomIds.push(w.classroomId);

  const sctx = await browser.newContext();
  const sp = await sctx.newPage();
  await signedIn(sp, w.email, w.password);
  expect((await sp.goto('/p/1/nothing-here'))?.status()).toBe(404);
  const home = await sp.getByRole('link', { name: 'Return to home page' }).getAttribute('href');
  expect(home).toMatch(/^\/p\/\d+\/home_v3$/);
  await sp.getByRole('link', { name: 'Return to home page' }).click();
  await expect(sp).toHaveURL(/\/home_v3$/);
  await sctx.close();

  const sa = await superAdmin();
  const actx = await browser.newContext();
  const ap = await actx.newPage();
  await signedIn(ap, sa.user.email, sa.password);
  await ap.goto('/p/1/nothing-here');
  await expect(ap.getByRole('link', { name: 'Return to home page' })).toHaveAttribute('href', '/manage');
  await actx.close();
});
