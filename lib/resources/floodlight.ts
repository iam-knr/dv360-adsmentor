import 'server-only';
// Floodlight group and conversions: services of module 15 4.2 (M15-05). Windows written here are read by the engine
// on the next tick (lib/engine/io/loadWorld.ts, M15-09).
import type { Prisma } from '@prisma/client';
import type { SessionUser } from '@/lib/auth/types';
import { withChangeLog } from '@/lib/changelog';
import { withSandbox, type Tx } from '@/lib/db';
import { todayIn } from '@/lib/validation/primitives';
import { validate } from '@/lib/validation/engine';
import type { Issue } from '@/lib/validation';
import type { WireIssue } from '@/lib/campaigns/wire';
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
import { RESOURCE_LIMITS } from './limits';
import type {
  FloodlightConversionInput,
  FloodlightConversionView,
  FloodlightGroupInput,
  FloodlightGroupView,
  FloodlightRow,
  FormatKey,
  PlatformKey,
  WriteMeta,
} from './wire';

const SOURCE_OF: Record<string, FloodlightRow['source']> = {
  IFRAME_TAG: 'Iframe tag',
  IMAGE_TAG: 'Image tag',
  GOOGLE_TAG: 'Google tag',
};

const DEFAULT_MODELS: {
  name: string;
  kind: 'LAST_CLICK' | 'LINEAR';
  isPrimary: boolean;
}[] = [
  { name: 'Last click', kind: 'LAST_CLICK', isPrimary: true },
  { name: 'Linear', kind: 'LINEAR', isPrimary: false },
];

function dayBefore(iso: string): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------------------------
// Group
// ---------------------------------------------------------------------------------------------

type GroupFull = Prisma.FloodlightGroupGetPayload<{
  include: {
    variables: true;
    models: true;
    conversionGroups: { include: { activities: true } };
    activities: { select: { id: true; name: true; publicId: true } };
  };
}>;

const GROUP_INCLUDE = {
  variables: { orderBy: { ordinal: 'asc' } },
  models: { orderBy: { id: 'asc' } },
  conversionGroups: { include: { activities: true }, orderBy: { id: 'asc' } },
  activities: { select: { id: true, name: true, publicId: true }, orderBy: { name: 'asc' } },
} satisfies Prisma.FloodlightGroupInclude;

async function findGroup(tx: Tx, adv: AdvertiserRow): Promise<GroupFull | null> {
  return tx.floodlightGroup.findFirst({
    where: adv.floodlightGroupId ? { id: adv.floodlightGroupId } : { advertiserId: adv.id },
    include: GROUP_INCLUDE,
    orderBy: { id: 'asc' },
  });
}

function toGroupView(g: GroupFull): FloodlightGroupView {
  return {
    id: g.publicId.toString(),
    name: g.name,
    clickDays: g.clickWindowDays,
    impressionDays: g.impressionWindowDays,
    imageTagOnly: g.imageTagOnly,
    dynamicTag: g.dynamicTag,
    personalizedAdExclusion: g.personalizedAdExclusion,
    defaultConsent: (g.defaultConsent as Record<string, unknown> | null) ?? null,
    importedDataConsent: (g.importedDataConsent as Record<string, unknown> | null) ?? null,
    viewableImpressionPct: g.viewableImpressionPct,
    engagedViewVariable: g.engagedViewMetricVariable,
    activeViewVariable: g.activeViewMetricVariable,
    enhancedConversions: g.enhancedConversions,
    appAttributionPartners: Array.isArray(g.appAttributionPartners)
      ? (g.appAttributionPartners as string[])
      : [],
    googleAnalyticsLinked: g.googleAnalyticsLinked,
    models: g.models.map((m) => ({
      id: m.id,
      name: m.name,
      kind: m.kind,
      isPrimary: m.isPrimary,
    })),
    variables: g.variables.map((v) => ({ key: v.key, name: v.name, dataType: v.dataType })),
    conversionGroups: g.conversionGroups.map((c) => ({
      id: c.id,
      name: c.name,
      activityIds: c.activities.map((a) => a.activityId),
    })),
    activities: g.activities.map((a) => ({ id: a.publicId.toString(), name: a.name })),
    googleTag: {
      tagId: g.googleTagId,
      status: g.tagStatus,
      lastSeenAt: g.lastSeenAt ? g.lastSeenAt.toISOString() : null,
    },
    version: g.version,
  };
}

