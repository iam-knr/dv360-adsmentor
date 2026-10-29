// MX-07 YouTube & partners subtypes and the pure helpers of module 09 (2.6, 2.7). Pure and client safe.
// Keys follow RC-005 (the DM keys). `(from public docs)` cells of MX-07 are marked [SIM] in the labels.

export type YtOptimization = 'REACH' | 'TARGET_FREQUENCY' | 'TRUEVIEW_VIEWS' | 'AD_SEQUENCE';
export type YtAdFormatChoice = 'EFFICIENT' | 'NON_SKIPPABLE' | 'ALL_FORMATS' | 'IN_STREAM_ONLY';

export type YtSubtype =
  | 'EFFICIENT_REACH'
  | 'NON_SKIPPABLE_REACH'
  | 'TARGET_FREQUENCY'
  | 'TARGET_FREQUENCY_IN_STREAM'
  | 'TRUEVIEW_VIEWS'
  | 'AD_SEQUENCE'
  | 'AUDIO_REACH';

export const YT_SUBTYPES: readonly YtSubtype[] = [
  'EFFICIENT_REACH',
  'NON_SKIPPABLE_REACH',
  'TARGET_FREQUENCY',
  'TARGET_FREQUENCY_IN_STREAM',
  'TRUEVIEW_VIEWS',
  'AD_SEQUENCE',
  'AUDIO_REACH',
];

export type YtBidKind = 'TARGET_CPM' | 'MAX_CPV';
export type YtLiBidStrategy = 'MAX_REACH' | 'TARGET_CPM' | 'MAX_CPV';
export type YtSurface = 'IN_STREAM' | 'IN_FEED' | 'SHORTS';

export interface YtSubtypeInfo {
  optimization: YtOptimization;
  choice: YtAdFormatChoice | null;
  /** Step 2 "Line item subtype" line. */
  line: string;
  /** Format checkboxes shown in step 2 (LI-YT-005 applies when `pickable`). */
  surfaces: readonly YtSurface[];
  pickable: boolean;
  liBid: YtLiBidStrategy;
  /** Ad group bid field (AG-003, AG-004). */
  adGroupBid: YtBidKind;
  /** Target frequency block with a required exposure target (LI-YT-012). */
  targetFrequency: boolean;
  /** Exposure cap and view cap blocks. Ad sequence and target frequency use the exposure cap only. */
  viewCap: boolean;
}

const ALL_SURFACES: readonly YtSurface[] = ['IN_STREAM', 'IN_FEED', 'SHORTS'];

export const YT_SUBTYPE_INFO: Record<YtSubtype, YtSubtypeInfo> = {
  EFFICIENT_REACH: {
    optimization: 'REACH',
    choice: 'EFFICIENT',
    line: 'Efficient reach (help) — Reach people using bumper, skippable, in-feed, or Shorts ads.',
    surfaces: ALL_SURFACES,
    pickable: true,
    liBid: 'MAX_REACH',
    adGroupBid: 'TARGET_CPM',
    targetFrequency: false,
    viewCap: true,
  },
  NON_SKIPPABLE_REACH: {
    optimization: 'REACH',
    choice: 'NON_SKIPPABLE',
    line: 'Non-skippable reach (help) — [SIM] Reach people using a mix of non-skippable ads of 5 to 30 seconds.',
    surfaces: ['IN_STREAM'],
    pickable: false,
    liBid: 'MAX_REACH',
    adGroupBid: 'TARGET_CPM',
    targetFrequency: false,
    viewCap: true,
  },
  TARGET_FREQUENCY: {
    optimization: 'TARGET_FREQUENCY',
    choice: 'ALL_FORMATS',
    line: 'Target frequency (help) — [SIM] Reach the same people multiple times using bumper, skippable, in-feed, or Shorts ads.',
    surfaces: ALL_SURFACES,
    pickable: true,
    liBid: 'TARGET_CPM',
    adGroupBid: 'TARGET_CPM',
    targetFrequency: true,
    viewCap: false,
  },
  TARGET_FREQUENCY_IN_STREAM: {
    optimization: 'TARGET_FREQUENCY',
    choice: 'IN_STREAM_ONLY',
    line: 'Target frequency, in-stream only (help) — [SIM] Reach the same people multiple times using in-stream ads.',
    surfaces: ['IN_STREAM'],
    pickable: false,
    liBid: 'TARGET_CPM',
    adGroupBid: 'TARGET_CPM',
    targetFrequency: true,
    viewCap: false,
  },
  TRUEVIEW_VIEWS: {
    optimization: 'TRUEVIEW_VIEWS',
    choice: null,
    line: 'TrueView views (help) — [SIM] Drive as many TrueView views as possible.',
    surfaces: ['IN_STREAM', 'IN_FEED'],
    pickable: false,
    liBid: 'MAX_CPV',
    adGroupBid: 'MAX_CPV',
    targetFrequency: false,
    viewCap: true,
  },
  AD_SEQUENCE: {
    optimization: 'AD_SEQUENCE',
    choice: null,
    line: 'Ad sequence (help) — [SIM] Tell a story by showing ads in a sequence.',
    surfaces: ALL_SURFACES,
    pickable: false,
    liBid: 'TARGET_CPM',
    adGroupBid: 'TARGET_CPM',
    targetFrequency: false,
    viewCap: false,
  },
  AUDIO_REACH: {
    optimization: 'REACH',
    choice: null,
    line: 'Audio reach (help) — [SIM] Reach people with audio ads.',
    surfaces: ['IN_STREAM'],
    pickable: false,
    liBid: 'MAX_REACH',
    adGroupBid: 'TARGET_CPM',
    targetFrequency: false,
    viewCap: true,
  },
};

