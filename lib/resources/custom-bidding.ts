import 'server-only';
// Custom bidding services of module 15 4.3 (M15-08): list, wizard draft, Test, Save, status, delete. Rules and
// multipliers only (Script is dormant, RC-037). A wizard row is a draft (`isDraft`) until step 3 saves it; editing a
// saved algorithm resets it to TRAINING and clears the test (CB-008).
import type { Prisma } from '@prisma/client';
import type { SessionUser } from '@/lib/auth/types';
import type { WireIssue } from '@/lib/campaigns/wire';
import { withChangeLog } from '@/lib/changelog';
import { withSandbox, type Tx } from '@/lib/db';
import {
  ACTIVITY_SIGNAL_PREFIX,
  DEFAULT_MIX,
  errorPctFor,
  isMultiplierKind,
  runTest,
  signalAllowed,
  type CbFormat,
  type CbModel,
  type CbMultiplierKindKey,
  type CbObjectiveKey,
  type CbTestResult,
  type SampleMix,
} from '@/lib/engine/bidding/customBidding';
import { validate } from '@/lib/validation/engine';
import type { Issue } from '@/lib/validation';
import {
  asResult,
  assertResourceRead,
  assertResourceWrite,
  changeCtx,
  conflict,
  idWhere,
  invalid,
  loadAdvertiser,
  loadPartner,
  notFound,
  resourceContext,
  serviceCtx,
  softIssues,
  type AdvertiserRow,
  type Result,
  type ServiceCtx,
} from './kit';
import { BASE_ERROR_PCT, readinessPct } from './custom-bidding-training';
import type { ResourceScope } from './lists';
import type {
  CbDeleteOutcome,
  CbDraftInput,
  CbOption,
  CbMultiplierWire,
  CbRow,
  CbRuleWire,
  CbStatusKey,
  CbTestWire,
  CbView,
  OwnerScopeKey,
  UsingLineItem,
  WriteMeta,
} from './wire';

const LI_FORMAT: Record<string, CbFormat> = {
  DISPLAY: 'DISPLAY',
  ADS_IN_MOBILE_APPS: 'DISPLAY',
  MOBILE_APP_INSTALL: 'DISPLAY',
  DOOH_DISPLAY: 'DISPLAY',
  DEMAND_GEN: 'DISPLAY',
  VIDEO: 'VIDEO',
  CTV: 'VIDEO',
  YT_VIDEO: 'VIDEO',
  YT_ON_CTV: 'VIDEO',
  DOOH_VIDEO: 'VIDEO',
  AUDIO: 'AUDIO',
  YT_AUDIO: 'AUDIO',
};

type AlgorithmFull = Prisma.CustomBiddingAlgorithmGetPayload<{
  include: {
    rules: true;
    multipliers: { include: { values: true } };
  };
}>;

const FULL_INCLUDE = {
  rules: { orderBy: { ordinal: 'asc' } },
  multipliers: {
    orderBy: { ordinal: 'asc' },
    include: { values: { orderBy: { valueKey: 'asc' } } },
  },
} satisfies Prisma.CustomBiddingAlgorithmInclude;

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

const num = (d: Prisma.Decimal | number): number => Number(d);

export function modelOf(
  rules: readonly CbRuleWire[],
  multipliers: readonly CbMultiplierWire[],
): CbModel {
  return {
    rules,
    multipliers: multipliers.flatMap((m) =>
      isMultiplierKind(m.kind) ? [{ kind: m.kind as CbMultiplierKindKey, values: m.values }] : [],
    ),
  };
}

function rulesOf(alg: AlgorithmFull): CbRuleWire[] {
  return alg.rules.map((r) => ({
    groupKey: r.groupKey,
    signalKey: r.signalKey ?? r.signal,
    value: r.value !== 'false',
    score: num(r.score),
  }));
}

function multipliersOf(alg: AlgorithmFull): CbMultiplierWire[] {
  return alg.multipliers.map((m) => ({
    kind: m.kind,
    values: m.values.map((v) => ({ valueKey: v.valueKey, multiplier: num(v.multiplier) })),
  }));
}

