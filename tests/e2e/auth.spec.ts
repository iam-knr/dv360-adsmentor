// Playwright flows for P3-02 (login, lockout, forced password change, role guards, view-as). Two account levels exist
// (ADM-FIX): a Super admin and students; there are no class windows.
// Every test makes its own accounts (synthetic @example.test addresses, passwords generated per run) in the test
// database, so the specs can run in any order and more than once. Each test also uses its own client address
// (x-forwarded-for) so the per address failure limit of one test cannot hit another.
import { PrismaClient } from '@prisma/client';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { generatePassword } from '@/lib/auth/argon';
import { cleanup, createAccount, createClassroom, createStudent } from '../auth/fixtures';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

let ipCounter = Math.floor(Math.random() * 200);
async function ownAddress(context: BrowserContext) {
  const ip = `10.${(ipCounter++ % 250) + 1}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  await context.setExtraHTTPHeaders({
    ...(bypass ? { 'x-vercel-protection-bypass': bypass } : {}),
    'x-forwarded-for': ip,
  });
  return ip;
}

const userIds: string[] = [];
const classroomIds: string[] = [];
test.afterAll(async () => {
  await cleanup(db, { userIds, classroomIds });
  await db.$disconnect();
});
test.beforeEach(async ({ context }) => {
  await ownAddress(context);
});

async function setup(opts: { mustChangePassword?: boolean } = {}) {
  const admin = await createAccount(db, {
    tag: 'e2e-admin',
    role: 'SUPER_ADMIN',
    name: 'Anita Admin',
  });
  const classroom = await createClassroom(db, {
    tag: 'e2e',
    ownerAdminId: admin.user.id,
    windows: 'none',
  });
  const student = await createStudent(db, {
    tag: 'e2e-stu',
    classroomId: classroom.id,
    name: 'Sam Student',
    mustChangePassword: opts.mustChangePassword ?? false,
  });
  userIds.push(admin.user.id, student.user.id);
  classroomIds.push(classroom.id);
  return { admin, classroom, student };
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/sim/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

// the page's own alert; Next.js has a second, empty role=alert for route announcements
/** Sign in and wait until the browser has left the login page (the session cookie is set by then). */
async function signedIn(page: Page, email: string, password: string) {
  await signIn(page, email, password);
  await page.waitForURL((url) => !url.pathname.startsWith('/sim/login'));
}

const alertText = (page: Page) => page.getByRole('main').getByRole('alert');

test.describe('sign in', () => {
  test('a student with the right password lands on the welcome page (M18-AC1)', async ({
    page,
  }) => {
    const { student } = await setup();
    await signedIn(page, student.user.email, student.password);
    await expect(page).toHaveURL(/\/sim\/welcome$/);
    await expect(page.getByRole('heading', { name: 'Welcome, Sam Student' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Adsmetor' })).toBeVisible();
  });

  test('the login page uses the Adsmetor logo and the exact field labels', async ({ page }) => {
    await page.goto('/sim/login');
    const logo = page.getByRole('img', { name: 'Adsmetor' });
    await expect(logo).toBeVisible();
    expect(await logo.getAttribute('src')).toContain('/brand/adsmentor-logo-horizontal.png');
    expect(await logo.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByText('Forgot your password? Ask your admin.')).toBeVisible();
  });

  test('wrong password and unknown email show the same message (M18-AC2)', async ({ page }) => {
    const { student } = await setup();
    await signIn(page, student.user.email, 'Wrong-pass-1');
    await expect(alertText(page)).toContainText('Incorrect email or password.');
    await signIn(page, 'nobody-here@example.test', 'Wrong-pass-1');
    await expect(alertText(page)).toContainText('Incorrect email or password.');
    await expect(page).toHaveURL(/\/sim\/login/);
  });

  test('the 5th failure locks for 15 minutes, and a correct password is refused; unknown emails lock the same way (SIM-002)', async ({
    page,
    context,
  }) => {
    const { student } = await setup();
    for (let i = 1; i <= 4; i++) {
      await signIn(page, student.user.email, 'Wrong-pass-1');
      await expect(alertText(page)).toContainText('Incorrect email or password.');
    }
    await signIn(page, student.user.email, 'Wrong-pass-1');
    await expect(alertText(page)).toContainText('Too many attempts. Try again in 15 minutes.');
    await signIn(page, student.user.email, student.password);
    await expect(alertText(page)).toContainText('Too many attempts. Try again in 15 minutes.');
    await expect(page).toHaveURL(/\/sim\/login/);

    await ownAddress(context); // a fresh address, so only the per account lock is in play
    const ghost = `ghost-${Date.now()}@example.test`;
    for (let i = 1; i <= 4; i++) {
      await signIn(page, ghost, 'Wrong-pass-1');
      await expect(alertText(page)).toContainText('Incorrect email or password.');
    }
    await signIn(page, ghost, 'Wrong-pass-1');
    await expect(alertText(page)).toContainText('Too many attempts. Try again in 15 minutes.');
  });

  test('a disabled account gets its own message, only after the right password', async ({ page }) => {
    const { student } = await setup();
    await db.user.update({ where: { id: student.user.id }, data: { status: 'DISABLED' } });
    await signIn(page, student.user.email, student.password);
    await expect(alertText(page)).toContainText('Your account is disabled. Contact your admin.');
    await signIn(page, student.user.email, 'Wrong-pass-1');
    await expect(alertText(page)).toContainText('Incorrect email or password.');
  });

  test('an old access period on a student does not lock them out: there are no time controls', async ({
    page,
  }) => {
    const { student } = await setup();
    await db.user.update({
      where: { id: student.user.id },
      data: { accessEndsAt: new Date(Date.now() - 2 * 24 * 3_600_000) },
    });
    await signedIn(page, student.user.email, student.password);
    await expect(page).toHaveURL(/\/sim\/welcome$/);
  });

  test('the retired Admin level cannot sign in', async ({ page }) => {
    const retired = await createAccount(db, { tag: 'e2e-retired', role: 'ADMIN' });
    userIds.push(retired.user.id);
    await signIn(page, retired.user.email, retired.password);
    await expect(alertText(page)).toContainText('Incorrect email or password.');
    await expect(page).toHaveURL(/\/sim\/login/);
  });

  test('?next= is followed after sign in, and an outside address is ignored', async ({ page }) => {
    const { student } = await setup();
    await page.goto('/sim/me');
    await expect(page).toHaveURL(/\/sim\/login\?next=%2Fsim%2Fme/);
    await page.getByLabel('Email').fill(student.user.email);
    await page.getByLabel('Password').fill(student.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/sim\/me$/);

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/sim\/login$/);
    await page.goto('/sim/login?next=https%3A%2F%2Fevil.test%2F');
    await page.getByLabel('Email').fill(student.user.email);
    await page.getByLabel('Password').fill(student.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/sim\/welcome$/);
  });

  test('another site cannot sign a person out with a link, but a typed address and the button still work', async ({
    page,
  }) => {
    const { student } = await setup();
    await signedIn(page, student.user.email, student.password);
    const cross = await page.request.get('/sim/logout', {
      headers: { 'sec-fetch-site': 'cross-site' },
      maxRedirects: 0,
    });
    expect(cross.status()).toBe(303);
    await page.goto('/sim/me');
    await expect(page).toHaveURL(/\/sim\/me$/); // still signed in
    await page.goto('/sim/logout');
    await expect(page).toHaveURL(/\/sim\/login$/);
    await page.goto('/sim/me');
    await expect(page).toHaveURL(/\/sim\/login\?next=/);
  });

  test('signing out ends the session', async ({ page }) => {
    const { student } = await setup();
    await signedIn(page, student.user.email, student.password);
    await expect(page).toHaveURL(/\/sim\/welcome$/);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/sim\/login$/);
    await page.goto('/sim/me');
    await expect(page).toHaveURL(/\/sim\/login\?next=/);
  });

  test('the bootstrapped Super admin is sent to choose a new password (without changing it)', async ({
    page,
  }) => {
    const email = process.env.SEED_SUPER_ADMIN_EMAIL;
    const password = process.env.SEED_SUPER_ADMIN_PASSWORD;
    test.skip(!email || !password, 'SEED_SUPER_ADMIN_* not set');
    const row = await db.user.findUnique({ where: { email: email!.toLowerCase() } });
    test.skip(
      !row || !row.mustChangePassword || row.appRole !== 'SUPER_ADMIN',
      'bootstrap account already changed',
    );
    await signedIn(page, email!, password!);
    await expect(page).toHaveURL(/\/sim\/me\/password$/);
    await expect(
      page.getByText('You need to choose a new password before you continue.'),
    ).toBeVisible();
  });
});

test.describe('forced password change (M18-AC3)', () => {
  test('comes first, checks the policy, and after the change the old password stops working', async ({
    page,
    context,
  }) => {
    const { student } = await setup({ mustChangePassword: true });
    await signedIn(page, student.user.email, student.password);
    await expect(page).toHaveURL(/\/sim\/me\/password$/);
    await expect(page.getByLabel('Current password')).toHaveCount(0);

    // nothing else is reachable first
    await page.goto('/sim/welcome');
    await expect(page).toHaveURL(/\/sim\/me\/password$/);
    await page.goto('/p/1/home_v3');
    await expect(page).toHaveURL(/\/sim\/me\/password$/);

    const submit = async (fresh: string, confirm: string) => {
      await page.getByLabel(/^New password/).fill(fresh);
      await page.getByLabel('Confirm new password').fill(confirm);
      await page.getByRole('button', { name: 'Change password' }).click();
    };
    await submit('Ab1!', 'Ab1!');
    await expect(alertText(page)).toContainText('Use at least 10 characters.');
    await submit('Zebra4tiger9-x', 'Zebra4tiger9-y');
    await expect(alertText(page)).toContainText('The passwords do not match.');
    await submit(student.password, student.password);
    await expect(alertText(page)).toContainText(
      'Your new password must be different from the current one.',
    );

    const fresh = generatePassword();
    await submit(fresh, fresh);
    await expect(page).toHaveURL(/\/sim\/welcome$/);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: student.user.id } })).sessionVersion,
    ).toBe(1);

    // the shared password is dead, the new one works, and nothing is forced again
    await ownAddress(context);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, student.user.email, student.password);
    await expect(alertText(page)).toContainText('Incorrect email or password.');
    await signedIn(page, student.user.email, fresh);
    await expect(page).toHaveURL(/\/sim\/welcome$/);
  });

  test('a password change ends the other sessions of the same account', async ({
    page,
    browser,
  }) => {
    const { admin } = await setup();
    await db.user.update({ where: { id: admin.user.id }, data: { mustChangePassword: false } });
    await signedIn(page, admin.user.email, admin.password);
    await expect(page).toHaveURL(/\/manage\/accounts$/);

    const other = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    await ownAddress(other);
    const second = await other.newPage();
    await signedIn(second, admin.user.email, admin.password);
    await expect(second).toHaveURL(/\/manage\/accounts$/); // Super admins may sign in on two devices

    await page.goto('/sim/me/password');
    await page.getByLabel('Current password').fill(admin.password);
    const fresh = generatePassword();
    await page.getByLabel(/^New password/).fill(fresh);
    await page.getByLabel('Confirm new password').fill(fresh);
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page).toHaveURL(/\/manage\/accounts$/); // this session was re-issued

    await second.goto('/sim/me');
    await expect(second).toHaveURL(/\/sim\/session-expired\?reason=revoked$/);
    await expect(second.getByText('Your session expired. Sign in again.')).toBeVisible();
    await other.close();
  });

  test('a wrong current password is refused', async ({ page }) => {
    const { admin } = await setup();
    await db.user.update({ where: { id: admin.user.id }, data: { mustChangePassword: false } });
    await signedIn(page, admin.user.email, admin.password);
    await page.goto('/sim/me/password');
    await page.getByLabel('Current password').fill('Wrong-pass-1');
    await page.getByLabel(/^New password/).fill('Zebra4tiger9-x');
    await page.getByLabel('Confirm new password').fill('Zebra4tiger9-x');
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(alertText(page)).toContainText('Your current password is incorrect.');
  });
});

test.describe('no class windows (ADM-FIX)', () => {
  test('a student gets through to every route whatever windows an old class has', async ({
    page,
  }) => {
    const { student, classroom } = await setup();
    // an old window row that is closed (or ended long ago) decides nothing any more
    await db.accessWindow.create({
      data: {
        classroomId: classroom.id,
        label: 'Old',
        opensAt: new Date(Date.now() + 26 * 3_600_000),
        closesAt: new Date(Date.now() + 28 * 3_600_000),
        status: 'SCHEDULED',
      },
    });
    await signedIn(page, student.user.email, student.password);
    await expect(page).toHaveURL(/\/sim\/welcome$/);
    const res = await page.goto('/p/123/home_v3');
    expect(res?.status()).toBe(404); // no such partner; the point is: no redirect to a "closed" page
    await expect(page).toHaveURL(/\/p\/123\/home_v3$/);
    await page.goto('/sim/welcome');
    await expect(page).toHaveURL(/\/sim\/welcome$/);
    await expect(page.getByText('Class ends at')).toHaveCount(0);
  });

  test('the class pages and the window endpoints are gone', async ({ page }) => {
    const { student } = await setup();
    await signedIn(page, student.user.email, student.password);
    for (const url of ['/sim/closed', '/sim/scenarios', '/sim/progress']) {
      const res = await page.goto(url);
      expect(res?.status(), url).toBe(404);
    }
    for (const url of ['/api/sim/access/state', '/api/sim/access/gate']) {
      expect((await page.request.get(url)).status(), url).toBe(404);
    }
  });
});

test.describe('role guards (M18-AC4, RC-075)', () => {
  test('a student gets /sim/forbidden on manage routes and 404 on the removed instructor and admin routes', async ({
    page,
  }) => {
    const { student } = await setup();
    await signedIn(page, student.user.email, student.password);
    for (const url of [
      '/manage',
      '/manage/accounts',
      '/manage/accounts/new',
      '/manage/cohorts',
      '/manage/audit',
      '/manage/seed',
      '/manage/settings',
    ]) {
      await page.goto(url);
      await expect(page, url).toHaveURL(/\/sim\/forbidden$/);
      await expect(
        page.getByRole('heading', { name: 'You do not have access to this page' }),
      ).toBeVisible();
    }
    for (const url of ['/sim/instructor', '/sim/instructor/classes', '/sim/admin', '/sim/admin/seed']) {
      const res = await page.goto(url);
      expect(res?.status(), url).toBe(404);
    }
    // the manage APIs refuse a student too
    for (const url of ['/api/manage/accounts', '/api/manage/audit', '/api/manage/accounts.csv']) {
      expect((await page.request.get(url)).status(), url).toBe(403);
    }
    await page.goto('/sim/me');
    await expect(page.getByText(/instructor|Instructor/)).toHaveCount(0);
  });

  test('a Super admin opens /manage; the instructor and admin areas do not exist', async ({
    page,
  }) => {
    const sa = await createAccount(db, { tag: 'e2e-super', role: 'SUPER_ADMIN' });
    userIds.push(sa.user.id);
    await signedIn(page, sa.user.email, sa.password);
    await expect(page).toHaveURL(/\/manage\/accounts$/);
    for (const url of ['/manage/cohorts', '/manage/audit', '/manage/seed', '/manage/engine', '/manage/settings']) {
      const res = await page.goto(url);
      await expect(page, url).not.toHaveURL(/\/sim\/forbidden/);
      expect(res?.status(), url).toBeLessThan(500);
    }
    for (const url of ['/sim/instructor', '/sim/admin']) {
      expect((await page.goto(url))?.status(), url).toBe(404);
    }
    const res = await page.goto('/p/1/home_v3');
    await expect(page).toHaveURL(/\/p\/1\/home_v3$/);
    expect(res?.status()).toBe(404);
  });

  test('without a session every protected page goes to the login page', async ({ page }) => {
    for (const url of ['/sim/me', '/manage/accounts', '/p/1/home_v3']) {
      await page.goto(url);
      await expect(page, url).toHaveURL(/\/sim\/login\?next=/);
    }
  });

  test('AUTH_DEV_BYPASS has no effect in a production build', async ({ request }) => {
    const res = await request.get('/api/sim/provision', { maxRedirects: 0 });
    expect(res.status()).toBe(401);
  });
});

test.describe('single session (ACC-074)', () => {
  test('a second sign in on another device ends the first', async ({ page, browser }) => {
    const { student } = await setup();
    await signedIn(page, student.user.email, student.password);
    await expect(page).toHaveURL(/\/sim\/welcome$/);

    const other = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    await ownAddress(other);
    const second = await other.newPage();
    await signedIn(second, student.user.email, student.password);
    await expect(second).toHaveURL(/\/sim\/welcome$/);

    await page.goto('/sim/me');
    await expect(page).toHaveURL(/\/sim\/session-expired\?reason=other-device$/);
    await expect(
      page.getByText('You were signed out because this account signed in on another device.'),
    ).toBeVisible();
    await second.goto('/sim/me');
    await expect(second).toHaveURL(/\/sim\/me$/);
    await other.close();
  });
});

test.describe('disabled while signed in', () => {
  test('the open session ends on the next request', async ({ page }) => {
    const { student } = await setup();
    await signedIn(page, student.user.email, student.password);
    await expect(page).toHaveURL(/\/sim\/welcome$/);
    await db.user.update({
      where: { id: student.user.id },
      data: { status: 'DISABLED', sessionVersion: { increment: 1 } },
    });
    await page.goto('/sim/me');
    await expect(page).toHaveURL(/\/sim\/session-expired\?reason=revoked$/);
  });
});

test.describe('view-as (M18-AC13)', () => {
  test('shows the banner, blocks writes, and allows them once "Act as student" is on', async ({
    page,
  }) => {
    const { admin, student } = await setup();
    await db.user.update({ where: { id: admin.user.id }, data: { mustChangePassword: false } });
    await signedIn(page, admin.user.email, admin.password);
    await expect(page).toHaveURL(/\/manage\/accounts$/);

    await page.goto(`/sim/me?sim_as=${student.user.id}`);
    await expect(page.getByRole('status').filter({ hasText: 'Viewing as' })).toHaveText(
      /Viewing as Sam Student\. Read only\./,
    );
    await expect(page.getByText(student.user.email)).toBeVisible();

    await page.getByLabel('Display name').fill('Renamed By Mistake');
    await page.getByRole('button', { name: 'Save name' }).click();
    await expect(alertText(page)).toContainText('Read only');
    expect((await db.user.findUniqueOrThrow({ where: { id: student.user.id } })).name).toBe(
      'Sam Student',
    );

    await page.getByRole('link', { name: 'Act as student' }).click();
    await expect(page).toHaveURL(
      new RegExp(`sim_as=${student.user.id}&sim_act=1|sim_act=1&sim_as=${student.user.id}`),
    );
    await expect(page.getByRole('status').filter({ hasText: 'Viewing as' })).toContainText(
      'Your changes are saved to their account.',
    );
    await page.getByLabel('Display name').fill('Sam Renamed');
    await page.getByRole('button', { name: 'Save name' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();
    expect((await db.user.findUniqueOrThrow({ where: { id: student.user.id } })).name).toBe(
      'Sam Renamed',
    );
    const audit = await db.auditLog.findFirst({
      where: { targetUserId: student.user.id, action: 'ACCOUNT_UPDATED' },
    });
    expect(audit).toMatchObject({ actorUserId: admin.user.id, actorRole: 'SUPER_ADMIN' });

    await page.getByRole('link', { name: 'Exit' }).click();
    await expect(page).toHaveURL(/\/sim\/me$/);
    await expect(page.getByText(admin.user.email)).toBeVisible();
    await expect(page.getByText('Viewing as')).toHaveCount(0);
  });

  test('a student gets no view-as', async ({ browser }) => {
    const { admin, student } = await setup();
    const other = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    await ownAddress(other);
    const p2 = await other.newPage();
    await signedIn(p2, student.user.email, student.password);
    await p2.goto(`/sim/me?sim_as=${admin.user.id}&sim_act=1`);
    await expect(p2.getByText('Viewing as')).toHaveCount(0);
    await expect(p2.getByText(student.user.email)).toBeVisible();
    await other.close();
  });
});

test.describe('plumbing', () => {
  test('/ng_nav/** is a permanent redirect to /** (routes R1)', async ({ request }) => {
    const res = await request.get('/ng_nav/sim/login?x=1', { maxRedirects: 0 });
    expect(res.status()).toBe(308);
    expect(res.headers()['location']).toMatch(/\/sim\/login\?x=1$/);
  });

  test('the login page cannot be framed and is never cached', async ({ request }) => {
    const res = await request.get('/sim/login');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers()['cache-control']).toContain('no-store');
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
  });

  test('the public pages stay public', async ({ request }) => {
    expect((await request.get('/')).status()).toBe(200);
    expect((await request.get('/api/health')).status()).toBe(200);
    expect((await request.get('/sim/session-expired?reason=idle')).status()).toBe(200);
    expect((await request.get('/brand/adsmentor-logo-horizontal.png')).status()).toBe(200);
  });

  test('the engine timer endpoint needs the cron secret, and the window tick is gone', async ({
    request,
  }) => {
    expect((await request.post('/api/sim/engine/tick')).status()).toBe(401);
    expect(
      (
        await request.post('/api/sim/engine/tick', { headers: { authorization: 'Bearer wrong' } })
      ).status(),
    ).toBe(401);
    expect((await request.post('/api/sim/access/tick')).status()).toBe(401); // no session, no route
  });
});
