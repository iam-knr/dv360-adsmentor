// PW-01-5 Search (module 01 AC-01-12, AC-01-13): open by `/`, run each of the 7 chips and check the landing list and
// its chip, free text, the no-match path, name/ID search, and the partner scope. Synthetic student, own sandbox.
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';
import { cleanup } from '../auth/fixtures';
import { createShellWorld, type ShellWorld } from '../shell/e2e-world';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

let w: ShellWorld;
test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  w = await createShellWorld(db, { tag: 'search-e2e' });
  const io = await db.insertionOrder.findFirstOrThrow({ where: { sandboxId: w.sandboxId } });
  const base = {
    sandboxId: w.sandboxId,
    ioId: io.id,
    campaignId: io.campaignId,
    advertiserId: io.advertiserId,
  };
  const soon = new Date(Date.now() + 3 * 86_400_000);
  const start = new Date(Date.now() - 20 * 86_400_000);
  await db.lineItem.updateMany({ where: { sandboxId: w.sandboxId }, data: { status: 'ACTIVE' } });
  await db.lineItem.create({
    data: { ...base, name: 'Zeta paused LI', type: 'DISPLAY', status: 'PAUSED' },
  });
  await db.lineItem.create({
    data: {
      ...base,
      name: 'Zeta YouTube LI',
      type: 'YT_VIDEO',
      ytSubtype: 'EFFICIENT_REACH',
      ytSurfaces: ['IN_STREAM'],
      status: 'PAUSED',
    },
  });
  await db.lineItem.create({
    data: {
      ...base,
      name: 'Zeta expiring LI',
      type: 'DISPLAY',
      status: 'ACTIVE',
      flightMode: 'CUSTOM',
      flightStart: start,
      flightEnd: soon,
    },
  });
  await db.insertionOrder.create({
    data: {
      sandboxId: w.sandboxId,
      campaignId: io.campaignId,
      advertiserId: io.advertiserId,
      name: 'Even IO',
      objective: 'CLICKS',
      pacingType: 'EVEN',
      status: 'ACTIVE',
    },
  });
  await db.insertionOrder.update({
    where: { id: io.id },
    data: { status: 'ACTIVE', pacingType: 'AHEAD' },
  });
});

test.afterAll(async () => {
  await cleanup(db, { userIds: w.userIds, classroomIds: [w.classroomId] });
  await db.$disconnect();
});

