// P4-08, module 04 6.1: PW-04-1 Plans list, PW-04-2 plan edit, PW-04-3 locked plan, PW-04-4 convert,
// PW-04-5 remove and the dirty guard, PW-04-6 Cross-media reach. Synthetic data only.
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';
import { cleanup } from '../auth/fixtures';
import { createShellWorld, type ShellWorld } from '../shell/e2e-world';
import { seedPlans } from '../../lib/planning/seed';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
let w: ShellWorld;
let readOnly: ShellWorld;
let reporting: ShellWorld;

const adv = (world: ShellWorld = w) => `/p/${world.ids.pid}/a/${world.ids.aid}`;

async function planWorld(tag: string, role?: 'READ_ONLY' | 'REPORTING_ONLY') {
  const world = await createShellWorld(db, { tag, ...(role ? { role } : {}) });
  // the sim clock runs in real time; hold it at day 0 so the dates below stay put
  await db.simClock.update({
    where: { sandboxId: world.sandboxId },
    data: { state: 'PAUSED', tickIndex: 0 },
  });
  // the shell fixture has no plans: write the starter ones for sim day 0 (2026-01-01)
  await seedPlans(db, {
    sandboxId: world.sandboxId,
    template: 'starter-agency',
    seedValue: 4,
    today: '2026-01-01',
  });
  return world;
}

test.beforeAll(async () => {
  const tag = `pw04-${Date.now()}`;
  w = await planWorld(tag);
  readOnly = await planWorld(`${tag}-ro`, 'READ_ONLY');
  reporting = await planWorld(`${tag}-rep`, 'REPORTING_ONLY');
});
test.afterAll(async () => {
  await cleanup(db, {
    userIds: [...w.userIds, ...readOnly.userIds, ...reporting.userIds],
    classroomIds: [w.classroomId, readOnly.classroomId, reporting.classroomId],
  });
  await db.$disconnect();
});

async function signIn(page: Page, world: ShellWorld = w) {
  await page.goto('/sim/login');
  await page.getByLabel('Email').fill(world.email);
  await page.getByLabel('Password').fill(world.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sim/login'));
}

async function newPlan(page: Page) {
  await page.goto(`${adv()}/marketplace/plans`);
  await page.getByRole('button', { name: 'New plan' }).click();
  await page.waitForURL(/\/pr\/\d+\/marketplace\/plan/);
  await expect(page.getByTestId('plan-page')).toBeVisible();
}

async function addRow(page: Page, name: string, budget: string, method?: string) {
  await page.getByRole('button', { name: 'Add plan line item' }).click();
  const panel = page.getByRole('dialog', { name: 'Plan line item' });
  await panel.getByLabel('Name').fill(name);
  if (method) {
    await panel.getByRole('combobox', { name: 'Buying method' }).click();
    await page.getByRole('option', { name: method }).click();
  }
  await panel.getByLabel('Budget (net)').fill(budget);
  await panel.getByRole('button', { name: 'Apply' }).click();
  await expect(panel).toBeHidden();
}

test('PW-04-1: Plans list filters, sorts, pages, creates a plan; read-only and REPORTING_ONLY roles', async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`${adv()}/marketplace/plans`);
  await expect(page.getByRole('heading', { name: 'Plans' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New plan' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Status: 2 selected' })).toBeVisible();
  await expect(page.getByText('Plan', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Details', { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId('plan-link')).toHaveCount(12);
  await expect(page.getByText('1 - 12 of 12')).toBeVisible();

  // default sort is Name A to Z
  const names = await page.getByTestId('plan-link').allInnerTexts();
  expect(names).toEqual([...names].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));

  // only Planned: the URL and the chip follow
  await page.getByRole('button', { name: 'Status: 2 selected' }).click();
  await page.getByRole('checkbox', { name: 'Trafficked' }).uncheck();
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByRole('button', { name: 'Status: Planned' })).toBeVisible();
  await expect(page).toHaveURL(/f\.status=PLANNED/);
  await expect(page.getByTestId('plan-link')).toHaveCount(11);

  // Start date toggles ascending then descending, dates read Mar 1, 2026
  const start = page.getByRole('columnheader', { name: /Start date/ });
  await start.click();
  await expect(page).toHaveURL(/sort=startDate%3Aasc|sort=startDate:asc/);
  await start.click();
  await expect(page).toHaveURL(/sort=startDate%3Adesc|sort=startDate:desc/);
  await expect(
    page
      .getByRole('grid')
      .getByText(/^[A-Z][a-z]{2} \d{1,2}, 20\d\d$/)
      .first(),
  ).toBeVisible();

  // New plan: a named plan, empty rows state, Save disabled (AC-04-4)
  await newPlan(page);
  await expect(page.getByLabel('Plan name')).toHaveValue('New Plan (Jan 1, 2026)');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await expect(page.getByText('Add a plan line item to see a forecast').first()).toBeVisible();

  // read-only role: New plan disabled, chip shown, Download still reachable
  await page.context().clearCookies();
  await signIn(page, readOnly);
  await page.goto(`${adv(readOnly)}/marketplace/plans`);
  await expect(page.getByRole('button', { name: 'New plan' })).toBeDisabled();
  await expect(page.getByText('Limited Access')).toBeVisible();

  // REPORTING_ONLY: Plans is a 404, Cross-media reach opens (AC-04-21)
  await page.context().clearCookies();
  await signIn(page, reporting);
  await page.goto(`${adv(reporting)}/marketplace/plans`);
  await expect(page.getByText('Page not found')).toBeVisible();
  await page.goto(`${adv(reporting)}/cross-media-reach`);
  await expect(page.getByRole('heading', { name: 'Cross-media reach Reports' })).toBeVisible();
});

