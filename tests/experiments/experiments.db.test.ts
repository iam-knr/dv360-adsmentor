// Experiment services against the database (module 17 6: AC 2, 3, 6 to 11, 17, 18, report maths, lift lifecycle).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma, withBypass } from '@/lib/db';
import {
  createAbTest,
  endAbTest,
  getAbDifferences,
  getAbReport,
  getAbTest,
  listAbTests,
  listExperimentCandidates,
  updateAbTest,
} from '@/lib/experiments/ab-service';
import { advanceExperiments, experimentSupplyShares } from '@/lib/experiments/advance';
import { engineParams } from './helpers';
import type { AbTestInput } from '@/lib/experiments/types';
import { dropWorld } from '../db/helpers';
import { createCreativeWorld, setSimHours, userFor } from '../creatives/helpers';

type W = Awaited<ReturnType<typeof createCreativeWorld>>;
let w: W;
const user = (role: Parameters<typeof userFor>[1] = 'STANDARD') => userFor(w, role);
const aid = () => w.advertiserId;
const day = (s: string) => new Date(`${s}T00:00:00.000Z`);

const must = <T>(r: { ok: boolean; data?: T }): T => {
  if (!r.ok) throw new Error(`expected ok: ${JSON.stringify(r)}`);
  return r.data as T;
};
const codes = (r: { ok: boolean; issues?: { code: string }[] }): string[] => {
  expect(r.ok).toBe(false);
  return (r.issues ?? []).map((i) => i.code);
};

/** An IO with one display line item and a budget segment; returns both ids. */
async function addIo(name: string, over: { budget?: string; pacing?: 'EVEN' | 'AHEAD'; type?: 'DISPLAY' | 'YT_VIDEO' | 'DEMAND_GEN' } = {}) {
  const io = await prisma.insertionOrder.create({
    data: {
      sandboxId: w.sandboxId,
      campaignId: w.campaignId,
      advertiserId: w.advertiserId,
      name,
      objective: 'CLICKS',
      status: 'ACTIVE',
      pacingType: over.pacing ?? 'EVEN',
    },
  });
  await prisma.budgetSegment.create({
    data: { sandboxId: w.sandboxId, ioId: io.id, amount: over.budget ?? '500', startDate: day('2026-01-01'), endDate: day('2026-03-01') },
  });
  const li = await prisma.lineItem.create({
    data: {
      sandboxId: w.sandboxId,
      ioId: io.id,
      campaignId: w.campaignId,
      advertiserId: w.advertiserId,
      name: `${name} LI`,
      type: over.type ?? 'DISPLAY',
      status: 'ACTIVE',
    },
  });
  return { ioId: io.id, liId: li.id, publicId: io.publicId.toString() };
}

async function metrics(liId: string, from: string, days: number, m: { impressions: number; clicks: number; conv?: number; cost?: number }) {
  for (let d = 0; d < days; d++) {
    const date = new Date(day(from).getTime() + d * 86_400_000);
    await prisma.simDailyMetric.create({
      data: {
        sandboxId: w.sandboxId,
        classroomId: w.classroomId,
        lineItemId: liId,
        simDate: date,
        impressions: BigInt(m.impressions),
        billableImpressions: BigInt(m.impressions),
        clicks: BigInt(m.clicks),
        convTotal: m.conv ?? 0,
        mediaCost: m.cost ?? 100,
        totalMediaCost: m.cost ?? 100,
        revenue: m.cost ?? 100,
      },
    });
  }
}

const input = (over: Partial<AbTestInput> & { a: string; b: string }): AbTestInput => {
  const { a, b, ...rest } = over;
  return {
    name: 'Bid test',
    startDate: '2026-01-01',
    target: 'INSERTION_ORDER',
    goal: 'CLICKS',
    confidence: 'P90',
    excludeUnidentifiedUsers: false,
    arms: [
      { name: 'Arm 1', splitPct: 50, isControl: true, entityIds: [a] },
      { name: 'Arm 2', splitPct: 50, isControl: false, entityIds: [b] },
    ],
    ...rest,
  };
};

