// P3-06b: PW-06-01 create a campaign, PW-06-02 validation, PW-07-01 create an insertion order from step 1.
// Synthetic student in the test database, signed in through /sim/login (same pattern as shell.spec.ts).
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';
import { cleanup } from '../auth/fixtures';
import { createShellWorld, type ShellWorld } from '../shell/e2e-world';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
let w: ShellWorld;

test.beforeAll(async () => {
  w = await createShellWorld(db, { tag: `pw06b-${Date.now()}` });
});
test.afterAll(async () => {
  await cleanup(db, { userIds: w.userIds, classroomIds: [w.classroomId] });
  await db.$disconnect();
});

async function signIn(page: Page) {
  await page.goto('/sim/login');
  await page.getByLabel('Email').fill(w.email);
  await page.getByLabel('Password').fill(w.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sim/login'));
}

const A = (sub = '') => `/p/${w.ids.pid}/a/${w.ids.aid}${sub}`;

test('PW-06-02 empty campaign shows the catalogue errors and stays on the page', async ({
  page,
}) => {
  await signIn(page);
  await page.goto(A('/cs/new'));
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Enter a value').first()).toBeVisible();
  await expect(page).toHaveURL(/\/cs\/new/);
});

test('PW-06-01 and PW-07-01 create a campaign, then an insertion order in it', async ({ page }) => {
  await signIn(page);
  await page.goto(A('/cs/new'));
  await page.locator('#name').fill('PW Autumn Launch');
  await page.getByRole('combobox', { name: /Campaign goal/ }).click();
  await page.getByRole('option', { name: /Raise awareness/ }).click();
  await page.getByRole('combobox', { name: /Goal KPI/ }).click();
  await page.getByRole('option', { name: /^CPM/ }).first().click();
  await page.locator('#kpi-value').fill('50');
  await page.getByRole('checkbox', { name: 'Display' }).check();
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForURL(/\/c\/\d+\/explorerios/);

  await page
    .getByRole('link', { name: 'New Insertion Order' })
    .or(page.getByRole('button', { name: 'New Insertion Order' }))
    .click();
  await page.getByRole('radio', { name: /Standard/ }).check();
  await page.getByRole('radio', { name: /Brand awareness/ }).check();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page).toHaveURL(/type=STANDARD&objective=BRAND_AWARENESS/);
  await page.locator('#name').fill('PW IO One');
  await page.getByLabel('Segment 1 budget').fill('1000');
  await page.getByLabel('KPI value').fill('50');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForURL(/\/io\/\d+\/explorerlis/);

  const row = await db.insertionOrder.findFirst({
    where: { name: 'PW IO One', sandboxId: w.sandboxId },
  });
  expect(row?.status).toBe('DRAFT');
});
