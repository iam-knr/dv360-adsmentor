import 'server-only';
// Channels, negative keyword lists and location lists: services of module 15 4.1 (M15-03, M15-04). Every write goes
// through withChangeLog; deleting a list removes the targeting rows that use it and leaves History on those line items.
import type { Prisma, TargetRefType } from '@prisma/client';
import type { SessionUser } from '@/lib/auth/types';
import type { WireIssue } from '@/lib/campaigns/wire';
import { withChangeLog } from '@/lib/changelog';
import { withSandbox, type Tx } from '@/lib/db';
import { validate } from '@/lib/validation/engine';
import type { Issue } from '@/lib/validation';
import {
  asResult,
  assertResourceRead,
  assertResourceWrite,
  changeCtx,
  conflict,
  countryOf,
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
import { parseKeywords } from './keywords';
import { RESOURCE_LIMITS } from './limits';
import { resolveLocationEntries, type GeoOptionRef, type LocationResolution } from './location';
import { formatSites, parseSites, statsOf, type ChannelEntryDraft } from './parse-sites';
import type {
  ChannelInput,
  ChannelRow,
  ChannelView,
  KeywordListInput,
  KeywordListRow,
  KeywordListView,
  LocationListInput,
  LocationListRow,
  LocationListView,
  ResolutionRow,
  UsingLineItem,
  WriteMeta,
} from './wire';

export type ResourceScope = { level: 'advertiser' | 'partner'; id: string };

const CHUNK = 1000;

async function createInChunks<T>(
  rows: T[],
  write: (batch: T[]) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) await write(rows.slice(i, i + CHUNK));
}

// ---------------------------------------------------------------------------------------------
// Usage by line items (TargetingAssignment, "Included by" / "Excluded by" counts)
// ---------------------------------------------------------------------------------------------

interface Usage {
  included: Set<string>;
  excluded: Set<string>;
}

async function usageOf(tx: Tx, refType: TargetRefType, ids: string[]): Promise<Map<string, Usage>> {
  const out = new Map<string, Usage>();
  if (ids.length === 0) return out;
  const rows = await tx.targetingAssignment.findMany({
    where: { refType, refId: { in: ids }, lineItemId: { not: null } },
    select: { refId: true, mode: true, lineItemId: true },
  });
  for (const r of rows) {
    if (!r.refId || !r.lineItemId) continue;
    const u = out.get(r.refId) ?? { included: new Set(), excluded: new Set() };
    (r.mode === 'EXCLUDE' ? u.excluded : u.included).add(r.lineItemId);
    out.set(r.refId, u);
  }
  return out;
}

