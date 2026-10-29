import 'server-only';
// Audience services (module 14 4.1): lists, details, create / update / archive, picker, estimator, analysis and the
// line item tab. Every write goes through withChangeLog; sizes are synthetic and decided here at creation, the engine
// tick flips PROCESSING lists to ACTIVE (lifecycle.ts). Ids on the wire are public ids as strings.
import type { Prisma } from '@prisma/client';
import type { SessionUser } from '@/lib/auth/types';
import { withChangeLog } from '@/lib/changelog';
import { withSandbox, type Tx } from '@/lib/db';
import { validate } from '@/lib/validation/engine';
import googleAudiencesJson from '../../data/reference/google-audiences.json';
import {
  asResult,
  assertResourceRead,
  changeCtx,
  conflict,
  forbidden,
  idWhere,
  invalid,
  loadAdvertiser,
  notFound,

  resourceContext,
  serviceCtx,
  softIssues,
  type AdvertiserRow,
  type Result,
  type ServiceCtx,
} from '@/lib/resources/kit';
import { can } from '@/lib/rbac/can';
import type { AudienceRuleInput } from '@/lib/validation/rules/audience';
import { audienceInsights, geoDistribution } from './analysis';
import { AUDIENCE_COUNTRIES } from './countries';
import { advanceAudiences, configOf, type AudienceConfig } from './lifecycle';
import {
  availabilityFor,
  barFraction,
  bucketOf,
  combinedSize,
  customListSize,
  estimateCustomList,
  googleAudienceSize,
  hashString,
  hoursUntil,
  keyed,
  lookalikeExpansion,
  lookalikeSize,
  matchRate,
  matchResult,
  parseCustomerMatchCsv,
  spreadSizes,
  type SizeMap,
} from './sizes';
import {
  CONNECTED_PRODUCTS,
  SOURCE_LABEL,
  TYPE_LABEL,
  type AudienceInput,
  type AudienceListResult,
  type AudienceLookups,
  type AudienceRow,
  type AudienceStatusKey,
  type AudienceTab,
  type AudienceTypeKey,
  type AudienceView,
  type CombinedDraft,
  type GeoDistribution,
  type AudienceInsights,
  type LinkedLineItem,
  type PickerRow,
  type SizeCell,
  type WriteMeta,
} from './wire';

type AudienceRowDb = Prisma.AudienceGetPayload<object>;

const TABS: Record<AudienceTab, AudienceTypeKey[]> = {
  FIRST_PARTY: ['TAG_BASED', 'CUSTOMER_MATCH', 'YOUTUBE_USERS', 'LOOKALIKE'],
  CUSTOM: ['CUSTOM_AFFINITY', 'CUSTOM_INTENT_DISPLAY_VIDEO', 'CUSTOM_INTENT_YOUTUBE'],
  COMBINED: ['COMBINED'],
  PARTNER: ['PARTNER'],
};
const FIRST_PARTY_SEEDS: AudienceTypeKey[] = ['TAG_BASED', 'CUSTOMER_MATCH', 'YOUTUBE_USERS'];

interface GoogleAudienceRef {
  id: string;
  name: string;
  kind: string;
  path: string[];
}
const GOOGLE = googleAudiencesJson as GoogleAudienceRef[];
const GOOGLE_BY_ID = new Map(GOOGLE.map((g) => [g.id, g]));

// ---------------------------------------------------------------------------------------------
// Plumbing
// ---------------------------------------------------------------------------------------------

function assertAudienceWrite(ctx: ServiceCtx): void {
  if (!can(ctx.user, 'write', { sandboxId: ctx.sandboxId, area: 'audiences' })) throw forbidden();
}

function assertAudienceRead(ctx: ServiceCtx): void {
  // REPORTING_ONLY gets the 404 page; everybody else reads (module 14 4).
  assertResourceRead(ctx);
}

const cell = (n: bigint | number | null | undefined): SizeCell => ({
  bucket: bucketOf(n),
  exact: Number(n ?? 0),
  fraction: barFraction(n),
});

function sizeMapOf(a: Pick<AudienceRowDb, 'sizeDisplay' | 'sizeYoutube' | 'sizeMobileApp' | 'sizeCtv'>): SizeMap {
  return {
    display: Number(a.sizeDisplay ?? 0),
    youtube: Number(a.sizeYoutube ?? 0),
    mobileApp: Number(a.sizeMobileApp ?? 0),
    ctv: Number(a.sizeCtv ?? 0),
  };
}

const sizeData = (s: SizeMap) => ({
  sizeDisplay: BigInt(Math.round(s.display)),
  sizeYoutube: BigInt(Math.round(s.youtube)),
  sizeMobileApp: BigInt(Math.round(s.mobileApp)),
  sizeCtv: BigInt(Math.round(s.ctv)),
});

async function settle(tx: Tx, ctx: ServiceCtx, advertiserId: string | null): Promise<void> {
  await advanceAudiences(tx, ctx.sandboxId, advertiserId, ctx.simNow.getTime());
}

/** Line items that target each list, by list id. */
async function lineItemCounts(tx: Tx, ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (ids.length === 0) return out;
  const rows = await tx.targetingAssignment.findMany({
    where: { refType: 'AUDIENCE', refId: { in: ids }, lineItemId: { not: null } },
    select: { refId: true, lineItemId: true },
  });
  const seen = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.refId || !r.lineItemId) continue;
    const s = seen.get(r.refId) ?? new Set<string>();
    s.add(r.lineItemId);
    seen.set(r.refId, s);
  }
  for (const [id, s] of seen) out.set(id, s.size);
  return out;
}

function toRow(a: AudienceRowDb, lineItems: number, now: Date): AudienceRow {
  const type = a.type;
  const hours = a.status === 'PROCESSING' ? hoursUntil(a.availableAt, now) : 0;
  return {
    id: a.publicId.toString(),
    name: a.name,
    type,
    typeLabel: TYPE_LABEL[type],
    status: a.status,
    source: SOURCE_LABEL[a.source] ?? a.source,
    display: cell(a.sizeDisplay),
    youtube: cell(a.sizeYoutube),
    mobileApp: cell(a.sizeMobileApp),
    ctv: cell(a.sizeCtv),
    lineItems,
    availableInHours: hours,
    youtubeUnavailable: type === 'COMBINED' && !(Number(a.sizeYoutube ?? 0) > 0),
    activeDisplay: type === 'COMBINED' ? cell(a.status === 'ACTIVE' ? a.sizeDisplay : 0) : null,
    createdAt: a.createdAt.toISOString(),
  };
}

