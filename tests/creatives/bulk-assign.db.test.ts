// Uploads, bulk add, assignment helpers and the registry (module 12 6.1: 10, 11, and the upload rules of E2E-CRE-04).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { assignCreativesToLineItems, getEligibleCreatives } from '@/lib/creatives/assign';
import { bulkAddCreatives, readBulkResult } from '@/lib/creatives/bulk';
import { parseCsv, toCsv } from '@/lib/creatives/bulk-csv';
import {
  createCreative,
  createUpload,
  getCreativeDetail,
  getCreativePreview,
  listCreatives,
} from '@/lib/creatives/service';
import { parseModels, readSchemaText } from '@/lib/db/schema-info';
import { creativeColumnFields, creativeExtFields } from '@/lib/changelog/registries/creative';
import { dropWorld } from '../db/helpers';
import { createCreativeWorld, tpDisplay, userFor } from './helpers';
import { TAG } from './fixtures';

let w: Awaited<ReturnType<typeof createCreativeWorld>>;
const user = () => userFor(w);
const aid = () => w.advertiserId;
const must = <T>(r: { ok: boolean; data?: T }): T => {
  if (!r.ok) throw new Error(`expected ok: ${JSON.stringify(r)}`);
  return r.data as T;
};

/** A PNG header of the stated size padded to `bytes`. */
function png(width: number, height: number, bytes = 200): Uint8Array {
  const b = new Uint8Array(bytes);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}

beforeAll(async () => {
  w = await createCreativeWorld('creb');
});
afterAll(async () => {
  await dropWorld(w);
  await prisma.$disconnect();
});

describe('image upload (E2E-CRE-04 rules)', () => {
  const image = (uploadId: string, name = 'banner.png') => ({
    kind: 'STANDARD_IMAGE' as const,
    name: 'Uploaded image',
    landingPageUrl: 'https://example.com',
    mainAsset: { uploadId, fileName: name, mimeType: 'image/png', sizeBytes: 1 },
  });

  it('rejects an image over 150 KB with CRE-020 and creates nothing', async () => {
    const up = must(
      await createUpload(user(), {
        fileName: 'big.png',
        bytes: png(300, 250, 151 * 1024),
        contentType: 'image/png',
      }),
    );
    const r = await createCreative(user(), aid(), image(up.uploadId, 'big.png'));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.map((i) => i.code)).toContain('CRE-020');
      expect(r.issues.find((i) => i.code === 'CRE-020')?.message).toBe(
        'Upload a GIF, PNG or JPEG file of 150 KB or less.',
      );
    }
  });

  it('reads size and type from the stored file, never from the client', async () => {
    const up = must(
      await createUpload(user(), {
        fileName: 'banner.png',
        bytes: png(300, 250),
        contentType: 'application/octet-stream',
      }),
    );
    expect(up).toMatchObject({ contentType: 'image/png', width: 300, height: 250, sizeBytes: 200 });
    // the client claims 1 byte and a different name; the row decides
    const created = must(await createCreative(user(), aid(), image(up.uploadId)));
    const d = await getCreativeDetail(user(), aid(), created.id);
    expect(d.assets[0]).toMatchObject({
      role: 'MAIN',
      fileName: 'banner.png',
      sizeBytes: 200,
      width: 300,
      height: 250,
    });
    expect(d.row).toMatchObject({ dimensions: '300×250', format: 'Image', type: 'Standard' });
    const preview = await getCreativePreview(user(), aid(), created.id);
    expect(preview.kind).toBe('IMAGE');
    expect(preview.srcDoc).toContain('Content-Security-Policy');
  });

  it('a text file named .png is not an image', async () => {
    const up = must(
      await createUpload(user(), {
        fileName: 'fake.png',
        bytes: new TextEncoder().encode('hello world'),
        contentType: 'image/png',
      }),
    );
    const r = await createCreative(user(), aid(), image(up.uploadId, 'fake.png'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((i) => i.code)).toContain('CRE-020');
  });

  it('another person cannot use my upload', async () => {
    const up = must(
      await createUpload(user(), {
        fileName: 'mine.png',
        bytes: png(300, 250),
        contentType: 'image/png',
      }),
    );
    const other = { ...user(), id: 'someone-else' };
    const r = await createCreative(other, aid(), image(up.uploadId, 'mine.png'));
    expect(r.ok).toBe(false);
  });

  it('READ_ONLY cannot upload', async () => {
    const r = await createUpload(userFor(w, 'READ_ONLY'), {
      fileName: 'a.png',
      bytes: png(1, 1),
      contentType: 'image/png',
    });
    expect(r).toMatchObject({ ok: false, code: 'FORBIDDEN' });
  });
});

