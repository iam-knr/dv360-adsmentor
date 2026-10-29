import 'server-only';
// Creative service (module 12 4.3): list, get, create, update, bulk status, uploads, preview. Every write checks
// `creative.write`, validates with the CRE rules, takes an optimistic version, and goes through withChangeLog.
// Reads run in the viewer's sandbox; a foreign or missing id reads as NOT_FOUND.
import type { Prisma } from '@prisma/client';
import type { SessionUser } from '@/lib/auth/types';
import { withChangeLog } from '@/lib/changelog';
import type { Tx } from '@/lib/db';
import {
  asResult,
  changeCtx,
  conflict,
  forbidden,
  invalid,
  notFound,
  type Result,
  type ServiceCtx,
} from '@/lib/campaigns/service-kit';
import { toWireIssues, type WireIssue } from '@/lib/campaigns/wire';
import { validate } from '@/lib/validation/engine';
import { youtubeIdOf } from '@/lib/validation/rules/creative';
import type { CreativeAssetInput, CreativeInput } from '@/lib/validation/types';
import { feedbackFor } from './feedback';
import {
  loadAdvertiser,
  parseIdRef,
  readCtx,
  validationContext,
  whereId,
  writeCtx,
  canWriteCreatives,
  type AdvertiserRow,
} from './guard';
import { isThirdPartyKind, KIND_META } from './kinds';
import {
  assetView,
  CREATIVE_INCLUDE,
  exchangeNames,
  exchangeRequiresSsl,
  intOrNull,
  isSslCompliant,
  needsReReview,
  reviewingExchanges,
  sandboxSeed,
  toColumns,
  toExtData,
  toInput,
  toRow,
  type StoredCreative,
} from './load';
import { extOf, IMAGE_EXT } from './limits';
import { html5Info, imageDimensions, mp4Duration, sniffType } from './media';
import { reviewSchedule } from './review';
import { settleAppeals } from './settle';
import { fileStore } from './storage';
import type {
  BulkResponse,
  CreativeDetail,
  CreativeListQuery,
  CreativeListResult,
  CreativeRow,
  WriteMeta,
} from './types';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

// ---------------------------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------------------------

/**
 * Creatives with a bell. The engine raises REJECTED_CREATIVE and RESTRICTED_CREATIVE per line item (engine 3.7), so a
 * creative has a bell when it is assigned to a line item with such an open alert and is itself disapproved or restricted.
 */
async function alertedCreativeIds(
  tx: Tx,
  advertiserId: string,
  stored: StoredCreative[],
): Promise<Set<string>> {
  const alerts = await tx.alert.findMany({
    where: {
      advertiserId,
      state: 'OPEN',
      type: { in: ['REJECTED_CREATIVE', 'RESTRICTED_CREATIVE'] },
      lineItemId: { not: null },
    },
    select: { lineItemId: true, type: true },
  });
  const rejected = new Set(
    alerts.filter((a) => a.type === 'REJECTED_CREATIVE').map((a) => a.lineItemId),
  );
  const restricted = new Set(
    alerts.filter((a) => a.type === 'RESTRICTED_CREATIVE').map((a) => a.lineItemId),
  );
  const ids = new Set<string>();
  for (const c of stored) {
    const lis = c.assignments.map((a) => a.lineItemId);
    const bad =
      c.reviews.some((r) => r.status === 'DISAPPROVED') && lis.some((l) => rejected.has(l));
    const geo = c.creativeRestrictions.length > 0 && lis.some((l) => restricted.has(l));
    if (bad || geo) ids.add(c.id);
  }
  return ids;
}

