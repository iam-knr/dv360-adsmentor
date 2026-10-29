// The YouTube part of the line item form and its stored columns (module 09 2.2, 3.2). Pure and client safe.
import type { FrequencyUnit, Prisma } from '@prisma/client';
import {
  YT_INVENTORY_SOURCES,
  YT_SUBTYPE_INFO,
  subtypeFrom,
  type YtAdFormatChoice,
  type YtInventorySource,
  type YtOptimization,
  type YtSubtype,
  type YtSurface,
} from '@/lib/validation/constants/youtube';
import type { FrequencyCapInput, LiType, YoutubeLiInput } from '@/lib/validation/types';

export const isYoutubeType = (type: string | null | undefined): boolean =>
  type === 'YT_VIDEO' || type === 'YT_AUDIO' || type === 'YT_ON_CTV';

export interface YtStep1 {
  optimization: YtOptimization;
  choice: YtAdFormatChoice | null;
}

const SURFACE_KEYS: Record<YtSurface, 'inStream' | 'inFeed' | 'shorts'> = {
  IN_STREAM: 'inStream',
  IN_FEED: 'inFeed',
  SHORTS: 'shorts',
};
const ORDER: YtSurface[] = ['IN_STREAM', 'IN_FEED', 'SHORTS'];

export function surfacesToFormats(surfaces: readonly YtSurface[]): YoutubeLiInput['adFormats'] {
  return {
    inStream: surfaces.includes('IN_STREAM'),
    inFeed: surfaces.includes('IN_FEED'),
    shorts: surfaces.includes('SHORTS'),
  };
}

/** Surfaces the line item serves on: the ticks for pickable subtypes, the subtype's fixed set otherwise. */
export function formatsToSurfaces(subtype: YtSubtype, f: YoutubeLiInput['adFormats']): YtSurface[] {
  const info = YT_SUBTYPE_INFO[subtype];
  if (!info.pickable) return [...info.surfaces];
  return ORDER.filter((s) => f[SURFACE_KEYS[s]]);
}

export const NO_CAP: FrequencyCapInput = {
  mode: 'UNLIMITED',
  maxImpressions: null,
  periodCount: 1,
  period: 'WEEK',
};

/** A new YouTube line item's settings from the step 1 choice (LI-YT-002/003, MX-07). */
export function defaultYoutubeInput(type: LiType, step1?: YtStep1 | null): YoutubeLiInput {
  const audio = type === 'YT_AUDIO';
  const optimization: YtOptimization = audio ? 'REACH' : (step1?.optimization ?? 'REACH');
  const choice = audio ? null : step1 ? step1.choice : 'EFFICIENT';
  const subtype = subtypeFrom(optimization, choice, audio) ?? 'EFFICIENT_REACH';
  const info = YT_SUBTYPE_INFO[subtype];
  return {
    subtype,
    optimization,
    adFormatChoice: choice,
    adFormats: surfacesToFormats(info.surfaces),
    viewCap: { ...NO_CAP },
    targetFrequency: info.targetFrequency
      ? { mode: 'LIMITED', maxImpressions: '', periodCount: 1, period: 'WEEK' }
      : null,
    productFeed: false,
    relatedVideoIds: [],
    inventorySources: [...YT_INVENTORY_SOURCES],
  };
}

type CapRow = {
  viewFreqMode: 'INHERIT' | 'UNLIMITED' | 'LIMITED';
  viewFreqMax: number | null;
  viewFreqUnit: FrequencyUnit | null;
  viewFreqUnitCount: number | null;
  targetFreqExposures: number | null;
  targetFreqUnit: FrequencyUnit | null;
  targetFreqUnitCount: number | null;
};

export interface YoutubeRow extends CapRow {
  ytSubtype: string | null;
  ytSurfaces: readonly string[];
  productFeedEnabled: boolean;
  relatedVideoIds: string[];
}

/** Stored columns to the form section. `inventorySources` come from the line item's INVENTORY_SOURCE rows. */
export function youtubeFromRow(
  row: YoutubeRow,
  inventorySources: YtInventorySource[],
  sequenceSteps: number,
): YoutubeLiInput {
  const subtype = (row.ytSubtype ?? 'EFFICIENT_REACH') as YtSubtype;
  const info = YT_SUBTYPE_INFO[subtype];
  return {
    subtype,
    adFormats: surfacesToFormats(
      row.ytSurfaces.length ? (row.ytSurfaces as readonly YtSurface[]) : info.surfaces,
    ),
    viewCap:
      row.viewFreqMode === 'LIMITED'
        ? {
            mode: 'LIMITED',
            maxImpressions: row.viewFreqMax,
            periodCount: row.viewFreqUnitCount ?? 1,
            period: row.viewFreqUnit ?? 'WEEK',
          }
        : { ...NO_CAP },
    targetFrequency: info.targetFrequency
      ? {
          mode: 'LIMITED',
          maxImpressions: row.targetFreqExposures,
          periodCount: row.targetFreqUnitCount ?? 1,
          period: row.targetFreqUnit ?? 'WEEK',
        }
      : null,
    productFeed: row.productFeedEnabled,
    relatedVideoIds: row.relatedVideoIds,
    inventorySources,
    sequenceSteps,
  };
}

const int = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
};

/** Form section to LineItem columns (module 09 3.2). `subtype` is fixed after create (LI-YT-004), so callers pass the stored one. */
export function youtubeColumns(
  yt: YoutubeLiInput,
  subtype: YtSubtype,
): Pick<
  Prisma.LineItemUncheckedCreateInput,
  | 'ytSubtype'
  | 'ytSurfaces'
  | 'viewFreqMode'
  | 'viewFreqMax'
  | 'viewFreqUnit'
  | 'viewFreqUnitCount'
  | 'targetFreqExposures'
  | 'targetFreqUnit'
  | 'targetFreqUnitCount'
  | 'productFeedEnabled'
  | 'relatedVideoIds'
> {
  const info = YT_SUBTYPE_INFO[subtype];
  const view = yt.viewCap.mode === 'LIMITED' && info.viewCap;
  const target = info.targetFrequency ? yt.targetFrequency : null;
  return {
    ytSubtype: subtype,
    ytSurfaces: formatsToSurfaces(subtype, yt.adFormats),
    viewFreqMode: view ? 'LIMITED' : 'UNLIMITED',
    viewFreqMax: view ? int(yt.viewCap.maxImpressions) : null,
    viewFreqUnit: view ? (yt.viewCap.period ?? 'WEEK') : null,
    viewFreqUnitCount: view ? (int(yt.viewCap.periodCount) ?? 1) : null,
    targetFreqExposures: target ? int(target.maxImpressions) : null,
    targetFreqUnit: target ? (target.period ?? 'WEEK') : null,
    targetFreqUnitCount: target ? (int(target.periodCount) ?? 1) : null,
    productFeedEnabled: yt.productFeed,
    relatedVideoIds: [...new Set(yt.relatedVideoIds)],
  };
}
