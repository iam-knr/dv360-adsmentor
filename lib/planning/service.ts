import 'server-only';
// Plan services (module 04 4.1 to 4.7). Reads run in the viewer's sandbox; every write goes through withChangeLog with
// `entityType = PLAN` (4.10). Saving always runs the forecast and stores one snapshot (4.2); the sim clock decides
// "locked" (PLN-002), "Saved N days ago" and "Forecast as of".
import type { Plan, PlanRow, Prisma } from '@prisma/client';
import type { SessionUser } from '@/lib/auth/types';
import { withChangeLog } from '@/lib/changelog';
import type { Tx } from '@/lib/db';
import {
  asResult,
  changeCtx,
  conflict,
  invalid,
  notFound,
  ServiceFailure,
  type Result,
  type ServiceCtx,
} from '@/lib/campaigns/service-kit';
import { addDaysIso } from '@/lib/metrics/date-range';
import type { Issue } from '@/lib/validation/types';
import {
  countryForCurrency,
  DEFAULT_DEMOGRAPHICS,
  planCountry,
  type PlanDemographics,
} from './countries';
import { normalizePlanColumns } from './columns';
import { forecastPlan } from './forecast';
import {
  canWritePlans,
  loadAdvertiser,
  marketSeed,
  parseIdRef,
  readCtx,
  simToday,
  whereId,
  writeCtx,
  type AdvertiserRow,
} from './guard';
import { PLAN_PARAMS } from './params';
import {
  additionalOf,
  dbDate,
  demographicsOf,
  forecastFromRow,
  forecastInputOf,
  forecastRowData,
  iso,
  rowDto,
} from './persist';
import { planCsv } from './table';
import {
  convertIssues,
  lockedIssue,
  planHeaderIssues,
  planRowCapIssues,
  planRowIssues,
} from './rules';
import {
  CHANNEL_LABEL,
  LOCKED_CPM_METHODS,
  type PlanAdditional,
  type PlanBuyingMethodKey,
  type PlanChannelKey,
  type PlanDto,
  type PlanListRow,
  type PlanRowInput,
  type PlanStatusKey,
} from './types';

const toWire = (i: Issue) => ({
  path: i.path,
  severity: i.severity,
  code: i.ruleId,
  message: i.message,
});
const fail = (issues: Issue[]) => new ServiceFailure('INVALID', issues.map(toWire));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** `New Plan (Oct 29, 2026)` (PLN-001). */
export function defaultPlanName(today: string): string {
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  return `New Plan (${MONTHS[m - 1]} ${d}, ${y})`;
}

const isLocked = (plan: Pick<Plan, 'startDate'>, today: string): boolean =>
  iso(plan.startDate) < today;

type PlanFull = Plan & { rows: PlanRow[] };

async function loadPlanRow(tx: Tx, advertiserId: string, planId: string): Promise<PlanFull> {
  const ref = parseIdRef(planId);
  const plan = ref
    ? await tx.plan.findFirst({
        where: { ...whereId(ref), advertiserId },
        include: { rows: { orderBy: { ordinal: 'asc' } } },
      })
    : null;
  if (!plan) throw notFound();
  return plan;
}

async function toDto(
  tx: Tx,
  ctx: ServiceCtx,
  adv: AdvertiserRow,
  plan: PlanFull,
): Promise<PlanDto> {
  const snap = await tx.planForecast.findFirst({
    where: { planId: plan.id },
    orderBy: { asOf: 'desc' },
  });
  const today = simToday(ctx, adv);
  const campaign = plan.convertedCampaignId
    ? await tx.campaign.findUnique({
        where: { id: plan.convertedCampaignId },
        select: { publicId: true },
      })
    : null;
  return {
    id: plan.id,
    publicId: plan.publicId.toString(),
    header: {
      name: plan.name,
      location: plan.locationCountry,
      currencyCode: plan.currencyCode,
      dates: { start: iso(plan.startDate), end: iso(plan.endDate) },
      demographics: demographicsOf(plan),
      additional: additionalOf(plan),
      channels: plan.channels,
    },
    forecast: snap ? forecastFromRow(snap) : null,
    rows: plan.rows.map(rowDto),
    savedAt: plan.savedAtSim ? plan.savedAtSim.toISOString() : null,
    locked: isLocked(plan, today),
    stale: plan.forecastStale,
    status: plan.status,
    convertedCampaignId: plan.convertedCampaignId,
    convertedCampaignPublicId: campaign ? campaign.publicId.toString() : null,
    version: plan.version,
    canWrite: canWritePlans(ctx.user),
    simToday: today,
  };
}