function listWhere(advertiserId: string, q: CreativeListQuery): Prisma.CreativeWhereInput {
  const search = q.q?.trim();
  const status = q.status?.length ? q.status : (['ACTIVE'] as const);
  const kinds = Object.entries(KIND_META)
    .filter(
      ([, m]) =>
        (q.type ? m.typeLabel === q.type : true) && (q.format ? m.format === q.format : true),
    )
    .map(([k]) => k as keyof typeof KIND_META);
  return {
    advertiserId,
    // companions are hidden child creatives (module 12 Q8): only top-level creatives are listed
    companionOfCreativeId: null,
    status: { in: [...status] },
    ...(q.type || q.format ? { kind: { in: kinds } } : {}),
    ...(q.dv360Status ? { dv360Review: q.dv360Status } : {}),
    ...(q.source ? { source: q.source as Prisma.CreativeWhereInput['source'] } : {}),
    ...(q.aiLabel ? { aiLabel: q.aiLabel as Prisma.CreativeWhereInput['aiLabel'] } : {}),
    ...(q.lineItem ? { assignments: { some: { lineItemId: q.lineItem } } } : {}),
    ...(q.created
      ? {
          createdAt: {
            gte: new Date(`${q.created.from}T00:00:00Z`),
            lte: new Date(`${q.created.to}T23:59:59Z`),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            ...(/^\d+$/.test(search) ? [{ publicId: BigInt(search) }] : []),
          ],
        }
      : {}),
  };
}