test.beforeEach(async ({ context }) => {
  const ip = `10.${1 + Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  await context.setExtraHTTPHeaders({
    ...(bypass ? { 'x-vercel-protection-bypass': bypass } : {}),
    'x-forwarded-for': ip,
  });
});

const A = (sub = '') => `/p/${w.ids.pid}/a/${w.ids.aid}${sub}`;

async function signIn(page: Page) {
  await page.goto('/sim/login');
  await page.getByLabel('Email').fill(w.email);
  await page.getByLabel('Password').fill(w.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sim/login'));
}

async function openSearch(page: Page) {
  await page.locator('body').press('/');
  const dialog = page.getByRole('dialog', { name: 'Search' });
  await expect(dialog).toBeVisible();
  return dialog;
}

const cell = (page: Page, text: string) => page.getByRole('main').getByText(text, { exact: true });

test.describe('PW-01-5 Search overlay', () => {
  test('`/` opens the overlay with the 7 chips; Esc closes it; not while typing in an input', async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(A('/cs'));
    const dialog = await openSearch(page);
    await expect(dialog.getByText('Try searching this advertiser for:')).toBeVisible();
    for (const label of [
      'YouTube line items',
      'Paused line items',
      'Line items expiring soon',
      'Line items with unused pacing',
      'IOs with pacing type AHEAD',
      'LIs with CPC over X last week',
      'LIs with CPA over X last week',
    ]) {
      await expect(dialog.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
    await expect(dialog.getByText("Results come from the simulator's saved filters")).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    // typing a slash in the box does not reopen or break it
    const again = await openSearch(page);
    const box = again.getByRole('textbox', { name: 'Search' });
    await box.pressSequentially('a/b');
    await expect(box).toHaveValue('a/b');
  });

  test('Paused line items chip: [A]/explorerlis?f.status=PAUSED, chip Status: Paused, only paused rows', async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(A('/cs'));
    const dialog = await openSearch(page);
    await dialog.getByRole('button', { name: 'Paused line items', exact: true }).click();
    await expect(page).toHaveURL(A('/explorerlis?f.status=PAUSED'));
    await expect(page.getByRole('combobox', { name: 'Status filter' })).toContainText(
      'Status: Paused',
    );
    await expect(cell(page, 'Zeta paused LI')).toBeVisible();
    await expect(cell(page, 'Zeta expiring LI')).toHaveCount(0);
    await expect(cell(page, 'Festive display LI')).toHaveCount(0);
  });

  test('YouTube line items chip: YouTube type chip, only YouTube rows, any status', async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(A('/cs'));
    const dialog = await openSearch(page);
    await dialog.getByRole('button', { name: 'YouTube line items', exact: true }).click();
    await expect(page).toHaveURL(/explorerlis\?.*f\.type=YT_VIDEO/);
    await expect(page.getByRole('list', { name: 'Applied filters' })).toContainText(
      'Type: YouTube',
    );
    await expect(page.getByRole('combobox', { name: 'Status filter' })).toContainText(
      'Status: All',
    );
    await expect(cell(page, 'Zeta YouTube LI')).toBeVisible();
    await expect(cell(page, 'Zeta paused LI')).toHaveCount(0);
  });

  test('Line items expiring soon chip: only the line item whose flight ends within 7 days', async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(A('/cs'));
    const dialog = await openSearch(page);
    await dialog.getByRole('button', { name: 'Line items expiring soon', exact: true }).click();
    await expect(page).toHaveURL(A('/explorerlis?f.endsWithin=7'));
    await expect(page.getByRole('list', { name: 'Applied filters' })).toContainText(
      'Expiring within 7 days',
    );
    await expect(cell(page, 'Zeta expiring LI')).toBeVisible();
    await expect(cell(page, 'Festive display LI')).toHaveCount(0);
  });

  test('Line items with unused pacing chip lands on the list with its chip', async ({ page }) => {
    await signIn(page);
    await page.goto(A('/cs'));
    const dialog = await openSearch(page);
    await dialog
      .getByRole('button', { name: 'Line items with unused pacing', exact: true })
      .click();
    await expect(page).toHaveURL(/explorerlis\?f\.pacing=UNDER&d=LIFETIME/);
    await expect(page.getByRole('list', { name: 'Applied filters' })).toContainText(
      'Pacing: Unused',
    );
    await expect(page.getByRole('main').getByText('Festive display LI')).toHaveCount(0);
  });

  test('IOs with pacing type AHEAD chip: explorerios with the chip and only AHEAD IOs', async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(A('/cs'));
    const dialog = await openSearch(page);
    await dialog.getByRole('button', { name: 'IOs with pacing type AHEAD', exact: true }).click();
    await expect(page).toHaveURL(A('/explorerios?f.pacingType=AHEAD'));
    await expect(page.getByRole('list', { name: 'Applied filters' })).toContainText(
      'Pacing type: Ahead',
    );
    await expect(cell(page, 'Festive IO')).toBeVisible();
    await expect(cell(page, 'Even IO')).toHaveCount(0);
  });

  test('CPC and CPA chips land on the line item list with their chips', async ({ page }) => {
    await signIn(page);
    await page.goto(A('/cs'));
    let dialog = await openSearch(page);
    await dialog
      .getByRole('button', { name: 'LIs with CPC over X last week', exact: true })
      .click();
    await expect(page).toHaveURL(A('/explorerlis?f.cpcOver=1&d=LAST_WEEK'));
    await expect(page.getByRole('list', { name: 'Applied filters' })).toContainText('CPC: over 1');
    dialog = await openSearch(page);
    await dialog
      .getByRole('button', { name: 'LIs with CPA over X last week', exact: true })
      .click();
    await expect(page).toHaveURL(A('/explorerlis?f.cpaOver=20&d=LAST_WEEK'));
    await expect(page.getByRole('list', { name: 'Applied filters' })).toContainText('CPA: over 20');
  });

  test('a filter chip can be removed with its x', async ({ page }) => {
    await signIn(page);
    await page.goto(A('/explorerios?f.pacingType=AHEAD'));
    await page.getByRole('link', { name: 'Remove filter Pacing type: Ahead' }).click();
    await expect(page).toHaveURL(A('/explorerios'));
    await expect(page.getByRole('list', { name: 'Applied filters' })).toHaveCount(0);
  });

  test('free text: interpretation line and Open navigate to the filter link', async ({ page }) => {
    await signIn(page);
    await page.goto(A('/cs'));
    const dialog = await openSearch(page);
    await dialog.getByRole('textbox', { name: 'Search' }).fill('paused line items');
    await expect(dialog.getByText('Showing paused line items')).toBeVisible();
    await dialog.getByRole('button', { name: 'Open' }).click();
    await expect(page).toHaveURL(A('/explorerlis?f.status=PAUSED'));
  });

  test('name search offers direct results with links (limit 10)', async ({ page }) => {
    await signIn(page);
    await page.goto(A('/cs'));
    const dialog = await openSearch(page);
    await dialog.getByRole('textbox', { name: 'Search' }).fill('festive');
    const list = dialog.getByRole('list', { name: 'Matches by name or ID' });
    await expect(list.getByRole('link', { name: /Festive Sale/ })).toBeVisible();
    await expect(list.getByRole('link', { name: /Festive banner/ })).toBeVisible();
    await expect(list.getByRole('link').first()).toBeVisible();
    expect(await list.getByRole('listitem').count()).toBeLessThanOrEqual(10);
    await list.getByRole('link', { name: /Festive display LI/ }).click();
    await expect(page).toHaveURL(A(`/c/${w.ids.cid}/io/${w.ids.ioId}/li/${w.ids.liId}/details`));
  });

  test('ID search finds the entity by its numeric ID', async ({ page }) => {
    await signIn(page);
    await page.goto(A('/cs'));
    const dialog = await openSearch(page);
    await dialog.getByRole('textbox', { name: 'Search' }).fill(w.ids.crId);
    const link = dialog.getByRole('link', { name: /Festive banner/ });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(A(`/creatives/${w.ids.crId}`));
  });

  test('no match: the text and the name/ID link to the campaigns list', async ({ page }) => {
    await signIn(page);
    await page.goto(A('/cs'));
    const dialog = await openSearch(page);
    await dialog.getByRole('textbox', { name: 'Search' }).fill('qqzzxx');
    await expect(dialog.getByTestId('search-nomatch')).toHaveText(
      "I couldn't match that to a saved search. Search by name or ID instead.",
    );
    await dialog.getByRole('link', { name: 'Search by name or ID' }).click();
    await expect(page).toHaveURL(A('/cs?q=qqzzxx&f.status=*'));
    await expect(page.getByRole('list', { name: 'Applied filters' })).toContainText(
      'Name/ID: qqzzxx',
    );
  });

  test('partner pages search advertisers by name or ID only', async ({ page }) => {
    await signIn(page);
    await page.goto(`/p/${w.ids.pid}/home_v3`);
    const dialog = await openSearch(page);
    await expect(dialog.getByText('Try searching this advertiser for:')).toHaveCount(0);
    await dialog.getByRole('textbox', { name: 'Search' }).fill('monsoon');
    const link = dialog.getByRole('link', { name: /Monsoon Footwear Store/ });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(A('/cs'));
  });

  test('the API enforces 1 to 200 characters and the sandbox', async ({ page }) => {
    await signIn(page);
    const url = `/api/dv/advertisers/${w.ids.aid}/search`;
    const post = (query: string) => page.request.post(url, { data: { query } });
    expect((await post('')).status()).toBe(400);
    expect((await post('a'.repeat(201))).status()).toBe(400);
    expect((await post('a'.repeat(200))).status()).toBe(200);
    const body = (await (await post('paused line items')).json()) as {
      target: { route: string };
    };
    expect(body.target.route).toBe('explorerlis');
    const chips = await page.request.get(`${url}/suggestions`);
    expect((await chips.json()) as unknown[]).toHaveLength(7);
    // an advertiser outside the sandbox looks like a missing one
    expect(
      (
        await page.request.post('/api/dv/advertisers/999999999/search', { data: { query: 'x' } })
      ).status(),
    ).toBe(404);
  });
});