// ---------------------------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------------------------

export interface PlanList {
  rows: PlanListRow[];
  total: number;
  canWrite: boolean;
  currencyCode: string;
}

export async function listPlans(
  user: SessionUser,
  aid: string,
  q: { status?: PlanStatusKey[] } = {},
): Promise<PlanList> {
  return readCtx(user, async (tx) => {
    const adv = await loadAdvertiser(tx, aid);
    const where: Prisma.PlanWhereInput = { advertiserId: adv.id };
    if (q.status && q.status.length && q.status.length < 2) where.status = { in: q.status };
    const plans = await tx.plan.findMany({ where, orderBy: { name: 'asc' } });
    const rows: PlanListRow[] = plans.map((p) => ({
      id: p.id,
      publicId: p.publicId.toString(),
      name: p.name,
      totalBudget: p.totalBudget == null ? null : Number(p.totalBudget),
      currencyCode: p.currencyCode,
      startDate: iso(p.startDate),
      endDate: iso(p.endDate),
      channels: p.channels.map((c) => CHANNEL_LABEL[c]),
      status: p.status,
    }));
    return {
      rows,
      total: rows.length,
      canWrite: canWritePlans(user),
      currencyCode: adv.currencyCode,
    };
  });
}

export async function getPlan(user: SessionUser, aid: string, planId: string): Promise<PlanDto> {
  return readCtx(user, async (tx, ctx) => {
    const adv = await loadAdvertiser(tx, aid);
    const plan = await loadPlanRow(tx, adv.id, planId);
    return toDto(tx, ctx, adv, plan);
  });
}

// ---------------------------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------------------------

export interface CreatePlanInput {
  name?: string;
  location?: string;
  currencyCode?: string;
  start?: string;
  end?: string;
  demographics?: PlanDemographics;
  channels?: PlanChannelKey[];
}

/** PLN-001, 4.2: defaults of a new plan. */
export async function createPlan(
  user: SessionUser,
  aid: string,
  input: CreatePlanInput = {},
): Promise<Result<{ id: string; publicId: string }>> {
  return asResult(async () => {
    const data = await writeCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, aid);
      const today = simToday(ctx, adv);
      const country = input.location
        ? planCountry(input.location)
        : countryForCurrency(adv.currencyCode);
      const start = input.start ?? addDaysIso(today, 1);
      const end = input.end ?? addDaysIso(start, 30);
      const demographics = input.demographics ?? DEFAULT_DEMOGRAPHICS;
      const name = (input.name ?? '').trim() || defaultPlanName(today);
      const issues = planHeaderIssues({
        name,
        location: country?.code ?? '',
        start,
        end,
        ageMin: demographics.ageMin,
        ageMax: demographics.ageMax,
        today,
        checkStart: true,
      });
      if (issues.some((i) => i.blocking)) throw fail(issues);
      const channels = input.channels?.length ? input.channels : (['DIGITAL'] as PlanChannelKey[]);
      const created = await withChangeLog(
        changeCtx(ctx, tx),
        { type: 'PLAN', chain: { advertiserId: adv.id } },
        (t) =>
          t.plan.create({
            data: {
              sandboxId: ctx.sandboxId,
              advertiserId: adv.id,
              name,
              status: 'PLANNED',
              locationCountry: country?.code ?? 'SG',
              currencyCode: input.currencyCode ?? adv.currencyCode,
              startDate: dbDate(start),
              endDate: dbDate(end),
              channels,
              demographics: demographics as unknown as Prisma.InputJsonValue,
              additionalSettings: {
                frequencyGoal: 3,
                reachBasis: 'CENSUS',
                includeYoutube: true,
              },
              savedAt: new Date(),
              savedAtSim: ctx.simNow,
            },
            select: { id: true, publicId: true },
          }),
      );
      return { id: created.id, publicId: created.publicId.toString() };
    });
    return { data };
  });
}