export async function listCreatives(
  user: SessionUser,
  aid: string,
  q: CreativeListQuery = {},
): Promise<CreativeListResult> {
  return readCtx(user, async (tx, ctx) => {
    const adv = await loadAdvertiser(tx, aid);
    await settleAppeals(tx, ctx, adv.id);
    const page = Math.max(1, q.page ?? 1);
    const pageSize = Math.min(q.pageSize ?? 50, 200);
    const where = listWhere(adv.id, q);
    const sort = q.sort ?? { field: 'createdAt' as const, dir: 'desc' as const };
    const [total, stored, names] = await Promise.all([
      tx.creative.count({ where }),
      tx.creative.findMany({
        where,
        include: CREATIVE_INCLUDE,
        orderBy: [{ [sort.field]: sort.dir }, { publicId: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      exchangeNames(tx),
    ]);
    const alerts = await alertedCreativeIds(tx, adv.id, stored);
    const ids = stored.map((c) => c.id);
    const [exts, companions] = await Promise.all([
      tx.creativeExt.findMany({ where: { creativeId: { in: ids } } }),
      tx.creative.groupBy({
        by: ['companionOfCreativeId'],
        where: { companionOfCreativeId: { in: ids } },
        _count: { _all: true },
      }),
    ]);
    const extBy = new Map(exts.map((e) => [e.creativeId, e]));
    const companionBy = new Map(companions.map((c) => [c.companionOfCreativeId, c._count._all]));
    let rows = stored.map((c) =>
      toRow(c, extBy.get(c.id) ?? null, names, ctx.simNow, alerts, companionBy.get(c.id) ?? 0),
    );
    if (q.exchangeStatus)
      rows = rows.filter((r) =>
        q.exchangeStatus === 'SERVABLE'
          ? r.exchangeStatus.servable > 0
          : r.exchangeStatus.servable === 0,
      );
    return { rows, total, page, pageSize };
  });
}

async function loadStored(tx: Tx, cid: string, advertiserId?: string): Promise<StoredCreative> {
  const ref = parseIdRef(cid);
  const row = ref
    ? await tx.creative.findFirst({
        where: { ...whereId(ref), ...(advertiserId ? { advertiserId } : {}) },
        include: CREATIVE_INCLUDE,
      })
    : null;
  if (!row) throw notFound();
  return row;
}

export async function getCreativeDetail(
  user: SessionUser,
  aid: string,
  cid: string,
): Promise<CreativeDetail> {
  return readCtx(user, async (tx, ctx) => {
    const adv = await loadAdvertiser(tx, aid);
    await settleAppeals(tx, ctx, adv.id);
    const c = await loadStored(tx, cid, adv.id);
    const [ext, names, alerts, companions, perf] = await Promise.all([
      tx.creativeExt.findUnique({ where: { creativeId: c.id } }),
      exchangeNames(tx),
      alertedCreativeIds(tx, adv.id, [c]),
      tx.creative.count({ where: { companionOfCreativeId: c.id } }),
      performance(tx, ctx, c.id),
    ]);
    return {
      id: c.id,
      publicId: c.publicId.toString(),
      version: c.version,
      row: toRow(c, ext, names, ctx.simNow, alerts, companions),
      value: toInput(c, ext),
      assets: c.assets.map(assetView),
      cm360: c.source === 'CM360',
      readOnly: !canWriteCreatives(user),
      performance: perf,
    };
  });
}

/** Last seven sim days from the `creative` slice of SimDailyMetric (module 12 section 5), null without data. */
async function performance(tx: Tx, ctx: ServiceCtx, creativeId: string) {
  const from = new Date(ctx.simNow.getTime() - 7 * DAY_MS);
  const rows = await tx.simDailyMetric.groupBy({
    by: ['simDate'],
    where: { creativeId, sliceKind: 'creative', simDate: { gte: from } },
    _sum: { impressions: true, clicks: true },
    orderBy: { simDate: 'asc' },
  });
  if (rows.length === 0) return null;
  return rows.map((r) => {
    const impressions = Number(r._sum.impressions ?? 0);
    const clicks = Number(r._sum.clicks ?? 0);
    return {
      date: r.simDate.toISOString().slice(0, 10),
      impressions,
      clicks,
      ctr: impressions > 0 ? clicks / impressions : 0,
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Uploads (module 12 4.3 upload flow, build-plan P-08: memory store until the Blob store exists)
// ---------------------------------------------------------------------------------------------

export interface UploadResult {
  uploadId: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  entryHtml: boolean | null;
}

const MAX_UPLOAD = 10 * 1024 * 1024;

/** Store the bytes, record the `Upload` row, and read what the bytes say about themselves. */
export async function createUpload(
  user: SessionUser,
  file: {
    fileName: string;
    bytes: Uint8Array;
    contentType: string;
    purpose?: 'CREATIVE_ASSET' | 'OTHER';
  },
): Promise<Result<UploadResult>> {
  return asResult(async () => {
    if (file.bytes.byteLength > MAX_UPLOAD)
      throw invalid([
        {
          ruleId: 'CRE-103',
          severity: 'error',
          path: 'mainAsset',
          message: 'That file is too large.',
          blocking: true,
        },
      ]);
    return writeCtx(user, async (tx, ctx) => {
      const sniffed = sniffType(file.bytes);
      const contentType = sniffed ?? file.contentType;
      const safeName = file.fileName.replace(/[^\w.\- ()]/g, '_').slice(0, 200) || 'file';
      const created = await tx.upload.create({
        data: {
          sandboxId: ctx.sandboxId,
          purpose: file.purpose ?? 'CREATIVE_ASSET',
          fileName: safeName,
          sizeBytes: BigInt(file.bytes.byteLength),
          contentType,
          storageKey: 'pending',
          status: 'PENDING',
          createdById: (user.actor ?? user).id,
        },
        select: { id: true },
      });
      const storageKey = `creatives/${ctx.sandboxId}/${created.id}/${safeName}`;
      await fileStore().put(storageKey, file.bytes, contentType);
      await tx.upload.update({ where: { id: created.id }, data: { storageKey, status: 'READY' } });
      const image = contentType.startsWith('image/') ? imageDimensions(file.bytes) : null;
      const html5 = contentType === 'application/zip' ? html5Info(file.bytes) : null;
      const media =
        contentType.startsWith('video/') || contentType.startsWith('audio/')
          ? mp4Duration(file.bytes)
          : null;
      const data: UploadResult = {
        uploadId: created.id,
        fileName: safeName,
        sizeBytes: file.bytes.byteLength,
        contentType,
        width: image?.width ?? html5?.size?.width ?? null,
        height: image?.height ?? html5?.size?.height ?? null,
        durationSeconds: media,
        entryHtml: html5 ? html5.entryHtml : null,
      };
      return { data };
    });
  });
}

/** Fill an asset of the input from its `Upload` row. The client only names the upload; size and type come from the row. */
async function resolveAsset(
  tx: Tx,
  ctx: ServiceCtx,
  asset: CreativeAssetInput | null | undefined,
): Promise<{ asset: CreativeAssetInput | null; storageKey: string | null }> {
  if (!asset?.uploadId) return { asset: asset ?? null, storageKey: null };
  const up = await tx.upload.findFirst({
    where: { id: asset.uploadId, createdById: (ctx.user.actor ?? ctx.user).id, status: 'READY' },
  });
  if (!up)
    throw invalid([
      {
        ruleId: 'CRE-103',
        severity: 'error',
        path: 'mainAsset',
        message: 'Upload the file again.',
        blocking: true,
      },
    ]);
  const stored = await fileStore().get(up.storageKey);
  const bytes = stored?.bytes ?? null;
  const image = bytes && up.contentType.startsWith('image/') ? imageDimensions(bytes) : null;
  const html5 = bytes && up.contentType === 'application/zip' ? html5Info(bytes) : null;
  const duration =
    bytes && (up.contentType.startsWith('video/') || up.contentType.startsWith('audio/'))
      ? mp4Duration(bytes)
      : null;
  const ext = extOf(up.fileName);
  // an image renamed to .png that is not one is not an image (Q2: MIME sniffing)
  const mimeType =
    (IMAGE_EXT as readonly string[]).includes(ext) &&
    up.contentType.startsWith('image/') &&
    !image &&
    bytes
      ? 'application/octet-stream'
      : up.contentType;
  return {
    storageKey: up.storageKey,
    asset: {
      uploadId: up.id,
      fileName: up.fileName,
      mimeType,
      sizeBytes: Number(up.sizeBytes),
      width: image?.width ?? html5?.size?.width ?? asset.width ?? null,
      height: image?.height ?? html5?.size?.height ?? asset.height ?? null,
      durationSeconds: duration ?? asset.durationSeconds ?? null,
      ...(html5 ? { entryHtml: html5.entryHtml } : {}),
    },
  };
}

async function resolveInput(
  tx: Tx,
  ctx: ServiceCtx,
  input: CreativeInput,
): Promise<{ input: CreativeInput; keys: { main: string | null; logo: string | null } }> {
  const main = await resolveAsset(tx, ctx, input.mainAsset);
  const logo = await resolveAsset(tx, ctx, input.logoAsset);
  const html5 = input.kind === 'STANDARD_HTML5' || main.asset?.mimeType === 'application/zip';
  const kind =
    input.kind === 'STANDARD_IMAGE' && html5 && main.asset
      ? 'STANDARD_HTML5'
      : input.kind === 'STANDARD_HTML5' && main.asset && main.asset.mimeType.startsWith('image/')
        ? 'STANDARD_IMAGE'
        : input.kind;
  return {
    input: { ...input, kind, mainAsset: main.asset, logoAsset: logo.asset },
    keys: { main: main.storageKey, logo: logo.storageKey },
  };
}

// ---------------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------------

export async function validateCreative(
  user: SessionUser,
  aid: string,
  input: CreativeInput,
  cid?: string,
  trigger: 'save' | 'blur' = 'save',
  changedPath?: string,
): Promise<WireIssue[]> {
  return readCtx(user, async (tx, ctx) => {
    const adv = await loadAdvertiser(tx, aid);
    const resolved = (await resolveInput(tx, ctx, input)).input;
    let original: CreativeInput | undefined;
    if (cid) {
      const c = await loadStored(tx, cid, adv.id);
      original = toInput(c, await tx.creativeExt.findUnique({ where: { creativeId: c.id } }));
    }
    const issues = validate(
      'creative',
      resolved,
      validationContext(ctx, adv, cid ? 'edit' : 'create', original),
      { trigger, ...(changedPath ? { changedPath } : {}) },
    );
    return toWireIssues(issues);
  });
}

// ---------------------------------------------------------------------------------------------
// Create and update
// ---------------------------------------------------------------------------------------------

interface ReviewPlanRows {
  plan: ReturnType<typeof reviewSchedule>;
  reviews: Prisma.CreativeReviewCreateManyInput[];
}

/** The ext review fields and the per-exchange review rows for a submit (create, or edit that restarts review). */
async function planReview(
  tx: Tx,
  ctx: ServiceCtx,
  adv: AdvertiserRow,
  creativeId: string,
  input: CreativeInput,
): Promise<ReviewPlanRows> {
  const exchangeIds = await reviewingExchanges(tx, adv.partnerId, input.kind);
  const plan = reviewSchedule({
    sandboxSeed: await sandboxSeed(tx, ctx.sandboxId),
    creativeId,
    simNow: ctx.simNow,
    exchangeIds,
    thirdParty: isThirdPartyKind(input.kind),
  });
  const ssl = isSslCompliant(input);
  const bad = plan.verdict === 'NOT_SERVABLE';
  const reviews = plan.exchanges.map((e) => {
    const sslBad = !ssl && exchangeRequiresSsl(e.exchangeId);
    return {
      sandboxId: ctx.sandboxId,
      creativeId,
      exchangeId: e.exchangeId,
      status: sslBad ? ('DISAPPROVED' as const) : ('PENDING' as const),
      sslStatus: sslBad ? ('DISAPPROVED' as const) : ('PENDING' as const),
      feedback: sslBad ? 'SSL' : bad ? plan.reason : null,
      lastSyncAt: sslBad ? ctx.simNow : null,
      decideAt: sslBad ? null : e.decideAt,
    };
  });
  return { plan, reviews };
}

function blockingOrThrow(issues: ReturnType<typeof validate>): WireIssue[] {
  if (issues.some((i) => i.blocking)) throw invalid(issues);
  return toWireIssues(issues.filter((i) => !i.blocking));
}

/** Insert one validated creative with its ext row, assets, tracking URLs and review rows, logged as a create. */
export async function insertCreative(
  tx: Tx,
  ctx: ServiceCtx,
  adv: AdvertiserRow,
  resolved: CreativeInput,
  keys: { main: string | null; logo: string | null },
  extra: { note?: string; source?: 'BULK_EDIT'; bulkJobId?: string } = {},
): Promise<{ id: string; publicId: string }> {
  const sandboxId = ctx.sandboxId;
  return withChangeLog(
    changeCtx(ctx, tx, {
      ...(extra.note ? { note: extra.note } : {}),
      ...(extra.source ? { source: extra.source } : {}),
      ...(extra.bulkJobId ? { bulkJobId: extra.bulkJobId } : {}),
    }),
    { type: 'CREATIVE', chain: { advertiserId: adv.id } },
    async (t) => {
      const row = await t.creative.create({
        data: { sandboxId, advertiserId: adv.id, ...toColumns(resolved), dv360Review: 'PENDING' },
        select: { id: true, publicId: true },
      });
      const { plan, reviews } = await planReview(t, ctx, adv, row.id, resolved);
      await t.creative.update({
        where: { id: row.id },
        data: {
          dv360Review: plan.verdict,
          dv360Feedback:
            plan.verdict === 'SERVABLE'
              ? 'Creative is servable'
              : (feedbackFor(plan.reason)?.summary ?? null),
        },
      });
      await t.creativeExt.create({
        data: {
          sandboxId,
          creativeId: row.id,
          ...toExtData(resolved),
          reviewRequestedAt: ctx.simNow,
          dv360DecideAt: plan.dv360DecideAt,
          plannedVerdict: plan.verdict,
          plannedReason: plan.reason,
        },
      });
      await writeAssetsAndUrls(t, sandboxId, adv.id, row.id, resolved, keys);
      if (reviews.length) await t.creativeReview.createMany({ data: reviews });
      return { id: row.id, publicId: row.publicId.toString() };
    },
  );
}

export async function createCreative(
  user: SessionUser,
  aid: string,
  input: CreativeInput,
  meta: WriteMeta = {},
): Promise<Result<{ id: string; publicId: string }>> {
  return asResult(() =>
    writeCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, aid);
      const { input: resolved, keys } = await resolveInput(tx, ctx, input);
      const warnings = blockingOrThrow(
        validate('creative', resolved, validationContext(ctx, adv, 'create')),
      );
      const data = await insertCreative(tx, ctx, adv, resolved, keys, {
        ...(meta.note ? { note: meta.note } : {}),
      });
      return { data, warnings };
    }),
  );
}

async function writeAssetsAndUrls(
  t: Tx,
  sandboxId: string,
  advertiserId: string,
  creativeId: string,
  input: CreativeInput,
  keys: { main: string | null; logo: string | null },
): Promise<void> {
  const assets: [CreativeAssetInput | null | undefined, 'MAIN' | 'LOGO', string | null][] = [
    [input.mainAsset, 'MAIN', keys.main],
    [input.logoAsset, 'LOGO', keys.logo],
  ];
  for (const [a, role, key] of assets) {
    if (!a) continue;
    await t.creativeAsset.create({
      data: {
        sandboxId,
        advertiserId,
        creativeId,
        role,
        fileName: a.fileName,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        storageKey: key ?? `creatives/${sandboxId}/${creativeId}/${a.fileName}`,
        width: a.width ?? null,
        height: a.height ?? null,
        durationSeconds: a.durationSeconds ?? null,
      },
    });
  }
  const urls: ['IMPRESSION_TRACKER' | 'CLICK_TRACKER', string | null | undefined][] = [
    ['IMPRESSION_TRACKER', input.impressionTrackerUrl],
    ['CLICK_TRACKER', input.clickTrackerUrl],
  ];
  for (const [type, url] of urls)
    if (url?.trim())
      await t.creativeUrl.create({ data: { sandboxId, creativeId, type, url: url.trim() } });
}

async function activeLineItemCount(tx: Tx, creativeId: string): Promise<number> {
  return tx.creativeAssignment.count({ where: { creativeId, lineItem: { status: 'ACTIVE' } } });
}

export async function updateCreative(
  user: SessionUser,
  aid: string,
  cid: string,
  input: CreativeInput,
  meta: WriteMeta = {},
): Promise<Result<{ version: number; reviewRestarted: boolean }>> {
  return asResult(() =>
    writeCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, aid);
      const stored = await loadStored(tx, cid, adv.id);
      if (meta.expectedVersion !== undefined && meta.expectedVersion !== stored.version)
        throw conflict();
      const ext = await tx.creativeExt.findUnique({ where: { creativeId: stored.id } });
      const original = toInput(stored, ext);
      const { input: resolved, keys } = await resolveInput(tx, ctx, {
        ...input,
        kind: stored.kind,
      });
      const n = await activeLineItemCount(tx, stored.id);
      const withCount = { ...resolved, source: stored.source, activeLineItemCount: n };
      const warnings = blockingOrThrow(
        validate('creative', withCount, validationContext(ctx, adv, 'edit', original)),
      );
      const restart = stored.source !== 'CM360' && needsReReview(original, resolved);
      const sandboxId = ctx.sandboxId;
      await withChangeLog(
        changeCtx(ctx, tx, { ...(meta.note ? { note: meta.note } : {}) }),
        { type: 'CREATIVE', id: stored.id, chain: { advertiserId: adv.id } },
        async (t) => {
          // CM360 creatives: only name and status change (CRE-060 rejects anything else before this point)
          const cols =
            stored.source === 'CM360' ? { name: resolved.name.trim() } : toColumns(resolved);
          await t.creative.update({
            where: { id: stored.id },
            data: { ...cols, status: resolved.status ?? stored.status, version: { increment: 1 } },
          });
          if (stored.source !== 'CM360') {
            const extData = toExtData(resolved);
            await t.creativeExt.upsert({
              where: { creativeId: stored.id },
              create: { sandboxId, creativeId: stored.id, ...extData },
              update: extData,
            });
            const assetChanged = keys.main !== null || keys.logo !== null;
            if (assetChanged) {
              await t.creativeAsset.deleteMany({
                where: {
                  creativeId: stored.id,
                  role: {
                    in: [
                      ...(keys.main ? ['MAIN' as const] : []),
                      ...(keys.logo ? ['LOGO' as const] : []),
                    ],
                  },
                },
              });
              await writeAssetsAndUrls(
                t,
                sandboxId,
                adv.id,
                stored.id,
                { ...resolved, impressionTrackerUrl: null, clickTrackerUrl: null },
                keys,
              );
            }
            await t.creativeUrl.deleteMany({
              where: {
                creativeId: stored.id,
                type: { in: ['IMPRESSION_TRACKER', 'CLICK_TRACKER'] },
              },
            });
            for (const [type, url] of [
              ['IMPRESSION_TRACKER', resolved.impressionTrackerUrl],
              ['CLICK_TRACKER', resolved.clickTrackerUrl],
            ] as const)
              if (url?.trim())
                await t.creativeUrl.create({
                  data: { sandboxId, creativeId: stored.id, type, url: url.trim() },
                });
          }
          if (restart) {
            const { plan, reviews } = await planReview(t, ctx, adv, stored.id, resolved);
            await t.creativeReview.deleteMany({ where: { creativeId: stored.id } });
            if (reviews.length) await t.creativeReview.createMany({ data: reviews });
            await t.creative.update({
              where: { id: stored.id },
              data: {
                dv360Review: plan.verdict,
                dv360Feedback:
                  plan.verdict === 'SERVABLE'
                    ? 'Creative is servable'
                    : (feedbackFor(plan.reason)?.summary ?? null),
                reviewCompletedAt: null,
              },
            });
            await t.creativeExt.update({
              where: { creativeId: stored.id },
              data: {
                reviewRequestedAt: ctx.simNow,
                dv360DecideAt: plan.dv360DecideAt,
                plannedVerdict: plan.verdict,
                plannedReason: plan.reason,
              },
            });
          }
          return { id: stored.id };
        },
      );
      const fresh = await tx.creative.findUniqueOrThrow({
        where: { id: stored.id },
        select: { version: true },
      });
      return { data: { version: fresh.version, reviewRestarted: restart }, warnings };
    }),
  );
}

// ---------------------------------------------------------------------------------------------
// Bulk status (Action menu of the library)
// ---------------------------------------------------------------------------------------------

type BulkStatusAction = 'ACTIVATE' | 'PAUSE' | 'ARCHIVE' | 'UNARCHIVE';
const TARGET: Record<BulkStatusAction, 'ACTIVE' | 'PAUSED' | 'ARCHIVED'> = {
  ACTIVATE: 'ACTIVE',
  PAUSE: 'PAUSED',
  ARCHIVE: 'ARCHIVED',
  UNARCHIVE: 'PAUSED',
};

export async function bulkCreativeAction(
  user: SessionUser,
  aid: string,
  req: { ids: string[]; action: BulkStatusAction },
): Promise<Result<BulkResponse>> {
  return asResult(() =>
    writeCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, aid);
      const ids = [...new Set(req.ids)];
      if (ids.length === 0) throw invalid([]);
      const target = TARGET[req.action];
      const creatives = await tx.creative.findMany({
        where: { id: { in: ids }, advertiserId: adv.id },
        select: { id: true, status: true, source: true },
      });
      if (creatives.length !== ids.length) throw notFound();
      const actor = ctx.user.actor ?? ctx.user;
      const job = await tx.bulkJob.create({
        data: {
          sandboxId: ctx.sandboxId,
          advertiserId: adv.id,
          partnerId: adv.partnerId,
          requestedById: actor.id,
          source: 'BULK_EDIT',
          action: req.action,
          description: `Status edited on ${creatives.length} ${creatives.length === 1 ? 'creative' : 'creatives'}`,
          status: 'COMPLETED',
          selectionCount: creatives.length,
        },
        select: { id: true },
      });
      const cctx = changeCtx(ctx, tx, { source: 'BULK_EDIT', bulkJobId: job.id });
      const errors: BulkResponse['errors'] = [];
      let done = 0;
      let affected = 0;
      for (const c of creatives) {
        if (c.status === target) {
          done += 1;
          continue;
        }
        if (req.action === 'UNARCHIVE' && c.status !== 'ARCHIVED') {
          errors.push({ id: c.id, message: 'Only archived creatives can be unarchived.' });
          continue;
        }
        if (target !== 'ACTIVE') affected += await activeLineItemCount(tx, c.id);
        await withChangeLog(
          cctx,
          { type: 'CREATIVE', id: c.id, chain: { advertiserId: adv.id } },
          (t) =>
            t.creative.update({
              where: { id: c.id },
              data: { status: target, version: { increment: 1 } },
              select: { id: true },
            }),
        );
        await tx.bulkJobItem.create({
          data: {
            sandboxId: ctx.sandboxId,
            jobId: job.id,
            entityType: 'CREATIVE',
            entityId: c.id,
            status: 'OK',
          },
        });
        done += 1;
      }
      const warnings: WireIssue[] =
        affected > 0
          ? [
              {
                path: 'status',
                severity: 'warning',
                code: 'CRE-070',
                message: `This creative is assigned to ${affected} active line items.`,
              },
            ]
          : [];
      return { data: { jobId: job.id, done, failed: errors.length, errors }, warnings };
    }),
  );
}

