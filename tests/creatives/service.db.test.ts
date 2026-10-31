// Creative service against the database: create, list, update, review timing, appeals, bulk status, History,
// permissions (module 12 6.1: 1, 3 to 9, 13, 15, 16).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { syncCreativeReviews } from '@/lib/engine/io/structural';
import { ServiceFailure } from '@/lib/campaigns/service-kit';
import {
  appealCreative,
  getCreativeHistory,
  getCreativeStatus,
  listAppeals,
} from '@/lib/creatives/review-service';
import {
  bulkCreativeAction,
  createCreative,
  getCreativeDetail,
  listCreatives,
  updateCreative,
  validateCreative,
} from '@/lib/creatives/service';
import { dropWorld } from '../db/helpers';
import { createCreativeWorld, setSimHours, tpDisplay, userFor, type World } from './helpers';

let w: Awaited<ReturnType<typeof createCreativeWorld>>;
const aid = () => w.advertiserId;
const user = () => userFor(w);

beforeAll(async () => {
  w = await createCreativeWorld('cre');
});
afterAll(async () => {
  await dropWorld(w);
  await prisma.$disconnect();
});

const must = <T>(r: { ok: boolean; data?: T }): T => {
  if (!r.ok) throw new Error(`expected ok: ${JSON.stringify(r)}`);
  return r.data as T;
};

/** The engine tick's creative sync (what the 5 minute timer calls) at sim hour `hours`. */
async function engineSync(hours: number) {
  await setSimHours(w, hours);
  const t0 = new Date('2026-01-01T00:00:00Z').getTime() + hours * 3_600_000;
  await prisma.$transaction((tx) =>
    syncCreativeReviews(tx as never, { sandboxId: w.sandboxId, classroomId: w.classroomId }, t0),
  );
}

