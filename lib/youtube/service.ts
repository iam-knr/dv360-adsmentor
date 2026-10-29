import 'server-only';
// YouTube ad group and ad service (module 09 4.1, Y4 to Y17). Every write: access check, validation with the full
// context, optimistic version, withChangeLog, Result<T>. Reads run in the viewer's sandbox; a foreign id is NOT_FOUND.
import type { Prisma } from '@prisma/client';
import { prisma, withSandbox, type Tx } from '@/lib/db';
import { withChangeLog, type ChangeCtx } from '@/lib/changelog';
import type { SessionUser } from '@/lib/auth/types';
import { can } from '@/lib/rbac/can';
import { toMinor, type CurrencyCode } from '@/lib/money';
import { getGridMetricsTx } from '@/lib/metrics/grid-metrics';
import {
  AD_GROUP_TARGETING_TYPE,
  DG_AD_GROUP_TARGETING_TYPE,
  emptyTargetingState,
  loadAdGroupTargeting,
  persistAdGroupTargeting,
  stateToRows,
} from '@/lib/targeting';
import { buildLiContext, loadIo, simNow } from '@/lib/line-items/load';
import { validate } from '@/lib/validation/engine';
import {
  deriveAdFormats,
  mergeUrl,
  parseYoutubeRef,
  YT_SUBTYPE_INFO,
  type AdFormatKey,
  type PreviewDevice,
  type PreviewSurface,
  type YtBidKind,
  type YtSubtype,
  type YtSurface,
} from '@/lib/validation/constants/youtube';
import type {
  AdGroupInput,
  AdInput,
  Issue,
  ValidationContext,
  YoutubeVideoInfo,
} from '@/lib/validation/types';
import { fileStore } from '@/lib/creatives/storage';
import {
  buildPreviewModel,
  PLACEHOLDER_THUMBNAIL,
  type FormatFilter,
  type PreviewDraft,
  type PreviewModel,
} from './preview';
import { dgIssues, isDgFormat } from './dg';
import { planReview } from './review';
import { settleDueAdReviews } from './review-sync';
import type {
  AdDetail,
  AdFormValue,
  AdGroupDetail,
  AdGroupFormValue,
  AdGroupList,
  AdGroupRow,
  AdRow,
  Result,
  YoutubeVideoHit,
  YtStatus,
} from './types';
import { EMPTY_AD_FORM } from './types';

// ---------------------------------------------------------------------------------------------
// Guards and small helpers
// ---------------------------------------------------------------------------------------------

function issue(ruleId: string, path: string, message: string): Issue {
  return { ruleId, severity: 'error', path, message, blocking: true };
}
const forbidden = (): Result<never> => ({
  ok: false,
  code: 'FORBIDDEN',
  issues: [issue('FORBIDDEN', '', "You don't have permission to make this change.")],
});
const notFound = (what: string): Result<never> => ({
  ok: false,
  code: 'NOT_FOUND',
  issues: [issue('NOT_FOUND', '', `This ${what} doesn't exist.`)],
});
const conflict = (what: string): Result<never> => ({
  ok: false,
  code: 'CONFLICT',
  issues: [
    issue(
      'CONFLICT',
      '',
      `This ${what} was changed by someone else. Reload the page to see the latest version.`,
    ),
  ],
});

export function canWrite(user: SessionUser): boolean {
  return !!user.sandboxId && can(user, 'write', { sandboxId: user.sandboxId });
}
const canRead = (user: SessionUser): boolean =>
  !!user.sandboxId && can(user, 'view', { sandboxId: user.sandboxId });

async function inSandbox<T>(user: SessionUser, fn: (tx: Tx) => Promise<T>): Promise<T | null> {
  if (!canRead(user) || !user.sandboxId) return null;
  return withSandbox(user.sandboxId, fn);
}

async function changeCtx(user: SessionUser, tx: Tx, note?: string): Promise<ChangeCtx> {
  const sandboxId = user.sandboxId!;
  const classroomId =
    user.classroomId ??
    (await prisma.sandbox.findUnique({ where: { id: sandboxId }, select: { classroomId: true } }))
      ?.classroomId ??
    '';
  const actor = user.actor ?? user;
  return {
    sandboxId,
    classroomId,
    actor: { type: 'USER', userId: actor.id, label: actor.name },
    tx,
    ...(note?.trim() ? { note: note.trim() } : {}),
  };
}

const num = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
};
const dec = (v: { toString(): string } | null | undefined): string =>
  v === null || v === undefined ? '' : v.toString();
const orNull = (v: string): string | null => (v.trim() === '' ? null : v.trim());

const SURFACE_ORDER: YtSurface[] = ['IN_STREAM', 'IN_FEED', 'SHORTS'];
const AD_SOURCE = 'Display & Video 360';

// ---------------------------------------------------------------------------------------------
// Line item and context
// ---------------------------------------------------------------------------------------------

type LiRow = NonNullable<Awaited<ReturnType<typeof loadLi>>>;

async function loadLi(tx: Tx, liId: string) {
  const li = await tx.lineItem.findUnique({
    where: { id: liId },
    include: {
      adGroups: { select: { id: true, status: true, _count: { select: { ads: true } } } },
    },
  });
  if (!li || !['YT_VIDEO', 'YT_AUDIO', 'YT_ON_CTV', 'DEMAND_GEN'].includes(li.type)) return null;
  return li;
}

function bidKindOf(li: Pick<LiRow, 'ytSubtype'>): YtBidKind {
  return li.ytSubtype ? YT_SUBTYPE_INFO[li.ytSubtype as YtSubtype].adGroupBid : 'TARGET_CPM';
}

const isDg = (li: Pick<LiRow, 'type'>): boolean => li.type === 'DEMAND_GEN';
const targetingTypeOf = (li: Pick<LiRow, 'type'>): string =>
  isDg(li) ? DG_AD_GROUP_TARGETING_TYPE : AD_GROUP_TARGETING_TYPE;