async function usingLineItems(
  tx: Tx,
  refType: TargetRefType,
  id: string,
  withFlag = false,
): Promise<UsingLineItem[]> {
  const rows = await tx.targetingAssignment.findMany({
    where: { refType, refId: id, lineItemId: { not: null } },
    select: { mode: true, lineItem: { select: { id: true, publicId: true, name: true } } },
  });
  const seen = new Map<string, UsingLineItem>();
  for (const r of rows) {
    if (!r.lineItem || seen.has(r.lineItem.id)) continue;
    seen.set(r.lineItem.id, {
      publicId: r.lineItem.publicId.toString(),
      name: r.lineItem.name,
      ...(withFlag
        ? { flag: r.mode === 'EXCLUDE' ? ('Excluded' as const) : ('Included' as const) }
        : {}),
    });
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Deleting a list or channel removes the targeting rows that use it, after the confirm dialog (module 15 4.7), and
 * writes one History group per affected line item.
 */
async function removeAssignments(
  ctx: ServiceCtx,
  tx: Tx,
  refType: TargetRefType,
  id: string,
  listName: string,
  noun: string,
): Promise<number> {
  const rows = await tx.targetingAssignment.findMany({
    where: { refType, refId: id },
    select: {
      id: true,
      lineItem: { select: { id: true, publicId: true, name: true, advertiserId: true } },
    },
  });
  const actor = ctx.user.actor ?? ctx.user;
  const lis = new Map<string, NonNullable<(typeof rows)[number]['lineItem']>>();
  for (const r of rows) if (r.lineItem) lis.set(r.lineItem.id, r.lineItem);
  for (const li of lis.values()) {
    const g = await tx.changeGroup.create({
      data: {
        sandboxId: ctx.sandboxId,
        classroomId: ctx.classroomId,
        advertiserId: li.advertiserId,
        lineItemId: li.id,
        entityType: 'LINE_ITEM',
        entityId: li.id,
        entityPublicId: li.publicId,
        entityName: li.name,
        actorType: 'USER',
        userId: actor.id,
        actorLabel: actor.name || actor.email,
        source: 'UI',
        summary: `Removed ${noun} "${listName}" from targeting`,
        occurredAt: new Date(),
      },
      select: { id: true },
    });
    await tx.changeEntry.create({
      data: {
        groupId: g.id,
        sandboxId: ctx.sandboxId,
        kind: 'DELETE',
        fieldPath: `targeting.${refType.toLowerCase()}[${id}]`,
        label: `Targeting: ${noun}`,
        oldValue: listName,
        newValue: null,
        sortOrder: 0,
      },
    });
  }
  await tx.targetingAssignment.deleteMany({ where: { refType, refId: id } });
  return lis.size;
}

function lines(text: string): string[] {
  return text.split(/\r?\n/);
}

function check(
  kind: 'channel' | 'keywordList' | 'locationList',
  entity: unknown,
  vctx: ReturnType<typeof resourceContext>,
): Issue[] {
  return validate(kind, entity, vctx, { trigger: 'save' });
}

// ---------------------------------------------------------------------------------------------
// Channels (CH-001..008)
// ---------------------------------------------------------------------------------------------

type ChannelParent = { advertiser: AdvertiserRow } | { partner: { id: string; publicId: bigint } };

async function resolveParent(tx: Tx, scope: ResourceScope): Promise<ChannelParent> {
  if (scope.level === 'advertiser') return { advertiser: await loadAdvertiser(tx, scope.id) };
  return { partner: await loadPartner(tx, scope.id) };
}

async function contextAdvertiser(tx: Tx, parent: ChannelParent): Promise<AdvertiserRow> {
  if ('advertiser' in parent) return parent.advertiser;
  const first = await tx.advertiser.findFirst({
    where: { partnerId: parent.partner.id },
    select: {
      id: true,
      publicId: true,
      partnerId: true,
      name: true,
      currencyCode: true,
      timeZone: true,
      demandGenFloodlightOptimization: true,
      googleInventoryEnabled: true,
      floodlightGroupId: true,
    },
  });
  if (first) return first;
  const p = await tx.partner.findUniqueOrThrow({
    where: { id: parent.partner.id },
    select: { currencyCode: true, timeZone: true },
  });
  return {
    id: '',
    publicId: 0n,
    partnerId: parent.partner.id,
    name: '',
    currencyCode: p.currencyCode,
    timeZone: p.timeZone,
    demandGenFloodlightOptimization: false,
    googleInventoryEnabled: true,
    floodlightGroupId: null,
  };
}

async function nameApps(tx: Tx, entries: ChannelEntryDraft[]): Promise<ChannelEntryDraft[]> {
  const ids = entries.filter((e) => e.kind !== 'URL').map((e) => e.value);
  if (ids.length === 0) return entries;
  const catalog = await tx.appCatalog.findMany({
    where: { appId: { in: ids } },
    select: { appId: true, name: true },
  });
  const names = new Map(catalog.map((c) => [c.appId, c.name]));
  return entries.map((e) =>
    e.kind === 'URL' || e.displayName ? e : { ...e, displayName: names.get(e.value) ?? null },
  );
}

export async function listChannels(user: SessionUser, scope: ResourceScope): Promise<ChannelRow[]> {
  const ctx = await serviceCtx(user);
  assertResourceRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const parent = await resolveParent(tx, scope);
    const where: Prisma.ChannelWhereInput =
      'advertiser' in parent
        ? {
            status: { not: 'ARCHIVED' },
            OR: [
              { advertiserId: parent.advertiser.id },
              { partnerId: parent.advertiser.partnerId },
            ],
          }
        : { status: { not: 'ARCHIVED' }, partnerId: parent.partner.id };
    const channels = await tx.channel.findMany({
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: { id: true, publicId: true, name: true, partnerId: true },
    });
    const ids = channels.map((c) => c.id);
    const grouped = ids.length
      ? await tx.channelEntry.groupBy({
          by: ['channelId', 'kind'],
          where: { channelId: { in: ids } },
          _count: { _all: true },
        })
      : [];
    const usage = await usageOf(tx, 'CHANNEL', ids);
    return channels.map((c) => {
      const mine = grouped.filter((g) => g.channelId === c.id);
      const urls = mine.filter((g) => g.kind === 'URL').reduce((n, g) => n + g._count._all, 0);
      const apps = mine.filter((g) => g.kind !== 'URL').reduce((n, g) => n + g._count._all, 0);
      const u = usage.get(c.id);
      return {
        id: c.publicId.toString(),
        name: c.name,
        apps,
        urls,
        includedByLis: u?.included.size ?? 0,
        excludedByLis: u?.excluded.size ?? 0,
        ownerScope: c.partnerId ? 'PARTNER' : 'ADVERTISER',
      };
    });
  });
}

