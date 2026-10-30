// Lift study eligibility and survey results against the database (module 17 4.3, engine 6.8). Shared by the services,
// the engine lifecycle (`advanceLiftStudies`) and the seed. No `server-only` import: the seed runs under tsx.
import type { BrandLiftMetric, LiftSlice, LiftStrength, LiftType, Prisma } from '@prisma/client';
import { defaultParams } from '@/lib/engine/params/load';
import { FxRateMissingError, fxRate, loadFxTable } from '@/lib/metrics/fx';
import { addDaysIso } from '@/lib/metrics/date-range';
import {
  BRAND_MEASURABLE_TYPES,
  SEARCH_MEASURABLE_TYPES,
  YT_DG_TYPES,
} from './constants';
import { estimateReach, reachedUsers, sumMetrics, type Db } from './data';
import {
  enoughResponses,
  fixedSlices,
  liftRequirement,
  pctComplete,
  relLift,
  searchUplift,
  simulateSurvey,
  SLICES_CROSS,
  SLICES_YT_DG,
  strengthFactor,
  windowDays,
  type LiftParams,
  type SliceDef,
} from './lift-math';

export const liftParams = (): LiftParams => defaultParams().params.lift;

export const measurableTypesOf = (t: LiftType): readonly string[] =>
  t === 'BRAND_LIFT' ? BRAND_MEASURABLE_TYPES : SEARCH_MEASURABLE_TYPES;

export interface StudyLi {
  id: string;
  ioId: string;
  name: string;
  type: string;
  status: string;
}

export async function loadStudyLis(db: Db, ioIds: string[]): Promise<StudyLi[]> {
  if (ioIds.length === 0) return [];
  return db.lineItem.findMany({
    where: { ioId: { in: ioIds }, status: { not: 'ARCHIVED' } },
    orderBy: { publicId: 'asc' },
    select: { id: true, ioId: true, name: true, type: true, status: true },
  });
}

/** Multiplier from INR to the advertiser currency (1 when no rate is known). */
export async function inrMultiplier(db: Db, currency: string): Promise<number> {
  if (currency === 'INR') return 1;
  try {
    return fxRate(await loadFxTable(db), 'INR', currency);
  } catch (e) {
    if (e instanceof FxRateMissingError) return 1;
    throw e;
  }
}

export interface TypeEligibility {
  type: LiftType;
  eligible: boolean;
  measurableLis: number;
  requiredMediaCost: number;
  yourMediaCost: number;
  window: [string, string];
}

/** Eligibility per lift type for the selected IOs: measurable line items and trailing media cost against the requirement. */
export async function eligibilityFor(
  db: Db,
  args: { ioIds: string[]; types: LiftType[]; strength: LiftStrength; today: string; currency: string },
): Promise<TypeEligibility[]> {
  const lis = await loadStudyLis(db, args.ioIds);
  const inr = await inrMultiplier(db, args.currency);
  const out: TypeEligibility[] = [];
  for (const type of args.types) {
    const allowed = measurableTypesOf(type);
    const mine = lis.filter((l) => allowed.includes(l.type));
    const days = windowDays(type);
    const cost = (await sumMetrics(db, mine.map((l) => l.id), addDaysIso(args.today, -(days - 1)), args.today)).mediaCost;
    const required = liftRequirement(type, args.strength, liftParams(), inr);
    out.push({
      type,
      eligible: mine.length > 0 && cost >= required,
      measurableLis: mine.length,
      requiredMediaCost: required,
      yourMediaCost: Math.round(cost * 100) / 100,
      window: [args.today, addDaysIso(args.today, days - 1)],
    });
  }
  return out;
}

export interface FlightProgress {
  mediaCostSoFar: number;
  pct: number;
}

