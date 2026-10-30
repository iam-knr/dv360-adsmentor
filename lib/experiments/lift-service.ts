import 'server-only';
// Lift study services (module 17 4.1, 4.2, 4.3). Reads run in the viewer's sandbox; writes go through withChangeLog
// with `entityType = LIFT_STUDY`. Flights are created here; the engine step `advanceLiftStudies` moves them on.
import type { LiftFlight, LiftSlice, LiftStudy, LiftStatus, LiftType, Prisma } from '@prisma/client';
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
import type { Issue } from '@/lib/validation/types';
import { YT_LI_TYPES, type Db } from './data';
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
import { syncStudyStatus } from './advance';
import {
  eligibilityFor,
  loadStudyLis,
  measurableTypesOf,
  type TypeEligibility,
} from './lift-engine';
import { measureOf, SLICES_CROSS, SLICES_YT_DG, enoughResponses, type LiftMeasureKey } from './lift-math';
import { lsFlightOpenIssue, lsIssues, lsNotEligibleIssue, EXP_MSG, type LsRuleCtx } from './rules';
import type {
  BrandLiftInput,
  LiftFlightRow,
  LiftList,
  LiftMetricResult,
  LiftReport,
  LiftRow,
  LiftStudyInput,
  LiftStudyView,
} from './types';

const toWire = (i: Issue) => ({ path: i.path, severity: i.severity, code: i.ruleId, message: i.message });
const fail = (issues: Issue[]) => new ServiceFailure('INVALID', issues.map(toWire));

type StudyFull = LiftStudy & {
  entities: { ioId: string; containsYoutubePg: boolean }[];
  flights: LiftFlight[];
  searchTerms: { id: string; ordinal: number; terms: string[] }[];
};

async function loadStudy(tx: Tx, advertiserId: string, studyId: string): Promise<StudyFull> {
  const ref = parseIdRef(studyId);
  const row = ref
    ? await tx.liftStudy.findFirst({
        where: { ...whereId(ref), advertiserId },
        include: { entities: true, flights: { orderBy: [{ liftType: 'asc' }, { number: 'asc' }] }, searchTerms: { orderBy: { ordinal: 'asc' } } },
      })
    : null;
  if (!row) throw notFound();
  return row;
}

const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

function flightRow(f: LiftFlight, hasResults: boolean): LiftFlightRow {
  return {
    type: f.liftType,
    flightNo: f.number,
    status: f.status,
    pctComplete: f.pctComplete,
    requiredMediaCost: f.requiredMediaCost === null ? null : num(f.requiredMediaCost),
    mediaCostSoFar: num(f.mediaCostSoFar),
    hasResults,
  };
}

/** Latest flight of a type, the one the list shows. */
const latest = (flights: LiftFlight[], type: LiftType): LiftFlight | null =>
  flights.filter((f) => f.liftType === type).sort((a, b) => b.number - a.number)[0] ?? null;

// ---------------------------------------------------------------------------------------------
// Lists and eligibility
// ---------------------------------------------------------------------------------------------

export async function listLiftStudies(user: SessionUser, aid: string): Promise<LiftList> {
  return readCtx(user, async (tx) => {
    const adv = await loadAdvertiser(tx, aid);
    const rows = await tx.liftStudy.findMany({
      where: { advertiserId: adv.id },
      orderBy: { createdAt: 'desc' },
      include: { entities: true, flights: true },
    });
    const withResults = new Set(
      (
        await tx.liftResult.findMany({
          where: { flight: { study: { advertiserId: adv.id } } },
          distinct: ['flightId'],
          select: { flightId: true },
        })
      ).map((r) => r.flightId),
    );
    return {
      canWrite: canWriteExperiments(user),
      rows: rows.map((s): LiftRow => {
        const b = latest(s.flights, 'BRAND_LIFT');
        const se = latest(s.flights, 'SEARCH_LIFT');
        return {
          id: s.id,
          publicId: s.publicId.toString(),
          name: s.name,
          ios: s.entities.length,
          status: s.status,
          brand: b ? flightRow(b, withResults.has(b.id)) : null,
          search: se ? flightRow(se, withResults.has(se.id)) : null,
          hasBrand: s.types.includes('BRAND_LIFT'),
          hasSearch: s.types.includes('SEARCH_LIFT'),
        };
      }),
    };
  });
}

