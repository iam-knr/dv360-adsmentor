// Campaign services against a real database (module 06 6.3, build-plan 4.11 "Tests to write").
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import {
  archiveCampaigns,
  createCampaign,
  getCampaign,
  getCopySource,
  listCampaigns,
  setCampaignStatus,
  updateCampaign,
} from '@/lib/campaigns/service';
import { createWorld, dropWorld, type World } from '../../db/helpers';
import { SIM_TODAY, userOf, validCampaignWire } from './fixtures';

let w: World;

beforeAll(async () => {
  w = await createWorld('cmp');
});
afterAll(async () => {
  await dropWorld(w);
  await prisma.$disconnect();
});

const groupsOf = (entityId: string) =>
  prisma.changeGroup.findMany({
    where: { sandboxId: w.sandboxId, entityId },
    include: { entries: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { occurredAt: 'asc' },
  });

describe('createCampaign', () => {
  it('creates the campaign and writes one CREATE group with one entry per field (AC-06-22)', async () => {
    const r = await createCampaign(userOf(w), w.advertiserId, validCampaignWire(), {
      changeNote: 'first one',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const row = await prisma.campaign.findUniqueOrThrow({ where: { id: r.data.id } });
    expect(row).toMatchObject({
      name: 'Diwali awareness',
      status: 'ACTIVE',
      goal: 'AWARENESS',
      kpi: 'CPM',
    });
    expect(row.kpiValue?.toString()).toBe('50');
    const groups = await groupsOf(r.data.id);
    expect(groups).toHaveLength(1);
    const g = groups[0]!;
    expect(g.note).toBe('first one');
    expect(g.entityType).toBe('CAMPAIGN');
    expect(g.summary).toBe(`${g.entries.length} changes made.`);
    expect(g.entries.every((e) => e.kind === 'CREATE')).toBe(true);
    expect(g.entries.map((e) => e.label)).toEqual(
      expect.arrayContaining(['Name', 'Status', 'Goal', 'KPI', 'KPI value', 'Start date']),
    );
    expect(g.entries.find((e) => e.label === 'Name')?.newValue).toBe('Diwali awareness');
  });

  it('rejects an empty name, no creative type and an empty frequency limit (CMP-001, CMP-020, CMP-040)', async () => {
    const r = await createCampaign(
      userOf(w),
      w.advertiserId,
      validCampaignWire({
        name: '',
        creativeTypes: [],
        frequencyCap: { mode: 'LIMITED', maxImpressions: '', periodCount: 1, period: 'WEEK' },
      }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe('INVALID');
    const byPath = Object.fromEntries(r.issues.map((i) => [i.path, i.message]));
    expect(byPath.name).toBe('Enter a value');
    expect(byPath.creativeTypes).toBe('Please select at least one creative type.');
    expect(byPath['frequencyCap.maxImpressions']).toBe('Enter a value');
  });

  it('returns the not recommended KPI as a warning and still creates (CMP-013)', async () => {
    const r = await createCampaign(
      userOf(w),
      w.advertiserId,
      validCampaignWire({ name: 'Awareness CPA', kpi: { type: 'CPA', value: 500 } }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings?.map((i) => i.code)).toContain('CMP-013');
  });

  it('ignores fully empty budget rows and rejects a row with only a name (CMP-050)', async () => {
    const wire = validCampaignWire({ name: 'With budgets' });
    wire.budgets[0] = { ...wire.budgets[0], name: 'Q1', amount: 1000 };
    const ok = await createCampaign(userOf(w), w.advertiserId, wire);
    expect(ok.ok).toBe(true);
    if (ok.ok)
      expect(await prisma.campaignBudget.count({ where: { campaignId: ok.data.id } })).toBe(1);

    const bad = validCampaignWire({ name: 'Bad budgets' });
    bad.budgets[1] = { ...bad.budgets[1], name: 'Only a name' };
    const r = await createCampaign(userOf(w), w.advertiserId, bad);
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.issues.map((i) => [i.code, i.path])).toContainEqual([
        'CMP-050',
        'budgets[1].amount',
      ]);
  });

  it('forbids READ_ONLY (FORBIDDEN, AC-06-20)', async () => {
    const r = await createCampaign(userOf(w, 'READ_ONLY'), w.advertiserId, validCampaignWire());
    expect(r).toEqual({ ok: false, code: 'FORBIDDEN', issues: [] });
  });
});

describe('updateCampaign', () => {
  it('writes one UPDATE entry per changed field with the old and new value (AC-06-22)', async () => {
    const c = await createCampaign(
      userOf(w),
      w.advertiserId,
      validCampaignWire({ name: 'Before' }),
    );
    if (!c.ok) throw new Error('setup');
    const detail = await getCampaign(userOf(w), c.data.id);
    const r = await updateCampaign(
      userOf(w),
      c.data.id,
      { ...detail.value, name: 'After', kpi: { ...detail.value.kpi, value: 60 } },
      { expectedVersion: detail.version, changeNote: 'raise goal' },
    );
    expect(r.ok).toBe(true);
    const groups = await groupsOf(c.data.id);
    const g = groups[1]!;
    expect(g.note).toBe('raise goal');
    expect(g.entries.map((e) => [e.kind, e.label, e.oldValue, e.newValue])).toEqual([
      ['UPDATE', 'Name', 'Before', 'After'],
      ['UPDATE', 'KPI value', '50', '60'],
    ]);
    if (r.ok) expect(r.data.version).toBe(detail.version + 1);
  });

  it('a save with nothing changed writes no group', async () => {
    const c = await createCampaign(userOf(w), w.advertiserId, validCampaignWire({ name: 'Same' }));
    if (!c.ok) throw new Error('setup');
    const d = await getCampaign(userOf(w), c.data.id);
    await updateCampaign(userOf(w), c.data.id, d.value, { expectedVersion: d.version });
    expect(await groupsOf(c.data.id)).toHaveLength(1);
  });

  it('a stale expectedVersion returns CONFLICT (DLG-11, AC-06-15)', async () => {
    const c = await createCampaign(userOf(w), w.advertiserId, validCampaignWire({ name: 'Stale' }));
    if (!c.ok) throw new Error('setup');
    const d = await getCampaign(userOf(w), c.data.id);
    const r = await updateCampaign(
      userOf(w),
      c.data.id,
      { ...d.value, name: 'X' },
      { expectedVersion: d.version - 1 },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('CONFLICT');
  });

  it('locks the start date once the campaign started (CMP-033)', async () => {
    const d = await getCampaign(userOf(w), w.campaignId);
    expect(d.startLocked).toBe(true);
    const r = await updateCampaign(
      userOf(w),
      w.campaignId,
      {
        ...d.value,
        goal: 'AWARENESS',
        kpi: { type: 'CPM', value: 10 },
        creativeTypes: ['DISPLAY'],
        startDate: '2026-02-01',
      },
      { expectedVersion: d.version },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((i) => i.code)).toContain('CMP-033');
  });

  it('a forged update by READ_ONLY returns FORBIDDEN (AC-06-20)', async () => {
    const d = await getCampaign(userOf(w), w.campaignId);
    const r = await updateCampaign(userOf(w, 'READ_ONLY'), w.campaignId, d.value);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('FORBIDDEN');
  });
});

describe('setCampaignStatus', () => {
  it('pauses with one STATUS_CHANGE entry (AC-06-03)', async () => {
    const c = await createCampaign(
      userOf(w),
      w.advertiserId,
      validCampaignWire({ name: 'Status' }),
    );
    if (!c.ok) throw new Error('setup');
    const r = await setCampaignStatus(userOf(w), c.data.id, 'PAUSED');
    expect(r.ok && r.data.status).toBe('PAUSED');
    const g = (await groupsOf(c.data.id))[1]!;
    expect(g.summary).toBe('Status changed to Paused');
    expect(g.entries.map((e) => [e.kind, e.oldValue, e.newValue])).toEqual([
      ['STATUS_CHANGE', 'ACTIVE', 'PAUSED'],
    ]);
  });

  it('cannot activate an archived campaign', async () => {
    const c = await createCampaign(userOf(w), w.advertiserId, validCampaignWire({ name: 'Arch' }));
    if (!c.ok) throw new Error('setup');
    await archiveCampaigns(userOf(w), [c.data.id]);
    const r = await setCampaignStatus(userOf(w), c.data.id, 'ACTIVE');
    expect(r.ok).toBe(false);
  });
});

describe('archiveCampaigns (V-06-14)', () => {
  it('archives the campaign, its IOs and line items with N groups sharing the bulk job id', async () => {
    const r = await archiveCampaigns(userOf(w), [w.campaignId]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toMatchObject({ campaigns: 1, insertionOrders: 1, lineItems: 1 });
    const [c, io, li] = await Promise.all([
      prisma.campaign.findUniqueOrThrow({ where: { id: w.campaignId } }),
      prisma.insertionOrder.findUniqueOrThrow({ where: { id: w.ioId } }),
      prisma.lineItem.findUniqueOrThrow({ where: { id: w.lineItemId } }),
    ]);
    expect([c.status, io.status, li.status]).toEqual(['ARCHIVED', 'ARCHIVED', 'ARCHIVED']);
    const groups = await prisma.changeGroup.findMany({ where: { bulkJobId: r.data.jobId } });
    expect(groups).toHaveLength(3);
    expect(groups.every((g) => g.source === 'BULK_EDIT')).toBe(true);
    expect(new Set(groups.map((g) => g.entityType))).toEqual(
      new Set(['CAMPAIGN', 'INSERTION_ORDER', 'LINE_ITEM']),
    );
    const job = await prisma.bulkJob.findUniqueOrThrow({ where: { id: r.data.jobId } });
    expect(job).toMatchObject({ action: 'ARCHIVE', source: 'BULK_EDIT', selectionCount: 1 });
  });
});

describe('reads', () => {
  it('copy source returns only the requested settings (V-06-15)', async () => {
    const c = await createCampaign(
      userOf(w),
      w.advertiserId,
      validCampaignWire({
        name: 'Source',
        frequencyCap: { mode: 'LIMITED', maxImpressions: 3, periodCount: 1, period: 'WEEK' },
      }),
    );
    if (!c.ok) throw new Error('setup');
    expect(await getCopySource(userOf(w), c.data.id, ['frequencyCap'])).toEqual({
      frequencyCap: { mode: 'LIMITED', maxImpressions: 3, periodCount: 1, period: 'WEEK' },
    });
    const goal = await getCopySource(userOf(w), c.data.id, ['goal']);
    expect(Object.keys(goal).sort()).toEqual(['goal', 'kpi']);
  });

  it('lists active campaigns by default filter with budget Unknown and empty metrics', async () => {
    const list = await listCampaigns(userOf(w), w.advertiserId, { status: ['ACTIVE'] });
    expect(list.rows.length).toBeGreaterThan(0);
    expect(list.rows.every((r) => r.status === 'ACTIVE')).toBe(true);
    const row = list.rows.find((r) => r.name === 'Diwali awareness')!;
    expect(row.budget).toBeNull();
    expect(row.kpiGoal).toBe('₹50.00 CPM');
    expect(row.kpiActual).toBeNull();
    expect(list.asOf.slice(0, 10)).toBe(SIM_TODAY);
  });

  it('READ_ONLY can read', async () => {
    const list = await listCampaigns(userOf(w, 'READ_ONLY'), w.advertiserId, {});
    expect(list.total).toBeGreaterThan(0);
  });
});
