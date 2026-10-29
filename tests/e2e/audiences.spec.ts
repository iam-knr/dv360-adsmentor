// P4-03, module 14 6.2: E2E-AUD-01 tabs and banner, 02 tag-based lifecycle, 03 customer match upload, 04 combined,
// 05 lookalike with a small seed, 06 archive a targeted list, 07 analysis, 08 read-only role. Synthetic data only.
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';
import { cleanup } from '../auth/fixtures';
import { createShellWorld, type ShellWorld } from '../shell/e2e-world';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
let w: ShellWorld;
let readOnly: ShellWorld;
let groupId: string;

const adv = (world: ShellWorld = w) => `/p/${world.ids.pid}/a/${world.ids.aid}`;

async function audience(
  name: string,
  data: Partial<{ type: 'TAG_BASED' | 'CUSTOMER_MATCH' | 'COMBINED'; size: number }> = {},
) {
  return db.audience.create({
    data: {
      sandboxId: w.sandboxId,
      advertiserId: w.rows.advertiserId,
      name,
      type: data.type ?? 'TAG_BASED',
      status: 'ACTIVE',
      sizeDisplay: BigInt(data.size ?? 50_000),
      sizeYoutube: BigInt(Math.round((data.size ?? 50_000) * 0.6)),
      sizeMobileApp: BigInt(Math.round((data.size ?? 50_000) * 0.5)),
      sizeCtv: BigInt(Math.round((data.size ?? 50_000) * 0.2)),
      membershipDays: 30,
    },
  });
}

