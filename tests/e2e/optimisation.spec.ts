// P4-11: PW-08-12/13/16 Troubleshooter, PW-06-10 campaign Alerts, Intelligence panel rows with Investigate, Apply and
// Dismiss (module 11 AC-11-25). Synthetic data only; diagnostics, alerts and suggestions are written straight to the
// tables, the engine is not run.
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';
import { cleanup } from '../auth/fixtures';
import { createShellWorld, type ShellWorld } from '../shell/e2e-world';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
let w: ShellWorld;
let readOnly: ShellWorld;
let li: { id: string };
let io: { id: string };
let campaign: { id: string };
let ioRec: string;
let liRec: string;
const RANGE = '20260101:20260107';
const base = (world: ShellWorld = w) => `/p/${world.ids.pid}/a/${world.ids.aid}`;
const liUrl = (world: ShellWorld = w) =>
  `${base(world)}/c/${world.ids.cid}/io/${world.ids.ioId}/li/${world.ids.liId}`;

async function build(tag: string, role?: 'READ_ONLY') {
  const world = await createShellWorld(db, { tag, ...(role ? { role } : {}) });
  await db.simClock.update({
    where: { sandboxId: world.sandboxId },
    data: { state: 'PAUSED', tickIndex: 0 },
  });
  const where = { sandboxId: world.sandboxId };
  const c = await db.campaign.findFirstOrThrow({ where });
  const i = await db.insertionOrder.findFirstOrThrow({ where });
  const l = await db.lineItem.findFirstOrThrow({ where });
  await db.campaign.update({ where: { id: c.id }, data: { status: 'ACTIVE' } });
  await db.insertionOrder.update({
    where: { id: i.id },
    data: { status: 'ACTIVE', bidBudgetControl: 'LI_CONTROLLED' },
  });
  await db.lineItem.update({ where: { id: l.id }, data: { status: 'ACTIVE' } });
  await db.budgetSegment.create({
    data: {
      sandboxId: world.sandboxId,
      ioId: i.id,
      amount: 100000,
      startDate: new Date('2025-12-01T00:00:00Z'),
      endDate: new Date('2026-12-31T00:00:00Z'),
    },
  });
  return { world, c, i, l };
}