/** How many active line items use these creatives: input of the CRE-070 confirmation (AC 9). */
export async function activeLineItemUse(
  user: SessionUser,
  aid: string,
  ids: string[],
): Promise<number> {
  return readCtx(user, async (tx) => {
    const adv = await loadAdvertiser(tx, aid);
    return tx.creativeAssignment.count({
      where: {
        creativeId: { in: ids },
        creative: { advertiserId: adv.id },
        lineItem: { status: 'ACTIVE' },
      },
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Preview and test tag (module 12 S10, CRE-012): the tag is never executed outside a sandboxed iframe
// ---------------------------------------------------------------------------------------------

const MACROS: Record<string, string> = {
  CLICK_URL: 'https://example.com/click',
  CLICK_URL_ESC: 'https%3A%2F%2Fexample.com%2Fclick',
  CLICK_URL_UNESC: 'https://example.com/click',
  CACHEBUSTER: '1234567890',
  GDPR: '0',
  GDPR_CONSENT_755: 'example',
  GOOGLE_GDPR: '0',
  ADVERTISING_IDENTIFIER_PLAIN: 'example',
};

/** Replace `${MACRO}`, `%%MACRO%%` and `[MACRO]` with example values; unknown macros become `example`. */
export function substituteMacros(tag: string): string {
  return tag.replace(/\$\{([A-Z0-9_]+)\}|%%([A-Z0-9_]+)%%|\[([A-Z0-9_]+)\]/g, (_m, a, b, c) => {
    const name = (a ?? b ?? c) as string;
    return MACROS[name] ?? 'example';
  });
}

/** Content Security Policy of the preview iframe: no network, only inline data images. */
export const PREVIEW_CSP = "default-src 'none'; img-src data:; style-src 'unsafe-inline'";

export function previewDocument(body: string): string {
  return `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}"><body style="margin:0;font:14px sans-serif">${body}</body>`;
}

export function testTag(tag: string): { html: string } {
  return { html: previewDocument(substituteMacros(tag)) };
}

export interface CreativePreview {
  kind: 'IFRAME' | 'IMAGE' | 'VIDEO' | 'AUDIO';
  srcDoc?: string;
  url?: string;
  width: number;
  height: number;
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export async function getCreativePreview(
  user: SessionUser,
  aid: string,
  cid: string,
): Promise<CreativePreview> {
  return readCtx(user, async (tx) => {
    const adv = await loadAdvertiser(tx, aid);
    const c = await loadStored(tx, cid, adv.id);
    const w = c.width || 300;
    const h = c.height || 250;
    const media = KIND_META[c.kind].media;
    if (c.kind === 'THIRD_PARTY_DISPLAY') {
      return { kind: 'IFRAME', srcDoc: testTag(c.thirdPartyTag ?? '').html, width: w, height: h };
    }
    const label = esc(`${c.name} (${KIND_META[c.kind].format})`);
    const panel = (color: string) =>
      `<div style="box-sizing:border-box;width:${w}px;height:${h}px;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;text-align:center;padding:8px">${label}</div>`;
    if (
      media === 'display' ||
      c.kind === 'YOUTUBE_VIDEO' ||
      media === 'video' ||
      media === 'audio'
    ) {
      const color = media === 'audio' ? '#6a1b9a' : media === 'video' ? '#00695c' : '#1a73e8';
      const kind = media === 'audio' ? 'AUDIO' : media === 'video' ? 'VIDEO' : 'IMAGE';
      return { kind, srcDoc: previewDocument(panel(color)), width: w, height: h };
    }
    return { kind: 'IFRAME', srcDoc: previewDocument(panel('#455a64')), width: w, height: h };
  });
}