async function loadStored(tx: Tx, seg: string) {
  const a = await tx.audience.findFirst({ where: idWhere(seg) });
  if (!a) throw notFound();
  return a;
}

function validateAudience(
  ctx: ServiceCtx,
  adv: AdvertiserRow,
  mode: 'create' | 'edit',
  input: AudienceRuleInput,
) {
  return validate('audience', input, resourceContext(ctx, adv, mode), { trigger: 'save' });
}

// ---------------------------------------------------------------------------------------------
// Lists (S1 to S4)
// ---------------------------------------------------------------------------------------------

export interface AudienceListQuery {
  tab: AudienceTab;
  q?: string;
  type?: string[];
  status?: string[];
  page?: number;
  pageSize?: number;
}

export async function listAudiences(
  user: SessionUser,
  aid: string,
  q: AudienceListQuery,
): Promise<AudienceListResult> {
  const ctx = await serviceCtx(user);
  assertAudienceRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const adv = await loadAdvertiser(tx, aid);
    await settle(tx, ctx, adv.id);
    const types = (q.type?.length ? q.type : TABS[q.tab]).filter((t) => TABS[q.tab].includes(t as AudienceTypeKey));
    const statuses = (q.status?.length ? q.status : ['PROCESSING', 'ACTIVE', 'INACTIVE']) as AudienceStatusKey[];
    const needle = q.q?.trim();
    const where: Prisma.AudienceWhereInput = {
      advertiserId: adv.id,
      type: { in: types as AudienceTypeKey[] },
      status: { in: statuses },
      ...(needle
        ? {
            OR: [
              { name: { contains: needle, mode: 'insensitive' } },
              ...(/^\d{1,18}$/.test(needle) ? [{ publicId: BigInt(needle) }] : []),
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      tx.audience.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        ...(q.pageSize ? { skip: ((q.page ?? 1) - 1) * q.pageSize, take: q.pageSize } : {}),
      }),
      tx.audience.count({ where }),
    ]);
    const counts = await lineItemCounts(tx, rows.map((r) => r.id));
    return { rows: rows.map((r) => toRow(r, counts.get(r.id) ?? 0, ctx.simNow)), total };
  });
}

// ---------------------------------------------------------------------------------------------
// Lookups for the forms
// ---------------------------------------------------------------------------------------------