/** Stable text of the definition, to tell whether an edit changed what the model learns from. */
function fingerprint(
  objective: string,
  rules: readonly CbRuleWire[],
  multipliers: readonly CbMultiplierWire[],
): string {
  return JSON.stringify([
    objective,
    rules.map((r) => [r.groupKey, r.signalKey, r.value, r.score]),
    [...multipliers]
      .sort((a, b) => a.kind.localeCompare(b.kind))
      .map((m) => [
        m.kind,
        [...m.values]
          .sort((a, b) => a.valueKey.localeCompare(b.valueKey))
          .map((v) => [v.valueKey, v.multiplier]),
      ]),
  ]);
}

function checkDraft(
  ctx: ServiceCtx,
  adv: Pick<
    AdvertiserRow,
    'currencyCode' | 'timeZone' | 'demandGenFloodlightOptimization' | 'googleInventoryEnabled'
  >,
  input: CbDraftInput,
  mode: 'create' | 'edit',
): Issue[] {
  const vctx = resourceContext(ctx, adv, mode);
  const issues = validate(
    'customBidding',
    {
      name: input.name,
      objective: input.objective,
      source: 'RULES' as const,
      rules: input.rules.map((r) => ({
        groupKey: r.groupKey,
        signalKey: r.signalKey,
        score: r.score,
      })),
      multipliers: input.multipliers.map((m) => ({
        kind: m.kind,
        values: m.values.map((v) => ({ valueKey: v.valueKey, multiplier: v.multiplier })),
      })),
    },
    vctx,
    { trigger: 'save' },
  );
  // A rule signal must belong to the objective (the picker offers only those; this guards the API).
  if (input.objective) {
    input.rules.forEach((r, i) => {
      if (!signalAllowed(input.objective as CbObjectiveKey, r.signalKey)) {
        issues.push({
          ruleId: 'CB-004',
          severity: 'error',
          path: `rules[${i}].signalKey`,
          message: 'A selection is required',
          blocking: true,
        });
      }
    });
  }
  return issues;
}