/** The bid rules do not apply to a Demand Gen ad group: its bid follows the line item strategy (module 09 4.6). */
const BID_RULES = ['AG-003', 'AG-004'];
/** Rules of the YouTube ad that also hold for a Demand Gen ad (name, URLs, status). */
const DG_AD_RULES = ['AD-001', 'AD-002', 'AD-016', 'AD-017', 'AD-019'];

function surfacesOf(li: Pick<LiRow, 'ytSurfaces'>): YtSurface[] | null {
  return li.ytSurfaces.length
    ? SURFACE_ORDER.filter((s) => (li.ytSurfaces as string[]).includes(s))
    : null;
}

async function videoInfo(tx: Tx, ids: string[]): Promise<Map<string, YoutubeVideoInfo>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const rows = await tx.youtubeVideo.findMany({ where: { videoId: { in: unique } } });
  return new Map(
    rows.map((v) => [
      v.videoId,
      {
        videoId: v.videoId,
        durationSec: v.durationSec,
        orientation: v.orientation === 'VERTICAL' ? ('VERTICAL' as const) : ('HORIZONTAL' as const),
        isPublic: v.isPublic,
      },
    ]),
  );
}

/** The validation context of a YouTube child entity: the line item context plus branding, videos and ad groups. */
async function ytContext(
  tx: Tx,
  user: SessionUser,
  li: LiRow,
  mode: 'create' | 'edit',
  videoIds: string[] = [],
): Promise<{ ctx: ValidationContext; currency: CurrencyCode }> {
  const io = await loadIo(tx, li.ioId);
  if (!io) throw new Error('Insertion order missing');
  const base = await buildLiContext(tx, user, io);
  const adv = io.row.advertiser;
  const merchant = await tx.linkedAccount.count({
    where: { advertiserId: adv.id, type: 'MERCHANT_CENTER', status: 'LINKED' },
  });
  const ctx: ValidationContext = {
    ...base,
    mode,
    advertiser: {
      ...base.advertiser,
      businessName: adv.ytBusinessName,
      logoAssetId: adv.ytLogoAssetId,
      merchantCenterLinked: merchant > 0,
    },
    children: {
      adGroups: li.adGroups.map((g) => ({
        id: g.id,
        status: g.status === 'PAUSED' ? ('PAUSED' as const) : ('ACTIVE' as const),
        adCount: g._count.ads,
      })),
    },
    lookups: { ...base.lookups, youtubeVideos: await videoInfo(tx, videoIds) },
  };
  return { ctx, currency: io.currency };
}

// ---------------------------------------------------------------------------------------------
// Videos (Y16)
// ---------------------------------------------------------------------------------------------

function hitOf(v: {
  videoId: string;
  title: string;
  channelName: string;
  durationSec: number;
  orientation: string;
  thumbnailUrl: string | null;
}): YoutubeVideoHit {
  return {
    videoId: v.videoId,
    title: v.title,
    channelName: v.channelName,
    durationSec: v.durationSec,
    orientation: v.orientation === 'VERTICAL' ? 'VERTICAL' : 'HORIZONTAL',
    thumbnailUrl: v.thumbnailUrl ?? PLACEHOLDER_THUMBNAIL,
  };
}

/** `GET youtube/video-lookup?q=`: a URL or id resolves to at most one video; any other text searches titles. */
export async function lookupVideos(user: SessionUser, q: string): Promise<YoutubeVideoHit[]> {
  const text = q.trim();
  if (!text) return [];
  const rows = await inSandbox(user, async (tx) => {
    const id = parseYoutubeRef(text);
    if (id) {
      const one = await tx.youtubeVideo.findUnique({ where: { videoId: id } });
      return one && one.isPublic ? [one] : [];
    }
    return tx.youtubeVideo.findMany({
      where: {
        isPublic: true,
        OR: [
          { title: { contains: text, mode: 'insensitive' } },
          { channelName: { contains: text, mode: 'insensitive' } },
        ],
      },
      orderBy: { title: 'asc' },
      take: 8,
    });
  });
  return (rows ?? []).map(hitOf);
}

// ---------------------------------------------------------------------------------------------
// Review settling (Δ-09-8)
// ---------------------------------------------------------------------------------------------

/** Close every due review of the ads of these ad groups. Idempotent; written by the SIM_ENGINE actor. */
async function settleReviews(tx: Tx, sandboxId: string, classroomId: string, adGroupIds: string[]) {
  if (!adGroupIds.length) return;
  await settleDueAdReviews(
    tx,
    { sandboxId, classroomId },
    (await simNow(tx, sandboxId)).getTime(),
    adGroupIds,
  );
}

async function classroomOf(user: SessionUser, tx: Tx): Promise<string> {
  return (
    user.classroomId ??
    (await tx.sandbox.findUnique({ where: { id: user.sandboxId! }, select: { classroomId: true } }))
      ?.classroomId ??
    ''
  );
}

// ---------------------------------------------------------------------------------------------
// Ads: rows and details
// ---------------------------------------------------------------------------------------------

type AdWithVideo = Prisma.AdGetPayload<Record<string, never>> & { video: YoutubeVideoHit | null };

async function withVideos(tx: Tx, ads: Prisma.AdGetPayload<Record<string, never>>[]) {
  const ids = [...new Set(ads.flatMap((a) => (a.youtubeVideoId ? [a.youtubeVideoId] : [])))];
  const rows = ids.length
    ? await tx.youtubeVideo.findMany({ where: { videoId: { in: ids } } })
    : [];
  const byId = new Map(rows.map((v) => [v.videoId, hitOf(v)]));
  return ads.map((a): AdWithVideo => ({
    ...a,
    video: a.youtubeVideoId ? (byId.get(a.youtubeVideoId) ?? null) : null,
  }));
}