// ---------------------------------------------------------------------------------------------
// Update (Save)
// ---------------------------------------------------------------------------------------------

export interface UpdatePlanInput {
  id: string;
  expectedVersion?: number;
  name?: string;
  location?: string;
  dates?: { start: string; end: string };
  demographics?: PlanDemographics;
  additional?: PlanAdditional;
  rows?: PlanRowInput[];
  note?: string;
}

const methodPricing = (m: PlanBuyingMethodKey): string =>
  m === 'OPEN_AUCTION' || m === 'PRIVATE_AUCTION' ? 'Auction' : 'Fixed';

/** Run the forecast on the stored plan and replace its snapshot. Called inside the plan's change-log mutation. */
async function refreshForecast(tx: Tx, ctx: ServiceCtx, planId: string): Promise<void> {
  const full = await tx.plan.findUniqueOrThrow({
    where: { id: planId },
    include: { rows: { orderBy: { ordinal: 'asc' } } },
  });
  const seed = await marketSeed(tx, ctx.sandboxId);
  const f = forecastPlan(forecastInputOf(seed, full, full.rows, ctx.simNow.toISOString()));
  await tx.planForecast.deleteMany({ where: { planId } });
  await tx.planForecast.create({ data: forecastRowData(ctx.sandboxId, planId, f) });
  const total = full.rows.reduce((s, r) => s + Number(r.budgetTotal), 0);
  await tx.plan.update({
    where: { id: planId },
    data: {
      totalBudget: full.rows.length ? Math.round(total * 100) / 100 : null,
      forecastStale: false,
      savedAt: new Date(),
      savedAtSim: ctx.simNow,
    },
  });
}

export async function updatePlan(
  user: SessionUser,
  aid: string,
  input: UpdatePlanInput,
): Promise<Result<{ plan: PlanDto }>> {
  return asResult(async () => {
    const data = await writeCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, aid);
      const plan = await loadPlanRow(tx, adv.id, input.id);
      const today = simToday(ctx, adv);
      if (plan.status !== 'PLANNED' || isLocked(plan, today)) throw fail([lockedIssue()]);
      if (input.expectedVersion !== undefined && input.expectedVersion !== plan.version)
        throw conflict();

      const name = input.name ?? plan.name;
      const location = input.location ?? plan.locationCountry;
      const start = input.dates?.start ?? iso(plan.startDate);
      const end = input.dates?.end ?? iso(plan.endDate);
      const demo = input.demographics ?? demographicsOf(plan);
      const additional = input.additional ?? additionalOf(plan);
      const rowsIn = input.rows;
      const issues: Issue[] = [
        ...planHeaderIssues({
          name,
          location,
          start,
          end,
          ageMin: demo.ageMin,
          ageMax: demo.ageMax,
          today,
          checkStart: start !== iso(plan.startDate) && start < today,
          frequencyGoal: additional.frequencyGoal,
        }),
      ];
      if (rowsIn) {
        issues.push(...planRowCapIssues(rowsIn.length));
        rowsIn.forEach((r, i) =>
          issues.push(
            ...planRowIssues(
              {
                name: r.name,
                buyingMethod: r.buyingMethod,
                dealId: r.dealId ?? null,
                start: r.startDate,
                end: r.endDate,
                budgetNet: r.budgetNet,
                maxCpm: r.maxCpm ?? null,
                planStart: start,
                planEnd: end,
              },
              i,
            ),
          ),
        );
      }
      if (issues.some((i) => i.blocking)) throw invalid(issues);

      const changed =
        name !== plan.name ||
        location !== plan.locationCountry ||
        start !== iso(plan.startDate) ||
        end !== iso(plan.endDate) ||
        JSON.stringify(demo) !== JSON.stringify(demographicsOf(plan)) ||
        JSON.stringify(additional) !== JSON.stringify(additionalOf(plan)) ||
        (rowsIn !== undefined && rowsChanged(plan.rows, rowsIn)) ||
        plan.forecastStale;
      if (!changed) return toDto(tx, ctx, adv, plan);

      await withChangeLog(
        changeCtx(ctx, tx, { ...(input.note ? { note: input.note } : {}) }),
        {
          type: 'PLAN',
          id: plan.id,
          publicId: plan.publicId,
          name: plan.name,
          chain: { advertiserId: adv.id },
        },
        async (t) => {
          await t.plan.update({
            where: { id: plan.id },
            data: {
              name,
              locationCountry: location,
              startDate: dbDate(start),
              endDate: dbDate(end),
              demographics: demo as unknown as Prisma.InputJsonValue,
              additionalSettings: additional as unknown as Prisma.InputJsonValue,
              frequencyGoal: additional.frequencyGoal,
              reachBasis: additional.reachBasis,
              includeYoutube: additional.includeYoutube,
              version: { increment: 1 },
            },
          });
          if (rowsIn) await writeRows(t, ctx, plan, rowsIn);
          await refreshForecast(t, ctx, plan.id);
          return plan.id;
        },
      );
      const fresh = await loadPlanRow(tx, adv.id, plan.id);
      return toDto(tx, ctx, adv, fresh);
    });
    return { data: { plan: data } };
  });
}