async function youtubePgIos(db: Db, ioIds: string[]): Promise<Set<string>> {
  if (ioIds.length === 0) return new Set();
  const lis = await db.lineItem.findMany({
    where: { ioId: { in: ioIds }, type: { in: YT_LI_TYPES }, status: { not: 'ARCHIVED' } },
    select: { id: true, ioId: true },
  });
  if (lis.length === 0) return new Set();
  const inv = await db.lineItemInventory.findMany({
    where: { lineItemId: { in: lis.map((l) => l.id) }, kind: 'DEAL' },
    select: { lineItemId: true, refId: true },
  });
  const pg = new Set(
    (
      await db.inventorySourceDeal.findMany({
        where: { id: { in: inv.map((i) => i.refId) }, dealType: 'PROGRAMMATIC_GUARANTEED' },
        select: { id: true },
      })
    ).map((d) => d.id),
  );
  const pgLis = new Set(inv.filter((i) => pg.has(i.refId)).map((i) => i.lineItemId));
  return new Set(lis.filter((l) => pgLis.has(l.id)).map((l) => l.ioId));
}

export interface EligibleIo {
  id: string;
  publicId: string;
  name: string;
  eligible: boolean;
}

export async function listEligibleIos(
  user: SessionUser,
  aid: string,
  q: { group: 'YOUTUBE_PG' | 'OTHER'; onlyEligible: boolean; q?: string },
): Promise<EligibleIo[]> {
  return readCtx(user, async (tx) => {
    const adv = await loadAdvertiser(tx, aid);
    const ios = await tx.insertionOrder.findMany({
      where: { advertiserId: adv.id, status: { not: 'ARCHIVED' } },
      orderBy: { publicId: 'asc' },
      select: { id: true, publicId: true, name: true },
    });
    const lis = await loadStudyLis(tx, ios.map((i) => i.id));
    const pg = await youtubePgIos(tx, ios.map((i) => i.id));
    const needle = (q.q ?? '').trim().toLowerCase();
    return ios
      .filter((io) => (q.group === 'YOUTUBE_PG' ? pg.has(io.id) : !pg.has(io.id)))
      .map((io) => ({
        id: io.id,
        publicId: io.publicId.toString(),
        name: io.name,
        eligible: lis.some((l) => l.ioId === io.id && measurableTypesOf('BRAND_LIFT').includes(l.type)),
      }))
      .filter((io) => (!q.onlyEligible || io.eligible) && (!needle || io.name.toLowerCase().includes(needle) || io.publicId.includes(needle)));
  });
}

export interface EligibilityResult {
  perType: TypeEligibility[];
  eligibleIoCount: number;
  allMeasurableYoutube: boolean;
  currency: string;
}

async function eligibilityOf(
  tx: Tx,
  adv: AdvertiserRow,
  today: string,
  ioIds: string[],
  types: LiftType[],
  strength: 'STANDARD' | 'ENHANCED',
): Promise<EligibilityResult> {
  const lis = await loadStudyLis(tx, ioIds);
  const measurable = lis.filter((l) => measurableTypesOf('BRAND_LIFT').includes(l.type));
  const wanted: LiftType[] = ['BRAND_LIFT', 'SEARCH_LIFT'];
  const perType = await eligibilityFor(tx, {
    ioIds,
    types: types.length ? types : wanted,
    strength,
    today,
    currency: adv.currencyCode,
  });
  return {
    perType,
    eligibleIoCount: new Set(measurable.map((l) => l.ioId)).size,
    allMeasurableYoutube: measurable.length > 0 && measurable.every((l) => YT_LI_TYPES.includes(l.type as never)),
    currency: adv.currencyCode,
  };
}

export async function liftEligibility(
  user: SessionUser,
  aid: string,
  req: { ioIds: string[]; types: LiftType[]; strength: 'STANDARD' | 'ENHANCED' },
): Promise<EligibilityResult> {
  return readCtx(user, async (tx, ctx) => {
    const adv = await loadAdvertiser(tx, aid);
    return eligibilityOf(tx, adv, simToday(ctx, adv), req.ioIds, req.types, req.strength);
  });
}

// ---------------------------------------------------------------------------------------------
// Create, edit, end, add flight
// ---------------------------------------------------------------------------------------------

