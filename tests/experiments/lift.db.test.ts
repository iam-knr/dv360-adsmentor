// Lift studies against the database (module 17 6: AC 12 to 16, 18) and the experiment seed.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma, withBypass } from '@/lib/db';
import { advanceLiftStudies } from '@/lib/experiments/advance';
import {
  addLiftFlight,
  createLiftStudy,
  endLiftStudy,
  getLiftReport,
  getLiftStudy,
  liftEligibility,
  listEligibleIos,
  listLiftStudies,
  updateLiftStudy,
} from '@/lib/experiments/lift-service';
import { seedExperiments } from '@/lib/experiments/seed';
import type { BrandLiftInput, LiftStudyInput } from '@/lib/experiments/types';
import { dropWorld } from '../db/helpers';
import { createCreativeWorld, setSimHours, userFor } from '../creatives/helpers';

type W = Awaited<ReturnType<typeof createCreativeWorld>>;
let w: W;
const user = (role: Parameters<typeof userFor>[1] = 'STANDARD') => userFor(w, role);
const aid = () => w.advertiserId;
const day = (s: string) => new Date(`${s}T00:00:00.000Z`);
const addDays = (s: string, n: number) => new Date(day(s).getTime() + n * 86_400_000).toISOString().slice(0, 10);

const must = <T>(r: { ok: boolean; data?: T }): T => {
  if (!r.ok) throw new Error(`expected ok: ${JSON.stringify(r)}`);
  return r.data as T;
};
const codes = (r: { ok: boolean; issues?: { code: string }[] }): string[] => {
  expect(r.ok).toBe(false);
  return (r.issues ?? []).map((i) => i.code);
};

async function addIo(name: string, types: ('DISPLAY' | 'YT_VIDEO' | 'CTV' | 'VIDEO')[] = ['DISPLAY']) {
  const io = await prisma.insertionOrder.create({
    data: { sandboxId: w.sandboxId, campaignId: w.campaignId, advertiserId: w.advertiserId, name, objective: 'CLICKS', status: 'ACTIVE' },
  });
  const liIds: string[] = [];
  for (const [i, type] of types.entries()) {
    const li = await prisma.lineItem.create({
      data: { sandboxId: w.sandboxId, ioId: io.id, campaignId: w.campaignId, advertiserId: w.advertiserId, name: `${name} LI ${i + 1}`, type, status: 'ACTIVE' },
    });
    liIds.push(li.id);
  }
  return { ioId: io.id, publicId: io.publicId.toString(), liIds };
}

async function spend(liId: string, from: string, days: number, perDay: number, impressions = 40_000) {
  for (let d = 0; d < days; d++) {
    await prisma.simDailyMetric.create({
      data: {
        sandboxId: w.sandboxId,
        classroomId: w.classroomId,
        lineItemId: liId,
        simDate: day(addDays(from, d)),
        impressions: BigInt(impressions),
        billableImpressions: BigInt(impressions),
        clicks: BigInt(Math.round(impressions / 100)),
        viewableImpressions: BigInt(Math.round(impressions * 0.6)),
        measurableImpressions: BigInt(Math.round(impressions * 0.9)),
        mediaCost: perDay,
        totalMediaCost: perDay,
        revenue: perDay,
      },
    });
  }
}

const brand = (over: Partial<BrandLiftInput> = {}): BrandLiftInput => ({
  metrics: ['AWARENESS', 'VIDEO_AD_RECALL'],
  brandName: 'Demo brand',
  competitors: ['Rival one'],
  language: 'en-US',
  objectType: 'Brand',
  intendedAction: null,
  ...over,
});
const study = (ioIds: string[], over: Partial<LiftStudyInput> = {}): LiftStudyInput => ({
  name: 'Lift study',
  ioIds,
  ioGroup: 'OTHER',
  liftTypes: ['BRAND_LIFT'],
  brandLift: brand(),
  strength: 'STANDARD',
  searchGroups: [],
  ...over,
});

beforeAll(async () => {
  w = await createCreativeWorld('lift');
});
afterAll(async () => {
  await dropWorld(w);
});