function rowsChanged(existing: PlanRow[], input: PlanRowInput[]): boolean {
  if (existing.length !== input.length) return true;
  return input.some((r, i) => {
    const e = existing[i];
    if (!e || r.id !== e.id) return true;
    return (
      r.name !== e.name ||
      r.buyingMethod !== e.buyingMethod ||
      (r.dealId ?? null) !== e.dealId ||
      r.startDate !== iso(e.startDate) ||
      r.endDate !== iso(e.endDate) ||
      r.budgetNet !== Number(e.budgetNet) ||
      (r.maxCpm ?? null) !== (e.maxCpm == null ? null : Number(e.maxCpm)) ||
      JSON.stringify(r.locations ?? e.locations) !== JSON.stringify(e.locations) ||
      JSON.stringify(r.audienceRefs ?? e.audienceRefs ?? []) !==
        JSON.stringify(e.audienceRefs ?? []) ||
      JSON.stringify(r.targeting ?? e.targeting ?? {}) !== JSON.stringify(e.targeting ?? {})
    );
  });
}

async function writeRows(
  t: Tx,
  ctx: ServiceCtx,
  plan: PlanFull,
  rows: PlanRowInput[],
): Promise<void> {
  const keep = new Set(rows.map((r) => r.id).filter((x): x is string => !!x));
  const existing = new Map(plan.rows.map((r) => [r.id, r]));
  await t.planRow.deleteMany({ where: { planId: plan.id, id: { notIn: [...keep] } } });
  // Park the survivors on high ordinals so the (planId, ordinal) key never collides while rows move.
  for (const [i, id] of [...keep].entries())
    await t.planRow.update({ where: { id }, data: { ordinal: 10_000 + i } });
  for (const [ordinal, r] of rows.entries()) {
    const prior = r.id ? existing.get(r.id) : undefined;
    const fee = prior ? Number(prior.feePct) : PLAN_PARAMS.fees.default;
    const locked = LOCKED_CPM_METHODS.includes(r.buyingMethod);
    const data = {
      ordinal,
      name: r.name.trim(),
      buyingMethod: r.buyingMethod,
      locations: r.locations?.length ? r.locations : [plan.locationCountry],
      startDate: dbDate(r.startDate),
      endDate: dbDate(r.endDate),
      targeting: (r.targeting ?? {}) as Prisma.InputJsonValue,
      audienceRefs: (r.audienceRefs ?? []) as Prisma.InputJsonValue,
      pricing: methodPricing(r.buyingMethod),
      dealId: r.dealId ?? null,
      feePct: fee,
      budgetNet: r.budgetNet,
      budgetTotal: Math.round(r.budgetNet * (1 + fee) * 100) / 100,
      maxCpm: r.buyingMethod === 'OPEN_AUCTION' ? (r.maxCpm ?? null) : null,
      isCpmLocked: locked,
    };
    if (prior) await t.planRow.update({ where: { id: prior.id }, data });
    else await t.planRow.create({ data: { ...data, sandboxId: ctx.sandboxId, planId: plan.id } });
  }
}