export async function getChannel(user: SessionUser, cid: string): Promise<ChannelView> {
  const ctx = await serviceCtx(user);
  assertResourceRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const c = await tx.channel.findFirst({
      where: idWhere(cid),
      include: { entries: { orderBy: { id: 'asc' } } },
    });
    if (!c) throw notFound();
    const parsed = c.entries.map((e) => ({
      kind: e.kind,
      value: e.value,
      displayName: e.displayName,
    }));
    const urls = parsed.filter((e) => e.kind === 'URL').length;
    return {
      id: c.publicId.toString(),
      name: c.name,
      sites: formatSites(parsed),
      siteCount: parsed.length,
      stats: { urls, apps: parsed.length - urls, duplicates: 0, invalid: 0 },
      version: c.version,
      ownerScope: c.partnerId ? 'PARTNER' : 'ADVERTISER',
      lineItems: await usingLineItems(tx, 'CHANNEL', c.id, true),
    };
  });
}

/** Live validation for the editor (CH-001..004), without writing. */
export async function validateChannel(
  user: SessionUser,
  scope: ResourceScope,
  input: ChannelInput,
): Promise<Issue[]> {
  const ctx = await serviceCtx(user);
  assertResourceRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const adv = await contextAdvertiser(tx, await resolveParent(tx, scope));
    return check(
      'channel',
      { name: input.name, sites: lines(input.sites) },
      resourceContext(ctx, adv, 'create'),
    );
  });
}

async function writeEntries(
  tx: Tx,
  ctx: ServiceCtx,
  channelId: string,
  entries: ChannelEntryDraft[],
) {
  await tx.channelEntry.deleteMany({ where: { channelId } });
  await createInChunks(
    entries.map((e) => ({ sandboxId: ctx.sandboxId, channelId, ...e })),
    (batch) => tx.channelEntry.createMany({ data: batch }),
  );
}

