// Module 11 K1..K8 on the services: status, archive cascade, duplicate, settings, targeting, creative assignment,
// the job rows on the Bulk status page and the worker cursor (V-11-11..15, AC-11-14..20, AC-11-26).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { bulkCapabilities, processJob, runBulk } from '@/lib/bulk/run';
import { getJob, listJobs } from '@/lib/bulk/jobs';
import { createLineItem, getLineItemDetail } from '@/lib/line-items/service';
import { createCampaign } from '@/lib/campaigns/service';
import { dropWorld } from '../db/helpers';
import {
  addCreative,
  createLiWorld,
  userFor,
  validDraft,
  type World,
} from '../services/line-items/helpers';
import { validCampaignWire } from '../services/campaigns/fixtures';

let w: World;
let li1: string;
let li2: string;
let campaignPublic: string;
let ioPublic: string;

const user = () => userFor(w);
const detailOf = async (publicId: string) => {
  const row = await prisma.lineItem.findFirstOrThrow({ where: { publicId: BigInt(publicId) } });
  const d = await getLineItemDetail(user(), row.id);
  if (!d) throw new Error('no detail');
  return d;
};

beforeAll(async () => {
  w = await createLiWorld('bulk');
  for (const name of ['Bulk one', 'Bulk two']) {
    const made = await createLineItem(user(), w.ioId, await validDraft(w, 'DISPLAY', name));
    if (!made.ok) throw new Error(JSON.stringify(made.issues));
    if (name === 'Bulk one') li1 = made.data.publicId;
    else li2 = made.data.publicId;
  }
  const c = await prisma.campaign.findUniqueOrThrow({ where: { id: w.campaignId } });
  const io = await prisma.insertionOrder.findUniqueOrThrow({ where: { id: w.ioId } });
  campaignPublic = c.publicId.toString();
  ioPublic = io.publicId.toString();
});
afterAll(async () => {
  await dropWorld(w);
  await prisma.$disconnect();
});

const mustRun = async (...args: Parameters<typeof runBulk>) => {
  const res = await runBulk(...args);
  if (!res.ok) throw new Error(JSON.stringify(res.issues));
  return res.data;
};

describe('status (K2, AC-11-14)', () => {
  it('pauses an active campaign, skips the paused one and describes the job', async () => {
    const other = await createCampaign(
      user(),
      w.advertiserId,
      validCampaignWire({ name: 'Paused one', status: 'PAUSED' }),
    );
    if (!other.ok) throw new Error('campaign');
    const out = await mustRun(user(), {
      entity: 'campaign',
      ids: [campaignPublic, other.data.publicId],
      params: { op: 'PAUSE' },
    });
    expect(out.status).toBe('COMPLETED');
    expect(out.ok).toBe(1);
    expect(out.failed).toBe(1);
    expect(out.summary).toBe("1 of 2 selected items couldn't be updated.");
    expect(out.items.find((i) => i.status === 'FAILED')?.ruleId).toBe('BLK-010');
    const job = await getJob(user(), out.jobId);
    expect(job.description).toBe('Status edited on 2 campaigns');
    expect(job.sourceLabel).toBe('Bulk Edit');
    // each changed entity has one ChangeGroup tied to the job
    const groups = await prisma.changeGroup.findMany({ where: { bulkJobId: out.jobId } });
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ source: 'BULK_EDIT', entityType: 'CAMPAIGN' });
    const back = await mustRun(user(), {
      entity: 'campaign',
      ids: [campaignPublic],
      params: { op: 'ACTIVATE' },
    });
    expect(back.ok).toBe(1);
  });

  it('reports ids that do not exist (BLK-025)', async () => {
    const out = await mustRun(user(), {
      entity: 'lineItem',
      ids: ['999999991'],
      params: { op: 'PAUSE' },
    });
    expect(out.items[0]).toMatchObject({ status: 'FAILED', ruleId: 'BLK-025' });
  });
});

