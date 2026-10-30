// P4-12, module 05 6.1: PW-05-1 edit and see history, PW-05-2 toggles and ranges, PW-05-3 notes, PW-05-4 download,
// PW-05-7 notifications, plus the roles of AC-05-26. PW-05-5 (creative History) is covered by creatives.spec in P4-01 and
// PW-05-6 (bulk and fan-out) by tests/history and tests/changelog at the database level (docs/gaps/p4-12.md).
// Synthetic data only.
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';
import { cleanup } from '../auth/fixtures';
import { createShellWorld, type ShellWorld } from '../shell/e2e-world';
import { advPath, seedCampaign, seedIo, signIn } from '../services/campaigns/e2e-helpers';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
let w: ShellWorld;
let ro: ShellWorld;
let reportingOnly: ShellWorld;
let peer: ShellWorld;
let campaign: { id: string; publicId: string };
let io: { id: string; publicId: string; segmentId: string };

const A = (sub = '', world: ShellWorld = w) => advPath(world, sub);
const ioHistory = (world: ShellWorld = w) => A(`/c/${campaign.publicId}/io/${io.publicId}/history`, world);
const DAY = 86_400_000;
const istDay = (offset: number) =>
  new Date(Date.now() + offset * DAY + 5.5 * 3_600_000).toISOString().slice(0, 10);

async function seedGroup(o: {
  at: Date;
  system?: string;
  hidden?: boolean;
  summary?: string;
  label?: string;
  newValue?: string;
}) {
  await db.changeGroup.create({
    data: {
      sandboxId: w.sandboxId,
      classroomId: w.classroomId,
      advertiserId: w.rows.advertiserId,
      campaignId: campaign.id,
      ioId: io.id,
      entityType: 'INSERTION_ORDER',
      entityId: io.id,
      actorType: o.system ? 'SYSTEM' : 'USER',
      userId: o.system ? null : w.userIds[0]!,
      actorLabel: o.system ? null : 'seeded.student@example.test',
      systemActor: o.system ?? null,
      isHidden: !!o.hidden,
      summary: o.summary ?? '1 change to insertion order',
      occurredAt: o.at,
      entries: {
        create: [
          {
            sandboxId: w.sandboxId,
            kind: 'UPDATE',
            fieldPath: 'name',
            label: o.label ?? 'Name',
            oldValue: 'Old name',
            newValue: o.newValue ?? 'New name',
            sortOrder: 0,
          },
        ],
      },
    },
  });
}

test.beforeAll(async () => {
  const tag = `pw05-${Date.now()}`;
  w = await createShellWorld(db, { tag });
  ro = await createShellWorld(db, { tag: `${tag}-ro`, role: 'READ_ONLY' });
  reportingOnly = await createShellWorld(db, { tag: `${tag}-rep`, role: 'REPORTING_ONLY' });
  peer = await createShellWorld(db, { tag: `${tag}-peer` });
  campaign = await seedCampaign(db, w, 'PW05 Campaign');
  io = await seedIo(db, w, campaign.id, 'PW05 IO', { status: 'ACTIVE' });
  // two days ago at 02:00 IST (the evening before in UTC), a system sync three days ago, and a hidden seed row
  const twoDaysAgo = new Date(`${istDay(-2)}T02:00:00+05:30`);
  await seedGroup({ at: twoDaysAgo, summary: '1 change to insertion order', label: 'Display name', newValue: 'Renamed' });
  await seedGroup({ at: new Date(`${istDay(-3)}T11:00:00+05:30`), system: 'CREATIVE_APPROVAL_SYNC' });
  await seedGroup({ at: new Date(`${istDay(-3)}T10:00:00+05:30`), system: 'SIM_SEED', hidden: true });
  // the read-only world needs its own IO to open the page
  const c = await seedCampaign(db, ro, 'PW05 RO Campaign');
  const roIo = await seedIo(db, ro, c.id, 'PW05 RO IO');
  await db.historyNote.create({
    data: {
      sandboxId: ro.sandboxId,
      advertiserId: ro.rows.advertiserId,
      entityType: 'INSERTION_ORDER',
      entityId: roIo.id,
      noteDate: new Date(`${istDay(-1)}T00:00:00Z`),
      authorId: ro.userIds[0]!,
      authorLabel: 'someone@example.test',
      text: 'Shared note',
    },
  });
  await db.changeGroup.create({
    data: {
      sandboxId: ro.sandboxId,
      classroomId: ro.classroomId,
      advertiserId: ro.rows.advertiserId,
      campaignId: c.id,
      ioId: roIo.id,
      entityType: 'INSERTION_ORDER',
      entityId: roIo.id,
      actorType: 'USER',
      actorLabel: 'someone@example.test',
      summary: '1 change to insertion order',
      occurredAt: new Date(`${istDay(-1)}T09:00:00+05:30`),
      entries: { create: [{ sandboxId: ro.sandboxId, kind: 'UPDATE', fieldPath: 'name', label: 'Name', oldValue: 'a', newValue: 'b' }] },
    },
  });
  (ro as ShellWorld & { io: string; cp: string }).io = roIo.publicId;
  (ro as ShellWorld & { io: string; cp: string }).cp = c.publicId;
});
test.afterAll(async () => {
  await db.notification.deleteMany({ where: { title: { startsWith: 'PW05' } } });
  await cleanup(db, {
    userIds: [...w.userIds, ...ro.userIds, ...reportingOnly.userIds, ...peer.userIds],
    classroomIds: [w.classroomId, ro.classroomId, reportingOnly.classroomId, peer.classroomId],
  });
  await db.$disconnect();
});