export async function createChannel(
  user: SessionUser,
  scope: ResourceScope,
  input: ChannelInput,
  meta: WriteMeta = {},
): Promise<Result<{ id: string; stats: ReturnType<typeof statsOf> }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertResourceWrite(ctx);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const parent = await resolveParent(tx, scope);
      const adv = await contextAdvertiser(tx, parent);
      const issues = check(
        'channel',
        { name: input.name, sites: lines(input.sites) },
        resourceContext(ctx, adv, 'create'),
      );
      if (issues.some((i) => i.blocking)) throw invalid(issues);
      const parsed = parseSites(input.sites);
      const entries = await nameApps(tx, parsed.entries);
      const created = await withChangeLog(
        changeCtx(ctx, tx, { note: meta.changeNote ?? '' }),
        {
          type: 'CHANNEL',
          chain: 'advertiser' in parent ? { advertiserId: parent.advertiser.id } : {},
        },
        async (t) => {
          const c = await t.channel.create({
            data: {
              sandboxId: ctx.sandboxId,
              name: input.name.trim(),
              ...('advertiser' in parent
                ? { advertiserId: parent.advertiser.id }
                : { partnerId: parent.partner.id }),
            },
            select: { id: true, publicId: true },
          });
          await writeEntries(t, ctx, c.id, entries);
          return c;
        },
      );
      return {
        data: { id: created.publicId.toString(), stats: statsOf(parsed) },
        warnings: softIssues(issues),
      };
    });
  });
}

export async function updateChannel(
  user: SessionUser,
  cid: string,
  input: Partial<ChannelInput>,
  meta: WriteMeta = {},
): Promise<Result<{ stats: ReturnType<typeof statsOf>; version: number }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertResourceWrite(ctx);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const stored = await tx.channel.findFirst({
        where: idWhere(cid),
        include: { entries: true },
      });
      if (!stored) throw notFound();
      if (meta.expectedVersion !== undefined && meta.expectedVersion !== stored.version)
        throw conflict();
      const parent: ChannelParent = stored.advertiserId
        ? {
            advertiser: await loadAdvertiser(
              tx,
              await publicOf(tx, 'advertiser', stored.advertiserId),
            ),
          }
        : { partner: await loadPartner(tx, await publicOf(tx, 'partner', stored.partnerId!)) };
      const adv = await contextAdvertiser(tx, parent);
      const name = input.name ?? stored.name;
      const text =
        input.sites ??
        formatSites(
          stored.entries.map((e) => ({ kind: e.kind, value: e.value, displayName: e.displayName })),
        );
      const issues = check(
        'channel',
        { name, sites: lines(text) },
        resourceContext(ctx, adv, 'edit'),
      );
      if (issues.some((i) => i.blocking)) throw invalid(issues);
      const parsed = parseSites(text);
      const entries = await nameApps(tx, parsed.entries);
      await withChangeLog(
        changeCtx(ctx, tx, { note: meta.changeNote ?? '' }),
        {
          type: 'CHANNEL',
          id: stored.id,
          chain: stored.advertiserId ? { advertiserId: stored.advertiserId } : {},
        },
        async (t) => {
          const n = await t.channel.updateMany({
            where: { id: stored.id, version: stored.version },
            data: { name: name.trim(), version: { increment: 1 } },
          });
          if (n.count === 0) throw conflict();
          if (input.sites !== undefined) await writeEntries(t, ctx, stored.id, entries);
          return { id: stored.id };
        },
      );
      return {
        data: { stats: statsOf(parsed), version: stored.version + 1 },
        warnings: softIssues(issues),
      };
    });
  });
}

async function publicOf(tx: Tx, model: 'advertiser' | 'partner', id: string): Promise<string> {
  const row =
    model === 'advertiser'
      ? await tx.advertiser.findUnique({ where: { id }, select: { publicId: true } })
      : await tx.partner.findUnique({ where: { id }, select: { publicId: true } });
  if (!row) throw notFound();
  return row.publicId.toString();
}

export interface DeleteOutcome {
  deleted: boolean;
  /** Line items that use the resource. */
  usedBy: number;
}

/**
 * Without `confirmed`, a resource used by line items is not deleted and the CH-008 / KW-005 warning is returned
 * (the DLG confirm dialog); with it the targeting rows go first (module 15 4.7).
 */
export async function deleteChannel(
  user: SessionUser,
  cid: string,
  confirmed = false,
): Promise<Result<DeleteOutcome>> {
  return deleteList(user, cid, 'channel', confirmed);
}

export async function deleteNegativeKeywordList(
  user: SessionUser,
  id: string,
  confirmed = false,
): Promise<Result<DeleteOutcome>> {
  return deleteList(user, id, 'keywordList', confirmed);
}