export async function getAudienceLookups(user: SessionUser, aid: string): Promise<AudienceLookups> {
  const ctx = await serviceCtx(user);
  assertAudienceRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const adv = await loadAdvertiser(tx, aid);
    const [activities, channels, seeds, variables, apps] = await Promise.all([
      tx.floodlightActivity.findMany({
        where: { group: { advertiserId: adv.id }, status: { not: 'ARCHIVED' } },
        orderBy: { name: 'asc' },
        select: { publicId: true, name: true, type: true, countingMethod: true, remarketingEnabled: true },
      }),
      tx.linkedAccount.findMany({
        where: { advertiserId: adv.id, type: 'YOUTUBE_CHANNEL', status: 'LINKED' },
        orderBy: { displayName: 'asc' },
        select: { id: true, displayName: true },
      }),
      tx.audience.findMany({
        where: {
          advertiserId: adv.id,
          type: { in: FIRST_PARTY_SEEDS as never },
          status: { in: ['PROCESSING', 'ACTIVE', 'INACTIVE'] },
        },
        orderBy: { name: 'asc' },
        select: { publicId: true, name: true, sizeDisplay: true, type: true },
      }),
      tx.floodlightVariable.findMany({
        where: { group: { advertiserId: adv.id } },
        orderBy: { ordinal: 'asc' },
        select: { key: true, name: true },
        take: 100,
      }),
      tx.appCatalog.findMany({
        orderBy: [{ name: 'asc' }, { appId: 'asc' }],
        take: 300,
        select: { id: true, name: true, platform: true },
      }),
    ]);
    return {
      variables: variables.map((v) => ({ key: v.key, name: v.name })),
      apps: apps.map((a) => ({ id: a.id, label: `${a.name} (${a.platform})` })),
      activities: activities.map((a) => ({
        id: a.publicId.toString(),
        name: a.name,
        type: a.type,
        counting: a.countingMethod,
        remarketing: a.remarketingEnabled,
      })),
      linkedChannels: channels.map((c) => ({ id: c.id, name: c.displayName })),
      firstParty: seeds.map((s) => ({
        id: s.publicId.toString(),
        name: s.name,
        users: Number(s.sizeDisplay ?? 0),
        type: s.type,
      })),
      countries: AUDIENCE_COUNTRIES,
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Details (S13, S14)
// ---------------------------------------------------------------------------------------------

function expression(include: { name: string }[][], exclude: { name: string }[]): string {
  const groups = include
    .filter((g) => g.length)
    .map((g) => `(${g.map((m) => m.name).join(' or ')})`)
    .join(' and ');
  if (!groups) return '';
  return exclude.length ? `${groups}, excluding ${exclude.map((m) => m.name).join(' or ')}` : groups;
}

async function memberNames(
  tx: Tx,
  terms: { memberKind: string; memberId: string }[],
): Promise<Map<string, string>> {
  const ids = terms.filter((t) => t.memberKind !== 'GOOGLE_AUDIENCE').map((t) => t.memberId);
  const rows = ids.length
    ? await tx.audience.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    : [];
  const out = new Map(rows.map((r) => [r.id, r.name]));
  for (const t of terms)
    if (t.memberKind === 'GOOGLE_AUDIENCE') out.set(t.memberId, GOOGLE_BY_ID.get(t.memberId)?.name ?? t.memberId);
  return out;
}

export async function getAudience(user: SessionUser, seg: string): Promise<AudienceView> {
  const ctx = await serviceCtx(user);
  assertAudienceRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const found = await loadStored(tx, seg);
    await settle(tx, ctx, found.advertiserId);
    const a = (await tx.audience.findUnique({ where: { id: found.id } }))!;
    const [rules, seeds, terms, entries, uploads, counts] = await Promise.all([
      tx.audienceTagRule.findMany({ where: { audienceId: a.id }, orderBy: { ordinal: 'asc' } }),
      tx.audienceSeed.findMany({ where: { audienceId: a.id } }),
      tx.combinedAudienceTerm.findMany({ where: { audienceId: a.id }, orderBy: [{ mode: 'asc' }, { groupIndex: 'asc' }] }),
      tx.customListEntry.findMany({ where: { audienceId: a.id }, orderBy: { ordinal: 'asc' } }),
      tx.customerMatchUpload.findMany({ where: { audienceId: a.id }, orderBy: { uploadedAt: 'desc' } }),
      lineItemCounts(tx, [a.id]),
    ]);
    const type = a.type;
    const cfg = configOf(a.config);
    const activity = a.floodlightActivityId
      ? await tx.floodlightActivity.findUnique({
          where: { id: a.floodlightActivityId },
          select: { publicId: true, name: true },
        })
      : null;
    const seedRows = seeds.length
      ? await tx.audience.findMany({
          where: { id: { in: seeds.map((s) => s.seedAudienceId) } },
          select: { id: true, publicId: true, name: true, sizeDisplay: true },
        })
      : [];
    const names = await memberNames(tx, terms);
    const includeGroups: { name: string; kind: string }[][] = [];
    for (const t of terms.filter((x) => x.mode === 'INCLUDE')) {
      (includeGroups[t.groupIndex] ??= []).push({ name: names.get(t.memberId) ?? t.memberId, kind: t.memberKind });
    }
    const exclude = terms
      .filter((x) => x.mode === 'EXCLUDE')
      .map((t) => ({ name: names.get(t.memberId) ?? t.memberId, kind: t.memberKind }));
    const channel = cfg.linkedAccountId
      ? await tx.linkedAccount.findUnique({ where: { id: String(cfg.linkedAccountId) }, select: { displayName: true } })
      : null;
    const hours = a.status === 'PROCESSING' ? hoursUntil(a.availableAt, ctx.simNow) : 0;
    return {
      id: a.publicId.toString(),
      name: a.name,
      description: a.description,
      type,
      typeLabel: TYPE_LABEL[type],
      status: a.status,
      source: SOURCE_LABEL[a.source] ?? a.source,
      externalSource: a.source === 'GOOGLE_ANALYTICS' && type === 'TAG_BASED',
      version: a.version,
      membershipDays: a.membershipDays,
      availableAt: a.availableAt?.toISOString() ?? null,
      availableInHours: hours,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      sizes: [
        { label: 'Display', cell: cell(a.sizeDisplay) },
        { label: 'YouTube users', cell: cell(a.sizeYoutube) },
        { label: 'Mobile app', cell: cell(a.sizeMobileApp) },
        { label: 'CTV devices', cell: cell(a.sizeCtv) },
      ],
      lineItemCount: counts.get(a.id) ?? 0,
      floodlight:
        type === 'TAG_BASED'
          ? {
              id: activity?.publicId.toString() ?? '',
              name: activity?.name ?? '',
              rules: rules.map((r) => ({ variableKey: r.variableKey ?? '', operator: r.operator, value: r.value })),
            }
          : null,
      lookalike:
        type === 'LOOKALIKE'
          ? {
              seeds: seedRows.map((s) => ({ id: s.publicId.toString(), name: s.name, users: Number(s.sizeDisplay ?? 0) })),
              reachPct: Number(a.lookalikeReachPct ?? 5),
              countries: a.lookalikeCountries,
            }
          : null,
      customerMatch:
        type === 'CUSTOMER_MATCH'
          ? {
              contactType: (uploads[0]?.contactType as never) ?? ((cfg.contactType as never) ?? null),
              dataSource: a.dataSource,
              uploads: uploads.map((u) => ({
                fileName: u.fileName,
                rows: u.rowCount,
                matched: u.matchedCount,
                matchRatePct: u.matchRatePct === null ? null : Number(u.matchRatePct),
              })),
            }
          : null,
      combined:
        type === 'COMBINED'
          ? { include: includeGroups.filter(Boolean), exclude, expression: expression(includeGroups.filter(Boolean), exclude) }
          : null,
      entries: entries.map((e) => ({ kind: e.kind, value: e.value })),
      youtube:
        type === 'YOUTUBE_USERS'
          ? {
              channel: channel?.displayName ?? null,
              action: (cfg.action as string) ?? null,
              videoIds: (cfg.videoIds as string[]) ?? [],
            }
          : null,
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------------------------

interface Built {
  data: Omit<Prisma.AudienceUncheckedCreateInput, 'sandboxId' | 'advertiserId' | 'name' | 'type'>;
  rules: AudienceRuleInput;
  children: (tx: Tx, audienceId: string) => Promise<void>;
  match?: { rows: number; matched: number; matchRatePct: number };
}

const csvHash = (text: string): string => String(hashString(text));

async function activityByPublic(tx: Tx, advertiserId: string, id: string | null) {
  if (!id || !/^[1-9]\d{0,18}$/.test(id)) return null;
  return tx.floodlightActivity.findFirst({
    where: { publicId: BigInt(id), group: { advertiserId } },
    select: { id: true, remarketingEnabled: true },
  });
}

async function firstPartySeeds(tx: Tx, advertiserId: string, ids: string[]) {
  const clean = ids.filter((i) => /^[1-9]\d{0,18}$/.test(i)).map((i) => BigInt(i));
  if (clean.length === 0) return [];
  return tx.audience.findMany({
    where: { advertiserId, publicId: { in: clean }, type: { in: FIRST_PARTY_SEEDS as never } },
    select: { id: true, sizeDisplay: true },
  });
}

interface MemberSizes {
  sizes: SizeMap;
  archived: boolean;
}

async function resolveMember(
  tx: Tx,
  advertiserId: string,
  m: { kind: string; id: string },
): Promise<{ rowId: string; found: MemberSizes } | null> {
  if (m.kind === 'GOOGLE_AUDIENCE') {
    const g = GOOGLE_BY_ID.get(m.id);
    return g ? { rowId: g.id, found: { sizes: googleAudienceSize(g.id, g.kind), archived: false } } : null;
  }
  if (!/^[1-9]\d{0,18}$/.test(m.id)) return null;
  const a = await tx.audience.findFirst({
    where: { advertiserId, publicId: BigInt(m.id) },
  });
  return a ? { rowId: a.id, found: { sizes: sizeMapOf(a), archived: a.status === 'ARCHIVED' } } : null;
}

export async function estimateCombined(
  tx: Tx,
  advertiserId: string,
  draft: CombinedDraft,
): Promise<{
  sizes: SizeMap;
  resolved: { include: { kind: string; rowId: string }[][]; exclude: { kind: string; rowId: string }[] };
  allArchived: boolean;
  names: Map<string, string>;
}> {
  const include: number[][] = [];
  const yt: number[][] = [];
  const app: number[][] = [];
  const ctv: number[][] = [];
  const resolvedInc: { kind: string; rowId: string }[][] = [];
  const names = new Map<string, string>();
  let live = 0;
  let total = 0;
  for (const g of draft.include) {
    const sizes: number[] = [];
    const ys: number[] = [];
    const as: number[] = [];
    const cs: number[] = [];
    const res: { kind: string; rowId: string }[] = [];
    for (const m of g) {
      const r = await resolveMember(tx, advertiserId, m);
      if (!r) continue;
      total++;
      if (!r.found.archived) live++;
      sizes.push(r.found.sizes.display);
      ys.push(r.found.sizes.youtube);
      as.push(r.found.sizes.mobileApp);
      cs.push(r.found.sizes.ctv);
      res.push({ kind: m.kind, rowId: r.rowId });
    }
    include.push(sizes);
    yt.push(ys);
    app.push(as);
    ctv.push(cs);
    resolvedInc.push(res);
  }
  const ex = { d: [] as number[], y: [] as number[], a: [] as number[], c: [] as number[] };
  const resolvedEx: { kind: string; rowId: string }[] = [];
  for (const m of draft.exclude) {
    const r = await resolveMember(tx, advertiserId, m);
    if (!r) continue;
    ex.d.push(r.found.sizes.display);
    ex.y.push(r.found.sizes.youtube);
    ex.a.push(r.found.sizes.mobileApp);
    ex.c.push(r.found.sizes.ctv);
    resolvedEx.push({ kind: m.kind, rowId: r.rowId });
  }
  return {
    sizes: {
      display: combinedSize(include, ex.d),
      youtube: combinedSize(yt, ex.y),
      mobileApp: combinedSize(app, ex.a),
      ctv: combinedSize(ctv, ex.c),
    },
    resolved: { include: resolvedInc, exclude: resolvedEx },
    allArchived: total > 0 && live === 0,
    names,
  };
}

async function build(
  tx: Tx,
  ctx: ServiceCtx,
  adv: AdvertiserRow,
  input: AudienceInput,
): Promise<Built> {
  const name = input.name.trim();
  const base: AudienceRuleInput = { type: input.kind, name };
  const sandboxSeed = `${ctx.sandboxId}`;

  switch (input.kind) {
    case 'TAG_BASED': {
      const act = await activityByPublic(tx, adv.id, input.floodlightActivityId);
      const target = spreadSizes(Math.round(keyed(`tag:${sandboxSeed}:${name}`, 3_000, 60_000)));
      return {
        rules: {
          ...base,
          floodlightActivityId: input.floodlightActivityId,
          activityRemarketing: act?.remarketingEnabled ?? false,
          tagRules: input.rules,
          membershipDays: input.membershipDays,
        },
        data: {
          floodlightActivityId: act?.id ?? null,
          membershipDays: Number(input.membershipDays),
          ...availabilityFor('TAG_BASED', ctx.simNow),
          config: { targetSizes: target },
        },
        children: async (t, id) => {
          if (input.rules.length)
            await t.audienceTagRule.createMany({
              data: input.rules.map((r, i) => ({
                sandboxId: ctx.sandboxId,
                audienceId: id,
                activityId: act?.id ?? '',
                variableKey: r.variableKey,
                operator: r.operator,
                value: r.value,
                ordinal: i,
              })),
            });
        },
      };
    }
    case 'CUSTOMER_MATCH': {
      const parsed =
        input.source === 'UPLOAD'
          ? parseCustomerMatchCsv(input.fileText ?? '', input.fileName ?? 'upload.csv')
          : null;
      const product = CONNECTED_PRODUCTS.find((p) => p.key === input.connectedProductKey);
      let match: Built['match'];
      let uploadName = '';
      let rows = 0;
      let hash = '';
      if (input.source === 'UPLOAD' && parsed?.ok) {
        rows = parsed.rows;
        hash = csvHash(input.fileText ?? '');
        uploadName = input.fileName ?? 'upload.csv';
      } else if (input.source === 'CONNECT' && product) {
        rows = product.rows;
        hash = product.key;
        uploadName = product.label;
      }
      const draftId = `cm:${name}`;
      if (rows > 0) match = matchResult(rows, matchRate(sandboxSeed, draftId, hash));
      const later = input.source === 'LATER';
      const matched = match?.matched ?? 0;
      const target = spreadSizes(matched);
      const av = later ? { status: 'INACTIVE' as const, availableAt: null } : availabilityFor('CUSTOMER_MATCH', ctx.simNow);
      return {
        match,
        rules: {
          ...base,
          dataSource: input.source,
          file: input.source === 'UPLOAD' ? { present: Boolean(input.fileText), ...(parsed?.error ? { error: parsed.error } : {}) } : null,
          consentAck: input.consentAck,
          membershipDays: input.membershipDays,
        },
        data: {
          description: input.description ?? null,
          dataSource: input.source === 'CONNECT' ? 'CONNECTED' : input.source === 'UPLOAD' ? 'UPLOAD' : input.source === 'LATER' ? 'LATER' : null,
          connectedProductKey: product?.key ?? null,
          consentAck: input.consentAck,
          membershipDays: Number(input.membershipDays),
          ...av,
          config: { targetSizes: target, contactType: input.contactType ?? null },
        },
        children: async (t, id) => {
          if (match)
            await t.customerMatchUpload.create({
              data: {
                sandboxId: ctx.sandboxId,
                audienceId: id,
                contactType: input.contactType ?? 'EMAIL',
                fileName: uploadName,
                rowCount: match.rows,
                matchedCount: match.matched,
                matchRatePct: match.matchRatePct.toFixed(2),
                status: 'DONE',
              },
            });
        },
      };
    }
    case 'YOUTUBE_USERS': {
      const channels = await tx.linkedAccount.findMany({
        where: { advertiserId: adv.id, type: 'YOUTUBE_CHANNEL', status: 'LINKED' },
        select: { id: true },
      });
      const chosen = channels.find((c) => c.id === input.linkedAccountId);
      const target = spreadSizes(Math.round(keyed(`yt:${sandboxSeed}:${name}`, 20_000, 400_000)), {
        youtube: 1,
        mobileApp: 0.3,
        ctv: 0.3,
      });
      return {
        rules: { ...base, linkedChannels: chosen ? channels.length : 0, membershipDays: input.membershipDays },
        data: {
          membershipDays: Number(input.membershipDays),
          source: 'YOUTUBE',
          ...availabilityFor('YOUTUBE_USERS', ctx.simNow),
          config: {
            targetSizes: target,
            linkedAccountId: chosen?.id,
            action: input.action,
            videoIds: input.videoIds,
          },
        },
        children: () => Promise.resolve(),
      };
    }
    case 'LOOKALIKE': {
      const seeds = await firstPartySeeds(tx, adv.id, input.seedIds);
      const total = seeds.reduce((s, x) => s + Number(x.sizeDisplay ?? 0), 0);
      const display = lookalikeSize(total, input.reachPct);
      return {
        rules: {
          ...base,
          seeds: seeds.map((s) => ({ id: s.id, users: Number(s.sizeDisplay ?? 0) })).concat(
            // ids that did not resolve still count towards the 1 to 10 check
            Array.from({ length: Math.max(0, input.seedIds.length - seeds.length) }, (_, i) => ({ id: `missing${i}`, users: 0 })),
          ),
          reachPct: input.reachPct,
          countries: input.countries,
        },
        data: {
          lookalikeReachPct: input.reachPct.toFixed(1),
          lookalikeCountries: input.countries,
          reachExpansion: lookalikeExpansion(input.reachPct).toFixed(2),
          ...availabilityFor('LOOKALIKE', ctx.simNow),
          config: { targetSizes: spreadSizes(display) },
        },
        children: async (t, id) => {
          if (seeds.length)
            await t.audienceSeed.createMany({
              data: seeds.map((s) => ({ sandboxId: ctx.sandboxId, audienceId: id, seedAudienceId: s.id })),
            });
        },
      };
    }
    case 'COMBINED': {
      const est = await estimateCombined(tx, adv.id, input.draft);
      const allIds = input.draft.include.map((g) => g.map((m) => m.id));
      return {
        rules: {
          ...base,
          includeGroups: allIds,
          excludeIds: input.draft.exclude.map((m) => m.id),
          cyclic: false,
          allIncludedArchived: est.allArchived,
        },
        data: {
          description: input.description ?? null,
          ...sizeData(est.sizes),
          ...availabilityFor('COMBINED', ctx.simNow),
        },
        children: async (t, id) => {
          const terms: Prisma.CombinedAudienceTermCreateManyInput[] = [];
          est.resolved.include.forEach((g, gi) =>
            g.forEach((m) =>
              terms.push({ sandboxId: ctx.sandboxId, audienceId: id, mode: 'INCLUDE', groupIndex: gi, memberKind: m.kind as never, memberId: m.rowId }),
            ),
          );
          est.resolved.exclude.forEach((m) =>
            terms.push({ sandboxId: ctx.sandboxId, audienceId: id, mode: 'EXCLUDE', groupIndex: 0, memberKind: m.kind as never, memberId: m.rowId }),
          );
          if (terms.length) await t.combinedAudienceTerm.createMany({ data: terms });
        },
      };
    }
    default: {
      // custom affinity and custom intent
      const entries = { interests: input.interests, urls: input.urls, apps: input.apps, keywords: input.keywords };
      const est = estimateCustomList(entries);
      const key = [...input.interests, ...input.urls, ...input.apps, ...input.keywords].join('|');
      const target =
        'unavailable' in est ? spreadSizes(0) : spreadSizes(customListSize(`${name}:${key}`), { youtube: 0.7, mobileApp: 0.4, ctv: 0.15 });
      const appRows = input.apps.length
        ? await tx.appCatalog.findMany({ where: { id: { in: input.apps } }, select: { id: true, name: true } })
        : [];
      return {
        rules: { ...base, interests: input.interests, urls: input.urls, apps: input.apps, keywords: input.keywords },
        data: {
          description: input.description ?? null,
          ...availabilityFor(input.kind, ctx.simNow),
          config: { targetSizes: target },
        },
        children: async (t, id) => {
          const rows: Prisma.CustomListEntryCreateManyInput[] = [];
          let n = 0;
          const add = (kind: 'INTEREST' | 'URL' | 'APP' | 'KEYWORD', value: string, appId?: string) =>
            rows.push({ sandboxId: ctx.sandboxId, audienceId: id, kind, value, ...(appId ? { appId } : {}), ordinal: n++ });
          input.interests.forEach((v) => add('INTEREST', v));
          input.urls.forEach((v) => add('URL', v));
          appRows.forEach((a) => add('APP', a.name, a.id));
          input.keywords.forEach((v) => add('KEYWORD', v));
          if (rows.length) await t.customListEntry.createMany({ data: rows });
        },
      };
    }
  }
}

export async function createAudience(
  user: SessionUser,
  aid: string,
  input: AudienceInput,
  meta: WriteMeta = {},
): Promise<Result<{ id: string; availableAt: string | null; status: AudienceStatusKey; match?: { rows: number; matched: number; matchRatePct: number } }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertAudienceWrite(ctx);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const adv = await loadAdvertiser(tx, aid);
      await settle(tx, ctx, adv.id);
      const built = await build(tx, ctx, adv, input);
      const issues = validateAudience(ctx, adv, 'create', built.rules);
      if (issues.some((i) => i.blocking)) throw invalid(issues);
      const created = await withChangeLog(
        changeCtx(ctx, tx, { note: meta.changeNote ?? '' }),
        { type: 'AUDIENCE', chain: { advertiserId: adv.id } },
        async (t) => {
          const row = await t.audience.create({
            data: { ...built.data, sandboxId: ctx.sandboxId, advertiserId: adv.id, name: input.name.trim(), type: input.kind },
            select: { id: true, publicId: true, availableAt: true, status: true },
          });
          await built.children(t, row.id);
          return row;
        },
      );
      return {
        data: {
          id: created.publicId.toString(),
          availableAt: created.availableAt?.toISOString() ?? null,
          status: created.status,
          ...(built.match ? { match: built.match } : {}),
        },
        warnings: softIssues(issues),
      };
    });
  });
}

