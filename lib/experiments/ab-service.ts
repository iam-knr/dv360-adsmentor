import 'server-only';
// A/B test services (module 17 4.1 to 4.4). Reads run in the viewer's sandbox; every write goes through
// withChangeLog with `entityType = EXPERIMENT`. The sim clock decides SCHEDULED or ACTIVE at save and the report range.
import type { Experiment, ExperimentArm, ExperimentArmEntity, Prisma } from '@prisma/client';
import type { SessionUser } from '@/lib/auth/types';
import { withChangeLog } from '@/lib/changelog';
import type { Tx } from '@/lib/db';
import {
  asResult,
  changeCtx,
  conflict,
  notFound,
  ServiceFailure,
  type Result,
  type ServiceCtx,
} from '@/lib/campaigns/service-kit';
import { eachDayIso } from '@/lib/metrics/date-range';
import type { Issue } from '@/lib/validation/types';
import {
  AB_METRICS,
  GOAL_TO_METRIC,
  metricsForScope,
  type AbMetric,
} from './constants';
import {
  dailyMetrics,
  emptySums,
  estimateReach,
  lineItemIdsOf,
  loadEntityRows,
  reachedUsers,
  sumMetrics,
  type RawSums,
} from './data';
import { diffArms, type DiffEntity, type DiffRow } from './diff';
import {
  canWriteExperiments,
  loadAdvertiser,
  parseIdRef,
  readCtx,
  simToday,
  whereId,
  writeCtx,
  type AdvertiserRow,
} from './guard';
import { createLiftStudyTx } from './lift-service';
import { abIssues, lockedAbEnd, scopeOf, type AbEntityInfo, type AbRuleCtx } from './rules';
import { buildTiles, metricLabel, type ArmCounters, type ArmInput } from './stats';
import type {
  AbArmView,
  AbList,
  AbReport,
  AbTestInput,
  AbTestView,
  BrandLiftInput,
  CandidateRow,
} from './types';
import { settingsOfIo, settingsOfLi } from './settings';

const toWire = (i: Issue) => ({ path: i.path, severity: i.severity, code: i.ruleId, message: i.message });
const fail = (issues: Issue[]) => new ServiceFailure('INVALID', issues.map(toWire));
const iso = (d: Date): string => d.toISOString().slice(0, 10);
const dbDate = (s: string): Date => new Date(`${s}T00:00:00.000Z`);

type ExperimentFull = Experiment & {
  arms: (ExperimentArm & { entities: ExperimentArmEntity[] })[];
};

async function loadExperiment(tx: Tx, advertiserId: string, testId: string): Promise<ExperimentFull> {
  const ref = parseIdRef(testId);
  const row = ref
    ? await tx.experiment.findFirst({
        where: { ...whereId(ref), advertiserId },
        include: { arms: { orderBy: { ordinal: 'asc' }, include: { entities: true } } },
      })
    : null;
  if (!row) throw notFound();
  return row;
}

const entityIdsOf = (arm: { entities: ExperimentArmEntity[] }): string[] =>
  arm.entities.map((e) => (e.ioId ?? e.lineItemId) as string);

// ---------------------------------------------------------------------------------------------
// List and view
// ---------------------------------------------------------------------------------------------

export async function listAbTests(user: SessionUser, aid: string): Promise<AbList> {
  return readCtx(user, async (tx, ctx) => {
    const adv = await loadAdvertiser(tx, aid);
    const rows = await tx.experiment.findMany({
      where: { advertiserId: adv.id },
      orderBy: [{ createdAt: 'desc' }],
      include: { _count: { select: { arms: true } } },
    });
    return {
      canWrite: canWriteExperiments(user),
      today: simToday(ctx, adv),
      rows: rows.map((e) => ({
        id: e.id,
        publicId: e.publicId.toString(),
        name: e.name,
        arms: e._count.arms,
        status: e.status,
        startDate: iso(e.startDate),
        endDate: e.endDate ? iso(e.endDate) : null,
        target: e.target,
      })),
    };
  });
}

async function brandLiftOf(tx: Tx, studyId: string | null): Promise<BrandLiftInput | null> {
  if (!studyId) return null;
  const s = await tx.liftStudy.findUnique({ where: { id: studyId } });
  if (!s) return null;
  return {
    metrics: s.brandLiftMetrics,
    brandName: s.brandName,
    competitors: s.competitors,
    language: s.language,
    objectType: s.objectType,
    intendedAction: s.intendedAction,
  };
}