/** Basic details and Google tag tabs. Null when the advertiser has no group yet. */
export async function getFloodlightGroup(
  user: SessionUser,
  aid: string,
): Promise<FloodlightGroupView | null> {
  const ctx = await serviceCtx(user);
  assertResourceRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const adv = await loadAdvertiser(tx, aid);
    const g = await findGroup(tx, adv);
    return g ? toGroupView(g) : null;
  });
}

/** Partner level page: the groups of the partner's advertisers (read only). */
export async function listPartnerFloodlightGroups(
  user: SessionUser,
  pid: string,
): Promise<{ id: string; name: string; advertiser: string; conversions: number }[]> {
  const ctx = await serviceCtx(user);
  assertResourceRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const partner = await loadPartner(tx, pid);
    const groups = await tx.floodlightGroup.findMany({
      where: { advertiser: { partnerId: partner.id } },
      orderBy: { name: 'asc' },
      select: {
        publicId: true,
        name: true,
        advertiser: { select: { name: true } },
        _count: { select: { activities: true } },
      },
    });
    return groups.map((g) => ({
      id: g.publicId.toString(),
      name: g.name,
      advertiser: g.advertiser.name,
      conversions: g._count.activities,
    }));
  });
}

async function ensureGroup(tx: Tx, ctx: ServiceCtx, adv: AdvertiserRow): Promise<GroupFull> {
  const existing = await findGroup(tx, adv);
  if (existing) return existing;
  const created = await withChangeLog(
    changeCtx(ctx, tx),
    { type: 'FLOODLIGHT_GROUP', chain: { advertiserId: adv.id } },
    async (t) => {
      const g = await t.floodlightGroup.create({
        data: {
          sandboxId: ctx.sandboxId,
          advertiserId: adv.id,
          name: `${adv.name} Floodlight`,
        },
        select: { id: true, publicId: true },
      });
      await t.floodlightAttributionModel.createMany({
        data: DEFAULT_MODELS.map((m) => ({ ...m, sandboxId: ctx.sandboxId, groupId: g.id })),
      });
      await t.advertiser.update({ where: { id: adv.id }, data: { floodlightGroupId: g.id } });
      return g;
    },
  );
  return tx.floodlightGroup.findUniqueOrThrow({
    where: { id: created.id },
    include: GROUP_INCLUDE,
  });
}

function groupIssues(
  ctx: ServiceCtx,
  adv: AdvertiserRow,
  g: GroupFull,
  input: FloodlightGroupInput,
): Issue[] {
  const keys = (input.customVariables ?? g.variables).map((v) => v.key);
  return validate(
    'floodlightGroup',
    {
      name: input.name ?? g.name,
      clickDays: input.clickDays ?? g.clickWindowDays,
      impressionDays: input.impressionDays ?? g.impressionWindowDays,
      viewableImpressionPct: input.viewableImpressionPct ?? g.viewableImpressionPct,
      variableKeys: keys,
    },
    resourceContext(ctx, adv, 'edit'),
    { trigger: 'save' },
  );
}

