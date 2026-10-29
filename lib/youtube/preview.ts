// Ad preview model (module 09 2.6, Δ-09-10, Y17). A pure function: no writes, no database. The service resolves the
// video and passes it in; the client calls it directly for the 300 ms refresh (4.3 item 7).
import {
  AD_FORMAT_LABEL,
  AD_FORMAT_ORDER,
  companionVisible,
  DEVICE_LABEL,
  deriveAdFormats,
  PREVIEW_MATRIX,
  previewComboValid,
  SURFACE_LABEL,
  type AdFormatKey,
  type PreviewDevice,
  type PreviewSurface,
  type YtSurface,
} from '@/lib/validation/constants/youtube';

export type FormatFilter = 'ALL' | 'IN_STREAM' | 'IN_FEED' | 'SHORTS';
export const FORMAT_FILTER_LABEL: Record<FormatFilter, string> = {
  ALL: 'All formats',
  IN_STREAM: 'In-stream',
  IN_FEED: 'In-feed video',
  SHORTS: 'Shorts',
};

export interface PreviewVideo {
  videoId: string;
  title: string;
  channelName: string;
  durationSec: number;
  orientation: 'HORIZONTAL' | 'VERTICAL';
  thumbnailUrl: string | null;
}

export interface PreviewDraft {
  video: PreviewVideo | null;
  headline?: string | null;
  longHeadline?: string | null;
  description?: string | null;
  callToAction?: string | null;
  businessName?: string | null;
  displayUrl?: string | null;
  logoUrl?: string | null;
  companionBannerUrl?: string | null;
  /** Ticks of the line item (LI-YT-005); formats outside them are not offered. Null: no restriction. */
  allowedSurfaces?: readonly YtSurface[] | null;
  nonSkippable?: boolean;
}

export interface PreviewSelection {
  filter: FormatFilter;
  format: AdFormatKey | null;
  device: PreviewDevice;
  surface: PreviewSurface;
}

export interface PreviewModel {
  formats: AdFormatKey[];
  selected: { format: AdFormatKey | null; device: PreviewDevice; surface: PreviewSurface };
  caption: string;
  frame: {
    orientation: 'HORIZONTAL' | 'VERTICAL';
    thumbnailUrl: string;
    durationSec: number;
    skippableAfterSec?: number;
    headline?: string;
    longHeadline?: string;
    description?: string;
    cta?: string;
    businessName?: string;
    displayUrl?: string;
    logoUrl?: string;
    companionBannerUrl?: string;
  };
  warnings: string[];
}

const SURFACE_OF_FORMAT: Record<AdFormatKey, YtSurface> = {
  IN_STREAM_SKIPPABLE: 'IN_STREAM',
  BUMPER: 'IN_STREAM',
  NON_SKIPPABLE_IN_STREAM: 'IN_STREAM',
  IN_FEED: 'IN_FEED',
  SHORTS: 'SHORTS',
};

const FILTER_OF_FORMAT: Record<AdFormatKey, Exclude<FormatFilter, 'ALL'>> = {
  IN_STREAM_SKIPPABLE: 'IN_STREAM',
  BUMPER: 'IN_STREAM',
  NON_SKIPPABLE_IN_STREAM: 'IN_STREAM',
  IN_FEED: 'IN_FEED',
  SHORTS: 'SHORTS',
};

export const PLACEHOLDER_THUMBNAIL = '/youtube/placeholder.svg';

/** Formats the video can serve, within the line item's ticks (the intersection of 2.6). */
export function availableFormats(draft: PreviewDraft): AdFormatKey[] {
  if (!draft.video) return [];
  const derived = deriveAdFormats(draft.video, { nonSkippable: !!draft.nonSkippable });
  const allowed = draft.allowedSurfaces;
  return derived.filter((f) => !allowed || allowed.includes(SURFACE_OF_FORMAT[f]));
}

/** Formats shown for the dropdown filter, in display order. */
export function formatsFor(draft: PreviewDraft, filter: FormatFilter): AdFormatKey[] {
  return availableFormats(draft).filter((f) => filter === 'ALL' || FILTER_OF_FORMAT[f] === filter);
}

/** V-09-04: the caption template `"{Device} example of your {format} ad on {surface}"`. */
export function previewCaption(
  format: AdFormatKey,
  device: PreviewDevice,
  surface: PreviewSurface,
): string {
  return `${DEVICE_LABEL[device]} example of your ${AD_FORMAT_LABEL[format]} ad on ${SURFACE_LABEL[surface]}`;
}

/** Y17. An invalid device or surface for the chosen format is moved to the first valid one and reported. */
export function buildPreviewModel(draft: PreviewDraft, sel: PreviewSelection): PreviewModel {
  const warnings: string[] = [];
  const formats = formatsFor(draft, sel.filter);
  const format = sel.format && formats.includes(sel.format) ? sel.format : (formats[0] ?? null);
  let { device, surface } = sel;
  if (format && !previewComboValid(format, device, surface)) {
    const row = PREVIEW_MATRIX[format];
    device = row.devices.includes(device) ? device : row.devices[0]!;
    surface = row.surfaces.includes(surface) ? surface : row.surfaces[0]!;
  }
  if (draft.video && formats.length === 0) {
    const horizontal = draft.video.orientation === 'HORIZONTAL';
    warnings.push(
      horizontal && sel.filter === 'SHORTS'
        ? "This video can't serve as a Shorts ad because it is horizontal"
        : "This video can't serve in the selected ad formats.",
    );
  }
  const v = draft.video;
  const frame: PreviewModel['frame'] = {
    orientation: v?.orientation ?? 'HORIZONTAL',
    thumbnailUrl: v?.thumbnailUrl ?? PLACEHOLDER_THUMBNAIL,
    durationSec: v?.durationSec ?? 0,
    ...(format === 'IN_STREAM_SKIPPABLE' ? { skippableAfterSec: 5 } : {}),
    ...(draft.headline ? { headline: draft.headline } : {}),
    ...(draft.longHeadline ? { longHeadline: draft.longHeadline } : {}),
    ...(draft.description ? { description: draft.description } : {}),
    ...(draft.callToAction ? { cta: draft.callToAction } : {}),
    ...(draft.businessName ? { businessName: draft.businessName } : {}),
    ...(draft.displayUrl ? { displayUrl: draft.displayUrl } : {}),
    ...(draft.logoUrl ? { logoUrl: draft.logoUrl } : {}),
    ...(draft.companionBannerUrl && format && companionVisible(format, device)
      ? { companionBannerUrl: draft.companionBannerUrl }
      : {}),
  };
  return {
    formats: AD_FORMAT_ORDER.filter((f) => formats.includes(f)),
    selected: { format, device, surface },
    caption: format ? previewCaption(format, device, surface) : '',
    frame,
    warnings,
  };
}