/** Format mix and Floodlight activities of the advertiser (or every advertiser of the partner). */
async function sampleMixOf(
  tx: Tx,
  where: { advertiserId: string } | { partnerId: string },
): Promise<SampleMix> {
  const advertiserWhere: Prisma.AdvertiserWhereInput =
    'advertiserId' in where ? { id: where.advertiserId } : { partnerId: where.partnerId };
  const lis = await tx.lineItem.groupBy({
    by: ['type'],
    where: { status: { not: 'ARCHIVED' }, advertiser: advertiserWhere },
    _count: { _all: true },
  });
  const weights: Record<CbFormat, number> = { DISPLAY: 0, VIDEO: 0, AUDIO: 0 };
  for (const g of lis) {
    const f = LI_FORMAT[g.type];
    if (f) weights[f] += g._count._all;
  }
  const total = weights.DISPLAY + weights.VIDEO + weights.AUDIO;
  const activities = await tx.floodlightActivity.findMany({
    where: { group: { advertiser: advertiserWhere } },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  return {
    formatWeights: total === 0 ? DEFAULT_MIX.formatWeights : weights,
    activityIds: activities.map((a) => a.id),
  };
}

function mixWhere(alg: { advertiserId: string | null; partnerId: string | null }) {
  return alg.advertiserId
    ? { advertiserId: alg.advertiserId }
    : { partnerId: alg.partnerId as string };
}

function toTestWire(run: {
  ranAt: Date;
  sampleImpressions: bigint;
  scoreHistogram: Prisma.JsonValue | null;
  warnings: Prisma.JsonValue | null;
  passed: boolean;
}): CbTestWire {
  const h = (run.scoreHistogram ?? {}) as {
    bins?: number[];
    max?: number;
    matchedPct?: number;
    meanScore?: number;
    p90Score?: number;
  };
  return {
    sampleSize: Number(run.sampleImpressions),
    matchedPct: h.matchedPct ?? 0,
    histogram: h.bins ?? [],
    histogramMax: h.max ?? 0,
    meanScore: h.meanScore ?? 0,
    p90Score: h.p90Score ?? 0,
    warnings: (run.warnings ?? []) as CbTestWire['warnings'],
    passed: run.passed,
    ranAt: run.ranAt.toISOString(),
  };
}

const hardFailed = (t: { warnings: { kind: string }[] }): boolean =>
  t.warnings.some((w) => w.kind === 'HARD');

function statusOf(readiness: number, current: CbStatusKey): CbStatusKey {
  if (current === 'SUSPENDED') return 'SUSPENDED';
  return readiness >= 100 ? 'ACTIVE' : 'TRAINING';
}

async function activeLiCounts(tx: Tx, ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const g = await tx.lineItem.groupBy({
    by: ['customBiddingAlgorithmId'],
    where: { customBiddingAlgorithmId: { in: ids }, status: 'ACTIVE' },
    _count: { _all: true },
  });
  return new Map(g.map((x) => [x.customBiddingAlgorithmId as string, x._count._all]));
}

async function parentOf(tx: Tx, scope: ResourceScope) {
  if (scope.level === 'advertiser') {
    const adv = await loadAdvertiser(tx, scope.id);
    return { adv, advertiserId: adv.id as string | null, partnerId: null as string | null };
  }
  const p = await loadPartner(tx, scope.id);
  const first = await tx.advertiser.findFirst({
    where: { partnerId: p.id },
    select: { id: true, publicId: true },
  });
  const adv = await loadAdvertiser(tx, (first?.publicId ?? 0n).toString()).catch(() => null);
  // A partner with no advertiser still validates: the rules only need currency and time zone.
  const fallback = await tx.partner.findUniqueOrThrow({
    where: { id: p.id },
    select: { currencyCode: true, timeZone: true },
  });
  return {
    adv:
      adv ??
      ({
        id: '',
        publicId: 0n,
        partnerId: p.id,
        name: '',
        currencyCode: fallback.currencyCode,
        timeZone: fallback.timeZone,
        demandGenFloodlightOptimization: false,
        googleInventoryEnabled: true,
        floodlightGroupId: null,
      } satisfies AdvertiserRow),
    advertiserId: null as string | null,
    partnerId: p.id as string | null,
  };
}

// ---------------------------------------------------------------------------------------------
// List and read
// ---------------------------------------------------------------------------------------------

export async function listCustomBidding(user: SessionUser, scope: ResourceScope): Promise<CbRow[]> {
  const ctx = await serviceCtx(user);
  assertResourceRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const parent = await parentOf(tx, scope);
    const where: Prisma.CustomBiddingAlgorithmWhereInput = {
      isDraft: false,
      ...(parent.advertiserId
        ? { OR: [{ advertiserId: parent.advertiserId }, { partnerId: parent.adv.partnerId }] }
        : { partnerId: parent.partnerId as string }),
    };
    const rows = await tx.customBiddingAlgorithm.findMany({
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    const active = await activeLiCounts(
      tx,
      rows.map((r) => r.id),
    );
    return rows.map((r) => ({
      id: r.publicId.toString(),
      name: r.name,
      source: r.source === 'RULE_BASED' ? ('RULES' as const) : r.source,
      ownerScope: r.partnerId ? ('PARTNER' as const) : ('ADVERTISER' as const),
      status: r.status,
      readinessPct: r.readinessPct,
      updatedAt: r.updatedAt.toISOString(),
      activeLineItems: active.get(r.id) ?? 0,
      errorPct: r.errorPct === null ? BASE_ERROR_PCT : num(r.errorPct),
    }));
  });
}

/** Algorithms a line item can pick: saved ones of the advertiser and its partner. Ids are row ids, as the line item stores them. */
export async function listCustomBiddingOptions(
  user: SessionUser,
  advertiserRowId: string,
): Promise<CbOption[]> {
  const ctx = await serviceCtx(user);
  assertResourceRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const adv = await tx.advertiser.findUnique({
      where: { id: advertiserRowId },
      select: { partnerId: true },
    });
    if (!adv) return [];
    const rows = await tx.customBiddingAlgorithm.findMany({
      where: {
        isDraft: false,
        OR: [{ advertiserId: advertiserRowId }, { partnerId: adv.partnerId }],
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, status: true, readinessPct: true },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      readinessPct: r.readinessPct,
    }));
  });
}

