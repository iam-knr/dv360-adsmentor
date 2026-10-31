// PROD-CRASH. The prod-like crawler. Runs in its own Playwright project (`prod-like`, see playwright.config.ts and the
// `prod-like` job of .github/workflows/ci.yml) against a database prepared exactly like production: `prisma migrate
// deploy` + `scripts/bootstrap.ts` under NODE_ENV=production (reference data and the Super admin, no demo class, no
// db:seed), with row level security switched on for every table (what Supabase does), and the app in production mode.
// The Super admin adds TWO students through /manage; both sandboxes are built by the real provisioning job; the crawler
// then signs in as the SECOND student (so nothing depends on small ids) and opens every link of the left menu and the top
// bar at partner, advertiser and campaign level, plus every route of lib/routes/route-table.ts that needs no id of its
// own. A page must not show the error boundary, answer 5xx or show "Page not found". Pages that are still a "Not built
// yet" placeholder, or a route row that does not exist yet, are listed in KNOWN_GAPS below: a new gap fails the test,
// and so does a listed gap that has been closed (delete it from the list).
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';
import { canView } from '@/lib/nav/trees';
import { ROUTE_TABLE } from '@/lib/routes/route-table';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_PRODLIKE ?? process.env.DATABASE_URL } },
});
const ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@example.test';
const ADMIN_PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'change-me-locally';
const DOMAIN = '@prod-like.example.test';
const ERROR_TEXT = 'Something went wrong. Try again.';
const NOT_FOUND = /The page you're looking for wasn't found/;
const FORBIDDEN = 'You do not have access to this page.';

/**
 * Known gaps. Key: the path with the real ids replaced by {pid} / {aid} / {cid}. Value: why it is allowed.
 * `placeholder` = renders the "Not built yet" card; `missing` = the page says "Page not found" although it is linked or
 * listed in routes.md. The nav and not-built work belongs to the follow-up sessions named in docs/gaps/prod-crash.md.
 */
export const KNOWN_GAPS: Record<string, string> = {
};