async function ruleCtx(
  tx: Tx,
  adv: AdvertiserRow,
  today: string,
  input: LiftStudyInput,
  mode: 'create' | 'edit',
  originalTypes?: LiftType[],
): Promise<{ rc: LsRuleCtx; elig: EligibilityResult; pg: Set<string> }> {
  const owned = await tx.insertionOrder.findMany({
    where: { advertiserId: adv.id, id: { in: input.ioIds } },
    select: { id: true },
  });
  const ioIds = owned.map((o) => o.id);
  const pg = await youtubePgIos(tx, ioIds);
  const elig = await eligibilityOf(tx, adv, today, ioIds, input.liftTypes, input.strength);
  const rc: LsRuleCtx = {
    mode,
    groups: { yt: ioIds.filter((i) => pg.has(i)).length, other: ioIds.filter((i) => !pg.has(i)).length },
    eligibleIoCount: elig.eligibleIoCount,
    perType: elig.perType.map((p) => ({ type: p.type, measurableLis: p.measurableLis, eligible: p.eligible })),
    allMeasurableYoutube: elig.allMeasurableYoutube,
    originalTypes,
  };
  return { rc, elig, pg };
}

function studyData(input: LiftStudyInput) {
  const b = input.brandLift;
  return {
    name: input.name.trim(),
    types: input.liftTypes,
    brandLiftMetrics: input.liftTypes.includes('BRAND_LIFT') ? b.metrics : [],
    brandName: b.brandName.trim(),
    competitors: b.competitors.map((c) => c.trim()).filter(Boolean),
    language: b.language || 'en-US',
    objectType: b.objectType,
    intendedAction: b.metrics.includes('PURCHASE_INTENT') ? b.intendedAction : null,
    strength: input.strength,
  };
}

/** Shared by the lift form and the A/B Brand lift block; runs inside the caller's transaction. */
export async function createLiftStudyTx(
  tx: Tx,
  ctx: ServiceCtx,
  adv: AdvertiserRow,
  input: LiftStudyInput,
  originExperimentId?: string,
): Promise<{ id: string; publicId: string; flights: { type: LiftType; flightNo: number; status: LiftStatus }[]; warnings: Issue[] }> {
  const today = simToday(ctx, adv);
  const { rc, elig, pg } = await ruleCtx(tx, adv, today, input, 'create');
  const issues = lsIssues(input, rc);
  if (issues.some((i) => i.blocking)) throw fail(issues);
  const warnings: Issue[] = [];
  const flights: { type: LiftType; flightNo: number; status: LiftStatus }[] = [];
  const created = await withChangeLog(
    changeCtx(ctx, tx),
    { type: 'LIFT_STUDY', chain: { advertiserId: adv.id } },
    async (t) => {
      const s = await t.liftStudy.create({
        data: {
          sandboxId: ctx.sandboxId,
          advertiserId: adv.id,
          ...studyData(input),
          ...(originExperimentId ? { originExperimentId } : {}),
        },
        select: { id: true, publicId: true },
      });
      for (const id of new Set(input.ioIds)) {
        await t.liftStudyEntity.create({
          data: { sandboxId: ctx.sandboxId, studyId: s.id, ioId: id, containsYoutubePg: pg.has(id) },
        });
      }
      if (input.liftTypes.includes('SEARCH_LIFT')) {
        let o = 0;
        for (const g of input.searchGroups) {
          const terms = g.map((x) => x.trim()).filter(Boolean);
          if (terms.length) await t.liftSearchTermGroup.create({ data: { sandboxId: ctx.sandboxId, studyId: s.id, ordinal: o++, terms } });
        }
      }
      for (const type of input.liftTypes) {
        const e = elig.perType.find((p) => p.type === type) as TypeEligibility;
        const status: LiftStatus = e.eligible ? 'IN_PROGRESS' : 'NOT_ELIGIBLE';
        if (!e.eligible) warnings.push(lsNotEligibleIssue());
        await t.liftFlight.create({
          data: {
            sandboxId: ctx.sandboxId,
            studyId: s.id,
            liftType: type,
            number: 1,
            status,
            pctComplete: 0,
            requiredMediaCost: e.requiredMediaCost,
            mediaCostSoFar: 0,
            startedAt: ctx.simNow,
          },
        });
        flights.push({ type, flightNo: 1, status });
      }
      await syncStudyStatus(t, s.id);
      return s;
    },
  );
  return { id: created.id, publicId: created.publicId.toString(), flights, warnings };
}

