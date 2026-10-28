// Playwright flows for P3-02 (login, lockout, forced password change, class windows, role guards, view-as).
// Every test makes its own accounts (synthetic @example.test addresses, passwords generated per run) in the test
// database, so the specs can run in any order and more than once. Each test also uses its own client address
// (x-forwarded-for) so the per address failure limit of one test cannot hit another.
import { PrismaClient } from '@prisma/client';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { generatePassword } from '@/lib/auth/argon';
import {
  cleanup,
  createAccount,
  createClassroom,
  createStudent,
  type WindowKind,
} from '../auth/fixtures';

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

async function setup(windows: WindowKind = 'open', opts: { mustChangePassword?: boolean } = {}) {
  const admin = await createAccount(db, {
    tag: 'e2e-admin',
    role: 'ADMIN',
    name: 'Anita Instructor',
  });
  const classroom = await createClassroom(db, { tag: 'e2e', ownerAdminId: admin.user.id, windows });
  const student = await createStudent(db, {
    tag: 'e2e-stu',
    classroomId: classroom.id,
    ownerAdminId: admin.user.id,
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
  test('a student with the right password during an open window lands on the welcome page (M18-AC1)', async ({
    page,
  }) => {
    const { student } = await setup('open');
    await signedIn(page, student.user.email, student.password);
    await expect(page).toHaveURL(/\/sim\/welcome$/);
    await expect(page.getByRole('heading', { name: 'Welcome, Sam Student' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'AdsMentor' })).toBeVisible();
  });

  test('the login page uses the AdsMentor logo and the exact field labels', async ({ page }) => {
    await page.goto('/sim/login');
    const logo = page.getByRole('img', { name: 'AdsMentor' });
    await expect(logo).toBeVisible();
    expect(await logo.getAttribute('src')).toContain('/brand/adsmentor-logo-horizontal.png');
    expect(await logo.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByText('Forgot your password? Ask your admin.')).toBeVisible();
  });

  test('wrong password and unknown email show the same message (M18-AC2)', async ({ page }) => {
    const { student } = await setup('open');
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
    const { student } = await setup('open');
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

  test('a disabled account and an ended access period get their own messages, only after the right password', async ({
    page,
  }) => {
    const { student } = await setup('open');
    await db.user.update({ where: { id: student.user.id }, data: { status: 'DISABLED' } });
    await signIn(page, student.user.email, student.password);
    await expect(alertText(page)).toContainText('Your account is disabled. Contact your admin.');
    await signIn(page, student.user.email, 'Wrong-pass-1');
    await expect(alertText(page)).toContainText('Incorrect email or password.');

    const endedAt = new Date(Date.now() - 2 * 24 * 3_600_000);
    const endedOn = new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    }).format(endedAt);
    await db.user.update({
      where: { id: student.user.id },
      data: { status: 'ACTIVE', accessEndsAt: endedAt },
    });
    await signIn(page, student.user.email, student.password);
    await expect(alertText(page)).toContainText(
      `Your access ended on ${endedOn}. Contact your admin.`,
    );
  });

  test('?next= is followed after sign in, and an outside address is ignored', async ({ page }) => {
    const { student } = await setup('open');
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
    const { student } = await setup('open');
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
    const { student } = await setup('open');
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
    const { student } = await setup('open', { mustChangePassword: true });
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
    const { admin } = await setup('open');
    await db.user.update({ where: { id: admin.user.id }, data: { mustChangePassword: false } });
    await signedIn(page, admin.user.email, admin.password);
    await expect(page).toHaveURL(/\/sim\/instructor$/);

    const other = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    await ownAddress(other);
    const second = await other.newPage();
    await signedIn(second, admin.user.email, admin.password);
    await expect(second).toHaveURL(/\/sim\/instructor$/); // admins may sign in on two devices

    await page.goto('/sim/me/password');
    await page.getByLabel('Current password').fill(admin.password);
    const fresh = generatePassword();
    await page.getByLabel(/^New password/).fill(fresh);
    await page.getByLabel('Confirm new password').fill(fresh);
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page).toHaveURL(/\/sim\/instructor$/); // this session was re-issued

    await second.goto('/sim/me');
    await expect(second).toHaveURL(/\/sim\/session-expired\?reason=revoked$/);
    await expect(second.getByText('Your session expired. Sign in again.')).toBeVisible();
    await other.close();
  });

  test('a wrong current password is refused', async ({ page }) => {
    const { admin } = await setup('open');
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

test.describe('class access window (M18-AC1, M18-AC5)', () => {
  test('a closed class sends the student to /sim/closed for every DV360 URL', async ({ page }) => {
    const { student, admin } = await setup('closed');
    await signedIn(page, student.user.email, student.password);
    await expect(page).toHaveURL(/\/sim\/closed$/);
    await expect(page.getByRole('heading', { name: 'Class is not open right now' })).toBeVisible();
    await expect(page.getByText(/Your next class opens on .* \(Asia\/Kolkata\)\./)).toBeVisible();
    await expect(
      page.getByText(new RegExp(`${admin.user.name}.*${admin.user.email}`)),
    ).toBeVisible();

    for (const url of [
      '/p/123/home_v3',
      '/a/456/cs',
      '/ng_nav/p/123/home_v3',
      '/sim/welcome',
      '/sim/scenarios',
    ]) {
      await page.goto(url);
      await expect(page, url).toHaveURL(/\/sim\/closed$/);
    }
    // the profile and password pages stay reachable
    await page.goto('/sim/me');
    await expect(page).toHaveURL(/\/sim\/me$/);
  });

  test('an open class lets the student through to the DV360 routes', async ({ page }) => {
    const { student } = await setup('open');
    await signedIn(page, student.user.email, student.password);
    const res = await page.goto('/p/123/home_v3');
    expect(res?.status()).toBe(404); // no DV360 page exists yet (P3-03); the point is: no redirect to /sim/closed
    await expect(page).toHaveURL(/\/p\/123\/home_v3$/);
    await page.goto('/sim/closed');
    await expect(page).toHaveURL(/\/sim\/welcome$/); // nothing to see while the class is open
  });

  test('a class that opens later lets the same session in', async ({ page }) => {
    const { student, classroom } = await setup('closed');
    await signedIn(page, student.user.email, student.password);
    await expect(page).toHaveURL(/\/sim\/closed$/);
    await db.accessWindow.updateMany({
      where: { classroomId: classroom.id },
      data: {
        opensAt: new Date(Date.now() - 60_000),
        closesAt: new Date(Date.now() + 3_600_000),
        status: 'OPEN',
      },
    });
    await page.goto('/sim/welcome');
    await expect(page).toHaveURL(/\/sim\/welcome$/);
  });

  test('the last five minutes show a warning banner', async ({ page }) => {
    const { student } = await setup('closing-soon');
    await signedIn(page, student.user.email, student.password);
    await expect(page).toHaveURL(/\/sim\/welcome$/);
    await expect(page.getByText(/^Class ends at .*\. Save your work\.$/)).toBeVisible();
  });

  test('the state endpoint tells the shell when the class closes', async ({ page }) => {
    const { student } = await setup('closing-soon');
    await signedIn(page, student.user.email, student.password);
    const res = await page.request.get('/api/sim/access/state');
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      classOpen: boolean;
      closesAt: string;
      banner: string;
      user: { role: string };
    };
    expect(body.classOpen).toBe(true);
    expect(body.user.role).toBe('user');
    expect(new Date(body.closesAt).getTime()).toBeGreaterThan(Date.now());
    expect(body.banner).toMatch(/^Class ends at /);

    // the middleware stops caching "open" at the end of the class
    const gate = (await (await page.request.get('/api/sim/access/gate')).json()) as {
      open: boolean;
      until: number;
    };
    expect(gate.open).toBe(true);
    expect(gate.until).toBe(new Date(body.closesAt).getTime());
  });
});

test.describe('role guards (M18-AC4, RC-075)', () => {
  test('a student gets /sim/forbidden on instructor, admin and manage routes', async ({ page }) => {
    const { student } = await setup('open');
    await signedIn(page, student.user.email, student.password);
    for (const url of [
      '/sim/instructor',
      '/sim/instructor/classes',
      '/sim/admin',
      '/manage/accounts',
      '/manage/settings',
    ]) {
      await page.goto(url);
      await expect(page, url).toHaveURL(/\/sim\/forbidden$/);
      await expect(
        page.getByRole('heading', { name: 'You do not have access to this page' }),
      ).toBeVisible();
    }
  });

  test('an admin opens instructor routes but not super admin ones or settings', async ({
    page,
  }) => {
    const { admin } = await setup('open');
    await signedIn(page, admin.user.email, admin.password);
    await expect(page).toHaveURL(/\/sim\/instructor$/);
    await expect(page.getByRole('heading', { name: 'Instructor console' })).toBeVisible();
    await page.goto('/sim/admin');
    await expect(page).toHaveURL(/\/sim\/forbidden$/);
    await page.goto('/manage/settings');
    await expect(page).toHaveURL(/\/sim\/forbidden$/);
    await page.goto('/manage/accounts');
    await expect(page).not.toHaveURL(/\/sim\/forbidden/);
  });

  test('a super admin opens everything and skips the class window', async ({ page }) => {
    const sa = await createAccount(db, { tag: 'e2e-super', role: 'SUPER_ADMIN' });
    userIds.push(sa.user.id);
    await signedIn(page, sa.user.email, sa.password);
    await expect(page).toHaveURL(/\/sim\/admin$/);
    await expect(page.getByRole('heading', { name: 'Super admin' })).toBeVisible();
    await page.goto('/sim/instructor');
    await expect(page).toHaveURL(/\/sim\/instructor$/);
    await page.goto('/manage/settings');
    await expect(page).not.toHaveURL(/\/sim\/forbidden/);
    const res = await page.goto('/p/1/home_v3');
    await expect(page).toHaveURL(/\/p\/1\/home_v3$/);
    expect(res?.status()).toBe(404);
  });

  test('without a session every protected page goes to the login page', async ({ page }) => {
    for (const url of ['/sim/me', '/sim/instructor', '/manage/accounts', '/p/1/home_v3']) {
      await page.goto(url);
      await expect(page, url).toHaveURL(/\/sim\/login\?next=/);
    }
  });

  test('AUTH_DEV_BYPASS has no effect in a production build', async ({ request }) => {
    const res = await request.get('/api/sim/access/state', { maxRedirects: 0 });
    expect(res.status()).toBe(401);
  });
});

test.describe('single session (ACC-074)', () => {
  test('a second sign in on another device ends the first', async ({ page, browser }) => {
    const { student } = await setup('open');
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
    const { student } = await setup('open');
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
    const { admin, student } = await setup('open');
    await db.user.update({ where: { id: admin.user.id }, data: { mustChangePassword: false } });
    await signedIn(page, admin.user.email, admin.password);
    await expect(page).toHaveURL(/\/sim\/instructor$/);

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
    expect(audit).toMatchObject({ actorUserId: admin.user.id, actorRole: 'ADMIN' });

    await page.getByRole('link', { name: 'Exit' }).click();
    await expect(page).toHaveURL(/\/sim\/me$/);
    await expect(page.getByText(admin.user.email)).toBeVisible();
    await expect(page.getByText('Viewing as')).toHaveCount(0);
  });

  test('an admin of another cohort and a student get no view-as', async ({ page, browser }) => {
    const { admin, student } = await setup('open');
    const stranger = await createAccount(db, { tag: 'e2e-stranger', role: 'ADMIN' });
    userIds.push(stranger.user.id);

    await signedIn(page, stranger.user.email, stranger.password);
    await page.goto(`/sim/me?sim_as=${student.user.id}`);
    await expect(page.getByText('Viewing as')).toHaveCount(0);
    await expect(page.getByText(stranger.user.email)).toBeVisible();

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

  test('the window tick endpoint needs the cron secret', async ({ request }) => {
    expect((await request.post('/api/sim/access/tick')).status()).toBe(401);
    expect(
      (
        await request.post('/api/sim/access/tick', { headers: { authorization: 'Bearer wrong' } })
      ).status(),
    ).toBe(401);
    const secret = process.env.CRON_SECRET;
    test.skip(!secret, 'CRON_SECRET not set for this run');
    const ok = await request.post('/api/sim/access/tick', {
      headers: { authorization: `Bearer ${secret!}` },
    });
    expect(ok.status()).toBe(200);
    expect(await ok.json()).toMatchObject({ ok: true });
  });
});