async function toView(
  tx: Tx,
  ctx: ServiceCtx,
  adv: AdvertiserRow,
  e: ExperimentFull,
  canEdit: boolean,
): Promise<AbTestView> {
  const today = simToday(ctx, adv);
  const ids = e.arms.flatMap(entityIdsOf);
  const rows = ids.length ? await loadEntityRows(tx, adv.id, e.target, ids) : [];
  const info = new Map(rows.map((r) => [r.id, r]));
  const started = e.status !== 'SCHEDULED';
  const lift = e.liftStudyId
    ? await tx.liftStudy.findUnique({ where: { id: e.liftStudyId }, select: { publicId: true } })
    : null;
  return {
    id: e.id,
    publicId: e.publicId.toString(),
    name: e.name,
    hypothesis: e.hypothesis,
    startDate: iso(e.startDate),
    endDate: e.endDate ? iso(e.endDate) : null,
    target: e.target,
    goal: e.goal,
    confidence: e.confidence,
    excludeUnidentifiedUsers: e.excludeUnidentifiedUsers,
    channelScope: e.channelScope,
    status: e.status,
    arms: e.arms.map(
      (a): AbArmView => ({
        id: a.id,
        name: a.name,
        splitPct: a.splitPct,
        isControl: a.isControl,
        entities: entityIdsOf(a).map((id) => ({
          id,
          publicId: info.get(id)?.publicId ?? '',
          name: info.get(id)?.name ?? id,
        })),
      }),
    ),
    controlArmId: e.controlArmId,
    version: e.version,
    canEdit: canEdit && e.status !== 'COMPLETED',
    locked: { dates: started, arms: started },
    endedAt: e.endedAt ? e.endedAt.toISOString() : null,
    liftStudyId: e.liftStudyId,
    liftStudyPublicId: lift ? lift.publicId.toString() : null,
    brandLift: await brandLiftOf(tx, e.liftStudyId),
    today,
  };
}

export async function getAbTest(user: SessionUser, aid: string, testId: string): Promise<AbTestView> {
  return readCtx(user, async (tx, ctx) => {
    const adv = await loadAdvertiser(tx, aid);
    const e = await loadExperiment(tx, adv.id, testId);
    return toView(tx, ctx, adv, e, canWriteExperiments(user));
  });
}

// ---------------------------------------------------------------------------------------------
// Candidates (arm picker, S10)
// ---------------------------------------------------------------------------------------------

async function usedElsewhere(tx: Tx, advertiserId: string, exceptId: string | null): Promise<Map<string, string>> {
  const rows = await tx.experimentArmEntity.findMany({
    where: { arm: { experiment: { advertiserId, status: { in: ['SCHEDULED', 'ACTIVE'] }, ...(exceptId ? { id: { not: exceptId } } : {}) } } },
    select: { ioId: true, lineItemId: true, arm: { select: { experiment: { select: { name: true } } } } },
  });
  return new Map(rows.map((r) => [(r.ioId ?? r.lineItemId) as string, r.arm.experiment.name]));
}

export async function listExperimentCandidates(
  user: SessionUser,
  aid: string,
  q: { compare: 'INSERTION_ORDERS' | 'LINE_ITEMS'; q?: string; exceptTestId?: string },
): Promise<CandidateRow[]> {
  return readCtx(user, async (tx) => {
    const adv = await loadAdvertiser(tx, aid);
    const target = q.compare === 'LINE_ITEMS' ? 'LINE_ITEM' : 'INSERTION_ORDER';
    const rows = await loadEntityRows(tx, adv.id, target);
    const used = await usedElsewhere(tx, adv.id, q.exceptTestId ?? null);
    const needle = (q.q ?? '').trim().toLowerCase();
    return rows
      .filter((r) => !needle || r.name.toLowerCase().includes(needle) || r.publicId.includes(needle))
      .map((r) => ({
        id: r.id,
        publicId: r.publicId,
        name: r.name,
        parent: r.parent,
        scope: r.scope,
        warning: r.budgetWarning ? 'The total budget of all line items is greater than the insertion order budget.' : undefined,
        inOtherTest: used.get(r.id),
        inactive: r.inactive || undefined,
      }));
  });
}

