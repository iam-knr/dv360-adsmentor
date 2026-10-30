// Experiment seed of module 17 (3.3): per advertiser two A/B tests (one COMPLETED with a significant difference at 90%
// where the data allows, one ACTIVE with none yet) and three lift studies (COMPLETE, NOT_ELIGIBLE, IN_PROGRESS at 40%).
// Relative-style imports only: runs under tsx too. The blank template has none.
import type { BrandLiftMetric, Prisma, PrismaClient } from '@prisma/client';
import { syncStudyStatus } from './advance';
import { sumMetrics, type Db } from './data';
import { inrMultiplier, liftParams, loadStudyLis, writeFlightResults } from './lift-engine';
import { liftRequirement } from './lift-math';
import { proportionZ } from './stats';

type Client = PrismaClient | Prisma.TransactionClient;

const DAY = 86_400_000;
const addDays = (d: string, n: number): string => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const day = (s: string): Date => new Date(`${s}T00:00:00.000Z`);

export interface SeedExperimentsInput {
  sandboxId: string;
  template: string;
  seedValue: number;
  /** Sim today, YYYY-MM-DD. */
  today: string;
}

async function ctrZ(db: Db, a: string[], b: string[], from: string, to: string): Promise<number> {
  const [x, y] = await Promise.all([sumMetrics(db, a, from, to), sumMetrics(db, b, from, to)]);
  return Math.abs(proportionZ(x.clicks, x.impressions, y.clicks, y.impressions) ?? 0);
}

/** Number of tests and studies written. */
export async function seedExperiments(tx: Client, input: SeedExperimentsInput): Promise<number> {
  if (input.template === 'blank') return 0;
  let made = 0;
  const advertisers = await tx.advertiser.findMany({
    where: { sandboxId: input.sandboxId },
    select: { id: true, currencyCode: true },
    orderBy: { publicId: 'asc' },
  });
  for (const adv of advertisers) {
    const ios = await tx.insertionOrder.findMany({
      where: { advertiserId: adv.id, status: { not: 'ARCHIVED' } },
      orderBy: { publicId: 'asc' },
      select: { id: true, name: true, lineItems: { where: { status: { not: 'ARCHIVED' } }, select: { id: true, type: true, name: true }, orderBy: { publicId: 'asc' } } },
    });
    const withLis = ios.filter((io) => io.lineItems.length > 0);
    if (withLis.length < 2) continue;

    // --- completed test on two IOs
    const start1 = addDays(input.today, -34);
    const end1 = addDays(input.today, -5);
    let best: { a: number; b: number; z: number } | null = null;
    const limit = Math.min(withLis.length, 6);
    for (let i = 0; i < limit && !(best && best.z >= 1.645); i++) {
      for (let j = i + 1; j < limit && !(best && best.z >= 1.645); j++) {
        const z = await ctrZ(tx, withLis[i]!.lineItems.map((l) => l.id), withLis[j]!.lineItems.map((l) => l.id), start1, end1);
        if (!best || z > best.z) best = { a: i, b: j, z };
      }
    }
    const pair = best ?? { a: 0, b: 1, z: 0 };
    await makeTest(tx, input, adv.id, {
      name: 'Bid strategy test - Fixed vs automated',
      hypothesis: 'An automated bid strategy will deliver a higher click through rate than a fixed bid.',
      start: start1,
      end: end1,
      target: 'INSERTION_ORDER',
      goal: 'CLICKS',
      status: 'COMPLETED',
      endedAt: day(end1),
      arms: [
        { name: 'Arm 1 (control)', control: true, ids: [withLis[pair.a]!.id] },
        { name: 'Arm 2', control: false, ids: [withLis[pair.b]!.id] },
      ],
    });
    made++;

    // --- active test on two display line items, the pair with the smallest difference so far
    const start2 = addDays(input.today, -5);
    const lis = ios.flatMap((io) => io.lineItems.map((l) => ({ ...l, ioId: io.id }))).filter((l) => l.type === 'DISPLAY');
    if (lis.length >= 2) {
      let quiet: { a: number; b: number; z: number } | null = null;
      const lim = Math.min(lis.length, 6);
      for (let i = 0; i < lim; i++) {
        for (let j = i + 1; j < lim; j++) {
          const z = await ctrZ(tx, [lis[i]!.id], [lis[j]!.id], start2, input.today);
          if (!quiet || z < quiet.z) quiet = { a: i, b: j, z };
        }
      }
      const q = quiet ?? { a: 0, b: 1, z: 0 };
      await makeTest(tx, input, adv.id, {
        name: 'Creative rotation test',
        hypothesis: null,
        start: start2,
        end: null,
        target: 'LINE_ITEM',
        goal: 'CONVERSIONS',
        status: 'ACTIVE',
        endedAt: null,
        arms: [
          { name: 'Arm 1', control: true, ids: [lis[q.a]!.id] },
          { name: 'Arm 2', control: false, ids: [lis[q.b]!.id] },
        ],
      });
      made++;
    }

    // --- lift studies
    const measurable = withLis.filter((io) => io.lineItems.some((l) => ['DISPLAY', 'VIDEO', 'AUDIO', 'YT_VIDEO', 'YT_AUDIO', 'DEMAND_GEN'].includes(l.type)));
    const inr = await inrMultiplier(tx, adv.currencyCode);
    const required = liftRequirement('BRAND_LIFT', 'STANDARD', liftParams(), inr);
    const specs: { name: string; io: number; status: 'COMPLETE' | 'NOT_ELIGIBLE' | 'IN_PROGRESS'; pct: number; started: string; metrics: BrandLiftMetric[] }[] = [
      { name: 'Awareness lift - Always on', io: 0, status: 'COMPLETE', pct: 100, started: addDays(input.today, -14), metrics: ['AWARENESS', 'VIDEO_AD_RECALL'] },
      { name: 'Consideration lift - Low spend', io: 1, status: 'NOT_ELIGIBLE', pct: 0, started: addDays(input.today, -3), metrics: ['CONSIDERATION'] },
      { name: 'Favorability lift - Launch', io: 2, status: 'IN_PROGRESS', pct: 40, started: addDays(input.today, -4), metrics: ['FAVORABILITY', 'AWARENESS'] },
    ];
    for (const sp of specs) {
      const io = measurable[sp.io % Math.max(1, measurable.length)];
      if (!io) continue;
      const study = await tx.liftStudy.create({
        data: {
          sandboxId: input.sandboxId,
          advertiserId: adv.id,
          name: sp.name,
          types: ['BRAND_LIFT'],
          brandLiftMetrics: sp.metrics,
          brandName: 'Adsmetor Demo',
          competitors: ['Competitor A', 'Competitor B'],
          language: 'en-US',
          objectType: 'Brand',
          strength: 'STANDARD',
          status: sp.status,
        },
        select: { id: true },
      });
      await tx.liftStudyEntity.create({ data: { sandboxId: input.sandboxId, studyId: study.id, ioId: io.id } });
      const so = sp.pct === 100 ? required : Math.round(required * sp.pct) / 100;
      const flight = await tx.liftFlight.create({
        data: {
          sandboxId: input.sandboxId,
          studyId: study.id,
          liftType: 'BRAND_LIFT',
          number: 1,
          status: sp.status,
          pctComplete: sp.pct,
          requiredMediaCost: required,
          mediaCostSoFar: sp.status === 'NOT_ELIGIBLE' ? 0 : so,
          startedAt: day(sp.started),
          ...(sp.status === 'COMPLETE' ? { endedAt: day(addDays(input.today, -2)) } : {}),
        },
        select: { id: true },
      });
      if (sp.status !== 'NOT_ELIGIBLE') {
        const studyLis = await loadStudyLis(tx, [io.id]);
        await writeFlightResults(tx, {
          sandboxId: input.sandboxId,
          study: { id: study.id, brandLiftMetrics: sp.metrics, strength: 'STANDARD' },
          flightId: flight.id,
          type: 'BRAND_LIFT',
          startDate: sp.started,
          today: sp.status === 'COMPLETE' ? addDays(input.today, -2) : input.today,
          lis: studyLis,
          ioNames: new Map([[io.id, io.name]]),
          groups: 0,
        });
      }
      await syncStudyStatus(tx, study.id);
      made++;
    }
  }
  return made;
}