export async function createLiftStudy(
  user: SessionUser,
  aid: string,
  input: LiftStudyInput,
): Promise<Result<{ id: string; publicId: string; flights: { type: LiftType; flightNo: number; status: LiftStatus }[] }>> {
  return asResult(async () => {
    const r = await writeCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, aid);
      return createLiftStudyTx(tx, ctx, adv, input);
    });
    return { data: { id: r.id, publicId: r.publicId, flights: r.flights }, warnings: r.warnings.map(toWire) };
  });
}

function toStudyView(s: StudyFull, ios: { id: string; publicId: bigint; name: string }[], currency: string, canEdit: boolean): LiftStudyView {
  const hasPg = s.entities.some((e) => e.containsYoutubePg);
  const brandLift: BrandLiftInput = {
    metrics: s.brandLiftMetrics,
    brandName: s.brandName,
    competitors: s.competitors,
    language: s.language,
    objectType: s.objectType,
    intendedAction: s.intendedAction,
  };
  return {
    id: s.id,
    publicId: s.publicId.toString(),
    name: s.name,
    ios: ios.map((i) => ({ id: i.id, publicId: i.publicId.toString(), name: i.name })),
    ioGroup: hasPg ? 'YOUTUBE_PG' : 'OTHER',
    liftTypes: s.types,
    brandLift,
    strength: s.strength,
    searchGroups: s.searchTerms.map((g) => g.terms),
    status: s.status,
    flights: s.flights.map((f) => flightRow(f, false)),
    version: s.version,
    canEdit,
    currency,
  };
}

export async function getLiftStudy(user: SessionUser, aid: string, studyId: string): Promise<LiftStudyView> {
  return readCtx(user, async (tx) => {
    const adv = await loadAdvertiser(tx, aid);
    const s = await loadStudy(tx, adv.id, studyId);
    const ios = await tx.insertionOrder.findMany({
      where: { id: { in: s.entities.map((e) => e.ioId) } },
      orderBy: { publicId: 'asc' },
      select: { id: true, publicId: true, name: true },
    });
    return toStudyView(s, ios, adv.currencyCode, canWriteExperiments(user));
  });
}

/** Review and fix: everything but the lift types can change; the flights are re-checked (LS-015). */
export async function updateLiftStudy(
  user: SessionUser,
  aid: string,
  studyId: string,
  input: LiftStudyInput,
): Promise<Result<{ status: LiftStatus }>> {
  return asResult(async () => {
    const r = await writeCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, aid);
      const s = await loadStudy(tx, adv.id, studyId);
      if (input.version !== undefined && input.version !== s.version) throw conflict();
      const today = simToday(ctx, adv);
      const { rc, elig, pg } = await ruleCtx(tx, adv, today, input, 'edit', s.types);
      const issues = lsIssues(input, rc);
      if (issues.some((i) => i.blocking)) throw fail(issues);
      const warnings: Issue[] = [];
      await withChangeLog(
        changeCtx(ctx, tx),
        { type: 'LIFT_STUDY', id: s.id, publicId: s.publicId, name: s.name, chain: { advertiserId: adv.id } },
        async (t) => {
          await t.liftStudy.update({ where: { id: s.id }, data: { ...studyData(input), version: { increment: 1 } } });
          await t.liftStudyEntity.deleteMany({ where: { studyId: s.id } });
          for (const id of new Set(input.ioIds)) {
            await t.liftStudyEntity.create({
              data: { sandboxId: ctx.sandboxId, studyId: s.id, ioId: id, containsYoutubePg: pg.has(id) },
            });
          }
          await t.liftSearchTermGroup.deleteMany({ where: { studyId: s.id } });
          if (input.liftTypes.includes('SEARCH_LIFT')) {
            let o = 0;
            for (const g of input.searchGroups) {
              const terms = g.map((x) => x.trim()).filter(Boolean);
              if (terms.length) await t.liftSearchTermGroup.create({ data: { sandboxId: ctx.sandboxId, studyId: s.id, ordinal: o++, terms } });
            }
          }
          for (const f of s.flights.filter((x) => x.status === 'NOT_ELIGIBLE' || x.status === 'ELIGIBLE')) {
            const e = elig.perType.find((p) => p.type === f.liftType);
            if (!e) continue;
            if (e.eligible) {
              await t.liftFlight.update({
                where: { id: f.id },
                data: { status: 'IN_PROGRESS', requiredMediaCost: e.requiredMediaCost, startedAt: ctx.simNow, pctComplete: 0, mediaCostSoFar: 0 },
              });
            } else {
              warnings.push(lsNotEligibleIssue());
              await t.liftFlight.update({ where: { id: f.id }, data: { status: 'NOT_ELIGIBLE', requiredMediaCost: e.requiredMediaCost } });
            }
          }
          await syncStudyStatus(t, s.id);
          return s.id;
        },
      );
      const fresh = await tx.liftStudy.findUniqueOrThrow({ where: { id: s.id }, select: { status: true } });
      return { status: fresh.status, warnings };
    });
    return { data: { status: r.status }, warnings: r.warnings.map(toWire) };
  });
}

