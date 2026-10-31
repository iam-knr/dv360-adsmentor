// P3-06c, module 08 6.2: PW-08-01 type picker, PW-08-02 create with a creative, PW-08-03 empty name, PW-08-04 create,
// PW-08-06 Demand Gen prerequisite, PW-08-07 Mobile app install pre-step, PW-08-08 validation message,
// PW-08-09 IO automation locks, PW-08-17 read-only role.
// The world holds one IO; the specs add what they need with the plain client (synthetic data only).
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';
import { cleanup } from '../auth/fixtures';
import { createShellWorld, type ShellWorld } from '../shell/e2e-world';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
let w: ShellWorld;
let readOnly: ShellWorld;
let clicksIoPublicId: string;
let automatedIoPublicId: string;

const base = () => `/p/${w.ids.pid}/a/${w.ids.aid}/c/${w.ids.cid}`;
const newLi = (io: string, query = '') => `${base()}/io/${io}/lis/new${query}`;

test.beforeAll(async () => {
  const tag = `pw06c-${Date.now()}`;
  w = await createShellWorld(db, { tag });
  readOnly = await createShellWorld(db, { tag: `${tag}-ro`, role: 'READ_ONLY' });

  // The world's IO becomes a Brand awareness IO controlled at the line item level with one budget segment.
  const io = await db.insertionOrder.findFirstOrThrow({ where: { sandboxId: w.sandboxId } });
  await db.insertionOrder.update({
    where: { id: io.id },
    data: {
      objective: 'BRAND_AWARENESS',
      bidBudgetControl: 'LI_CONTROLLED',
      kpi: 'VCPM',
      kpiValue: 50,
    },
  });
  await db.budgetSegment.create({
    data: {
      sandboxId: w.sandboxId,
      ioId: io.id,
      amount: 100000,
      startDate: new Date('2026-11-01T00:00:00Z'),
      endDate: new Date('2027-01-31T00:00:00Z'),
    },
  });
  const partner = await db.partner.findFirstOrThrow({ where: { sandboxId: w.sandboxId } });
  const exchange = await db.exchange.upsert({
    where: { code: 'PW_TEST_EXCHANGE' },
    update: {},
    create: { code: 'PW_TEST_EXCHANGE', name: 'PW Test Exchange' },
  });
  await db.partnerExchange.create({
    data: { sandboxId: w.sandboxId, partnerId: partner.id, exchangeId: exchange.id },
  });
  // Custom lists of every type for the audience picker (plan-parity: Custom affinity and Custom intent)
  for (const [name, type] of [
    ['PW Custom affinity: gadget fans', 'CUSTOM_AFFINITY'],
    ['PW Custom intent: buying a phone', 'CUSTOM_INTENT_DISPLAY_VIDEO'],
    ['PW Custom intent YouTube: phone reviews', 'CUSTOM_INTENT_YOUTUBE'],
  ] as const)
    await db.audience.create({
      data: {
        sandboxId: w.sandboxId,
        advertiserId: io.advertiserId,
        name,
        type,
        status: 'ACTIVE',
        sizeDisplay: 2_000_000n,
        sizeYoutube: 900_000n,
      },
    });
  await db.creative.create({
    data: {
      sandboxId: w.sandboxId,
      advertiserId: io.advertiserId,
      name: 'PW banner',
      kind: 'STANDARD_IMAGE',
    },
  });

  // A Clicks IO (Demand Gen and Mobile app install are allowed) and an IO that automates bid and pacing.
  const clicks = await db.insertionOrder.create({
    data: {
      sandboxId: w.sandboxId,
      campaignId: io.campaignId,
      advertiserId: io.advertiserId,
      name: 'PW Clicks IO',
      objective: 'CLICKS',
      bidBudgetControl: 'LI_CONTROLLED',
    },
  });
  clicksIoPublicId = clicks.publicId.toString();
  const automated = await db.insertionOrder.create({
    data: {
      sandboxId: w.sandboxId,
      campaignId: io.campaignId,
      advertiserId: io.advertiserId,
      name: 'PW Automated IO',
      objective: 'CLICKS',
      bidBudgetControl: 'IO_AUTOMATED',
      optimizeTarget: 'MAX_VIEWABLE_IMPRESSIONS',
    },
  });
  automatedIoPublicId = automated.publicId.toString();
  await db.budgetSegment.create({
    data: {
      sandboxId: w.sandboxId,
      ioId: automated.id,
      amount: 50000,
      startDate: new Date('2026-11-01T00:00:00Z'),
      endDate: new Date('2027-01-31T00:00:00Z'),
    },
  });
  await db.lineItem.create({
    data: {
      sandboxId: w.sandboxId,
      ioId: automated.id,
      campaignId: automated.campaignId,
      advertiserId: automated.advertiserId,
      name: 'PW automated LI',
      type: 'DISPLAY',
    },
  });
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

test('picker, validation message and creating a Display line item (PW-08-01, PW-08-08, PW-08-04)', async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`${base()}/io/${w.ids.ioId}/explorerlis`);

  // PW-08-01: the picker offers the Standard group of cards; Brand awareness greys the types it does not allow
  await page
    .getByRole('link', { name: 'New line item' })
    .or(page.getByRole('button', { name: 'New line item' }))
    .click();
  await expect(page.getByRole('button', { name: /^Display/ }).first()).toBeEnabled();
  await page
    .getByRole('button', { name: /^Display/ })
    .first()
    .click();
  await expect(page).toHaveURL(/lis\/new\?type=DISPLAY/);

  // PW-08-08: empty name is refused with the catalogue message and the page stays
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Enter a value').first()).toBeVisible();
  await expect(page).toHaveURL(/lis\/new/);

  // PW-08-04: a valid Display line item is created and its details page opens
  await page.locator('#name').fill('PW Display LI');
  await page.getByRole('radio', { name: /Does not contain EU political ads/ }).check();
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForURL(/\/li\/\d+\/details/);
  const row = await db.lineItem.findFirst({
    where: { name: 'PW Display LI', sandboxId: w.sandboxId },
  });
  expect(row?.type).toBe('DISPLAY');
  expect(row?.status).toBe('DRAFT');
});