/** Rule check without saving (blur and the form's live errors). */
export async function validateAudienceDraft(user: SessionUser, aid: string, input: AudienceInput) {
  const ctx = await serviceCtx(user);
  assertAudienceRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const adv = await loadAdvertiser(tx, aid);
    await settle(tx, ctx, adv.id);
    const built = await build(tx, ctx, adv, input);
    return validateAudience(ctx, adv, 'create', built.rules);
  });
}

// ---------------------------------------------------------------------------------------------
// Update, archive
// ---------------------------------------------------------------------------------------------

export interface AudienceChanges {
  name?: string;
  description?: string | null;
  membershipDays?: number | string;
  /** Locked fields: a value that differs from the stored one fails AUD-110. */
  locked?: Record<string, unknown>;
}

export async function updateAudience(
  user: SessionUser,
  seg: string,
  changes: AudienceChanges,
  meta: WriteMeta = {},
): Promise<Result<{ version: number }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertAudienceWrite(ctx);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const stored = await loadStored(tx, seg);
      if (meta.expectedVersion !== undefined && meta.expectedVersion !== stored.version) throw conflict();
      const adv = await loadAdvertiser(tx, (await tx.advertiser.findUniqueOrThrow({ where: { id: stored.advertiserId }, select: { publicId: true } })).publicId.toString());
      const type = stored.type;
      if (stored.source === 'GOOGLE_ANALYTICS' && type === 'TAG_BASED') throw forbidden();
      const lockedChanges = Object.entries(changes.locked ?? {})
        .filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(lockedValue(stored, k)))
        .map(([k]) => k);
      // Membership duration is not editable on lookalike lists (no duration).
      if (changes.membershipDays !== undefined && type === 'LOOKALIKE') lockedChanges.push('membershipDays');
      const name = changes.name ?? stored.name;
      const issues = validateAudience(ctx, adv, 'edit', {
        type,
        name,
        lockedChanges,
        ...(changes.membershipDays !== undefined && type !== 'LOOKALIKE'
          ? { membershipDays: changes.membershipDays }
          : {}),
      });
      if (issues.some((i) => i.blocking)) throw invalid(issues);
      await withChangeLog(
        changeCtx(ctx, tx, { note: meta.changeNote ?? '' }),
        { type: 'AUDIENCE', id: stored.id, chain: { advertiserId: stored.advertiserId } },
        async (t) => {
          const n = await t.audience.updateMany({
            where: { id: stored.id, version: stored.version },
            data: {
              name: name.trim(),
              ...(changes.description !== undefined ? { description: changes.description } : {}),
              ...(changes.membershipDays !== undefined && type !== 'LOOKALIKE'
                ? { membershipDays: Number(changes.membershipDays) }
                : {}),
              version: { increment: 1 },
            },
          });
          if (n.count === 0) throw conflict();
          return { id: stored.id };
        },
      );
      return { data: { version: stored.version + 1 }, warnings: softIssues(issues) };
    });
  });
}