// ---------------------------------------------------------------------------------------------
// Create and update
// ---------------------------------------------------------------------------------------------

async function ruleCtx(
  tx: Tx,
  adv: AdvertiserRow,
  input: AbTestInput,
  base: Pick<AbRuleCtx, 'mode' | 'today' | 'started' | 'original'>,
  exceptId: string | null,
): Promise<AbRuleCtx> {
  const ids = [...new Set(input.arms.flatMap((a) => a.entityIds))];
  const kind = input.target === 'LINE_ITEM' ? 'LINE_ITEM' : 'INSERTION_ORDER';
  // entities of the other kind are looked up too, so a mix is reported (AB-021)
  const other = kind === 'LINE_ITEM' ? 'INSERTION_ORDER' : 'LINE_ITEM';
  const [mine, theirs] = await Promise.all([
    loadEntityRows(tx, adv.id, kind, ids),
    loadEntityRows(tx, adv.id, other, ids),
  ]);
  const entities = new Map<string, AbEntityInfo>();
  for (const r of [...theirs, ...mine]) entities.set(r.id, r);
  return { ...base, entities, usedElsewhere: await usedElsewhere(tx, adv.id, exceptId) };
}

const splitOf = (v: unknown): number => Math.round(Number(v));

async function writeArms(t: Tx, ctx: ServiceCtx, experimentId: string, input: AbTestInput): Promise<string | null> {
  let controlArmId: string | null = null;
  let ordinal = 0;
  for (const a of input.arms) {
    const arm = await t.experimentArm.create({
      data: {
        sandboxId: ctx.sandboxId,
        experimentId,
        name: a.name.trim(),
        splitPct: splitOf(a.splitPct),
        isControl: a.isControl,
        ordinal: ordinal++,
      },
      select: { id: true },
    });
    if (a.isControl) controlArmId = arm.id;
    for (const id of a.entityIds) {
      await t.experimentArmEntity.create({
        data: {
          sandboxId: ctx.sandboxId,
          experimentId,
          armId: arm.id,
          ...(input.target === 'INSERTION_ORDER' ? { ioId: id } : { lineItemId: id }),
        },
      });
    }
  }
  return controlArmId;
}

export async function createAbTest(
  user: SessionUser,
  aid: string,
  input: AbTestInput,
): Promise<Result<{ id: string; publicId: string; status: 'SCHEDULED' | 'ACTIVE'; liftStudyId?: string }>> {
  return asResult(async () => {
    const out = await writeCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, aid);
      const today = simToday(ctx, adv);
      const rc = await ruleCtx(tx, adv, input, { mode: 'create', today, started: false }, null);
      const issues = abIssues(input, rc);
      if (issues.some((i) => i.blocking)) throw fail(issues);
      const scopes = input.arms.flatMap((a) => a.entityIds).map((id) => rc.entities.get(id)?.scope ?? 'CROSS_EXCHANGE');
      const scope = scopeOf(scopes);
      const exclude =
        input.excludeUnidentifiedUsers && input.target === 'INSERTION_ORDER' && scopes.includes('CROSS_EXCHANGE');
      const status: 'ACTIVE' | 'SCHEDULED' = input.startDate <= today ? 'ACTIVE' : 'SCHEDULED';
      const created = await withChangeLog(
        changeCtx(ctx, tx),
        { type: 'EXPERIMENT', chain: { advertiserId: adv.id } },
        async (t) => {
          const e = await t.experiment.create({
            data: {
              sandboxId: ctx.sandboxId,
              advertiserId: adv.id,
              name: input.name.trim(),
              hypothesis: input.hypothesis?.trim() || null,
              startDate: dbDate(input.startDate),
              endDate: input.endDate ? dbDate(input.endDate) : null,
              target: input.target,
              goal: input.goal,
              confidence: input.confidence,
              excludeUnidentifiedUsers: exclude,
              channelScope: scope,
              status,
            },
            select: { id: true, publicId: true },
          });
          const controlArmId = await writeArms(t, ctx, e.id, input);
          await t.experiment.update({ where: { id: e.id }, data: { controlArmId } });
          return e;
        },
      );
      let liftStudyId: string | undefined;
      if (input.liftEnabled && input.brandLift) {
        const ioIds = [...new Set(input.arms.flatMap((a) => a.entityIds))];
        const lift = await createLiftStudyTx(tx, ctx, adv, {
          name: `${input.name.trim()} brand lift`,
          ioIds,
          ioGroup: 'OTHER',
          liftTypes: ['BRAND_LIFT'],
          brandLift: input.brandLift,
          strength: 'STANDARD',
          searchGroups: [],
        }, created.id);
        liftStudyId = lift.id;
        await tx.experiment.update({ where: { id: created.id }, data: { liftStudyId } });
      }
      return {
        data: {
          id: created.id,
          publicId: created.publicId.toString(),
          status: status,
          ...(liftStudyId ? { liftStudyId } : {}),
        },
        warnings: issues.filter((i) => !i.blocking).map(toWire),
      };
    });
    return out;
  });
}

