// Playwright flows for P5-01 (instructor console): class status, access windows, roster with the one-time password,
// sandbox reset with confirmations, role guards, announcements, certificate requests and the Super admin pages.
// Accounts are synthetic (@example.test) and passwords are generated per run.
import { PrismaClient } from '@prisma/client';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { seedReferenceData } from '@/lib/seed/reference-db';
import { provisionSandbox } from '@/lib/seed/sandbox';
import { cleanup, createAccount, createClassroom, createStudent, uniq } from '../auth/fixtures';

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
    where: { email: { endsWith: '@ins-e2e.example.test' } },
    select: { id: true },
  });
  const ids = [...userIds, ...made.map((u) => u.id)];
  await db.notification.deleteMany({ where: { createdById: { in: ids } } });
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

async function teacher(windows: 'open' | 'none' | 'closed' = 'none') {
  const admin = await createAccount(db, { tag: 'ins-admin', role: 'ADMIN', name: 'Ira Instructor' });
  const cohort = await createClassroom(db, { tag: 'ins', ownerAdminId: admin.user.id, windows });
  await db.classroomMember.create({
    data: { classroomId: cohort.id, userId: admin.user.id, appRole: 'ADMIN' },
  });
  userIds.push(admin.user.id);
  classroomIds.push(cohort.id);
  return { admin, cohort };
}

test('E2E-INS-01 Open now opens the class and Close now closes it; the student is sent to /sim/closed', async ({
  page,
  browser,
}) => {
  const { admin, cohort } = await teacher('none');
  const stu = await createStudent(db, { tag: 'ins-stu', classroomId: cohort.id, clockState: 'RUNNING' });
  userIds.push(stu.user.id);
  await signedIn(page, admin.user.email, admin.password);
  await page.goto('/sim/instructor');
  await expect(page.getByTestId('class-status')).toContainText('Closed');
  await page.getByRole('button', { name: 'Open now' }).click();
  await expect(page.getByTestId('class-status')).toContainText('Open');
  await expect(page.getByText('1 active')).toBeVisible();
  const win = await db.accessWindow.findFirstOrThrow({ where: { classroomId: cohort.id } });
  expect(win.label).toBe('Opened manually');
  expect(win.closesAt.getTime() - win.opensAt.getTime()).toBe(2 * 3_600_000);

  // the student gets in while it is open
  const ctx = await browser.newContext();
  await ctx.setExtraHTTPHeaders({ 'x-forwarded-for': '10.91.1.1', ...(bypass ? { 'x-vercel-protection-bypass': bypass } : {}) });
  const sp = await ctx.newPage();
  await signedIn(sp, stu.user.email, stu.password);
  await sp.goto('/sim/welcome');
  await expect(sp).toHaveURL(/\/sim\/welcome$/);

  await page.getByRole('button', { name: 'Close now' }).click();
  await expect(page.getByTestId('class-status')).toContainText('Closed');
  expect((await db.sandbox.findUniqueOrThrow({ where: { id: stu.sandbox.id } })).status).toBe('FROZEN');
  await sp.goto('/sim/welcome');
  await expect(sp).toHaveURL(/\/sim\/closed$/);
  await ctx.close();
});