function lockedValue(a: AudienceRowDb, key: string): unknown {
  switch (key) {
    case 'type':
      return a.type;
    case 'floodlightActivityId':
      return a.floodlightActivityId;
    case 'reachPct':
      return a.lookalikeReachPct === null ? null : Number(a.lookalikeReachPct);
    case 'countries':
      return a.lookalikeCountries;
    case 'contactType':
      return configOf(a.config).contactType ?? null;
    default:
      return undefined;
  }
}

export interface ArchiveOutcome {
  archived: boolean;
  /** Active line items that target the list (AUD-100). */
  lineItems: number;
}

async function activeLineItemCount(tx: Tx, audienceId: string): Promise<number> {
  const rows = await tx.targetingAssignment.findMany({
    where: { refType: 'AUDIENCE', refId: audienceId, lineItemId: { not: null } },
    select: { lineItem: { select: { id: true, status: true } } },
  });
  return new Set(rows.filter((r) => r.lineItem?.status === 'ACTIVE').map((r) => r.lineItem!.id)).size;
}

/** Archive; asks for confirmation first when active line items target the list (AUD-100, DLG-03). */
export async function archiveAudience(
  user: SessionUser,
  seg: string,
  confirmed = false,
): Promise<Result<ArchiveOutcome>> {
  return asResult<ArchiveOutcome>(async () => {
    const ctx = await serviceCtx(user);
    assertAudienceWrite(ctx);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const stored = await loadStored(tx, seg);
      if (stored.status === 'ARCHIVED') return { data: { archived: true, lineItems: 0 } };
      const n = await activeLineItemCount(tx, stored.id);
      const adv = await loadAdvertiser(tx, (await tx.advertiser.findUniqueOrThrow({ where: { id: stored.advertiserId }, select: { publicId: true } })).publicId.toString());
      const issues = validateAudience(ctx, adv, 'edit', { type: stored.type, name: stored.name, targetingLineItems: n });
      if (n > 0 && !confirmed) return { data: { archived: false, lineItems: n }, warnings: softIssues(issues) };
      await setStatus(ctx, tx, stored, 'ARCHIVED');
      return { data: { archived: true, lineItems: n } };
    });
  });
}