export async function updateAbTest(
  user: SessionUser,
  aid: string,
  testId: string,
  input: AbTestInput,
): Promise<Result<{ view: AbTestView }>> {
  return asResult(async () => {
    const out = await writeCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, aid);
      const e = await loadExperiment(tx, adv.id, testId);
      if (e.status === 'COMPLETED') throw fail([lockedAbEnd()]);
      if (input.version !== undefined && input.version !== e.version) throw conflict();
      const today = simToday(ctx, adv);
      const started = e.status !== 'SCHEDULED';
      const original = {
        startDate: iso(e.startDate),
        endDate: e.endDate ? iso(e.endDate) : null,
        arms: e.arms.map((a) => ({
          id: a.id,
          splitPct: a.splitPct,
          isControl: a.isControl,
          entityIds: entityIdsOf(a),
        })),
      };
      const rc = await ruleCtx(tx, adv, input, { mode: 'edit', today, started, original }, e.id);
      const issues = abIssues({ ...input, target: e.target }, rc).filter(
        // the start date of a test that has not started may be today or later; past dates were checked at create
        (i) => i.ruleId !== 'AB-028',
      );
      if (issues.some((i) => i.blocking)) throw fail(issues);
      const scopes = input.arms.flatMap((a) => a.entityIds).map((id) => rc.entities.get(id)?.scope ?? 'CROSS_EXCHANGE');
      const exclude = input.excludeUnidentifiedUsers && e.target === 'INSERTION_ORDER' && scopes.includes('CROSS_EXCHANGE');
      await withChangeLog(
        changeCtx(ctx, tx),
        { type: 'EXPERIMENT', id: e.id, publicId: e.publicId, name: e.name, chain: { advertiserId: adv.id } },
        async (t) => {
          if (started) {
            await t.experiment.update({
              where: { id: e.id },
              data: {
                name: input.name.trim(),
                hypothesis: input.hypothesis?.trim() || null,
                endDate: input.endDate ? dbDate(input.endDate) : null,
                version: { increment: 1 },
              },
            });
            return e.id;
          }
          await t.experimentArmEntity.deleteMany({ where: { experimentId: e.id } });
          await t.experimentArm.deleteMany({ where: { experimentId: e.id } });
          const controlArmId = await writeArms(t, ctx, e.id, { ...input, target: e.target });
          const status = input.startDate <= today ? 'ACTIVE' : 'SCHEDULED';
          await t.experiment.update({
            where: { id: e.id },
            data: {
              name: input.name.trim(),
              hypothesis: input.hypothesis?.trim() || null,
              startDate: dbDate(input.startDate),
              endDate: input.endDate ? dbDate(input.endDate) : null,
              goal: input.goal,
              confidence: input.confidence,
              excludeUnidentifiedUsers: exclude,
              channelScope: scopeOf(scopes),
              status,
              controlArmId,
              version: { increment: 1 },
            },
          });
          return e.id;
        },
      );
      const fresh = await loadExperiment(tx, adv.id, e.id);
      return {
        data: { view: await toView(tx, ctx, adv, fresh, true) },
        warnings: issues.filter((i) => !i.blocking).map(toWire),
      };
    });
    return out;
  });
}

