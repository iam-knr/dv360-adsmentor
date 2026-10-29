// Module 10 6.2: PW-10-01, 04, 06, 07, 08, 09, 10, 11, 16 against the dev page (needs ENABLE_GALLERY=1, set by playwright.config).
// PW-10-06 is adapted: the same-list TGT-100 rule belongs to the audience builder (P3-07b); here the exclusive include/exclude toggle (TGT-001) is checked.
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';
import { cleanup } from '../auth/fixtures';
import { createShellWorld } from '../shell/e2e-world';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const userIds: string[] = [];
const classroomIds: string[] = [];

// The dev page is a DV360 route, so it needs a signed-in student in an open class (own synthetic account per run).
test.beforeAll(async () => {
  const w = await createShellWorld(db, { tag: `tgt-${Date.now().toString(36)}` });
  userIds.push(...w.userIds);
  classroomIds.push(w.classroomId);
  world = w;
});
test.afterAll(async () => {
  await cleanup(db, { userIds, classroomIds });
  await db.$disconnect();
});
let world: Awaited<ReturnType<typeof createShellWorld>>;
test.beforeEach(async ({ page, context }) => {
  const ip = `10.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  await context.setExtraHTTPHeaders({
    ...(bypass ? { 'x-vercel-protection-bypass': bypass } : {}),
    'x-forwarded-for': ip,
  });
  await page.goto('/sim/login');
  await page.getByLabel('Email').fill(world.email);
  await page.getByLabel('Password').fill(world.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sim/login'));
});

const open = async (page: Page, type = 'DISPLAY') => {
  await page.goto('/targeting');
  await page.waitForLoadState('networkidle');
  if (type !== 'DISPLAY') await page.getByLabel('Line item type').selectOption(type);
};
const addMenu = async (page: Page, name: RegExp | string) => {
  await page.getByRole('button', { name: 'Add targeting' }).click();
  await page.getByRole('menuitem', { name }).click();
};
const dialog = (page: Page) => page.getByRole('dialog');

test.describe('targeting card', () => {
  test('PW-10-01 Add targeting menu groups and Added marks on a new Display LI', async ({
    page,
  }) => {
    await open(page);
    await expect(page.getByTestId('target-row-BRAND_SUITABILITY')).toBeVisible();
    await expect(page.getByTestId('target-row-VIEWABILITY')).toBeVisible();
    await page.getByRole('button', { name: 'Add targeting' }).click();
    const menu = page.getByRole('menu');
    for (const g of ['Content', 'Audience', 'Technology'])
      await expect(menu.getByText(g, { exact: true })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /Viewability/ })).toContainText('Added');
    await expect(menu.getByRole('menuitem', { name: /Language/ })).not.toContainText('Added');
    await expect(menu.getByRole('menuitem', { name: /Browser/ })).toBeVisible();
  });

  test('PW-10-04 Keywords: paste "a, b\\nc" and the counter shows 3', async ({ page }) => {
    await open(page);
    await addMenu(page, /^Keywords/);
    const box = dialog(page).getByLabel('Enter keywords separated by commas or new lines');
    await box.fill('a, b\nc');
    await box.blur();
    await expect(dialog(page)).toContainText('3 / 5,000 keywords');
    await dialog(page).getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByTestId('target-row-KEYWORDS')).toContainText('Include: 3 keywords');
  });

  test('PW-10-06 an item is in one mode only: excluding an included language moves it', async ({
    page,
  }) => {
    await open(page);
    await addMenu(page, /Language/);
    const d = dialog(page);
    await d.getByRole('checkbox', { name: 'English' }).check();
    await d.getByRole('radio', { name: /Exclude/ }).check();
    await d.getByRole('checkbox', { name: /English/ }).check();
    await expect(d.getByRole('radio', { name: /Include \(0\)/ })).toBeVisible();
    await expect(d.getByRole('radio', { name: /Exclude \(1\)/ })).toBeVisible();
    await d.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByTestId('target-row-LANGUAGE')).toContainText('Exclude: English');
    await expect(page.getByTestId('target-row-LANGUAGE')).not.toContainText('Include');
  });

  test('PW-10-07 Demographics with every gender unchecked shows the error and hides Apply', async ({
    page,
  }) => {
    await open(page);
    await addMenu(page, /Demographics/);
    const d = dialog(page);
    for (const g of ['Male', 'Female', 'Unknown'])
      await d
        .getByRole('group', { name: 'Gender' })
        .getByRole('checkbox', { name: g, exact: true })
        .uncheck();
    await expect(d.getByRole('alert')).toHaveText('Select at least one option.');
    await expect(d.getByRole('button', { name: 'Apply' })).toHaveCount(0);
  });

  test('PW-10-08 Day & time preset Mondays-Fridays shades Mon to Fri only', async ({ page }) => {
    await open(page);
    await addMenu(page, /Day & time/);
    const d = dialog(page);
    await d.getByRole('combobox', { name: 'Schedule' }).click();
    await page.getByRole('option', { name: 'Mondays-Fridays' }).click();
    for (const day of ['Monday', 'Wednesday', 'Friday'])
      await expect(d.getByRole('gridcell', { name: `${day} 12:00` })).toHaveAttribute(
        'data-on',
        '1',
      );
    for (const day of ['Saturday', 'Sunday'])
      await expect(d.getByRole('gridcell', { name: `${day} 12:00` })).toHaveAttribute(
        'data-on',
        '0',
      );
  });

  test('PW-10-09 Device: excluding all four types shows TGT-130 and hides Apply', async ({
    page,
  }) => {
    await open(page);
    await addMenu(page, /Device/);
    const d = dialog(page);
    await d
      .getByRole('radio', { name: /Exclude/ })
      .first()
      .check();
    for (const t of ['Computer', 'Smartphone', 'Tablet', 'Connected TV'])
      await d.getByRole('checkbox', { name: new RegExp(`^${t}`) }).check();
    await expect(d.getByRole('alert').first()).toHaveText('Select at least one option.');
    await expect(d.getByRole('button', { name: 'Apply' })).toHaveCount(0);
  });

  test('PW-10-10 locked row has a lock and no trash icon, with the rules tooltip', async ({
    page,
  }) => {
    await open(page);
    await expect(page.getByTestId('locked-VIEWABILITY')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove Viewability' })).toHaveCount(0);
    await page.getByTestId('locked-VIEWABILITY').focus();
    await expect(page.getByRole('tooltip')).toContainText("advertiser's targeting rules");
    await expect(page.getByRole('button', { name: 'Remove Environment' })).toHaveCount(0);
  });

  test('PW-10-11 a CTV line item starts with its pre-added rows', async ({ page }) => {
    await open(page, 'CTV');
    await expect(page.getByTestId('target-row-DEVICE')).toBeVisible();
    await expect(page.getByTestId('target-row-POSITION')).toContainText('In-stream');
    await expect(page.getByTestId('target-row-BRAND_SUITABILITY')).toBeVisible();
  });

  test('PW-10-16 a read-only user opens the editor without Apply or trash', async ({ page }) => {
    await open(page, 'CTV');
    await page.getByLabel('Read-only role').check();
    await expect(page.getByRole('button', { name: 'Add targeting' })).toBeDisabled();
    await page.getByRole('button', { name: 'View Device' }).click();
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).getByRole('button', { name: 'Apply' })).toHaveCount(0);
    await expect(dialog(page).getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  test('editors do not change the URL (RC-044)', async ({ page }) => {
    await open(page);
    const before = page.url();
    await addMenu(page, /Language/);
    await expect(dialog(page)).toBeVisible();
    expect(page.url()).toBe(before);
  });
});