async function viewOf(tx: Tx, alg: AlgorithmFull): Promise<CbView> {
  const lastRun = alg.lastTestRunId
    ? await tx.customBiddingTestRun.findUnique({ where: { id: alg.lastTestRunId } })
    : null;
  const lis = await tx.lineItem.findMany({
    where: { customBiddingAlgorithmId: alg.id },
    select: { publicId: true, name: true },
    orderBy: { name: 'asc' },
    take: 200,
  });
  const activities = await tx.floodlightActivity.findMany({
    where: {
      group: alg.advertiserId
        ? { advertiserId: alg.advertiserId }
        : { advertiser: { partnerId: alg.partnerId as string } },
      status: 'ACTIVE',
    },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  return {
    id: alg.publicId.toString(),
    name: alg.name,
    objective: alg.objective,
    ownerScope: alg.partnerId ? 'PARTNER' : 'ADVERTISER',
    status: alg.status,
    readinessPct: alg.readinessPct,
    version: alg.version,
    isDraft: alg.isDraft,
    rules: rulesOf(alg),
    multipliers: multipliersOf(alg),
    lastTest: lastRun ? toTestWire(lastRun) : null,
    lineItems: lis.map<UsingLineItem>((l) => ({ publicId: l.publicId.toString(), name: l.name })),
    activities,
  };
}

export async function getCustomBidding(user: SessionUser, id: string): Promise<CbView> {
  const ctx = await serviceCtx(user);
  assertResourceRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const alg = await tx.customBiddingAlgorithm.findFirst({
      where: idWhere(id),
      include: FULL_INCLUDE,
    });
    if (!alg) throw notFound();
    return viewOf(tx, alg);
  });
}

/** Pre-save validation for the wizard's blur and Next checks. */
export async function validateCustomBidding(
  user: SessionUser,
  scope: ResourceScope,
  input: CbDraftInput,
): Promise<WireIssue[]> {
  const ctx = await serviceCtx(user);
  assertResourceRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const parent = await parentOf(tx, scope);
    return checkDraft(ctx, parent.adv, normalise(input), input.id ? 'edit' : 'create').map((i) => ({
      path: i.path,
      severity: i.severity,
      code: i.ruleId,
      message: i.message,
    }));
  });
}

// ---------------------------------------------------------------------------------------------
// Draft (wizard step 1)
// ---------------------------------------------------------------------------------------------

async function writeChildren(
  tx: Tx,
  sandboxId: string,
  algorithmId: string,
  input: CbDraftInput,
): Promise<void> {
  await tx.customBiddingRule.deleteMany({ where: { algorithmId } });
  await tx.customBiddingMultiplier.deleteMany({ where: { algorithmId } });
  await tx.customBiddingRule.createMany({
    data: input.rules.map((r, i) => ({
      sandboxId,
      algorithmId,
      groupKey: r.groupKey,
      signal: r.signalKey.startsWith(ACTIVITY_SIGNAL_PREFIX) ? 'ACTIVITY' : r.signalKey,
      signalKey: r.signalKey,
      operator: 'IS',
      value: r.value ? 'true' : 'false',
      score: r.score,
      ordinal: i,
    })),
  });
  for (const [i, m] of input.multipliers.entries()) {
    await tx.customBiddingMultiplier.create({
      data: {
        sandboxId,
        algorithmId,
        kind: m.kind as CbMultiplierKindKey,
        ordinal: i + 1,
        values: {
          create: m.values.map((v) => ({
            sandboxId,
            valueKey: v.valueKey,
            multiplier: v.multiplier,
          })),
        },
      },
    });
  }
}

