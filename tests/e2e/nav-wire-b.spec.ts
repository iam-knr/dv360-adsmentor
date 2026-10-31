// NAV-WIRE-B: the advertiser settings pages (module 03), targeting templates (module 10) and the campaign Combined tab
// (module 06) that used to be "Not built yet" placeholders. Synthetic data only.
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';
import { cleanup } from '../auth/fixtures';
import { createShellWorld, type ShellWorld } from '../shell/e2e-world';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
let w: ShellWorld;
let readOnly: ShellWorld;
let admin: ShellWorld;

const adv = (world: ShellWorld = w) => `/p/${world.ids.pid}/a/${world.ids.aid}`;

test.beforeAll(async () => {
  const tag = `pwnb-${Date.now()}`;
  w = await createShellWorld(db, { tag });
  readOnly = await createShellWorld(db, { tag: `${tag}-ro`, role: 'READ_ONLY' });
  admin = await createShellWorld(db, { tag: `${tag}-adm`, role: 'ADMIN' });
});
test.afterAll(async () => {
  await cleanup(db, {
    userIds: [...w.userIds, ...readOnly.userIds, ...admin.userIds],
    classroomIds: [w.classroomId, readOnly.classroomId, admin.classroomId],
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

test('Basic details: edit the website, save, and the value persists', async ({ page }) => {
  await signIn(page);
  await page.goto(`${adv()}/details`);
  await expect(page.getByRole('heading', { name: 'Basic details' })).toBeVisible();
  await expect(page.getByText('Not built yet')).toHaveCount(0);
  const save = page.getByRole('button', { name: 'Save', exact: true });
  await expect(save).toBeDisabled();
  await page.getByRole('textbox', { name: 'Website' }).fill('https://pw-nav-wire-b.example.com');
  await page.getByRole('radio', { name: /No, it doesn't contain EU political ads/ }).check();
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByText('Advertiser details saved.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Website' })).toHaveValue(
    'https://pw-nav-wire-b.example.com',
  );
});

test('Basic details: a blank name shows ADV-001', async ({ page }) => {
  await signIn(page);
  await page.goto(`${adv()}/details`);
  await page.getByRole('textbox', { name: 'Advertiser name' }).fill('');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Enter a value').first()).toBeVisible();
});

test('Targeting rules shows the four locked rows', async ({ page }) => {
  await signIn(page);
  await page.goto(`${adv()}/targeting`);
  await expect(
    page.getByText('Targeting rules are applied to all new and existing targeting templates'),
  ).toBeVisible();
  for (const t of ['Brand suitability', 'Channels & YouTube URLs', 'Keywords', 'Viewability'])
    await expect(page.getByRole('heading', { name: t })).toBeVisible();
  await expect(page.getByText('Maximum inventory')).toBeVisible();
});

test('Data manager: both tabs, and Link new account adds a row', async ({ page }) => {
  await signIn(page, admin);
  await page.goto(`${adv(admin)}/data-manager`);
  await expect(page.getByRole('heading', { name: 'Google tag' })).toBeVisible();
  await page.getByRole('tab', { name: 'Linked accounts' }).click();
  await page.waitForURL(/linked-accounts/);
  await page.getByRole('button', { name: 'Link new account' }).click();
  await page.getByRole('menuitem', { name: 'Google Ads' }).click();
  await page.getByLabel(/Account name/).fill('PW Google Ads account');
  await page.getByRole('button', { name: 'Link', exact: true }).click();
  await expect(page.getByText(/PW Google Ads account/)).toBeVisible();
});

test('Policy center: lists the certificate cards and requests one', async ({ page }) => {
  await signIn(page);
  await page.goto(`${adv()}/policy-center`);
  await expect(page.getByText('Addiction service providers')).toBeVisible();
  await expect(page.getByText('No certificates.').first()).toBeVisible();
  await page
    .getByRole('region', { name: 'Addiction service providers' })
    .getByRole('button', { name: 'Request Certificate' })
    .click();
  await page.getByRole('button', { name: 'Request', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Addiction service providers' }).getByText('Requested'),
  ).toBeVisible();
});

test('read only role sees the pages without write controls', async ({ page }) => {
  await signIn(page, readOnly);
  await page.goto(`${adv(readOnly)}/details`);
  await expect(page.getByText('Limited Access')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
  await page.goto(`${adv(readOnly)}/linked-accounts`);
  await expect(page.getByRole('button', { name: 'Link new account' })).toBeDisabled();
});

test('Targeting templates: create, edit, archive and unarchive', async ({ page }) => {
  await signIn(page);
  await page.goto(`${adv()}/templates`);
  await expect(
    page.getByRole('heading', { name: 'Targeting templates', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'New', exact: true }).click();
  await page.waitForURL(/templates\/new/);
  await page.getByText('Display', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForURL(/type=display/);
  await page.getByLabel(/^Name/).fill('PW display template');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForURL((u) => u.pathname.endsWith('/templates'));
  await expect(page.getByRole('link', { name: 'PW display template' })).toBeVisible();

  await page.getByRole('link', { name: 'PW display template' }).click();
  await page.getByLabel(/^Name/).fill('PW display template v2');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForURL((u) => u.pathname.endsWith('/templates'));
  await expect(page.getByRole('link', { name: 'PW display template v2' })).toBeVisible();

  await page
    .getByRole('row', { name: /PW display template v2/ })
    .getByRole('button', { name: 'Archive' })
    .click();
  await expect(page.getByRole('link', { name: 'PW display template v2' })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Status filter' }).click();
  await page.getByRole('option', { name: 'Status: Archived' }).click();
  await page
    .getByRole('row', { name: /PW display template v2/ })
    .getByRole('button', { name: 'Unarchive' })
    .click();
});

test('Targeting template name is required (TPL-003)', async ({ page }) => {
  await signIn(page);
  await page.goto(`${adv()}/templates/new?type=video`);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Enter a value').first()).toBeVisible();
});

test('Combined tab lists IOs with their line items nested', async ({ page }) => {
  await signIn(page);
  const campaign = await db.campaign.findFirstOrThrow({ where: { sandboxId: w.sandboxId } });
  await page.goto(`${adv()}/c/${campaign.publicId}/explorercombined`);
  await expect(page.getByText('Not built yet')).toHaveCount(0);
  await expect(
    page.getByRole('treegrid', { name: 'Insertion orders and line items' }),
  ).toBeVisible();
});

test('Partner Floodlight group rows link to the advertiser Floodlight page', async ({ page }) => {
  await signIn(page);
  const a = await db.advertiser.findFirstOrThrow({ where: { sandboxId: w.sandboxId } });
  await db.floodlightGroup.create({
    data: { sandboxId: w.sandboxId, advertiserId: a.id, name: 'PW partner group' },
  });
  await page.goto(`/p/${w.ids.pid}/floodlights`);
  await page.getByRole('link', { name: 'PW partner group' }).click();
  await page.waitForURL(/\/a\/\d+\/fl\/events/);
});

test('the Resources menu names the location extension page by its content', async ({ page }) => {
  await signIn(page);
  await page.goto(`${adv()}/location-extension`);
  await expect(page.getByRole('heading', { name: 'Location & sitelink assets' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Location & sitelink assets' })).toBeVisible();
});