test.beforeAll(async () => {
  const tag = `pw11-${Date.now()}`;
  const built = await build(tag);
  w = built.world;
  campaign = built.c;
  io = built.i;
  li = built.l;
  readOnly = (await build(`${tag}-ro`, 'READ_ONLY')).world;
  const row = (exchangeId: string, reasonCode: string, count: number) => ({
    sandboxId: w.sandboxId,
    lineItemId: li.id,
    date: new Date('2026-01-01T00:00:00Z'),
    exchangeId,
    stage: 'AVAILABLE' as const,
    reasonCode,
    count,
  });
  await db.deliveryDiagnostic.createMany({
    data: [
      row('fixture-exchange', 'M.AVAILABLE', 10000),
      row('fixture-exchange', 'T.GEO', 3000),
      row('fixture-exchange', 'M.ELIGIBLE', 7000),
      row('fixture-exchange', 'M.BIDS_SUBMITTED', 7000),
      row('fixture-exchange', 'A.BELOW_MIN_BID', 5500),
      row('fixture-exchange', 'M.BID_RESPONSES', 1500),
      row('fixture-exchange', 'E.BID_TOO_LOW', 500),
      row('fixture-exchange', 'M.WON', 1000),
    ],
  });
  const alert = (extra: object) =>
    db.alert.create({
      data: {
        sandboxId: w.sandboxId,
        advertiserId: w.rows.advertiserId,
        campaignId: campaign.id,
        ioId: io.id,
        ...extra,
      } as never,
    });
  await db.alert.deleteMany({ where: { sandboxId: w.sandboxId } });
  await alert({
    lineItemId: li.id,
    type: 'NO_SPEND',
    severity: 'NEEDS_ATTENTION',
    category: 'BUDGET',
    title: 'x',
    diagnosticCode: 'NO_SPEND_LI',
  });
  await alert({
    lineItemId: li.id,
    type: 'REJECTED_CREATIVE',
    severity: 'CRITICAL',
    category: 'CREATIVES',
    title: '1 creative rejected',
    diagnosticCode: 'CREATIVE_REJECTED',
  });
  const rec = (
    type: 'ENABLE_AUTO_BUDGET_ALLOCATION' | 'RAISE_BID',
    scopeType: 'IO' | 'LINE_ITEM',
    scopeId: string,
    title: string,
  ) =>
    db.recommendation.create({
      data: {
        sandboxId: w.sandboxId,
        advertiserId: w.rows.advertiserId,
        scopeType,
        scopeId,
        type,
        title,
      },
    });
  ioRec = (
    await rec('ENABLE_AUTO_BUDGET_ALLOCATION', 'IO', io.id, 'Enable automatic budget allocation')
  ).id;
  liRec = (await rec('RAISE_BID', 'LINE_ITEM', li.id, 'Raise bid')).id;
});
test.afterAll(async () => {
  await cleanup(db, {
    userIds: [...w.userIds, ...readOnly.userIds],
    classroomIds: [w.classroomId, readOnly.classroomId],
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

test('PW-08-13 Troubleshooter of a bid-limited line item shows tiles, stages and reasons', async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`${liUrl()}/troubleshooter?d=${RANGE}`);
  await expect(page.getByTestId('ts-kpis')).toContainText('10,000');
  await expect(page.getByTestId('ts-kpis')).toContainText('Win rate');
  await expect(page.getByTestId('ts-kpis')).toContainText('66.7%');
  await expect(page.getByTestId('ts-sankey')).toBeVisible();
  await expect(page.getByTestId('ts-banner')).toHaveAttribute('data-code', 'ACTIVE_LIMITED_BY_BID');
  const auction = page.getByTestId('ts-table-BIDS');
  await expect(auction).toContainText('Filtered by the auction');
  await expect(auction.getByTestId('ts-row-A.BELOW_MIN_BID')).toContainText(
    'Below the minimum bid',
  );
  await expect(auction.getByTestId('ts-row-A.BELOW_MIN_BID')).toContainText('78.6%');
  // a reason with sub-reasons expands
  const targeting = page.getByTestId('ts-table-AVAILABLE').getByTestId('ts-row-T');
  await targeting.getByRole('button').click();
  await expect(page.getByTestId('ts-row-T.GEO')).toContainText('Geography');
});

test('PW-08-16 banner link goes to the line item settings and the CSV downloads', async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`${liUrl()}/troubleshooter?d=${RANGE}`);
  await page.getByTestId('ts-banner').getByRole('link').click();
  await page.waitForURL(/\/li\/\d+\/details/);
  const res = await page.request.get(
    `/api/dv/line-items/${w.ids.liId}/troubleshooter/download?d=${RANGE}`,
  );
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('text/csv');
  const text = await res.text();
  expect(text.split('\n')[0]).toBe(
    'Stage,Reason,Sub-reason,Count,Percent of parent,Inventory,Date from,Date to',
  );
  expect(text).toContain('Total available requests,Targeting,Geography,3000,30.00');
});

test('PW-08-12 Troubleshooter of a paused line item shows the banner only', async ({ page }) => {
  await signIn(page);
  await db.lineItem.update({ where: { id: li.id }, data: { status: 'PAUSED' } });
  try {
    await page.goto(`${liUrl()}/troubleshooter?d=${RANGE}`);
    await expect(page.getByTestId('ts-banner')).toContainText('The line item is paused.');
    await expect(page.getByTestId('ts-sankey')).toHaveCount(0);
  } finally {
    await db.lineItem.update({ where: { id: li.id }, data: { status: 'ACTIVE' } });
  }
});

test('PW-06-10 campaign Alerts groups rows and the Budget chip filters', async ({ page }) => {
  await signIn(page);
  await page.goto(`${base()}/c/${w.ids.cid}/alerts`);
  await expect(page.getByRole('heading', { name: /Alerts for campaign/ })).toBeVisible();
  await expect(page.getByTestId('al-critical')).toContainText('Critical (1)');
  await expect(page.getByTestId('al-needs')).toContainText('Needs attention (1)');
  await expect(page.getByTestId('al-row-NO_SPEND_LI')).toContainText(
    "1 of 1 line items isn't spending in",
  );
  await page.getByTestId('al-chip-budget').click();
  await expect(page.getByTestId('al-critical')).toContainText('Critical (0)');
  await expect(page.getByTestId('al-row-NO_SPEND_LI')).toBeVisible();
  await page.getByTestId('al-row-NO_SPEND_LI').getByRole('button', { name: 'Expand' }).click();
  await expect(page.getByTestId('al-row-NO_SPEND_LI').getByRole('link')).toHaveCount(1);
});