/** Wizard fields arrive as the text typed; numbers are read once here. */
function normalise(input: CbDraftInput): CbDraftInput {
  return {
    ...input,
    rules: input.rules.map((r) => ({
      ...r,
      score: r.score === ('' as never) ? (NaN as number) : Number(r.score),
    })),
    multipliers: input.multipliers.map((m) => ({
      ...m,
      values: m.values.map((v) => ({
        ...v,
        multiplier: v.multiplier === ('' as never) ? (NaN as number) : Number(v.multiplier),
      })),
    })),
  };
}

/** Floodlight activities the `ACTIVITY:` signals can name, for the wizard's rule picker. */
export async function customBiddingActivities(
  user: SessionUser,
  scope: ResourceScope,
): Promise<{ id: string; name: string }[]> {
  const ctx = await serviceCtx(user);
  assertResourceRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const parent = await parentOf(tx, scope);
    return tx.floodlightActivity.findMany({
      where: {
        status: 'ACTIVE',
        group: parent.advertiserId
          ? { advertiserId: parent.advertiserId }
          : { advertiser: { partnerId: parent.partnerId as string } },
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  });
}

export async function saveCustomBiddingDraft(
  user: SessionUser,
  scope: ResourceScope,
  rawInput: CbDraftInput,
  meta: WriteMeta = {},
): Promise<Result<{ id: string; version: number; reset: boolean }>> {
  return asResult(async () => {
    const input = normalise(rawInput);
    const ctx = await serviceCtx(user);
    assertResourceWrite(ctx);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const parent = await parentOf(tx, scope);
      const stored = input.id
        ? await tx.customBiddingAlgorithm.findFirst({
            where: idWhere(input.id),
            include: FULL_INCLUDE,
          })
        : null;
      if (input.id && !stored) throw notFound();
      if (stored && meta.expectedVersion !== undefined && meta.expectedVersion !== stored.version)
        throw conflict();
      const issues = checkDraft(ctx, parent.adv, input, stored ? 'edit' : 'create');
      if (issues.some((i) => i.blocking)) throw invalid(issues);
      const objective = input.objective as CbObjectiveKey;

      const changed =
        !stored ||
        fingerprint(stored.objective, rulesOf(stored), multipliersOf(stored)) !==
          fingerprint(objective, input.rules, input.multipliers);
      // Editing a saved algorithm resets the model and clears the test (module 15 S7 Edit).
      const reset = !!stored && !stored.isDraft && changed;

      const saved = await withChangeLog(
        changeCtx(ctx, tx, { note: meta.changeNote ?? '' }),
        {
          type: 'CUSTOM_BIDDING_ALGORITHM',
          ...(stored ? { id: stored.id } : {}),
          chain: stored?.advertiserId
            ? { advertiserId: stored.advertiserId }
            : parent.advertiserId
              ? { advertiserId: parent.advertiserId }
              : {},
        },
        async (t) => {
          if (!stored) {
            const created = await t.customBiddingAlgorithm.create({
              data: {
                sandboxId: ctx.sandboxId,
                advertiserId: parent.advertiserId,
                partnerId: parent.partnerId,
                ownerScope: parent.partnerId ? 'PARTNER' : 'ADVERTISER',
                name: input.name.trim(),
                source: 'RULE_BASED',
                objective,
                status: 'TRAINING',
                modelReadiness: 'NOT_READY',
                readinessPct: 0,
                trainingImpressions: 0n,
                isDraft: true,
              },
              select: { id: true, version: true },
            });
            await writeChildren(t, ctx.sandboxId, created.id, input);
            return created;
          }
          const n = await t.customBiddingAlgorithm.updateMany({
            where: { id: stored.id, version: stored.version },
            data: {
              name: input.name.trim(),
              objective,
              version: { increment: 1 },
              ...(changed ? { lastTestRunId: null } : {}),
              ...(reset
                ? {
                    status: stored.status === 'SUSPENDED' ? 'SUSPENDED' : 'TRAINING',
                    modelReadiness: 'NOT_READY',
                    readinessPct: 0,
                    trainingImpressions: 0n,
                  }
                : {}),
            },
          });
          if (n.count === 0) throw conflict();
          if (changed) await writeChildren(t, ctx.sandboxId, stored.id, input);
          return { id: stored.id, version: stored.version + 1 };
        },
      );
      const row = await tx.customBiddingAlgorithm.findUniqueOrThrow({
        where: { id: saved.id },
        select: { publicId: true, version: true },
      });
      return {
        data: { id: row.publicId.toString(), version: row.version, reset },
        warnings: softIssues(issues),
      };
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Test (wizard step 2)
// ---------------------------------------------------------------------------------------------

export async function runCustomBiddingTest(
  user: SessionUser,
  id: string,
): Promise<Result<CbTestWire>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertResourceWrite(ctx);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const alg = await tx.customBiddingAlgorithm.findFirst({
        where: idWhere(id),
        include: FULL_INCLUDE,
      });
      if (!alg) throw notFound();
      const mix = await sampleMixOf(tx, mixWhere(alg));
      const model = modelOf(rulesOf(alg), multipliersOf(alg));
      // Same definition, same sample: the seed is the algorithm id and its version (module 15 4.3).
      const result: CbTestResult = runTest(model, mix, `${alg.id}:${alg.version}`);
      const run = await tx.customBiddingTestRun.create({
        data: {
          sandboxId: ctx.sandboxId,
          algorithmId: alg.id,
          sampleImpressions: BigInt(result.sampleSize),
          scoreHistogram: {
            bins: result.histogram,
            max: result.histogramMax,
            matchedPct: result.matchedPct,
            meanScore: result.meanScore,
            p90Score: result.p90Score,
          },
          warnings: result.warnings,
          passed: result.passed,
        },
      });
      await tx.customBiddingAlgorithm.update({
        where: { id: alg.id },
        data: {
          lastTestRunId: run.id,
          errorPct: errorPctFor(model, mix, BASE_ERROR_PCT),
        },
      });
      return { data: toTestWire(run) };
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Save (wizard step 3), status, delete
// ---------------------------------------------------------------------------------------------

export async function saveCustomBidding(
  user: SessionUser,
  id: string,
  req: { ownerScope: OwnerScopeKey; activate: boolean },
  meta: WriteMeta = {},
): Promise<Result<{ id: string; status: CbStatusKey }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertResourceWrite(ctx);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const alg = await tx.customBiddingAlgorithm.findFirst({
        where: idWhere(id),
        include: { advertiser: { select: { partnerId: true } } },
      });
      if (!alg) throw notFound();
      if (meta.expectedVersion !== undefined && meta.expectedVersion !== alg.version)
        throw conflict();
      // CB-008: Save needs a test of this definition that did not fail hard.
      const run = alg.lastTestRunId
        ? await tx.customBiddingTestRun.findUnique({ where: { id: alg.lastTestRunId } })
        : null;
      if (!run || hardFailed(toTestWire(run))) {
        throw invalid([
          {
            ruleId: 'CB-008',
            severity: 'error',
            path: 'test',
            message: run
              ? 'Fix the test warnings and run the test again.'
              : 'Run the test before you save.',
            blocking: true,
          },
        ]);
      }
      // The owner can change only on the first save, and only to a level the creator can reach.
      const toPartner = alg.isDraft
        ? req.ownerScope === 'PARTNER' || !!alg.partnerId
        : !!alg.partnerId;
      const partnerId = alg.partnerId ?? alg.advertiser?.partnerId ?? null;
      const status: CbStatusKey =
        alg.status === 'SUSPENDED' && !req.activate
          ? 'SUSPENDED'
          : statusOf(alg.readinessPct, 'TRAINING');
      await withChangeLog(
        changeCtx(ctx, tx, { note: meta.changeNote ?? '' }),
        {
          type: 'CUSTOM_BIDDING_ALGORITHM',
          id: alg.id,
          chain: alg.advertiserId ? { advertiserId: alg.advertiserId } : {},
        },
        async (t) => {
          const n = await t.customBiddingAlgorithm.updateMany({
            where: { id: alg.id, version: alg.version },
            data: {
              isDraft: false,
              status,
              ownerScope: toPartner ? 'PARTNER' : 'ADVERTISER',
              ...(toPartner ? { advertiserId: null, partnerId } : {}),
              version: { increment: 1 },
            },
          });
          if (n.count === 0) throw conflict();
          return { id: alg.id };
        },
      );
      return { data: { id: alg.publicId.toString(), status } };
    });
  });
}