export async function updateFloodlightGroup(
  user: SessionUser,
  aid: string,
  input: FloodlightGroupInput,
  meta: WriteMeta = {},
): Promise<Result<{ version: number }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertResourceWrite(ctx);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const adv = await loadAdvertiser(tx, aid);
      const g = await ensureGroup(tx, ctx, adv);
      if (meta.expectedVersion !== undefined && meta.expectedVersion !== g.version)
        throw conflict();
      const issues = groupIssues(ctx, adv, g, input);
      if (issues.some((i) => i.blocking)) throw invalid(issues);
      const activityIds = new Set(g.activities.map((a) => a.id));
      for (const cg of input.conversionGroups ?? [])
        if (cg.activityIds.some((a) => !activityIds.has(a))) throw notFound();
      if (input.primaryModelId && !g.models.some((m) => m.id === input.primaryModelId))
        throw notFound();

      const days = (v: number | string | undefined, fallback: number) =>
        v === undefined ? fallback : Math.trunc(Number(v));
      await withChangeLog(
        changeCtx(ctx, tx, { note: meta.changeNote ?? '' }),
        { type: 'FLOODLIGHT_GROUP', id: g.id, chain: { advertiserId: adv.id } },
        async (t) => {
          const n = await t.floodlightGroup.updateMany({
            where: { id: g.id, version: g.version },
            data: {
              ...(input.name !== undefined ? { name: input.name.trim() } : {}),
              clickWindowDays: days(input.clickDays, g.clickWindowDays),
              impressionWindowDays: days(input.impressionDays, g.impressionWindowDays),
              ...(input.imageTagOnly !== undefined ? { imageTagOnly: input.imageTagOnly } : {}),
              ...(input.dynamicTag !== undefined ? { dynamicTag: input.dynamicTag } : {}),
              ...(input.personalizedAdExclusion
                ? { personalizedAdExclusion: input.personalizedAdExclusion }
                : {}),
              ...(input.viewableImpressionPct !== undefined
                ? { viewableImpressionPct: Math.trunc(Number(input.viewableImpressionPct)) }
                : {}),
              ...(input.appAttributionPartners !== undefined
                ? { appAttributionPartners: input.appAttributionPartners }
                : {}),
              ...(input.googleAnalyticsLinked !== undefined
                ? { googleAnalyticsLinked: input.googleAnalyticsLinked }
                : {}),
              ...(input.enhancedConversions !== undefined
                ? { enhancedConversions: input.enhancedConversions }
                : {}),
              ...(input.engagedViewVariable !== undefined
                ? { engagedViewMetricVariable: input.engagedViewVariable }
                : {}),
              ...(input.activeViewVariable !== undefined
                ? { activeViewMetricVariable: input.activeViewVariable }
                : {}),
              version: { increment: 1 },
            },
          });
          if (n.count === 0) throw conflict();
          if (input.primaryModelId) {
            await t.floodlightAttributionModel.updateMany({
              where: { groupId: g.id },
              data: { isPrimary: false },
            });
            await t.floodlightAttributionModel.update({
              where: { id: input.primaryModelId },
              data: { isPrimary: true },
            });
          }
          if (input.customVariables) {
            await t.floodlightVariable.deleteMany({ where: { groupId: g.id } });
            await t.floodlightVariable.createMany({
              data: input.customVariables.map((v, i) => ({
                sandboxId: ctx.sandboxId,
                groupId: g.id,
                key: v.key,
                name: v.name,
                dataType: v.dataType,
                ordinal: i,
              })),
            });
          }
          if (input.conversionGroups) {
            await t.conversionGroup.deleteMany({ where: { groupId: g.id } });
            for (const cg of input.conversionGroups) {
              const row = await t.conversionGroup.create({
                data: { sandboxId: ctx.sandboxId, groupId: g.id, name: cg.name.trim() },
                select: { id: true },
              });
              await t.conversionGroupActivity.createMany({
                data: cg.activityIds.map((activityId) => ({
                  sandboxId: ctx.sandboxId,
                  conversionGroupId: row.id,
                  activityId,
                })),
              });
            }
          }
          return { id: g.id };
        },
      );
      return { data: { version: g.version + 1 }, warnings: softIssues(issues) };
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Conversions
// ---------------------------------------------------------------------------------------------

export async function listFloodlightConversions(
  user: SessionUser,
  aid: string,
  q: { status?: ('ACTIVE' | 'ARCHIVED')[] } = {},
): Promise<FloodlightRow[]> {
  const ctx = await serviceCtx(user);
  assertResourceRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const adv = await loadAdvertiser(tx, aid);
    const g = await findGroup(tx, adv);
    if (!g) return [];
    const status = q.status ?? ['ACTIVE'];
    const rows = await tx.floodlightActivity.findMany({
      where: { groupId: g.id, status: { in: status } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      include: { _count: { select: { lineItems: true } } },
    });
    const yesterday = dayBefore(todayIn(ctx.simNow, adv.timeZone));
    const conv = rows.length
      ? await tx.simConversionDaily.groupBy({
          by: ['activityId'],
          where: {
            activityId: { in: rows.map((r) => r.id) },
            simDate: new Date(`${yesterday}T00:00:00.000Z`),
          },
          _sum: { count: true },
        })
      : [];
    const yesterdayBy = new Map(conv.map((c) => [c.activityId, Number(c._sum.count ?? 0)]));
    return rows.map((r) => ({
      id: r.publicId.toString(),
      name: r.name,
      status: r.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE',
      source: SOURCE_OF[r.format] ?? 'Google tag',
      type: r.type,
      countingMethod: r.countingMethod,
      category: r.category,
      remarketing: r.remarketingEnabled,
      youtubeTracking: r.youtubeEnabled,
      lineItems: r._count.lineItems,
      impressionsYesterday: Math.round(yesterdayBy.get(r.id) ?? 0),
      platform: r.platform,
    }));
  });
}