function formatsOf(
  video: Pick<YoutubeVideoHit, 'orientation' | 'durationSec'> | null,
  li: Pick<LiRow, 'ytSurfaces' | 'ytSubtype'>,
): AdFormatKey[] {
  if (!video) return [];
  const derived = deriveAdFormats(video, { nonSkippable: li.ytSubtype === 'NON_SKIPPABLE_REACH' });
  const allowed = surfacesOf(li);
  const surfaceOf: Record<AdFormatKey, YtSurface> = {
    IN_STREAM_SKIPPABLE: 'IN_STREAM',
    BUMPER: 'IN_STREAM',
    NON_SKIPPABLE_IN_STREAM: 'IN_STREAM',
    IN_FEED: 'IN_FEED',
    SHORTS: 'SHORTS',
  };
  return derived.filter((f) => !allowed || allowed.includes(surfaceOf[f]));
}

function adRow(ad: AdWithVideo, li: LiRow): AdRow {
  const trackers: AdRow['trackers'] = [
    ...(ad.clickTrackerUrl ? [{ kind: 'CLICK' as const, url: ad.clickTrackerUrl }] : []),
    ...(ad.impressionTrackerUrl
      ? [{ kind: 'IMPRESSION' as const, url: ad.impressionTrackerUrl }]
      : []),
  ];
  return {
    id: ad.id,
    publicId: ad.publicId.toString(),
    adGroupId: ad.adGroupId,
    name: ad.name,
    status: ad.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE',
    format: isDgFormat(ad.format) ? ad.format : 'RESPONSIVE',
    reviewStatus: ad.reviewStatus,
    reviewFeedback: ad.reviewFeedback,
    thumbnailUrl:
      ad.video?.thumbnailUrl ??
      (ad.imageAssetIds[0]
        ? `/api/dv/youtube/assets/${ad.imageAssetIds[0]}`
        : PLACEHOLDER_THUMBNAIL),
    formats: formatsOf(ad.video, li),
    trackers,
  };
}

// ---------------------------------------------------------------------------------------------
// Ad groups: list and detail (Y4, Y5)
// ---------------------------------------------------------------------------------------------

