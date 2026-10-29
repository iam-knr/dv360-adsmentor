// P4-04, module 15 6.2: E2E-RES-01 channels, E2E-RES-02 negative keyword lists, E2E-RES-03 location lists,
// E2E-RES-04 Floodlight conversions and Basic details, E2E-RES-07 brand controls, E2E-RES-08 read-only role.
// (Custom bidding E2E-RES-05 and 06 belong to P4-05.) Synthetic data only.
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';
import { cleanup } from '../auth/fixtures';
import { createShellWorld, type ShellWorld } from '../shell/e2e-world';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
let w: ShellWorld;
let readOnly: ShellWorld;

const adv = (world: ShellWorld = w) => `/p/${world.ids.pid}/a/${world.ids.aid}`;

test.beforeAll(async () => {
  const tag = `pw15-${Date.now()}`;
  w = await createShellWorld(db, { tag });
  readOnly = await createShellWorld(db, { tag: `${tag}-ro`, role: 'READ_ONLY' });
  // Reference rows the location list resolver needs.
  await db.targetingOption.upsert({
    where: { dimension_code: { dimension: 'GEOGRAPHY', code: 'IN' } },
    update: {},
    create: {
      dimension: 'GEOGRAPHY',
      code: 'IN',
      name: 'India',
      meta: { kind: 'COUNTRY', country: 'IN' },
    },
  });
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

test('E2E-RES-01: create a channel with URLs and apps, edit it, and the unsaved dialog guards the panel', async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`${adv()}/channels`);
  await expect(page.getByText('No channels yet')).toBeVisible();
  await page.getByRole('button', { name: 'New channel' }).first().click();

  const save = page.getByRole('button', { name: 'Save' });
  await expect(save).toBeDisabled();
  await page.locator('#channel-name').fill('PW trusted sites');
  await page
    .locator('#channel-sites')
    .fill('news.example.com\nhttps://shop.example.com/\ncom.example.lumen.pay\nnot a url');
  await expect(save).toBeDisabled(); // CH-003 line 4 is invalid on the client too
  await page
    .locator('#channel-sites')
    .fill('news.example.com\nhttps://shop.example.com/\ncom.example.lumen.pay\nnews.example.com');
  await expect(page.getByText('1 duplicates will be removed')).toBeVisible();
  await expect(page.getByText('2 URLs')).toBeVisible();
  await expect(page.getByText('1 apps')).toBeVisible();
  await expect(page.getByText('4 / 10000')).toBeVisible();
  await save.click();

  const row = page.getByRole('row', { name: /PW trusted sites/ });
  await expect(row).toBeVisible();
  await expect(row).toContainText('1'); // apps
  await expect(row).toContainText('2'); // urls

  // Edit: open, change, close with edits -> CHANNEL_UNSAVED dialog, keep editing, then save.
  await page.getByRole('button', { name: 'PW trusted sites' }).click();
  await expect(page.locator('#channel-name')).toHaveValue('PW trusted sites'); // panel loaded
  await page.locator('#channel-name').fill('PW trusted sites v2');
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await expect(
    page.getByText(
      'You have made changes to this channel that have not yet been saved and will be lost.',
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Continue editing' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: 'PW trusted sites v2' })).toBeVisible();
  const channel = await db.channel.findFirstOrThrow({
    where: { sandboxId: w.sandboxId, name: 'PW trusted sites v2' },
  });
  expect(await db.channelEntry.count({ where: { channelId: channel.id } })).toBe(3);
});

test('E2E-RES-02: a negative keyword list takes three separator forms, shows its line items and moves the Keyword row', async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`${adv()}/negative-keywords`);
  await page.getByRole('button', { name: 'New List' }).click();
  await page.locator('#keyword-list-name').fill('PW safety');
  await page.locator('#keyword-list-keywords').fill('Free Download, CRACK\ntorrent');
  await page.getByRole('button', { name: 'Save' }).click();
  const row = page.getByRole('row', { name: /PW safety/ });
  await expect(row).toBeVisible();
  await expect(row).toContainText('3');

  // The targeting panel cannot pick keyword lists yet (P3-07 files), so the assignment is written directly.
  const list = await db.keywordList.findFirstOrThrow({
    where: { sandboxId: w.sandboxId, name: 'PW safety' },
  });
  const li = await db.lineItem.findFirstOrThrow({ where: { sandboxId: w.sandboxId } });
  await page.goto(`${adv()}/brand/controls`);
  await expect(page.getByText('0/1 Line items').first()).toBeVisible();
  await db.targetingAssignment.create({
    data: {
      sandboxId: w.sandboxId,
      ownerType: 'LINE_ITEM',
      lineItemId: li.id,
      dimension: 'NEGATIVE_KEYWORD_LIST',
      mode: 'EXCLUDE',
      refType: 'KEYWORD_LIST',
      refId: list.id,
    },
  });
  await page.reload();
  const keywordCard = page.getByTestId('coverage-KEYWORDS');
  await expect(keywordCard).toContainText('100% (1/1 Line items)');
  await page.goto(`${adv()}/negative-keywords?list=${list.publicId}`);
  await expect(page.getByRole('table', { name: 'Line items' })).toContainText(li.name);
});

