// P4-02, module 13 6.2: E2E-INV-01 My inventory and the deal page, E2E-INV-02 instant deal, E2E-INV-03 instant deal
// errors, E2E-INV-04 negotiation to a PG deal, E2E-INV-05 Marketplace bulk assign, E2E-INV-06 Discover,
// E2E-INV-07 read-only role, E2E-INV-08 deal groups. Synthetic data only.
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';
import { cleanup } from '../auth/fixtures';
import { createShellWorld, type ShellWorld } from '../shell/e2e-world';
import { buildCatalogue } from '../../lib/inventory/catalogue';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
let w: ShellWorld;
let readOnly: ShellWorld;
let videoLiId = '';

const adv = (world: ShellWorld = w) => `/p/${world.ids.pid}/a/${world.ids.aid}`;

/** The global catalogue the Marketplace reads (what prisma/seed/30-marketplace.seed.ts writes). */
async function seedCatalogue() {
  for (const p of buildCatalogue()) {
    const data = {
      type: p.type,
      exchangeId: p.exchangeId,
      name: p.name,
      description: p.description,
      sellerKind: p.sellerKind,
      isInstantSeller: p.isInstantSeller,
      instantTargetingOptions: p.instantTargetingOptions ?? undefined,
      sevenDayImpressions: p.sevenDayImpressions,
      floorPrice: p.floorPrice,
      floorCurrency: p.floorCurrency,
      featuredCarousel: p.featuredCarousel,
      featuredCarouselOrder: p.featuredCarouselOrder,
      bannerKey: p.bannerKey,
      categories: p.categories,
      googleAudienceCount: p.googleAudienceCount,
      scale: p.scale as object,
      searchText: p.searchText,
    };
    await db.marketplaceProduct.upsert({
      where: { id: p.id },
      create: { id: p.id, ...data },
      update: data,
    });
  }
}

/** A student whose sandbox has the starter-agency inventory (seeded on first read) and a sim clock to move. */
async function inventoryWorld(tag: string, role?: 'READ_ONLY') {
  const world = await createShellWorld(db, { tag, ...(role ? { role } : {}) });
  await db.sandbox.update({
    where: { id: world.sandboxId },
    data: { seedTemplateKey: 'starter-agency' },
  });
  // seeded deals are not part of the shell fixture: drop its single fixture deal and negotiation first
  await db.negotiation.deleteMany({ where: { sandboxId: world.sandboxId } });
  await db.inventorySourceDeal.deleteMany({ where: { sandboxId: world.sandboxId } });
  return world;
}