export async function endLiftStudy(
  user: SessionUser,
  aid: string,
  studyId: string,
  type: LiftType,
): Promise<Result<null>> {
  return asResult(async () => {
    await writeCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, aid);
      const s = await loadStudy(tx, adv.id, studyId);
      const f = latest(s.flights, type);
      if (!f || f.status === 'ENDED') throw fail([lsFlightOpenIssue()]);
      await withChangeLog(
        changeCtx(ctx, tx),
        { type: 'LIFT_STUDY', id: s.id, publicId: s.publicId, name: s.name, chain: { advertiserId: adv.id } },
        async (t) => {
          await t.liftFlight.update({ where: { id: f.id }, data: { status: 'ENDED', endedAt: ctx.simNow } });
          await syncStudyStatus(t, s.id);
          await t.liftStudy.update({ where: { id: s.id }, data: { version: { increment: 1 }, endedAt: ctx.simNow } });
          return s.id;
        },
      );
    });
    return { data: null };
  });
}

export async function addLiftFlight(
  user: SessionUser,
  aid: string,
  studyId: string,
  type: LiftType,
): Promise<Result<{ flightNo: number }>> {
  return asResult(async () => {
    const r = await writeCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, aid);
      const s = await loadStudy(tx, adv.id, studyId);
      const f = latest(s.flights, type);
      // the previous flight must be complete or ended (LS-018)
      if (f && f.status !== 'COMPLETE' && f.status !== 'ENDED') throw fail([lsFlightOpenIssue()]);
      const today = simToday(ctx, adv);
      const elig = await eligibilityOf(tx, adv, today, s.entities.map((e) => e.ioId), [type], s.strength);
      const e = elig.perType[0] as TypeEligibility;
      const flightNo = (f?.number ?? 0) + 1;
      await withChangeLog(
        changeCtx(ctx, tx),
        { type: 'LIFT_STUDY', id: s.id, publicId: s.publicId, name: s.name, chain: { advertiserId: adv.id } },
        async (t) => {
          await t.liftFlight.create({
            data: {
              sandboxId: ctx.sandboxId,
              studyId: s.id,
              liftType: type,
              number: flightNo,
              status: e.eligible ? 'IN_PROGRESS' : 'NOT_ELIGIBLE',
              requiredMediaCost: e.requiredMediaCost,
              startedAt: ctx.simNow,
            },
          });
          await syncStudyStatus(t, s.id);
          await t.liftStudy.update({ where: { id: s.id }, data: { version: { increment: 1 }, endedAt: null } });
          return s.id;
        },
      );
      return { flightNo, warnings: e.eligible ? [] : [lsNotEligibleIssue()] };
    });
    return { data: { flightNo: r.flightNo }, warnings: r.warnings.map(toWire) };
  });
}

// ---------------------------------------------------------------------------------------------
// Report (S8)
// ---------------------------------------------------------------------------------------------

export interface LiftReportQuery {
  tab?: 'YT_DG' | 'CROSS_EXCHANGE';
  liftType?: LiftMeasureKey;
  slice?: LiftSlice;
  flightNo?: number;
}