export async function setCustomBiddingStatus(
  user: SessionUser,
  id: string,
  action: 'ACTIVATE' | 'SUSPEND',
): Promise<Result<{ status: CbStatusKey; usedBy: number }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertResourceWrite(ctx);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const alg = await tx.customBiddingAlgorithm.findFirst({ where: idWhere(id) });
      if (!alg || alg.isDraft) throw notFound();
      const status: CbStatusKey =
        action === 'SUSPEND' ? 'SUSPENDED' : alg.readinessPct >= 100 ? 'ACTIVE' : 'TRAINING';
      await withChangeLog(
        changeCtx(ctx, tx),
        {
          type: 'CUSTOM_BIDDING_ALGORITHM',
          id: alg.id,
          chain: alg.advertiserId ? { advertiserId: alg.advertiserId } : {},
        },
        async (t) => {
          await t.customBiddingAlgorithm.update({
            where: { id: alg.id },
            data: { status, version: { increment: 1 } },
          });
          return { id: alg.id };
        },
      );
      const usedBy = (await activeLiCounts(tx, [alg.id])).get(alg.id) ?? 0;
      const adv = alg.advertiserId
        ? await tx.advertiser.findUniqueOrThrow({
            where: { id: alg.advertiserId },
            select: { currencyCode: true, timeZone: true },
          })
        : { currencyCode: 'USD', timeZone: 'UTC' };
      const issues = validate(
        'customBidding',
        {
          name: alg.name,
          objective: alg.objective,
          rules: [],
          multipliers: [],
          status,
          usedByActiveLineItems: usedBy,
        },
        resourceContext(
          ctx,
          { ...adv, demandGenFloodlightOptimization: false, googleInventoryEnabled: true },
          'edit',
        ),
        { trigger: 'cross' },
      );
      // CB-011 reports that the line items are blocked; the suspend itself goes through.
      const warnings: WireIssue[] = issues.map((i) => ({
        path: i.path,
        severity: 'warning',
        code: i.ruleId,
        message:
          i.ruleId === 'CB-011'
            ? `${usedBy} active line items are blocked until this algorithm is activated.`
            : i.message,
      }));
      return { data: { status, usedBy }, warnings };
    });
  });
}