// ---------------------------------------------------------------------------------------------
// Copy and remove
// ---------------------------------------------------------------------------------------------

const daysBetween = (a: string, b: string): number =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

export async function copyPlan(
  user: SessionUser,
  aid: string,
  input: { id: string; name?: string; startDate: string; endDate: string },
): Promise<Result<{ id: string; publicId: string }>> {
  return asResult(async () => {
    const data = await writeCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, aid);
      const src = await loadPlanRow(tx, adv.id, input.id);
      const today = simToday(ctx, adv);
      const name = (input.name ?? '').trim() || `Copy of ${src.name}`;
      const issues = planHeaderIssues({
        name,
        location: src.locationCountry,
        start: input.startDate,
        end: input.endDate,
        ageMin: demographicsOf(src).ageMin,
        ageMax: demographicsOf(src).ageMax,
        today,
        checkStart: true,
      });
      if (issues.some((i) => i.blocking)) throw fail(issues);
      const offset = daysBetween(iso(src.startDate), input.startDate);
      const created = await withChangeLog(
        changeCtx(ctx, tx),
        { type: 'PLAN', chain: { advertiserId: adv.id } },
        async (t) => {
          const plan = await t.plan.create({
            data: {
              sandboxId: ctx.sandboxId,
              advertiserId: adv.id,
              name,
              status: 'PLANNED',
              locationCountry: src.locationCountry,
              currencyCode: src.currencyCode,
              startDate: dbDate(input.startDate),
              endDate: dbDate(input.endDate),
              channels: src.channels,
              demographics: (src.demographics ?? DEFAULT_DEMOGRAPHICS) as Prisma.InputJsonValue,
              additionalSettings: src.additionalSettings ?? {},
              frequencyGoal: src.frequencyGoal,
              reachBasis: src.reachBasis,
              includeYoutube: src.includeYoutube,
              savedAt: new Date(),
              savedAtSim: ctx.simNow,
            },
            select: { id: true, publicId: true },
          });
          for (const r of src.rows) {
            const s = addDaysIso(iso(r.startDate), offset);
            const e = addDaysIso(iso(r.endDate), offset);
            await t.planRow.create({
              data: {
                sandboxId: ctx.sandboxId,
                planId: plan.id,
                ordinal: r.ordinal,
                name: r.name,
                buyingMethod: r.buyingMethod,
                locations: r.locations,
                startDate: dbDate(s < input.startDate ? input.startDate : s),
                endDate: dbDate(e > input.endDate ? input.endDate : e),
                targeting: r.targeting ?? {},
                audienceRefs: r.audienceRefs ?? [],
                pricing: r.pricing,
                dealId: r.dealId,
                feePct: r.feePct,
                budgetNet: r.budgetNet,
                budgetTotal: r.budgetTotal,
                maxCpm: r.maxCpm,
                isCpmLocked: r.isCpmLocked,
              },
            });
          }
          await refreshForecast(t, ctx, plan.id);
          return plan;
        },
      );
      return { id: created.id, publicId: created.publicId.toString() };
    });
    return { data };
  });
}

export async function removePlan(
  user: SessionUser,
  aid: string,
  id: string,
): Promise<Result<null>> {
  return asResult(async () => {
    await writeCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, aid);
      const plan = await loadPlanRow(tx, adv.id, id);
      await withChangeLog(
        changeCtx(ctx, tx),
        {
          type: 'PLAN',
          id: plan.id,
          publicId: plan.publicId,
          name: plan.name,
          chain: { advertiserId: adv.id },
        },
        (t) => t.plan.delete({ where: { id: plan.id }, select: { id: true } }),
      );
    });
    return { data: null };
  });
}