export async function getLiftReport(
  user: SessionUser,
  aid: string,
  studyId: string,
  q: LiftReportQuery = {},
): Promise<LiftReport> {
  return readCtx(user, async (tx) => {
    const adv = await loadAdvertiser(tx, aid);
    const s = await loadStudy(tx, adv.id, studyId);
    const tab = q.tab ?? 'YT_DG';
    const scope = tab === 'YT_DG' ? 'YOUTUBE_DEMAND_GEN' : 'CROSS_EXCHANGE';
    const options = tab === 'YT_DG' ? SLICES_YT_DG : SLICES_CROSS;
    const slice = q.slice && options.includes(q.slice) ? q.slice : 'OVERALL';
    const measure: LiftMeasureKey = q.liftType ?? 'ABSOLUTE';
    const brand = s.flights.filter((f) => f.liftType === 'BRAND_LIFT' && (q.flightNo ? f.number === q.flightNo : true)).sort((a, b) => b.number - a.number)[0];
    const searchFlight = latest(s.flights, 'SEARCH_LIFT');
    const lis = await loadStudyLis(tx, s.entities.map((e) => e.ioId));
    const inScope = lis.filter((l) =>
      tab === 'YT_DG' ? ['YT_VIDEO', 'YT_AUDIO', 'DEMAND_GEN'].includes(l.type) : ['DISPLAY', 'VIDEO', 'AUDIO'].includes(l.type),
    );
    const base: LiftReport = {
      tab,
      liftType: measure,
      slice,
      metrics: [],
      search: null,
      surveyResponses: 0,
      insertionOrders: new Set(inScope.map((l) => l.ioId)).size,
      lineItems: inScope.length,
      flightNo: brand?.number ?? null,
      empty: true,
      sliceOptions: options,
    };
    if (brand) {
      const rows = await tx.liftResult.findMany({ where: { flightId: brand.id, scope, slice: { in: ['OVERALL', slice] } } });
      for (const metric of s.brandLiftMetrics) {
        const overall = rows.find((r) => r.metric === metric && r.slice === 'OVERALL');
        if (!overall) continue;
        const pE = num(overall.exposedRate);
        const pC = num(overall.baselineRate);
        const n = overall.surveyResponses / 2;
        const half = n > 0 ? 1.645 * Math.sqrt((pE * (1 - pE)) / n + (pC * (1 - pC)) / n) : 0;
        const abs = num(overall.absoluteLift);
        const m = measureOf({ absoluteLift: abs, relativeLift: num(overall.relativeLift), headroomLift: num(overall.headroomLift), ci: [abs - half, abs + half], baselineRate: pC }, measure);
        const sliceRows = slice === 'OVERALL' ? [] : rows.filter((r) => r.metric === metric && r.slice === slice);
        const result: LiftMetricResult = {
          metric,
          baselineRate: pC,
          exposedRate: pE,
          absoluteLift: abs,
          relativeLift: num(overall.relativeLift),
          headroomLift: num(overall.headroomLift),
          ci: m.ci,
          significant: overall.significant,
          responses: overall.surveyResponses,
          slices: sliceRows.map((r) => {
            const enough = enoughResponses(r.surveyResponses);
            const v = measureOf({ absoluteLift: num(r.absoluteLift), relativeLift: num(r.relativeLift), headroomLift: num(r.headroomLift), ci: [0, 0], baselineRate: num(r.baselineRate) }, measure).value;
            return { value: r.sliceValue, responses: r.surveyResponses, enough, lift: enough ? v : null, significant: enough && r.significant };
          }),
        };
        base.metrics.push(result);
        base.surveyResponses = Math.max(base.surveyResponses, overall.surveyResponses);
      }
      base.empty = base.metrics.length === 0;
    }
    if (searchFlight && tab === 'YT_DG') {
      const rows = await tx.liftResult.findMany({ where: { flightId: searchFlight.id, scope: 'YOUTUBE_DEMAND_GEN', metric: 'SEARCH_LIFT' } });
      if (rows.length) {
        base.search = {
          groups: s.searchTerms.map((g) => {
            const r = rows.find((x) => x.sliceValue === `group-${g.ordinal}`);
            return { terms: g.terms, relUplift: num(r?.relativeLift), significant: r?.significant ?? false };
          }),
        };
        base.empty = false;
      }
    }
    return base;
  });
}

export { EXP_MSG };
export type { Prisma };