export async function deleteCustomBidding(
  user: SessionUser,
  id: string,
): Promise<Result<CbDeleteOutcome>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertResourceWrite(ctx);
    return withSandbox(
      ctx.sandboxId,
      async (tx): Promise<{ data: CbDeleteOutcome; warnings?: WireIssue[] }> => {
        const alg = await tx.customBiddingAlgorithm.findFirst({ where: idWhere(id) });
        if (!alg) throw notFound();
        const usedBy = await tx.lineItem.count({ where: { customBiddingAlgorithmId: alg.id } });
        if (usedBy > 0) {
          return {
            data: { deleted: false, usedBy },
            warnings: [
              {
                path: '*',
                severity: 'error',
                code: 'CB-013',
                message: `This algorithm is used by ${usedBy} line items.`,
              },
            ],
          };
        }
        await withChangeLog(
          changeCtx(ctx, tx),
          {
            type: 'CUSTOM_BIDDING_ALGORITHM',
            id: alg.id,
            chain: alg.advertiserId ? { advertiserId: alg.advertiserId } : {},
          },
          async (t) => {
            await t.customBiddingAlgorithm.delete({ where: { id: alg.id } });
            return { id: alg.id };
          },
        );
        return { data: { deleted: true, usedBy: 0 } };
      },
    );
  });
}

export { readinessPct };