export async function deleteLocationList(
  user: SessionUser,
  id: string,
  confirmed = false,
): Promise<Result<DeleteOutcome>> {
  return deleteList(user, id, 'locationList', confirmed);
}

const DELETE_META = {
  channel: { type: 'CHANNEL', ref: 'CHANNEL', noun: 'channel', rule: 'CH-008', word: 'channel' },
  keywordList: {
    type: 'KEYWORD_LIST',
    ref: 'KEYWORD_LIST',
    noun: 'negative keyword list',
    rule: 'KW-005',
    word: 'list',
  },
  locationList: {
    type: 'LOCATION_LIST',
    ref: 'LOCATION_LIST',
    noun: 'location list',
    rule: 'KW-005',
    word: 'list',
  },
} as const;

async function deleteList(
  user: SessionUser,
  seg: string,
  kind: keyof typeof DELETE_META,
  confirmed: boolean,
): Promise<Result<DeleteOutcome>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertResourceWrite(ctx);
    const meta = DELETE_META[kind];
    return withSandbox(
      ctx.sandboxId,
      async (tx): Promise<{ data: DeleteOutcome; warnings?: WireIssue[] }> => {
        const where = idWhere(seg);
        const row =
          kind === 'channel'
            ? await tx.channel.findFirst({
                where,
                select: { id: true, name: true, advertiserId: true },
              })
            : kind === 'keywordList'
              ? await tx.keywordList.findFirst({
                  where,
                  select: { id: true, name: true, advertiserId: true },
                })
              : await tx.locationList.findFirst({
                  where,
                  select: { id: true, name: true, advertiserId: true },
                });
        if (!row) throw notFound();
        const used = (await usageOf(tx, meta.ref, [row.id])).get(row.id);
        const usedBy = new Set([...(used?.included ?? []), ...(used?.excluded ?? [])]).size;
        if (usedBy > 0 && !confirmed) {
          return {
            data: { deleted: false, usedBy },
            warnings: [
              {
                path: '*',
                severity: 'warning' as const,
                code: meta.rule,
                message: `${usedBy} line items use this ${meta.word}.`,
              },
            ],
          };
        }
        if (usedBy > 0) await removeAssignments(ctx, tx, meta.ref, row.id, row.name, meta.noun);
        await withChangeLog(
          changeCtx(ctx, tx),
          {
            type: meta.type,
            id: row.id,
            chain: row.advertiserId ? { advertiserId: row.advertiserId } : {},
          },
          async (t) => {
            if (kind === 'channel') await t.channel.delete({ where: { id: row.id } });
            else if (kind === 'keywordList') await t.keywordList.delete({ where: { id: row.id } });
            else await t.locationList.delete({ where: { id: row.id } });
            return { id: row.id };
          },
        );
        return { data: { deleted: true, usedBy } };
      },
    );
  });
}

// ---------------------------------------------------------------------------------------------
// Negative keyword lists (KW-001..005)
// ---------------------------------------------------------------------------------------------

export async function listNegativeKeywordLists(
  user: SessionUser,
  aid: string,
): Promise<KeywordListRow[]> {
  const ctx = await serviceCtx(user);
  assertResourceRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const adv = await loadAdvertiser(tx, aid);
    const lists = await tx.keywordList.findMany({
      where: { advertiserId: adv.id },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: { id: true, publicId: true, name: true, _count: { select: { entries: true } } },
    });
    const usage = await usageOf(
      tx,
      'KEYWORD_LIST',
      lists.map((l) => l.id),
    );
    return lists.map((l) => {
      const u = usage.get(l.id);
      return {
        id: l.publicId.toString(),
        name: l.name,
        keywords: l._count.entries,
        lineItems: new Set([...(u?.included ?? []), ...(u?.excluded ?? [])]).size,
      };
    });
  });
}

