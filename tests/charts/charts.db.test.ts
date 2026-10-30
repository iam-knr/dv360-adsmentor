// K15..K17: saved column views, chart views (per person, share) and chart data against direct sums (V-11-17).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { chartData } from '@/lib/charts/data';
import { getChartView, saveChartView } from '@/lib/charts/service';
import { STARTERS, type ChartCardSpec } from '@/lib/charts/spec';
import { deleteView, listViews, saveView } from '@/lib/views/service';
import { dropWorld } from '../db/helpers';
import { createLiWorld, userFor, type World } from '../services/line-items/helpers';

let w: World;
let ioPublic: string;
let other: ReturnType<typeof userFor>;
const user = () => userFor(w);

beforeAll(async () => {
  w = await createLiWorld('charts');
  const io = await prisma.insertionOrder.findUniqueOrThrow({ where: { id: w.ioId } });
  ioPublic = io.publicId.toString();
  const second = await prisma.user.create({ data: { email: `second-${w.tag}@example.test`, name: 'Second', ownerAdminId: w.ownerId } });
  other = { ...userFor(w), id: second.id, email: second.email };
  await prisma.simDailyMetric.deleteMany({ where: { lineItemId: w.lineItemId } });
  for (let d = 1; d <= 3; d++)
    await prisma.simDailyMetric.create({
      data: {
        sandboxId: w.sandboxId, classroomId: w.classroomId, lineItemId: w.lineItemId,
        simDate: new Date(`2026-01-0${d}T00:00:00Z`), impressions: 1000 * d, clicks: 10 * d, revenue: 5 * d, totalMediaCost: 4 * d,
      },
    });
});
afterAll(async () => {
  await dropWorld(w);
  await prisma.$disconnect();
});

describe('column views (AC-11-24)', () => {
  it('saves, renames, rejects duplicates and deletes', async () => {
    const a = await saveView(user(), 'LI', w.advertiserId, { name: 'Mine', columns: ['name', 'budget', 'bogus'] });
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.data.columns).toEqual(['name', 'budget']);
    expect((await saveView(user(), 'LI', w.advertiserId, { name: 'mine', columns: ['name'] })).ok).toBe(false);
    const renamed = await saveView(user(), 'LI', w.advertiserId, { id: a.data.id, name: 'Renamed', columns: ['name'] });
    expect(renamed.ok).toBe(true);
    expect((await listViews(user(), 'LI', w.advertiserId)).map((v) => v.name)).toEqual(['Renamed']);
    expect((await listViews(other, 'LI', w.advertiserId))).toEqual([]);
    expect((await deleteView(user(), a.data.id)).ok).toBe(true);
    expect(await listViews(user(), 'LI', w.advertiserId)).toEqual([]);
  });
});

describe('chart views (AC-11-22)', () => {
  const cards = (): ChartCardSpec[] => STARTERS.slice(0, 2).map((s, i) => ({ ...s.make(), id: `c${i}`, ordinal: i }));

  it('saves per person, keeps order, and replaces on the next save', async () => {
    expect((await saveChartView(user(), 'IO', ioPublic, cards())).ok).toBe(true);
    let view = await getChartView(user(), 'IO', ioPublic);
    expect(view.cards.map((c) => c.title)).toEqual(['Daily Revenue Trend', 'CTR Trend']);
    expect((await getChartView(other, 'IO', ioPublic)).cards).toEqual([]);
    await saveChartView(user(), 'IO', ioPublic, cards().slice(1));
    view = await getChartView(user(), 'IO', ioPublic);
    expect(view.cards).toHaveLength(1);
  });

  it('a shared view opens read only for another person in the sandbox', async () => {
    await saveChartView(user(), 'IO', ioPublic, cards(), { viewKey: 'shared1', share: true });
    const seen = await getChartView(other, 'IO', ioPublic, { viewKey: 'shared1', viewOwner: user().id });
    expect(seen.readOnly).toBe(true);
    expect(seen.cards).toHaveLength(2);
    const unshared = await getChartView(other, 'IO', ioPublic, { viewKey: 'default', viewOwner: user().id });
    expect(unshared.cards).toEqual([]);
  });

  it('rejects a note over 500 characters', async () => {
    const note: ChartCardSpec = { id: 'n', kind: 'NOTE', title: 'Note', ordinal: 0, note: 'x'.repeat(501) };
    expect((await saveChartView(user(), 'IO', ioPublic, [note])).ok).toBe(false);
  });
});

describe('chart data (V-11-17)', () => {
  it('sums by day and derives ratios like the direct SQL', async () => {
    const res = await chartData(user(), { scope: 'IO', scopeId: ioPublic, spec: { ...STARTERS[0]!.make(), id: 'x', ordinal: 0 } });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.series[0]!.points).toEqual([{ x: '2026-01-01', y: 5 }, { x: '2026-01-02', y: 10 }, { x: '2026-01-03', y: 15 }]);
    const ctr = await chartData(user(), { scope: 'LI', scopeId: (await prisma.lineItem.findUniqueOrThrow({ where: { id: w.lineItemId } })).publicId.toString(), spec: { ...STARTERS[1]!.make(), id: 'y', ordinal: 0 } });
    if (!ctr.ok) throw new Error('ctr');
    expect(ctr.data.unit).toBe('%');
    expect(ctr.data.series[0]!.points.every((p) => p.y === 1)).toBe(true);
    const [{ sum }] = await prisma.$queryRaw<{ sum: number }[]>`SELECT SUM(revenue)::float AS sum FROM "SimDailyMetric" WHERE "lineItemId" = ${w.lineItemId}`;
    expect(sum).toBe(30);
  });

  it('bubble and top N shapes', async () => {
    const bubble = await chartData(user(), { scope: 'IO', scopeId: ioPublic, spec: { ...STARTERS[3]!.make(), id: 'b', ordinal: 0 } });
    if (!bubble.ok) throw new Error('bubble');
    expect(bubble.data.series[0]!.points[0]).toMatchObject({ x: 60, y: 1, size: 30 });
    const top = await chartData(user(), { scope: 'IO', scopeId: ioPublic, spec: { id: 't', ordinal: 0, kind: 'BAR', title: 't', metrics: { y: 'CLICKS' }, dimension: 'LINE_ITEM', topN: { by: 'REVENUE', n: 1, entity: 'LINE_ITEM' } } });
    if (!top.ok) throw new Error('top');
    expect(top.data.series[0]!.points).toHaveLength(1);
  });
});