async function setStatus(ctx: ServiceCtx, tx: Tx, stored: AudienceRowDb, status: AudienceStatusKey): Promise<void> {
  const cfg = configOf(stored.config);
  const next: AudienceConfig = { ...cfg, restricted: status === 'ARCHIVED' };
  await withChangeLog(
    changeCtx(ctx, tx),
    { type: 'AUDIENCE', id: stored.id, chain: { advertiserId: stored.advertiserId } },
    async (t) => {
      await t.audience.update({
        where: { id: stored.id },
        data: { status, config: next as unknown as Prisma.InputJsonValue, version: { increment: 1 } },
      });
      return { id: stored.id };
    },
  );
}

export async function bulkAudienceAction(
  user: SessionUser,
  req: { ids: string[]; action: 'ARCHIVE' | 'UNARCHIVE' },
): Promise<Result<{ done: number; failed: number }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertAudienceWrite(ctx);
    return withSandbox(ctx.sandboxId, async (tx) => {
      let done = 0;
      let failed = 0;
      for (const id of req.ids) {
        const stored = await tx.audience.findFirst({ where: idWhere(id) });
        if (!stored) {
          failed++;
          continue;
        }
        if (req.action === 'ARCHIVE') {
          if (stored.status !== 'ARCHIVED') await setStatus(ctx, tx, stored, 'ARCHIVED');
        } else if (stored.status === 'ARCHIVED') {
          const live = stored.availableAt && stored.availableAt > ctx.simNow;
          await setStatus(ctx, tx, stored, live ? 'PROCESSING' : stored.sizeDisplay === null || Number(stored.sizeDisplay) === 0 ? 'INACTIVE' : 'ACTIVE');
        }
        done++;
      }
      return { data: { done, failed } };
    });
  });
}