// ---------------------------------------------------------------------------------------------
// Convert to campaign (4.7)
// ---------------------------------------------------------------------------------------------

export interface ConvertResult {
  campaignId: string;
  campaignPublicId: string;
  ioId: string;
  lineItemIds: string[];
}

export async function convertPlan(
  user: SessionUser,
  aid: string,
  input: { id: string; target: 'CAMPAIGN' | 'IO'; campaignId?: string; note?: string },
): Promise<Result<ConvertResult>> {
  return asResult(async () => {
    const data = await writeCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, aid);
      const plan = await loadPlanRow(tx, adv.id, input.id);
      const today = simToday(ctx, adv);
      let existingCampaign: { id: string; publicId: bigint } | null = null;
      if (input.target === 'IO' && input.campaignId) {
        const ref = parseIdRef(input.campaignId);
        existingCampaign = ref
          ? await tx.campaign.findFirst({
              where: { ...whereId(ref), advertiserId: adv.id },
              select: { id: true, publicId: true },
            })
          : null;
      }
      const issues = convertIssues({
        status: plan.status,
        locked: isLocked(plan, today),
        rowCount: plan.rows.length,
        target: input.target,
        campaignFound: !!existingCampaign,
      });
      if (issues.length) throw fail(issues);

      const total = plan.rows.reduce((s, r) => s + Number(r.budgetTotal), 0);
      const digitalOnly = plan.channels.every((c) => c === 'DIGITAL');
      const geo = await tx.targetingOption.findFirst({
        where: { dimension: 'GEOGRAPHY', code: plan.locationCountry },
        select: { id: true },
      });
      const start = iso(plan.startDate);
      const end = iso(plan.endDate);
      const cctx = changeCtx(ctx, tx, { ...(input.note ? { note: input.note } : {}) });

      const campaign =
        existingCampaign ??
        (await withChangeLog(cctx, { type: 'CAMPAIGN', chain: { advertiserId: adv.id } }, (t) =>
          t.campaign.create({
            data: {
              sandboxId: ctx.sandboxId,
              advertiserId: adv.id,
              name: plan.name,
              status: 'ACTIVE',
              goal: digitalOnly ? 'AWARENESS' : 'ONLINE_ACTION',
              plannedSpend: total,
              plannedStart: dbDate(start),
              plannedEnd: dbDate(end),
            },
            select: { id: true, publicId: true },
          }),
        ));
      const io = await withChangeLog(
        cctx,
        { type: 'INSERTION_ORDER', chain: { advertiserId: adv.id, campaignId: campaign.id } },
        async (t) => {
          const created = await t.insertionOrder.create({
            data: {
              sandboxId: ctx.sandboxId,
              campaignId: campaign.id,
              advertiserId: adv.id,
              name: `${plan.name} IO`,
              status: 'DRAFT',
              type: 'STANDARD',
              objective: 'NONE',
              pacingPeriod: 'FLIGHT',
              pacingType: 'EVEN',
            },
            select: { id: true, publicId: true },
          });
          await t.budgetSegment.create({
            data: {
              sandboxId: ctx.sandboxId,
              ioId: created.id,
              ordinal: 0,
              amount: total,
              startDate: dbDate(start),
              endDate: dbDate(end),
            },
          });
          return created;
        },
      );
      const lineItemIds: string[] = [];
      for (const r of plan.rows) {
        const li = await withChangeLog(
          cctx,
          {
            type: 'LINE_ITEM',
            chain: { advertiserId: adv.id, campaignId: campaign.id, ioId: io.id },
          },
          async (t) => {
            const created = await t.lineItem.create({
              data: {
                sandboxId: ctx.sandboxId,
                ioId: io.id,
                campaignId: campaign.id,
                advertiserId: adv.id,
                name: r.name,
                status: 'DRAFT',
                type: 'DISPLAY',
                flightMode: 'CUSTOM',
                flightStart: r.startDate,
                flightEnd: r.endDate,
                budgetMode: 'FIXED',
                budgetAmount: r.budgetNet,
                pacingType: 'EVEN',
                bidKind: 'FIXED',
                fixedBidCpm: r.maxCpm ?? undefined,
              },
              select: { id: true },
            });
            if (geo)
              await t.targetingAssignment.create({
                data: {
                  sandboxId: ctx.sandboxId,
                  ownerType: 'LINE_ITEM',
                  lineItemId: created.id,
                  dimension: 'GEOGRAPHY',
                  mode: 'INCLUDE',
                  optionId: geo.id,
                },
              });
            return created;
          },
        );
        lineItemIds.push(li.id);
      }
      await withChangeLog(
        cctx,
        {
          type: 'PLAN',
          id: plan.id,
          publicId: plan.publicId,
          name: plan.name,
          chain: { advertiserId: adv.id },
        },
        (t) =>
          t.plan.update({
            where: { id: plan.id },
            data: {
              status: 'TRAFFICKED',
              convertedCampaignId: campaign.id,
              version: { increment: 1 },
            },
            select: { id: true },
          }),
        { summary: 'Plan trafficked' },
      );
      return {
        campaignId: campaign.id,
        campaignPublicId: campaign.publicId.toString(),
        ioId: io.id,
        lineItemIds,
      };
    });
    return { data };
  });
}