beforeAll(async () => {
  w = await createCreativeWorld('exp');
  // sim today is 2026-01-01 (Asia/Calcutta) at tick 0
});
afterAll(async () => {
  await dropWorld(w);
});

describe('createAbTest', () => {
  it('rejects the forms of AC 2 with the rule ids', async () => {
    const a = await addIo('V-A');
    const b = await addIo('V-B');
    expect(codes(await createAbTest(user(), aid(), input({ a: a.ioId, b: b.ioId, name: '' })))).toContain('AB-001');
    const one = input({ a: a.ioId, b: b.ioId, arms: [{ name: 'A', splitPct: 100, isControl: true, entityIds: [a.ioId] }] });
    expect(codes(await createAbTest(user(), aid(), one))).toContain('AB-008');
    const zero = input({ a: a.ioId, b: b.ioId, arms: [{ name: 'A', splitPct: 100, isControl: true, entityIds: [a.ioId] }, { name: 'B', splitPct: 0, isControl: false, entityIds: [b.ioId] }] });
    expect(codes(await createAbTest(user(), aid(), zero))).toContain('AB-011');
    const sixty = input({ a: a.ioId, b: b.ioId, arms: [{ name: 'A', splitPct: 60, isControl: true, entityIds: [a.ioId] }, { name: 'B', splitPct: 30, isControl: false, entityIds: [b.ioId] }] });
    expect(codes(await createAbTest(user(), aid(), sixty))).toContain('AB-012');
    const noControl = input({ a: a.ioId, b: b.ioId });
    noControl.arms = noControl.arms.map((x) => ({ ...x, isControl: false }));
    expect(codes(await createAbTest(user(), aid(), noControl))).toContain('AB-013');
    const empty = input({ a: a.ioId, b: b.ioId });
    empty.arms[1] = { ...empty.arms[1]!, entityIds: [] };
    expect(codes(await createAbTest(user(), aid(), empty))).toContain('AB-014');
    const dup = input({ a: a.ioId, b: a.ioId });
    expect(codes(await createAbTest(user(), aid(), dup))).toContain('AB-015');
    const mixed = input({ a: a.ioId, b: b.liId });
    expect(codes(await createAbTest(user(), aid(), mixed))).toContain('AB-021');
  });

  it('a start date today is Active, a future start is Scheduled; History logs EXPERIMENT (AC 6, 18)', async () => {
    const a = await addIo('S-A');
    const b = await addIo('S-B');
    const c = await addIo('S-C');
    const d = await addIo('S-D');
    const active = must(await createAbTest(user(), aid(), input({ a: a.ioId, b: b.ioId, name: 'Active now' })));
    expect(active.status).toBe('ACTIVE');
    const later = must(await createAbTest(user(), aid(), input({ a: c.ioId, b: d.ioId, name: 'Starts later', startDate: '2026-01-05' })));
    expect(later.status).toBe('SCHEDULED');
    const groups = await prisma.changeGroup.findMany({ where: { sandboxId: w.sandboxId, entityType: 'EXPERIMENT', entityId: active.id } });
    expect(groups.length).toBeGreaterThanOrEqual(1);
    const list = await listAbTests(user(), aid());
    expect(list.rows.find((r) => r.id === active.id)?.arms).toBe(2);
    expect(list.canWrite).toBe(true);
    // AB-026: the IO is in another active test
    const dup = await createAbTest(user(), aid(), input({ a: a.ioId, b: d.ioId, name: 'Overlap' }));
    expect(codes(dup)).toContain('AB-026');
    // AB-028: a start in the past
    expect(codes(await createAbTest(user(), aid(), input({ a: c.ioId, b: d.ioId, name: 'Past', startDate: '2025-12-30' })))).toContain('AB-028');
  });

  it('AB-023 is a warning that still lets the IO be chosen', async () => {
    const a = await addIo('W-A', { budget: '100' });
    const b = await addIo('W-B');
    await prisma.lineItem.update({ where: { id: a.liId }, data: { budgetMode: 'FIXED', budgetAmount: '900' } });
    const cands = await listExperimentCandidates(user(), aid(), { compare: 'INSERTION_ORDERS' });
    expect(cands.find((c) => c.id === a.ioId)?.warning).toBe('The total budget of all line items is greater than the insertion order budget.');
    const r = await createAbTest(user(), aid(), input({ a: a.ioId, b: b.ioId, name: 'Warned' }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings?.map((x) => x.code)).toContain('AB-023');
  });

  it('read-only roles cannot create (AC 1) and a foreign id is a 404 (AC 17)', async () => {
    const a = await addIo('R-A');
    const b = await addIo('R-B');
    const res = await createAbTest(user('READ_ONLY'), aid(), input({ a: a.ioId, b: b.ioId, name: 'ro' }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('FORBIDDEN');
    const list = await listAbTests(user('READ_ONLY'), aid());
    expect(list.canWrite).toBe(false);
    await expect(getAbTest(user(), aid(), 'cmissingmissingmissing00')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(getAbTest(user(), aid(), '999999999')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('report (AC 7, 8)', () => {
  it('per-arm impressions equal the sum of the entities metrics; Best is N/A without a significant difference', async () => {
    const a = await addIo('Rp-A');
    const b = await addIo('Rp-B');
    await metrics(a.liId, '2026-01-01', 7, { impressions: 10_000, clicks: 100, cost: 50 });
    await metrics(b.liId, '2026-01-01', 7, { impressions: 10_000, clicks: 101, cost: 50 });
    const t = must(await createAbTest(user(), aid(), input({ a: a.ioId, b: b.ioId, name: 'Report test', startDate: '2026-01-01' })));
    await setSimHours(w, 24 * 6 + 12); // 2026-01-07 in the advertiser time zone
    const report = await getAbReport(user(), aid(), t.publicId);
    const imp = report.tiles.find((x) => x.key === 'ctr');
    expect(report.perArm.map((x) => x.counters.impressions)).toEqual([70_000, 70_000]);
    expect(imp?.best).toBe('N/A');
    expect(report.best).toBe('N/A');
    expect(report.hasData).toBe(true);
    expect(report.series[0]?.points.length).toBeGreaterThan(0);
    const impTile = (await getAbReport(user(), aid(), t.publicId, { metric: 'IMPRESSIONS' })).tiles[0];
    expect(impTile?.arms.map((x) => x.value)).toEqual([70_000, 70_000]);
    await setSimHours(w, 0);
  });

  it('names a best arm for a clear effect and flips with the confidence level', async () => {
    const a = await addIo('Bst-A');
    const b = await addIo('Bst-B');
    await metrics(a.liId, '2026-01-01', 7, { impressions: 20_000, clicks: 200 });
    await metrics(b.liId, '2026-01-01', 7, { impressions: 20_000, clicks: 260 });
    const t = must(await createAbTest(user(), aid(), input({ a: a.ioId, b: b.ioId, name: 'Best test' })));
    const r90 = await getAbReport(user(), aid(), t.publicId, { confidence: 'P90' });
    expect(r90.best).toMatchObject({ name: 'Arm 2' });
    // the same data at a stricter level and a smaller difference: no best arm
    const c = await addIo('Bst-C');
    const d = await addIo('Bst-D');
    await metrics(c.liId, '2026-01-01', 7, { impressions: 20_000, clicks: 200 });
    await metrics(d.liId, '2026-01-01', 7, { impressions: 20_000, clicks: 215 });
    const t2 = must(await createAbTest(user(), aid(), input({ a: c.ioId, b: d.ioId, name: 'Flip test' })));
    const lo = await getAbReport(user(), aid(), t2.publicId, { confidence: 'P90' });
    const hi = await getAbReport(user(), aid(), t2.publicId, { confidence: 'P95' });
    expect(lo.significance[lo.perArm[1]!.armId]?.z).toBeCloseTo(hi.significance[hi.perArm[1]!.armId]?.z ?? 0, 6);
    const z = Math.abs(lo.significance[lo.perArm[1]!.armId]?.z ?? 0);
    const z2 = engineParams().experiments.zCritical;
    expect(z > (z2['0.90'] as number)).toBe(lo.best !== 'N/A');
    expect(z > (z2['0.95'] as number)).toBe(hi.best !== 'N/A');
  });

  it('a test that has not started says so', async () => {
    const a = await addIo('Ns-A');
    const b = await addIo('Ns-B');
    const t = must(await createAbTest(user(), aid(), input({ a: a.ioId, b: b.ioId, name: 'Future', startDate: '2026-01-20' })));
    const r = await getAbReport(user(), aid(), t.publicId);
    expect(r.notStartedUntil).toBe('2026-01-20');
    expect(r.hasData).toBe(false);
  });
});

describe('locks, End and the engine steps (AC 9, 11)', () => {
  it('after the start only name, hypothesis and end date save; forged arm and date changes fail', async () => {
    const a = await addIo('L-A');
    const b = await addIo('L-B');
    const t = must(await createAbTest(user(), aid(), input({ a: a.ioId, b: b.ioId, name: 'Locked test' })));
    const v = await getAbTest(user(), aid(), t.publicId);
    expect(v.locked).toEqual({ dates: true, arms: true });
    const base: AbTestInput = {
      name: 'Renamed',
      hypothesis: 'New idea',
      startDate: v.startDate,
      endDate: '2026-02-10',
      target: v.target,
      goal: v.goal,
      confidence: v.confidence,
      excludeUnidentifiedUsers: false,
      arms: v.arms.map((x) => ({ id: x.id, name: x.name, splitPct: x.splitPct, isControl: x.isControl, entityIds: x.entities.map((e) => e.id) })),
      version: v.version,
    };
    const saved = must(await updateAbTest(user(), aid(), t.publicId, base));
    expect(saved.view.name).toBe('Renamed');
    expect(saved.view.endDate).toBe('2026-02-10');
    expect(saved.view.version).toBe(v.version + 1);
    const forgedDates = await updateAbTest(user(), aid(), t.publicId, { ...base, startDate: '2026-01-03', version: saved.view.version });
    expect(codes(forgedDates)).toContain('AB-006');
    const forgedSplit = await updateAbTest(user(), aid(), t.publicId, {
      ...base,
      version: saved.view.version,
      arms: base.arms.map((x, i) => ({ ...x, splitPct: i === 0 ? 70 : 30 })),
    });
    expect(codes(forgedSplit)).toContain('AB-024');
    const stale = await updateAbTest(user(), aid(), t.publicId, { ...base, version: 1 });
    expect(codes(stale)).toContain('CONFLICT');
  });

  it('a scheduled test stays editable and becomes active at its start date (engine step)', async () => {
    const a = await addIo('E-A');
    const b = await addIo('E-B');
    const t = must(await createAbTest(user(), aid(), input({ a: a.ioId, b: b.ioId, name: 'Starts day 3', startDate: '2026-01-03', endDate: '2026-01-05' })));
    const v = await getAbTest(user(), aid(), t.publicId);
    expect(v.status).toBe('SCHEDULED');
    expect(v.locked.arms).toBe(false);
    const tick = (hours: number) =>
      withBypass((tx) => advanceExperiments(tx, w.sandboxId, w.advertiserId, Date.UTC(2026, 0, 1) + hours * 3_600_000));
    await tick(24); // 2026-01-02
    expect((await getAbTest(user(), aid(), t.publicId)).status).toBe('SCHEDULED');
    await tick(24 * 2 + 1); // 2026-01-03
    expect((await getAbTest(user(), aid(), t.publicId)).status).toBe('ACTIVE');
    await tick(24 * 5 + 1); // 2026-01-06, after the end date
    const done = await getAbTest(user(), aid(), t.publicId);
    expect(done.status).toBe('COMPLETED');
    expect(done.endedAt).not.toBeNull();
  });

  it('End: Completed, End again refused, supply share returns to 100% (AC 11)', async () => {
    const a = await addIo('End-A');
    const b = await addIo('End-B');
    const t = must(await createAbTest(user(), aid(), input({ a: a.ioId, b: b.ioId, name: 'To end' })));
    const p = engineParams().experiments;
    const running = await withBypass((tx) => experimentSupplyShares(tx, w.sandboxId, w.advertiserId, p));
    expect(running.get(a.liId)).toBeCloseTo(0.5, 6);
    expect(running.get(b.liId)).toBeCloseTo(0.5, 6);
    const ended = must(await endAbTest(user(), aid(), t.publicId));
    expect(ended.status).toBe('COMPLETED');
    expect(codes(await endAbTest(user(), aid(), t.publicId))).toContain('AB-025');
    const after = await withBypass((tx) => experimentSupplyShares(tx, w.sandboxId, w.advertiserId, p));
    expect(after.has(a.liId)).toBe(false);
    expect(after.has(b.liId)).toBe(false);
    const view = await getAbTest(user(), aid(), t.publicId);
    expect(view.canEdit).toBe(false);
    const edit = await updateAbTest(user(), aid(), t.publicId, { ...input({ a: a.ioId, b: b.ioId }), version: view.version });
    expect(edit.ok).toBe(false);
  });

  it('supply shares follow the split, the contamination share and "exclude unidentified users"', async () => {
    const a = await addIo('Sh-A');
    const b = await addIo('Sh-B');
    const t = must(
      await createAbTest(user(), aid(), input({ a: a.ioId, b: b.ioId, name: 'Uneven', arms: [
        { name: 'Arm 1', splitPct: 70, isControl: true, entityIds: [a.ioId] },
        { name: 'Arm 2', splitPct: 30, isControl: false, entityIds: [b.ioId] },
      ] })),
    );
    const p = engineParams().experiments;
    const shares = await withBypass((tx) => experimentSupplyShares(tx, w.sandboxId, w.advertiserId, p));
    expect(shares.get(a.liId)).toBeCloseTo(0.7 * (1 - p.contaminationShare) + 0.3 * p.contaminationShare, 6);
    expect(shares.get(b.liId)).toBeCloseTo(0.3 * (1 - p.contaminationShare) + 0.7 * p.contaminationShare, 6);
    must(await endAbTest(user(), aid(), t.publicId));
    const c = await addIo('Sh-C');
    const d = await addIo('Sh-D');
    must(await createAbTest(user(), aid(), input({ a: c.ioId, b: d.ioId, name: 'Exclude', excludeUnidentifiedUsers: true })));
    const ex = await withBypass((tx) => experimentSupplyShares(tx, w.sandboxId, w.advertiserId, p));
    expect(ex.get(c.liId)).toBeCloseTo(0.5 * p.identifiedOnlyShare, 6);
  });
});

describe('differences (AC 10)', () => {
  it('lists exactly the settings that differ; identical arms say No results', async () => {
    const a = await addIo('D-A', { pacing: 'EVEN', budget: '500' });
    const b = await addIo('D-B', { pacing: 'AHEAD', budget: '800' });
    const same = await addIo('D-C', { pacing: 'EVEN', budget: '500' });
    const t = must(await createAbTest(user(), aid(), input({ a: a.ioId, b: b.ioId, name: 'Diff test' })));
    const diff = await getAbDifferences(user(), aid(), t.publicId);
    const names = diff.rows.map((r) => r.setting);
    expect(names).toContain('Insertion order 1: Budget');
    expect(names).toContain('Insertion order 1: Pacing');
    expect(diff.rows.find((r) => r.setting === 'Insertion order 1: Budget')).toMatchObject({ control: '500', variant: '800' });
    expect(names.filter((s) => s.startsWith('Insertion order'))).toHaveLength(2);
    must(await endAbTest(user(), aid(), t.publicId));
    const c = await addIo('D-D', { pacing: 'EVEN', budget: '500' });
    const t2 = must(await createAbTest(user(), aid(), input({ a: same.ioId, b: c.ioId, name: 'Same test' })));
    expect((await getAbDifferences(user(), aid(), t2.publicId)).rows).toEqual([]);
  });
});