/** Add a file or product to a customer match list created with "set up a data source later". */
export async function addCustomerMatchData(
  user: SessionUser,
  seg: string,
  input: { fileName: string; fileText: string; contactType: 'EMAIL' | 'PHONE' | 'MAIL_ADDRESS' | 'MOBILE_DEVICE_ID'; consentAck: boolean },
): Promise<Result<{ rows: number; matched: number; matchRatePct: number }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertAudienceWrite(ctx);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const stored = await loadStored(tx, seg);
      if (stored.type !== 'CUSTOMER_MATCH') throw notFound();
      const adv = await loadAdvertiser(tx, (await tx.advertiser.findUniqueOrThrow({ where: { id: stored.advertiserId }, select: { publicId: true } })).publicId.toString());
      const parsed = parseCustomerMatchCsv(input.fileText, input.fileName);
      const issues = validateAudience(ctx, adv, 'create', {
        type: 'CUSTOMER_MATCH',
        name: stored.name,
        dataSource: 'UPLOAD',
        file: { present: Boolean(input.fileText), ...(parsed.error ? { error: parsed.error } : {}) },
        consentAck: input.consentAck,
      });
      if (issues.some((i) => i.blocking)) throw invalid(issues);
      const res = matchResult(parsed.rows, matchRate(ctx.sandboxId, stored.id, csvHash(input.fileText)));
      await withChangeLog(
        changeCtx(ctx, tx),
        { type: 'AUDIENCE', id: stored.id, chain: { advertiserId: stored.advertiserId } },
        async (t) => {
          await t.customerMatchUpload.create({
            data: {
              sandboxId: ctx.sandboxId,
              audienceId: stored.id,
              contactType: input.contactType,
              fileName: input.fileName,
              rowCount: res.rows,
              matchedCount: res.matched,
              matchRatePct: res.matchRatePct.toFixed(2),
              status: 'DONE',
            },
          });
          const av = availabilityFor('CUSTOMER_MATCH', ctx.simNow);
          await t.audience.update({
            where: { id: stored.id },
            data: {
              status: av.status,
              availableAt: av.availableAt,
              consentAck: true,
              dataSource: 'UPLOAD',
              config: { ...configOf(stored.config), targetSizes: spreadSizes(res.matched), contactType: input.contactType },
              version: { increment: 1 },
            },
          });
          return { id: stored.id };
        },
      );
      return { data: res };
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Picker, Google catalogue, estimator
// ---------------------------------------------------------------------------------------------

export interface PickerQuery {
  type: 'FIRST_PARTY' | 'PAIR' | 'PARTNER' | 'COMMERCE' | 'LINEAR_TV' | 'THIRD_PARTY' | 'GOOGLE' | 'CUSTOM' | 'COMBINED';
  q?: string;
  eligibility?: 'DISPLAY' | 'YOUTUBE' | 'MOBILE_APP' | 'CTV';
  path?: string[];
}

function eligibilityOf(s: SizeMap): string[] {
  return [
    ...(s.display >= 1000 ? ['DISPLAY'] : []),
    ...(s.youtube >= 1000 ? ['YOUTUBE'] : []),
    ...(s.mobileApp >= 1000 ? ['MOBILE_APP'] : []),
    ...(s.ctv >= 1000 ? ['CTV'] : []),
  ];
}


export async function searchAudiencePicker(user: SessionUser, aid: string, q: PickerQuery): Promise<PickerRow[]> {
  const ctx = await serviceCtx(user);
  assertAudienceRead(ctx);
  const needle = q.q?.trim().toLowerCase();
  if (q.type === 'GOOGLE') {
    return browseGoogleAudiences({ q: q.q, path: q.path }).map((g) => ({ ...g, type: 'GOOGLE' })).filter((g) => !q.eligibility || g.eligibility.includes(q.eligibility));
  }
  if (q.type === 'PAIR' || q.type === 'LINEAR_TV' || q.type === 'THIRD_PARTY') return [];
  const types: AudienceTypeKey[] =
    q.type === 'FIRST_PARTY'
      ? TABS.FIRST_PARTY
      : q.type === 'CUSTOM'
        ? TABS.CUSTOM
        : q.type === 'COMBINED'
          ? TABS.COMBINED
          : TABS.PARTNER;
  return withSandbox(ctx.sandboxId, async (tx) => {
    const adv = await loadAdvertiser(tx, aid);
    await settle(tx, ctx, adv.id);
    const rows = await tx.audience.findMany({
      where: { advertiserId: adv.id, type: { in: types as never }, status: { in: ['PROCESSING', 'ACTIVE'] } },
      orderBy: { name: 'asc' },
    });
    return rows
      .filter((r) => !needle || r.name.toLowerCase().includes(needle))
      .map((r) => {
        const sizes = sizeMapOf(r);
        const hours = hoursUntil(r.availableAt, ctx.simNow);
        return {
          id: r.publicId.toString(),
          name: r.name,
          path: [TYPE_LABEL[r.type], r.name],
          type: r.type,
          sizeBucket: bucketOf(r.sizeDisplay),
          eligibility: eligibilityOf(sizes),
          availableInHours: hours,
        } satisfies PickerRow;
      })
      .filter((r) => !q.eligibility || r.availableInHours > 0 || r.eligibility.includes(q.eligibility));
  });
}

export function browseGoogleAudiences(q: { kind?: string; q?: string; path?: string[] }): PickerRow[] {
  const needle = q.q?.trim().toLowerCase();
  return GOOGLE.filter((g) => !q.kind || g.kind === q.kind)
    .filter((g) => !needle || g.name.toLowerCase().includes(needle) || g.path.join(' ').toLowerCase().includes(needle))
    .filter((g) => !q.path?.length || q.path.every((p, i) => g.path[i] === p))
    .slice(0, 200)
    .map((g) => {
      const sizes = googleAudienceSize(g.id, g.kind);
      return {
        id: g.id,
        name: g.name,
        path: g.path,
        type: g.kind,
        sizeBucket: bucketOf(sizes.display),
        eligibility: eligibilityOf(sizes),
        availableInHours: 0,
      };
    });
}