test('E2E-RES-03: location list errors name the line, the fixed list saves, a used list warns before delete', async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`${adv()}/location-lists-v2`);
  await page
    .getByRole('link', { name: 'Create new' })
    .or(page.getByRole('button', { name: 'Create new' }))
    .click();
  await page.locator('#location-list-name').fill('PW metros');
  await page.getByRole('radio', { name: /Regional Targeting/ }).check();
  await page.locator('#location-list-entries').fill('560001\n!!\n400001\n??');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(
    page.getByText("Line 2: Line 2 isn't a valid postal code or DMA region.").first(),
  ).toBeVisible();
  await page.locator('#location-list-entries').fill('560001\n400001');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForURL(/location-lists-v2/);
  await expect(page.getByRole('row', { name: /PW metros/ })).toContainText('Regional');

  // Proximity list
  await page.goto(`${adv()}/ll/new`);
  await page.locator('#location-list-name').fill('PW stores');
  await page.getByRole('radio', { name: /Proximity Targeting/ }).check();
  await page
    .locator('#location-list-entries')
    .fill('12.9716,77.5946;10\n12 Orchard Lane, Bengaluru');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForURL(/location-lists-v2/);
  await expect(page.getByRole('row', { name: /PW stores/ })).toContainText('Proximity');

  // A used list warns with the count, and the type is locked on edit.
  const list = await db.locationList.findFirstOrThrow({
    where: { sandboxId: w.sandboxId, name: 'PW metros' },
  });
  const li = await db.lineItem.findFirstOrThrow({ where: { sandboxId: w.sandboxId } });
  await db.targetingAssignment.create({
    data: {
      sandboxId: w.sandboxId,
      ownerType: 'LINE_ITEM',
      lineItemId: li.id,
      dimension: 'GEOGRAPHY',
      mode: 'INCLUDE',
      refType: 'LOCATION_LIST',
      refId: list.id,
    },
  });
  await page.goto(`${adv()}/ll/${list.publicId}`);
  await expect(page.getByRole('radio', { name: /Regional Targeting/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Delete list' }).click();
  await expect(page.getByText('1 line items use this list.')).toBeVisible();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.waitForURL(/location-lists-v2/);
  expect(await db.locationList.count({ where: { id: list.id } })).toBe(0);
  expect(
    await db.targetingAssignment.count({ where: { refType: 'LOCATION_LIST', refId: list.id } }),
  ).toBe(0);
});

test('E2E-RES-04: a Web Sale conversion, FL-014 on a wrong method, and the Basic details windows', async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`${adv()}/fl/events/new?type=web`);
  await page.locator('#conversion-name').fill('PW purchase');
  await page.getByRole('radio', { name: 'Sale' }).check();
  await page.getByRole('combobox', { name: 'Counting method' }).click();
  await page.getByRole('option', { name: 'Transactions' }).click();
  await page.getByRole('checkbox', { name: /remarketing/i }).check();
  await expect(
    page.getByText('The first-party list can take up to an hour to fill.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForURL(/fl\/events$/);
  const row = page.getByRole('row', { name: /PW purchase/ });
  await expect(row).toContainText('Sale');
  await expect(row).toContainText('Transactions');
  await expect(row).toContainText('Yes'); // remarketing list

  // Basic details: windows 1 to 90 are validated, then saved and logged.
  await page.goto(`${adv()}/fl/details`);
  await page.getByRole('button', { name: 'Edit Attribution' }).click();
  await page.locator('#click-days').fill('91');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Enter a number between 1 and 90.')).toBeVisible();
  await page.locator('#click-days').fill('45');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Clicks 45 Days')).toBeVisible();
  const group = await db.floodlightGroup.findFirstOrThrow({ where: { sandboxId: w.sandboxId } });
  expect(group.clickWindowDays).toBe(45);
  await page.goto(`${adv()}/fl/history`);
  await expect(page.getByRole('table', { name: 'Floodlight history' })).toContainText(
    'Click conversion window',
  );
});

test('E2E-RES-07: brand controls coverage follows the line item settings', async ({ page }) => {
  await signIn(page);
  const li = await db.lineItem.findFirstOrThrow({ where: { sandboxId: w.sandboxId } });
  await page.goto(`${adv()}/brand/controls`);
  const verification = () => page.getByTestId('coverage-VERIFICATION');
  await expect(verification()).toContainText('0% (0/1 Line items)');
  await db.targetingAssignment.create({
    data: {
      sandboxId: w.sandboxId,
      ownerType: 'LINE_ITEM',
      lineItemId: li.id,
      dimension: 'THIRD_PARTY_VERIFIER',
      mode: 'INCLUDE',
      valueText: 'verifier-a',
    },
  });
  await page.reload();
  await expect(verification()).toContainText('100% (1/1 Line items)');
  await page.getByRole('button', { name: 'View breakdown' }).last().click();
  await expect(page.getByRole('table', { name: 'Breakdown' })).toContainText('Line item');
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'YouTube' }).click();
  await expect(page).toHaveURL(/tab=youtube/);
  await expect(page.getByText('No line items yet').first()).toBeVisible();
  await expect(page.getByText('No data available')).toBeVisible();
});