export async function getNegativeKeywordList(
  user: SessionUser,
  id: string,
): Promise<KeywordListView> {
  const ctx = await serviceCtx(user);
  assertResourceRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const l = await tx.keywordList.findFirst({
      where: idWhere(id),
      include: { entries: { orderBy: { keyword: 'asc' } } },
    });
    if (!l) throw notFound();
    return {
      id: l.publicId.toString(),
      name: l.name,
      keywords: l.entries.map((e) => e.keyword).join('\n'),
      keywordCount: l.entries.length,
      version: l.version,
      lineItems: await usingLineItems(tx, 'KEYWORD_LIST', l.id),
    };
  });
}

export async function validateNegativeKeywordList(
  user: SessionUser,
  aid: string,
  input: KeywordListInput,
): Promise<Issue[]> {
  const ctx = await serviceCtx(user);
  assertResourceRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const adv = await loadAdvertiser(tx, aid);
    return check(
      'keywordList',
      { name: input.name, keywords: [input.keywords] },
      resourceContext(ctx, adv, 'create'),
    );
  });
}

async function writeKeywords(tx: Tx, ctx: ServiceCtx, listId: string, keywords: string[]) {
  await tx.keywordListEntry.deleteMany({ where: { keywordListId: listId } });
  await createInChunks(
    keywords.map((keyword) => ({ sandboxId: ctx.sandboxId, keywordListId: listId, keyword })),
    (batch) => tx.keywordListEntry.createMany({ data: batch }),
  );
}

export async function createNegativeKeywordList(
  user: SessionUser,
  aid: string,
  input: KeywordListInput,
  meta: WriteMeta = {},
): Promise<Result<{ id: string; count: number }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertResourceWrite(ctx);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const adv = await loadAdvertiser(tx, aid);
      const issues = check(
        'keywordList',
        { name: input.name, keywords: [input.keywords] },
        resourceContext(ctx, adv, 'create'),
      );
      if (issues.some((i) => i.blocking)) throw invalid(issues);
      const { keywords } = parseKeywords(input.keywords);
      const created = await withChangeLog(
        changeCtx(ctx, tx, { note: meta.changeNote ?? '' }),
        { type: 'KEYWORD_LIST', chain: { advertiserId: adv.id } },
        async (t) => {
          const l = await t.keywordList.create({
            data: { sandboxId: ctx.sandboxId, advertiserId: adv.id, name: input.name.trim() },
            select: { id: true, publicId: true },
          });
          await writeKeywords(t, ctx, l.id, keywords);
          return l;
        },
      );
      return {
        data: { id: created.publicId.toString(), count: keywords.length },
        warnings: softIssues(issues),
      };
    });
  });
}

export async function updateNegativeKeywordList(
  user: SessionUser,
  id: string,
  input: Partial<KeywordListInput>,
  meta: WriteMeta = {},
): Promise<Result<{ count: number; version: number }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertResourceWrite(ctx);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const stored = await tx.keywordList.findFirst({
        where: idWhere(id),
        include: { entries: { select: { keyword: true } } },
      });
      if (!stored) throw notFound();
      if (meta.expectedVersion !== undefined && meta.expectedVersion !== stored.version)
        throw conflict();
      const adv = await loadAdvertiser(tx, await publicOf(tx, 'advertiser', stored.advertiserId));
      const name = input.name ?? stored.name;
      const text = input.keywords ?? stored.entries.map((e) => e.keyword).join('\n');
      const issues = check(
        'keywordList',
        { name, keywords: [text] },
        resourceContext(ctx, adv, 'edit'),
      );
      if (issues.some((i) => i.blocking)) throw invalid(issues);
      const { keywords } = parseKeywords(text);
      await withChangeLog(
        changeCtx(ctx, tx, { note: meta.changeNote ?? '' }),
        { type: 'KEYWORD_LIST', id: stored.id, chain: { advertiserId: stored.advertiserId } },
        async (t) => {
          const n = await t.keywordList.updateMany({
            where: { id: stored.id, version: stored.version },
            data: { name: name.trim(), version: { increment: 1 } },
          });
          if (n.count === 0) throw conflict();
          if (input.keywords !== undefined) await writeKeywords(t, ctx, stored.id, keywords);
          return { id: stored.id };
        },
      );
      return {
        data: { count: keywords.length, version: stored.version + 1 },
        warnings: softIssues(issues),
      };
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Location lists (LOC-001..005)
// ---------------------------------------------------------------------------------------------