export async function endAbTest(
  user: SessionUser,
  aid: string,
  testId: string,
): Promise<Result<{ status: 'COMPLETED' }>> {
  return asResult(async () => {
    const data = await writeCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, aid);
      const e = await loadExperiment(tx, adv.id, testId);
      if (e.status === 'COMPLETED') throw fail([lockedAbEnd()]);
      const today = simToday(ctx, adv);
      await withChangeLog(
        changeCtx(ctx, tx),
        { type: 'EXPERIMENT', id: e.id, publicId: e.publicId, name: e.name, chain: { advertiserId: adv.id } },
        async (t) => {
          await t.experiment.update({
            where: { id: e.id },
            data: {
              status: 'COMPLETED',
              endedAt: ctx.simNow,
              endedById: (ctx.user.actor ?? ctx.user).id,
              // an early end moves the end date to today (never before the start)
              ...(!e.endDate || iso(e.endDate) > today
                ? { endDate: dbDate(today < iso(e.startDate) ? iso(e.startDate) : today) }
                : {}),
              version: { increment: 1 },
            },
          });
          return e.id;
        },
      );
      return { status: 'COMPLETED' as const };
    });
    return { data };
  });
}

// ---------------------------------------------------------------------------------------------
// Report (S4)
// ---------------------------------------------------------------------------------------------

export interface AbReportQuery {
  controlArmId?: string;
  metric?: AbMetric;
  confidence?: 'P90' | 'P95';
  from?: string;
  to?: string;
}

function countersOf(s: RawSums, reached: number, split: number): ArmCounters {
  return {
    impressions: s.impressions,
    clicks: s.clicks,
    conversions: s.conversions,
    engagements: s.engagements,
    videoStarts: s.videoStarts,
    videoCompletions: s.videoCompletions,
    videoViews: s.videoViews,
    audibleVisibleComplete: s.audibleVisibleComplete,
    customImpressionValue: s.customImpressionValue,
    reached: estimateReach(reached, s.impressions),
    cost: s.mediaCost,
    revenue: s.revenue,
    split,
  };
}

const seriesValue = (m: AbMetric, s: RawSums): number => {
  switch (m) {
    case 'IMPRESSIONS': return s.impressions;
    case 'CLICKS': return s.clicks;
    case 'CONVERSIONS': return s.conversions;
    case 'REACH': return estimateReach(0, s.impressions);
    case 'VIDEO_COMPLETIONS': return s.videoCompletions;
    case 'AVOC': return s.audibleVisibleComplete;
    case 'CUSTOM_IMPRESSION_VALUE': return s.customImpressionValue;
    case 'ENGAGEMENTS': return s.engagements;
    case 'VIEWS': return s.videoViews;
  }
};

export async function getAbReport(
  user: SessionUser,
  aid: string,
  testId: string,
  q: AbReportQuery = {},
): Promise<AbReport> {
  return readCtx(user, async (tx, ctx) => {
    const adv = await loadAdvertiser(tx, aid);
    const e = await loadExperiment(tx, adv.id, testId);
    const today = simToday(ctx, adv);
    const metrics = metricsForScope(e.channelScope);
    const wanted = q.metric && metrics.some((m) => m.key === q.metric) ? q.metric : GOAL_TO_METRIC[e.goal];
    const metric = metrics.some((m) => m.key === wanted) ? wanted : (metrics[0]?.key ?? 'IMPRESSIONS');
    const confidence = q.confidence ?? e.confidence;
    const controlId =
      q.controlArmId && e.arms.some((a) => a.id === q.controlArmId)
        ? q.controlArmId
        : (e.controlArmId ?? (e.arms[0] as ExperimentArm).id);

    const start = iso(e.startDate);
    // a finished test freezes its range at the end date (4.7); a running one reads up to today
    const lastDay = e.endedAt || (e.endDate && iso(e.endDate) < today) ? iso(e.endDate as Date) : today;
    const from = q.from && q.from >= start ? q.from : start;
    const to = q.to && q.to <= lastDay ? q.to : lastDay;
    const range = { from, to: to < from ? from : to };
    const notStartedUntil = start > today ? start : null;

    const armData = [];
    const inputs: ArmInput[] = [];
    let spend = 0;
    for (const a of e.arms) {
      const liIds = await lineItemIdsOf(tx, e.target, entityIdsOf(a));
      const sums = notStartedUntil ? emptySums() : await sumMetrics(tx, liIds, range.from, range.to);
      const reached = notStartedUntil ? 0 : await reachedUsers(tx, liIds, range.to);
      const counters = countersOf(sums, reached, a.splitPct / 100);
      spend += sums.revenue;
      inputs.push({ armId: a.id, name: a.name, isControl: a.id === controlId, counters });
      armData.push({ a, liIds, sums });
    }
    const hasData = armData.some((x) => x.sums.impressions > 0);
    const res = buildTiles(metric, inputs, confidence, adv.currencyCode);
    const days = eachDayIso(range);
    const series = [];
    for (const x of armData) {
      const daily = notStartedUntil ? new Map<string, RawSums>() : await dailyMetrics(tx, x.liIds, range.from, range.to);
      series.push({
        armId: x.a.id,
        name: x.a.name,
        points: days.map((d) => ({ date: d, value: seriesValue(metric, daily.get(d) ?? emptySums()) })),
      });
    }
    return {
      metric,
      metricLabel: metricLabel(metric),
      controlArmId: controlId,
      confidence,
      range,
      tiles: res.tiles,
      series,
      best: res.best,
      significance: res.significance,
      perArm: inputs.map((i) => ({
        armId: i.armId,
        name: i.name,
        isControl: i.isControl,
        splitPct: Math.round(i.counters.split * 100),
        counters: { ...i.counters },
      })),
      media: { spend: Math.round(spend * 100) / 100, arms: e.arms.length, currency: adv.currencyCode },
      hasData,
      asOf: ctx.simNow.toISOString(),
      status: e.status,
      notStartedUntil,
    };
  });
}

