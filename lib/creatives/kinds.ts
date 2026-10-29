// The three-way creative kind map (RC-007, module 12 C1): wire `?kind=` and `type`/`hostingSrc` codes, the database
// `CreativeKind`, and the validation MX-09 format key. Pure.
import type { CreativeKind } from '@prisma/client';
import type { CreativeFormat } from '@/lib/validation/constants/creatives';

export const CREATIVE_KINDS = [
  'THIRD_PARTY_DISPLAY',
  'THIRD_PARTY_VIDEO',
  'THIRD_PARTY_AUDIO',
  'STANDARD_IMAGE',
  'STANDARD_HTML5',
  'VIDEO_FILE',
  'YOUTUBE_VIDEO',
  'AUDIO_FILE',
  'NATIVE_SITE',
  'NATIVE_VIDEO',
] as const satisfies readonly CreativeKind[];

export interface KindMeta {
  /** `?kind=` value (module 12 section 2, proposed codes). */
  wire: string;
  /** `type` and `hostingSrc` query codes. */
  type: number;
  hostingSrc: number;
  mx09: CreativeFormat;
  /** "New {label} creative". */
  label: string;
  /** Format column text. */
  format: string;
  /** Type column text ("Standard" for uploads, native, video, audio, YouTube). */
  typeLabel: 'Standard' | 'Third party';
  /** File families: which main asset the kind needs. */
  asset: 'image-or-html5' | 'video' | 'audio' | null;
  /** Line item types are decided by MX-09; this is the media family used for placeholders and previews. */
  media: 'display' | 'video' | 'audio';
}

export const KIND_META: Record<CreativeKind, KindMeta> = {
  THIRD_PARTY_DISPLAY: {
    wire: 'third-party-display',
    type: 0,
    hostingSrc: 1,
    mx09: 'TP_DISPLAY',
    label: 'third-party display',
    format: 'Third-party display',
    typeLabel: 'Third party',
    asset: null,
    media: 'display',
  },
  THIRD_PARTY_VIDEO: {
    wire: 'third-party-video',
    type: 1,
    hostingSrc: 1,
    mx09: 'TP_VIDEO',
    label: 'third-party video',
    format: 'Third-party video',
    typeLabel: 'Third party',
    asset: null,
    media: 'video',
  },
  THIRD_PARTY_AUDIO: {
    wire: 'third-party-audio',
    type: 2,
    hostingSrc: 1,
    mx09: 'TP_AUDIO',
    label: 'third-party audio',
    format: 'Third-party audio',
    typeLabel: 'Third party',
    asset: null,
    media: 'audio',
  },
  STANDARD_IMAGE: {
    wire: 'upload-image',
    type: 0,
    hostingSrc: 0,
    mx09: 'IMAGE',
    label: 'image',
    format: 'Image',
    typeLabel: 'Standard',
    asset: 'image-or-html5',
    media: 'display',
  },
  STANDARD_HTML5: {
    wire: 'upload-html5',
    type: 0,
    hostingSrc: 0,
    mx09: 'HTML5',
    label: 'HTML5',
    format: 'HTML5',
    typeLabel: 'Standard',
    asset: 'image-or-html5',
    media: 'display',
  },
  VIDEO_FILE: {
    wire: 'upload-video',
    type: 1,
    hostingSrc: 0,
    mx09: 'VIDEO_FILE',
    label: 'video',
    format: 'Video',
    typeLabel: 'Standard',
    asset: 'video',
    media: 'video',
  },
  YOUTUBE_VIDEO: {
    wire: 'youtube-video',
    type: 1,
    hostingSrc: 2,
    mx09: 'YOUTUBE_VIDEO',
    label: 'YouTube video',
    format: 'YouTube video',
    typeLabel: 'Standard',
    asset: null,
    media: 'video',
  },
  AUDIO_FILE: {
    wire: 'upload-audio',
    type: 2,
    hostingSrc: 0,
    mx09: 'AUDIO_FILE',
    label: 'audio',
    format: 'Audio',
    typeLabel: 'Standard',
    asset: 'audio',
    media: 'audio',
  },
  NATIVE_SITE: {
    wire: 'native-site',
    type: 3,
    hostingSrc: 0,
    mx09: 'NATIVE_SITE',
    label: 'native site',
    format: 'Native site',
    typeLabel: 'Standard',
    asset: null,
    media: 'display',
  },
  NATIVE_VIDEO: {
    wire: 'native-video',
    type: 4,
    hostingSrc: 0,
    mx09: 'NATIVE_VIDEO',
    label: 'native video',
    format: 'Native video',
    typeLabel: 'Standard',
    asset: null,
    media: 'video',
  },
};

/** Optimized is NATIVE_SITE plus `formatKey = OPTIMIZED` (module 12 Q3). */
export const OPTIMIZED_WIRE = 'format-optimized';
export const OPTIMIZED_HOSTING_SRC = 3;

export interface ResolvedKind {
  kind: CreativeKind;
  formatKey: string | null;
}

/** `?kind=` is always accepted; otherwise `type` and `hostingSrc`. Unknown values give null (the page renders 404). */
export function resolveKind(params: {
  kind?: string | null;
  type?: string | null;
  hostingSrc?: string | null;
}): ResolvedKind | null {
  if (params.kind) {
    if (params.kind === OPTIMIZED_WIRE) return { kind: 'NATIVE_SITE', formatKey: 'OPTIMIZED' };
    const hit = CREATIVE_KINDS.find((k) => KIND_META[k].wire === params.kind);
    return hit ? { kind: hit, formatKey: null } : null;
  }
  if (params.type === undefined || params.type === null) return null;
  const type = Number(params.type);
  const src = Number(params.hostingSrc ?? 0);
  if (type === 3 && src === OPTIMIZED_HOSTING_SRC)
    return { kind: 'NATIVE_SITE', formatKey: 'OPTIMIZED' };
  const hit = CREATIVE_KINDS.find(
    (k) => KIND_META[k].type === type && KIND_META[k].hostingSrc === src,
  );
  return hit ? { kind: hit, formatKey: null } : null;
}

export function wireKindOf(kind: CreativeKind, formatKey?: string | null): string {
  return kind === 'NATIVE_SITE' && formatKey === 'OPTIMIZED'
    ? OPTIMIZED_WIRE
    : KIND_META[kind].wire;
}

export function mx09FormatOf(kind: CreativeKind): CreativeFormat {
  return KIND_META[kind].mx09;
}

/** Format column text; Optimized shows its own label. */
export function formatLabel(kind: CreativeKind, formatKey?: string | null): string {
  return kind === 'NATIVE_SITE' && formatKey === 'OPTIMIZED' ? 'Optimized' : KIND_META[kind].format;
}

export const isThirdPartyKind = (k: CreativeKind): boolean =>
  KIND_META[k].typeLabel === 'Third party';

export const NATIVE_KINDS: readonly CreativeKind[] = ['NATIVE_SITE', 'NATIVE_VIDEO'];

/** AI label (CRE-030) is on every kind but the third-party tags (module 12 Q6). */
export const hasAiLabel = (k: CreativeKind): boolean => !isThirdPartyKind(k);