describe('bulk add (AC 10)', () => {
  it('creates the valid rows, completes the job and lists the 2 failures with rule ids', async () => {
    const header = ['Name', 'Width', 'Height', 'Third-party tag', 'Landing page URL'];
    const good = (i: number) => [`Bulk ${i}`, '300', '250', TAG, 'https://example.com'];
    const rows = [
      header,
      ...[1, 2, 3, 4].map(good),
      ['', '300', '250', TAG, 'https://example.com'],
      ...[5, 6, 7, 8].map(good),
      ['Zero size', '0', '0', TAG, 'https://example.com'],
      good(9),
    ];
    const up = must(
      await createUpload(user(), {
        fileName: 'rows.csv',
        bytes: new TextEncoder().encode(toCsv(rows)),
        contentType: 'text/csv',
        purpose: 'OTHER',
      }),
    );
    const r = must(
      await bulkAddCreatives(user(), aid(), {
        kind: 'third-party-display',
        csvUploadId: up.uploadId,
      }),
    );
    expect(r).toMatchObject({ done: 9, failed: 2 });
    expect(r.resultFile).toBe(r.jobId);
    const job = await prisma.bulkJob.findUniqueOrThrow({
      where: { id: r.jobId! },
      include: { items: true },
    });
    expect(job).toMatchObject({
      status: 'COMPLETED',
      action: 'UPLOAD_CREATIVES',
      source: 'CREATIVE_BULK_ADD',
      selectionCount: 11,
    });
    expect(job.description).toBe('Adding 11 third-party display creatives');
    expect(
      job.items
        .filter((i) => i.status === 'FAILED')
        .map((i) => [i.rowNumber, i.ruleId])
        .sort((a, b) => Number(a[0]) - Number(b[0])),
    ).toEqual([
      [5, 'CRE-001'],
      [10, 'CRE-003'],
    ]);
    const created = await prisma.creative.count({
      where: { sandboxId: w.sandboxId, name: { startsWith: 'Bulk ' } },
    });
    expect(created).toBe(9);
    const csv = parseCsv(new TextDecoder().decode((await readBulkResult(user(), r.jobId!))!));
    expect(csv[0]).toEqual(['Row', 'Name', 'Status', 'Rule ID', 'Message']);
    expect(csv.filter((x) => x[2] === 'FAILED').map((x) => x[3])).toEqual(['CRE-001', 'CRE-003']);
    // one change group per created creative, tied to the job
    expect(await prisma.changeGroup.count({ where: { bulkJobId: job.id } })).toBe(9);
  });

  it('refuses a CSV with the wrong header as a whole', async () => {
    const up = must(
      await createUpload(user(), {
        fileName: 'bad.csv',
        bytes: new TextEncoder().encode('Name\nx'),
        contentType: 'text/csv',
        purpose: 'OTHER',
      }),
    );
    const r = await bulkAddCreatives(user(), aid(), {
      kind: 'third-party-display',
      csvUploadId: up.uploadId,
    });
    expect(r).toMatchObject({ ok: false, code: 'INVALID' });
  });
});