async function geoOptions(tx: Tx): Promise<GeoOptionRef[]> {
  const rows = await tx.targetingOption.findMany({
    where: { dimension: 'GEOGRAPHY' },
    select: { id: true, code: true, name: true, meta: true },
  });
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    kind: (r.meta as { kind?: string } | null)?.kind ?? null,
  }));
}

export async function listLocationLists(
  user: SessionUser,
  aid: string,
): Promise<LocationListRow[]> {
  const ctx = await serviceCtx(user);
  assertResourceRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const adv = await loadAdvertiser(tx, aid);
    const lists = await tx.locationList.findMany({
      where: { advertiserId: adv.id },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        publicId: true,
        name: true,
        type: true,
        _count: { select: { entries: true } },
      },
    });
    const usage = await usageOf(
      tx,
      'LOCATION_LIST',
      lists.map((l) => l.id),
    );
    return lists.map((l) => {
      const u = usage.get(l.id);
      return {
        id: l.publicId.toString(),
        name: l.name,
        type: l.type,
        count: l._count.entries,
        lineItems: new Set([...(u?.included ?? []), ...(u?.excluded ?? [])]).size,
      };
    });
  });
}

export async function getLocationList(user: SessionUser, id: string): Promise<LocationListView> {
  const ctx = await serviceCtx(user);
  assertResourceRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const l = await tx.locationList.findFirst({
      where: idWhere(id),
      include: { entries: { orderBy: { id: 'asc' } } },
    });
    if (!l) throw notFound();
    return {
      id: l.publicId.toString(),
      name: l.name,
      type: l.type,
      entries: l.entries.map((e) => e.value).join('\n'),
      entryCount: l.entries.length,
      version: l.version,
      lineItems: await usingLineItems(tx, 'LOCATION_LIST', l.id),
    };
  });
}

/** The resolution preview table under the textarea (module 15 S6). */
export async function previewLocationEntries(
  user: SessionUser,
  aid: string,
  input: Pick<LocationListInput, 'type' | 'entries'>,
): Promise<ResolutionRow[]> {
  const ctx = await serviceCtx(user);
  assertResourceRead(ctx);
  if (!input.type) return [];
  const type = input.type;
  return withSandbox(ctx.sandboxId, async (tx) => {
    const adv = await loadAdvertiser(tx, aid);
    const res = resolveLocationEntries(
      type,
      input.entries,
      await geoOptions(tx),
      countryOf(adv.currencyCode),
    );
    const rows: ResolutionRow[] = [];
    const resolvedByText = new Map(res.resolved.map((r) => [r.value, r]));
    lines(input.entries).forEach((raw, i) => {
      const text = raw.trim();
      if (!text) return;
      const ok = resolvedByText.get(text);
      const bad = res.unresolved.find((u) => u.line === i + 1);
      if (ok) rows.push({ line: i + 1, text, resolvedAs: ok.resolvedLabel, status: 'Resolved' });
      else if (bad) rows.push({ line: i + 1, text, resolvedAs: bad.reason, status: 'Not found' });
    });
    return rows.slice(0, 200);
  });
}

async function locationIssues(
  ctx: ServiceCtx,
  tx: Tx,
  adv: AdvertiserRow,
  input: LocationListInput,
  mode: 'create' | 'edit',
  storedType: LocationListInput['type'] = null,
): Promise<{ issues: Issue[]; resolution: LocationResolution | null }> {
  const options = await geoOptions(tx);
  const issues = check(
    'locationList',
    {
      name: input.name,
      type: input.type,
      entries: lines(input.entries),
      geoOptions: options,
      storedType,
    },
    resourceContext(ctx, adv, mode),
  );
  const resolution = input.type
    ? resolveLocationEntries(input.type, input.entries, options, countryOf(adv.currencyCode))
    : null;
  return { issues, resolution };
}