test('PW-08-02: Display with one creative lands on the details page as Draft', async ({ page }) => {
  await signIn(page);
  await page.goto(newLi(w.ids.ioId, '?type=DISPLAY'));
  await page.locator('#name').fill('PW LI with creative');
  await page.getByRole('checkbox', { name: /PW banner/ }).check();
  await page.getByRole('radio', { name: /Does not contain EU political ads/ }).check();
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForURL(/\/li\/\d+\/details/);
  await expect(page.locator('#name')).toHaveValue('PW LI with creative');
  await expect(page.getByRole('combobox', { name: 'Status' })).toContainText('Draft');
  const row = await db.lineItem.findFirstOrThrow({
    where: { name: 'PW LI with creative', sandboxId: w.sandboxId },
    include: { assignments: true },
  });
  expect(row.status).toBe('DRAFT');
  expect(row.assignments).toHaveLength(1);
});

test('PW-08-03: Create with no name shows "Enter a value" and does not navigate', async ({
  page,
}) => {
  await signIn(page);
  await page.goto(newLi(w.ids.ioId, '?type=DISPLAY'));
  const before = await db.lineItem.count({ where: { sandboxId: w.sandboxId } });
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Enter a value').first()).toBeVisible();
  await expect(page).toHaveURL(/lis\/new\?type=DISPLAY/);
  expect(await db.lineItem.count({ where: { sandboxId: w.sandboxId } })).toBe(before);
});

test('PW-08-06: Demand Gen without Floodlight optimization shows the toast and stays', async ({
  page,
}) => {
  await db.advertiser.updateMany({
    where: { sandboxId: w.sandboxId },
    data: { demandGenFloodlightOptimization: false },
  });
  await signIn(page);
  await page.goto(newLi(clicksIoPublicId));
  await page.getByRole('button', { name: /^Demand Gen/ }).click();
  await expect(page.getByRole('status')).toContainText(/Floodlight optimization/i);
  await expect(page).toHaveURL(/lis\/new$/);
});

test('PW-08-07: Mobile app install pre-step searches the catalogue and opens the form with the app', async ({
  page,
}) => {
  await signIn(page);
  await page.goto(newLi(clicksIoPublicId));
  await page.getByRole('button', { name: /^Mobile app install/ }).click();
  const next = page.getByRole('button', { name: 'Next' });
  await expect(next).toBeDisabled();
  await page.locator('#app-search').fill('demo');
  const option = page.getByRole('option').first();
  await expect(option).toBeVisible();
  const appName = (await option.locator('h6, .MuiTypography-subtitle1').first().innerText()).trim();
  await option.click();
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page).toHaveURL(/type=MOBILE_APP_INSTALL.*appId=/);
  const app = page.getByTestId('li-app');
  await expect(app).toContainText(appName);
  // read-only: the app is text, there is no field to change it
  await expect(page.getByLabel('Mobile app')).toHaveCount(0);
});

