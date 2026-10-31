// M18-05 and ADM-FIX: the Super admin adds a student, the student's sandbox is built, and the student signs in, lands on
// /sim/welcome, reaches the sandbox home and opens a campaign, a line item and a report. A second test makes a build
// that stopped (a SEEDING row whose heartbeat is old) and the account page takes it over by itself (the "Restart provisioning" button stays for FAILED builds) on the account
// page. Waits are polls on real state (expect.poll, toPass, toHaveURL), never a fixed sleep or a reload. The server runs
// with SANDBOX_ENGINE_DAYS=3 (playwright.config.ts) so the engine part of the build takes seconds; production builds 90.
import { PrismaClient } from '@prisma/client';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { clearSandboxData } from '@/lib/seed/write';
import { cleanup, createAccount, createClassroom, uniq } from '../auth/fixtures';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
const userIds: string[] = [];
const classroomIds: string[] = [];
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const STUDENT_DOMAIN = '@prov-e2e.example.test';

let ipCounter = Math.floor(Math.random() * 200);
async function ownAddress(context: BrowserContext) {
  const ip = `10.${(ipCounter++ % 250) + 1}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  await context.setExtraHTTPHeaders({
    ...(bypass ? { 'x-vercel-protection-bypass': bypass } : {}),
    'x-forwarded-for': ip,
  });
}
test.beforeEach(async ({ context }) => ownAddress(context));

test.afterAll(async () => {
  const made = await db.user.findMany({
    where: { email: { endsWith: STUDENT_DOMAIN } },
    select: { id: true },
  });
  const ids = [...userIds, ...made.map((u) => u.id)];
  for (const sb of await db.sandbox.findMany({ where: { ownerUserId: { in: ids } } })) {
    await db.$transaction((tx) => clearSandboxData(tx, sb.id), { timeout: 120_000 });
    await db.userAccessGrant.deleteMany({ where: { sandboxId: sb.id } });
    await db.sandbox.delete({ where: { id: sb.id } });
  }
  await db.classroomMember.deleteMany({ where: { userId: { in: ids } } });
  await cleanup(db, { userIds: ids, classroomIds });
  await db.$disconnect();
});

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/sim/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/** The Super admin adds a student through the form (no cohort, no forced password change). */
async function addStudent(page: Page, name: string) {
  const email = `${uniq('prov')}${STUDENT_DOMAIN}`;
  await page.goto('/manage/accounts/new');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Display name').fill(name);
  await page.getByLabel('Ask for a new password at first sign in').uncheck();
  await page.getByRole('button', { name: 'Create account' }).click();
  const dialog = page.getByRole('dialog', { name: 'Account created' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Show' }).click();
  const password = (await dialog.getByTestId('secret-value').innerText()).trim();
  await dialog.getByLabel('I have saved the password').check();
  await dialog.getByRole('button', { name: 'Done' }).click();
  await page.waitForURL('**/manage/accounts');
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  return { id: user.id, email, password };
}

const sandboxOf = (userId: string) =>
  db.sandbox.findFirst({ where: { ownerUserId: userId, kind: 'STUDENT' } });

/** The student signs in, passes /sim/welcome and reaches the sandbox home, then opens a campaign, a line item, a report. */
async function studentWalksTheSandbox(
  page: Page,
  s: { id: string; email: string; password: string },
) {
  await signIn(page, s.email, s.password);
  // /sim/welcome shows the build and drives it; it opens the sandbox home when the sandbox is ready
  await expect(page).toHaveURL(/\/sim\/welcome$|\/p\/[^/]+\/home_v3$/);
  // A FAILED build is final for the welcome page, so say so at once with the stored error instead of waiting out the
  // URL timeout (docs/gaps/fix-prov-flake.md: the flake was a build that failed 5 s in and was then waited on for 6 min)
  await expect
    .poll(
      async () => {
        const row = await sandboxOf(s.id);
        if (row?.provisionState === 'FAILED')
          throw new Error(`The sandbox build FAILED: ${row.provisionError ?? '(no message)'}`);
        return /\/p\/[^/]+\/home_v3$/.test(page.url());
      },
      {
        timeout: 360_000,
        intervals: [1_000, 2_000, 5_000],
        message: 'student reaches the sandbox home',
      },
    )
    .toBe(true);
  await expect(page).toHaveTitle('Overview - DV360 Simulator by Adsmetor');

  const sandbox = await sandboxOf(s.id);
  expect(sandbox).not.toBeNull();
  expect(sandbox!.provisionState).toBe('READY');
  expect(sandbox!.resetCount).toBe(0);
  expect(sandbox!.status).toBe('ACTIVE');

  const partner = await db.partner.findFirstOrThrow({ where: { sandboxId: sandbox!.id } });
  const pid = partner.publicId.toString();
  const adv = await db.advertiser.findFirstOrThrow({
    where: { sandboxId: sandbox!.id },
    orderBy: { createdAt: 'asc' },
  });
  const campaign = await db.campaign.findFirstOrThrow({
    where: { sandboxId: sandbox!.id, advertiserId: adv.id },
    orderBy: { createdAt: 'asc' },
  });
  const io = await db.insertionOrder.findFirstOrThrow({
    where: { sandboxId: sandbox!.id, campaignId: campaign.id },
    orderBy: { createdAt: 'asc' },
  });
  const li = await db.lineItem.findFirstOrThrow({
    where: { sandboxId: sandbox!.id, ioId: io.id },
    orderBy: { createdAt: 'asc' },
  });
  const base = `/p/${pid}/a/${adv.publicId}`;
  await page.goto(`${base}/cs`);
  await expect(page.getByText(campaign.name).first()).toBeVisible();
  await page.goto(`${base}/c/${campaign.publicId}/io/${io.publicId}/li/${li.publicId}/details`);
  await expect(page.locator('#name')).toHaveValue(li.name);
  await page.goto(`/p/${pid}/reporting`);
  await expect(page.getByText('Suggested templates')).toBeVisible();
  // a student never sees the console
  await page.goto('/manage/accounts');
  await expect(page).toHaveURL(/\/sim\/forbidden$/);
}

test('E2E-ADM-01 the Super admin adds a student; the sandbox builds; the student opens campaign, line item and report', async ({
  page,
  browser,
}) => {
  test.setTimeout(480_000);
  const sa = await createAccount(db, { tag: 'prov-super', role: 'SUPER_ADMIN' });
  userIds.push(sa.user.id);
  await signIn(page, sa.user.email, sa.password);
  await page.waitForURL('**/manage/accounts');
  const student = await addStudent(page, 'Fresh Student');

  // the account page shows the sandbox of the new student
  await page.goto(`/manage/accounts/${student.id}`);
  await expect(page.getByRole('heading', { name: 'Fresh Student' })).toBeVisible();
  await expect(page.getByText(/^State:/)).toBeVisible();

  // the student's own session drives the build through /sim/welcome
  const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  await ownAddress(ctx);
  const sp = await ctx.newPage();
  await studentWalksTheSandbox(sp, student);
  await ctx.close();

  // the admin's view follows the database state: a poll, no reload loop
  await expect
    .poll(async () => (await sandboxOf(student.id))?.provisionState, { timeout: 60_000 })
    .toBe('READY');
  await page.goto(`/manage/accounts/${student.id}`);
  await expect(page.getByText('State: READY')).toBeVisible();
  // nothing to create or retry once it is ready
  await expect(page.getByRole('button', { name: /sandbox|provisioning/i })).toHaveCount(0);
});

test('E2E-ADM-02 the account page takes over a build that stopped, and the student gets in', async ({
  page,
  browser,
}) => {
  test.setTimeout(480_000);
  const sa = await createAccount(db, { tag: 'prov-super2', role: 'SUPER_ADMIN' });
  userIds.push(sa.user.id);
  await signIn(page, sa.user.email, sa.password);
  await page.waitForURL('**/manage/accounts');
  // A build that died: the student has a sandbox row that says SEEDING while its heartbeat stopped 5 minutes ago. The
  // row is made directly in the database so that no real build races with the one the test fakes.
  const cohort = await createClassroom(db, {
    tag: 'prov-stuck',
    ownerAdminId: sa.user.id,
    windows: 'none',
  });
  classroomIds.push(cohort.id);
  await db.classroom.update({
    where: { id: cohort.id },
    data: { defaultSeedTemplate: 'starter-agency' },
  });
  const made = await createAccount(db, {
    tag: 'prov-stuck',
    role: 'USER',
    cohortId: cohort.id,
    name: 'Stuck Student',
    mustChangePassword: false,
  });
  userIds.push(made.user.id);
  const student = { id: made.user.id, email: made.user.email, password: made.password };
  const sb = await db.sandbox.create({
    data: {
      classroomId: cohort.id,
      ownerUserId: made.user.id,
      name: 'Sandbox stuck',
      kind: 'STUDENT',
      status: 'ACTIVE',
      seedTemplateKey: 'starter-agency',
      seedValue: 4242,
      provisionState: 'PENDING',
    },
  });
  await db.$executeRaw`UPDATE "Sandbox" SET "provisionState" = 'SEEDING'::"ProvisionState", "updatedAt" = now() - interval '5 minutes' WHERE "id" = ${sb.id}`;

  await page.goto(`/manage/accounts/${student.id}`);
  const restart = page.getByRole('button', {
    name: /Create sandbox|Retry provisioning|Restart provisioning/,
  });
  await expect(restart).toBeVisible();

  // The account page drives the build itself (it polls POST /api/manage/accounts/:id/provision), so the build that stopped
  // is taken over without a click; the button stays for the cases the page cannot recover (FAILED, missing).
  await expect
    .poll(async () => (await sandboxOf(student.id))?.provisionState, { timeout: 360_000 })
    .toBe('READY');
  await expect(page.getByText('State: READY')).toBeVisible({ timeout: 30_000 });

  const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  await ownAddress(ctx);
  const sp = await ctx.newPage();
  await studentWalksTheSandbox(sp, student);
  await ctx.close();
});

test('E2E-ADM-03 the account page follows the build to READY without a reload, and the student gets in', async ({
  page,
  browser,
}) => {
  test.setTimeout(480_000);
  const sa = await createAccount(db, { tag: 'prov-super3', role: 'SUPER_ADMIN' });
  userIds.push(sa.user.id);
  await signIn(page, sa.user.email, sa.password);
  await page.waitForURL('**/manage/accounts');
  const student = await addStudent(page, 'Watched Student');

  // the page polls and drives the build itself (POST /api/manage/accounts/:id/provision): no click, no reload
  await page.goto(`/manage/accounts/${student.id}`);
  await page.evaluate(() => ((window as unknown as { __kept?: number }).__kept = 1));
  await expect(page.getByRole('heading', { name: 'Watched Student' })).toBeVisible();
  await expect(page.getByText('State: READY')).toBeVisible({ timeout: 360_000 });
  // the same document: the page was never reloaded
  expect(await page.evaluate(() => (window as unknown as { __kept?: number }).__kept)).toBe(1);
  expect((await sandboxOf(student.id))?.provisionState).toBe('READY');
  // nothing to create or retry once it is ready, and the polling has stopped
  await expect(page.getByRole('button', { name: /sandbox|provisioning/i })).toHaveCount(0);

  const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  await ownAddress(ctx);
  const sp = await ctx.newPage();
  await signIn(sp, student.email, student.password);
  await expect(sp).toHaveURL(/\/p\/[^/]+\/home_v3$/);
  await expect(sp).toHaveTitle('Overview - DV360 Simulator by Adsmetor');
  await ctx.close();
});