test('E2E-RES-08: a read-only person sees disabled create buttons and the read-only Google tag', async ({
  page,
}) => {
  await signIn(page, readOnly);
  await page.goto(`${adv(readOnly)}/channels`);
  await expect(page.getByRole('button', { name: 'New channel' }).first()).toBeDisabled();
  await page.goto(`${adv(readOnly)}/negative-keywords`);
  await expect(page.getByRole('button', { name: 'New List' })).toBeDisabled();
  await page.goto(`${adv(readOnly)}/location-lists-v2`);
  await expect(
    page
      .getByRole('button', { name: 'Create new' })
      .or(page.getByRole('link', { name: 'Create new' })),
  ).toBeDisabled();
  // The Google tag tab needs a group; the read-only student has none, so write one with the plain client.
  const adv0 = await db.advertiser.findFirstOrThrow({ where: { sandboxId: readOnly.sandboxId } });
  await db.floodlightGroup.create({
    data: {
      sandboxId: readOnly.sandboxId,
      advertiserId: adv0.id,
      name: 'RO group',
      googleTagId: 'GT-0000000001',
      tagStatus: 'active',
    },
  });
  await page.goto(`${adv(readOnly)}/fl/google-tag`);
  await expect(page.getByText('Read-only mode')).toBeVisible();
  await expect(page.getByRole('button', { name: /edit/i })).toHaveCount(0);
  await page.goto(`${adv(readOnly)}/fl/events/new`);
  await expect(
    page.getByText('Not found').or(page.getByText("doesn't exist")).first(),
  ).toBeVisible();
});

test('YouTube assets and creator partnerships render (AC 16, 17)', async ({ page }) => {
  await signIn(page);
  const adv0 = await db.advertiser.findFirstOrThrow({ where: { sandboxId: w.sandboxId } });
  await db.youtubeAsset.createMany({
    data: [
      {
        sandboxId: w.sandboxId,
        advertiserId: adv0.id,
        kind: 'LOCATION',
        name: 'PW downtown store',
      },
      { sandboxId: w.sandboxId, advertiserId: adv0.id, kind: 'SITELINK', name: 'PW shop now' },
    ],
  });
  await page.goto(`${adv()}/location-extension`);
  await expect(page.getByText('PW downtown store')).toBeVisible();
  await expect(page.getByRole('button', { name: /Advertiser level setting/ })).toBeVisible();
  await page.getByRole('tab', { name: 'Sitelink' }).click();
  await expect(page.getByText('PW shop now')).toBeVisible();
  await page.goto(`${adv()}/creator-partnerships-hub/discover`);
  await expect(page.getByText('This area is not available in the classroom')).toBeVisible();
  for (const tab of ['Creator search', 'Content discovery', 'Management', 'Analytics']) {
    await page.getByRole('tab', { name: tab }).click();
    await expect(page.getByText('This area is not available in the classroom')).toBeVisible();
  }
});