describe('eligible insertion orders and the requirement (AC 12, 13)', () => {
  it('lists IOs by group and "show only eligible"', async () => {
    const ok = await addIo('Elig display', ['DISPLAY']);
    const none = await addIo('Elig ctv', ['CTV']);
    const only = await listEligibleIos(user(), aid(), { group: 'OTHER', onlyEligible: true });
    expect(only.map((r) => r.id)).toContain(ok.ioId);
    expect(only.map((r) => r.id)).not.toContain(none.ioId);
    const all = await listEligibleIos(user(), aid(), { group: 'OTHER', onlyEligible: false });
    expect(all.find((r) => r.id === none.ioId)?.eligible).toBe(false);
    expect(await listEligibleIos(user(), aid(), { group: 'YOUTUBE_PG', onlyEligible: false })).toEqual([]);
    expect((await listEligibleIos(user(), aid(), { group: 'OTHER', onlyEligible: true, q: 'display' })).length).toBeGreaterThan(0);
  });

  it('the requirement is 470,000 (brand) and 600,000 (search); enhanced triples; your cost follows the spend', async () => {
    const a = await addIo('Req', ['DISPLAY', 'YT_VIDEO']);
    await spend(a.liIds[0]!, '2025-12-23', 10, 30_000); // 300,000 in the 10 day window
    const r = await liftEligibility(user(), aid(), { ioIds: [a.ioId], types: ['BRAND_LIFT', 'SEARCH_LIFT'], strength: 'STANDARD' });
    const b = r.perType.find((p) => p.type === 'BRAND_LIFT')!;
    const s = r.perType.find((p) => p.type === 'SEARCH_LIFT')!;
    expect(b.requiredMediaCost).toBe(470_000);
    expect(s.requiredMediaCost).toBe(600_000);
    expect(b.yourMediaCost).toBe(300_000);
    expect(b.eligible).toBe(false);
    expect(b.measurableLis).toBe(2);
    expect(s.measurableLis).toBe(1);
    expect(b.window).toEqual(['2026-01-01', '2026-01-10']);
    expect(s.window[1]).toBe('2026-01-28');
    expect(r.allMeasurableYoutube).toBe(false);
    const e = await liftEligibility(user(), aid(), { ioIds: [a.ioId], types: ['BRAND_LIFT'], strength: 'ENHANCED' });
    expect(e.perType[0]?.requiredMediaCost).toBe(1_410_000);
    await spend(a.liIds[0]!, '2025-12-13', 10, 30_000); // outside the window
    const again = await liftEligibility(user(), aid(), { ioIds: [a.ioId], types: ['BRAND_LIFT'], strength: 'STANDARD' });
    expect(again.perType[0]?.yourMediaCost).toBe(300_000);
  });
});