// ---------------------------------------------------------------------------------------------
// Columns (SavedView grid = PLAN), CSV, deals for the buying-method picker
// ---------------------------------------------------------------------------------------------

/** The user's saved column order for the plan table (UI state, DM 5.14), or the default. */
export async function getPlanColumns(user: SessionUser, aid: string): Promise<string[]> {
  return readCtx(user, async (tx) => {
    const adv = await loadAdvertiser(tx, aid);
    const view = await tx.savedView.findFirst({
      where: { advertiserId: adv.id, ownerUserId: user.id, grid: 'PLAN' },
      orderBy: { updatedAt: 'desc' },
    });
    const cols = (view?.columns ?? null) as { order?: string[] } | null;
    return normalizePlanColumns(cols?.order);
  });
}

export async function savePlanColumns(
  user: SessionUser,
  aid: string,
  order: string[],
): Promise<Result<{ order: string[] }>> {
  return asResult(async () => {
    const saved = await readCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, aid);
      const clean = normalizePlanColumns(order);
      const view = await tx.savedView.findFirst({
        where: { advertiserId: adv.id, ownerUserId: user.id, grid: 'PLAN' },
        select: { id: true },
      });
      const columns = { order: clean } as Prisma.InputJsonValue;
      if (view)
        await tx.savedView.update({
          where: { id: view.id },
          data: { columns, version: { increment: 1 } },
        });
      else
        await tx.savedView.create({
          data: {
            sandboxId: ctx.sandboxId,
            advertiserId: adv.id,
            ownerUserId: user.id,
            grid: 'PLAN',
            name: 'Default',
            columns,
            isPinned: true,
          },
        });
      return clean;
    });
    return { data: { order: saved } };
  });
}

export async function downloadPlanCsv(
  user: SessionUser,
  aid: string,
  planId: string,
): Promise<{ fileName: string; body: string }> {
  const plan = await getPlan(user, aid, planId);
  const columns = await getPlanColumns(user, aid);
  const fileName = `${plan.header.name.replace(/[^A-Za-z0-9]+/g, '_')}_${plan.publicId}.csv`;
  return { fileName, body: planCsv(plan, columns) };
}

export interface PlanDealChoice {
  id: string;
  name: string;
  dealType: string;
}

/** Deals of the advertiser's partner, read only, for the Deal field of a plan line item (spec 2.4). */
export async function listPlanDeals(user: SessionUser, aid: string): Promise<PlanDealChoice[]> {
  return readCtx(user, async (tx) => {
    const adv = await loadAdvertiser(tx, aid);
    const deals = await tx.inventorySourceDeal.findMany({
      where: { partnerId: adv.partnerId },
      select: { id: true, name: true, dealType: true },
      orderBy: { name: 'asc' },
      take: 200,
    });
    return deals.map((d) => ({ id: d.id, name: d.name, dealType: String(d.dealType) }));
  });
}
