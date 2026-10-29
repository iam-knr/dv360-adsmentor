// P3-INT: /sim/admin/seed is for Super admins only and builds the demo class and the template sandboxes.
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';
import { cleanup, createAccount } from '../auth/fixtures';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
const userIds: string[] = [];
let superAdmin: Awaited<ReturnType<typeof createAccount>>;
let admin: Awaited<ReturnType<typeof createAccount>>;

test.beforeAll(async () => {
  superAdmin = await createAccount(db, { tag: 'seed-super', role: 'SUPER_ADMIN' });
  admin = await createAccount(db, { tag: 'seed-admin', role: 'ADMIN' });
  userIds.push(superAdmin.user.id, admin.user.id);
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

test('an Admin is sent to the forbidden page', async ({ page }) => {
  await signIn(page, admin);
  await page.goto('/sim/admin/seed');
  await expect(page).toHaveURL(/\/sim\/forbidden$/);
});

test('a Super admin seeds the demo class and the templates, and a short password is refused', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await signIn(page, superAdmin);
  await page.goto('/sim/admin/seed');
  await expect(page).toHaveTitle(/Seed/);
  await page.getByLabel(/Password for new demo accounts/).fill('short');
  await page.getByRole('button', { name: /Seed demo class/ }).click();
  await expect(page.getByText('The password needs at least 10 characters.')).toBeVisible();

  await page.getByLabel(/Password for new demo accounts/).fill('demo-class-pass-1');
  await page.getByRole('button', { name: /Seed demo class/ }).click();
  await expect(page.getByText('Seeding finished.')).toBeVisible({ timeout: 150_000 });
  const demo = await db.classroom.findUnique({ where: { code: 'DEMO' } });
  expect(demo).not.toBeNull();
  expect(
    await db.sandbox.count({ where: { classroomId: demo!.id, provisionState: 'READY' } }),
  ).toBe(3);
});