test('PW-08-09: under IO automation pacing and bid are locked and show the IO values', async ({
  page,
}) => {
  await signIn(page);
  const li = await db.lineItem.findFirstOrThrow({
    where: { name: 'PW automated LI', sandboxId: w.sandboxId },
  });
  await page.goto(`${base()}/io/${automatedIoPublicId}/li/${li.publicId}/details`);
  await expect(page.getByText(/Pacing is set by the insertion order/)).toBeVisible();
  await expect(page.getByText(/Bid strategy comes from the insertion order/)).toBeVisible();
  await expect(page.getByLabel('Fixed bid (CPM)')).toHaveCount(0);
});

test('PW-08-17: a read-only user sees the details page without Save', async ({ page }) => {
  await signIn(page, readOnly);
  await page.goto(
    `/p/${readOnly.ids.pid}/a/${readOnly.ids.aid}/c/${readOnly.ids.cid}/io/${readOnly.ids.ioId}/li/${readOnly.ids.liId}/details`,
  );
  await expect(page.locator('#name')).toBeVisible();
  await expect(page.locator('#name')).toHaveAttribute('readonly', '');
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
});

test('PW-10-07: the audience picker offers Custom affinity and Custom intent and a line item saves them', async ({
  page,
}) => {
  await signIn(page);
  await page.goto(newLi(w.ids.ioId, '?type=DISPLAY'));
  await page.locator('#name').fill('PW custom lists LI');
  await page.getByRole('radio', { name: /Does not contain EU political ads/ }).check();
  await page.getByRole('button', { name: 'Add targeting' }).click();
  await page.getByRole('menuitem', { name: /Audience lists/ }).click();
  const editor = page.getByRole('dialog').last();
  // the Create menu of the Custom lists section links to the three Audiences forms
  await editor.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Custom affinity' })).toHaveAttribute(
    'href',
    /customaudience\/affinity\/new/,
  );
  await expect(page.getByRole('menuitem', { name: 'Custom intent (YouTube)' })).toHaveAttribute(
    'href',
    /surface=youtube/,
  );
  await page.keyboard.press('Escape');
  await editor.getByRole('button', { name: 'Select Custom lists' }).click();
  const picker = page.getByRole('dialog').last();
  await picker.getByRole('combobox', { name: 'Audience type' }).click();
  await expect(page.getByRole('option', { name: 'Custom affinity' })).toBeVisible();
  await expect(
    page.getByRole('option', { name: 'Custom intent (Display, Video)' }),
  ).toBeVisible();
  // the YouTube intent list is not offered to a Display line item
  await expect(page.getByRole('option', { name: /Custom intent \(YouTube\)/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await picker.getByRole('checkbox', { name: 'PW Custom affinity: gadget fans' }).check();
  await picker.getByRole('checkbox', { name: 'PW Custom intent: buying a phone' }).check();
  await expect(picker.getByRole('checkbox', { name: /YouTube: phone reviews/ })).toHaveCount(0);
  await picker.getByRole('button', { name: 'Apply' }).click();
  const included = editor.getByRole('list', { name: 'Included Custom lists' });
  await expect(included).toContainText('PW Custom affinity: gadget fans');
  await expect(included).toContainText('PW Custom intent: buying a phone');
  await editor.getByRole('button', { name: 'Apply' }).click();
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForURL(/\/li\/\d+\/details/);

  const li = await db.lineItem.findFirstOrThrow({
    where: { name: 'PW custom lists LI', sandboxId: w.sandboxId },
  });
  const rows = await db.targetingAssignment.findMany({
    where: { lineItemId: li.id, dimension: 'AUDIENCE_LIST' },
  });
  expect(rows.map((r) => r.audienceSection)).toEqual(['CUSTOM_LIST', 'CUSTOM_LIST']);
  const names = await db.audience.findMany({
    where: { id: { in: rows.map((r) => r.refId ?? '') } },
    select: { name: true },
  });
  expect(names.map((n) => n.name).sort()).toEqual([
    'PW Custom affinity: gadget fans',
    'PW Custom intent: buying a phone',
  ]);
});