async function writeLocations(
  tx: Tx,
  ctx: ServiceCtx,
  listId: string,
  resolution: LocationResolution,
) {
  await tx.locationListEntry.deleteMany({ where: { locationListId: listId } });
  await createInChunks(
    resolution.resolved.map((r) => ({
      sandboxId: ctx.sandboxId,
      locationListId: listId,
      value: r.value,
      resolvedOptionId: r.resolvedOptionId,
      resolvedLabel: r.resolvedLabel,
      lat: r.lat,
      lng: r.lng,
      radiusKm: r.radiusKm,
    })),
    (batch) => tx.locationListEntry.createMany({ data: batch }),
  );
}

export async function createLocationList(
  user: SessionUser,
  aid: string,
  input: LocationListInput,
  meta: WriteMeta = {},
): Promise<
  Result<{ id: string; resolved: number; unresolved: { line: number; reason: string }[] }>
> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertResourceWrite(ctx);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const adv = await loadAdvertiser(tx, aid);
      const { issues, resolution } = await locationIssues(ctx, tx, adv, input, 'create');
      if (issues.some((i) => i.blocking) || !resolution) throw invalid(issues);
      const created = await withChangeLog(
        changeCtx(ctx, tx, { note: meta.changeNote ?? '' }),
        { type: 'LOCATION_LIST', chain: { advertiserId: adv.id } },
        async (t) => {
          const l = await t.locationList.create({
            data: {
              sandboxId: ctx.sandboxId,
              advertiserId: adv.id,
              name: input.name.trim(),
              type: input.type!,
            },
            select: { id: true, publicId: true },
          });
          await writeLocations(t, ctx, l.id, resolution);
          return l;
        },
      );
      return {
        data: {
          id: created.publicId.toString(),
          resolved: resolution.resolved.length,
          unresolved: [],
        },
        warnings: softIssues(issues),
      };
    });
  });
}

export async function updateLocationList(
  user: SessionUser,
  id: string,
  input: Partial<Omit<LocationListInput, 'type'>> & { type?: LocationListInput['type'] },
  meta: WriteMeta = {},
): Promise<Result<{ resolved: number; version: number }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertResourceWrite(ctx);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const stored = await tx.locationList.findFirst({
        where: idWhere(id),
        include: { entries: { select: { value: true } } },
      });
      if (!stored) throw notFound();
      if (meta.expectedVersion !== undefined && meta.expectedVersion !== stored.version)
        throw conflict();
      const adv = await loadAdvertiser(tx, await publicOf(tx, 'advertiser', stored.advertiserId));
      const merged: LocationListInput = {
        name: input.name ?? stored.name,
        // LOC-002: a different type is rejected by the rule, not silently ignored.
        type: input.type === undefined ? stored.type : input.type,
        entries: input.entries ?? stored.entries.map((e) => e.value).join('\n'),
      };
      const { issues, resolution } = await locationIssues(
        ctx,
        tx,
        adv,
        merged,
        'edit',
        stored.type,
      );
      if (issues.some((i) => i.blocking) || !resolution) throw invalid(issues);
      await withChangeLog(
        changeCtx(ctx, tx, { note: meta.changeNote ?? '' }),
        { type: 'LOCATION_LIST', id: stored.id, chain: { advertiserId: stored.advertiserId } },
        async (t) => {
          const n = await t.locationList.updateMany({
            where: { id: stored.id, version: stored.version },
            data: { name: merged.name.trim(), version: { increment: 1 } },
          });
          if (n.count === 0) throw conflict();
          if (input.entries !== undefined) await writeLocations(t, ctx, stored.id, resolution);
          return { id: stored.id };
        },
      );
      return {
        data: { resolved: resolution.resolved.length, version: stored.version + 1 },
        warnings: softIssues(issues),
      };
    });
  });
}

export { RESOURCE_LIMITS };
