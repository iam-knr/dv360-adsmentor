import 'server-only';
// Shared server helpers of the creative service: stored rows to wire rows, form input to columns, exchanges that
// review a creative, the sandbox seed for the deterministic review plan.
import { Prisma, type CreativeKind } from '@prisma/client';
import type { Tx } from '@/lib/db';
import type { CreativeAssetInput, CreativeInput } from '@/lib/validation/types';
import { youtubeIdOf } from '@/lib/validation/rules/creative';
import { formatLabel, KIND_META } from './kinds';
import { countExchanges, exchangeStatusText, hash01, shownDv360Review } from './review';
import { parseVast } from './vast';
import type { CreativeAssetView, CreativeRow } from './types';

export const CREATIVE_INCLUDE = {
  reviews: true,
  creativeRestrictions: true,
  assets: true,
  creativeUrls: true,
  assignments: { select: { lineItemId: true, lineItem: { select: { status: true } } } },
} satisfies Prisma.CreativeInclude;

export type StoredCreative = Prisma.CreativeGetPayload<{ include: typeof CREATIVE_INCLUDE }>;

export const SOURCE_LABEL = {
  DV360: 'Display & Video 360',
  CM360: 'Campaign Manager 360',
  THIRD_PARTY: 'Third party',
} as const;

const AI_LABEL = { UNSET: '-', AI_GENERATED: 'Labeled', NOT_AI_GENERATED: 'Not labeled' } as const;

/** Seed of the deterministic review plan: the sandbox seed of the sim clock (engine.md 1.2), one per sandbox. */
export async function sandboxSeed(tx: Tx, sandboxId: string): Promise<string> {
  const clock = await tx.simClock.findUnique({
    where: { sandboxId },
    select: { sandboxSeed: true },
  });
  return `${sandboxId}:${clock?.sandboxSeed ?? ''}`;
}

type ExchangeRow = { id: string; name: string; code: string };

export async function exchangeNames(tx: Tx): Promise<Map<string, ExchangeRow>> {
  const rows = await tx.exchange.findMany({ select: { id: true, name: true, code: true } });
  return new Map(rows.map((r) => [r.id, r]));
}

/** Partner exchanges that can review this kind of creative (enabled for the partner, media supported). */
export async function reviewingExchanges(
  tx: Tx,
  partnerId: string,
  kind: CreativeKind,
): Promise<string[]> {
  const media = KIND_META[kind].media;
  const rows = await tx.partnerExchange.findMany({
    where: { partnerId, enabled: true },
    include: { exchange: true },
    orderBy: { exchange: { sortOrder: 'asc' } },
  });
  return rows
    .filter(({ exchange: e }) =>
      media === 'audio'
        ? e.supportsAudio
        : media === 'video'
          ? e.supportsVideo || e.supportsCtv
          : e.supportsDisplay,
    )
    .map((r) => r.exchangeId);
}

/** Some exchanges insist on SSL (CRE-011): decided per exchange id, so about half of them. */
export const exchangeRequiresSsl = (exchangeId: string): boolean =>
  hash01(exchangeId, 'requires-ssl') < 0.5;

export const isSslCompliant = (input: Pick<CreativeInput, 'thirdPartyTag' | 'vastTag'>): boolean =>
  !/\bhttp:\/\//i.test(`${input.thirdPartyTag ?? ''} ${input.vastTag ?? ''}`);

export function dimensionsOf(c: { width: number; height: number }): string | null {
  return c.width > 0 && c.height > 0 ? `${c.width}×${c.height}` : null;
}

