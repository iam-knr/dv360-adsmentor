// Insertion order services against a real database (module 07 6.3, build-plan 4.11 "Tests to write").
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import {
  archiveInsertionOrders,
  createInsertionOrder,
  getInsertionOrder,
  listInsertionOrders,
  patchIoBudget,
  setIoObjectiveToNone,
  setIoStatus,
  updateInsertionOrder,
} from '@/lib/insertion-orders/service';
import { newIoValue, type IoWire } from '@/lib/insertion-orders/wire';
import { createWorld, dropWorld, type World } from '../../db/helpers';
import { SIM_TODAY, userOf } from '../campaigns/fixtures';

let w: World;

beforeAll(async () => {
  w = await createWorld('io');
});
afterAll(async () => {
  await dropWorld(w);
  await prisma.$disconnect();
});

function validIo(over: Partial<IoWire> = {}): IoWire {
  const io = newIoValue('STANDARD', 'BRAND_AWARENESS', SIM_TODAY);
  io.name = 'Awareness IO';
  io.budget.segments[0]!.amount = 100000;
  io.kpi = { type: 'VCPM', value: 40 };
  return { ...io, ...over };
}

const groupsOf = (entityId: string) =>
  prisma.changeGroup.findMany({
    where: { sandboxId: w.sandboxId, entityId },
    include: { entries: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { occurredAt: 'asc' },
  });

describe('new IO defaults (AC-07-04)', () => {
  it('Draft, Flight + Ahead, Automate, VCPM, segment today to +1 month, frequency inherit', () => {
    const v = newIoValue('STANDARD', 'BRAND_AWARENESS', '2026-10-29');
    expect(v.status).toBe('DRAFT');
    expect(v.pacing).toMatchObject({ period: 'FLIGHT', type: 'AHEAD' });
    expect(v.optimization).toMatchObject({
      mode: 'IO_AUTOMATED',
      optimizedTowards: 'MAX_VIEWABLE_IMPRESSIONS',
    });
    expect(v.kpi?.type).toBe('VCPM');
    expect(v.budget.segments[0]).toMatchObject({ startDate: '2026-10-29', endDate: '2026-11-29' });
    expect(v.frequencyCap.mode).toBe('INHERIT');
    expect(v.partnerCosts.mediaFees[0]).toMatchObject({ system: true, invoiced: true });
  });
  it('CTV defaults to CPM and Maximize reach; DOOH has no KPI and is LI controlled', () => {
    expect(newIoValue('CTV_OTT', 'BRAND_AWARENESS', SIM_TODAY).kpi?.type).toBe('CPM');
    expect(newIoValue('CTV_OTT', 'BRAND_AWARENESS', SIM_TODAY).optimization.optimizedTowards).toBe(
      'MAX_REACH',
    );
    const dooh = newIoValue('DOOH', 'NONE', SIM_TODAY);
    expect(dooh.kpi).toBeNull();
    expect(dooh.optimization.mode).toBe('LI_CONTROLLED');
    expect(dooh.partnerCosts.cpmFees).toEqual([]);
  });
});

describe('createInsertionOrder', () => {
  it('creates the IO with segments and the locked media fee 1, and logs one CREATE group', async () => {
    const r = await createInsertionOrder(userOf(w), w.campaignId, validIo(), {
      changeNote: 'new io',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const io = await prisma.insertionOrder.findUniqueOrThrow({
      where: { id: r.data.id },
      include: { segments: true, fees: true },
    });
    expect(io).toMatchObject({
      status: 'DRAFT',
      type: 'STANDARD',
      bidBudgetControl: 'IO_AUTOMATED',
      kpi: 'VCPM',
    });
    expect(io.segments).toHaveLength(1);
    expect(io.fees).toEqual([
      expect.objectContaining({
        kind: 'MEDIA_FEE',
        slot: 1,
        feeType: 'DV360_FEE',
        isSystem: true,
        invoiced: true,
      }),
    ]);
    const g = (await groupsOf(r.data.id))[0]!;
    expect(g.note).toBe('new io');
    expect(g.entries.some((e) => e.label === 'Budget segment 1')).toBe(true);
  });

  it('empty name and budget give "Enter a value"; KPI 0 gives "Enter a number greater than 0" (AC-07-05)', async () => {
    const io = validIo({ name: '', kpi: { type: 'VCPM', value: 0 } });
    io.budget.segments[0]!.amount = '';
    const r = await createInsertionOrder(userOf(w), w.campaignId, io);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const byPath = Object.fromEntries(r.issues.map((i) => [i.path, i.message]));
    expect(byPath.name).toBe('Enter a value');
    expect(byPath['budget.segments[0].amount']).toBe('Enter a value');
    expect(byPath['kpi.value']).toBe('Enter a number greater than 0');
  });

  it('rejects overlapping segments (IO-027) and PAUSED on create (IO-012)', async () => {
    const io = validIo({ status: 'PAUSED' });
    io.budget.segments.push({ amount: 10, startDate: SIM_TODAY, endDate: '2026-01-10' });
    const r = await createInsertionOrder(userOf(w), w.campaignId, io);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.map((i) => i.message)).toContain("Budget segments can't overlap.");
      expect(r.issues.map((i) => i.code)).toContain('IO-012');
    }
  });

  it('a forged create by READ_ONLY returns FORBIDDEN', async () => {
    const r = await createInsertionOrder(userOf(w, 'READ_ONLY'), w.campaignId, validIo());
    expect(r.ok === false && r.code).toBe('FORBIDDEN');
  });
});

describe('updateInsertionOrder', () => {
  it('logs segment changes as "Budget segment 1" entries and bumps the version', async () => {
    const c = await createInsertionOrder(userOf(w), w.campaignId, validIo({ name: 'Edit me' }));
    if (!c.ok) throw new Error('setup');
    const d = await getInsertionOrder(userOf(w), c.data.id);
    const next = structuredClone(d.value);
    next.budget.segments[0]!.amount = 150000;
    const r = await updateInsertionOrder(userOf(w), c.data.id, next, {
      expectedVersion: d.version,
    });
    expect(r.ok).toBe(true);
    const g = (await groupsOf(c.data.id))[1]!;
    expect(g.entries.map((e) => [e.parentPath, e.label, e.oldValue, e.newValue])).toEqual([
      ['Budget segment 1', 'Budget', '100000.00', '150000.00'],
    ]);
  });

  it('objective to NONE is allowed, any other change is IO-005 (AC-07-10)', async () => {
    const c = await createInsertionOrder(userOf(w), w.campaignId, validIo({ name: 'Objective' }));
    if (!c.ok) throw new Error('setup');
    const d = await getInsertionOrder(userOf(w), c.data.id);
    const bad = await updateInsertionOrder(userOf(w), c.data.id, {
      ...d.value,
      objective: 'CLICKS',
    });
    expect(bad.ok === false && bad.issues.map((i) => i.code)).toContain('IO-005');
    const r = await setIoObjectiveToNone(userOf(w), c.data.id);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.value.objective).toBe('NONE');
      expect(r.data.value.optimization.mode).toBe('LI_CONTROLLED');
    }
  });

  it('automation with a non Display/Video/CTV line item is IO-052 (AC-07-11)', async () => {
    const c = await createInsertionOrder(
      userOf(w),
      w.campaignId,
      validIo({ name: 'With YT', optimization: { mode: 'LI_CONTROLLED' } }),
    );
    if (!c.ok) throw new Error('setup');
    await prisma.lineItem.create({
      data: {
        sandboxId: w.sandboxId,
        ioId: c.data.id,
        campaignId: w.campaignId,
        advertiserId: w.advertiserId,
        name: 'YT',
        type: 'YT_VIDEO',
      },
    });
    const d = await getInsertionOrder(userOf(w), c.data.id);
    const r = await updateInsertionOrder(userOf(w), c.data.id, {
      ...d.value,
      optimization: {
        ...d.value.optimization,
        mode: 'IO_AUTOMATED',
        optimizedTowards: 'MAX_REACH',
      },
    });
    expect(r.ok === false && r.issues.map((i) => i.code)).toContain('IO-052');
  });

  it('switching to Automate sets LI pacing Flight + ASAP and the bid goal, with SYSTEM entries (V-07-21, AC-07-12)', async () => {
    const c = await createInsertionOrder(
      userOf(w),
      w.campaignId,
      validIo({ name: 'Propagate', optimization: { mode: 'LI_CONTROLLED' } }),
    );
    if (!c.ok) throw new Error('setup');
    const li = await prisma.lineItem.create({
      data: {
        sandboxId: w.sandboxId,
        ioId: c.data.id,
        campaignId: w.campaignId,
        advertiserId: w.advertiserId,
        name: 'Display LI',
        type: 'DISPLAY',
        pacingType: 'EVEN',
        bidKind: 'FIXED',
      },
    });
    const d = await getInsertionOrder(userOf(w), c.data.id);
    const r = await updateInsertionOrder(userOf(w), c.data.id, {
      ...d.value,
      optimization: {
        ...d.value.optimization,
        mode: 'IO_AUTOMATED',
        optimizedTowards: 'MAX_VIEWABLE_10S',
      },
    });
    expect(r.ok).toBe(true);
    const after = await prisma.lineItem.findUniqueOrThrow({ where: { id: li.id } });
    expect(after).toMatchObject({
      pacingPeriod: 'FLIGHT',
      pacingType: 'ASAP',
      bidKind: 'AUTOMATED',
      bidGoal: 'MAX_VIEWABLE_10S',
    });
    const g = (await groupsOf(li.id))[0]!;
    expect(g).toMatchObject({
      actorType: 'SYSTEM',
      systemActor: 'SIM_ENGINE',
      entityType: 'LINE_ITEM',
    });
    expect(g.entries.map((e) => e.fieldPath)).toEqual(
      expect.arrayContaining(['pacingType', 'bidKind', 'bidGoal']),
    );
  });

  it('a forged update by READ_ONLY returns FORBIDDEN (AC-07-21)', async () => {
    const d = await getInsertionOrder(userOf(w), w.ioId);
    const r = await updateInsertionOrder(userOf(w, 'READ_ONLY'), w.ioId, d.value);
    expect(r.ok === false && r.code).toBe('FORBIDDEN');
  });
});