test('Intelligence panel: alerts, suggestions, Investigate, Dismiss and Apply (AC-11-25)', async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`${base()}/c/${w.ids.cid}/io/${w.ids.ioId}?sim_rail=intelligence`);
  const panel = page.getByRole('complementary', { name: 'Intelligence' });
  await expect(panel.getByText('CAMPAIGN HEALTH')).toBeVisible();
  await expect(
    panel.getByText("1 line item hasn't spent anything today or yesterday"),
  ).toBeVisible();
  await expect(
    panel.getByText('Raise bid, bids are below the typical clearing price'),
  ).toBeVisible();
  // Dismiss hides the line item suggestion
  await panel
    .getByText('Raise bid, bids are below the typical clearing price')
    .locator('..')
    .getByRole('button', { name: 'Dismiss' })
    .click();
  await expect(panel.getByText('Raise bid, bids are below the typical clearing price')).toHaveCount(
    0,
  );
  expect((await db.recommendation.findUniqueOrThrow({ where: { id: liRec } })).status).toBe(
    'DISMISSED',
  );
  // Apply sets the IO flag
  const row = panel.getByText('Enable automatic budget allocation').locator('..');
  await row.getByRole('button', { name: 'Apply' }).click();
  await expect(panel.getByText('Enable automatic budget allocation')).toHaveCount(0);
  await expect
    .poll(
      async () =>
        (await db.insertionOrder.findUniqueOrThrow({ where: { id: io.id } })).autoBudgetAllocation,
    )
    .toBe(true);
  expect((await db.recommendation.findUniqueOrThrow({ where: { id: ioRec } })).status).toBe(
    'APPLIED',
  );
});

test('Intelligence panel Investigate opens the Troubleshooter for a bid suggestion', async ({
  page,
}) => {
  await signIn(page);
  await db.recommendation.update({ where: { id: liRec }, data: { status: 'OPEN' } });
  await page.goto(`${liUrl()}?sim_rail=intelligence`);
  const panel = page.getByRole('complementary', { name: 'Intelligence' });
  await panel
    .getByText('Raise bid, bids are below the typical clearing price')
    .locator('..')
    .getByRole('button', { name: 'Investigate' })
    .click();
  await page.waitForURL(/\/troubleshooter$/);
});

test('read-only people see the rows without Apply or Dismiss (AC-11-26)', async ({ page }) => {
  await signIn(page, readOnly);
  await page.goto(`${liUrl(readOnly)}/troubleshooter`);
  await expect(page.getByTestId('ts-kpis')).toBeVisible();
  const res = await page.request.post('/api/dv/recommendations/none', {
    data: { action: 'dismiss' },
  });
  expect([403, 404]).toContain(res.status());
});

test('PW-03-6 Alert preferences: dependency, validation, save and read-only', async ({ page }) => {
  await signIn(page);
  await page.goto(`${base()}/alert-config`);
  const save = page.getByRole('button', { name: 'Save' });
  await expect(save).toBeDisabled();
  await expect(page.getByTestId('alert-NO_SPEND')).toBeChecked();
  await expect(page.getByTestId('alert-EXCEEDED_SPEND_THRESHOLD')).not.toBeChecked();
  await expect(page.getByRole('textbox', { name: 'Spend threshold' })).toBeDisabled();
  // an out of range percentage is refused by ADV-015
  await page.getByRole('textbox', { name: 'Underpacing threshold' }).fill('101');
  await save.click();
  await expect(page.getByText('Enter a number between 1 and 100.')).toBeVisible();
  // Underpacing off disables the dependent toggles (ADV-019)
  await page.getByRole('textbox', { name: 'Underpacing threshold' }).fill('80');
  await page.getByTestId('alert-UNDERPACING').uncheck();
  await expect(page.getByTestId('alert-DEALS_OFFLINE')).toBeDisabled();
  await page.getByTestId('alert-UNDERPACING').check();
  await page.getByTestId('alert-REJECTED_CREATIVE').uncheck();
  await save.click();
  await expect(page.getByText('Alert preferences saved.')).toBeVisible();
  await expect(save).toBeDisabled();
  const row = await db.advertiserAlertPreference.findFirstOrThrow({
    where: { advertiserId: w.rows.advertiserId, alertType: 'REJECTED_CREATIVE' },
  });
  expect(row.enabled).toBe(false);
  await page.reload();
  await expect(page.getByTestId('alert-REJECTED_CREATIVE')).not.toBeChecked();
  await expect(page.getByRole('textbox', { name: 'Underpacing threshold' })).toHaveValue('80');
});

test('Alert preferences are read only for a limited-access person', async ({ page }) => {
  await signIn(page, readOnly);
  await page.goto(`${base(readOnly)}/alert-config`);
  await expect(page.getByTestId('alert-NO_SPEND')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
});
