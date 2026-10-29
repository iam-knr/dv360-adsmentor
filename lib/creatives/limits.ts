// MX-09b file limits and creative field constants (module 12 4.2, RC-007: 10 MB for HTML5, video and audio, 5 MB for
// everything else). Simulator values `[SIM]` (validation.md Q11). Native character limits are MX-16 candidates (Δ12-14).
export const CREATIVE_LIMITS = {
  IMAGE_MAX_BYTES: 150 * 1024,
  HTML5_MAX_BYTES: 10 * 1024 * 1024,
  VIDEO_MAX_BYTES: 10 * 1024 * 1024,
  AUDIO_MAX_BYTES: 10 * 1024 * 1024,
  OTHER_MAX_BYTES: 5 * 1024 * 1024,
  AUDIO_MIN_SEC: 5,
  AUDIO_MAX_SEC: 180,
  VIDEO_MIN_SEC: 5,
  VIDEO_MAX_SEC: 600,
  SKIP_MIN_VIDEO_SEC: 5,
  SKIP_DEFAULT_SEC: 5,
  NAME_MAX: 512,
  INTEGRATION_CODE_MAX_BYTES: 500,
  URL_MAX: 1024,
  NATIVE_HEADLINE_MAX: 25,
  NATIVE_BODY_MAX: 90,
  NATIVE_CTA_MAX: 15,
  NATIVE_ADVERTISER_MAX: 25,
  OPTIMIZED_HEADLINES_MAX: 5,
  OPTIMIZED_HEADLINE_CHARS: 30,
  OPTIMIZED_DESCRIPTIONS_MAX: 5,
  OPTIMIZED_DESCRIPTION_CHARS: 90,
  OPTIMIZED_IMAGES_MAX: 15,
  OPTIMIZED_LOGOS_MAX: 5,
  BULK_MAX_ROWS: 500,
  APPEAL_REASON_MAX: 1000,
  /** Companion banner sizes. */
  COMPANION_SIZES: [
    [300, 250],
    [728, 90],
  ] as readonly (readonly [number, number])[],
} as const;

export const IMAGE_MIME = ['image/gif', 'image/png', 'image/jpeg'] as const;
export const IMAGE_EXT = ['gif', 'png', 'jpg', 'jpeg'] as const;
export const AUDIO_MIME = ['audio/mpeg', 'audio/mp3', 'audio/ogg'] as const;
export const VIDEO_MIME = ['video/mp4', 'video/quicktime', 'video/webm'] as const;
export const ZIP_MIME = ['application/zip', 'application/x-zip-compressed'] as const;

export const extOf = (fileName: string): string => fileName.split('.').pop()?.toLowerCase() ?? '';