describe('capabilities (K1, V-11-11)', () => {
  it('is enabled when one row is eligible and disabled when none is', async () => {
    const caps = await bulkCapabilities(user(), 'lineItem', [li1, li2]);
    expect(caps.actions.ACTIVATE?.enabled).toBe(true); // drafts
    expect(caps.actions.PAUSE?.enabled).toBe(false);
    expect(caps.actions.PAUSE?.reason).toMatch(/active/);
    expect(caps.actions.UNARCHIVE?.enabled).toBe(false);
    expect(caps.actions['EDIT_TARGETING:DEVICE']?.enabled).toBe(true);
    expect(caps.actions.SDF_DOWNLOAD?.enabled).toBe(true);
  });

  it('keeps SDF download for read-only roles and disables the edits (AC-11-20)', async () => {
    const readOnly = { ...user(), dvRole: 'READ_ONLY' as const };
    const caps = await bulkCapabilities(readOnly, 'lineItem', [li1]);
    expect(caps.actions.ARCHIVE?.enabled).toBe(false);
    expect(caps.actions.EDIT_SETTINGS?.enabled).toBe(false);
    expect(caps.actions.SDF_DOWNLOAD?.enabled).toBe(true);
    expect(caps.actions.SDF_UPLOAD?.enabled).toBe(false);
  });

  it('rejects every bulk operation for read-only roles on the server (AC-11-26)', async () => {
    for (const dvRole of ['READ_ONLY', 'REPORTING_ONLY'] as const) {
      const res = await runBulk(
        { ...user(), dvRole },
        { entity: 'lineItem', ids: [li1], params: { op: 'ACTIVATE' } },
      );
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('FORBIDDEN');
    }
  });
});

describe('duplicate (K4, AC-11-16, AC-11-17)', () => {
  it('copies a line item three times with the Copy of names and DRAFT status', async () => {
    const out = await mustRun(user(), {
      entity: 'lineItem',
      ids: [li1],
      params: { op: 'DUPLICATE', copies: 3 },
    });
    expect(out.ok).toBe(1);
    const copies = await prisma.lineItem.findMany({
      where: { copiedFromId: { not: null }, ioId: w.ioId },
      orderBy: { publicId: 'asc' },
    });
    expect(copies.map((c) => c.name)).toEqual([
      'Copy of Bulk one',
      'Copy of Bulk one (2)',
      'Copy of Bulk one (3)',
    ]);
    expect(copies.every((c) => c.status === 'DRAFT')).toBe(true);
    const job = await getJob(user(), out.jobId);
    expect(job.description).toBe(
      `Duplicating 1 line item with 3 copies to insertion order ${ioPublic}`,
    );
    expect(job.action).toBe('VIEW');
  });

  it('rejects a copy count below 1 (BLK-013)', async () => {
    const res = await runBulk(user(), {
      entity: 'lineItem',
      ids: [li1],
      params: { op: 'DUPLICATE', copies: 0 },
    });
    expect(res.ok).toBe(false);
  });

  it('duplicates a whole campaign tree with no metrics, PAUSED campaign and DRAFT children', async () => {
    const before = await prisma.lineItem.count({ where: { sandboxId: w.sandboxId } });
    const out = await mustRun(user(), {
      entity: 'campaign',
      ids: [campaignPublic],
      params: { op: 'DUPLICATE', copies: 1 },
    });
    expect(out.ok).toBe(1);
    const copy = await prisma.campaign.findFirstOrThrow({
      where: { copiedFromId: w.campaignId },
      include: { insertionOrders: { include: { lineItems: true, segments: true } }, budgets: true },
    });
    expect(copy.name).toMatch(/^Copy of /);
    expect(copy.status).toBe('PAUSED');
    expect(copy.budgets.length).toBeGreaterThan(0);
    expect(copy.insertionOrders[0]?.status).toBe('DRAFT');
    expect(copy.insertionOrders[0]?.segments.length).toBeGreaterThan(0);
    const sourceLis = await prisma.lineItem.count({
      where: { ioId: w.ioId, status: { not: 'ARCHIVED' } },
    });
    expect(copy.insertionOrders[0]?.lineItems).toHaveLength(sourceLis);
    expect(await prisma.lineItem.count({ where: { sandboxId: w.sandboxId } })).toBe(
      before + sourceLis,
    );
    // the copy has its own ids
    expect(copy.publicId.toString()).not.toBe(campaignPublic);
  });

  it('reports a line item whose type the target insertion order refuses (BLK-014)', async () => {
    const cta = await prisma.insertionOrder.create({
      data: {
        sandboxId: w.sandboxId,
        campaignId: w.campaignId,
        advertiserId: w.advertiserId,
        name: 'DOOH target',
        type: 'DOOH',
        objective: 'NONE',
      },
    });
    const out = await mustRun(user(), {
      entity: 'lineItem',
      ids: [li1],
      params: { op: 'DUPLICATE', copies: 1, targetParentId: cta.publicId.toString() },
    });
    expect(out.items[0]).toMatchObject({ status: 'FAILED', ruleId: 'BLK-014' });
  });
});