describe('createLiftStudy', () => {
  it('returns the LS messages for the forms of AC 12', async () => {
    const a = await addIo('V1', ['DISPLAY']);
    expect(codes(await createLiftStudy(user(), aid(), study([], { liftTypes: [] })))).toContain('LS-003');
    expect(codes(await createLiftStudy(user(), aid(), study([a.ioId], { name: '' })))).toContain('LS-001');
    expect(codes(await createLiftStudy(user(), aid(), study([a.ioId], { brandLift: brand({ metrics: ['AWARENESS', 'CONSIDERATION', 'FAVORABILITY', 'ASSOCIATION'] }) })))).toContain('LS-006');
    expect(codes(await createLiftStudy(user(), aid(), study([a.ioId], { brandLift: brand({ metrics: ['PURCHASE_INTENT'] }) })))).toContain('LS-011');
    expect(codes(await createLiftStudy(user(), aid(), study([a.ioId], { brandLift: brand({ brandName: 'x'.repeat(31) }) })))).toContain('LS-007');
    expect(codes(await createLiftStudy(user(), aid(), study([a.ioId], { liftTypes: ['SEARCH_LIFT'], searchGroups: Array.from({ length: 6 }, () => ['a']) })))).toContain('LS-013');
    expect(codes(await createLiftStudy(user(), aid(), study([a.ioId], { strength: 'ENHANCED' })))).toContain('LS-012');
    // Display line items cannot be measured by search lift
    expect(codes(await createLiftStudy(user(), aid(), study([a.ioId], { liftTypes: ['SEARCH_LIFT'], searchGroups: [['a']] })))).toContain('LS-005');
    expect((await createLiftStudy(user('READ_ONLY'), aid(), study([a.ioId]))).ok).toBe(false);
  });

  it('a not eligible study is created as Not eligible; Review & fix starts the flight once the spend is there (AC 13)', async () => {
    const a = await addIo('NE', ['DISPLAY']);
    const created = await createLiftStudy(user(), aid(), study([a.ioId], { name: 'Needs fixing' }));
    const data = must(created);
    expect(data.flights).toEqual([{ type: 'BRAND_LIFT', flightNo: 1, status: 'NOT_ELIGIBLE' }]);
    expect(created.ok && created.warnings?.map((x) => x.code)).toContain('LS-014');
    const row = (await listLiftStudies(user(), aid())).rows.find((r) => r.id === data.id)!;
    expect(row.brand?.status).toBe('NOT_ELIGIBLE');
    expect(row.status).toBe('NOT_ELIGIBLE');
    expect(row.hasSearch).toBe(false);
    const view = await getLiftStudy(user(), aid(), data.publicId);
    // the lift types are locked on Review & fix
    const locked = await updateLiftStudy(user(), aid(), data.publicId, { ...study([a.ioId], { name: 'Needs fixing', liftTypes: ['BRAND_LIFT', 'SEARCH_LIFT'], searchGroups: [['a']] }), version: view.version });
    expect(codes(locked)).toContain('LS-015');
    await spend(a.liIds[0]!, '2025-12-23', 10, 60_000);
    const fixed = must(await updateLiftStudy(user(), aid(), data.publicId, { ...study([a.ioId], { name: 'Fixed study' }), version: view.version }));
    expect(fixed.status).toBe('IN_PROGRESS');
    const after = await getLiftStudy(user(), aid(), data.publicId);
    expect(after.name).toBe('Fixed study');
    expect(after.flights[0]?.status).toBe('IN_PROGRESS');
    expect((await updateLiftStudy(user(), aid(), data.publicId, { ...study([a.ioId]), version: 1 })).ok).toBe(false);
  });

  it('writes History entries with entity type LIFT_STUDY (AC 18)', async () => {
    const a = await addIo('Hist', ['DISPLAY']);
    await spend(a.liIds[0]!, '2025-12-23', 10, 60_000);
    const created = must(await createLiftStudy(user(), aid(), study([a.ioId], { name: 'Logged' })));
    const groups = await prisma.changeGroup.findMany({ where: { sandboxId: w.sandboxId, entityType: 'LIFT_STUDY', entityId: created.id } });
    expect(groups.length).toBeGreaterThanOrEqual(1);
  });
});

