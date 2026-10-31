// Screenshot guard (docs/gaps/screenshot-guard.md). A browser cannot see a screenshot; the guard recognises the
// keyboard routes (here: PrintScreen pressed through page.keyboard). Flows: a guarded student presses PrintScreen and
// lands on the suspended page, any later request is refused, the Super admin sees the event, the badge and the banner,
// restores access and the student signs in again; an allowed student is not suspended; normal typing never trips it.
import { PrismaClient } from '@prisma/client';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { cleanup, createAccount } from '../auth/fixtures';
import { createShellWorld, type ShellWorld } from '../shell/e2e-world';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const SUSPENDED_TEXT =
  'Access suspended. A screenshot attempt was detected. Contact your administrator.';

const userIds: string[] = [];
const classroomIds: string[] = [];
test.afterAll(async () => {
  await cleanup(db, { userIds, classroomIds });
  await db.authThrottle.deleteMany({});
  await db.$disconnect();
});

let ipCounter = Math.floor(Math.random() * 200);
const newIp = () =>
  `10.${(ipCounter++ % 250) + 1}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
test.beforeEach(async ({ context }: { context: BrowserContext }) => {
  await context.setExtraHTTPHeaders({
    ...(bypass ? { 'x-vercel-protection-bypass': bypass } : {}),
    'x-forwarded-for': newIp(),
  });
});

async function world(tag: string): Promise<ShellWorld> {
  const w = await createShellWorld(db, { tag });
  userIds.push(...w.userIds);
  classroomIds.push(w.classroomId);
  return w;
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/sim/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sim/login'));
}

async function admin(page: Page) {
  const sa = await createAccount(db, {
    tag: 'sg-e2e-super',
    role: 'SUPER_ADMIN',
    name: 'Sia Super',
  });
  userIds.push(sa.user.id);
  await signIn(page, sa.user.email, sa.password);
  return sa;
}

const home = (w: ShellWorld) => `/p/${w.ids.pid}/home_v3`;

test('PrintScreen suspends the student, later requests are refused, the Super admin restores access', async ({
  browser,
  page,
}) => {
  const w = await world('sg-flow');
  const studentId = (await db.user.findUniqueOrThrow({ where: { email: w.email } })).id;

  // the student is on a normal page and presses PrintScreen
  await signIn(page, w.email, w.password);
  await page.goto(home(w));
  await expect(page.locator('main, body').first()).toBeVisible();
  await page.keyboard.press('PrintScreen');
  await page.waitForURL('**/sim/suspended');
  await expect(page.getByText(SUSPENDED_TEXT)).toBeVisible();

  // the server did it: the account is suspended and the event is stored (method and page only)
  await expect
    .poll(
      async () => (await db.user.findUniqueOrThrow({ where: { id: studentId } })).accessSuspendedAt,
    )
    .not.toBeNull();
  const row = await db.user.findUniqueOrThrow({ where: { id: studentId } });
  expect(row.accessSuspendedMethod).toBe('PRINT_SCREEN');
  expect(row.accessSuspendedPath).toContain('/p/');
  expect(row.activeSessionId).toBeNull();

  // a later request with the old cookie is refused: pages go to the suspended page, the API says 401
  await page.goto(home(w));
  await expect(page).toHaveURL(/\/sim\/suspended$/);
  expect((await page.request.get('/api/dv/notifications')).status()).toBe(401);
  expect(
    (
      await page.request.post('/api/security/screenshot-event', {
        data: { method: 'PRINT_SCREEN', path: '/' },
        headers: { origin: new URL(page.url()).origin },
      })
    ).status(),
  ).toBe(403);

  // sign in is refused with the same message after the right password
  const second = await browser.newContext({
    extraHTTPHeaders: { 'x-forwarded-for': newIp() },
  });
  const p2 = await second.newPage();
  await p2.goto('/sim/login');
  await p2.getByLabel('Email').fill(w.email);
  await p2.getByLabel('Password').fill(w.password);
  await p2.getByRole('button', { name: 'Sign in' }).click();
  await expect(p2.getByText(SUSPENDED_TEXT)).toBeVisible();
  await expect(p2).toHaveURL(/\/sim\/login/);

  // the Super admin sees the badge, the banner, the event and the account banner
  const adminContext = await browser.newContext({
    extraHTTPHeaders: { 'x-forwarded-for': newIp() },
  });
  const ap = await adminContext.newPage();
  await admin(ap);
  await ap.goto('/manage/accounts');
  await expect(ap.getByTestId('open-suspensions-banner')).toContainText('suspended');
  await expect(ap.getByTestId('accounts-security-badge')).toBeVisible();
  await expect(ap.getByLabel(/unread security events/)).toBeVisible();
  await expect(ap.getByTestId('suspended-chip').first()).toHaveText('Suspended (screenshot)');

  await ap.goto('/manage/security');
  const event = ap.getByTestId('security-event').filter({ hasText: 'Sam Student' });
  await expect(event).toHaveAttribute('data-status', 'OPEN');
  await expect(event).toContainText('Print Screen key');
  await expect(event).toContainText('/p/');
  // opening the page marks the events as seen: the badge goes away
  await expect(ap.getByLabel(/unread security events/)).toBeHidden({ timeout: 15_000 });

  await ap.goto(`/manage/accounts/${studentId}`);
  const banner = ap.getByTestId('suspension-banner');
  await expect(banner).toContainText('Access suspended');
  await expect(banner).toContainText('Print Screen key');
  await ap.getByRole('button', { name: 'Restore access' }).click();
  await ap.getByRole('dialog').getByRole('button', { name: 'Restore access' }).click();
  await expect(ap.getByTestId('suspension-banner')).toBeHidden();
  await expect(ap.getByText('not allowed', { exact: true })).toBeVisible(); // the switch stays as it was

  await ap.goto('/manage/security');
  const restored = ap.getByTestId('security-event').filter({ hasText: 'Sam Student' });
  await expect(restored).toHaveAttribute('data-status', 'RESTORED');
  await expect(restored).toContainText('Sia Super');
  await expect(ap.getByTestId('open-suspensions-banner')).toBeHidden();

  // the student signs in again
  await signIn(p2, w.email, w.password);
  await p2.goto(home(w));
  await expect(p2).not.toHaveURL(/suspended|login/);
  await second.close();
  await adminContext.close();
});

test('the Super admin gets a toast within the poll interval, then bulk restores from the list', async ({
  browser,
  page,
}) => {
  test.setTimeout(120_000);
  const w = await world('sg-toast');
  const studentId = (await db.user.findUniqueOrThrow({ where: { email: w.email } })).id;
  await admin(page);
  await page.goto('/manage/accounts');

  const sctx = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': newIp() } });
  const sp = await sctx.newPage();
  await signIn(sp, w.email, w.password);
  await sp.goto(home(w));
  await sp.keyboard.press('Control+P');
  await sp.waitForURL('**/sim/suspended');
  await sctx.close();

  // the poll runs every 30 seconds
  await expect(page.getByRole('alert').filter({ hasText: 'Sam Student' })).toBeVisible({
    timeout: 45_000,
  });

  await page.goto('/manage/accounts?suspended=1');
  await expect(page.getByTestId('suspended-chip')).toHaveCount(1);
  await page
    .getByRole('row', { name: /Sam Student/ })
    .getByRole('checkbox')
    .check();
  await page.getByRole('button', { name: 'Restore access' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Restore access' }).click();
  await expect(page.getByText(/1 done/)).toBeVisible();
  expect(
    (await db.user.findUniqueOrThrow({ where: { id: studentId } })).accessSuspendedAt,
  ).toBeNull();
});

test('an allowed student can press PrintScreen; the Super admin switch flips it back', async ({
  browser,
  page,
}) => {
  const w = await world('sg-allowed');
  const studentId = (await db.user.findUniqueOrThrow({ where: { email: w.email } })).id;
  const ap = await (async () => {
    const ctx = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': newIp() } });
    const p = await ctx.newPage();
    await admin(p);
    return p;
  })();
  await ap.goto(`/manage/accounts/${studentId}`);
  await expect(ap.getByText('not allowed', { exact: true })).toBeVisible();
  await ap.getByRole('button', { name: 'Allow screenshots' }).click();
  await ap.getByRole('dialog').getByRole('button', { name: 'Allow' }).click();
  await expect(ap.getByText('allowed for this student')).toBeVisible();

  await signIn(page, w.email, w.password);
  await page.goto(home(w));
  await page.keyboard.press('PrintScreen');
  await page.waitForTimeout(1500);
  await expect(page).not.toHaveURL(/suspended/);
  expect(
    (await db.user.findUniqueOrThrow({ where: { id: studentId } })).accessSuspendedAt,
  ).toBeNull();
  expect(await db.securityEvent.count({ where: { userId: studentId } })).toBe(0);

  // the Super admin is never guarded either
  await ap.keyboard.press('PrintScreen');
  await ap.waitForTimeout(500);
  await expect(ap).not.toHaveURL(/suspended/);
});

test('normal typing never trips the guard (the letter s, digits, Shift+3, Shift+S)', async ({
  page,
}) => {
  const w = await world('sg-typing');
  const studentId = (await db.user.findUniqueOrThrow({ where: { email: w.email } })).id;
  await signIn(page, w.email, w.password);
  await page.goto('/sim/me/password');
  const field = page.getByLabel(/^New password/);
  await field.click();
  await field.pressSequentially('sSsS 333 ## $$ %% ^^ pPpP 3456 aAzZ', { delay: 5 });
  for (const key of [
    'Shift+3',
    'Shift+4',
    'Shift+5',
    'Shift+6',
    'Shift+S',
    'S',
    's',
    '3',
    '4',
    'p',
    'P',
  ]) {
    await page.keyboard.press(key);
  }
  await page.waitForTimeout(1200);
  await expect(page).toHaveURL(/\/sim\/me\/password/);
  const row = await db.user.findUniqueOrThrow({ where: { id: studentId } });
  expect(row.accessSuspendedAt).toBeNull();
  expect(await db.securityEvent.count({ where: { userId: studentId } })).toBe(0);
});