interface TestSpec {
  name: string;
  hypothesis: string | null;
  start: string;
  end: string | null;
  target: 'INSERTION_ORDER' | 'LINE_ITEM';
  goal: 'CLICKS' | 'CONVERSIONS';
  status: 'COMPLETED' | 'ACTIVE';
  endedAt: Date | null;
  arms: { name: string; control: boolean; ids: string[] }[];
}

async function makeTest(tx: Client, input: SeedExperimentsInput, advertiserId: string, t: TestSpec): Promise<void> {
  const e = await tx.experiment.create({
    data: {
      sandboxId: input.sandboxId,
      advertiserId,
      name: t.name,
      hypothesis: t.hypothesis,
      startDate: day(t.start),
      endDate: t.end ? day(t.end) : null,
      target: t.target,
      goal: t.goal,
      confidence: 'P90',
      excludeUnidentifiedUsers: false,
      channelScope: 'CROSS_EXCHANGE',
      status: t.status,
      endedAt: t.endedAt,
    },
    select: { id: true },
  });
  let ordinal = 0;
  let controlArmId: string | null = null;
  for (const a of t.arms) {
    const arm = await tx.experimentArm.create({
      data: { sandboxId: input.sandboxId, experimentId: e.id, name: a.name, splitPct: 50, isControl: a.control, ordinal: ordinal++ },
      select: { id: true },
    });
    if (a.control) controlArmId = arm.id;
    for (const id of a.ids) {
      await tx.experimentArmEntity.create({
        data: { sandboxId: input.sandboxId, experimentId: e.id, armId: arm.id, ...(t.target === 'INSERTION_ORDER' ? { ioId: id } : { lineItemId: id }) },
      });
    }
  }
  await tx.experiment.update({ where: { id: e.id }, data: { controlArmId } });
}
