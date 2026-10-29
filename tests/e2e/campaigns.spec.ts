// P3-06b module 06: PW-06-01 to PW-06-05, PW-06-09, PW-06-11, PW-06-12, campaign tabs and pin (AC-06-16/17), DLG-11.
// (PW-06-06 to 08 and 10 are Phase 4: bulk, duplicate, archive and alerts.)
// Synthetic student in the test database, signed in through /sim/login (same pattern as shell.spec.ts).
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';
import { cleanup } from '../auth/fixtures';
import { createShellWorld, type ShellWorld } from '../shell/e2e-world';
import { advPath, seedCampaign, signIn } from '../services/campaigns/e2e-helpers';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
let w: ShellWorld;
let wRo: ShellWorld;

test.beforeAll(async () => {
  w = await createShellWorld(db, { tag: `pw06b-${Date.now()}` });
  wRo = await createShellWorld(db, { tag: `pw06b-ro-${Date.now()}`, role: 'READ_ONLY' });
});
test.afterAll(async () => {
  await cleanup(db, {
    userIds: [...w.userIds, ...wRo.userIds],
    classroomIds: [w.classroomId, wRo.classroomId],
  });
  await db.$disconnect();
});

const A = (sub = '') => advPath(w, sub);
const login = (page: Page) => signIn(page, w);

test('PW-06-02 empty campaign shows the catalogue errors and stays on the page', async ({
  page,
}) => {
  await login(page);
  await page.goto(A('/cs/new'));
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Enter a value').first()).toBeVisible();
  await expect(page).toHaveURL(/\/cs\/new/);
});

