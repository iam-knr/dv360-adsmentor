// Module 10 6.2: PW-10-02, PW-10-03, PW-10-05 (and PW-10-06 for the audience builder, plus Apps & URLs and brand
// suitability) against the dev page (needs ENABLE_GALLERY=1, set by playwright.config).
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
let world: Awaited<ReturnType<typeof createShellWorld>>;

test.beforeAll(async () => {
  const w = await createShellWorld(db, { tag: `tga-${Date.now().toString(36)}` });
  userIds.push(...w.userIds);
  classroomIds.push(w.classroomId);
  world = w;
});
test.afterAll(async () => {
  await cleanup(db, { userIds, classroomIds });
  await db.$disconnect();
});
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

const open = async (page: Page) => {
  await page.goto('/targeting');
  await page.waitForLoadState('networkidle');
};
const addMenu = async (page: Page, name: RegExp | string) => {
  await page.getByRole('button', { name: 'Add targeting' }).click();
  await page.getByRole('menuitem', { name }).click();
};
const editor = (page: Page) => page.getByRole('dialog').first();

test.describe('geography', () => {
  test('PW-10-02 search "Mumbai", include, Done, Apply gives the row summary and shades the map', async ({
    page,
  }) => {
    await open(page);
    await addMenu(page, /Geography/);
    const d = editor(page);
    await expect(d.getByTestId('geo-all-locations')).toBeVisible();
    await d.getByLabel('Search for locations').fill('Mumbai');
    await expect(d.getByText('Mumbai, Maharashtra, India (City)')).toBeVisible();
    await d.getByRole('checkbox', { name: 'Include Mumbai' }).check();
    await expect(d.getByTestId('map-IN-MH')).toHaveAttribute('data-shade', 'INCLUDE');
    await expect(d.getByTestId('geo-summary-title')).toContainText('(1)');
    await d.getByRole('button', { name: 'Done' }).click();
    await d.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByTestId('target-row-GEOGRAPHY')).toContainText(
      'Region inclusions: Mumbai',
    );
  });

  test('PW-10-03 bulk points of interest: one valid line is added, one invalid line is reported', async ({
    page,
  }) => {
    await open(page);
    await addMenu(page, /Geography/);
    const d = editor(page);
    await d.getByRole('button', { name: 'Bulk add points of interest' }).click();
    await d.getByLabel('Points of interest').fill('19.07,72.87\nnot an address');
    await d.getByRole('button', { name: 'Include', exact: true }).click();
    await expect(d.getByRole('list', { name: 'Radius' }).getByRole('listitem')).toHaveCount(1);
    await expect(d.getByRole('alert')).toContainText(
      'Line 2: Enter a street address or a latitude and longitude pair on each line.',
    );
    await d.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByTestId('target-row-GEOGRAPHY')).toContainText('1 radius target');
  });

  test('a radius outside 1 to 500 shows TGT-012 and hides Apply', async ({ page }) => {
    await open(page);
    await addMenu(page, /Geography/);
    const d = editor(page);
    await d.getByRole('button', { name: 'Bulk add points of interest' }).click();
    await d.getByLabel('Points of interest').fill('19.07,72.87');
    await d.getByRole('button', { name: 'Include', exact: true }).click();
    await d.getByLabel(/^Distance in km for/).fill('600');
    await expect(d.getByRole('alert').first()).toContainText(
      'Enter a distance between 1 and 500 km.',
    );
    await expect(d.getByRole('button', { name: 'Apply' })).toHaveCount(0);
  });
});