function toConversionView(
  r: Prisma.FloodlightActivityGetPayload<{ include: { _count: { select: { lineItems: true } } } }>,
): FloodlightConversionView {
  return {
    id: r.publicId.toString(),
    version: r.version,
    lineItems: r._count.lineItems,
    platform: r.platform,
    name: r.name,
    format: r.format,
    type: r.type,
    countingMethod: r.countingMethod,
    category: r.category,
    status: r.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE',
    remarketing: r.remarketingEnabled,
    youtubeEnabled: r.youtubeEnabled,
    valueBasedBidding: r.valueBasedBidding,
    commercePartner: r.commercePartnerMeasurement,
    personalizedAdExclusion: r.personalizedAdExclusion,
    customVariableKeys: r.customVariableKeys,
    appId: r.appId,
    ctvAppId: r.ctvAppId,
    conversionEventName: r.conversionEventName,
  };
}

export async function getFloodlightConversion(
  user: SessionUser,
  eid: string,
): Promise<FloodlightConversionView> {
  const ctx = await serviceCtx(user);
  assertResourceRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const r = await tx.floodlightActivity.findFirst({
      where: idWhere(eid),
      include: { _count: { select: { lineItems: true } } },
    });
    if (!r) throw notFound();
    return toConversionView(r);
  });
}

function conversionIssues(
  ctx: ServiceCtx,
  adv: AdvertiserRow,
  input: FloodlightConversionInput,
  mode: 'create' | 'edit',
  stored?: { platform: PlatformKey; format: FormatKey; type: 'COUNTER' | 'SALE' },
  usedByLineItems?: number,
): Issue[] {
  return validate(
    'floodlightConversion',
    {
      platform: input.platform,
      name: input.name,
      format: input.format,
      type: input.type,
      countingMethod: input.countingMethod,
      status: input.status,
      remarketing: input.remarketing,
      valueBasedBidding: input.valueBasedBidding,
      appId: input.appId,
      ctvAppId: input.ctvAppId,
      conversionEventName: input.conversionEventName,
      ...(stored ? { stored } : {}),
      ...(usedByLineItems !== undefined ? { usedByLineItems } : {}),
    },
    resourceContext(ctx, adv, mode),
    { trigger: 'save' },
  );
}

/** Live validation of the New / Edit conversion form. */
export async function validateFloodlightConversion(
  user: SessionUser,
  aid: string,
  input: FloodlightConversionInput,
): Promise<WireIssue[]> {
  const ctx = await serviceCtx(user);
  assertResourceRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const adv = await loadAdvertiser(tx, aid);
    return conversionIssues(ctx, adv, input, 'create').map((i) => ({
      path: i.path,
      severity: i.severity,
      code: i.ruleId,
      message: i.message,
    }));
  });
}

function activityData(input: FloodlightConversionInput) {
  return {
    name: input.name.trim(),
    status: input.status,
    platform: input.platform!,
    format: input.format!,
    type: input.type!,
    countingMethod: input.countingMethod!,
    category: (input.category as Prisma.FloodlightActivityCreateInput['category']) ?? null,
    remarketingEnabled: input.remarketing,
    youtubeEnabled: input.youtubeEnabled,
    valueBasedBidding: input.valueBasedBidding,
    commercePartnerMeasurement: input.commercePartner,
    personalizedAdExclusion: input.personalizedAdExclusion,
    customVariableKeys: input.customVariableKeys,
    appId: input.platform === 'MOBILE_APP' ? input.appId : null,
    ctvAppId: input.platform === 'CONNECTED_TV' ? input.ctvAppId : null,
    conversionEventName:
      input.platform === 'WEB' ? null : (input.conversionEventName?.trim() ?? null),
  };
}