test('PW-06-01 and PW-07-01 create a campaign, then an insertion order in it', async ({ page }) => {
  await login(page);
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

async function fillValidCampaign(page: Page, name: string, kpiOption: RegExp) {
  await page.locator('#name').fill(name);
  await page.getByRole('combobox', { name: /Campaign goal/ }).click();
  await page.getByRole('option', { name: /Raise awareness/ }).click();
  await page.getByRole('combobox', { name: /Goal KPI/ }).click();
  await page.getByRole('option', { name: kpiOption }).first().click();
  await page.locator('#kpi-value').fill('50');
  await page.getByRole('checkbox', { name: 'Display' }).check();
}

test('PW-06-03 a KPI that is not recommended shows an amber warning and Create still works', async ({
  page,
}) => {
  await login(page);
  await page.goto(A('/cs/new'));
  await fillValidCampaign(page, 'PW Not Recommended', /^CPA/);
  await expect(
    page.getByText('This KPI is not recommended for the selected campaign goal.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForURL(/\/c\/\d+\/explorerios/);
  const row = await db.campaign.findFirst({
    where: { name: 'PW Not Recommended', sandboxId: w.sandboxId },
  });
  expect(row?.kpi).toBe('CPA');
});

test('PW-06-04 unsaved changes: Continue editing keeps the text, Discard returns to the list', async ({
  page,
}) => {
  await login(page);
  await page.goto(A('/cs'));
  await page
    .getByRole('link', { name: 'New campaign' })
    .or(page.getByRole('button', { name: 'New campaign' }))
    .click();
  await page.waitForURL(/\/cs\/new/);
  await page.locator('#name').fill('PW Draft Text');
  await page.getByRole('button', { name: 'Close' }).click();
  const dialog = page.getByRole('dialog', { name: 'Unsaved Changes' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Continue editing' }).click();
  await expect(page.locator('#name')).toHaveValue('PW Draft Text');
  await page.getByRole('button', { name: 'Close' }).click();
  await page
    .getByRole('dialog', { name: 'Unsaved Changes' })
    .getByRole('button', { name: 'Discard changes' })
    .click();
  await page.waitForURL((url) => url.pathname.endsWith('/cs'));
  expect(
    await db.campaign.count({ where: { name: 'PW Draft Text', sandboxId: w.sandboxId } }),
  ).toBe(0);
});

test('PW-06-05 inline status: Pause from the hover menu writes a STATUS_CHANGE group', async ({
  page,
}) => {
  const c = await seedCampaign(db, w, 'PW Inline Status');
  await login(page);
  await page.goto(A('/cs'));
  const row = page.getByRole('row', { name: /PW Inline Status/ });
  await row.hover();
  await row.getByRole('button', { name: 'Change status' }).click();
  await page.getByRole('menuitem', { name: 'Pause' }).click();
  await expect
    .poll(async () => (await db.campaign.findUnique({ where: { id: c.id } }))?.status)
    .toBe('PAUSED');
  const groups = await db.changeGroup.findMany({
    where: { entityId: c.id, entityType: 'CAMPAIGN' },
  });
  expect(groups.length).toBeGreaterThan(0);
});

test('PW-06-09 a read-only user sees Limited Access and a disabled New campaign', async ({
  page,
}) => {
  await signIn(page, wRo);
  await page.goto(advPath(wRo, '/cs'));
  await expect(page.getByText('Limited Access').first()).toBeVisible();
  await expect(
    page
      .getByRole('link', { name: 'New campaign' })
      .or(page.getByRole('button', { name: 'New campaign' })),
  ).toHaveAttribute('aria-disabled', 'true');
});

test('PW-06-11 the start date of a started campaign is locked on the settings page', async ({
  page,
}) => {
  const c = await seedCampaign(db, w, 'PW Started');
  await login(page);
  await page.goto(A(`/c/${c.publicId}/details`));
  await expect(page.locator('#startDate')).not.toBeEditable();
  await expect(page.locator('#endDate')).toBeEditable();
});

test('PW-06-12 copy settings: only the ticked setting is copied into the draft', async ({
  page,
}) => {
  await seedCampaign(db, w, 'PW Copy Source', { freqMax: 7 });
  await login(page);
  await page.goto(A('/cs/new'));
  await page.getByRole('button', { name: 'Copy settings from an existing campaign' }).click();
  const dialog = page.getByRole('dialog', { name: /Copy settings/ });
  const copy = dialog.getByRole('button', { name: 'Copy Settings' });
  await expect(copy).toBeDisabled();
  await dialog.getByRole('radio', { name: /PW Copy Source/ }).check();
  await expect(copy).toBeDisabled();
  await dialog.getByRole('checkbox', { name: 'Frequency cap' }).check();
  await expect(copy).toBeEnabled();
  await copy.click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('textbox', { name: 'Exposures' })).toHaveValue('7');
  // the goal was not ticked, so it stays empty
  await expect(page.getByRole('combobox', { name: /Campaign goal/ })).not.toContainText(
    'Raise awareness',
  );
});

test('AC-06-16/17 campaign page: tabs, pin stored per user, redirect and the five chart cards', async ({
  page,
}) => {
  const c = await seedCampaign(db, w, 'PW Tabs');
  await login(page);
  await page.goto(A(`/c/${c.publicId}`));
  await page.waitForURL(/\/explorerios/);
  for (const name of ['Combined', 'Insertion orders', 'Line items'])
    await expect(page.getByRole('tab', { name: new RegExp(name) })).toBeVisible();
  for (const title of [
    'Total cost',
    'Avg. performance',
    'Impressions lost',
    'Added impression reach',
    'Explore budget options',
  ])
    await expect(page.getByRole('region', { name: title })).toBeVisible();
  await expect(page.getByText(/check the box next to an insertion order/)).toBeVisible();
  await expect(page.getByText(/select a single insertion order/)).toBeVisible();

  await page.getByRole('tab', { name: 'Combined' }).click();
  await page.waitForURL(/\/explorercombined/);
  await page.getByRole('button', { name: /Pin Combined as the default tab/ }).click();
  await expect(page.getByRole('button', { name: /Pin Combined/ })).toBeHidden();
  await page.goto(A(`/c/${c.publicId}`));
  await page.waitForURL(/\/explorercombined/);
});

test('AC-06-15 a stale save shows DLG-11; Reload and Keep my changes are offered', async ({
  page,
}) => {
  const c = await seedCampaign(db, w, 'PW Stale');
  await login(page);
  await page.goto(A(`/c/${c.publicId}/details`));
  await page.locator('#name').fill('PW Stale edited');
  await db.campaign.update({ where: { id: c.id }, data: { version: { increment: 1 } } });
  await page.getByRole('button', { name: 'Save' }).click();
  const dialog = page.getByRole('dialog', { name: 'This item changed' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep my changes' }).click();
  await expect
    .poll(async () => (await db.campaign.findUnique({ where: { id: c.id } }))?.name)
    .toBe('PW Stale edited');
});