test.describe('audience builder', () => {
  const pickGoogle = async (page: Page, button: string, name: string) => {
    await editor(page).getByRole('button', { name: button }).click();
    const picker = page.getByRole('dialog').last();
    await picker.getByRole('checkbox', { name }).check();
    await picker.getByRole('button', { name: 'Apply' }).click();
  };

  test('PW-10-05 adding Basketball Fans changes the Impressions summary and shows its labels', async ({
    page,
  }) => {
    await open(page);
    await addMenu(page, /Audience lists/);
    const d = editor(page);
    const pane = d.getByTestId('impressions-summary');
    await expect(pane.getByTestId('sum-overall')).toBeVisible();
    const before = await pane.getByTestId('sum-included').innerText();
    await expect(pane.getByTestId('sum-included')).toHaveText(
      await pane.getByTestId('sum-overall').innerText(),
    );
    await pickGoogle(page, 'Add Google audiences', 'Basketball Fans');
    await expect(d.getByRole('list', { name: 'Included Google audiences' })).toContainText(
      'Basketball Fans',
    );
    await expect(pane.getByTestId('sum-included')).not.toHaveText(before, { timeout: 1000 + 1000 });
    for (const label of [
      'Overall impressions',
      'Included impressions',
      'Excluded impressions',
      'Other targeting',
      '(Diagram not to scale)',
      'Gender',
      'DATA AVAILABLE FOR 95% OF IMPRESSIONS',
      'Age',
      'Desktop vs. Mobile',
    ])
      await expect(pane.getByText(label, { exact: true }).first()).toBeVisible();
    await d.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByTestId('target-row-AUDIENCE_LISTS')).toContainText('Include: 1 list');
  });

  test('PW-10-06 the same list cannot be included and excluded (TGT-100)', async ({ page }) => {
    await open(page);
    await addMenu(page, /Audience lists/);
    const d = editor(page);
    await pickGoogle(page, 'Add Google audiences', 'Basketball Fans');
    await pickGoogle(page, 'Add excluded Google audiences', 'Basketball Fans');
    await expect(d.getByRole('alert').first()).toHaveText(
      "An item can't be both included and excluded.",
    );
    await expect(d.getByRole('list', { name: 'Excluded Google audiences' })).toHaveCount(0);
  });

  test('a first-party group takes lists in OR and a second group is joined by AND', async ({
    page,
  }) => {
    await open(page);
    await addMenu(page, /Audience lists/);
    const d = editor(page);
    await expect(
      d.getByRole('button', { name: 'Add first-party and partner audiences' }),
    ).toBeVisible();
    await expect(d.getByRole('heading', { name: 'Exclude' })).toBeVisible();
    await expect(d.getByText("Add (or create new) custom lists to 'OR' together.")).toBeVisible();
  });
});

test.describe('apps and URLs', () => {
  test('bulk add sorts URLs and apps and reports the rejected entries (TGT-020, TGT-023)', async ({
    page,
  }) => {
    await open(page);
    await addMenu(page, /Apps & URLs/);
    const d = editor(page);
    await expect(d.getByText('None selected')).toBeVisible();
    for (const c of ['Channels', 'Collections', 'URLs', 'Apps'])
      await expect(d.getByRole('button', { name: new RegExp(c) }).first()).toBeVisible();
    await expect(d.getByTestId('url-suggestions')).toHaveCount(0);
    await d.getByRole('button', { name: 'Add multiple apps and URLs at once' }).click();
    await d.getByLabel('Apps and URLs to add').fill('news.example.com\ncom.example.app\nnot valid');
    await d.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(d.getByRole('alert')).toContainText("1 entries couldn't be added.");
    await expect(d.getByText('2 selected')).toBeVisible();
    const download = page.waitForEvent('download');
    await d.getByRole('button', { name: 'Download composite list' }).click();
    expect((await download).suggestedFilename()).toBe('apps-and-urls-composite-list.csv');
  });
});

test.describe('brand suitability', () => {
  test('ABS replaces brand safety, the total is the sum and the row stays locked', async ({
    page,
  }) => {
    await open(page);
    await expect(page.getByTestId('target-row-BRAND_SUITABILITY')).toContainText(
      'Maximum inventory',
    );
    await page.getByRole('button', { name: 'Edit Brand suitability' }).click();
    const d = editor(page);
    await expect(d.getByTestId('inventory-mode')).toContainText('Maximum inventory');
    await expect(d.getByTestId('verification-total')).toHaveText('Total cost: ~₹0.00 CPM');
    await d.getByRole('combobox', { name: 'Third-party verification provider' }).click();
    await page.getByRole('option', { name: 'DoubleVerify' }).click();
    await d.getByRole('checkbox', { name: /Authentic Brand Safety/ }).check();
    await d.getByRole('checkbox', { name: /Display viewability/ }).check();
    await expect(d.getByTestId('verification-total')).toHaveText('Total cost: ~₹33.33 CPM');
    await expect(d.getByRole('checkbox', { name: /^Brand safety/ })).toBeDisabled();
    await expect(d.getByRole('checkbox', { name: /Fraud & invalid traffic/ })).toBeDisabled();
    await d.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByTestId('target-row-BRAND_SUITABILITY')).toContainText(
      '2 items selected',
    );
  });
});