test('PW-04-2: build a plan, save, read the forecast, switch tiles, tabs, columns, download', async ({
  page,
}) => {
  await signIn(page);
  await newPlan(page);

  await addRow(page, 'Prospecting display', '20000');
  await addRow(page, 'Retargeting', '10000');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();

  // row validation (AC-04-11)
  await page.getByRole('button', { name: 'Add plan line item' }).click();
  const panel = page.getByRole('dialog', { name: 'Plan line item' });
  await panel.getByRole('button', { name: 'Apply' }).click();
  await expect(panel.getByText('Enter a value')).toBeVisible();
  await expect(panel.getByText('Enter a number greater than 0')).toBeVisible();
  await panel.getByLabel('Name').fill('Out of range');
  await panel.getByLabel('Budget (net)').fill('1000');
  await panel.getByLabel('End date').fill('2030-01-01');
  await panel.getByRole('button', { name: 'Apply' }).click();
  await expect(panel.getByText('Line item dates must fall within the plan dates.')).toBeVisible();
  await panel.getByRole('button', { name: 'Cancel' }).click();

  // a Programmatic Guaranteed row needs a deal; the fixture has one
  await page.getByRole('button', { name: 'Add plan line item' }).click();
  const pg = page.getByRole('dialog', { name: 'Plan line item' });
  await pg.getByLabel('Name').fill('Guaranteed homepage');
  await pg.getByRole('combobox', { name: 'Buying method' }).click();
  await page.getByRole('option', { name: 'Programmatic Guaranteed' }).click();
  await pg.getByLabel('Budget (net)').fill('5000');
  await pg.getByRole('button', { name: 'Apply' }).click();
  await expect(pg.getByText('A selection is required')).toBeVisible();
  await pg.getByRole('combobox', { name: 'Deal' }).click();
  await page.getByRole('option', { name: 'Fixture preferred deal' }).click();
  await pg.getByRole('button', { name: 'Apply' }).click();
  await expect(pg).toBeHidden();

  // changing the dates keeps Save enabled and shows the stale notice (AC-04-8)
  await expect(page.getByText('Forecast is out of date. Save to refresh.')).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Plan saved')).toBeVisible();
  await expect(page.getByTestId('forecast-asof')).toContainText('FORECAST AS OF JAN 1, 2026');
  await expect(page.getByTestId('forecast-headline')).toContainText('You could reach');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();

  // rows are grouped by buying method, the PG row has a lock (AC-04-12)
  await expect(page.getByText('Open Auction', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Programmatic Guaranteed', { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel('CPM locked').first()).toBeVisible();

  // KPI tiles switch without a server call (AC-04-14)
  const cpm = await page.getByTestId('kpi-cpm').innerText();
  await page.getByRole('button', { name: /Total CPM.*Change metric/ }).click();
  await page.getByRole('menuitem', { name: 'On-target CPM' }).click();
  await expect(page.getByTestId('kpi-cpm')).not.toHaveText(cpm);
  const pop = await page.getByTestId('kpi-pop').innerText();
  await page.getByRole('button', { name: /Census population.*Change metric/ }).click();
  await page.getByRole('menuitem', { name: 'Digital population' }).click();
  await expect(page.getByTestId('kpi-pop')).not.toHaveText(pop);

  // five tabs, each with a chart (AC-04-15)
  for (const [tab, id] of [
    ['Reach', 'REACH'],
    ['TrueView views', 'TRUEVIEW'],
    ['Conversions', 'CONVERSIONS'],
    ['Demographics', 'DEMOGRAPHICS'],
    ['Devices', 'DEVICES'],
  ] as const) {
    await page.getByRole('tab', { name: tab }).click();
    await expect(page.getByTestId(`chart-${id}`)).toBeVisible();
  }
  await page.getByRole('combobox', { name: 'Forecast metric' }).click();
  await page.getByRole('option', { name: 'Impressions' }).click();
  await page.getByRole('button', { name: 'Good forecast' }).click();
  await expect(page.getByText('Thanks for your feedback.')).toBeVisible();

  // Modify columns persists across a reload (AC-04-13)
  await page.getByRole('button', { name: 'Columns' }).click();
  const dlg = page.getByRole('dialog', { name: 'Modify columns' });
  await expect(dlg.getByText('Drag and drop to reorder')).toBeVisible();
  await expect(dlg.getByRole('button', { name: 'Select all' })).toBeVisible();
  await expect(dlg.getByRole('button', { name: 'Clear all' })).toBeVisible();
  await dlg.getByRole('button', { name: 'Remove Viewable CPM' }).click();
  await dlg.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByRole('columnheader', { name: 'Viewable CPM' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('columnheader', { name: 'Total avg. cost' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Viewable CPM' })).toHaveCount(0);

  // Download (.csv) carries the header lines and the current column order (AC-04-16)
  await page.getByRole('button', { name: 'More actions' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Download (.csv)' }).click();
  const file = await download;
  const text = await (await import('node:fs/promises')).readFile(await file.path(), 'utf8');
  expect(text).toContain('Plan,"New Plan (Jan 1, 2026)"');
  expect(text).toContain('Forecast as of');
  const header = text.split('\r\n').find((l) => l.startsWith('Name,')) ?? '';
  expect(header).toContain('Total avg. cost');
  expect(header).not.toContain('Viewable CPM');
});

test('PW-04-3: a past-dated plan is locked; Make a copy opens an editable copy with a forecast', async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`${adv()}/marketplace/plans`);
  // seeded plan 0 starts long before sim today
  await page.getByTestId('plan-link').first().click();
  await page.waitForURL(/\/marketplace\/plan/);
  await expect(page.getByText('Your start date has passed').first()).toBeVisible();
  await expect(
    page.getByText('Make a copy of this plan with new dates to work on it again.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add plan line item' })).toHaveCount(0);
  await expect(page.getByLabel('Plan name')).toBeDisabled();
  await expect(page.getByTestId('kpi-strip')).toBeVisible(); // the stored snapshot stays

  await page.getByRole('button', { name: 'Make a copy' }).click();
  const dlg = page.getByRole('dialog', { name: 'Make a copy' });
  await expect(dlg.getByLabel('Start date')).toHaveValue('2026-01-02');
  await dlg.getByRole('button', { name: 'Copy' }).click();
  await page.waitForURL(/\/pr\/\d+\/marketplace\/plan/);
  await expect(page.getByLabel('Plan name')).toHaveCount(1);
  await expect(page.getByLabel('Plan name')).toHaveValue(/^Copy of /);
  await expect(page.getByLabel('Plan name')).toBeEnabled();
  await expect(page.getByTestId('forecast-headline')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add plan line item' })).toBeVisible();

  // a start date in the past is refused by PLN-021
  await page.getByRole('button', { name: 'Copy', exact: true }).click();
  const again = page.getByRole('dialog', { name: 'Make a copy' });
  await again.getByLabel('Start date').fill('2025-12-01');
  await again.getByRole('button', { name: 'Copy' }).click();
  await expect(again.getByText('Choose a start date that has not passed.')).toBeVisible();
});

test('PW-04-4: Create campaign turns the plan into a campaign, a draft IO and line items', async ({
  page,
}) => {
  await signIn(page);
  await newPlan(page);
  await addRow(page, 'Convert row one', '12000');
  await addRow(page, 'Convert row two', '8000');
  await addRow(page, 'Convert row three', '5000');
  await page.getByLabel('Plan name').fill('Convert me');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Plan saved')).toBeVisible();

  await page.getByRole('button', { name: 'Create campaign' }).click();
  const dlg = page.getByRole('dialog', { name: 'Create campaign from plan' });
  await expect(dlg.getByTestId('convert-summary')).toContainText('3 line item drafts');
  await dlg.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Plan trafficked.')).toBeVisible();
  await expect(page.getByText('This plan is trafficked.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create campaign' })).toBeDisabled();

  const campaign = await db.campaign.findFirstOrThrow({
    where: { sandboxId: w.sandboxId, name: 'Convert me' },
  });
  const ios = await db.insertionOrder.findMany({ where: { campaignId: campaign.id } });
  expect(ios).toHaveLength(1);
  expect(ios[0]?.status).toBe('DRAFT');
  const lis = await db.lineItem.findMany({ where: { ioId: ios[0]?.id } });
  expect(lis).toHaveLength(3);
  expect(lis.every((l) => l.type === 'DISPLAY' && l.status === 'DRAFT')).toBe(true);

  await page.goto(`${adv()}/marketplace/plans`);
  const row = page.getByRole('row', { name: /Convert me/ });
  await expect(row.getByText('Trafficked')).toBeVisible();
  await page.goto(`${adv()}/cs`);
  await expect(page.getByText('Convert me').first()).toBeVisible();
});

test('PW-04-5: Remove plan asks first; leaving a dirty plan asks to discard', async ({ page }) => {
  await signIn(page);
  await newPlan(page);
  await page.getByLabel('Plan name').fill('Doomed plan');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Plan saved')).toBeVisible();

  // dirty guard on the X (AC-04-27)
  await page.getByLabel('Plan name').fill('Doomed plan edited');
  await page.getByRole('button', { name: 'Close' }).click();
  const guard = page.getByRole('dialog', { name: 'Unsaved Changes' });
  await expect(guard).toBeVisible();
  await expect(guard.getByRole('button', { name: 'Continue editing' })).toBeFocused();
  await guard.getByRole('button', { name: 'Continue editing' }).click();
  await expect(page.getByLabel('Plan name')).toHaveValue('Doomed plan edited');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Plan saved')).toBeVisible();

  // remove (AC-04-17)
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Remove plan' }).click();
  const rm = page.getByRole('dialog', { name: 'Remove plan?' });
  await expect(rm.getByText("can't be undone")).toBeVisible();
  await rm.getByRole('button', { name: 'Remove' }).click();
  await page.waitForURL(/\/marketplace\/plans$/);
  await expect(page.getByText('Doomed plan edited')).toHaveCount(0);
  expect(
    await db.plan.count({ where: { sandboxId: w.sandboxId, name: 'Doomed plan edited' } }),
  ).toBe(0);
});

test('PW-04-6: Cross-media reach, empty state, create at advertiser and partner scope, detail page', async ({
  page,
}) => {
  // a fresh world has no reports and an insertion order with spend history to pick
  await signIn(page);
  await page.goto(`${adv()}/cross-media-reach`);
  await expect(page.getByText('Welcome to Cross-media reach!')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Learn more' })).toBeVisible();

  await page.getByRole('button', { name: 'New report' }).first().click();
  await page.waitForURL(/cross-media-reach\/new/);
  await expect(page.getByRole('button', { name: 'Create report' })).toBeDisabled();
  await page.getByRole('combobox', { name: 'Country' }).click();
  await page.getByRole('option', { name: 'Australia' }).click();
  await expect(page.getByTestId('currency-line')).toContainText('Australian dollar');
  await expect(
    page.getByText('The default reporting currency is based on your selected location'),
  ).toBeVisible();

  // Sub-location reveals the multi-select and the note (AC-04-23)
  await page.getByRole('radio', { name: 'Sub-location' }).check();
  await expect(
    page.getByText('Reach and impressions data is available from January 2024'),
  ).toBeVisible();
  await page.getByRole('radio', { name: 'National' }).check();

  // IO dialog: three columns with counts, a zero-spend campaign is disabled, Done waits for a selection (AC-04-24)
  await page.getByRole('button', { name: 'Add insertion orders' }).click();
  const io = page.getByRole('dialog', { name: 'Select insertion orders' });
  await expect(io.getByRole('group', { name: 'Advertiser (1)' })).toBeVisible();
  await expect(io.getByRole('group', { name: 'Campaigns (1)' })).toBeVisible();
  await expect(io.getByRole('group', { name: 'Insertion orders (1)' })).toBeVisible();
  await expect(io.getByRole('checkbox', { name: /Festive Sale/ })).toBeDisabled();
  await expect(io.getByText('Select one or more insertion orders')).toBeVisible();
  await expect(io.getByRole('button', { name: 'Done' })).toBeDisabled();
  await io.getByRole('button', { name: 'Cancel' }).click();

  // TV dialog (AC-04-24)
  await page.getByRole('button', { name: 'Add TV campaigns' }).click();
  const tv = page.getByRole('dialog', { name: 'Select TV campaigns' });
  await expect(tv.getByText('TV data powered by Adsmetor Panel (synthetic)')).toBeVisible();
  await expect(tv.getByText(/Data for Australia - National is available from/)).toBeVisible();
  await expect(tv.getByText('None selected')).toBeVisible();
  await tv.getByRole('checkbox').first().check();
  await tv.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId('tv-count')).toHaveText('1 TV campaign selected');
  await expect(page.getByRole('button', { name: 'Create report' })).toBeEnabled();

  await page.getByLabel('Report name (optional)').fill('PW national report');
  await page.getByRole('button', { name: 'Create report' }).click();
  await page.waitForURL(/cross-media-reach\/\d+$/);
  await expect(page.getByTestId('cross-media-detail')).toBeVisible();
  for (const card of ['Digital', 'TV', 'Combined']) {
    await expect(page.getByRole('region', { name: card })).toBeVisible();
  }
  await expect(page.getByTestId('cross-media-table')).toBeVisible();

  // the list shows it as Done (AC-04-26)
  await page.goto(`${adv()}/cross-media-reach`);
  const row = page.getByRole('row', { name: /PW national report/ });
  await expect(row.getByText('Done')).toBeVisible();
  await expect(row.getByText('National', { exact: true })).toBeVisible();

  // partner scope, Sub-location
  await page.goto(`/p/${w.ids.pid}/cross-media-reach/new`);
  await page.getByRole('combobox', { name: 'Country' }).click();
  await page.getByRole('option', { name: 'Australia' }).click();
  await page.getByRole('radio', { name: 'Sub-location' }).check();
  await page.getByRole('checkbox', { name: 'North' }).check();
  await page.getByRole('button', { name: 'Add TV campaigns' }).click();
  const tv2 = page.getByRole('dialog', { name: 'Select TV campaigns' });
  await tv2.getByRole('checkbox').first().check();
  await tv2.getByRole('button', { name: 'Done' }).click();
  await page.getByLabel('Report name (optional)').fill('PW partner report');
  await page.getByRole('button', { name: 'Create report' }).click();
  await page.waitForURL(/\/p\/\d+\/cross-media-reach\/\d+$/);
  await expect(page.getByText(/Sub-location \(North region\)/)).toBeVisible();

  await page.goto(`/p/${w.ids.pid}/cross-media-reach`);
  await expect(page.getByRole('columnheader', { name: 'Advertiser' })).toBeVisible();
  await expect(page.getByRole('row', { name: /PW partner report/ })).toBeVisible();

  // the leave guard on the form (AC-04-27)
  await page.goto(`${adv()}/cross-media-reach/new`);
  await page.getByRole('combobox', { name: 'Country' }).click();
  await page.getByRole('option', { name: 'Australia' }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog', { name: 'Unsaved Changes' })).toBeVisible();
});
