// Creative pool of one advertiser: minimal placeholder creatives with per-exchange reviews (module 08 3.4, data-model 3.3).
import type { Format } from './types';

export type PoolKind = 'display' | 'video' | 'ctv' | 'audio' | 'dooh';

export interface CreativeSpec {
  slug: string;
  pool: PoolKind;
  kind: 'STANDARD_IMAGE' | 'STANDARD_HTML5' | 'VIDEO_FILE' | 'AUDIO_FILE';
  width: number;
  height: number;
  durationSeconds: number | null;
  mime: string;
  sizeBytes: number;
  label: string;
}

/** Order of the first fifteen creatives; knobs.creativesPerAdvertiser takes a prefix and repeats with a counter after that. */
const MIX: readonly Omit<CreativeSpec, 'slug'>[] = [
  {
    pool: 'display',
    kind: 'STANDARD_IMAGE',
    width: 300,
    height: 250,
    durationSeconds: null,
    mime: 'image/png',
    sizeBytes: 38_400,
    label: 'Medium rectangle',
  },
  {
    pool: 'display',
    kind: 'STANDARD_IMAGE',
    width: 728,
    height: 90,
    durationSeconds: null,
    mime: 'image/png',
    sizeBytes: 29_800,
    label: 'Leaderboard',
  },
  {
    pool: 'display',
    kind: 'STANDARD_IMAGE',
    width: 320,
    height: 50,
    durationSeconds: null,
    mime: 'image/png',
    sizeBytes: 14_200,
    label: 'Mobile banner',
  },
  {
    pool: 'display',
    kind: 'STANDARD_IMAGE',
    width: 970,
    height: 250,
    durationSeconds: null,
    mime: 'image/png',
    sizeBytes: 66_500,
    label: 'Billboard',
  },
  {
    pool: 'display',
    kind: 'STANDARD_IMAGE',
    width: 160,
    height: 600,
    durationSeconds: null,
    mime: 'image/png',
    sizeBytes: 41_000,
    label: 'Wide skyscraper',
  },
  {
    pool: 'display',
    kind: 'STANDARD_HTML5',
    width: 300,
    height: 250,
    durationSeconds: null,
    mime: 'application/zip',
    sizeBytes: 182_000,
    label: 'HTML5 rectangle',
  },
  {
    pool: 'display',
    kind: 'STANDARD_IMAGE',
    width: 300,
    height: 600,
    durationSeconds: null,
    mime: 'image/png',
    sizeBytes: 71_200,
    label: 'Half page',
  },
  {
    pool: 'video',
    kind: 'VIDEO_FILE',
    width: 1280,
    height: 720,
    durationSeconds: 15,
    mime: 'video/mp4',
    sizeBytes: 3_100_000,
    label: 'Video 15s',
  },
  {
    pool: 'video',
    kind: 'VIDEO_FILE',
    width: 1280,
    height: 720,
    durationSeconds: 30,
    mime: 'video/mp4',
    sizeBytes: 5_900_000,
    label: 'Video 30s',
  },
  {
    pool: 'ctv',
    kind: 'VIDEO_FILE',
    width: 1920,
    height: 1080,
    durationSeconds: 30,
    mime: 'video/mp4',
    sizeBytes: 11_400_000,
    label: 'CTV 30s',
  },
  {
    pool: 'ctv',
    kind: 'VIDEO_FILE',
    width: 1920,
    height: 1080,
    durationSeconds: 15,
    mime: 'video/mp4',
    sizeBytes: 6_300_000,
    label: 'CTV 15s',
  },
  {
    pool: 'audio',
    kind: 'AUDIO_FILE',
    width: 0,
    height: 0,
    durationSeconds: 30,
    mime: 'audio/mpeg',
    sizeBytes: 480_000,
    label: 'Audio 30s',
  },
  {
    pool: 'dooh',
    kind: 'STANDARD_IMAGE',
    width: 1920,
    height: 1080,
    durationSeconds: null,
    mime: 'image/png',
    sizeBytes: 210_000,
    label: 'DOOH landscape',
  },
  {
    pool: 'video',
    kind: 'VIDEO_FILE',
    width: 1280,
    height: 720,
    durationSeconds: 6,
    mime: 'video/mp4',
    sizeBytes: 1_300_000,
    label: 'Bumper 6s',
  },
  {
    pool: 'display',
    kind: 'STANDARD_IMAGE',
    width: 336,
    height: 280,
    durationSeconds: null,
    mime: 'image/png',
    sizeBytes: 36_100,
    label: 'Large rectangle',
  },
];

export function creativeSpecs(count: number): CreativeSpec[] {
  const out: CreativeSpec[] = [];
  for (let i = 0; i < count; i++) {
    const base = MIX[i % MIX.length] as Omit<CreativeSpec, 'slug'>;
    const round = Math.floor(i / MIX.length);
    out.push({
      ...base,
      slug: `cr${i}`,
      label: round === 0 ? base.label : `${base.label} v${round + 1}`,
    });
  }
  return out;
}

/** A banner size that is in none of the engine slot sizes (engine.md 3.4): used by the size-mismatch story. */
export const LEGACY_BANNER: Omit<CreativeSpec, 'slug'> = {
  pool: 'display',
  kind: 'STANDARD_IMAGE',
  width: 468,
  height: 60,
  durationSeconds: null,
  mime: 'image/png',
  sizeBytes: 21_000,
  label: 'Legacy banner',
};

export function poolForFormat(format: Format, type: string): PoolKind {
  if (type === 'DOOH_DISPLAY' || type === 'DOOH_VIDEO' || format === 'dooh') return 'dooh';
  if (format === 'ctv') return 'ctv';
  if (format === 'audio') return 'audio';
  if (format === 'video_instream') return 'video';
  return 'display';
}

export function formatForType(type: string): Format {
  switch (type) {
    case 'VIDEO':
    case 'YT_VIDEO':
      return 'video_instream';
    case 'CTV':
    case 'YT_ON_CTV':
      return 'ctv';
    case 'AUDIO':
    case 'YT_AUDIO':
      return 'audio';
    case 'DOOH_DISPLAY':
    case 'DOOH_VIDEO':
      return 'dooh';
    default:
      return 'display';
  }
}