test.beforeAll(async () => {
  await seedCatalogue();
  const tag = `pw13-${Date.now()}`;
  w = await inventoryWorld(tag);
  readOnly = await inventoryWorld(`${tag}-ro`, 'READ_ONLY');
  const li = await db.lineItem.create({
    data: {
      sandboxId: w.sandboxId,
      ioId: (await db.insertionOrder.findFirstOrThrow({ where: { sandboxId: w.sandboxId } })).id,
      campaignId: (await db.campaign.findFirstOrThrow({ where: { sandboxId: w.sandboxId } })).id,
      advertiserId: w.rows.advertiserId,
      name: 'Festive video LI',
      type: 'VIDEO',
    },
  });
  videoLiId = li.id;
  await db.lineItem.updateMany({ where: { sandboxId: w.sandboxId }, data: { status: 'ACTIVE' } });
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

test('E2E-INV-01: My inventory splits Action required from the rest, expands an order and opens the deal page tabs', async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`${adv()}/marketplace/inventory`);
  await expect(page.getByRole('heading', { name: 'My inventory' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Orders and deals' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Packages' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Deal groups' })).toBeVisible();
  await expect(page.getByText('Everything else')).toBeVisible();
  await expect(page.getByText('Status: 5 selected')).toBeVisible();

  const expand = page.getByRole('button', { name: 'Expand row' }).first();
  await expect(page.getByTestId('deal-link')).toHaveCount(0);
  await expand.click();
  await expect(page.getByTestId('deal-link').first()).toBeVisible();
  await page.getByRole('button', { name: 'Collapse all' }).click();
  await expect(page.getByTestId('deal-link')).toHaveCount(0);
  await page.getByRole('button', { name: 'Expand all' }).click();
  await expect(page.getByTestId('deal-link').first()).toBeVisible();

  await page.getByTestId('deal-link').first().click();
  await page.waitForURL(/\/marketplace\/inventory\/details/);
  await expect(
    page.getByText('The line item information below only applies to this deal'),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Access' }).click();
  await expect(page).toHaveURL(/activeTab=accessTab/);
  await expect(page.getByText('Write access')).toBeVisible();
  await page.getByRole('tab', { name: 'Settings' }).click();
  await expect(page.getByText('Programmatic Guaranteed Direct (BETA)')).toBeVisible();
  await expect(page.getByText('Inventory is view only')).toHaveCount(0);
  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page).toHaveURL(/activeTab=historyTab/);
});

test('E2E-INV-02: instant deal, pick a seller, name it, two targeting rows, forecast, accept, the deal is in the grid', async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`${adv()}/marketplace/inventory`);
  await page.getByRole('button', { name: 'Instant deal' }).click();
  await page.waitForURL(/instant-deal\/new/);
  await expect(page.getByText('Create an instant deal')).toBeVisible();
  await page.getByRole('radio', { name: 'Netflix' }).click();
  await page.getByRole('textbox', { name: 'Instant deal name' }).fill('PW festive instant deal');
  await page.getByRole('button', { name: 'Edit Country & Region' }).click();
  await page.getByRole('checkbox', { name: 'India' }).check();
  await page.getByRole('button', { name: 'Apply' }).click();
  await page.getByRole('button', { name: 'Edit Format' }).click();
  await page.getByRole('checkbox', { name: 'Video' }).check();
  await page.getByRole('button', { name: 'Apply' }).click();

  await page.getByRole('button', { name: 'Accept' }).click();
  await expect(
    page
      .getByText('You will be able to accept an instant deal after reviewing the forecast.')
      .last(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Request forecast' }).click();
  await expect(page.getByTestId('forecast')).toBeVisible();
  const p50 = await page.getByTestId('forecast-p50').textContent();
  await page.getByRole('button', { name: 'Request forecast' }).click();
  await expect(page.getByTestId('forecast-p50')).toHaveText(p50 ?? '');
  await page.getByRole('button', { name: 'Accept' }).click();

  await page.waitForURL(/\/marketplace\/inventory$/);
  await page.getByRole('button', { name: 'Expand all' }).click();
  await expect(page.getByRole('link', { name: 'PW festive instant deal' })).toBeVisible();
});

test('E2E-INV-03: instant deal submitted empty shows the validation texts', async ({ page }) => {
  await signIn(page);
  await page.goto(`${adv()}/marketplace/inventory/instant-deal/new`);
  await page.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByText('A selection is required')).toBeVisible();
  await expect(page.getByText('Enter a value')).toBeVisible();
  await expect(page.getByText('At least 1 targeting setting is required')).toBeVisible();
});

test('E2E-INV-04: import an RFP, counter, wait for the seller, accept, assign the draft PG deal to a line item and activate it', async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`${adv()}/marketplace/negotiations`);
  await expect(page.getByRole('link', { name: 'Prime Video PG Deal' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Festival Video Reach' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Import negotiation' }).click();
  await page.getByLabel('RFP ID').fill('RFP-000000');
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByText("We couldn't find a negotiation with that RFP ID.")).toBeVisible();
  await page.getByLabel('RFP ID').fill('RFP-100231');
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.waitForURL(/\/marketplace\/negotiations\/\w+/);
  await expect(page.getByTestId('negotiation-status')).toHaveText('Proposed');
  await expect(page.getByTestId('negotiation-banner')).toContainText('Waiting for you');

  await page.getByRole('button', { name: 'Counter' }).click();
  await page.getByLabel('Rate (CPM)').fill('150');
  await page.getByRole('button', { name: 'Send counter' }).click();
  await expect(page.getByTestId('negotiation-banner')).toHaveText('Waiting for the seller');

  // fast-forward the sim clock 48 hours, what the instructor console does
  await db.simClock.update({
    where: { sandboxId: w.sandboxId },
    data: { tickIndex: { increment: 48 } },
  });
  await page.reload();
  await expect(page.getByTestId('negotiation-banner')).toContainText('Waiting for you');
  await page.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(page.getByTestId('negotiation-status')).toHaveText('Accepted');
  await page.getByRole('link', { name: 'Festival Video Reach' }).click();
  await page.waitForURL(/\/marketplace\/inventory\/details/);

  // assign the deal to the video line item, then activate it
  await page.getByRole('button', { name: 'Assign to line items' }).click();
  await page.getByRole('checkbox', { name: /Festive video LI/ }).check();
  await page.getByRole('button', { name: 'Assign', exact: true }).click();
  await expect(page.getByTestId('deal-line-item')).toHaveCount(1);
  await expect(page.getByTestId('deal-line-item')).toContainText('Festive video LI');
  await page.getByRole('button', { name: 'Status: Draft' }).click();
  await page.getByRole('menuitem', { name: 'Active' }).click();
  await expect(page.getByRole('button', { name: 'Status: Active' })).toBeVisible();
  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page.getByTestId('history-row').first()).toBeVisible();
});

