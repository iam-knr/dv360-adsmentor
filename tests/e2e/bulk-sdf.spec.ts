// P4-10a module 11: PW-11-01 SDF download, PW-11-02 SDF upload, PW-11-07 bulk status change, PW-11-10 duplicate,
// PW-11-12 custom charts, PW-11-15 read-only role, PW-11-16 column views. Synthetic data only; the world holds one
// campaign, IO and line item. PW-11-03..06, 08, 09, 11, 13, 14 are covered by the service tests (tests/bulk, tests/sdf).
import { PrismaClient } from '@prisma/client';
import { strFromU8, unzipSync } from 'fflate';
import { expect, test } from '@playwright/test';
import { cleanup } from '../auth/fixtures';
import { createShellWorld, type ShellWorld } from '../shell/e2e-world';
import { advPath, seedCampaign, signIn } from '../services/campaigns/e2e-helpers';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
let w: ShellWorld;
let wRo: ShellWorld;

test.beforeAll(async () => {
  w = await createShellWorld(db, { tag: `pw11-${Date.now()}` });
  wRo = await createShellWorld(db, { tag: `pw11-ro-${Date.now()}`, role: 'READ_ONLY' });
  await db.advertiser.update({ where: { id: w.rows.advertiserId }, data: { sdfVersion: 'V11' } });
});
test.afterAll(async () => {
  await cleanup(db, {
    userIds: [...w.userIds, ...wRo.userIds],
    classroomIds: [w.classroomId, wRo.classroomId],
  });
  await db.$disconnect();
});

const A = (sub = '') => advPath(w, sub);