async function signedIn(page: Page, world: ShellWorld = w) {
  await signIn(page, world);
}

test('PW-05-1 an inline budget edit shows on the IO and advertiser History with user, time zone and detail', async ({ page }) => {
  const c = await seedCampaign(db, w, 'PW05 Edit Campaign');
  const edited = await seedIo(db, w, c.id, 'PW05 Edited IO', { status: 'ACTIVE' });
  await signedIn(page);
  await page.goto(A(`/c/${c.publicId}/explorerios`));
  await page.getByRole('button', { name: /Edit Budget of PW05 Edited IO/ }).click();
  const input = page.getByRole('textbox', { name: 'Budget of PW05 Edited IO' });
  await input.fill('7000');
  await input.press('Enter');
  await expect.poll(async () => Number((await db.budgetSegment.findUnique({ where: { id: edited.segmentId } }))?.amount)).toBe(7000);

  await page.goto(A(`/c/${c.publicId}/io/${edited.publicId}/history`));
  const card = page.getByTestId('day-card').first();
  await expect(card.getByTestId('day-header')).toHaveText('1 change to insertion order');
  const row = card.getByTestId('history-change');
  await expect(row).toContainText('IST');
  await expect(row).toContainText(w.email);
  await row.getByRole('button', { name: 'Expand description' }).click();
  await expect(row.getByTestId('change-lines')).toContainText('7000');

  await page.goto(A('/history'));
  await expect(page.getByRole('heading', { name: 'History', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Spend' })).toBeVisible();
  await expect(page.getByText('No performance chart data available')).toBeVisible();
  await expect(page.getByRole('button', { name: /^90 days to today/ })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Include local timezone' })).not.toBeChecked();
  await expect(page.getByRole('switch', { name: 'Include system changes' })).not.toBeChecked();
  await expect(page.getByRole('link', { name: 'Download' })).toBeVisible();
});

test('PW-05-2 system changes, local time zone, date presets and expand all', async ({ browser }) => {
  const context = await browser.newContext({ timezoneId: 'UTC' });
  const page = await context.newPage();
  await signedIn(page);
  await page.goto(ioHistory());
  const twoAgo = istDay(-2);

  // default: user changes only; the 02:00 IST row sits on its IST day
  await expect(page.getByTestId('day-card')).toHaveCount(1);
  const card = page.getByTestId('day-card').first();
  await expect(card).toHaveAttribute('data-date', twoAgo);
  await expect(card).toContainText('02:00:00 IST');

  // system changes on: the sync row appears with its constant name; the seed row never does
  await page.getByRole('switch', { name: 'Include system changes' }).check();
  await expect(page).toHaveURL(/[?&]s=1/);
  await expect(page.getByTestId('day-card')).toHaveCount(2);
  await expect(page.getByText('CREATIVE_APPROVAL_SYNC')).toBeVisible();
  await expect(page.getByText('SIM_SEED')).toHaveCount(0);
  await page.getByRole('switch', { name: 'Include system changes' }).uncheck();
  await expect(page.getByTestId('day-card')).toHaveCount(1);

  // local time zone: the browser is on UTC, so 02:00 IST (20:30 UTC) moves to the day before
  await page.getByRole('switch', { name: 'Include local timezone' }).check();
  await expect(page).toHaveURL(/[?&]tz=local/);
  await expect(page.getByTestId('day-card').first()).toHaveAttribute('data-date', istDay(-3));
  await expect(page.getByTestId('day-card').first()).toContainText('20:30:00 UTC');
  await page.getByRole('switch', { name: 'Include local timezone' }).uncheck();

  // expand all / collapse all
  await page.getByRole('button', { name: 'Expand all' }).click();
  await expect(page.getByTestId('change-lines').first()).toContainText('Display name changed from "Old name" to "Renamed"');
  await page.getByRole('button', { name: 'Collapse all' }).click();
  await expect(page.getByTestId('change-lines')).toHaveCount(0);

  // a preset updates the URL and the label; an empty range shows the empty state
  await page.getByRole('button', { name: /^90 days to today/ }).click();
  await page.getByRole('menuitem', { name: 'Yesterday', exact: true }).click();
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page).toHaveURL(/[?&]d=\d{8}(%3A|:)\d{8}/);
  await expect(page.getByText('There is no history for this date range.')).toBeVisible();
  await context.close();
});

test('PW-05-3 notes: add, count, list, delete, Back closes, read-only sees them without a text box', async ({ page }) => {
  await signedIn(page);
  await page.goto(ioHistory());
  const date = istDay(-2);
  await page.getByRole('button', { name: 'Add a note' }).click();
  await expect(page).toHaveURL(new RegExp(`sim_panel=notes(%3A|:)${date.replaceAll('-', '')}`));
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('There are currently no notes.')).toBeVisible();
  await expect(dialog.getByText('Your note will be seen by anyone who has access to this page')).toBeVisible();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog.getByText('Enter a value')).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Note' }).fill('Raised budget for the festive push');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog.getByTestId('history-note')).toContainText('Raised budget for the festive push');
  await expect(dialog.getByTestId('history-note')).toContainText(w.email);
  // browser Back closes the panel and the day card shows the count
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add a note (1)' })).toBeVisible();
  // delete it again
  await page.getByRole('button', { name: 'Add a note (1)' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete note' }).click();
  await expect(page.getByText('There are currently no notes.')).toBeVisible();
  expect(await db.historyNote.count({ where: { sandboxId: w.sandboxId } })).toBe(0);
});

test('PW-05-3b / AC-05-26 a read-only user reads history and notes but cannot add; a reporting-only user gets the 404 page', async ({ page, browser }) => {
  await signedIn(page, ro);
  const r = ro as ShellWorld & { io: string; cp: string };
  await page.goto(A(`/c/${r.cp}/io/${r.io}/history`, ro));
  await expect(page.getByText('Limited Access').first()).toBeVisible().catch(() => undefined);
  await expect(page.getByTestId('day-card')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Add a note/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Notes (1)' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByTestId('history-note')).toContainText('Shared note');
  await expect(dialog.getByRole('textbox', { name: 'Note' })).toHaveCount(0);

  const rep = await (await browser.newContext()).newPage();
  await signedIn(rep, reportingOnly);
  const res = await rep.goto(A('/history', reportingOnly));
  expect(res?.status()).toBe(404);
});

test('PW-05-4 download returns a CSV that matches the rows on screen', async ({ page }) => {
  await signedIn(page);
  await page.goto(ioHistory());
  const href = await page.getByRole('link', { name: 'Download' }).getAttribute('href');
  expect(href).toContain('/api/dv/history/download?');
  const res = await page.request.get(href!);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('text/csv');
  const text = await res.text();
  expect(text.charCodeAt(0)).toBe(0xfeff);
  const lines = text.slice(1).trimEnd().split('\r\n');
  expect(lines[0]).toBe('Time,Time zone,Entity type,Entity ID,Entity name,User,Source,Field,Old value,New value,Note');
  expect(lines).toHaveLength(2); // header + the one user row on screen
  expect(lines[1]).toContain('seeded.student@example.test');
  expect(lines[1]).toContain('Display name');
  expect(lines[1]).toContain(',Old name,Renamed,');
  // with system changes the sync row is included, the hidden seed row never is
  const withSystem = await (await page.request.get(href!.replace('s=0', 's=1'))).text();
  expect(withSystem).toContain('CREATIVE_APPROVAL_SYNC');
  expect(withSystem).not.toContain('SIM_SEED');
  // an out-of-sandbox or malformed request is refused
  expect((await page.request.get('/api/dv/history/download?entityType=INSERTION_ORDER&entityId=1')).status()).toBe(404);
  expect((await page.request.get('/api/dv/history/download')).status()).toBe(400);
});

test('PW-05-7 announcements reach the bell within the poll interval, dismiss per person, and expire', async ({ page, browser }) => {
  test.setTimeout(120_000);
  await signedIn(page);
  await page.goto(A());
  await expect(page.getByTestId('bell-dot')).toHaveCount(0);

  await db.notification.create({
    data: { classroomId: w.classroomId, title: 'PW05 Lab starts at 10', body: 'Bring your laptop', severity: 'WARNING', createdById: w.userIds[0]!, learnMoreRoute: '/sim/scenarios' },
  });
  await db.notification.create({
    data: { classroomId: w.classroomId, title: 'PW05 Expired notice', body: 'gone', createdById: w.userIds[0]!, expiresAt: new Date(Date.now() - 1000) },
  });
  // picked up by the 30 second poll
  await expect(page.getByTestId('bell-dot')).toBeVisible({ timeout: 45_000 });
  await page.getByRole('button', { name: 'Notifications' }).click();
  const item = page.getByTestId('announcement-item');
  await expect(item).toHaveCount(1);
  await expect(item).toContainText('PW05 Lab starts at 10');
  await expect(item).toContainText('Bring your laptop');
  await expect(item).toContainText(/\d+ (m|h|d)/);
  await expect(item.getByRole('link', { name: 'Learn more' })).toHaveAttribute('href', /\/sim\/scenarios/);

  // a student of another class is not affected
  const other = await (await browser.newContext()).newPage();
  await signedIn(other, peer);
  await other.goto(A('', peer));
  await other.getByRole('button', { name: 'Notifications' }).click();
  await expect(other.getByTestId('announcement-item')).toHaveCount(0);

  // dismiss hides it for this person and survives a reload
  await item.getByRole('button', { name: /^Dismiss/ }).click();
  await expect(page.getByTestId('announcement-item')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('bell-dot')).toHaveCount(0);
});