test('E2E-INS-02 access windows: weekly series, edit, delete, and an open window is locked', async ({ page }) => {
  const { admin, cohort } = await teacher('none');
  await signedIn(page, admin.user.email, admin.password);
  await page.goto(`/sim/instructor/classes/${cohort.id}/access`);
  await expect(page.getByText('No access windows yet')).toBeVisible();

  await page.getByRole('button', { name: 'New window' }).click();
  const dlg = page.getByRole('dialog', { name: 'New access window' });
  await dlg.getByLabel('Label').fill('Weekly lab');
  await dlg.getByLabel('Date').fill('2030-03-04'); // a Monday
  await dlg.getByLabel('Start').fill('10:00');
  await dlg.getByLabel('End').fill('12:00');
  await dlg.getByLabel('Repeat weekly').check();
  await dlg.getByLabel('Mon').check();
  await dlg.getByLabel('Repeat until').fill('2030-03-25');
  await dlg.getByRole('button', { name: 'Save' }).click();
  await expect(dlg).toBeHidden();
  const rows = await db.accessWindow.findMany({ where: { classroomId: cohort.id }, orderBy: { opensAt: 'asc' } });
  expect(rows).toHaveLength(4);
  expect(new Set(rows.map((r) => r.seriesId)).size).toBe(1);
  expect(rows[0]!.opensAt.toISOString()).toBe('2030-03-04T04:30:00.000Z');

  // delete this and later windows of the series from the second one
  await page.getByRole('row', { name: /Weekly lab/ }).nth(1).getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Delete' }).click();
  const del = page.getByRole('dialog', { name: 'Delete window?' });
  await del.getByLabel('Delete').click();
  await page.getByRole('option', { name: /This and later/ }).click();
  await del.getByRole('button', { name: 'Delete' }).click();
  await expect(del).toBeHidden();
  const after = await db.accessWindow.findMany({ where: { classroomId: cohort.id }, orderBy: { opensAt: 'asc' } });
  expect(after.map((r) => r.status)).toEqual(['SCHEDULED', 'CANCELLED', 'CANCELLED', 'CANCELLED']);

  // an open window cannot be deleted: SIM-007 from the service even on a forged call; the buttons are disabled
  await page.getByRole('button', { name: 'Open now' }).click();
  await expect(page.getByRole('gridcell', { name: 'Opened manually' })).toBeVisible();
  await page.getByRole('row', { name: /Opened manually/ }).getByRole('checkbox').check();
  await expect(page.getByRole('button', { name: 'Delete' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Edit' })).toBeDisabled();
});

test('E2E-INS-03 roster: add students, the passwords show once, the student must change it; reset password', async ({
  page,
  browser,
}) => {
  const { admin, cohort } = await teacher('open');
  await signedIn(page, admin.user.email, admin.password);
  await page.goto(`/sim/instructor/classes/${cohort.id}`);
  const e1 = `${uniq('r1')}@ins-e2e.example.test`;
  const e2 = `${uniq('r2')}@ins-e2e.example.test`;
  await page.getByRole('button', { name: 'Add students' }).first().click();
  const dlg = page.getByRole('dialog', { name: 'Add students' });
  await dlg.getByLabel('Students, one per line as name,email').fill(`Asha Rao,${e1}\nBo Lee,${e2}\nBroken Row,nope`);
  await dlg.getByRole('button', { name: 'Add students' }).click();

  const secret = page.getByRole('dialog', { name: '2 new passwords' });
  await expect(secret).toBeVisible();
  await secret.getByRole('button', { name: 'Show' }).click();
  const pws = (await secret.getByTestId('secret-value').allInnerTexts()).map((t) => t.trim());
  expect(pws).toHaveLength(2);
  expect(pws.every((p) => p.length === 16)).toBe(true);
  await secret.getByLabel('I have saved the password').check();
  await secret.getByRole('button', { name: 'Done' }).click();
  await expect(secret).toBeHidden();
  await expect(page.getByText('1 not added')).toBeVisible();
  await expect(page.getByText('nope: Enter a valid email address.')).toBeVisible();
  await expect(page.getByRole('gridcell', { name: e1 })).toBeVisible();
  await expect(page.getByRole('gridcell', { name: 'PREPARING' }).first()).toBeVisible();
  // gone from the page, the URL and browser storage
  const html = await page.content();
  for (const p of pws) expect(html).not.toContain(p);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(pws[0]!);

  const u1 = await db.user.findUniqueOrThrow({ where: { email: e1 } });
  expect(u1).toMatchObject({ cohortId: cohort.id, appRole: 'USER', mustChangePassword: true });

  // the student signs in with the shown password and must change it
  const ctx = await browser.newContext();
  await ctx.setExtraHTTPHeaders({ 'x-forwarded-for': '10.92.1.1', ...(bypass ? { 'x-vercel-protection-bypass': bypass } : {}) });
  const sp = await ctx.newPage();
  await sp.goto('/sim/login');
  await sp.getByLabel('Email').fill(e1);
  await sp.getByLabel('Password').fill(pws[0]!);
  await sp.getByRole('button', { name: 'Sign in' }).click();
  await sp.waitForURL('**/sim/me/password**');
  await ctx.close();

  // reset password: a new one is shown once and the old one stops working
  await page.getByRole('row', { name: new RegExp(e1) }).getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Reset password' }).click();
  await page.getByRole('dialog', { name: 'Reset password?' }).getByRole('button', { name: 'Reset password' }).click();
  const again = page.getByRole('dialog', { name: 'Password' });
  await expect(again).toBeVisible();
  await again.getByRole('button', { name: 'Show' }).click();
  const fresh = (await again.getByTestId('secret-value').innerText()).trim();
  expect(fresh).toHaveLength(16);
  expect(fresh).not.toBe(pws[0]);
  const u1b = await db.user.findUniqueOrThrow({ where: { email: e1 } });
  expect(u1b.sessionVersion).toBe(u1.sessionVersion + 1);
});

test('E2E-INS-04 sandboxes: reset one student with RESET, the whole class with its name; other students untouched', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await seedReferenceData(db);
  const { admin, cohort } = await teacher('none');
  await db.classroom.update({ where: { id: cohort.id }, data: { defaultSeedTemplate: 'healthy' } });
  const a = await createAccount(db, { tag: 'ins-sa', role: 'USER', cohortId: cohort.id, name: 'Alpha Student' });
  const b = await createAccount(db, { tag: 'ins-sb', role: 'USER', cohortId: cohort.id, name: 'Bravo Student' });
  await db.classroomMember.createMany({ data: [{ classroomId: cohort.id, userId: a.user.id }, { classroomId: cohort.id, userId: b.user.id }] });
  userIds.push(a.user.id, b.user.id);

  await signedIn(page, admin.user.email, admin.password);
  // the roster builds the missing sandboxes
  await page.goto(`/sim/instructor/classes/${cohort.id}`);
  for (const name of ['Alpha Student', 'Bravo Student']) {
    await page.getByRole('row', { name: new RegExp(name) }).getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Create sandbox' }).click();
    // the job builds in steps: a slow machine leaves BUILDING after the click, so reload until it is READY
    await expect(async () => {
      await page.reload();
      await expect(page.getByRole('row', { name: new RegExp(name) }).getByRole('gridcell', { name: 'READY' })).toBeVisible({ timeout: 4_000 });
    }).toPass({ timeout: 120_000, intervals: [3_000] });
  }
  const sb = async (uid: string) => db.sandbox.findFirstOrThrow({ where: { classroomId: cohort.id, ownerUserId: uid } });

  await page.goto(`/sim/instructor/sandboxes?class=${cohort.id}`);
  await page.getByRole('row', { name: /Alpha Student/ }).getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Reset selected' }).click();
  const one = page.getByRole('dialog', { name: 'Reset 1 sandbox?' });
  await expect(one.getByRole('button', { name: 'Reset' })).toBeDisabled(); // nothing typed
  await one.getByLabel('Confirmation').fill('nope');
  await one.getByRole('button', { name: 'Reset' }).click();
  await expect(one.getByRole('alert')).toContainText('Type RESET to confirm.');
  await one.getByLabel('Confirmation').fill('RESET');
  await one.getByRole('button', { name: 'Reset' }).click();
  await expect(page.getByText('1 sandbox reset.')).toBeVisible({ timeout: 90_000 });
  expect((await sb(a.user.id)).resetCount).toBe(1);
  expect((await sb(b.user.id)).resetCount).toBe(0);

  await page.getByRole('button', { name: 'Reset whole class' }).click();
  const all = page.getByRole('dialog', { name: 'Reset the whole class?' });
  await all.getByLabel('Confirmation').fill('RESET');
  await all.getByRole('button', { name: 'Reset' }).click();
  await expect(all.getByRole('alert')).toContainText('Type the class name to confirm.');
  await all.getByLabel('Confirmation').fill(cohort.name);
  await all.getByRole('button', { name: 'Reset' }).click();
  await expect(page.getByText('2 sandboxes reset.')).toBeVisible({ timeout: 150_000 });
  expect((await sb(a.user.id)).resetCount).toBe(2);
  expect((await sb(b.user.id)).resetCount).toBe(1);
  expect(await db.auditLog.count({ where: { classroomId: cohort.id, action: { in: ['SANDBOX_RESET', 'CLASS_RESET'] } } })).toBe(2);
});

test('E2E-INS-05 role guards: a student and a stranger cannot reach a class; an unknown class is the 404 page', async ({
  page,
  browser,
}) => {
  const { admin, cohort } = await teacher('open');
  const stranger = await createAccount(db, { tag: 'ins-stranger', role: 'ADMIN' });
  const stu = await createStudent(db, { tag: 'ins-g', classroomId: cohort.id });
  userIds.push(stranger.user.id, stu.user.id);

  const sp = await browser.newPage({ extraHTTPHeaders: { 'x-forwarded-for': '10.93.1.1' } });
  await signedIn(sp, stu.user.email, stu.password);
  for (const url of [`/sim/instructor/classes/${cohort.id}`, `/sim/instructor/classes/${cohort.id}/access`, '/sim/instructor/sandboxes', '/sim/admin/audit', '/sim/admin/classes']) {
    await sp.goto(url);
    await expect(sp, url).toHaveURL(/\/sim\/forbidden$/);
  }
  await sp.close();

  const other = await browser.newPage({ extraHTTPHeaders: { 'x-forwarded-for': '10.93.1.2' } });
  await signedIn(other, stranger.user.email, stranger.password);
  const res = await other.goto(`/sim/instructor/classes/${cohort.id}`);
  expect(res?.status()).toBe(404);
  const csv = await other.request.get(`/sim/instructor/classes/${cohort.id}/roster.csv`);
  expect(csv.status()).toBe(404);
  await other.goto('/sim/admin/audit');
  await expect(other).toHaveURL(/\/sim\/forbidden$/);
  await other.close();

  await signedIn(page, admin.user.email, admin.password);
  expect((await page.goto('/sim/instructor/classes/does-not-exist'))?.status()).toBe(404);
  const mine = await page.request.get(`/sim/instructor/classes/${cohort.id}/roster.csv`);
  expect(mine.status()).toBe(200);
  const text = await mine.text();
  expect(text).toContain(stu.user.email);
  expect(text).not.toMatch(/password|argon/i);
});

test('E2E-INS-06 announcements reach the class bell; certificate requests are approved', async ({ page }) => {
  test.setTimeout(180_000);
  await seedReferenceData(db);
  const { admin, cohort } = await teacher('open');
  const stu = await createStudent(db, { tag: 'ins-ann', classroomId: cohort.id });
  userIds.push(stu.user.id);
  await signedIn(page, admin.user.email, admin.password);

  await page.goto('/sim/instructor/announcements');
  await page.getByLabel('Title').fill('Lab moved to room 4');
  await page.getByLabel('Message').fill('Same time, new room.');
  await page.getByRole('button', { name: 'Send announcement' }).click();
  await expect(page.getByText('Announcement sent.')).toBeVisible();
  await expect(page.getByText('Lab moved to room 4').first()).toBeVisible();
  const row = await db.notification.findFirstOrThrow({ where: { classroomId: cohort.id, title: 'Lab moved to room 4' } });
  expect(row.createdById).toBe(admin.user.id);
  expect(await db.auditLog.count({ where: { action: 'ANNOUNCEMENT_CREATED', targetId: row.id } })).toBe(1);

  // certificate request: needs an advertiser, so the student's sandbox is built from the seed
  await provisionSandbox(db, {
    classroomId: cohort.id,
    ownerUserId: stu.user.id,
    name: 'Sandbox E2E',
    template: 'healthy',
    kind: 'STUDENT',
    seedValue: 7,
    partnerName: 'Sandbox E2E',
  });
  const adv = await db.advertiser.findFirstOrThrow({ where: { sandboxId: stu.sandbox.id } });
  const cert = await db.policyCertificate.create({
    data: { sandboxId: stu.sandbox.id, advertiserId: adv.id, kind: 'CRYPTOCURRENCY', status: 'REQUESTED', countryCode: 'IN' },
  });
  await page.goto('/sim/instructor/requests');
  await page.getByRole('row', { name: new RegExp(adv.name) }).getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('No requests waiting.')).toBeVisible();
  const decided = await db.policyCertificate.findUniqueOrThrow({ where: { id: cert.id } });
  expect(decided).toMatchObject({ status: 'APPROVED', decidedById: admin.user.id });
});

test('E2E-INS-07 the Super admin sees classes, the audit log with filters, and engine parameters', async ({ page }) => {
  const { admin, cohort } = await teacher('none');
  const sa = await createAccount(db, { tag: 'ins-super', role: 'SUPER_ADMIN' });
  userIds.push(sa.user.id);
  // the instructor leaves an audit row
  await db.auditLog.create({ data: { actorUserId: admin.user.id, actorRole: 'ADMIN', classroomId: cohort.id, action: 'CLASS_OPENED', targetType: 'Classroom', targetId: cohort.id } });

  await signedIn(page, sa.user.email, sa.password);
  await page.goto('/sim/admin');
  for (const name of ['Classes', 'Seed', 'Engine', 'Audit log']) {
    await expect(page.getByRole('main').getByRole('heading', { name })).toBeVisible();
  }
  await page.goto('/sim/admin/classes');
  await expect(page.getByRole('link', { name: cohort.name })).toBeVisible();
  await page.goto(`/sim/admin/audit?class=${cohort.id}&action=CLASS_OPENED`);
  await expect(page.getByRole('cell', { name: 'CLASS_OPENED' }).first()).toBeVisible();
  await expect(page.getByText('1 entries')).toBeVisible();
  await page.goto(`/sim/admin/audit?class=${cohort.id}&action=CLASS_CLOSED`);
  await expect(page.getByText('0 entries')).toBeVisible();
  await page.goto('/sim/admin/engine');
  await expect(page.getByTestId('engine-version')).toContainText(/Version [0-9a-f]{12}/);
  await page.goto('/sim/admin/users');
  await expect(page).toHaveURL(/\/manage\/accounts/);
});
