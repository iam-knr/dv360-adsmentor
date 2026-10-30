// SDF download and upload end to end on the services (AC-11-02..13, V-11-04..09).
import { unzipSync, strFromU8 } from 'fflate';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { getJobResult } from '@/lib/bulk/jobs';
import { parseCsv, writeCsv } from '@/lib/sdf/codec';
import { requestSdfDownload } from '@/lib/sdf/download';
import { requestSdfUpload } from '@/lib/sdf/upload';
import { createLineItem } from '@/lib/line-items/service';
import { dropWorld } from '../db/helpers';
import { createLiWorld, userFor, validDraft, type World } from '../services/line-items/helpers';

let w: World;
const user = () => userFor(w);

beforeAll(async () => {
  w = await createLiWorld('sdf');
  await prisma.advertiser.update({ where: { id: w.advertiserId }, data: { sdfVersion: 'V11' } });
  const made = await createLineItem(user(), w.ioId, await validDraft(w, 'DISPLAY', 'SDF line item'));
  if (!made.ok) throw new Error(JSON.stringify(made.issues));
});
afterAll(async () => {
  await dropWorld(w);
  await prisma.$disconnect();
});

const ALL = { CAMPAIGNS: true, INSERTION_ORDERS: true, LINE_ITEMS: true, AD_GROUPS: true, ADS: true, MEDIA_PRODUCTS: true };

async function download(include: Partial<typeof ALL> = ALL, extra: Record<string, unknown> = {}) {
  const res = await requestSdfDownload(user(), { advertiserId: w.advertiserId, include, kind: 'DATA', ...extra });
  if (!res.ok) throw new Error(JSON.stringify(res.issues));
  const file = await getJobResult(user(), res.data.jobId);
  return { jobId: res.data.jobId, files: unzipSync(file!.bytes), name: file!.name };
}
const csvOf = (files: Record<string, Uint8Array>, name: string) => parseCsv(strFromU8(files[name]!))!;
const upload = async (files: { name: string; text: string }[]) => {
  const res = await requestSdfUpload(user(), { advertiserId: w.advertiserId, files });
  if (!res.ok) throw new Error(JSON.stringify(res));
  return res.data;
};
const textOf = (files: Record<string, Uint8Array>, name: string) => strFromU8(files[name]!);
const setCell = (file: { headers: string[]; rows: string[][] }, row: number, col: string, value: string) => {
  file.rows[row]![file.headers.indexOf(col)] = value;
};
const toText = (f: { headers: string[]; rows: string[][] }) => writeCsv(f.headers, f.rows);