describe('status, inline budget, archive, list', () => {
  it('Draft cannot be paused; Draft to Active writes STATUS_CHANGE', async () => {
    const c = await createInsertionOrder(userOf(w), w.campaignId, validIo({ name: 'Status IO' }));
    if (!c.ok) throw new Error('setup');
    expect((await setIoStatus(userOf(w), c.data.id, 'PAUSED')).ok).toBe(false);
    const r = await setIoStatus(userOf(w), c.data.id, 'ACTIVE');
    expect(r.ok).toBe(true);
    const g = (await groupsOf(c.data.id)).at(-1)!;
    expect(g.entries[0]).toMatchObject({
      kind: 'STATUS_CHANGE',
      oldValue: 'DRAFT',
      newValue: 'ACTIVE',
    });
  });

  it('inline budget edit validates and updates the segment (AC-07-13)', async () => {
    const c = await createInsertionOrder(userOf(w), w.campaignId, validIo({ name: 'Inline' }));
    if (!c.ok) throw new Error('setup');
    const d = await getInsertionOrder(userOf(w), c.data.id);
    const segId = d.segments[0]!.id!;
    const bad = await patchIoBudget(userOf(w), c.data.id, segId, 0);
    expect(bad.ok === false && bad.issues[0]?.message).toBe('Enter a number greater than 0');
    const ok = await patchIoBudget(userOf(w), c.data.id, segId, 2500);
    expect(ok.ok && ok.data.budget).toBe(2500);
  });

  it('lists at campaign and advertiser scope; archive cascades to line items', async () => {
    const byCampaign = await listInsertionOrders(userOf(w), { campaignId: w.campaignId }, {});
    const byAdvertiser = await listInsertionOrders(userOf(w), { advertiserId: w.advertiserId }, {});
    expect(byCampaign.total).toBe(byAdvertiser.total);
    const row = byCampaign.rows.find((r) => r.name === 'Awareness IO')!;
    expect(row).toMatchObject({
      type: 'STANDARD',
      budget: 100000,
      goal: '₹40.00 VCPM',
      impressions: 0,
    });

    const r = await archiveInsertionOrders(userOf(w), [w.ioId]);
    expect(r.ok && r.data).toMatchObject({ insertionOrders: 1, lineItems: 1 });
    const archived = await listInsertionOrders(
      userOf(w),
      { campaignId: w.campaignId },
      { status: ['ARCHIVED'] },
    );
    expect(archived.rows.map((x) => x.id)).toContain(w.ioId);
  });
});
