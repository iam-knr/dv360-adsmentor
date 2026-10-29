// Valid creative inputs per kind and a rule runner, shared by the creative tests.
import { validate } from '@/lib/validation/engine';
import { makeCtx } from '@/lib/validation/testing/fixtures';
import type { CreativeAssetInput, CreativeInput, Issue } from '@/lib/validation/types';

export const png = (over: Partial<CreativeAssetInput> = {}): CreativeAssetInput => ({
  fileName: 'banner.png',
  mimeType: 'image/png',
  sizeBytes: 40_000,
  width: 300,
  height: 250,
  ...over,
});

export const TAG =
  '<a href="${CLICK_URL}https://example.com"><img src="https://example.com/ad.png"></a>';

export const valid: Record<string, CreativeInput> = {
  THIRD_PARTY_DISPLAY: {
    kind: 'THIRD_PARTY_DISPLAY',
    name: 'Third party banner',
    landingPageUrl: 'https://example.com/landing',
    width: 300,
    height: 250,
    thirdPartyTag: TAG,
  },
  STANDARD_IMAGE: {
    kind: 'STANDARD_IMAGE',
    name: 'Image',
    landingPageUrl: 'https://example.com',
    mainAsset: png(),
  },
  STANDARD_HTML5: {
    kind: 'STANDARD_HTML5',
    name: 'HTML5',
    landingPageUrl: 'https://example.com',
    mainAsset: {
      fileName: 'ad.zip',
      mimeType: 'application/zip',
      sizeBytes: 90_000,
      entryHtml: true,
    },
  },
  VIDEO_FILE: {
    kind: 'VIDEO_FILE',
    name: 'Video',
    landingPageUrl: 'https://example.com',
    mainAsset: {
      fileName: 'spot.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 2_000_000,
      durationSeconds: 15,
    },
  },
  AUDIO_FILE: {
    kind: 'AUDIO_FILE',
    name: 'Audio',
    mainAsset: {
      fileName: 'jingle.mp3',
      mimeType: 'audio/mpeg',
      sizeBytes: 400_000,
      durationSeconds: 30,
    },
  },
  YOUTUBE_VIDEO: {
    kind: 'YOUTUBE_VIDEO',
    name: 'YouTube',
    landingPageUrl: 'https://example.com',
    youtubeVideo: 'dQw4w9WgXcQ',
  },
  THIRD_PARTY_VIDEO: {
    kind: 'THIRD_PARTY_VIDEO',
    name: 'VAST video',
    vastTag: 'https://example.com/vast.xml',
    durationSeconds: 15,
  },
  THIRD_PARTY_AUDIO: {
    kind: 'THIRD_PARTY_AUDIO',
    name: 'VAST audio',
    vastTag: 'https://example.com/vast.xml',
    durationSeconds: 30,
  },
  NATIVE_SITE: {
    kind: 'NATIVE_SITE',
    name: 'Native',
    landingPageUrl: 'https://example.com',
    native: {
      headline: 'Headline',
      body: 'Body',
      callToAction: 'Learn more',
      advertiserName: 'Brand',
      displayUrl: 'example.com',
    },
    mainAsset: png({ width: 1200, height: 628 }),
    logoAsset: png({ fileName: 'logo.png', width: 128, height: 128 }),
  },
};

export function run(
  input: CreativeInput,
  opts: {
    mode?: 'create' | 'edit';
    original?: unknown;
    trigger?: 'save' | 'blur';
    changedPath?: string;
  } = {},
): Issue[] {
  return validate(
    'creative',
    input,
    makeCtx({ mode: opts.mode ?? 'create', ...(opts.original ? { original: opts.original } : {}) }),
    {
      trigger: opts.trigger ?? 'save',
      ...(opts.changedPath ? { changedPath: opts.changedPath } : {}),
    },
  );
}

export const ids = (issues: Issue[], severity?: Issue['severity']): string[] =>
  issues.filter((i) => !severity || i.severity === severity).map((i) => i.ruleId);
