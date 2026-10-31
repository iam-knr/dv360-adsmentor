// P3-INT: /manage/seed is for the Super admin only and builds the demo cohort and the template sandboxes (it moved
// from /sim/admin/seed when the Admin level was removed, ADM-FIX).
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';
import { cleanup, createAccount } from '../auth/fixtures';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
const userIds: string[] = [];
let superAdmin: Awaited<ReturnType<typeof createAccount>>;
let student: Awaited<ReturnType<typeof createAccount>>;

test.beforeAll(async () => {
  superAdmin = await createAccount(db, { tag: 'seed-super', role: 'SUPER_ADMIN' });
  student = await createAccount(db, { tag: 'seed-student', role: 'USER' });
  userIds.push(superAdmin.user.id, student.user.id);
});
test.afterAll(async () => {
  await cleanup(db, { userIds, classroomIds: [] });
  await db.$disconnect();
});

async function signIn(page: Page, who: typeof superAdmin) {
  await page.goto('/sim/login');
  await page.getByLabel('Email').fill(who.user.email);
  await page.getByLabel('Password').fill(who.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sim/login'));
}

test('a student is sent to the forbidden page, and the old admin address is gone', async ({ page }) => {
  await signIn(page, student);
  await page.goto('/manage/seed');
  await expect(page).toHaveURL(/\/sim\/forbidden$/);
  expect((await page.goto('/sim/admin/seed'))?.status()).toBe(404);
});

test('the Super admin seeds the demo cohort and the templates, and a short password is refused', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await signIn(page, superAdmin);
  await page.goto('/manage/seed');
  await expect(page).toHaveTitle(/Seed/);
  await page.getByLabel(/Password for new demo accounts/).fill('short');
  await page.getByRole('button', { name: /Seed demo data/ }).click();
  await expect(page.getByText('The password needs at least 10 characters.')).toBeVisible();

  await page.getByLabel(/Password for new demo accounts/).fill('demo-class-pass-1');
  await page.getByRole('button', { name: /Seed demo data/ }).click();
  await expect(page.getByText('Seeding finished.')).toBeVisible({ timeout: 150_000 });
  const demo = await db.classroom.findUnique({ where: { code: 'DEMO' } });
  expect(demo).not.toBeNull();
  expect(
    await db.sandbox.count({ where: { classroomId: demo!.id, provisionState: 'READY' } }),
  ).toBe(3);
});