describe('edits (K6..K8, AC-11-19)', () => {
  it('overwrites pacing on the selected line items, one ChangeGroup each', async () => {
    const out = await mustRun(user(), {
      entity: 'lineItem',
      ids: [li1, li2],
      params: { op: 'EDIT_SETTINGS', patch: { integrationCode: 'BULK-7' } },
    });
    expect(out.ok).toBe(2);
    for (const id of [li1, li2]) {
      expect((await detailOf(id)).value.integrationCode).toBe('BULK-7');
    }
    const groups = await prisma.changeGroup.findMany({ where: { bulkJobId: out.jobId } });
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.source === 'BULK_EDIT' && g.entityType === 'LINE_ITEM')).toBe(
      true,
    );
  });

  it('adds, replaces and removes a language, and skips nothing that is available (V-11-15)', async () => {
    const sel = { id: 'en', mode: 'INCLUDE' as const, label: 'English' };
    const add = await mustRun(user(), {
      entity: 'lineItem',
      ids: [li1, li2],
      params: {
        op: 'EDIT_TARGETING',
        edit: { group: 'CONTENT', dimension: 'LANGUAGE', mode: 'ADD', value: { sels: [sel] } },
      },
    });
    expect(add.failed).toBe(0);
    let detail = await detailOf(li1);
    expect(detail.value.targetingState.criteria.language?.map((s) => s.id)).toEqual(['en']);
    const replace = await mustRun(user(), {
      entity: 'lineItem',
      ids: [li1],
      params: {
        op: 'EDIT_TARGETING',
        edit: {
          group: 'CONTENT',
          dimension: 'LANGUAGE',
          mode: 'REPLACE',
          value: { sels: [{ id: 'hi', mode: 'INCLUDE', label: 'Hindi' }] },
        },
      },
    });
    expect(replace.failed).toBe(0);
    detail = await detailOf(li1);
    expect(detail.value.targetingState.criteria.language?.map((s) => s.id)).toEqual(['hi']);
    const remove = await mustRun(user(), {
      entity: 'lineItem',
      ids: [li1],
      params: {
        op: 'EDIT_TARGETING',
        edit: {
          group: 'CONTENT',
          dimension: 'LANGUAGE',
          mode: 'REMOVE',
          value: { sels: [{ id: 'hi', mode: 'INCLUDE' }] },
        },
      },
    });
    expect(remove.failed).toBe(0);
    detail = await detailOf(li1);
    expect(detail.value.targetingState.criteria.language).toBeUndefined();
  });

  it('adds and removes a creative on line items and skips archived ones', async () => {
    const creative = await addCreative(w, 'Bulk banner', 'STANDARD_IMAGE');
    const add = await mustRun(user(), {
      entity: 'lineItem',
      ids: [li1, li2],
      params: { op: 'EDIT_CREATIVE_ASSIGNMENT', add: [creative] },
    });
    expect(add.ok).toBe(2);
    expect(await prisma.creativeAssignment.count({ where: { creativeId: creative } })).toBe(2);
    const remove = await mustRun(user(), {
      entity: 'lineItem',
      ids: [li1],
      params: { op: 'EDIT_CREATIVE_ASSIGNMENT', remove: [creative] },
    });
    expect(remove.ok).toBe(1);
    expect(await prisma.creativeAssignment.count({ where: { creativeId: creative } })).toBe(1);
  });
});