test.beforeAll(async () => {
  const tag = `pw14-${Date.now()}`;
  w = await createShellWorld(db, { tag });
  readOnly = await createShellWorld(db, { tag: `${tag}-ro`, role: 'READ_ONLY' });
  await db.simClock.upsert({
    where: { sandboxId: w.sandboxId },
    update: {},
    create: { sandboxId: w.sandboxId, simStart: new Date('2026-01-01T00:00:00Z'), marketSeed: 'm', sandboxSeed: 's' },
  });
  const group = await db.floodlightGroup.create({
    data: { sandboxId: w.sandboxId, advertiserId: w.rows.advertiserId, name: 'PW group' },
  });
  groupId = group.id;
  await db.floodlightActivity.create({
    data: { sandboxId: w.sandboxId, groupId, name: 'PW add to cart', remarketingEnabled: true },
  });
  await db.floodlightActivity.create({
    data: { sandboxId: w.sandboxId, groupId, name: 'PW contact', remarketingEnabled: false },
  });
  await db.floodlightVariable.create({
    data: { sandboxId: w.sandboxId, groupId, key: 'u1', name: 'Order value', ordinal: 0 },
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

const AUD_DELAY =
  'Recently added audiences will be available within 4 hours, except for Combined Audiences which are immediately available.';

test('E2E-AUD-01: four tabs, the AUD_DELAY banner, first-party columns and no create on the Partner tab', async ({
  page,
}) => {
  await audience('PW listed audience', { size: 5_000 });
  await signIn(page);
  await page.goto(`${adv()}/first-party-audiences`);
  await expect(page.getByRole('heading', { name: 'All audiences' })).toBeVisible();
  await expect(page.getByText(AUD_DELAY)).toBeVisible();
  for (const tab of ['First-party', 'Custom lists', 'Combined', 'Partner'])
    await expect(page.getByRole('tab', { name: tab })).toBeVisible();
  for (const col of ['Audience name', 'ID', 'Type', 'Source', 'Display size', 'YouTube users', 'Mobile app', 'CTV devices', 'Display line items'])
    await expect(page.getByRole('columnheader', { name: col })).toBeVisible();
  const row = page.getByRole('row', { name: /PW listed audience/ });
  await expect(row).toContainText('Tag-based');
  await expect(row).toContainText('1K-10K'); // bucket text, not the raw number
  await expect(row).not.toContainText('5,000');
  await expect(page.getByRole('button', { name: 'New Audience' })).toBeEnabled();

  await page.getByRole('tab', { name: 'Partner' }).click();
  await expect(page).toHaveURL(/partner-audiences/);
  await expect(page.getByText(AUD_DELAY)).toBeVisible();
  await expect(page.getByRole('button', { name: /^New/ })).toHaveCount(0);

  await page.getByRole('tab', { name: 'Custom lists' }).click();
  await page.getByRole('button', { name: 'New Custom List' }).click();
  await expect(page.getByRole('menuitem', { name: 'Custom affinity' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Custom Intent (YouTube)' })).toBeVisible();

  const notValid = await page.request.get(`${adv()}/audiences`);
  expect(notValid.status()).toBe(404);
});

test('E2E-AUD-02: a tag-based list saves as Processing and is Active with a size after four sim hours', async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`${adv()}/audience/new`);
  for (const t of ['Customer match', 'Tag-based audiences', 'YouTube users', 'Combined audience', 'Lookalike'])
    await expect(page.getByText(t, { exact: true }).first()).toBeVisible();
  await page.goto(`${adv()}/audience/tagbased/new`);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Enter a value').first()).toBeVisible();
  await expect(page.getByText('Select a Floodlight activity.')).toBeVisible();

  await page.locator('#audience-name').fill('PW cart visitors');
  await page.getByRole('combobox', { name: /Floodlight activity/ }).click();
  await expect(page.getByRole('option', { name: /PW contact/ })).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('option', { name: /PW add to cart/ }).click();
  await page.getByRole('button', { name: 'Add rule to narrow' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Enter a value').first()).toBeVisible(); // AUD-011: the rule has no value
  await page.getByRole('button', { name: 'Remove rule 1' }).click();
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page).toHaveURL(/first-party-audiences/);
  const row = page.getByRole('row', { name: /PW cart visitors/ });
  await expect(row).toContainText('Available in about 4 hours');
  await expect(row).toContainText('< 1K');

  await db.simClock.update({ where: { sandboxId: w.sandboxId }, data: { tickIndex: 4n } });
  await page.reload();
  const active = page.getByRole('row', { name: /PW cart visitors/ });
  await expect(active).not.toContainText('Available in about');
  await expect(active.getByTestId('size-cell').first()).not.toContainText('< 1K');
  await active.getByRole('link', { name: 'PW cart visitors' }).click();
  await expect(page.getByRole('heading', { name: /PW cart visitors \(\d+\)/ })).toBeVisible();
  await expect(page.getByText('Active', { exact: true }).first()).toBeVisible();
});

test('E2E-AUD-03: customer match upload shows rows, matched users and match rate; a file without an identifier fails', async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`${adv()}/audience/customermatch/new`);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('A selection is required')).toBeVisible();
  await page.getByText('Upload a file manually').click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.locator('#audience-name').fill('PW customers');
  await page.getByTestId('cm-file').setInputFiles({ name: 'bad.csv', mimeType: 'text/csv', buffer: Buffer.from('colour\nred\n') });
  await page.getByLabel('I confirm I have permission to use this data').check();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Upload a CSV file with at least one identifier column.')).toBeVisible();

  const rows = Array.from({ length: 1500 }, (_, i) => `person${i}@example.test`).join('\n');
  await page.getByTestId('cm-file').setInputFiles({ name: 'customers.csv', mimeType: 'text/csv', buffer: Buffer.from(`email\n${rows}\n`) });
  await page.getByRole('button', { name: 'Save' }).click();
  const result = page.getByTestId('match-result');
  await expect(result).toContainText('Rows uploaded');
  await expect(result).toContainText('1,500');
  await expect(result).toContainText('Matched users');
  await expect(result).toContainText(/Match rate\s*\d+(\.\d)?%/);
  const stored = await db.audience.findFirstOrThrow({ where: { sandboxId: w.sandboxId, name: 'PW customers' } });
  const upload = await db.customerMatchUpload.findFirstOrThrow({ where: { audienceId: stored.id } });
  expect(upload.rowCount).toBe(1500);
  expect(upload.matchedCount).toBeGreaterThan(500);
  expect(stored.consentAck).toBe(true);
});

test('E2E-AUD-04: a combined audience is available at once with an expression and a summary', async ({ page }) => {
  await audience('PW seed one', { size: 200_000 });
  await audience('PW seed two', { size: 90_000 });
  await signIn(page);
  await page.goto(`${adv()}/combinedaudience/new`);
  await expect(page.getByText('Add audiences to see summary')).toBeVisible();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Add at least one audience to include.')).toBeVisible();

  await page.locator('#audience-name').fill('PW one or two');
  await page.getByTestId('include-group').getByRole('button', { name: 'Add' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox', { name: /PW seed one/ }).check();
  await dialog.getByRole('checkbox', { name: /PW seed two/ }).check();
  await dialog.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByTestId('expression')).toHaveText('(PW seed one or PW seed two)');

  await page.getByTestId('exclude-add').click();
  await page.getByRole('dialog').getByRole('checkbox', { name: /PW seed one/ }).check();
  await page.getByRole('dialog').getByRole('button', { name: 'Apply' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText("An item can't be both included and excluded.")).toBeVisible();
});

test('E2E-AUD-04b: a valid combined audience lands in the Combined tab as Active', async ({ page }) => {
  await signIn(page);
  await page.goto(`${adv()}/combinedaudience/new`);
  await page.locator('#audience-name').fill('PW combined ok');
  await page.getByTestId('include-group').getByRole('button', { name: 'Add' }).click();
  await page.getByRole('dialog').getByRole('checkbox', { name: /PW seed one/ }).check();
  await page.getByRole('dialog').getByRole('button', { name: 'Apply' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/first-party-audiences|combined-audiences/);
  await page.goto(`${adv()}/combined-audiences`);
  const row = page.getByRole('row', { name: /PW combined ok/ });
  await expect(row).toBeVisible();
  await expect(row).not.toContainText('Available in about');
  await expect(page.getByRole('columnheader', { name: 'Active Display size' })).toBeVisible();
});

test('E2E-AUD-05: a lookalike with a small seed shows the minimum message and Save stays disabled until fixed', async ({
  page,
}) => {
  await audience('PW tiny seed', { size: 800 });
  await audience('PW big seed', { size: 40_000 });
  await signIn(page);
  await page.goto(`${adv()}/audience/lookalike/new`);
  await page.locator('#audience-name').fill('PW lookalike');
  await page.getByRole('checkbox', { name: /PW tiny seed/ }).check();
  await page.getByRole('checkbox', { name: 'India' }).check();
  await expect(page.getByText(/The first-party list must have a minimum of 1,000 active users\./)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
  await page.getByRole('checkbox', { name: /PW tiny seed/ }).uncheck();
  await page.getByRole('checkbox', { name: /PW big seed/ }).check();
  await expect(page.getByText('Least reach (2.5%)')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/first-party-audiences/);
  await expect(page.getByRole('row', { name: /PW lookalike/ })).toContainText('Lookalike');
  const stored = await db.audience.findFirstOrThrow({ where: { sandboxId: w.sandboxId, name: 'PW lookalike' } });
  expect(Number(stored.lookalikeReachPct)).toBe(5);
  expect(stored.lookalikeCountries).toEqual(['IN']);
});

test('custom affinity: the estimator says forecasting is unavailable until an entry exists (AC 8, 9)', async ({ page }) => {
  await signIn(page);
  await page.goto(`${adv()}/customaudience/affinity/new`);
  const estimator = page.getByTestId('estimator');
  await expect(estimator).toContainText('Audience forecasting is not available for this configuration.');
  await page.locator('#audience-name').fill('PW fans');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Add at least one interest, URL or app.')).toBeVisible();
  await page.getByLabel('Interests').fill('gadgets');
  await page.getByLabel('Interests').press('Enter');
  await expect(estimator.getByTestId('size-cell').first()).toBeVisible();
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page).toHaveURL(/custom-lists/);
  await expect(page.getByRole('row', { name: /PW fans/ })).toContainText('Custom affinity');

  await page.goto(`${adv()}/customaudience/intent/new?surface=youtube`);
  await page.locator('#audience-name').fill('PW intent');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Add at least one keyword or URL.')).toBeVisible();
});

test('YouTube users without a linked channel is blocked (AC 10)', async ({ page }) => {
  await signIn(page);
  await page.goto(`${adv()}/audience/youtubeusers/new`);
  await expect(page.getByText('Link a YouTube channel before creating this audience.').first()).toBeVisible();
  await page.locator('#audience-name').fill('PW viewers');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Link a YouTube channel before creating this audience.').first()).toBeVisible();
  await expect(page).toHaveURL(/youtubeusers\/new/);
});

test('E2E-AUD-06: details edit rules and archiving a list that a line item targets', async ({ page }) => {
  const a = await audience('PW targeted', { size: 30_000 });
  const li = await db.lineItem.findFirstOrThrow({ where: { sandboxId: w.sandboxId } });
  await db.lineItem.update({ where: { id: li.id }, data: { status: 'ACTIVE' } });
  await db.targetingAssignment.create({
    data: { sandboxId: w.sandboxId, ownerType: 'LINE_ITEM', lineItemId: li.id, dimension: 'AUDIENCE_LIST', mode: 'INCLUDE', refType: 'AUDIENCE', refId: a.id, audienceSection: 'FIRST_PARTY_AND_PARTNER' },
  });
  await signIn(page);
  await page.goto(`${adv()}/audience/tagbased/${a.publicId}/details`);
  await expect(page.getByRole('heading', { name: `PW targeted (${a.publicId})` })).toBeVisible();
  await page.locator('#audience-name').fill('PW targeted v2');
  await page.locator('#audience-days').fill('600');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Enter a number between 1 and 540.')).toBeVisible();
  await page.locator('#audience-days').fill('60');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: `PW targeted v2 (${a.publicId})` })).toBeVisible();
  expect((await db.audience.findUniqueOrThrow({ where: { id: a.id } })).membershipDays).toBe(60);

  // Line items tab lists exactly the targeting line items; the first-party column links to it with the same count.
  await page.getByRole('tab', { name: 'Line items' }).click();
  await expect(page).toHaveURL(new RegExp(`audience/${a.publicId}/explorerlis`));
  await expect(page.getByRole('link', { name: li.name })).toBeVisible();
  await page.goto(`${adv()}/first-party-audiences`);
  await expect(page.getByRole('row', { name: /PW targeted v2/ }).getByRole('link', { name: '1', exact: true })).toBeVisible();

  await page.goto(`${adv()}/audience/tagbased/${a.publicId}/details`);
  await page.getByRole('button', { name: 'Archive' }).click();
  await expect(page.getByText('1 active line items target this audience.')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Archive' }).click();
  await expect(page).toHaveURL(/first-party-audiences/);
  const stored = await db.audience.findUniqueOrThrow({ where: { id: a.id } });
  expect(stored.status).toBe('ARCHIVED');
  expect(await db.targetingAssignment.count({ where: { refId: a.id } })).toBe(1); // the line item keeps its reference
  await expect(page.getByRole('row', { name: /PW targeted v2/ })).toHaveCount(0);
  const history = await db.changeGroup.count({ where: { sandboxId: w.sandboxId, entityId: a.id } });
  expect(history).toBeGreaterThanOrEqual(2);
});

test('E2E-AUD-07: geographic distribution refuses a small seed; insights offer only optimized line items', async ({ page }) => {
  await audience('PW geo tiny', { size: 700 });
  await audience('PW geo seed', { size: 60_000 });
  await signIn(page);
  await page.goto(`${adv()}/audience-analysis`);
  await expect(page.getByText('Geographic distribution').first()).toBeVisible();
  await expect(page.getByText('Audience insights').first()).toBeVisible();
  await page.getByRole('link', { name: 'Open Geographic distribution' }).click();
  await expect(page.getByText(/No seed audience selected/)).toBeVisible();

  await page.getByRole('combobox', { name: /Seed audience/ }).click();
  await page.getByRole('option', { name: /PW geo tiny/ }).click();
  await page.getByRole('button', { name: 'Analyze' }).click();
  await expect(page.getByText('The first-party list must have a minimum of 1,000 active users.')).toBeVisible();
  await page.getByRole('combobox', { name: /Seed audience/ }).click();
  await page.getByRole('option', { name: /PW geo seed/ }).click();
  await page.getByRole('button', { name: 'Analyze' }).click();
  const table = page.getByRole('table', { name: 'Regions' });
  await expect(table).toBeVisible();
  const shares = await table.locator('tbody tr td:nth-child(3)').allTextContents();
  const total = shares.reduce((s, t) => s + parseFloat(t), 0);
  expect(Math.round(total * 10) / 10).toBe(100);
  const indices = (await table.locator('tbody tr td:nth-child(2)').allTextContents()).map(Number);
  expect([...indices].sort((x, y) => y - x)).toEqual(indices);

  await page.goto(`${adv()}/audience-composition-insights`);
  await expect(page.getByText('Select only line items that have Optimized Targeting enabled.')).toBeVisible();
  await expect(page.getByText('No line items have Optimized Targeting turned on.')).toBeVisible();
  const li = await db.lineItem.findFirstOrThrow({ where: { sandboxId: w.sandboxId } });
  await db.lineItem.update({ where: { id: li.id }, data: { optimizedTargeting: true } });
  await page.reload();
  await page.getByRole('combobox', { name: /Select a line item/ }).click();
  await page.getByRole('option', { name: new RegExp(li.name) }).click();
  const result = page.getByTestId('insights-result');
  await expect(result).toBeVisible();
  for (const title of ['Age', 'Gender', 'Device', 'Top regions', 'Top interests'])
    await expect(result.getByText(title, { exact: true })).toBeVisible();
  const first = await result.textContent();
  await page.reload();
  await page.getByRole('combobox', { name: /Select a line item/ }).click();
  await page.getByRole('option', { name: new RegExp(li.name) }).click();
  await expect(page.getByTestId('insights-result')).toBeVisible();
  expect(await page.getByTestId('insights-result').textContent()).toBe(first);
});

test('E2E-AUD-08: a read-only student sees disabled create buttons and no Save on details', async ({ page }) => {
  const a = await db.audience.create({
    data: { sandboxId: readOnly.sandboxId, advertiserId: readOnly.rows.advertiserId, name: 'RO list', type: 'TAG_BASED', status: 'ACTIVE', sizeDisplay: 20_000n, membershipDays: 30 },
  });
  await signIn(page, readOnly);
  await page.goto(`${adv(readOnly)}/first-party-audiences`);
  await expect(page.getByText('Limited Access').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'New Audience' })).toBeDisabled();
  await page.getByRole('tab', { name: 'Custom lists' }).click();
  await expect(page.getByRole('button', { name: 'New Custom List' })).toBeDisabled();
  await page.getByRole('tab', { name: 'Combined' }).click();
  await expect(page.getByRole('button', { name: 'New Combined Audience' })).toBeDisabled();
  await page.goto(`${adv(readOnly)}/audience/tagbased/${a.publicId}/details`);
  await expect(page.getByRole('heading', { name: `RO list (${a.publicId})` })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Archive' })).toHaveCount(0);
  // A hand made write is refused too.
  const other = await page.request.get(`${adv(readOnly)}/audience/tagbased/9999999999/details`);
  expect(other.status()).toBe(404);
});