/** Text of the step 2 line without the `[SIM]` marker the spec uses for sign-off. */
export function subtypeLine(subtype: YtSubtype): string {
  return YT_SUBTYPE_INFO[subtype].line.replace('[SIM] ', '');
}

/** V-09-01: step 1 choice to the subtype key (2.7). Null when the choice does not fit the optimization (LI-YT-003). */
export function subtypeFrom(
  optimization: YtOptimization | null | undefined,
  choice: YtAdFormatChoice | null | undefined,
  audio = false,
): YtSubtype | null {
  if (audio) return 'AUDIO_REACH';
  switch (optimization) {
    case 'REACH':
      if (choice === 'NON_SKIPPABLE') return 'NON_SKIPPABLE_REACH';
      return choice === 'EFFICIENT' || !choice ? 'EFFICIENT_REACH' : null;
    case 'TARGET_FREQUENCY':
      if (choice === 'IN_STREAM_ONLY') return 'TARGET_FREQUENCY_IN_STREAM';
      return choice === 'ALL_FORMATS' || !choice ? 'TARGET_FREQUENCY' : null;
    case 'TRUEVIEW_VIEWS':
      return choice ? null : 'TRUEVIEW_VIEWS';
    case 'AD_SEQUENCE':
      return choice ? null : 'AD_SEQUENCE';
    default:
      return null;
  }
}

/** Inverse of `subtypeFrom`, for the step 1 URL (`optimization=REACH&format=EFFICIENT`, RT 6.1). */
export function step1Of(subtype: YtSubtype): {
  optimization: YtOptimization;
  choice: YtAdFormatChoice | null;
} {
  const info = YT_SUBTYPE_INFO[subtype];
  return { optimization: info.optimization, choice: info.choice };
}

export const YT_INVENTORY_SOURCES = ['YOUTUBE', 'GOOGLE_TV', 'VIDEO_PARTNERS'] as const;
export type YtInventorySource = (typeof YT_INVENTORY_SOURCES)[number];
export const YT_INVENTORY_LABEL: Record<YtInventorySource, string> = {
  YOUTUBE: 'YouTube',
  GOOGLE_TV: 'Google TV',
  VIDEO_PARTNERS: 'Video partners',
};

export const YT_SURFACE_LABEL: Record<YtSurface, string> = {
  IN_STREAM: 'In-stream ads (skippable, bumper)',
  IN_FEED: 'In-feed ads',
  SHORTS: 'Shorts ads',
};

// ---------------------------------------------------------------------------------------------
// Ad formats derived from the video (2.7) and the preview matrix (2.6)
// ---------------------------------------------------------------------------------------------

export type AdFormatKey =
  | 'IN_STREAM_SKIPPABLE'
  | 'BUMPER'
  | 'NON_SKIPPABLE_IN_STREAM'
  | 'IN_FEED'
  | 'SHORTS';

/** Lower case words for the caption `... example of your {format} ad on ...`. */
export const AD_FORMAT_LABEL: Record<AdFormatKey, string> = {
  IN_STREAM_SKIPPABLE: 'skippable in-stream',
  BUMPER: 'bumper',
  NON_SKIPPABLE_IN_STREAM: 'non-skippable in-stream',
  IN_FEED: 'in-feed video',
  SHORTS: 'Shorts',
};

export const AD_FORMAT_ORDER: readonly AdFormatKey[] = [
  'IN_STREAM_SKIPPABLE',
  'BUMPER',
  'NON_SKIPPABLE_IN_STREAM',
  'IN_FEED',
  'SHORTS',
];