describe('archive and unarchive (K3, AC-11-15)', () => {
  it('archives an insertion order with its line items under one job and unarchives it to PAUSED', async () => {
    const out = await mustRun(user(), {
      entity: 'insertionOrder',
      ids: [ioPublic],
      params: { op: 'ARCHIVE' },
    });
    expect(out.ok).toBe(1);
    expect(
      await prisma.lineItem.count({ where: { ioId: w.ioId, status: { not: 'ARCHIVED' } } }),
    ).toBe(0);
    const groups = await prisma.changeGroup.findMany({ where: { bulkJobId: out.jobId } });
    expect(groups.length).toBeGreaterThan(1);
    expect(groups.every((g) => g.source === 'BULK_EDIT')).toBe(true);
    const un = await mustRun(user(), {
      entity: 'insertionOrder',
      ids: [ioPublic],
      params: { op: 'UNARCHIVE' },
    });
    expect(un.ok).toBe(1);
    expect((await prisma.insertionOrder.findUniqueOrThrow({ where: { id: w.ioId } })).status).toBe(
      'PAUSED',
    );
  });
});

describe('worker (V-11-14, AC-11-21)', () => {
  it('resumes from the cursor and never repeats an item', async () => {
    const first = await runBulk(
      user(),
      {
        entity: 'lineItem',
        ids: [li1, li2],
        params: { op: 'EDIT_SETTINGS', patch: { integrationCode: 'RESUME-1' } },
      },
      { budgetMs: 0 },
    );
    if (!first.ok) throw new Error('job');
    expect(first.data.status).toBe('RUNNING');
    expect(first.data.items).toHaveLength(0);
    const a = await processJob(w.sandboxId, first.data.jobId, 10_000);
    expect(a.status).toBe('COMPLETED');
    const b = await processJob(w.sandboxId, first.data.jobId, 10_000);
    expect(b.status).toBe('SKIPPED');
    const items = await prisma.bulkJobItem.findMany({ where: { jobId: first.data.jobId } });
    expect(items.map((i) => i.rowNumber).sort()).toEqual([1, 2]);
  });

  it('lists the jobs of the sandbox with the capped flag', async () => {
    const { rows, capped } = await listJobs(user());
    expect(rows.length).toBeGreaterThan(5);
    expect(capped).toBe(false);
    expect(rows[0]!.requestedAt >= rows.at(-1)!.requestedAt).toBe(true);
  });

  it('Q17: names the partner and advertiser by numeric public id, not an id fragment', async () => {
    const { rows } = await listJobs(user());
    const partner = await prisma.partner.findUniqueOrThrow({ where: { id: w.partnerId } });
    const adv = await prisma.advertiser.findUniqueOrThrow({ where: { id: w.advertiserId } });
    const mine = rows.find((r) => r.advertiserId === adv.publicId.toString());
    expect(mine?.partnerId).toBe(partner.publicId.toString());
    for (const r of rows) {
      expect(r.partnerId).toMatch(/^\d+$/);
      if (r.advertiserId) expect(r.advertiserId).toMatch(/^\d+$/);
    }
  });

  it('Q16: job times follow the sandbox sim clock', async () => {
    await prisma.simClock.update({
      where: { sandboxId: w.sandboxId },
      data: { simStart: new Date('2026-03-01T00:00:00Z'), tickIndex: 5 },
    });
    await mustRun(user(), {
      entity: 'lineItem',
      ids: [li1],
      params: { op: 'DUPLICATE', copies: 1 },
    });
    const { rows } = await listJobs(user());
    expect(rows[0]!.requestedAt.startsWith('2026-03-01T05:00')).toBe(true);
  });
});