let ipCounter = Math.floor(Math.random() * 200);
async function ownAddress(page: Page) {
  const ip = `10.${(ipCounter++ % 250) + 1}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': ip });
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/sim/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

async function addStudent(page: Page, name: string) {
  const email = `${name.toLowerCase().replace(/\W+/g, '-')}-${Date.now().toString(36)}${DOMAIN}`;
  await page.goto('/manage/accounts/new');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Display name').fill(name);
  await page.getByLabel('Ask for a new password at first sign in').uncheck();
  await page.getByRole('button', { name: 'Create account' }).click();
  const dialog = page.getByRole('dialog', { name: 'Account created' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Show' }).click();
  const password = (await dialog.getByTestId('secret-value').innerText()).trim();
  await dialog.getByLabel('I have saved the password').check();
  await dialog.getByRole('button', { name: 'Done' }).click();
  await page.waitForURL('**/manage/accounts');
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  return { id: user.id, email, password };
}

/** Student signs in and waits on /sim/welcome until the sandbox is open (the welcome page drives the real job). */
async function waitUntilReady(page: Page, s: { email: string; password: string }) {
  await signIn(page, s.email, s.password);
  await expect(page).toHaveURL(/\/p\/[^/]+\/home_v3$/, { timeout: 360_000 });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  // What Supabase does when "enable RLS" is on: every table, ENABLE (not FORCE); the owner role is exempt.
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  for (const t of tables) await db.$executeRawUnsafe(`ALTER TABLE "${t.tablename}" ENABLE ROW LEVEL SECURITY`);
  // the first sign in of the bootstrapped Super admin asks for a new password; that flow has its own tests
  await db.user.updateMany({
    where: { email: ADMIN_EMAIL },
    data: { mustChangePassword: false },
  });
});

test.afterAll(async () => {
  await db.$disconnect();
});

test('PROD-LIKE database: reference data and the Super admin only', async () => {
  expect(await db.exchange.count()).toBeGreaterThan(0);
  expect(await db.user.count({ where: { email: { not: ADMIN_EMAIL }, appRole: 'USER' } })).toBe(0);
  expect(await db.classroom.count({ where: { code: 'DEMO' } })).toBe(0);
  expect(await db.sandbox.count({ where: { kind: 'TEMPLATE' } })).toBe(0);
});

test('PROD-LIKE crawler: a freshly provisioned student opens every linked page without an error', async ({
  page,
  browser,
}) => {
  test.setTimeout(420_000);
  await ownAddress(page);
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.waitForURL('**/manage/accounts');
  const first = await addStudent(page, 'Crawl First');
  const second = await addStudent(page, 'Crawl Second');

  // both builds run through the real job, started by the students' own sessions
  const ctxA = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const pageA = await ctxA.newPage();
  await ownAddress(pageA);
  const ctxB = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const s = await ctxB.newPage();
  await ownAddress(s);
  await Promise.all([waitUntilReady(pageA, first), waitUntilReady(s, second)]);
  await ctxA.close();

  const sandbox = await db.sandbox.findFirstOrThrow({
    where: { ownerUserId: second.id, kind: 'STUDENT' },
  });
  expect(sandbox.provisionState).toBe('READY');
  const partner = await db.partner.findFirstOrThrow({ where: { sandboxId: sandbox.id } });
  const advertiser = await db.advertiser.findFirstOrThrow({
    where: { sandboxId: sandbox.id },
    orderBy: { createdAt: 'asc' },
  });
  const campaign = await db.campaign.findFirstOrThrow({
    where: { sandboxId: sandbox.id, advertiserId: advertiser.id },
    orderBy: { createdAt: 'asc' },
  });
  const ids = {
    pid: partner.publicId.toString(),
    aid: advertiser.publicId.toString(),
    cid: campaign.publicId.toString(),
  };
  const generic = (path: string) =>
    path
      .replace(`/p/${ids.pid}`, '/p/{pid}')
      .replace(`/a/${ids.aid}`, '/a/{aid}')
      .replace(`/c/${ids.cid}`, '/c/{cid}');

  // 1. links of the left menu and the top bar, at partner, advertiser and campaign level
  const links = new Map<string, string>(); // path -> where it was found
  const collect = async (where: string) => {
    const nav = s.getByRole('navigation', { name: 'Main' });
    for (let i = 0; i < 30; i++) {
      const closed = nav.locator('button[aria-expanded="false"]');
      if ((await closed.count()) === 0) break;
      await closed.first().click();
    }
    const tools = s.getByRole('toolbar', { name: 'Top bar tools' });
    const account = tools.getByRole('button', { name: /^Account:/ });
    if (await account.count()) await account.click();
    const hrefs = await s
      .locator('nav[aria-label="Main"] a[href], header a[href], [role="menu"] a[href]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''));
    for (const h of hrefs) {
      if (!h.startsWith('/') || h.startsWith('//')) continue;
      const path = h.split('#')[0] as string;
      if (path && !links.has(path)) links.set(path, where);
    }
    await s.keyboard.press('Escape');
  };
  await s.goto(`/p/${ids.pid}/home_v3`);
  await collect('menu, partner level');
  await s.goto(`/p/${ids.pid}/a/${ids.aid}`);
  await collect('menu, advertiser level');
  await s.goto(`/p/${ids.pid}/a/${ids.aid}/c/${ids.cid}`);
  await collect('menu, campaign level');
  expect(links.size).toBeGreaterThan(10);

  // 2. route-table rows that need no id of their own
  const fixed = ROUTE_TABLE.filter(
    (r) => !r.path.includes('{x}') && !r.path.includes('{kind}') && !r.path.includes('{ioId}') && !r.path.includes('{liId}'),
  );
  const urls = new Map<string, { from: string; expect404: boolean }>();
  for (const [path, from] of links) urls.set(path, { from, expect404: false });
  for (const r of fixed) {
    const path = r.path.replace('{pid}', ids.pid).replace('{aid}', ids.aid).replace('{cid}', ids.cid);
    if (!urls.has(path)) {
      urls.set(path, { from: `routes.md row (${r.view})`, expect404: r.frame === '404' || !canView('STANDARD', r.view) });
    }
  }
  urls.delete('/sim/logout');

  // 3. visit them
  const problems: string[] = [];
  const seenGaps = new Set<string>();
  const consoleStart = Date.now();
  for (const [path, { from, expect404 }] of urls) {
    const res = await s.goto(path, { waitUntil: 'domcontentloaded' });
    const code = res?.status() ?? 0;
    const body = await s.locator('body').innerText();
    const key = generic(path);
    const name = `${path} (${from})`;
    if (expect404) {
      if (code !== 404) problems.push(`${name}: expected 404, got ${code}`);
      continue;
    }
    if (code >= 500) problems.push(`${name}: HTTP ${code}`);
    else if (code === 403 || body.includes(FORBIDDEN)) problems.push(`${name}: 403 "You do not have access"`);
    else if (body.includes(ERROR_TEXT)) problems.push(`${name}: error boundary "${ERROR_TEXT}"`);
    else if (code === 404 || NOT_FOUND.test(body) || /Page not found/i.test(body)) {
      if (KNOWN_GAPS[key]) seenGaps.add(key);
      else problems.push(`${name}: Page not found (HTTP ${code})`);
    } else if ((await s.getByTestId('coming-soon').count()) > 0) {
      if (KNOWN_GAPS[key]) seenGaps.add(key);
      else problems.push(`${name}: "Not built yet" placeholder`);
    } else if (KNOWN_GAPS[key]) {
      problems.push(`${name}: listed in KNOWN_GAPS but the page works now; remove it from the list`);
    }
  }
  console.log(`prod-like crawler visited ${urls.size} urls in ${Date.now() - consoleStart} ms`);
  for (const key of Object.keys(KNOWN_GAPS)) {
    if (!seenGaps.has(key) && !problems.some((p) => p.includes('KNOWN_GAPS'))) {
      // gap not reached by this crawl: stale entry
      if (![...urls.keys()].some((u) => generic(u) === key)) problems.push(`KNOWN_GAPS entry ${key} is not a url of the crawl`);
    }
  }
  expect(problems).toEqual([]);
  await ctxB.close();
});