test('PW-11-07 select campaigns, Action, Pause: one job, the row pauses and Bulk status lists it', async ({
  page,
}) => {
  const c = await seedCampaign(db, w, 'PW11 Pause me');
  await signIn(page, w);
  await page.goto(A('/cs'));
  await page
    .getByRole('row', { name: /PW11 Pause me/ })
    .getByRole('checkbox')
    .check();
  await expect(page.getByText('1 row selected')).toBeVisible();
  await page.getByRole('button', { name: 'Action' }).click();
  await expect(page.getByRole('menuitem', { name: 'Activate' })).toBeDisabled();
  await page.getByRole('menuitem', { name: 'Pause' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Bulk action started' })).toBeVisible();
  await expect
    .poll(async () => (await db.campaign.findUniqueOrThrow({ where: { id: c.id } })).status)
    .toBe('PAUSED');
  await page.goto('/bulk-status');
  await expect(
    page.getByRole('cell', { name: 'Status edited on 1 campaign' }).first(),
  ).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Bulk Edit' }).first()).toBeVisible();
});

test('PW-11-10 duplicate a campaign: a Copy of campaign with its tree appears', async ({
  page,
}) => {
  const c = await seedCampaign(db, w, 'PW11 Duplicate me');
  await signIn(page, w);
  await page.goto(A('/cs'));
  await page
    .getByRole('row', { name: /PW11 Duplicate me/ })
    .getByRole('checkbox')
    .check();
  await page.getByRole('button', { name: 'Action' }).click();
  await page.getByRole('menuitem', { name: /Duplicate/ }).click();
  await page.getByLabel('Number of copies').fill('0');
  await page.getByRole('button', { name: 'Duplicate' }).click();
  await expect(page.getByText('Enter a number greater than 0').first()).toBeVisible();
  await page.getByLabel('Number of copies').fill('1');
  await page.getByRole('button', { name: 'Duplicate' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Bulk action started' })).toBeVisible();
  await expect
    .poll(() =>
      db.campaign.count({
        where: { copiedFromId: c.id, name: 'Copy of PW11 Duplicate me', status: 'PAUSED' },
      }),
    )
    .toBe(1);
});

test('PW-11-01 SDF download: untick Ads, the job lists with a Download link to a zip of the ticked files', async ({
  page,
}) => {
  await signIn(page, w);
  await page.goto(A('/cs'));
  await page.getByRole('button', { name: 'SDF' }).click();
  await page.getByRole('menuitem', { name: 'Download', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Download Structured Data Files' })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Ads' }).uncheck();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Download' }).click();
  await expect(page.getByText(/Your download is being prepared/)).toBeVisible();
  await page.goto('/bulk-status');
  const row = page.getByRole('row', { name: /SDF download/ }).first();
  await expect(row).toBeVisible();
  const href = await row.getByRole('link', { name: 'Download' }).getAttribute('href');
  const res = await page.request.get(href!);
  expect(res.headers()['content-type']).toContain('zip');
  const names = Object.keys(unzipSync(new Uint8Array(await res.body()))).sort();
  expect(names).toEqual([
    'README.txt',
    'SDF-AdGroups.csv',
    'SDF-Campaigns.csv',
    'SDF-InsertionOrders.csv',
    'SDF-LineItems.csv',
    'SDF-MediaProducts.csv',
  ]);
});

test('PW-11-02 SDF upload: rename a campaign in the CSV and upload it', async ({ page }) => {
  const c = await seedCampaign(db, w, 'PW11 SDF rename me');
  await signIn(page, w);
  const dl = await page.request.post('/api/dv/sdf/download', {
    data: { advertiserId: w.ids.aid, kind: 'DATA', include: { CAMPAIGNS: true } },
  });
  const jobId = ((await dl.json()) as { data: { jobId: string } }).data.jobId;
  const zip = unzipSync(
    new Uint8Array(await (await page.request.get(`/api/dv/bulk-jobs/${jobId}/result`)).body()),
  );
  const csv = strFromU8(zip['SDF-Campaigns.csv']!).replace(
    'PW11 SDF rename me',
    'PW11 Renamed by SDF',
  );
  expect(csv).toContain('PW11 Renamed by SDF');
  await page.goto(A('/cs'));
  await page.getByRole('button', { name: 'SDF' }).click();
  await page.getByRole('menuitem', { name: 'Upload' }).click();
  await expect(
    page.getByText('Line items without an answer for EU political ads will get "No"'),
  ).toBeVisible();
  await page
    .getByTestId('sdf-file-input')
    .setInputFiles({ name: 'SDF-Campaigns.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.getByText('SDF-Campaigns.csv')).toBeVisible();
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await expect(page.getByText(/Upload finished: \d+ succeeded, 0 failed/)).toBeVisible();
  expect((await db.campaign.findUniqueOrThrow({ where: { id: c.id } })).name).toBe(
    'PW11 Renamed by SDF',
  );
  const group = await db.changeGroup.findFirst({ where: { entityId: c.id, source: 'SDF_UPLOAD' } });
  expect(group).not.toBeNull();
  // the Failed file lists nothing for this upload
  const up = await db.bulkJob.findFirstOrThrow({
    where: { sandboxId: w.sandboxId, source: 'SDF_UPLOAD' },
    orderBy: { requestedAt: 'desc' },
  });
  const result = unzipSync(
    new Uint8Array(await (await page.request.get(`/api/dv/bulk-jobs/${up.id}/result`)).body()),
  );
  expect(Object.keys(result)).toContain('SDF-Campaigns-Successful.csv');
});

test('PW-11-16 column view: create a custom view, pin it, reload and the columns follow it', async ({
  page,
}) => {
  await signIn(page, w);
  await page.goto(A(`/c/${w.ids.cid}/explorerios`));
  await page.getByRole('combobox', { name: 'Status filter' }).click();
  await page.getByRole('option', { name: 'Status: All' }).click();
  await expect(page.getByRole('columnheader', { name: /Impr\./ })).toBeVisible();
  await page.getByRole('button', { name: 'Columns' }).click();
  await page.getByRole('menuitem', { name: 'Create new custom view' }).click();
  await page.getByLabel('View name').fill('Only type');
  await page.getByRole('checkbox', { name: 'Type' }).check();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('columnheader', { name: /Impr\./ })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: /^Type/ })).toBeVisible();
  await page.getByRole('button', { name: 'Columns' }).click();
  await page
    .getByRole('menuitem', { name: /Only type/ })
    .getByRole('button', { name: 'Pin' })
    .click();
  await page.keyboard.press('Escape');
  await page.reload();
  await page.getByRole('combobox', { name: 'Status filter' }).click();
  await page.getByRole('option', { name: 'Status: All' }).click();
  await expect(page.getByRole('columnheader', { name: /^Type/ })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /Impr\./ })).toHaveCount(0);
});

test('PW-11-12 custom charts: add a starter chart, save and it is still there after a reload', async ({
  page,
}) => {
  await signIn(page, w);
  await page.goto(A(`/c/${w.ids.cid}/explorerios`));
  await page.getByRole('button', { name: 'Customize charts' }).click();
  await expect(page.getByText('Tutor suggestions can be wrong. Check the numbers.')).toBeVisible();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('menuitem', { name: /Daily Revenue Trend/ }).click();
  await page.getByLabel('Ask a performance question or describe metrics').fill('asdf qwerty');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: "I couldn't build a chart" }),
  ).toBeVisible();
  await page
    .getByLabel('Ask a performance question or describe metrics')
    .fill('Compare CPMs and CTRs');
  await page.getByRole('button', { name: 'Create' }).click();
  // the prompt answers asynchronously: wait for the new card before saving
  await expect(page.getByRole('heading', { name: /CPM and CTR by day/ })).toBeVisible();
  await page.getByRole('button', { name: 'Save charts' }).click();
  await expect(page.getByRole('region', { name: 'Customize charts' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Daily Revenue Trend' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /CPM and CTR by day/ })).toBeVisible();
});

test('PW-11-15 a read-only person cannot edit in bulk but can still download SDF', async ({
  page,
}) => {
  await signIn(page, wRo);
  await page.goto(advPath(wRo, '/cs'));
  await page.getByRole('row').nth(1).getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Action' }).click();
  await expect(page.getByRole('menuitem', { name: 'Pause' })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: 'Activate' })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: /Duplicate/ })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: /^Download/ }).first()).toBeEnabled();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'SDF' }).click();
  await expect(page.getByRole('menuitem', { name: 'Upload' })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: 'Download', exact: true })).toBeEnabled();
});