describe('download (AC-11-01..03, AC-11-13)', () => {
  it('writes only the ticked entities and a zip name with the advertiser id', async () => {
    const { files, name } = await download({ CAMPAIGNS: true, LINE_ITEMS: true });
    expect(Object.keys(files).sort()).toEqual(['README.txt', 'SDF-Campaigns.csv', 'SDF-LineItems.csv']);
    expect(name).toMatch(/^SDF-\d+-\d{12}\.zip$/);
  });

  it('rejects an empty selection (BLK-001)', async () => {
    const res = await requestSdfDownload(user(), { advertiserId: w.advertiserId, include: {}, kind: 'DATA' });
    expect(res.ok).toBe(false);
  });

  it('writes the version header, BOM and CRLF', async () => {
    const { files } = await download({ CAMPAIGNS: true });
    const text = textOf(files, 'SDF-Campaigns.csv');
    expect([...files['SDF-Campaigns.csv']!.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(text).toContain('\r\n');
    const f = csvOf(files, 'SDF-Campaigns.csv');
    expect(f.headers[0]).toBe('Campaign Id');
    expect(f.headers).not.toContain('Geography Targeting - Include'); // version 11 has no legacy column
    expect(f.rows).toHaveLength(1);
  });

  it('metadata and QA files carry their header rows', async () => {
    const meta = await requestSdfDownload(user(), { advertiserId: w.advertiserId, include: {}, kind: 'METADATA' });
    if (!meta.ok) throw new Error('meta');
    const m = parseCsv(strFromU8((await getJobResult(user(), meta.data.jobId))!.bytes))!;
    expect(m.headers.slice(0, 5)).toEqual(['Entity Type', 'Id', 'Name', 'Parent Type', 'Parent Id']);
    expect(m.rows.map((r) => r[0])).toEqual(expect.arrayContaining(['Campaign', 'Insertion order', 'Line item']));
    const qa = await requestSdfDownload(user(), { advertiserId: w.advertiserId, include: {}, kind: 'QA' });
    if (!qa.ok) throw new Error('qa');
    const q = parseCsv(strFromU8((await getJobResult(user(), qa.data.jobId))!.bytes))!;
    expect(q.headers).toEqual(['Entity', 'Id', 'Name', 'Row Severity', 'Rule Id', 'Field', 'Message', 'Suggested Fix']);
  });
});

describe('upload (AC-11-04..11)', () => {
  it('an unchanged round trip changes nothing and writes no ChangeLog rows (AC-11-04)', async () => {
    const { files } = await download({ CAMPAIGNS: true, INSERTION_ORDERS: true, LINE_ITEMS: true });
    const before = await prisma.changeGroup.count({ where: { sandboxId: w.sandboxId } });
    const out = await upload(
      ['Campaigns', 'InsertionOrders', 'LineItems'].map((n) => ({ name: `SDF-${n}.csv`, text: textOf(files, `SDF-${n}.csv`) })),
    );
    expect(out.status).toBe('COMPLETED');
    expect(out.perFile.map((f) => [f.succeeded, f.failed])).toEqual([[1, 0], [1, 0], [2, 0]]);
    expect(await prisma.changeGroup.count({ where: { sandboxId: w.sandboxId } })).toBe(before);
  });

  it('renames a line item and logs one SDF_UPLOAD group with the result zip (AC-11-05)', async () => {
    const { files } = await download({ LINE_ITEMS: true });
    const f = csvOf(files, 'SDF-LineItems.csv');
    setCell(f, 0, 'Name', 'Renamed by SDF');
    const out = await upload([{ name: 'SDF-LineItems.csv', text: toText(f) }]);
    expect(out.perFile[0]).toMatchObject({ failed: 0 });
    const li = await prisma.lineItem.findFirstOrThrow({ where: { publicId: BigInt(f.rows[0]![0]!) } });
    expect(li.name).toBe('Renamed by SDF');
    const g = await prisma.changeGroup.findMany({ where: { bulkJobId: out.jobId } });
    expect((await prisma.changeEntry.findMany({ where: { groupId: g[0]!.id } })).map((e) => e.label)).toContain('Name');
    expect(g).toHaveLength(1);
    expect(g[0]!.source).toBe('SDF_UPLOAD');
    const zip = unzipSync((await getJobResult(user(), out.jobId))!.bytes);
    expect(Object.keys(zip).sort()).toEqual(['SDF-LineItems-Failed.csv', 'SDF-LineItems-Successful.csv', 'Summary.txt']);
    expect(csvOf(zip, 'SDF-LineItems-Successful.csv').rows).toHaveLength(2);
  });

  it('a failing row goes to the Failed file with its row number and rule, and the other rows succeed (AC-11-07)', async () => {
    const { files } = await download({ LINE_ITEMS: true });
    const f = csvOf(files, 'SDF-LineItems.csv');
    expect(f.rows.length).toBeGreaterThanOrEqual(2);
    setCell(f, 0, 'Bid Strategy Type', 'Not a strategy');
    setCell(f, 1, 'Integration Code', 'OK-ROW');
    const out = await upload([{ name: 'SDF-LineItems.csv', text: toText(f) }]);
    expect(out.perFile[0]).toMatchObject({ succeeded: 1, failed: 1 });
    const zip = unzipSync((await getJobResult(user(), out.jobId))!.bytes);
    const failed = csvOf(zip, 'SDF-LineItems-Failed.csv');
    const h = failed.headers;
    expect(failed.rows[0]![h.indexOf('Row Number')]).toBe('2');
    expect(failed.rows[0]![h.indexOf('Error Rule Id')]).toBe('BLK-031');
  });

  it('a stale timestamp gives BLK-024 (AC-11-10)', async () => {
    const { files } = await download({ CAMPAIGNS: true });
    const f = csvOf(files, 'SDF-Campaigns.csv');
    setCell(f, 0, 'Timestamp', '1');
    setCell(f, 0, 'Name', 'Stale edit');
    const out = await upload([{ name: 'SDF-Campaigns.csv', text: toText(f) }]);
    const zip = unzipSync((await getJobResult(user(), out.jobId))!.bytes);
    const failed = csvOf(zip, 'SDF-Campaigns-Failed.csv');
    expect(failed.rows[0]![failed.headers.indexOf('Error Rule Id')]).toBe('BLK-024');
  });

  it('two CSVs for one entity give BLK-002; an unknown parent gives BLK-026 (AC-11-10)', async () => {
    const { files } = await download({ INSERTION_ORDERS: true });
    const text = textOf(files, 'SDF-InsertionOrders.csv');
    const dup = await upload([
      { name: 'a.csv', text },
      { name: 'b.csv', text },
    ]);
    expect(dup.fileErrors.map((e) => e.ruleId)).toContain('BLK-002');
    const f = csvOf(files, 'SDF-InsertionOrders.csv');
    setCell(f, 0, 'Io Id', 'ext1');
    setCell(f, 0, 'Campaign Id', '987654321');
    const orphan = await upload([{ name: 'SDF-InsertionOrders.csv', text: toText(f) }]);
    const zip = unzipSync((await getJobResult(user(), orphan.jobId))!.bytes);
    const failed = csvOf(zip, 'SDF-InsertionOrders-Failed.csv');
    expect(failed.rows[0]![failed.headers.indexOf('Error Rule Id')]).toBe('BLK-026');
  });

  it('a version 9 file is refused by a version 11 advertiser (BLK-021, AC-11-09)', async () => {
    const legacy = writeCsv(['Campaign Id', 'Advertiser Id', 'Name', 'Inventory Source Targeting - Include'], [['ext1', '1', 'x', '']]);
    const out = await upload([{ name: 'SDF-Campaigns.csv', text: legacy }]);
    expect(out.status).toBe('FAILED');
    expect(out.fileErrors[0]!.ruleId).toBe('BLK-021');
  });

  it('creates a campaign, IO and line item chain from ext ids (AC-11-06)', async () => {
    const { files } = await download({ CAMPAIGNS: true, INSERTION_ORDERS: true, LINE_ITEMS: true });
    const c = csvOf(files, 'SDF-Campaigns.csv');
    const io = csvOf(files, 'SDF-InsertionOrders.csv');
    const li = csvOf(files, 'SDF-LineItems.csv');
    setCell(c, 0, 'Campaign Id', 'ext1');
    setCell(c, 0, 'Timestamp', '');
    setCell(c, 0, 'Name', 'SDF new campaign');
    setCell(c, 0, 'Campaign Goal', 'Raise awareness of my brand or product');
    setCell(c, 0, 'Campaign Goal KPI', 'CPM');
    setCell(c, 0, 'Campaign Goal KPI Value', '50.00');
    setCell(c, 0, 'Creative Types', 'Display');
    setCell(io, 0, 'Io Id', 'ext2');
    setCell(io, 0, 'Campaign Id', 'ext1');
    setCell(io, 0, 'Timestamp', '');
    setCell(io, 0, 'Name', 'SDF new IO');
    setCell(io, 0, 'Performance Goal Value', '1.50');
    setCell(li, 0, 'Line Item Id', 'ext3');
    setCell(li, 0, 'Io Id', 'ext2');
    setCell(li, 0, 'Timestamp', '');
    setCell(li, 0, 'Name', 'SDF new LI');
    setCell(li, 0, 'Contains EU Political Ads', '');
    li.rows.length = 1;
    const out = await upload([
      { name: 'SDF-Campaigns.csv', text: toText({ headers: c.headers, rows: [c.rows[0]!] }) },
      { name: 'SDF-InsertionOrders.csv', text: toText({ headers: io.headers, rows: [io.rows[0]!] }) },
      { name: 'SDF-LineItems.csv', text: toText(li) },
    ]);
    const failed = out.perFile.filter((f) => f.failed > 0);
    if (failed.length) {
      const zip = unzipSync((await getJobResult(user(), out.jobId))!.bytes);
      throw new Error(textOf(zip, 'Summary.txt') + Object.keys(zip).filter((k) => k.endsWith('Failed.csv')).map((k) => textOf(zip, k)).join('\n'));
    }
    expect(out.euDefaulted).toBe(1);
    const newLi = await prisma.lineItem.findFirstOrThrow({ where: { name: 'SDF new LI' }, include: { io: { include: { campaign: true } } } });
    expect(newLi.io.name).toBe('SDF new IO');
    expect(newLi.io.campaign.name).toBe('SDF new campaign');
    expect(newLi.euPoliticalAds).toBe('DOES_NOT_CONTAIN_EU_POLITICAL_ADS');
  });

  it('refuses a version 9 upload after the end date (BLK-022, AC-11-11)', async () => {
    await prisma.advertiser.update({ where: { id: w.advertiserId }, data: { sdfVersion: 'V9' } });
    await prisma.simClock.update({ where: { sandboxId: w.sandboxId }, data: { simStart: new Date('2027-02-01T00:00:00Z') } });
    const out = await upload([{ name: 'SDF-Campaigns.csv', text: writeCsv(['Campaign Id'], [['1']]) }]);
    expect(out.status).toBe('FAILED');
    expect(out.fileErrors[0]!.ruleId).toBe('BLK-022');
  });

  it('refuses writes for read-only roles (BLK-035)', async () => {
    const res = await requestSdfUpload({ ...user(), dvRole: 'READ_ONLY' }, { advertiserId: w.advertiserId, files: [] });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('FORBIDDEN');
  });
});