/** CSV of the per-arm tiles for the current report parameters (S4 download icon). */
export async function downloadAbCsv(
  user: SessionUser,
  aid: string,
  testId: string,
  q: AbReportQuery = {},
): Promise<{ fileName: string; body: string }> {
  const report = await getAbReport(user, aid, testId, q);
  const lines = [['Arm', 'Control', ...report.tiles.map((t) => t.label)].join(',')];
  for (const arm of report.perArm) {
    const cells = report.tiles.map((t) => {
      const v = t.arms.find((x) => x.armId === arm.armId)?.value;
      return v === null || v === undefined ? '' : String(Math.round(v * 10000) / 10000);
    });
    lines.push([JSON.stringify(arm.name), arm.isControl ? 'Yes' : 'No', ...cells].join(','));
  }
  return { fileName: `ab-test-${testId}-${report.metric.toLowerCase()}.csv`, body: `${lines.join('\n')}\n` };
}

// ---------------------------------------------------------------------------------------------
// Differences (S6)
// ---------------------------------------------------------------------------------------------

async function armEntities(tx: Tx, e: ExperimentFull, armId: string): Promise<{ io: DiffEntity[]; li: DiffEntity[] }> {
  const arm = e.arms.find((a) => a.id === armId);
  const ids = arm ? entityIdsOf(arm) : [];
  const io: DiffEntity[] = [];
  if (e.target === 'INSERTION_ORDER') {
    const rows = await tx.insertionOrder.findMany({ where: { id: { in: ids } }, orderBy: { publicId: 'asc' } });
    for (const r of rows) io.push({ name: r.name, settings: await settingsOfIo(tx, r.id) });
  }
  const liIds = await lineItemIdsOf(tx, e.target, ids);
  const lis = await tx.lineItem.findMany({ where: { id: { in: liIds } }, orderBy: { publicId: 'asc' } });
  const li: DiffEntity[] = [];
  for (const r of lis) li.push({ name: r.name, settings: await settingsOfLi(tx, r.id) });
  return { io, li };
}

export async function getAbDifferences(
  user: SessionUser,
  aid: string,
  testId: string,
  variantArmId?: string,
): Promise<{ controlName: string; variantName: string; variants: { id: string; name: string }[]; rows: DiffRow[] }> {
  return readCtx(user, async (tx) => {
    const adv = await loadAdvertiser(tx, aid);
    const e = await loadExperiment(tx, adv.id, testId);
    const control = e.arms.find((a) => a.id === e.controlArmId) ?? e.arms[0];
    if (!control) throw notFound();
    const variants = e.arms.filter((a) => a.id !== control.id);
    const variant = variants.find((a) => a.id === variantArmId) ?? variants[0];
    if (!variant) throw notFound();
    const [c, v] = await Promise.all([armEntities(tx, e, control.id), armEntities(tx, e, variant.id)]);
    const rows = [
      ...diffArms(c.io, v.io, 'Insertion order'),
      ...diffArms(c.li, v.li, 'Line item'),
    ];
    return {
      controlName: control.name,
      variantName: variant.name,
      variants: variants.map((a) => ({ id: a.id, name: a.name })),
      rows,
    };
  });
}

export { AB_METRICS };
export type { Prisma };