export async function createFloodlightConversion(
  user: SessionUser,
  aid: string,
  input: FloodlightConversionInput,
  meta: WriteMeta = {},
): Promise<Result<{ id: string; publicId: number }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertResourceWrite(ctx);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const adv = await loadAdvertiser(tx, aid);
      const issues = conversionIssues(ctx, adv, input, 'create');
      if (issues.some((i) => i.blocking)) throw invalid(issues);
      const g = await ensureGroup(tx, ctx, adv);
      const created = await withChangeLog(
        changeCtx(ctx, tx, { note: meta.changeNote ?? '' }),
        { type: 'FLOODLIGHT_ACTIVITY', chain: { advertiserId: adv.id } },
        (t) =>
          t.floodlightActivity.create({
            data: { sandboxId: ctx.sandboxId, groupId: g.id, ...activityData(input) },
            select: { id: true, publicId: true },
          }),
      );
      return {
        data: { id: created.publicId.toString(), publicId: Number(created.publicId) },
        warnings: softIssues(issues),
      };
    });
  });
}

export async function updateFloodlightConversion(
  user: SessionUser,
  eid: string,
  input: FloodlightConversionInput,
  meta: WriteMeta = {},
): Promise<Result<{ version: number }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertResourceWrite(ctx);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const stored = await tx.floodlightActivity.findFirst({
        where: idWhere(eid),
        include: {
          group: { select: { advertiserId: true } },
          _count: { select: { lineItems: true } },
        },
      });
      if (!stored) throw notFound();
      if (meta.expectedVersion !== undefined && meta.expectedVersion !== stored.version)
        throw conflict();
      const adv = await loadAdvertiser(tx, await advertiserPublicId(tx, stored.group.advertiserId));
      const issues = conversionIssues(
        ctx,
        adv,
        input,
        'edit',
        { platform: stored.platform, format: stored.format, type: stored.type },
        input.status === 'ARCHIVED' && stored.status !== 'ARCHIVED' ? stored._count.lineItems : 0,
      );
      if (issues.some((i) => i.blocking)) throw invalid(issues);
      await withChangeLog(
        changeCtx(ctx, tx, { note: meta.changeNote ?? '' }),
        { type: 'FLOODLIGHT_ACTIVITY', id: stored.id, chain: { advertiserId: adv.id } },
        async (t) => {
          const n = await t.floodlightActivity.updateMany({
            where: { id: stored.id, version: stored.version },
            data: { ...activityData(input), version: { increment: 1 } },
          });
          if (n.count === 0) throw conflict();
          return { id: stored.id };
        },
      );
      return { data: { version: stored.version + 1 }, warnings: softIssues(issues) };
    });
  });
}

async function advertiserPublicId(tx: Tx, id: string): Promise<string> {
  const a = await tx.advertiser.findUnique({ where: { id }, select: { publicId: true } });
  if (!a) throw notFound();
  return a.publicId.toString();
}

/** FL-033: without `confirmed`, a conversion counted by line items is not archived and the warning comes back. */
export async function archiveFloodlightConversion(
  user: SessionUser,
  eid: string,
  confirmed = false,
): Promise<Result<{ archived: boolean; usedBy: number }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertResourceWrite(ctx);
    return withSandbox(
      ctx.sandboxId,
      async (
        tx,
      ): Promise<{ data: { archived: boolean; usedBy: number }; warnings?: WireIssue[] }> => {
        const stored = await tx.floodlightActivity.findFirst({
          where: idWhere(eid),
          include: {
            group: { select: { advertiserId: true } },
            _count: { select: { lineItems: true } },
          },
        });
        if (!stored) throw notFound();
        const usedBy = stored._count.lineItems;
        if (usedBy > 0 && !confirmed) {
          return {
            data: { archived: false, usedBy },
            warnings: [
              {
                path: 'status',
                severity: 'warning',
                code: 'FL-033',
                message: `${usedBy} line items count this conversion.`,
              },
            ],
          };
        }
        await withChangeLog(
          changeCtx(ctx, tx),
          {
            type: 'FLOODLIGHT_ACTIVITY',
            id: stored.id,
            chain: { advertiserId: stored.group.advertiserId },
          },
          async (t) => {
            await t.floodlightActivity.update({
              where: { id: stored.id },
              data: { status: 'ARCHIVED', version: { increment: 1 } },
            });
            return { id: stored.id };
          },
        );
        return { data: { archived: true, usedBy } };
      },
    );
  });
}

export { RESOURCE_LIMITS };