test('E2E-INV-05: Marketplace bulk assign on a Display and a Video line item gives one success and INV-017', async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`${adv()}/marketplace/featured-v3`);
  await expect(
    page.getByRole('heading', { name: /Premium CTV: Always-On Video \(7\)/ }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: /Audio Essentials \(16\)/ })).toBeVisible();
  await page.getByRole('button', { name: 'Bulk assign (7)' }).first().click();
  await page.getByRole('checkbox', { name: /Festive display LI/ }).check();
  await page.getByRole('checkbox', { name: /Festive video LI/ }).check();
  await page.getByRole('button', { name: 'Assign', exact: true }).click();
  const result = page.getByTestId('assign-result');
  await expect(result).toContainText('1 of 2 line items assigned.');
  await expect(result).toContainText("This package can't be assigned to Display line items.");
  await page.getByRole('button', { name: 'Close' }).click();
  expect(
    await db.lineItemInventory.count({
      where: { sandboxId: w.sandboxId, lineItemId: videoLiId, kind: 'PACKAGE' },
    }),
  ).toBeGreaterThanOrEqual(7);
});

test('E2E-INV-06: Discover keyword search, filter by format, open the slide-over and Assign', async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`${adv()}/marketplace-discovery`);
  await page.getByLabel('Describe inventory or use keywords').fill('video');
  await page.getByRole('button', { name: 'Keyword search' }).click();
  await expect(page.getByTestId('discover-name').first()).toBeVisible();
  await page.getByRole('checkbox', { name: 'Video' }).check();
  await expect(page.getByTestId('discover-name').first()).toBeVisible();
  await page.getByTestId('discover-name').first().click();
  await expect(page).toHaveURL(/sim_panel=item(:|%3A)/);
  await expect(page.getByTestId('item-panel')).toBeVisible();
  await expect(page.getByText('Available capabilities')).toBeVisible();
  await page.getByRole('tab', { name: 'Google audiences' }).click();
  await expect(page.getByRole('list', { name: 'Google audiences' })).toBeVisible();
  await page.getByRole('tab', { name: 'Scale' }).click();
  await page.getByTestId('item-panel').getByRole('button', { name: 'Assign' }).click();
  await page.getByRole('checkbox', { name: /Festive video LI/ }).check();
  await page.getByRole('button', { name: 'Assign', exact: true }).last().click();
  await expect(page.getByTestId('assign-result')).toBeVisible();
});

test('E2E-INV-07: a read-only user sees the grid without Instant deal, Assign or selection', async ({
  page,
}) => {
  await signIn(page, readOnly);
  await page.goto(`${adv(readOnly)}/marketplace/inventory`);
  await expect(page.getByRole('button', { name: 'Instant deal' })).toBeDisabled();
  await page.getByRole('button', { name: 'Expand all' }).click();
  await page.getByTestId('deal-link').first().click();
  await page.waitForURL(/\/marketplace\/inventory\/details/);
  await page.getByRole('tab', { name: 'Settings' }).click();
  await expect(page.getByText('Inventory is view only')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save frequency cap' })).toHaveCount(0);
  await page.goto(`${adv(readOnly)}/marketplace/featured-v3`);
  await expect(page.getByRole('button', { name: /Bulk assign/ })).toHaveCount(0);
  await page.goto(`${adv(readOnly)}/marketplace-discovery`);
  await page.getByTestId('discover-name').first().click();
  await expect(page.getByTestId('item-panel')).toBeVisible();
  await expect(page.getByTestId('item-panel').getByRole('button', { name: 'Assign' })).toHaveCount(
    0,
  );
});

test('E2E-INV-08: create a deal group, edit its members and delete it', async ({ page }) => {
  await signIn(page);
  await page.goto(`${adv()}/marketplace/inventory/groups`);
  await expect(page.getByText('Priority deals')).toBeVisible();
  await page.getByRole('button', { name: 'New group' }).click();
  await expect(page).toHaveURL(/sim_panel=group(:|%3A)new/);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Enter a value')).toBeVisible();
  await expect(page.getByText('A selection is required')).toBeVisible();
  await page.getByRole('textbox', { name: 'Name' }).fill('PW preferred set');
  await page.getByRole('combobox', { name: /Type/ }).click();
  await page.getByRole('option', { name: 'Preferred deal group' }).click();
  await page
    .getByRole('checkbox', { name: /Deal\)$/ })
    .first()
    .check();
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('button', { name: 'PW preferred set' })).toBeVisible();

  await page.getByRole('button', { name: 'PW preferred set' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('PW preferred set 2');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: 'PW preferred set 2' })).toBeVisible();

  await page.getByRole('button', { name: 'PW preferred set 2' }).click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('button', { name: 'PW preferred set 2' })).toHaveCount(0);
});