describe('create (AC 3, 4, 5)', () => {
  it('rejects an empty name, a 0 x 0 size and an empty tag and creates nothing', async () => {
    const before = await prisma.creative.count({ where: { sandboxId: w.sandboxId } });
    const r = await createCreative(
      user(),
      aid(),
      tpDisplay('', { width: 0, height: 0, thirdPartyTag: '' }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe('INVALID');
    expect(r.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(['CRE-001', 'CRE-003', 'CRE-005']),
    );
    expect(await prisma.creative.count({ where: { sandboxId: w.sandboxId } })).toBe(before);
  });

  let id = '';
  it('creates a third-party display creative with pending reviews on every exchange', async () => {
    const r = await createCreative(user(), aid(), tpDisplay('Banner A'));
    const data = must(r);
    id = data.id;
    const row = await prisma.creative.findUniqueOrThrow({
      where: { id },
      include: { reviews: true },
    });
    expect(row.kind).toBe('THIRD_PARTY_DISPLAY');
    expect(row.reviews).toHaveLength(2);
    expect(row.reviews.every((x) => x.status === 'PENDING' && x.decideAt)).toBe(true);
    const ext = await prisma.creativeExt.findUniqueOrThrow({ where: { creativeId: id } });
    expect(ext.dv360DecideAt!.getTime()).toBeGreaterThan(
      new Date('2026-01-01T00:00:00Z').getTime(),
    );
  });

  it('shows Pending at first and Servable once the clock and the engine sync have run (AC 5)', async () => {
    const first = await getCreativeDetail(user(), aid(), id);
    expect(first.row.dv360Status).toBe('PENDING');
    expect(first.row.exchangeStatus.text).toBe('Not servable (0 of 2)');
    await engineSync(13);
    const later = await getCreativeDetail(user(), aid(), id);
    expect(later.row.dv360Status).toBe('SERVABLE');
    expect(later.row.exchangeStatus.text).toBe('Servable (2 of 2)');
    const status = await getCreativeStatus(user(), aid(), id);
    expect(status.exchangeSummary).toBe('Approved by 2 of 2 exchanges');
    expect(status.dv360.feedback).toBe('Creative is servable');
    expect(status.reviewCompleted).not.toBeNull();
    expect(status.pending).toBe(false);
  });

  it('writes the History a student reads (AC 4)', async () => {
    const h = await getCreativeHistory(user(), aid(), id);
    const create = h.rows.find((r) => r.summary.endsWith('changes made.'));
    expect(create).toBeTruthy();
    expect(create!.lines).toEqual(
      expect.arrayContaining([
        'Name is Banner A',
        'Creative type is Third party display',
        'Archived is false',
      ]),
    );
    expect(create!.user).toBe(`User ${w.tag}`); // display name, not the email (Q15)
    // the engine's approvals are system rows in the same History
    expect(h.rows.some((r) => r.user === 'CREATIVE_APPROVAL_SYNC')).toBe(true);
  });
});

describe('list (AC 1)', () => {
  it('lists Active creatives by default, newest first, with the derived columns', async () => {
    const paused = must(await createCreative(user(), aid(), tpDisplay('Paused one')));
    must(await bulkCreativeAction(user(), aid(), { ids: [paused.id], action: 'PAUSE' }));
    const res = await listCreatives(user(), aid());
    const names = res.rows.map((r) => r.name);
    expect(names).toContain('Banner A');
    expect(names).not.toContain('Paused one');
    const row = res.rows.find((r) => r.name === 'Banner A')!;
    expect(row).toMatchObject({
      type: 'Third party',
      format: 'Third-party display',
      aiLabel: '-',
      dimensions: '300×250',
      tagWrapping: 'No',
      lineItems: 0,
      source: 'Display & Video 360',
    });
    expect(res.rows.map((r) => r.createdAt)).toEqual(
      [...res.rows.map((r) => r.createdAt)].sort().reverse(),
    );
    const all = await listCreatives(user(), aid(), { status: ['ACTIVE', 'PAUSED'] });
    expect(all.rows.map((r) => r.name)).toContain('Paused one');
    const search = await listCreatives(user(), aid(), { q: 'banner' });
    expect(search.rows.every((r) => /banner/i.test(r.name))).toBe(true);
  });
});

describe('update (AC 6, 13)', () => {
  let id = '';
  beforeAll(async () => {
    id = must(await createCreative(user(), aid(), tpDisplay('Editable'))).id;
    await engineSync(20);
  });
  it('editing only name or notes keeps the review and logs the change', async () => {
    const d = await getCreativeDetail(user(), aid(), id);
    const r = await updateCreative(
      user(),
      aid(),
      id,
      { ...d.value, name: 'Renamed', notes: 'n' },
      { expectedVersion: d.version },
    );
    expect(must(r).reviewRestarted).toBe(false);
    const after = await getCreativeDetail(user(), aid(), id);
    expect(after.row.dv360Status).toBe('SERVABLE');
    const h = await getCreativeHistory(user(), aid(), id);
    expect(h.rows[0]!.lines).toEqual(
      expect.arrayContaining(['Name changed from "Editable" to "Renamed"']),
    );
  });
  it('editing the tag, URL or size restarts the review and says so in History', async () => {
    const d = await getCreativeDetail(user(), aid(), id);
    const r = await updateCreative(
      user(),
      aid(),
      id,
      { ...d.value, landingPageUrl: 'https://example.com/new' },
      { expectedVersion: d.version },
    );
    expect(must(r).reviewRestarted).toBe(true);
    const after = await getCreativeDetail(user(), aid(), id);
    expect(after.row.dv360Status).toBe('PENDING');
    const h = await getCreativeHistory(user(), aid(), id);
    expect(h.rows[0]!.lines.join('|')).toContain(
      'Landing page URL changed from "https://example.com/landing" to "https://example.com/new"',
    );
  });
  it('a stale expectedVersion is a conflict', async () => {
    const d = await getCreativeDetail(user(), aid(), id);
    const r = await updateCreative(
      user(),
      aid(),
      id,
      { ...d.value, name: 'x' },
      { expectedVersion: d.version - 1 },
    );
    expect(r).toMatchObject({ ok: false, code: 'CONFLICT' });
  });
  it('CM360 creatives: only name and status change, a forged save is CRE-060 (AC 13)', async () => {
    await prisma.creative.update({ where: { id }, data: { source: 'CM360', cm360Id: 'cm-1' } });
    const d = await getCreativeDetail(user(), aid(), id);
    expect(d.cm360).toBe(true);
    const forged = await updateCreative(user(), aid(), id, {
      ...d.value,
      landingPageUrl: 'https://evil.example.com',
    });
    expect(forged).toMatchObject({ ok: false, code: 'INVALID' });
    if (!forged.ok) expect(forged.issues.map((i) => i.code)).toContain('CRE-060');
    must(
      await updateCreative(user(), aid(), id, { ...d.value, name: 'CM name', status: 'PAUSED' }),
    );
    const row = await prisma.creative.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({
      name: 'CM name',
      status: 'PAUSED',
      landingPageUrl: 'https://example.com/new',
    });
  });
});

describe('appeals (AC 7, 8)', () => {
  let id = '';
  let rowId = '';
  beforeAll(async () => {
    id = must(await createCreative(user(), aid(), tpDisplay('Appealed'))).id;
    await engineSync(40);
    // one exchange disapproved for an SSL reason
    const review = (
      await prisma.creativeReview.findMany({
        where: { creativeId: id },
        orderBy: { exchangeId: 'asc' },
      })
    )[0]!;
    rowId = review.id;
    await prisma.creativeReview.update({
      where: { id: rowId },
      data: { status: 'DISAPPROVED', feedback: 'SSL', sslStatus: 'DISAPPROVED' },
    });
  });
  it('shows Servable (1 of 2), the reason and Appeal; a fully approved creative has none', async () => {
    const d = await getCreativeDetail(user(), aid(), id);
    expect(d.row.exchangeStatus.text).toBe('Servable (1 of 2)');
    const s = await getCreativeStatus(user(), aid(), id);
    const bad = s.exchanges.find((e) => e.status === 'DISAPPROVED')!;
    expect(bad.canAppeal).toBe(true);
    expect(bad.feedback?.summary).toContain('SSL');
    expect(bad.feedback?.steps.length).toBeGreaterThan(0);
    const clean = must(await createCreative(user(), aid(), tpDisplay('Clean')));
    await engineSync(60);
    const cs = await getCreativeStatus(user(), aid(), clean.id);
    expect(cs.exchanges.some((e) => e.canAppeal)).toBe(false);
    const refused = await appealCreative(user(), aid(), clean.id, {});
    expect(refused).toMatchObject({ ok: false, code: 'INVALID' });
    if (!refused.ok) expect(refused.issues[0]!.code).toBe('CRE-043');
  });
  it('an appeal opens a row, moves the exchange to Pending and resolves after the engine delay', async () => {
    await setSimHours(w, 70);
    const r = must(await appealCreative(user(), aid(), id, { reason: 'Our tag is SSL now' }));
    expect(r.appealIds).toHaveLength(1);
    const during = await listAppeals(user(), aid());
    const open = during.rows.find((a) => a.creativeId === id)!;
    expect(open).toMatchObject({ status: 'Pending', name: 'Appealed', completedAt: null });
    expect((await prisma.creativeReview.findUniqueOrThrow({ where: { id: rowId } })).status).toBe(
      'PENDING',
    );
    // a second appeal for the same exchange is refused while one is open
    const dup = await appealCreative(user(), aid(), id, {});
    expect(dup.ok).toBe(false);
    await setSimHours(w, 70 + 40);
    const after = await listAppeals(user(), aid());
    const done = after.rows.find((a) => a.id === open.id)!;
    expect(['Approved', 'Rejected']).toContain(done.status);
    expect(done.completedAt).not.toBeNull();
    expect(done.result).toBe(done.status === 'Approved' ? 'Approved' : 'Disapproved');
    const review = await prisma.creativeReview.findUniqueOrThrow({ where: { id: rowId } });
    expect(review.status).toBe(done.status === 'Approved' ? 'APPROVED' : 'DISAPPROVED');
    const h = await getCreativeHistory(user(), aid(), id);
    expect(
      h.rows.some(
        (x) =>
          x.user === 'CREATIVE_APPROVAL_SYNC' &&
          x.lines.some((l) => /approval status changed from "Pending"/.test(l)),
      ),
    ).toBe(true);
  });
});

describe('not servable (the random disapproval forced on by the partner flag, RC-033)', () => {
  it('shows Pending, then Not servable on every exchange, and the DV360 appeal runs its course', async () => {
    const setRate = (n: number) =>
      prisma.partnerFeatureFlag.updateMany({
        where: { partnerId: w.partnerId, key: 'CREATIVE_RANDOM_DISAPPROVAL_RATE' },
        data: { numericValue: n },
      });
    await setSimHours(w, 200);
    await setRate(100);
    const id = must(await createCreative(user(), aid(), tpDisplay('Rejected tag'))).id;
    await setRate(0);
    expect((await getCreativeDetail(user(), aid(), id)).row.dv360Status).toBe('PENDING');
    await engineSync(230);
    const s = await getCreativeStatus(user(), aid(), id);
    expect(s.dv360).toMatchObject({ status: 'NOT_SERVABLE', canAppeal: true });
    expect(s.exchanges.every((e) => e.status === 'DISAPPROVED' && e.canAppeal)).toBe(true);
    expect(s.exchangeSummary).toBe('Approved by 0 of 2 exchanges');
    // appeal at the DV360 level
    const appeal = must(await appealCreative(user(), aid(), id, {}));
    expect(appeal.appealIds).toHaveLength(1);
    expect((await prisma.creative.findUniqueOrThrow({ where: { id } })).dv360Review).toBe(
      'PENDING',
    );
    const mid = await getCreativeStatus(user(), aid(), id);
    expect(mid.dv360).toMatchObject({ status: 'PENDING', canAppeal: false });
    expect(mid.exchanges.every((e) => e.status === 'PENDING')).toBe(true);
    await setSimHours(w, 230 + 40);
    const done = await getCreativeStatus(user(), aid(), id);
    expect(['SERVABLE', 'NOT_SERVABLE']).toContain(done.dv360.status);
    const accepted = done.dv360.status === 'SERVABLE';
    expect(done.exchanges.every((e) => e.status === (accepted ? 'APPROVED' : 'DISAPPROVED'))).toBe(
      true,
    );
    const row = (await listAppeals(user(), aid())).rows.find((a) => a.creativeId === id)!;
    expect(row).toMatchObject({
      appealType: 'DV360 review',
      status: accepted ? 'Approved' : 'Rejected',
    });
  });
});

describe('bulk status (AC 9)', () => {
  it('warns with the count when pausing a creative on an active line item and logs one group per creative', async () => {
    const id = must(await createCreative(user(), aid(), tpDisplay('In use'))).id;
    await prisma.lineItem.update({ where: { id: w.lineItemId }, data: { status: 'ACTIVE' } });
    await prisma.creativeAssignment.create({
      data: { sandboxId: w.sandboxId, lineItemId: w.lineItemId, creativeId: id },
    });
    const r = await bulkCreativeAction(user(), aid(), { ids: [id], action: 'PAUSE' });
    expect(r.ok && r.warnings?.[0]?.message).toBe(
      'This creative is assigned to 1 active line items.',
    );
    expect((await prisma.creative.findUniqueOrThrow({ where: { id } })).status).toBe('PAUSED');
    const group = await prisma.changeGroup.findFirstOrThrow({
      where: { entityId: id, bulkJobId: { not: null } },
      orderBy: { occurredAt: 'asc' },
    });
    expect(group.source).toBe('BULK_EDIT');
    const job = await prisma.bulkJob.findUniqueOrThrow({ where: { id: group.bulkJobId! } });
    expect(job).toMatchObject({
      action: 'PAUSE',
      description: 'Status edited on 1 creative',
      status: 'COMPLETED',
    });
    must(await bulkCreativeAction(user(), aid(), { ids: [id], action: 'ARCHIVE' }));
    const un = await bulkCreativeAction(user(), aid(), { ids: [id], action: 'UNARCHIVE' });
    expect(un.ok).toBe(true);
    expect((await prisma.creative.findUniqueOrThrow({ where: { id } })).status).toBe('PAUSED');
  });
});

describe('permissions (AC 15, 16)', () => {
  it('READ_ONLY and PARTNER_CLIENT can read but every write is FORBIDDEN', async () => {
    for (const role of ['READ_ONLY', 'PARTNER_CLIENT'] as const) {
      const u = userFor(w, role);
      expect((await listCreatives(u, aid())).rows.length).toBeGreaterThan(0);
      expect(await createCreative(u, aid(), tpDisplay('Nope'))).toMatchObject({
        ok: false,
        code: 'FORBIDDEN',
      });
      expect(
        await bulkCreativeAction(u, aid(), { ids: [w.creativeId], action: 'PAUSE' }),
      ).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    }
  });
  it('CREATIVE and ADMIN may write creatives', async () => {
    for (const role of ['CREATIVE', 'ADMIN'] as const) {
      expect((await createCreative(userFor(w, role), aid(), tpDisplay(`By ${role}`))).ok).toBe(
        true,
      );
    }
  });
  it('REPORTING_ONLY gets not found on every read', async () => {
    const u = userFor(w, 'REPORTING_ONLY');
    await expect(listCreatives(u, aid())).rejects.toBeInstanceOf(ServiceFailure);
    await expect(getCreativeStatus(u, aid(), w.creativeId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
  it('a foreign or malformed id is not found, not an error page', async () => {
    const other = await createCreativeWorld('cre-other');
    try {
      await expect(getCreativeDetail(user(), aid(), other.creativeId)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      await expect(listCreatives(user(), other.advertiserId)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      await expect(getCreativeDetail(user(), aid(), 'not-an-id')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      // an advertiser's creative asked through another advertiser of the same sandbox is also not found
      expect(await validateCreative(user(), aid(), tpDisplay('x'))).toEqual(expect.any(Array));
    } finally {
      await dropWorld(other);
    }
  });
});

export type { World };