export function durationText(seconds: number | null): string | null {
  if (seconds === null || seconds === undefined) return null;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Library row for one stored creative. `ext` supplies the review plan; `alerts` the creatives with an open alert. */
export function toRow(
  c: StoredCreative,
  ext: { dv360DecideAt: Date | null } | null,
  names: Map<string, ExchangeRow>,
  simNow: Date,
  alertIds: ReadonlySet<string>,
  companions: number,
): CreativeRow {
  const counts = countExchanges(c.reviews.map((r) => r.status));
  return {
    id: c.id,
    publicId: c.publicId.toString(),
    name: c.name,
    status: c.status === 'PAUSED' ? 'PAUSED' : c.status === 'ACTIVE' ? 'ACTIVE' : 'ARCHIVED',
    kind: c.kind,
    formatKey: c.formatKey,
    type: KIND_META[c.kind].typeLabel,
    format: formatLabel(c.kind, c.formatKey),
    aiLabel: AI_LABEL[c.aiLabel],
    dv360Status: shownDv360Review(c.dv360Review, ext?.dv360DecideAt ?? null, simNow),
    exchangeStatus: {
      text: exchangeStatusText(counts),
      ...counts,
      exchanges: c.reviews
        .map((r) => ({
          name: names.get(r.exchangeId)?.name ?? r.exchangeId,
          status: r.status,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    },
    companions,
    dimensions: dimensionsOf(c),
    duration: durationText(c.durationSeconds),
    source: SOURCE_LABEL[c.source],
    createdAt: c.createdAt.toISOString(),
    modifiedAt: c.updatedAt.toISOString(),
    tagWrapping: c.kind === 'THIRD_PARTY_DISPLAY' ? (c.appendTrackingTag ? 'Yes' : 'No') : null,
    lineItems: c.assignments.filter((a) => a.lineItem.status !== 'ARCHIVED').length,
    restricted: c.creativeRestrictions.length > 0,
    alert: alertIds.has(c.id),
    cm360Id: c.cm360Id,
  };
}

export const assetView = (a: StoredCreative['assets'][number]): CreativeAssetView => ({
  id: a.id,
  role: a.role,
  fileName: a.fileName,
  mimeType: a.mimeType,
  sizeBytes: a.sizeBytes,
  width: a.width,
  height: a.height,
  durationSeconds: a.durationSeconds,
});

const assetInput = (a: StoredCreative['assets'][number] | undefined): CreativeAssetInput | null =>
  a
    ? {
        fileName: a.fileName,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        width: a.width,
        height: a.height,
        durationSeconds: a.durationSeconds,
      }
    : null;

type ExtRow = Prisma.CreativeExtGetPayload<object>;

/** Stored creative to the form value (edit page and validation `original`). */
export function toInput(c: StoredCreative, ext: ExtRow | null): CreativeInput {
  const native = (ext?.nativeFields ?? null) as Record<string, unknown> | null;
  const url = (type: string) => c.creativeUrls.find((u) => u.type === type)?.url ?? null;
  return {
    kind: c.kind,
    formatKey: c.formatKey,
    name: c.name,
    status: c.status === 'PAUSED' ? 'PAUSED' : c.status === 'ACTIVE' ? 'ACTIVE' : 'ARCHIVED',
    landingPageUrl: c.landingPageUrl,
    width: c.width,
    height: c.height,
    durationSeconds: c.durationSeconds,
    thirdPartyTag: c.thirdPartyTag,
    vastTag: c.vastTagUrl,
    youtubeVideo: ext?.youtubeVideoId ?? null,
    requiresMraid: c.requiresMraid,
    requiresHtml5: c.requiresHtml5,
    expandDirection: c.expandDirection,
    expandsOnHover: c.expandsOnHover,
    dontScaleToFit: c.dontScaleToFit,
    appendTrackingTag: c.appendTrackingTag,
    requiresPing: c.requiresPing,
    aiLabel: c.aiLabel,
    integrationCode: c.integrationCode,
    notes: c.notes,
    skippable: ext?.skippable ?? false,
    skipOffsetSec: ext?.skipOffsetSec ?? null,
    impressionTrackerUrl: url('IMPRESSION_TRACKER'),
    clickTrackerUrl: url('CLICK_TRACKER'),
    ...(native && !('headlines' in native)
      ? {
          native: {
            headline: str(native.headline),
            body: str(native.body),
            callToAction: str(native.callToAction),
            advertiserName: str(native.advertiserName),
            displayUrl: str(native.displayUrl),
          },
        }
      : {}),
    ...(native && 'headlines' in native
      ? {
          optimized: {
            headlines: strs(native.headlines),
            descriptions: strs(native.descriptions),
            imageCount: Number(native.imageCount ?? 0),
            logoCount: Number(native.logoCount ?? 0),
            businessName: str(native.businessName),
            callToAction: str(native.callToAction),
          },
        }
      : {}),
    mainAsset: assetInput(c.assets.find((a) => a.role === 'MAIN')),
    logoAsset: assetInput(c.assets.find((a) => a.role === 'LOGO')),
    source: c.source,
  };
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const strs = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

/** Numeric form value (a number, typed text or nothing) to an integer column. */
export const intOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
};

/** Columns of Creative from a validated input. Kind-specific fields that do not apply are cleared. */
export type CreativeColumns = Omit<
  Prisma.CreativeUncheckedCreateInput,
  'sandboxId' | 'advertiserId'
>;

export function toColumns(input: CreativeInput): CreativeColumns {
  const vast = input.vastTag ? parseVast(input.vastTag) : null;
  const main = input.mainAsset;
  return {
    name: input.name.trim(),
    kind: input.kind,
    formatKey: input.formatKey ?? null,
    width: intOrNull(input.width) ?? main?.width ?? 0,
    height: intOrNull(input.height) ?? main?.height ?? 0,
    durationSeconds:
      intOrNull(input.durationSeconds) ??
      main?.durationSeconds ??
      (vast && vast.ok ? vast.durationSeconds : null),
    landingPageUrl: input.landingPageUrl?.trim() || null,
    dontScaleToFit: !!input.dontScaleToFit,
    requiresMraid: !!input.requiresMraid,
    requiresHtml5: !!input.requiresHtml5,
    expandDirection: (input.expandDirection ?? 'NONE') as CreativeColumns['expandDirection'],
    expandsOnHover: !!input.expandsOnHover,
    thirdPartyTag: input.kind === 'THIRD_PARTY_DISPLAY' ? (input.thirdPartyTag ?? null) : null,
    vastTagUrl:
      input.kind === 'THIRD_PARTY_VIDEO' || input.kind === 'THIRD_PARTY_AUDIO'
        ? (input.vastTag?.trim() ?? null)
        : null,
    appendTrackingTag: !!input.appendTrackingTag,
    requiresPing: !!input.requiresPing,
    aiLabel: input.aiLabel ?? 'UNSET',
    integrationCode: input.integrationCode?.trim() || null,
    notes: input.notes?.trim() || null,
  };
}

export function toExtData(
  input: CreativeInput,
): Omit<Prisma.CreativeExtUncheckedCreateInput, 'sandboxId' | 'creativeId'> {
  const optimized = input.optimized;
  return {
    skippable: !!input.skippable,
    skipOffsetSec: input.skippable ? (intOrNull(input.skipOffsetSec) ?? 5) : null,
    nativeFields: optimized ? { ...optimized } : input.native ? { ...input.native } : Prisma.DbNull,
    youtubeVideoId: input.kind === 'YOUTUBE_VIDEO' ? youtubeIdOf(input.youtubeVideo) : null,
  };
}

/** Fields whose change sends the creative back to review (module 12 4.3 updateCreative, AC 6). */
export function needsReReview(before: CreativeInput, after: CreativeInput): boolean {
  const same = (a: string | number | null | undefined, b: string | number | null | undefined) =>
    String(a ?? '').trim() === String(b ?? '').trim();
  const asset = (a: CreativeAssetInput | null | undefined) =>
    a ? `${a.fileName}:${a.sizeBytes}` : '';
  return (
    !same(before.thirdPartyTag, after.thirdPartyTag) ||
    !same(before.vastTag, after.vastTag) ||
    !same(youtubeIdOf(before.youtubeVideo), youtubeIdOf(after.youtubeVideo)) ||
    !same(intOrNull(before.width), intOrNull(after.width)) ||
    !same(intOrNull(before.height), intOrNull(after.height)) ||
    !same(before.landingPageUrl, after.landingPageUrl) ||
    asset(before.mainAsset) !== asset(after.mainAsset) ||
    asset(before.logoAsset) !== asset(after.logoAsset)
  );
}