describe('flight lifecycle, report, Add flight and End (AC 14 to 16)', () => {
  let studyId = '';
  let ioId = '';
  let liIds: string[] = [];
  const advance = (hours: number) =>
    withBypass((tx) => advanceLiftStudies(tx, w.sandboxId, w.advertiserId, Date.UTC(2026, 0, 1) + hours * 3_600_000));

  it('progress rises with spend and the flight completes at 100%', async () => {
    const a = await addIo('Life', ['DISPLAY', 'DISPLAY', 'DISPLAY']);
    ioId = a.ioId;
    liIds = a.liIds;
    await spend(a.liIds[0]!, '2025-12-22', 10, 70_000); // eligible: 630,000 in the 10 day window, none from the flight day on
    await spend(a.liIds[2]!, '2025-12-22', 10, 100);
    const c = must(await createLiftStudy(user(), aid(), study([a.ioId], { name: 'Life study', brandLift: brand({ metrics: ['AWARENESS', 'PURCHASE_INTENT'], intendedAction: 'BUY' }) })));
    studyId = c.publicId;
    expect(c.flights[0]?.status).toBe('IN_PROGRESS');
    // nothing was spent since the flight began
    await advance(12);
    let f = (await listLiftStudies(user(), aid())).rows.find((r) => r.id === c.id)!.brand!;
    expect(f.pctComplete).toBe(0);
    await spend(a.liIds[0]!, '2026-01-01', 1, 188_000);
    await advance(30);
    f = (await listLiftStudies(user(), aid())).rows.find((r) => r.id === c.id)!.brand!;
    expect(f.status).toBe('IN_PROGRESS');
    expect(f.pctComplete).toBe(40);
    expect(f.mediaCostSoFar).toBe(188_000);
    // a 25% milestone wrote results
    expect(await prisma.liftResult.count({ where: { sandboxId: w.sandboxId, flight: { study: { id: c.id } } } })).toBeGreaterThan(0);
    await spend(a.liIds[0]!, '2026-01-02', 1, 400_000);
    await spend(a.liIds[2]!, '2026-01-02', 1, 30);
    await advance(54);
    f = (await listLiftStudies(user(), aid())).rows.find((r) => r.id === c.id)!.brand!;
    expect(f.status).toBe('COMPLETE');
    expect(f.pctComplete).toBe(100);
    expect((await getLiftStudy(user(), aid(), studyId)).status).toBe('COMPLETE');
  });

  it('the report has absolute, relative and headroom lift, intervals and slices (AC 15)', async () => {
    const base = await getLiftReport(user(), aid(), studyId, { tab: 'CROSS_EXCHANGE', liftType: 'ABSOLUTE', slice: 'OVERALL' });
    expect(base.empty).toBe(false);
    expect(base.metrics.map((m) => m.metric).sort()).toEqual(['AWARENESS', 'PURCHASE_INTENT']);
    const m = base.metrics.find((x) => x.metric === 'AWARENESS')!;
    expect(m.exposedRate! - m.baselineRate!).toBeCloseTo(m.absoluteLift!, 4);
    expect(m.relativeLift).toBeCloseTo(m.absoluteLift! / m.baselineRate!, 3);
    expect(m.headroomLift).toBeCloseTo(m.absoluteLift! / (1 - m.baselineRate!), 3);
    expect(m.ci![0]).toBeLessThan(m.absoluteLift!);
    expect(m.ci![1]).toBeGreaterThan(m.absoluteLift!);
    expect(base.surveyResponses).toBeGreaterThan(1000);
    const rel = await getLiftReport(user(), aid(), studyId, { tab: 'CROSS_EXCHANGE', liftType: 'RELATIVE', slice: 'OVERALL' });
    const relM = rel.metrics.find((x) => x.metric === 'AWARENESS')!;
    expect(relM.ci![1] - relM.ci![0]).toBeGreaterThan(m.ci![1] - m.ci![0]); // relative lift scales the interval
    const age = await getLiftReport(user(), aid(), studyId, { tab: 'CROSS_EXCHANGE', liftType: 'ABSOLUTE', slice: 'AGE' });
    expect(age.metrics[0]?.slices.map((s) => s.value)).toEqual(['18-24', '25-34', '35-44', '45-54', '55-64', '65+']);
    const li = await getLiftReport(user(), aid(), studyId, { tab: 'CROSS_EXCHANGE', slice: 'LINE_ITEM' });
    const slices = li.metrics[0]!.slices;
    const tiny = slices.find((s) => s.value === 'Life LI 3');
    expect(tiny?.enough).toBe(false);
    expect(tiny?.lift).toBeNull();
    expect(slices.find((s) => s.value === 'Life LI 1')?.enough).toBe(true);
    // nothing runs on YouTube and Demand Gen
    expect((await getLiftReport(user(), aid(), studyId, { tab: 'YT_DG' })).empty).toBe(true);
    expect(base.lineItems).toBe(3);
    void ioId;
    void liIds;
  });

  it('Add flight only after the flight ended; End closes it; End twice is refused (AC 16)', async () => {
    const early = await createLiftStudy(user(), aid(), study([ioId], { name: 'Open flight' }));
    const open = must(early);
    expect(codes(await addLiftFlight(user(), aid(), open.publicId, 'BRAND_LIFT'))).toContain('LS-018');
    must(await endLiftStudy(user(), aid(), open.publicId, 'BRAND_LIFT'));
    expect((await getLiftStudy(user(), aid(), open.publicId)).flights[0]?.status).toBe('ENDED');
    expect(codes(await endLiftStudy(user(), aid(), open.publicId, 'BRAND_LIFT'))).toContain('LS-018');
    const added = must(await addLiftFlight(user(), aid(), open.publicId, 'BRAND_LIFT'));
    expect(added.flightNo).toBe(2);
    // a completed study can get a second flight too
    const done = must(await addLiftFlight(user(), aid(), studyId, 'BRAND_LIFT'));
    expect(done.flightNo).toBe(2);
    expect(codes(await addLiftFlight(user(), aid(), studyId, 'BRAND_LIFT'))).toContain('LS-018');
  });
});