export interface VideoShape {
  orientation: 'HORIZONTAL' | 'VERTICAL';
  durationSec: number;
}

/**
 * V-09-02: formats a video can serve. Boundaries: 6 s bumper, 10 s skippable, 60 s, vertical 5 s.
 * `nonSkippable` is the row for non-skippable line items (5 to 30 s horizontal): it replaces the others.
 */
export function deriveAdFormats(
  video: VideoShape,
  opts: { nonSkippable?: boolean } = {},
): AdFormatKey[] {
  const d = video.durationSec;
  if (opts.nonSkippable)
    return video.orientation === 'HORIZONTAL' && d >= 5 && d <= 30 ? ['NON_SKIPPABLE_IN_STREAM'] : [];
  if (video.orientation === 'VERTICAL') return d >= 5 && d <= 60 ? ['SHORTS'] : [];
  const out: AdFormatKey[] = [];
  if (d <= 6) out.push('BUMPER');
  if (d >= 10 && d <= 60) out.push('IN_STREAM_SKIPPABLE');
  if (d > 6) out.push('IN_FEED');
  return AD_FORMAT_ORDER.filter((f) => out.includes(f));
}

export type PreviewDevice = 'PHONE' | 'COMPUTER' | 'TV';
export type PreviewSurface = 'YOUTUBE' | 'VIDEO_PARTNERS' | 'GOOGLE_TV';

export const DEVICE_LABEL: Record<PreviewDevice, string> = {
  PHONE: 'Mobile phone',
  COMPUTER: 'Computer',
  TV: 'TV',
};
export const SURFACE_LABEL: Record<PreviewSurface, string> = {
  YOUTUBE: 'YouTube',
  VIDEO_PARTNERS: 'Google video partners',
  GOOGLE_TV: 'Google TV',
};
export const DEVICES: readonly PreviewDevice[] = ['PHONE', 'COMPUTER', 'TV'];
export const SURFACES: readonly PreviewSurface[] = ['YOUTUBE', 'VIDEO_PARTNERS', 'GOOGLE_TV'];

interface MatrixRow {
  devices: readonly PreviewDevice[];
  surfaces: readonly PreviewSurface[];
}
const EVERYWHERE: MatrixRow = { devices: DEVICES, surfaces: SURFACES };

/** The availability matrix of 2.6. */
export const PREVIEW_MATRIX: Record<AdFormatKey, MatrixRow> = {
  IN_STREAM_SKIPPABLE: EVERYWHERE,
  BUMPER: EVERYWHERE,
  NON_SKIPPABLE_IN_STREAM: EVERYWHERE,
  IN_FEED: { devices: ['PHONE', 'COMPUTER'], surfaces: ['YOUTUBE'] },
  SHORTS: { devices: ['PHONE'], surfaces: ['YOUTUBE'] },
};

/** V-09-05: a combination the matrix allows. */
export function previewComboValid(
  format: AdFormatKey,
  device: PreviewDevice,
  surface: PreviewSurface,
): boolean {
  const row = PREVIEW_MATRIX[format];
  return row.devices.includes(device) && row.surfaces.includes(surface);
}

/** Companion banners show for computer in-stream previews only (AC-09-15). */
export function companionVisible(format: AdFormatKey, device: PreviewDevice): boolean {
  return device === 'COMPUTER' && format !== 'IN_FEED' && format !== 'SHORTS';
}

// ---------------------------------------------------------------------------------------------
// Video references (Y16, V-09-03)
// ---------------------------------------------------------------------------------------------

const ID11 = /^[A-Za-z0-9_-]{11}$/;

/** Watch URL, youtu.be, shorts or embed URL, or a plain 11-character id. Null for anything else. */
export function parseYoutubeRef(input: string | null | undefined): string | null {
  const text = (input ?? '').trim();
  if (ID11.test(text)) return text;
  if (!text) return null;
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`);
    const host = url.hostname.replace(/^(www|m)\./, '');
    let candidate = '';
    if (host === 'youtu.be') candidate = url.pathname.split('/').filter(Boolean)[0] ?? '';
    else if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      const parts = url.pathname.split('/').filter(Boolean);
      candidate =
        url.searchParams.get('v') ??
        (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live' ? (parts[1] ?? '') : '');
    }
    return ID11.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Landing page URL protocol merge (AC form logic 6, V-09-15)
// ---------------------------------------------------------------------------------------------

export type UrlProtocol = 'http://' | 'https://';

/** Protocol dropdown and typed value combined. A typed value with its own scheme wins. */
export function mergeUrl(protocol: UrlProtocol, typed: string | null | undefined): string {
  const text = (typed ?? '').trim();
  if (!text) return '';
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `${protocol}${text}`;
}
