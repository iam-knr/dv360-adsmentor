// P3-03 app shell (module 01, routes.md 3 to 6, 9): PW-01-1 shell tour, the RT 9 smoke over every route row, banners,
// the Limited Access chip and 404 behaviour. Each describe block makes its own students (synthetic @example.test
// accounts in the test database) and signs in through /sim/login, so the spec runs in any order and more than once.
import { PrismaClient } from '@prisma/client';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { canView } from '@/lib/nav/trees';
import { INVALID_ADVERTISER_PATHS, ROUTE_TABLE } from '@/lib/routes/route-table';
import { cleanup } from '../auth/fixtures';
import { createShellWorld, fillPath, type ShellWorld } from '../shell/e2e-world';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const PAUSED_TEXT =
  'This advertiser is currently paused. None of its campaigns or deals are serving.';

const userIds: string[] = [];
const classroomIds: string[] = [];
async function world(opts: Parameters<typeof createShellWorld>[1]): Promise<ShellWorld> {
  const w = await createShellWorld(db, opts);
  userIds.push(...w.userIds);
  classroomIds.push(w.classroomId);
  return w;
}

test.afterAll(async () => {
  await cleanup(db, { userIds, classroomIds });
  await db.$disconnect();
});

let ipCounter = Math.floor(Math.random() * 200);
test.beforeEach(async ({ context }) => {
  // own client address per test, so the per address sign in limit of one test cannot hit another
  const ip = `10.${(ipCounter++ % 250) + 1}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  await context.setExtraHTTPHeaders({
    ...(bypass ? { 'x-vercel-protection-bypass': bypass } : {}),
    'x-forwarded-for': ip,
  });
});

async function signIn(page: Page, w: ShellWorld) {
  await page.goto('/sim/login');
  await page.getByLabel('Email').fill(w.email);
  await page.getByLabel('Password').fill(w.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sim/login'));
}

const P = (w: ShellWorld, sub = '') => `/p/${w.ids.pid}${sub}`;
const A = (w: ShellWorld, sub = '') => `/p/${w.ids.pid}/a/${w.ids.aid}${sub}`;
const C = (w: ShellWorld, sub = '') => `${A(w)}/c/${w.ids.cid}${sub}`;

const mainNav = (page: Page) => page.getByRole('navigation', { name: 'Main' });
const topCrumbs = (page: Page) =>
  page.locator('header').getByRole('navigation', { name: 'Breadcrumb' });
const notFoundText = /The page you're looking for wasn't found/;

async function status(request: APIRequestContext, url: string) {
  const res = await request.get(url, { maxRedirects: 0 });
  return { code: res.status(), location: res.headers()['location'] ?? null };
}

test.describe('PW-01-1 shell tour (STANDARD student)', () => {
  test.describe.configure({ mode: 'serial' });
  let w: ShellWorld;
  test.beforeAll(async () => {
    w = await world({ tag: 'shell-tour' });
  });

  test('lands on the Overview from / with the top bar of RT 4.1 (AC-01-1)', async ({ page }) => {
    await signIn(page, w);
    await page.goto('/');
    await expect(page).toHaveURL(P(w, '/home_v3'));
    const header = page.locator('header');
    await expect(header.getByRole('button', { name: 'Main menu' })).toBeVisible();
    await expect(header.getByTestId('brand-logo')).toContainText('Simulator');
    await expect(header.getByTestId('brand-logo')).toContainText('by Adsmetor');
    await expect(header.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute(
      'href',
      P(w, '/home_v3'),
    );
    await expect(topCrumbs(page)).toContainText('Partner');
    await expect(topCrumbs(page)).toContainText(w.names.partner);
    const tools = page.getByRole('toolbar', { name: 'Top bar tools' });
    const labels = await tools
      .locator(':scope > button, :scope > a')
      .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
    expect(labels).toEqual([
      'Search (/)',
      'Notifications',
      'User management and email preferences',
      'Bulk status',
      'Reports',
      'Keyboard shortcuts',
      'Switch products',
      'Account: Sam Student',
    ]);
    await expect(page).toHaveTitle('Display & Video 360');
  });

  test('the hamburger toggles 256 px and 72 px and survives reload (AC-01-2)', async ({ page }) => {
    await signIn(page, w);
    await page.goto(P(w, '/home_v3'));
    const nav = mainNav(page);
    await expect(nav).toHaveAttribute('data-mode', 'expanded');
    await expect.poll(async () => (await nav.boundingBox())?.width).toBe(256);
    await page.getByRole('button', { name: 'Main menu' }).click();
    await expect(nav).toHaveAttribute('data-mode', 'rail');
    await expect.poll(async () => (await nav.boundingBox())?.width).toBe(72);
    expect(await page.evaluate(() => localStorage.getItem('sim.nav.collapsed'))).toBe('true');
    await page.reload();
    await expect(mainNav(page)).toHaveAttribute('data-mode', 'rail');
    await page.getByRole('button', { name: 'Main menu' }).click();
    await expect(mainNav(page)).toHaveAttribute('data-mode', 'expanded');
  });

  test('opens each nav group, shows the active pill and crumbs at every level', async ({
    page,
  }) => {
    await signIn(page, w);
    await page.goto(P(w, '/home_v3'));
    const nav = mainNav(page);
    await expect(nav.getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    for (const group of ['Reports', 'Resources', 'Partner settings']) {
      const header = nav.getByRole('button', { name: group });
      if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click();
      await expect(header).toHaveAttribute('aria-expanded', 'true');
    }
    await nav.getByRole('link', { name: 'Advertiser configurations' }).click();
    await expect(page).toHaveURL(P(w, '/third-party-configuration'));
    await expect(nav.getByRole('link', { name: 'Advertiser configurations' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByRole('heading', { name: 'Advertiser configurations' })).toBeVisible();

    // Advertisers list (P3-03 item 8) → advertiser level
    await nav.getByRole('link', { name: 'Advertisers' }).click();
    await expect(page).toHaveURL(P(w, '/advertisers'));
    await page.getByRole('link', { name: w.names.advertiser }).click();
    await expect(page).toHaveURL(A(w, '/cs'));
    await expect(topCrumbs(page)).toContainText('Advertiser');
    await expect(topCrumbs(page)).toContainText(w.names.advertiser);
    const advNav = mainNav(page);
    await expect(advNav.getByRole('link', { name: 'Campaigns' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    for (const group of [
      'Audiences',
      'Creative',
      'Inventory',
      'Reports',
      'Resources',
      'Advertiser settings',
    ]) {
      const header = advNav.getByRole('button', { name: group });
      if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click();
      await expect(header).toHaveAttribute('aria-expanded', 'true');
    }
    await advNav.getByRole('link', { name: 'My inventory' }).click();
    await expect(page).toHaveURL(A(w, '/marketplace/inventory'));
    await expect(advNav.getByRole('link', { name: 'My inventory' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    // campaign level: crumbs stop at the campaign, IO and LI frames have no left nav
    await page.goto(C(w));
    await expect(page).toHaveURL(C(w, '/explorerios'));
    await expect(topCrumbs(page)).toContainText(`Campaign ${w.names.campaign}`);
    await expect(
      mainNav(page).getByRole('link', { name: 'Campaign', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    await mainNav(page).getByRole('link', { name: 'Campaign settings' }).click();
    await expect(page).toHaveURL(C(w, '/details'));
    await page.goto(C(w, `/io/${w.ids.ioId}`));
    await expect(page).toHaveURL(C(w, `/io/${w.ids.ioId}/explorerlis`));
    await expect(mainNav(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Main menu' })).toHaveCount(0);
    await expect(page.getByRole('main')).toContainText('Festive IO');
    await page.goto(C(w, `/io/${w.ids.ioId}/li/${w.ids.liId}`));
    await expect(page).toHaveURL(C(w, `/io/${w.ids.ioId}/li/${w.ids.liId}/details`));
    await expect(page.getByRole('main')).toContainText('Festive display LI');
  });

  test('keyboard: ? opens the shortcuts dialog, not while typing; Shift+N on Campaigns (AC-01-14, AC-01-15)', async ({
    page,
  }) => {
    await signIn(page, w);
    await page.goto(P(w, '/home_v3'));
    await page.keyboard.press('Shift+N');
    await expect(page).toHaveURL(P(w, '/home_v3'));
    await page.getByRole('button', { name: 'Search (/)' }).click();
    const box = page
      .getByRole('dialog', { name: 'Search' })
      .getByRole('textbox', { name: 'Search' });
    await box.pressSequentially('?');
    await expect(box).toHaveValue('?');
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.locator('body').press('?');
    const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await expect(dialog).toBeVisible();
    for (const action of [
      'Keyboard shortcuts',
      'Search',
      'New (entity for current page)',
      'New insertion order',
      'New line item',
      'Download SDF',
      'Download CSV of view',
      'Duplicate',
    ]) {
      await expect(dialog.getByRole('cell', { name: action, exact: true })).toBeVisible();
    }
    await dialog.getByRole('button', { name: 'Close' }).first().click();
    await page.goto(A(w, '/cs'));
    await page.locator('body').press('Shift+N');
    await expect(page).toHaveURL(A(w, '/cs/new'));
  });

  test('right rail: one panel at a time, kept inside (app), lost in (full) (AC-01-16)', async ({
    page,
  }) => {
    await signIn(page, w);
    await page.goto(P(w, '/home_v3'));
    const rail = page.getByRole('complementary', { name: 'Side panels' });
    await rail.getByRole('button', { name: 'Ask Advisor' }).click();
    await expect(page.getByText('What can I help you with today?')).toBeVisible();
    await rail.getByRole('button', { name: 'Quick help' }).click();
    await expect(page.getByText('What can I help you with today?')).toHaveCount(0);
    await expect(rail.getByRole('button', { name: 'Quick help' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await mainNav(page).getByRole('link', { name: 'Advertisers' }).click();
    await expect(page).toHaveURL(P(w, '/advertisers'));
    await expect(rail.getByRole('button', { name: 'Quick help' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await rail.getByRole('button', { name: 'Quick help' }).click();
    await expect(rail.getByRole('button', { name: 'Quick help' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await rail.getByRole('button', { name: 'Ask Advisor' }).click();
    await page.goto(A(w, '/cs/new'));
    await expect(page.getByRole('complementary', { name: 'Side panels' })).toHaveCount(0);
    await expect(page.getByRole('toolbar', { name: 'Top bar tools' })).toHaveCount(0);
  });
});

test.describe('RT 9 smoke over routes.md section 3', () => {
  test.describe.configure({ mode: 'serial' });
  let mine: ShellWorld;
  let other: ShellWorld;
  let reporter: ShellWorld;
  test.beforeAll(async () => {
    mine = await world({ tag: 'smoke-std' });
    other = await world({ tag: 'smoke-other' });
    reporter = await world({ tag: 'smoke-rep', role: 'REPORTING_ONLY' });
  });

  // Edit pages of module 15 look the entity up; the placeholder id `{x}` is an audience, so they are 404 for real (P4-04).
  // The report pages of module 16 do the same: `{x}` is not a report (P4-07, covered by reporting.spec.ts).
  const LOOKUP_PAGES = [
    '/custom-bidding/{x}',
    '/fl/events/{x}',
    '/audience/tagbased/{x}/details',
    '/audience/{x}/explorerlis',
    '/audience/{kind}/{x}/details',
    '/ll/{x}',
    '/templates/{x}', // a targeting template is looked up by id (nav-wire-b, covered by nav-wire-b.spec.ts)
    '/pr/{x}/marketplace/plan',
    '/cross-media-reach/{x}',
    '/reporting/instant/{x}',
    '/reporting/instant/{x}/runs',
    '/reporting/offline/{x}',
    '/reporting/{kind}/{x}/runs',
    '/e/{x}',
    '/e/{x}/report/settings',
    '/e/{x}/report/diff',
    '/brand-lift-measurements/{x}/report',
    '/brand-lift-measurements/{x}/edit',
    // The Super admin console looks a cohort or an account up by id (ADM-FIX); they are /manage routes, listed so a
    // future routes.md row for them is not smoked with a placeholder id.
    '/manage/cohorts/{x}',
    '/manage/accounts/{x}',
  ];
  const pages = ROUTE_TABLE.filter(
    (r) => !r.redirectTo && r.frame !== '404' && !LOOKUP_PAGES.some((p) => r.path.endsWith(p)),
  );
  const redirects = ROUTE_TABLE.filter((r) => r.redirectTo && r.path !== '/');

  test('every page row returns 200 for a STANDARD student (404 where the row needs ADMIN)', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await signIn(page, mine);
    const wrong: string[] = [];
    for (const row of pages) {
      const url = fillPath(row.path, mine.ids);
      const expected = canView('STANDARD', row.view) ? 200 : 404;
      const { code } = await status(page.request, url);
      if (code !== expected) wrong.push(`${url} ${code} (want ${expected})`);
    }
    expect(wrong).toEqual([]);
  });

  test('redirects of routes.md 6.3 land on their targets', async ({ page }) => {
    await signIn(page, mine);
    const wrong: string[] = [];
    for (const row of redirects) {
      const url = fillPath(row.path, mine.ids);
      const target = fillPath(row.redirectTo ?? '', mine.ids);
      const { code, location } = await status(page.request, url);
      const path = location ? new URL(location, 'http://x').pathname : null;
      if (![307, 308].includes(code) || path !== target) {
        wrong.push(`${url} → ${code} ${location} (want ${target})`);
      }
    }
    expect(wrong).toEqual([]);
    const featured = await status(
      page.request,
      fillPath(`/p/{pid}/a/{aid}/marketplace/featured-v2`, mine.ids),
    );
    expect(featured.code).toBe(308);
  });

  test('every row with ids returns 404 for another student sandbox ids, in place', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await signIn(page, mine);
    const wrong: string[] = [];
    for (const row of ROUTE_TABLE.filter((r) => r.path.includes('{pid}'))) {
      const url = fillPath(row.path, other.ids);
      const { code, location } = await status(page.request, url);
      if (code !== 404 || location) wrong.push(`${url} ${code} ${location ?? ''}`);
    }
    expect(wrong).toEqual([]);
  });

  test('REPORTING_ONLY gets 404 on every non-reporting route and 200 on reporting ones', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await signIn(page, reporter);
    const wrong: string[] = [];
    for (const row of pages) {
      const url = fillPath(row.path, reporter.ids);
      const expected = canView('REPORTING_ONLY', row.view) ? 200 : 404;
      const { code } = await status(page.request, url);
      if (code !== expected) wrong.push(`${url} ${code} (want ${expected})`);
    }
    expect(wrong).toEqual([]);
  });

  test('REPORTING_ONLY sees only Reports in the nav and the 404 page on Overview (AC-01-25)', async ({
    page,
  }) => {
    await signIn(page, reporter);
    await page.goto('/');
    await expect(page).toHaveURL(P(reporter, '/reporting'));
    const res = await page.goto(P(reporter, '/home_v3'));
    expect(res?.status()).toBe(404);
    await expect(page.getByText(notFoundText)).toBeVisible();
    await page.goto(P(reporter, '/cross-media-reach'));
    const nav = mainNav(page);
    const top = await nav
      .locator(':scope > ul > *')
      .evaluateAll((els) => els.map((e) => e.textContent?.trim() ?? '').filter(Boolean));
    expect(top.join(' ')).not.toMatch(/Overview|Advertisers|Resources|Partner settings/);
    await expect(nav.getByRole('link', { name: 'Instant & offline' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Cross-media reach' })).toBeVisible();
  });
});

test.describe('banners, chip and 404 pages', () => {
  test('a paused advertiser shows the banner on advertiser pages only (AC-01-24)', async ({
    page,
  }) => {
    const w = await world({ tag: 'shell-paused', paused: true });
    await signIn(page, w);
    for (const sub of ['/cs', '/history', '/creatives', `/c/${w.ids.cid}/details`]) {
      await page.goto(A(w, sub));
      const banner = page.getByText(PAUSED_TEXT);
      await expect(banner, sub).toBeVisible();
      await expect(
        page.getByTestId('banner-stack').getByRole('button', { name: /close|dismiss/i }),
      ).toHaveCount(0);
    }
    await page.goto(P(w, '/home_v3'));
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByText(PAUSED_TEXT)).toHaveCount(0);
  });

  test('READ_ONLY sees the Limited Access chip and no enabled create (AC-01-26)', async ({
    page,
  }) => {
    const w = await world({ tag: 'shell-ro', role: 'READ_ONLY' });
    await signIn(page, w);
    for (const url of [A(w, '/cs'), '/bulk-status', P(w, '/details')]) {
      const res = await page.goto(url);
      expect(res?.status(), url).toBe(200);
      await expect(page.getByText('Limited Access').first(), url).toBeVisible();
    }
    const res = await page.goto(P(w, '/home_v3'));
    expect(res?.status()).toBe(200);
    await page.goto(A(w, '/cs'));
    await page.locator('body').press('Shift+N');
    await expect(page).toHaveURL(A(w, '/cs'));
    expect((await page.request.get(A(w, '/cs/new'), { maxRedirects: 0 })).status()).toBe(404);
  });

  test('unknown paths redirect to /404?url=, foreign ids 404 in place (AC-01-27)', async ({
    page,
  }) => {
    const w = await world({ tag: 'shell-404' });
    await signIn(page, w);
    await page.goto('/no/such/page?x=1');
    await expect(page).toHaveURL(`/404?url=${encodeURIComponent('/no/such/page?x=1')}`);
    await expect(page.getByText(notFoundText)).toBeVisible();
    // the link goes to the person's own landing: a student's sandbox home (ADM-FIX)
    await expect(page.getByRole('link', { name: 'Return to home page' })).toHaveAttribute(
      'href',
      P(w, '/home_v3'),
    );
    await expect(page.getByRole('toolbar', { name: 'Top bar tools' })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);

    for (const path of INVALID_ADVERTISER_PATHS) {
      await page.goto(fillPath(path, w.ids));
      await expect(page.getByText(notFoundText), path).toBeVisible();
    }

    const foreign = `/p/${w.ids.pid}/a/999999999/cs`;
    const res = await page.goto(foreign);
    expect(res?.status()).toBe(404);
    await expect(page).toHaveURL(foreign);
    await expect(page.getByText(notFoundText)).toBeVisible();
    await expect(page.getByRole('toolbar', { name: 'Top bar tools' })).toHaveCount(0);
  });
});