describe('search lift', () => {
  it('a YouTube insertion order gets a search lift flight and uplift per term group', async () => {
    const a = await addIo('Search', ['YT_VIDEO']);
    await spend(a.liIds[0]!, '2025-12-05', 26, 40_000); // 1,040,000 in the 28 day window
    const c = must(await createLiftStudy(user(), aid(), study([a.ioId], { name: 'Search study', liftTypes: ['BRAND_LIFT', 'SEARCH_LIFT'], searchGroups: [['shoes', 'sneakers'], ['running']] })));
    expect(c.flights.map((f) => f.type).sort()).toEqual(['BRAND_LIFT', 'SEARCH_LIFT']);
    await spend(a.liIds[0]!, '2026-01-01', 1, 700_000);
    await setSimHours(w, 24 * 2);
    await withBypass((tx) => advanceLiftStudies(tx, w.sandboxId, w.advertiserId, Date.UTC(2026, 0, 3)));
    const report = await getLiftReport(user(), aid(), c.publicId, { tab: 'YT_DG' });
    expect(report.search?.groups.map((g) => g.terms)).toEqual([['shoes', 'sneakers'], ['running']]);
    expect(report.search?.groups.every((g) => g.relUplift >= 0)).toBe(true);
    await setSimHours(w, 0);
  });
});

describe('seed', () => {
  it('writes two A/B tests and three lift studies per advertiser, none for blank', async () => {
    const before = await prisma.experiment.count({ where: { sandboxId: w.sandboxId } });
    const none = await prisma.$transaction((tx) => seedExperiments(tx, { sandboxId: w.sandboxId, template: 'blank', seedValue: 1, today: '2026-01-01' }));
    expect(none).toBe(0);
    const made = await prisma.$transaction((tx) => seedExperiments(tx, { sandboxId: w.sandboxId, template: 'starter-agency', seedValue: 1, today: '2026-01-01' }), { timeout: 60_000 });
    expect(made).toBe(5);
    expect(await prisma.experiment.count({ where: { sandboxId: w.sandboxId } })).toBe(before + 2);
    const tests = await prisma.experiment.findMany({ where: { sandboxId: w.sandboxId }, orderBy: { createdAt: 'desc' }, take: 2, include: { arms: true } });
    expect(tests.map((t) => t.status).sort()).toEqual(['ACTIVE', 'COMPLETED']);
    for (const t of tests) {
      expect(t.arms).toHaveLength(2);
      expect(t.arms.filter((a) => a.isControl)).toHaveLength(1);
      expect(t.controlArmId).not.toBeNull();
    }
    const studies = await prisma.liftStudy.findMany({ where: { sandboxId: w.sandboxId, name: { in: ['Awareness lift - Always on', 'Consideration lift - Low spend', 'Favorability lift - Launch'] } }, include: { flights: true } });
    expect(studies.flatMap((s) => s.flights.map((f) => f.status)).sort()).toEqual(['COMPLETE', 'IN_PROGRESS', 'NOT_ELIGIBLE']);
    const inProgress = studies.flatMap((s) => s.flights).find((f) => f.status === 'IN_PROGRESS')!;
    expect(inProgress.pctComplete).toBe(40);
  });
});