/** Media cost of the measurable line items since the flight began. */
export async function flightProgress(
  db: Db,
  args: { lis: StudyLi[]; type: LiftType; startDate: string; today: string; required: number },
): Promise<FlightProgress> {
  const allowed = measurableTypesOf(args.type);
  const ids = args.lis.filter((l) => allowed.includes(l.type)).map((l) => l.id);
  const cost = (await sumMetrics(db, ids, args.startDate, args.today)).mediaCost;
  return { mediaCostSoFar: Math.round(cost * 100) / 100, pct: pctComplete(cost, args.required) };
}

export const milestone = (pct: number): number => Math.floor(pct / 25);

interface StudyShape {
  id: string;
  brandLiftMetrics: BrandLiftMetric[];
  strength: LiftStrength;
}

type ScopeKey = 'YOUTUBE_DEMAND_GEN' | 'CROSS_EXCHANGE';

/**
 * Write the survey (or search) results of a flight as of `today`. Idempotent: the same inputs write the same rows.
 * One scope per tab: YouTube and Demand Gen line items, and the other measurable line items (brand lift only).
 */
export async function writeFlightResults(
  db: Db,
  args: {
    sandboxId: string;
    study: StudyShape;
    flightId: string;
    type: LiftType;
    startDate: string;
    today: string;
    lis: StudyLi[];
    ioNames: Map<string, string>;
    groups: number;
    params?: LiftParams;
  },
): Promise<number> {
  const params = args.params ?? liftParams();
  const scopes: { key: ScopeKey; lis: StudyLi[] }[] = [
    { key: 'YOUTUBE_DEMAND_GEN', lis: args.lis.filter((l) => (YT_DG_TYPES as readonly string[]).includes(l.type)) },
  ];
  if (args.type === 'BRAND_LIFT') {
    scopes.push({
      key: 'CROSS_EXCHANGE',
      lis: args.lis.filter((l) => ['DISPLAY', 'VIDEO', 'AUDIO'].includes(l.type)),
    });
  }
  let written = 0;
  for (const scope of scopes) {
    if (scope.lis.length === 0) continue;
    const ids = scope.lis.map((l) => l.id);
    const sums = await sumMetrics(db, ids, args.startDate, args.today);
    const reach = estimateReach(await reachedUsers(db, ids, args.today), sums.impressions);
    const exposure = {
      reach,
      avgFrequency: reach > 0 ? sums.impressions / reach : 0,
      quality:
        sums.measurableImpressions > 0 ? sums.viewableImpressions / sums.measurableImpressions / 0.7 : 1,
    };
    const perArm = Math.floor(sums.mediaCost / params.costPerResponse / 2) * strengthFactor(args.study.strength);

    if (args.type === 'SEARCH_LIFT') {
      if (scope.key !== 'YOUTUBE_DEMAND_GEN') continue;
      const rels = args.study.brandLiftMetrics.map((m) => relLift(m, params, exposure));
      const brandRel = rels.length ? rels.reduce((a, b) => a + b, 0) / rels.length : relLift('AWARENESS', params, exposure);
      for (let g = 0; g < Math.max(1, args.groups); g++) {
        const u = searchUplift(brandRel, g, `${args.sandboxId}|${args.study.id}`);
        await upsertResult(db, args.sandboxId, args.flightId, scope.key, 'SEARCH_LIFT', 'OVERALL', `group-${g}`, {
          surveyResponses: 0,
          relativeLift: u.relUplift,
          significant: u.significant,
        });
        written++;
      }
      continue;
    }

    const sliceList = scope.key === 'YOUTUBE_DEMAND_GEN' ? SLICES_YT_DG : SLICES_CROSS;
    for (const slice of sliceList) {
      const defs = await sliceDefs(db, slice, scope.lis, args.ioNames, args.today, args.startDate);
      for (const d of defs) {
        for (const metric of args.study.brandLiftMetrics) {
          const n = Math.floor(perArm * d.share);
          const r = simulateSurvey({
            metric,
            params,
            exposure,
            responsesPerArm: n,
            sliceMult: d.mult,
            seed: `${args.sandboxId}|lift|${args.study.id}|${metric}|${slice}|${d.value}|${scope.key}`,
          });
          await upsertResult(db, args.sandboxId, args.flightId, scope.key, metric, slice, d.value, {
            surveyResponses: r.responses,
            absoluteLift: r.absoluteLift,
            relativeLift: r.relativeLift,
            headroomLift: r.headroomLift,
            baselineRate: r.baselineRate,
            exposedRate: r.exposedRate,
            significant: r.significant,
          });
          written++;
        }
      }
    }
  }
  return written;
}