/** Impressions Estimator and the combined summary (module 14 S9, S11, S12). */
export async function estimateAudience(
  user: SessionUser,
  aid: string,
  draft:
    | { kind: 'CUSTOM'; interests: string[]; urls: string[]; apps: string[]; keywords: string[] }
    | { kind: 'COMBINED'; draft: CombinedDraft },
): Promise<{ sizes: Record<'display' | 'youtube' | 'mobileApp' | 'ctv', SizeCell>; expression?: string } | { unavailable: true }> {
  const ctx = await serviceCtx(user);
  assertAudienceRead(ctx);
  const wrap = (s: SizeMap) => ({
    display: cell(s.display),
    youtube: cell(s.youtube),
    mobileApp: cell(s.mobileApp),
    ctv: cell(s.ctv),
  });
  if (draft.kind === 'CUSTOM') {
    const est = estimateCustomList({ interests: draft.interests, urls: draft.urls, apps: draft.apps, keywords: draft.keywords });
    return 'unavailable' in est ? { unavailable: true } : { sizes: wrap(est) };
  }
  return withSandbox(ctx.sandboxId, async (tx) => {
    const adv = await loadAdvertiser(tx, aid);
    await settle(tx, ctx, adv.id);
    const est = await estimateCombined(tx, adv.id, draft.draft);
    if (est.resolved.include.every((g) => g.length === 0)) return { unavailable: true as const };
    const nameOf = async (m: { kind: string; id: string }) => {
      const r = await resolveMember(tx, adv.id, m);
      if (!r) return null;
      if (m.kind === 'GOOGLE_AUDIENCE') return GOOGLE_BY_ID.get(m.id)?.name ?? m.id;
      return (await tx.audience.findUnique({ where: { id: r.rowId }, select: { name: true } }))?.name ?? m.id;
    };
    const inc: { name: string }[][] = [];
    for (const g of draft.draft.include) {
      const names: { name: string }[] = [];
      for (const m of g) {
        const n = await nameOf(m);
        if (n) names.push({ name: n });
      }
      inc.push(names);
    }
    const exc: { name: string }[] = [];
    for (const m of draft.draft.exclude) {
      const n = await nameOf(m);
      if (n) exc.push({ name: n });
    }
    return { sizes: wrap(est.sizes), expression: expression(inc, exc) };
  });
}

// ---------------------------------------------------------------------------------------------
// Line items tab (S15)
// ---------------------------------------------------------------------------------------------

export async function listAudienceLineItems(user: SessionUser, seg: string): Promise<LinkedLineItem[]> {
  const ctx = await serviceCtx(user);
  assertAudienceRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const a = await loadStored(tx, seg);
    const rows = await tx.targetingAssignment.findMany({
      where: { refType: 'AUDIENCE', refId: a.id, lineItemId: { not: null } },
      select: {
        mode: true,
        lineItem: {
          select: {
            id: true,
            publicId: true,
            name: true,
            status: true,
            type: true,
            campaign: { select: { publicId: true } },
            io: { select: { publicId: true } },
          },
        },
      },
    });
    const seen = new Map<string, LinkedLineItem>();
    for (const r of rows) {
      if (!r.lineItem || seen.has(r.lineItem.id)) continue;
      seen.set(r.lineItem.id, {
        id: r.lineItem.publicId.toString(),
        name: r.lineItem.name,
        status: r.lineItem.status,
        type: r.lineItem.type,
        campaignId: r.lineItem.campaign.publicId.toString(),
        ioId: r.lineItem.io.publicId.toString(),
        mode: r.mode === 'EXCLUDE' ? 'Excluded' : 'Included',
      });
    }
    return [...seen.values()].sort((x, y) => x.name.localeCompare(y.name));
  });
}

// ---------------------------------------------------------------------------------------------
// Analysis (S16 to S18)
// ---------------------------------------------------------------------------------------------

const countryOfCurrency = (c: string): string => (c === 'USD' ? 'US' : c === 'SGD' ? 'SG' : 'IN');

export async function analyzeGeoDistribution(
  user: SessionUser,
  aid: string,
  seedSeg: string,
): Promise<Result<GeoDistribution>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertAudienceRead(ctx);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const adv = await loadAdvertiser(tx, aid);
      await settle(tx, ctx, adv.id);
      const seed = await tx.audience.findFirst({
        where: { ...idWhere(seedSeg), advertiserId: adv.id, type: { in: FIRST_PARTY_SEEDS as never } },
      });
      if (!seed) throw notFound();
      const users = Number(seed.sizeDisplay ?? 0);
      const issues = validateAudience(ctx, adv, 'edit', {
        type: seed.type,
        name: seed.name,
        analysisSeedUsers: users,
      });
      if (issues.some((i) => i.blocking)) throw invalid(issues);
      return {
        data: geoDistribution(
          { id: seed.publicId.toString(), name: seed.name, size: users },
          countryOfCurrency(adv.currencyCode),
          ctx.simNow.toISOString(),
        ),
      };
    });
  });
}

/** Line items with Optimized Targeting on (the insights selector). */
export async function listInsightLineItems(
  user: SessionUser,
  aid: string,
): Promise<{ id: string; name: string; optimized: boolean }[]> {
  const ctx = await serviceCtx(user);
  assertAudienceRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const adv = await loadAdvertiser(tx, aid);
    const rows = await tx.lineItem.findMany({
      where: { advertiserId: adv.id, optimizedTargeting: true, status: { not: 'ARCHIVED' } },
      orderBy: { name: 'asc' },
      select: { publicId: true, name: true, optimizedTargeting: true },
    });
    return rows.map((r) => ({ id: r.publicId.toString(), name: r.name, optimized: r.optimizedTargeting }));
  });
}

export async function getAudienceInsights(
  user: SessionUser,
  aid: string,
  liSeg: string,
): Promise<Result<AudienceInsights>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertAudienceRead(ctx);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const adv = await loadAdvertiser(tx, aid);
      const li = await tx.lineItem.findFirst({
        where: { ...idWhere(liSeg), advertiserId: adv.id },
        select: { id: true, publicId: true, name: true, optimizedTargeting: true },
      });
      if (!li) throw notFound();
      const issues = validateAudience(ctx, adv, 'edit', {
        type: 'CUSTOM_AFFINITY',
        name: li.name,
        insightsOptimized: li.optimizedTargeting,
      });
      if (issues.some((i) => i.blocking)) throw invalid(issues);
      const sample = Math.round(keyed(`insights:${li.id}`, 40_000, 400_000));
      return { data: audienceInsights(li.publicId.toString(), countryOfCurrency(adv.currencyCode), sample) };
    });
  });
}