describe('assignment helpers (AC 11)', () => {
  let imageId = '';
  let videoId = '';
  let li2 = '';
  beforeAll(async () => {
    imageId = must(await createCreative(user(), aid(), tpDisplay('Assign display'))).id;
    videoId = (
      await prisma.creative.create({
        data: {
          sandboxId: w.sandboxId,
          advertiserId: w.advertiserId,
          name: 'Assign video',
          kind: 'VIDEO_FILE',
          durationSeconds: 15,
        },
      })
    ).id;
    li2 = (
      await prisma.lineItem.create({
        data: {
          sandboxId: w.sandboxId,
          ioId: w.ioId,
          campaignId: w.campaignId,
          advertiserId: w.advertiserId,
          name: 'Second display',
          type: 'DISPLAY',
        },
      })
    ).id;
  });

  it('a video creative cannot go on a Display line item (LI-064), an eligible one can', async () => {
    const bad = await assignCreativesToLineItems(user(), aid(), {
      creativeIds: [videoId],
      lineItemIds: [w.lineItemId],
      mode: 'ADD',
    });
    expect(bad).toMatchObject({ ok: false, code: 'INVALID' });
    expect(
      await prisma.creativeAssignment.count({
        where: { lineItemId: w.lineItemId, creativeId: videoId },
      }),
    ).toBe(0);
    const ok = must(
      await assignCreativesToLineItems(user(), aid(), {
        creativeIds: [imageId],
        lineItemIds: [w.lineItemId, li2],
        mode: 'ADD',
      }),
    );
    expect(ok).toMatchObject({ done: 2, failed: 0 });
    expect(ok.jobId).toBeTruthy();
    const row = (await listCreatives(user(), aid(), { q: 'Assign display' })).rows[0]!;
    expect(row.lineItems).toBe(2);
    const removed = must(
      await assignCreativesToLineItems(user(), aid(), {
        creativeIds: [imageId],
        lineItemIds: [li2],
        mode: 'REMOVE',
      }),
    );
    expect(removed.done).toBe(1);
    expect((await listCreatives(user(), aid(), { q: 'Assign display' })).rows[0]!.lineItems).toBe(
      1,
    );
  });

  it('reports each line item it could not change and keeps the others', async () => {
    const mixed = must(
      await assignCreativesToLineItems(user(), aid(), {
        creativeIds: [imageId],
        lineItemIds: [w.lineItemId, li2],
        mode: 'ADD',
      }),
    );
    expect(mixed.done).toBe(2);
    const forbidden = await assignCreativesToLineItems(userFor(w, 'READ_ONLY'), aid(), {
      creativeIds: [imageId],
      lineItemIds: [li2],
      mode: 'ADD',
    });
    expect(forbidden).toMatchObject({ ok: false, code: 'FORBIDDEN' });
  });

  it('getEligibleCreatives filters the three tabs', async () => {
    const all = await getEligibleCreatives(user(), li2, { tab: 'ALL' });
    const eligible = await getEligibleCreatives(user(), li2, { tab: 'ELIGIBLE' });
    const assigned = await getEligibleCreatives(user(), li2, { tab: 'ASSIGNED' });
    expect(all.find((r) => r.id === videoId)).toMatchObject({
      eligible: false,
      why: "This creative can't be used in Display line items.",
    });
    expect(eligible.map((r) => r.id)).toContain(imageId);
    expect(eligible.map((r) => r.id)).not.toContain(videoId);
    expect(assigned.map((r) => r.id)).toEqual([imageId]);
    expect(
      (await getEligibleCreatives(user(), li2, { tab: 'ALL', q: 'video' })).map((r) => r.id),
    ).toEqual([videoId]);
  });
});

describe('registry completeness', () => {
  const models = new Map(parseModels(readSchemaText()).map((m) => [m.name, m]));
  const columns = (name: string) =>
    models
      .get(name)!
      .fields.filter((f) => !models.has(f.type) && !/@relation/.test(f.attributes))
      .map((f) => f.name);

  it('registers or ignores every Creative column', () => {
    const paths = creativeColumnFields.map((f) => f.path);
    expect(columns('Creative').filter((c) => !paths.includes(c))).toEqual([]);
  });
  it('registers or ignores every CreativeExt column', () => {
    const paths = creativeExtFields.map((f) => f.path);
    expect(
      columns('CreativeExt').filter(
        (c) => !['id', 'sandboxId', 'creativeId'].includes(c) && !paths.includes(c),
      ),
    ).toEqual([]);
  });
});