const CAP_DYNAMIC = 12;

async function sliceDefs(
  db: Db,
  slice: LiftSlice,
  lis: StudyLi[],
  ioNames: Map<string, string>,
  today: string,
  startDate: string,
): Promise<SliceDef[]> {
  const fixed = fixedSlices(slice);
  if (fixed) return fixed;
  const byCost = async (groups: Map<string, string[]>): Promise<SliceDef[]> => {
    const costs: [string, number][] = [];
    for (const [label, ids] of groups) {
      costs.push([label, (await sumMetrics(db, ids, startDate, today)).mediaCost]);
    }
    const top = costs.sort((a, b) => b[1] - a[1]).slice(0, CAP_DYNAMIC);
    const total = top.reduce((s, c) => s + c[1], 0) || 1;
    return top.map(([value, c]) => ({ value, share: c / total, mult: 1 }));
  };
  if (slice === 'INSERTION_ORDER') {
    const g = new Map<string, string[]>();
    for (const l of lis) {
      const k = ioNames.get(l.ioId) ?? l.ioId;
      g.set(k, [...(g.get(k) ?? []), l.id]);
    }
    return byCost(g);
  }
  if (slice === 'LINE_ITEM') return byCost(new Map(lis.map((l) => [l.name, [l.id]])));
  if (slice === 'CREATIVE') {
    const rows = await db.creativeAssignment.findMany({
      where: { lineItemId: { in: lis.map((l) => l.id) } },
      select: { creative: { select: { name: true } } },
    });
    const names = [...new Set(rows.map((r) => r.creative.name))].slice(0, CAP_DYNAMIC);
    return names.map((value) => ({ value, share: 1 / names.length, mult: 1 }));
  }
  if (slice === 'YOUTUBE_AD_VIDEO') {
    const rows = await db.ad.findMany({
      where: { adGroup: { lineItemId: { in: lis.map((l) => l.id) } } },
      select: { name: true },
      take: CAP_DYNAMIC,
    });
    const names = [...new Set(rows.map((r) => r.name))];
    return names.map((value) => ({ value, share: 1 / names.length, mult: 1 }));
  }
  return [];
}

async function upsertResult(
  db: Db,
  sandboxId: string,
  flightId: string,
  scope: ScopeKey,
  metric: string,
  slice: LiftSlice,
  sliceValue: string,
  v: {
    surveyResponses: number;
    absoluteLift?: number;
    relativeLift?: number;
    headroomLift?: number;
    baselineRate?: number;
    exposedRate?: number;
    significant: boolean;
  },
): Promise<void> {
  const data: Prisma.LiftResultUncheckedUpdateInput = {
    surveyResponses: v.surveyResponses,
    absoluteLift: v.absoluteLift ?? null,
    relativeLift: v.relativeLift ?? null,
    headroomLift: v.headroomLift ?? null,
    baselineRate: v.baselineRate ?? null,
    exposedRate: v.exposedRate ?? null,
    significant: v.significant,
  };
  await db.liftResult.upsert({
    where: { flightId_scope_metric_slice_sliceValue: { flightId, scope, metric, slice, sliceValue } },
    create: { sandboxId, flightId, scope, metric, slice, sliceValue, ...(data as object) },
    update: data,
  });
}

export { enoughResponses };