export async function listAdGroups(user: SessionUser, liId: string): Promise<AdGroupList | null> {
  return inSandbox(user, async (tx) => {
    const li = await loadLi(tx, liId);
    if (!li) return null;
    await settleReviews(
      tx,
      li.sandboxId,
      await classroomOf(user, tx),
      li.adGroups.map((g) => g.id),
    );
    const groups = await tx.adGroup.findMany({
      where: { lineItemId: li.id },
      include: { ads: { select: { reviewStatus: true } } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    const advertiser = await tx.advertiser.findUnique({
      where: { id: li.advertiserId },
      select: { currencyCode: true },
    });
    const currency = advertiser?.currencyCode ?? 'INR';
    const metrics = groups.length
      ? await getGridMetricsTx(tx, {
          level: 'adGroup',
          ids: groups.map((g) => g.id),
          range: { from: '2000-01-01', to: '2100-01-01' },
          sandboxId: li.sandboxId,
        })
      : {};
    const rows = groups.map((g): AdGroupRow => {
      const m = metrics[g.id];
      const rejected = g.ads.filter((a) => a.reviewStatus === 'REJECTED').length;
      const noAds = g.status === 'ACTIVE' && g.ads.length === 0 ? 1 : 0;
      return {
        id: g.id,
        publicId: g.publicId.toString(),
        lineItemId: li.id,
        name: g.name,
        status: g.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE',
        alertCount: rejected + noAds,
        adFormatLabel: 'Responsive',
        adSource: g.adSourceLabel ?? AD_SOURCE,
        cm360Id: g.cm360Id,
        adCount: g.ads.length,
        impressions: m?.impressions ?? 0,
        coViewedImpressions: m?.counters.coViewedImpressions ?? 0,
        revenue: m?.revenue ?? 0,
        avgCpm: m?.hasData ? (m.ratios.cpm ?? null) : null,
        views: m?.counters.videoViews ?? 0,
        viewRate: m?.hasData ? (m.ratios.vtr ?? null) : null,
        avgCpv: m?.hasData ? (m.ratios.cpv ?? null) : null,
        conversions: m?.conversions ?? 0,
        avgCpa: m && m.conversions > 0 ? m.cpa : null,
      };
    });
    return {
      rows,
      total: null,
      currency,
      lineItem: {
        id: li.id,
        publicId: li.publicId.toString(),
        name: li.name,
        type: li.type,
        bidKind: bidKindOf(li),
        status: li.status,
      },
      readOnly: !canWrite(user),
    };
  });
}

export function toFormValue(
  g: { name: string; status: string; bidValue: { toString(): string } | null },
  targetingState: AdGroupFormValue['targetingState'],
): AdGroupFormValue {
  return {
    name: g.name,
    status: g.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE',
    bid: dec(g.bidValue),
    targetingState,
  };
}

/** Defaults of a new ad group (C-09-12: ACTIVE). */
export async function getAdGroupDraft(
  user: SessionUser,
  liId: string,
): Promise<Omit<AdGroupDetail, 'id' | 'publicId' | 'version' | 'ads'> | null> {
  return inSandbox(user, async (tx) => {
    const li = await loadLi(tx, liId);
    if (!li) return null;
    const adv = await tx.advertiser.findUnique({
      where: { id: li.advertiserId },
      select: { currencyCode: true },
    });
    return {
      kind: isDg(li) ? ('DEMAND_GEN' as const) : ('YOUTUBE' as const),
      lineItemId: li.id,
      lineItemName: li.name,
      lineItemBidKind: bidKindOf(li),
      currency: adv?.currencyCode ?? 'INR',
      value: {
        name: '',
        status: 'ACTIVE' as const,
        bid: '',
        targetingState: emptyTargetingState(targetingTypeOf(li)),
      },
      readOnly: !canWrite(user),
    };
  });
}

export async function getAdGroupDetail(
  user: SessionUser,
  adGroupId: string,
): Promise<AdGroupDetail | null> {
  return inSandbox(user, async (tx) => {
    const g = await tx.adGroup.findUnique({ where: { id: adGroupId } });
    if (!g) return null;
    const li = await loadLi(tx, g.lineItemId);
    if (!li) return null;
    await settleReviews(tx, g.sandboxId, await classroomOf(user, tx), [g.id]);
    const [ads, targeting, adv] = await Promise.all([
      tx.ad.findMany({ where: { adGroupId: g.id }, orderBy: [{ name: 'asc' }, { id: 'asc' }] }),
      loadAdGroupTargeting(tx, g.id, targetingTypeOf(li)),
      tx.advertiser.findUnique({ where: { id: g.advertiserId }, select: { currencyCode: true } }),
    ]);
    return {
      kind: isDg(li) ? ('DEMAND_GEN' as const) : ('YOUTUBE' as const),
      id: g.id,
      publicId: g.publicId.toString(),
      version: g.version,
      lineItemId: li.id,
      lineItemName: li.name,
      lineItemBidKind: bidKindOf(li),
      currency: adv?.currencyCode ?? 'INR',
      value: toFormValue(g, targeting),
      ads: (await withVideos(tx, ads)).map((a) => adRow(a, li)),
      readOnly: !canWrite(user),
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Ad groups: writes (Y6 to Y9)
// ---------------------------------------------------------------------------------------------

/** A wire value without targeting state (a forged or minimal body) means no targeting. */
const withState = (v: AdGroupFormValue, type = AD_GROUP_TARGETING_TYPE): AdGroupFormValue =>
  v.targetingState ? v : { ...v, targetingState: emptyTargetingState(type) };

function groupInput(
  v: AdGroupFormValue,
  li: LiRow,
  currency: CurrencyCode,
  adCount: number,
): AdGroupInput {
  const bid = num(v.bid);
  return {
    name: v.name,
    status: v.status,
    bid: bid === null ? null : toMinor(bid, currency),
    dimensions: [...new Set(stateToRows(v.targetingState).map((r) => r.dimension))],
    lineItemType: li.type,
    adCount,
  };
}

/** AG rules for the ad group; a Demand Gen group has no bid of its own (module 09 4.6). */
function groupIssues(
  li: LiRow,
  value: AdGroupFormValue,
  currency: CurrencyCode,
  adCount: number,
  ctx: ValidationContext,
): Issue[] {
  return validate('adGroup', groupInput(value, li, currency, adCount), ctx, {
    trigger: 'save',
  }).filter((i) => !(isDg(li) && BID_RULES.includes(i.ruleId)));
}

export async function validateAdGroup(
  user: SessionUser,
  liId: string,
  raw: AdGroupFormValue,
  adGroupId?: string,
): Promise<Issue[]> {
  const value = withState(raw);
  const out = await inSandbox(user, async (tx) => {
    const li = await loadLi(tx, liId);
    if (!li) return [];
    const { ctx, currency } = await ytContext(tx, user, li, adGroupId ? 'edit' : 'create');
    const adCount = adGroupId ? await tx.ad.count({ where: { adGroupId } }) : 0;
    return groupIssues(li, value, currency, adCount, ctx);
  });
  return out ?? [];
}

export async function createAdGroup(
  user: SessionUser,
  liId: string,
  raw: AdGroupFormValue,
  meta: { note?: string } = {},
): Promise<Result<{ id: string; publicId: string }>> {
  if (!canWrite(user)) return forbidden();
  const value = withState(raw);
  return withSandbox(user.sandboxId!, async (tx) => {
    const li = await loadLi(tx, liId);
    if (!li) return notFound('line item');
    const { ctx, currency } = await ytContext(tx, user, li, 'create');
    const issues = groupIssues(li, value, currency, 0, ctx);
    if (issues.some((i) => i.blocking)) return { ok: false as const, issues };
    const change = await changeCtx(user, tx, meta.note);
    const row = await withChangeLog(
      change,
      {
        type: 'AD_GROUP',
        chain: {
          advertiserId: li.advertiserId,
          campaignId: li.campaignId,
          ioId: li.ioId,
          lineItemId: li.id,
        },
      },
      async (t) => {
        const created = await t.adGroup.create({
          data: {
            sandboxId: li.sandboxId,
            lineItemId: li.id,
            advertiserId: li.advertiserId,
            name: value.name.trim(),
            status: value.status,
            adSourceLabel: AD_SOURCE,
            bidValue: num(value.bid) === null ? null : String(num(value.bid)),
          },
          select: { id: true, publicId: true },
        });
        await persistAdGroupTargeting(t, created.id, value.targetingState);
        return created;
      },
    );
    return {
      ok: true as const,
      data: { id: row.id, publicId: row.publicId.toString() },
      warnings: issues.filter((i) => !i.blocking),
    };
  });
}

export async function updateAdGroup(
  user: SessionUser,
  id: string,
  raw: AdGroupFormValue,
  meta: { expectedVersion?: number; note?: string } = {},
): Promise<Result<{ version: number }>> {
  if (!canWrite(user)) return forbidden();
  const value = withState(raw);
  return withSandbox(user.sandboxId!, async (tx) => {
    const stored = await tx.adGroup.findUnique({
      where: { id },
      include: { _count: { select: { ads: true } } },
    });
    if (!stored) return notFound('ad group');
    if (meta.expectedVersion !== undefined && meta.expectedVersion !== stored.version)
      return conflict('ad group');
    const li = await loadLi(tx, stored.lineItemId);
    if (!li) return notFound('line item');
    const { ctx, currency } = await ytContext(tx, user, li, 'edit');
    const issues = groupIssues(li, value, currency, stored._count.ads, ctx);
    if (issues.some((i) => i.blocking)) return { ok: false as const, issues };
    const change = await changeCtx(user, tx, meta.note);
    const row = await withChangeLog(
      change,
      {
        type: 'AD_GROUP',
        id: stored.id,
        chain: {
          advertiserId: li.advertiserId,
          campaignId: li.campaignId,
          ioId: li.ioId,
          lineItemId: li.id,
        },
      },
      async (t) => {
        const updated = await t.adGroup.update({
          where: { id: stored.id },
          data: {
            name: value.name.trim(),
            status: value.status,
            bidValue: num(value.bid) === null ? null : String(num(value.bid)),
            version: { increment: 1 },
          },
          select: { id: true, version: true },
        });
        await persistAdGroupTargeting(t, stored.id, value.targetingState);
        return updated;
      },
    );
    return {
      ok: true as const,
      data: { version: row.version },
      warnings: issues.filter((i) => !i.blocking),
    };
  });
}

export async function setAdGroupStatus(
  user: SessionUser,
  id: string,
  status: YtStatus,
): Promise<Result<{ status: YtStatus; version: number }>> {
  if (!canWrite(user)) return forbidden();
  return withSandbox(user.sandboxId!, async (tx) => {
    const stored = await tx.adGroup.findUnique({
      where: { id },
      include: { lineItem: { select: { campaignId: true, ioId: true } } },
    });
    if (!stored) return notFound('ad group');
    const change = await changeCtx(user, tx);
    const row = await withChangeLog(
      change,
      {
        type: 'AD_GROUP',
        id,
        chain: {
          advertiserId: stored.advertiserId,
          campaignId: stored.lineItem.campaignId,
          ioId: stored.lineItem.ioId,
          lineItemId: stored.lineItemId,
        },
      },
      (t) =>
        t.adGroup.update({
          where: { id },
          data: { status, version: { increment: 1 } },
          select: { id: true, version: true },
        }),
    );
    return { ok: true as const, data: { status, version: row.version } };
  });
}

/** Y9: hard delete, ads cascade; the DELETE entry keeps the final values (AC-09-16). */
export async function deleteAdGroup(user: SessionUser, id: string): Promise<Result<null>> {
  if (!canWrite(user)) return forbidden();
  return withSandbox(user.sandboxId!, async (tx) => {
    const stored = await tx.adGroup.findUnique({
      where: { id },
      include: { lineItem: { select: { campaignId: true, ioId: true } } },
    });
    if (!stored) return notFound('ad group');
    const change = await changeCtx(user, tx);
    await withChangeLog(
      change,
      {
        type: 'AD_GROUP',
        id,
        chain: {
          advertiserId: stored.advertiserId,
          campaignId: stored.lineItem.campaignId,
          ioId: stored.lineItem.ioId,
          lineItemId: stored.lineItemId,
        },
      },
      (t) => t.adGroup.delete({ where: { id }, select: { id: true } }),
    );
    return { ok: true as const, data: null };
  });
}

/** Bulk Activate and Pause on the ad group grid (Y10, Q-09-04). */
export async function bulkSetAdGroupStatus(
  user: SessionUser,
  ids: string[],
  status: YtStatus,
): Promise<Result<{ changed: number }>> {
  if (!canWrite(user)) return forbidden();
  let changed = 0;
  for (const id of ids) {
    const r = await setAdGroupStatus(user, id, status);
    if (!r.ok) return r;
    changed++;
  }
  return { ok: true, data: { changed } };
}

// ---------------------------------------------------------------------------------------------
// Ads: detail and draft (Y11)
// ---------------------------------------------------------------------------------------------

function toAdForm(a: Prisma.AdGetPayload<Record<string, never>>): AdFormValue {
  const split = (url: string | null): { protocol: 'http://' | 'https://'; rest: string } => {
    if (!url) return { protocol: 'https://', rest: '' };
    return url.startsWith('http://')
      ? { protocol: 'http://', rest: url.slice(7) }
      : { protocol: 'https://', rest: url.replace(/^https:\/\//, '') };
  };
  const land = split(a.landingPageUrl);
  const click = split(a.clickTrackerUrl);
  return {
    name: a.name,
    status: a.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE',
    videoRef: a.youtubeVideoId ?? '',
    videoId: a.youtubeVideoId,
    headline: a.headline ?? '',
    longHeadline: a.longHeadline ?? '',
    description: a.description ?? '',
    callToAction: a.callToAction ?? '',
    businessName: a.businessName ?? '',
    logoAssetId: a.logoAssetId,
    displayUrl: a.displayUrl ?? '',
    path1: a.path1 ?? '',
    path2: a.path2 ?? '',
    landingProtocol: land.protocol,
    landingPage: land.rest,
    clickTrackerProtocol: click.protocol,
    clickTracker: click.rest,
    impressionTrackerUrl: a.impressionTrackerUrl ?? '',
    urlSuffix: a.urlSuffix ?? '',
    companionMode: a.companionAssetId ? 'OWN' : 'NONE',
    companionAssetId: a.companionAssetId,
    dgFormat: isDgFormat(a.format) ? a.format : null,
    imageAssetIds: a.imageAssetIds,
  };
}

const LOGO_FALLBACK = '/youtube/logo.svg';

/** Uploaded assets are served by the assets route; a default logo id without a file shows the stock logo. */
async function assetUrl(tx: Tx, id: string | null): Promise<string | null> {
  if (!id) return null;
  const row = await tx.creativeAsset.findUnique({ where: { id }, select: { id: true } });
  return row ? `/api/dv/youtube/assets/${row.id}` : LOGO_FALLBACK;
}

async function adDetailOf(
  tx: Tx,
  user: SessionUser,
  g: Prisma.AdGroupGetPayload<Record<string, never>>,
  li: LiRow,
  ad: Prisma.AdGetPayload<Record<string, never>> | null,
): Promise<AdDetail> {
  const adv = await tx.advertiser.findUnique({
    where: { id: g.advertiserId },
    select: { ytBusinessName: true, ytLogoAssetId: true },
  });
  const defaults = {
    businessName: adv?.ytBusinessName ?? '',
    logoAssetId: adv?.ytLogoAssetId ?? null,
  };
  const withVideo = ad ? (await withVideos(tx, [ad]))[0]! : null;
  const value: AdFormValue = ad
    ? toAdForm(ad)
    : {
        ...EMPTY_AD_FORM,
        businessName: defaults.businessName,
        logoAssetId: defaults.logoAssetId,
      };
  const nonSkippable = li.ytSubtype === 'NON_SKIPPABLE_REACH';
  return {
    id: ad?.id ?? '',
    publicId: ad?.publicId.toString() ?? '',
    version: ad?.version ?? 0,
    adGroupId: g.id,
    adGroupName: g.name,
    value,
    video: withVideo?.video ?? null,
    reviewStatus: ad?.reviewStatus ?? 'PENDING',
    reviewFeedback: ad?.reviewFeedback ?? null,
    formats: withVideo ? formatsOf(withVideo.video, li) : [],
    logoUrl: await assetUrl(tx, value.logoAssetId),
    imageUrls: value.imageAssetIds.map((id) => ({ id, url: `/api/dv/youtube/assets/${id}` })),
    dg: isDg(li),
    defaults,
    allowedSurfaces: surfacesOf(li),
    nonSkippable,
    readOnly: !canWrite(user),
  };
}

export async function getAdDetail(user: SessionUser, adId: string): Promise<AdDetail | null> {
  return inSandbox(user, async (tx) => {
    const ad = await tx.ad.findUnique({ where: { id: adId } });
    if (!ad) return null;
    const g = await tx.adGroup.findUnique({ where: { id: ad.adGroupId } });
    const li = g ? await loadLi(tx, g.lineItemId) : null;
    if (!g || !li) return null;
    await settleReviews(tx, g.sandboxId, await classroomOf(user, tx), [g.id]);
    const fresh = await tx.ad.findUnique({ where: { id: adId } });
    return adDetailOf(tx, user, g, li, fresh ?? ad);
  });
}

export async function getAdDraft(user: SessionUser, adGroupId: string): Promise<AdDetail | null> {
  return inSandbox(user, async (tx) => {
    const g = await tx.adGroup.findUnique({ where: { id: adGroupId } });
    const li = g ? await loadLi(tx, g.lineItemId) : null;
    return g && li ? adDetailOf(tx, user, g, li, null) : null;
  });
}

// ---------------------------------------------------------------------------------------------
// Ads: writes (Y12 to Y15)
// ---------------------------------------------------------------------------------------------

function resolveVideoId(v: AdFormValue): string | null {
  return parseYoutubeRef(v.videoRef) ?? (v.videoId && v.videoId === v.videoRef ? v.videoId : null);
}

function adInput(v: AdFormValue, videoId: string | null): AdInput {
  return {
    name: v.name,
    status: v.status,
    videoRef: v.videoRef,
    videoId,
    headline: v.headline,
    longHeadline: v.longHeadline,
    description: v.description,
    callToAction: v.callToAction,
    businessName: v.businessName,
    logoAssetId: v.logoAssetId,
    path1: v.path1,
    path2: v.path2,
    landingPageUrl: mergeUrl(v.landingProtocol, v.landingPage),
    clickTrackerUrl: mergeUrl(v.clickTrackerProtocol, v.clickTracker),
    impressionTrackerUrl: v.impressionTrackerUrl,
    companionMode: v.companionMode,
    companionAssetId: v.companionAssetId,
  };
}

/**
 * Rules of the ad. A Demand Gen ad keeps the name, URL and status rules of AD, and has its own limits and media checks
 * (LI-DG-007..009, `dgIssues`); the video, long headline, logo and companion rules are YouTube only.
 */
function adIssues(
  li: LiRow,
  ctx: ValidationContext,
  value: AdFormValue,
  videoId: string | null,
): Issue[] {
  const base = validate('ad', adInput(value, videoId), ctx, { trigger: 'save' });
  if (!isDg(li)) return base;
  const video = videoId ? ctx.lookups.youtubeVideos?.get(videoId) : undefined;
  return [
    ...base.filter((i) => DG_AD_RULES.includes(i.ruleId)),
    ...dgIssues({
      dgFormat: value.dgFormat,
      videoId,
      videoFound: !!video?.isPublic,
      imageAssetIds: value.imageAssetIds ?? [],
      headline: value.headline,
      description: value.description,
      businessName: value.businessName,
    }),
  ];
}

export async function validateAd(
  user: SessionUser,
  adGroupId: string,
  value: AdFormValue,
  adId?: string,
): Promise<Issue[]> {
  const out = await inSandbox(user, async (tx) => {
    const g = await tx.adGroup.findUnique({ where: { id: adGroupId } });
    const li = g ? await loadLi(tx, g.lineItemId) : null;
    if (!g || !li) return [];
    const videoId = resolveVideoId(value);
    const { ctx } = await ytContext(
      tx,
      user,
      li,
      adId ? 'edit' : 'create',
      videoId ? [videoId] : [],
    );
    return adIssues(li, ctx, value, videoId);
  });
  return out ?? [];
}

function adColumns(v: AdFormValue, videoId: string | null, dg: boolean) {
  const video = !dg || v.dgFormat === 'DEMAND_GEN_VIDEO';
  return {
    name: v.name.trim(),
    status: v.status,
    youtubeVideoId: video ? videoId : null,
    imageAssetIds: video ? [] : [...new Set(v.imageAssetIds ?? [])],
    logoAssetId: v.logoAssetId,
    companionAssetId: !dg && v.companionMode === 'OWN' ? v.companionAssetId : null,
    headline: orNull(v.headline),
    longHeadline: dg ? null : orNull(v.longHeadline),
    description: orNull(v.description),
    callToAction: orNull(v.callToAction),
    businessName: orNull(v.businessName),
    displayUrl: dg ? null : orNull(v.displayUrl),
    path1: dg ? null : orNull(v.path1),
    path2: dg ? null : orNull(v.path2),
    landingPageUrl: mergeUrl(v.landingProtocol, v.landingPage),
    clickTrackerUrl: orNull(mergeUrl(v.clickTrackerProtocol, v.clickTracker)),
    impressionTrackerUrl: dg ? null : orNull(v.impressionTrackerUrl),
    urlSuffix: dg ? null : orNull(v.urlSuffix),
  };
}

const REVIEWED_FIELDS = [
  'youtubeVideoId',
  'headline',
  'longHeadline',
  'description',
  'callToAction',
  'businessName',
  'landingPageUrl',
  'imageAssetIds',
] as const;

const sameValue = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export async function createAd(
  user: SessionUser,
  adGroupId: string,
  value: AdFormValue,
  meta: { note?: string } = {},
): Promise<Result<{ id: string; publicId: string }>> {
  if (!canWrite(user)) return forbidden();
  return withSandbox(user.sandboxId!, async (tx) => {
    const g = await tx.adGroup.findUnique({ where: { id: adGroupId } });
    const li = g ? await loadLi(tx, g.lineItemId) : null;
    if (!g || !li) return notFound('ad group');
    const videoId = resolveVideoId(value);
    const { ctx } = await ytContext(tx, user, li, 'create', videoId ? [videoId] : []);
    const issues = adIssues(li, ctx, value, videoId);
    if (issues.some((i) => i.blocking) || (!isDg(li) && !videoId))
      return { ok: false as const, issues };
    const now = await simNow(tx, g.sandboxId);
    const plan = planReview(`${g.id}:${value.name}`, value);
    const change = await changeCtx(user, tx, meta.note);
    const row = await withChangeLog(
      change,
      {
        type: 'AD',
        chain: {
          advertiserId: li.advertiserId,
          campaignId: li.campaignId,
          ioId: li.ioId,
          lineItemId: li.id,
        },
      },
      (t) =>
        t.ad.create({
          data: {
            sandboxId: g.sandboxId,
            adGroupId: g.id,
            advertiserId: g.advertiserId,
            format: isDg(li) && isDgFormat(value.dgFormat) ? value.dgFormat : 'RESPONSIVE',
            reviewStatus: 'PENDING',
            reviewDecideAt: new Date(now.getTime() + plan.delayHours * 3_600_000),
            plannedVerdict: plan.verdict,
            ...adColumns(value, videoId, isDg(li)),
          },
          select: { id: true, publicId: true },
        }),
    );
    return {
      ok: true as const,
      data: { id: row.id, publicId: row.publicId.toString() },
      warnings: issues.filter((i) => !i.blocking),
    };
  });
}

export async function updateAd(
  user: SessionUser,
  id: string,
  value: AdFormValue,
  meta: { expectedVersion?: number; note?: string } = {},
): Promise<Result<{ version: number }>> {
  if (!canWrite(user)) return forbidden();
  return withSandbox(user.sandboxId!, async (tx) => {
    const stored = await tx.ad.findUnique({ where: { id } });
    if (!stored) return notFound('ad');
    if (meta.expectedVersion !== undefined && meta.expectedVersion !== stored.version)
      return conflict('ad');
    const g = await tx.adGroup.findUnique({ where: { id: stored.adGroupId } });
    const li = g ? await loadLi(tx, g.lineItemId) : null;
    if (!g || !li) return notFound('ad group');
    const videoId = resolveVideoId(value);
    const { ctx } = await ytContext(tx, user, li, 'edit', videoId ? [videoId] : []);
    // the format of a Demand Gen ad is fixed after create
    const input: AdFormValue = isDg(li)
      ? { ...value, dgFormat: isDgFormat(stored.format) ? stored.format : value.dgFormat }
      : value;
    const issues = adIssues(li, ctx, input, videoId);
    if (issues.some((i) => i.blocking) || (!isDg(li) && !videoId))
      return { ok: false as const, issues };
    const columns = adColumns(input, videoId, isDg(li));
    // Q-09-06: editing the video or the reviewed text sends the ad back to review.
    const reviewed = REVIEWED_FIELDS.some((k) => !sameValue(stored[k], columns[k]));
    const now = await simNow(tx, g.sandboxId);
    const plan = reviewed ? planReview(`${g.id}:${value.name}`, value) : null;
    const change = await changeCtx(user, tx, meta.note);
    const row = await withChangeLog(
      change,
      {
        type: 'AD',
        id: stored.id,
        chain: {
          advertiserId: li.advertiserId,
          campaignId: li.campaignId,
          ioId: li.ioId,
          lineItemId: li.id,
        },
      },
      (t) =>
        t.ad.update({
          where: { id: stored.id },
          data: {
            ...columns,
            ...(plan
              ? {
                  reviewStatus: 'PENDING' as const,
                  reviewFeedback: null,
                  reviewDecideAt: new Date(now.getTime() + plan.delayHours * 3_600_000),
                  plannedVerdict: plan.verdict,
                }
              : {}),
            version: { increment: 1 },
          },
          select: { id: true, version: true },
        }),
    );
    return {
      ok: true as const,
      data: { version: row.version },
      warnings: issues.filter((i) => !i.blocking),
    };
  });
}

export async function setAdStatus(
  user: SessionUser,
  id: string,
  status: YtStatus,
): Promise<Result<{ status: YtStatus; version: number }>> {
  if (!canWrite(user)) return forbidden();
  return withSandbox(user.sandboxId!, async (tx) => {
    const stored = await tx.ad.findUnique({
      where: { id },
      include: { adGroup: { include: { lineItem: { select: { campaignId: true, ioId: true } } } } },
    });
    if (!stored) return notFound('ad');
    const change = await changeCtx(user, tx);
    const row = await withChangeLog(
      change,
      {
        type: 'AD',
        id,
        chain: {
          advertiserId: stored.advertiserId,
          campaignId: stored.adGroup.lineItem.campaignId,
          ioId: stored.adGroup.lineItem.ioId,
          lineItemId: stored.adGroup.lineItemId,
        },
      },
      (t) =>
        t.ad.update({
          where: { id },
          data: { status, version: { increment: 1 } },
          select: { id: true, version: true },
        }),
    );
    return { ok: true as const, data: { status, version: row.version } };
  });
}

export async function deleteAd(user: SessionUser, id: string): Promise<Result<null>> {
  if (!canWrite(user)) return forbidden();
  return withSandbox(user.sandboxId!, async (tx) => {
    const stored = await tx.ad.findUnique({
      where: { id },
      include: { adGroup: { include: { lineItem: { select: { campaignId: true, ioId: true } } } } },
    });
    if (!stored) return notFound('ad');
    const change = await changeCtx(user, tx);
    await withChangeLog(
      change,
      {
        type: 'AD',
        id,
        chain: {
          advertiserId: stored.advertiserId,
          campaignId: stored.adGroup.lineItem.campaignId,
          ioId: stored.adGroup.lineItem.ioId,
          lineItemId: stored.adGroup.lineItemId,
        },
      },
      (t) => t.ad.delete({ where: { id }, select: { id: true } }),
    );
    return { ok: true as const, data: null };
  });
}

// ---------------------------------------------------------------------------------------------
// Preview (Y17) and asset upload (Y18)
// ---------------------------------------------------------------------------------------------

export interface PreviewRequest {
  adGroupId: string;
  videoRef: string;
  headline?: string | undefined;
  longHeadline?: string | undefined;
  description?: string | undefined;
  callToAction?: string | undefined;
  businessName?: string | undefined;
  displayUrl?: string | undefined;
  logoAssetId?: string | null | undefined;
  companionAssetId?: string | null | undefined;
  filter: FormatFilter;
  format: AdFormatKey | null;
  device: PreviewDevice;
  surface: PreviewSurface;
}

/** `POST ads/preview`: the model of an unsaved draft. No writes. */
export async function previewAd(
  user: SessionUser,
  req: PreviewRequest,
): Promise<PreviewModel | null> {
  return inSandbox(user, async (tx) => {
    const g = await tx.adGroup.findUnique({ where: { id: req.adGroupId } });
    const li = g ? await loadLi(tx, g.lineItemId) : null;
    if (!g || !li) return null;
    const id = parseYoutubeRef(req.videoRef);
    const video = id ? await tx.youtubeVideo.findUnique({ where: { videoId: id } }) : null;
    const [logoUrl, companionUrl] = await Promise.all([
      assetUrl(tx, req.logoAssetId ?? null),
      req.companionAssetId ? assetUrl(tx, req.companionAssetId) : Promise.resolve(null),
    ]);
    const draft: PreviewDraft = {
      video: video && video.isPublic ? hitOf(video) : null,
      headline: req.headline,
      longHeadline: req.longHeadline,
      description: req.description,
      callToAction: req.callToAction,
      businessName: req.businessName,
      displayUrl: req.displayUrl,
      logoUrl,
      companionBannerUrl: companionUrl,
      allowedSurfaces: surfacesOf(li),
      nonSkippable: li.ytSubtype === 'NON_SKIPPABLE_REACH',
    };
    return buildPreviewModel(draft, {
      filter: req.filter,
      format: req.format,
      device: req.device,
      surface: req.surface,
    });
  });
}

export const ASSET_TYPES = ['image/png', 'image/jpeg', 'image/gif'] as const;
export const ASSET_MAX_BYTES = 5 * 1024 * 1024;

/** Logo and companion banner files: png, jpg or gif up to 5 MB (Q-09-07). The bytes go to the file store. */
export async function uploadAdAsset(
  user: SessionUser,
  input: {
    adGroupId: string;
    role: 'LOGO' | 'COMPANION' | 'IMAGE';
    fileName: string;
    mimeType: string;
    bytes: Uint8Array;
  },
): Promise<Result<{ id: string; url: string }>> {
  if (!canWrite(user)) return forbidden();
  if (!(ASSET_TYPES as readonly string[]).includes(input.mimeType))
    return { ok: false, issues: [issue('AD-ASSET', 'file', 'Upload a PNG, JPG or GIF image.')] };
  if (input.bytes.byteLength > ASSET_MAX_BYTES)
    return { ok: false, issues: [issue('AD-ASSET', 'file', 'The image must be 5 MB or smaller.')] };
  return withSandbox(user.sandboxId!, async (tx) => {
    const g = await tx.adGroup.findUnique({ where: { id: input.adGroupId } });
    if (!g) return notFound('ad group');
    const row = await tx.creativeAsset.create({
      data: {
        sandboxId: g.sandboxId,
        advertiserId: g.advertiserId,
        role: input.role === 'IMAGE' ? 'EXTRA' : input.role,
        fileName: input.fileName.slice(0, 200),
        mimeType: input.mimeType,
        sizeBytes: input.bytes.byteLength,
        storageKey: '',
      },
      select: { id: true },
    });
    const key = `youtube/${g.sandboxId}/${row.id}`;
    await tx.creativeAsset.update({ where: { id: row.id }, data: { storageKey: key } });
    await fileStore().put(key, input.bytes, input.mimeType);
    return { ok: true as const, data: { id: row.id, url: `/api/dv/youtube/assets/${row.id}` } };
  });
}

/** Bytes of an uploaded asset for the assets route. Null for a missing file or a foreign sandbox. */
export async function readAdAsset(
  user: SessionUser,
  id: string,
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const row = await inSandbox(user, (tx) =>
    tx.creativeAsset.findUnique({ where: { id }, select: { storageKey: true } }),
  );
  return row?.storageKey ? fileStore().get(row.storageKey) : null;
}

/** LI-YT-021: the advertiser needs Google & partner inventory. Step 1 shows the error and keeps Next disabled. */
export async function isYoutubeEnabled(user: SessionUser, advertiserId: string): Promise<boolean> {
  const row = await inSandbox(user, (tx) =>
    tx.advertiser.findUnique({
      where: { id: advertiserId },
      select: { googleInventoryEnabled: true },
    }),
  );
  return row?.googleInventoryEnabled ?? false;
}
