// CRE rules: creatives (validation.md 2.18, module 12 4.4). CRE-100..104 are the module's additions (RC-053).
import {
  CREATIVE_LIMITS,
  extOf,
  AUDIO_MIME,
  IMAGE_EXT,
  IMAGE_MIME,
  VIDEO_MIME,
} from '@/lib/creatives/limits';
import { parseVast } from '@/lib/creatives/vast';
import { MSG } from '../messages';
import { byteLength, codePointLength, isBlank, isUrl, toNum } from '../primitives';
import { isStandardDisplaySize } from '../constants/creatives';
import type {
  AnyRule,
  CreativeAssetInput,
  CreativeInput,
  CreativeKindKey,
  Rule,
  Violation,
} from '../types';
import { originalOf } from './shared';

type CreativeRule = Omit<Rule<CreativeInput>, 'kind'>;

function def(rule: CreativeRule): Rule<CreativeInput> {
  return { kind: 'creative', ...rule };
}

const is = (c: CreativeInput, ...kinds: CreativeKindKey[]): boolean => kinds.includes(c.kind);
const DISPLAY_SIZED: CreativeKindKey[] = [
  'THIRD_PARTY_DISPLAY',
  'STANDARD_IMAGE',
  'STANDARD_HTML5',
];
const PREFILL = /^https?:\/\/$/i;

const CLICK_MACRO = /\$\{CLICK_URL[A-Z_]*\}|%%CLICK_URL[A-Z_]*%%|\[CLICK_URL\]|\{CLICK_URL\}/i;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/** 11-character id from an id, watch URL, short URL or embed URL; null when none. */
export function youtubeIdOf(input: string | null | undefined): string | null {
  const text = (input ?? '').trim();
  if (YOUTUBE_ID.test(text)) return text;
  try {
    const url = new URL(text);
    const host = url.hostname.replace(/^www\./, '');
    const candidate =
      host === 'youtu.be'
        ? url.pathname.slice(1)
        : host.endsWith('youtube.com')
          ? (url.searchParams.get('v') ?? url.pathname.split('/').filter(Boolean).pop() ?? '')
          : '';
    return YOUTUBE_ID.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function dims(c: CreativeInput): { w: number | null; h: number | null } {
  return { w: toNum(c.width), h: toNum(c.height) };
}

export const CRE_001 = def({
  id: 'CRE-001',
  severity: 'error',
  triggers: ['blur', 'save'],
  reads: ['name'],
  message: MSG.ENTER_VALUE,
  check: (c) => (isBlank(c.name) ? { path: 'name' } : null),
});

export const CRE_002 = def({
  id: 'CRE-002',
  severity: 'error',
  triggers: ['save'],
  reads: ['name'],
  message: MSG.MAX_CHARS,
  check: (c) =>
    codePointLength(c.name ?? '') > CREATIVE_LIMITS.NAME_MAX
      ? { path: 'name', params: { max: CREATIVE_LIMITS.NAME_MAX } }
      : null,
});

export const CRE_003 = def({
  id: 'CRE-003',
  severity: 'error',
  triggers: ['blur', 'save'],
  reads: ['width', 'height'],
  message: MSG.CRE_SIZE,
  appliesTo: (c) => is(c, 'THIRD_PARTY_DISPLAY'),
  check: (c) => {
    const { w, h } = dims(c);
    return w === null || h === null || w <= 0 || h <= 0 ? { path: 'width' } : null;
  },
});

/** Landing page is required where the click goes nowhere else; VAST and audio carry or skip it. */
const LANDING_REQUIRED: CreativeKindKey[] = [
  'THIRD_PARTY_DISPLAY',
  'STANDARD_IMAGE',
  'STANDARD_HTML5',
  'VIDEO_FILE',
  'YOUTUBE_VIDEO',
  'NATIVE_SITE',
  'NATIVE_VIDEO',
];

export const CRE_004 = def({
  id: 'CRE-004',
  severity: 'error',
  triggers: ['blur', 'save'],
  reads: ['landingPageUrl'],
  message: MSG.VALID_URL,
  check: (c) => {
    const url = (c.landingPageUrl ?? '').trim();
    const empty = url === '' || PREFILL.test(url);
    if (empty)
      return is(c, ...LANDING_REQUIRED)
        ? { path: 'landingPageUrl', message: MSG.ENTER_VALUE }
        : null;
    return isUrl(url, CREATIVE_LIMITS.URL_MAX) ? null : { path: 'landingPageUrl' };
  },
});

export const CRE_005 = def({
  id: 'CRE-005',
  severity: 'error',
  triggers: ['save'],
  reads: ['thirdPartyTag'],
  message: MSG.ENTER_VALUE,
  appliesTo: (c) => is(c, 'THIRD_PARTY_DISPLAY'),
  check: (c) => (isBlank(c.thirdPartyTag) ? { path: 'thirdPartyTag' } : null),
});

export const CRE_006 = def({
  id: 'CRE-006',
  severity: 'warning',
  triggers: ['blur'],
  reads: ['thirdPartyTag'],
  message: MSG.CRE_NO_CLICK_MACRO,
  appliesTo: (c) => is(c, 'THIRD_PARTY_DISPLAY') && !isBlank(c.thirdPartyTag),
  check: (c) => (CLICK_MACRO.test(c.thirdPartyTag ?? '') ? null : { path: 'thirdPartyTag' }),
});

export const CRE_007 = def({
  id: 'CRE-007',
  severity: 'error',
  triggers: ['cross'],
  reads: ['expandsOnHover', 'expandDirection'],
  message: MSG.CRE_DIRECTION,
  appliesTo: (c) => is(c, 'THIRD_PARTY_DISPLAY'),
  check: (c) =>
    c.expandsOnHover && (!c.expandDirection || c.expandDirection === 'NONE')
      ? { path: 'expandDirection' }
      : null,
});

/** MRAID against web-only inventory needs a line item; the form has none, so the rule runs from the assignment check. */
export const CRE_008 = def({
  id: 'CRE-008',
  severity: 'warning',
  triggers: ['cross'],
  reads: ['requiresMraid'],
  message: MSG.CRE_MRAID_APP_ONLY,
  appliesTo: () => false,
  check: () => null,
});

export const CRE_009 = def({
  id: 'CRE-009',
  severity: 'error',
  triggers: ['save'],
  reads: ['integrationCode'],
  message: MSG.MAX_CHARS,
  check: (c) =>
    byteLength(c.integrationCode ?? '') > CREATIVE_LIMITS.INTEGRATION_CODE_MAX_BYTES
      ? { path: 'integrationCode', params: { max: CREATIVE_LIMITS.INTEGRATION_CODE_MAX_BYTES } }
      : null,
});

export const CRE_010 = def({
  id: 'CRE-010',
  severity: 'error',
  triggers: ['save'],
  reads: ['status'],
  message: MSG.CHOOSE_STATUS,
  appliesTo: (_c, ctx) => ctx.mode === 'edit',
  check: (c) =>
    c.status === 'ACTIVE' || c.status === 'PAUSED' || c.status === 'ARCHIVED'
      ? null
      : { path: 'status' },
});

export const CRE_011 = def({
  id: 'CRE-011',
  severity: 'warning',
  triggers: ['save'],
  reads: ['thirdPartyTag', 'vastTag'],
  message: MSG.CRE_NOT_SSL,
  appliesTo: (c) => is(c, 'THIRD_PARTY_DISPLAY', 'THIRD_PARTY_VIDEO', 'THIRD_PARTY_AUDIO'),
  check: (c) => {
    const text = `${c.thirdPartyTag ?? ''} ${c.vastTag ?? ''}`;
    return /\bhttp:\/\//i.test(text)
      ? { path: c.kind === 'THIRD_PARTY_DISPLAY' ? 'thirdPartyTag' : 'vastTag' }
      : null;
  },
});

export const CRE_012 = def({
  id: 'CRE-012',
  severity: 'info',
  triggers: [],
  reads: ['thirdPartyTag'],
  message: MSG.CRE_CONSENT,
  appliesTo: (c) => is(c, 'THIRD_PARTY_DISPLAY'),
  check: () => ({ path: 'thirdPartyTag' }),
});

const IMAGE_BYTES = CREATIVE_LIMITS.IMAGE_MAX_BYTES;

function badImage(a: CreativeAssetInput | null | undefined): boolean {
  if (!a) return true;
  const typeOk =
    (IMAGE_MIME as readonly string[]).includes(a.mimeType) &&
    (IMAGE_EXT as readonly string[]).includes(extOf(a.fileName));
  return !typeOk || a.sizeBytes > IMAGE_BYTES;
}

export const CRE_020 = def({
  id: 'CRE-020',
  severity: 'error',
  triggers: ['save'],
  reads: ['mainAsset'],
  message: MSG.CRE_IMAGE_FILE,
  appliesTo: (c) => is(c, 'STANDARD_IMAGE'),
  check: (c) => (badImage(c.mainAsset) ? { path: 'mainAsset' } : null),
});

export const CRE_021 = def({
  id: 'CRE-021',
  severity: 'error',
  triggers: ['save'],
  reads: ['mainAsset'],
  message: MSG.CRE_HTML5_FILE,
  appliesTo: (c) => is(c, 'STANDARD_HTML5'),
  check: (c) => {
    const a = c.mainAsset;
    const ok =
      !!a &&
      extOf(a.fileName) === 'zip' &&
      a.entryHtml !== false &&
      a.sizeBytes <= CREATIVE_LIMITS.HTML5_MAX_BYTES;
    return ok ? null : { path: 'mainAsset' };
  },
});

export const CRE_022 = def({
  id: 'CRE-022',
  severity: 'error',
  triggers: ['save'],
  reads: ['mainAsset'],
  message: MSG.CRE_VIDEO_FILE,
  appliesTo: (c) => is(c, 'VIDEO_FILE'),
  check: (c) => {
    const a = c.mainAsset;
    const ok =
      !!a &&
      (VIDEO_MIME as readonly string[]).includes(a.mimeType) &&
      a.sizeBytes <= CREATIVE_LIMITS.VIDEO_MAX_BYTES &&
      (a.durationSeconds == null ||
        (a.durationSeconds >= CREATIVE_LIMITS.VIDEO_MIN_SEC &&
          a.durationSeconds <= CREATIVE_LIMITS.VIDEO_MAX_SEC));
    return ok ? null : { path: 'mainAsset' };
  },
});

export const CRE_023 = def({
  id: 'CRE-023',
  severity: 'error',
  triggers: ['save'],
  reads: ['mainAsset'],
  message: MSG.CRE_AUDIO_FILE,
  appliesTo: (c) => is(c, 'AUDIO_FILE'),
  check: (c) => {
    const a = c.mainAsset;
    const d = a?.durationSeconds;
    const ok =
      !!a &&
      (AUDIO_MIME as readonly string[]).includes(a.mimeType) &&
      a.sizeBytes <= CREATIVE_LIMITS.AUDIO_MAX_BYTES &&
      (d == null || (d >= CREATIVE_LIMITS.AUDIO_MIN_SEC && d <= CREATIVE_LIMITS.AUDIO_MAX_SEC));
    return ok ? null : { path: 'mainAsset' };
  },
});

export const CRE_024 = def({
  id: 'CRE-024',
  severity: 'error',
  triggers: ['save'],
  reads: ['vastTag'],
  message: MSG.CRE_VAST,
  appliesTo: (c) => is(c, 'THIRD_PARTY_VIDEO', 'THIRD_PARTY_AUDIO'),
  check: (c) => {
    if (isBlank(c.vastTag)) return { path: 'vastTag', message: MSG.ENTER_VALUE };
    return parseVast(c.vastTag).ok ? null : { path: 'vastTag' };
  },
});

export const CRE_025 = def({
  id: 'CRE-025',
  severity: 'error',
  triggers: ['blur', 'save'],
  reads: ['youtubeVideo'],
  message: MSG.CRE_YOUTUBE,
  appliesTo: (c) => is(c, 'YOUTUBE_VIDEO'),
  check: (c) => (youtubeIdOf(c.youtubeVideo) ? null : { path: 'youtubeVideo' }),
});

export const CRE_026 = def({
  id: 'CRE-026',
  severity: 'warning',
  triggers: ['save'],
  reads: ['width', 'height'],
  // same wording as LI-DSP-032 (li-display.ts), which keeps it out of the shared catalogue
  message: "This creative size can't serve on most exchanges.",
  appliesTo: (c) => is(c, ...DISPLAY_SIZED),
  check: (c) => {
    const w = toNum(c.width) ?? c.mainAsset?.width ?? null;
    const h = toNum(c.height) ?? c.mainAsset?.height ?? null;
    if (!w || !h || w <= 0 || h <= 0) return null;
    return isStandardDisplaySize(w, h) ? null : { path: 'width' };
  },
});

export const CRE_030 = def({
  id: 'CRE-030',
  severity: 'info',
  triggers: [],
  reads: ['aiLabel'],
  message: MSG.CRE_AI_LABEL,
  appliesTo: (c) => !is(c, 'THIRD_PARTY_DISPLAY', 'THIRD_PARTY_VIDEO', 'THIRD_PARTY_AUDIO'),
  check: () => ({ path: 'aiLabel' }),
});

/** Display rules: states shown by the status tab, not entered by a form (CRE-040 to CRE-042). */
const display = (id: string, reads: string): Rule<CreativeInput> =>
  def({ id, severity: 'info', triggers: [], reads: [reads], message: null, check: () => null });

export const CRE_040 = display('CRE-040', 'review.dv360');
export const CRE_041 = display('CRE-041', 'review.exchanges');
export const CRE_042 = display('CRE-042', 'restrictions');

export const CRE_043 = def({
  id: 'CRE-043',
  severity: 'error',
  triggers: ['save'],
  reads: ['appeal'],
  message: MSG.CRE_APPEAL_ONLY_DISAPPROVED,
  appliesTo: (c) => !!c.appeal,
  check: (c) => (c.appeal?.servableEverywhere ? { path: 'appeal' } : null),
});

export const CRE_050 = display('CRE-050', 'bulk');

/** Fields a CM360 creative keeps read-only (CRE-060); name and status stay editable. */
const CM360_LOCKED: (keyof CreativeInput)[] = [
  'landingPageUrl',
  'width',
  'height',
  'thirdPartyTag',
  'vastTag',
  'youtubeVideo',
  'requiresMraid',
  'requiresHtml5',
  'expandDirection',
  'expandsOnHover',
  'dontScaleToFit',
  'appendTrackingTag',
  'requiresPing',
  'aiLabel',
  'integrationCode',
  'notes',
  'skippable',
  'skipOffsetSec',
];

type Scalar = string | number | boolean | null | undefined;
const same = (a: Scalar, b: Scalar): boolean =>
  (a ?? null) === (b ?? null) || String(a ?? '') === String(b ?? '');

export const CRE_060 = def({
  id: 'CRE-060',
  severity: 'error',
  triggers: ['save'],
  reads: ['source'],
  message: MSG.CRE_CM360_READONLY,
  appliesTo: (_c, ctx) => ctx.mode === 'edit',
  check: (c, ctx) => {
    const original = originalOf<CreativeInput>(ctx);
    if (!original || original.source !== 'CM360') return null;
    return CM360_LOCKED.some((k) => !same(c[k] as Scalar, original[k] as Scalar))
      ? { path: 'source' }
      : null;
  },
});

export const CRE_070 = def({
  id: 'CRE-070',
  severity: 'warning',
  triggers: ['save'],
  reads: ['status'],
  message: MSG.CRE_ASSIGNED_ACTIVE,
  appliesTo: (c, ctx) => ctx.mode === 'edit' && (c.status === 'PAUSED' || c.status === 'ARCHIVED'),
  check: (c, ctx) => {
    const original = originalOf<CreativeInput>(ctx);
    const n = c.activeLineItemCount ?? 0;
    if (!original || original.status === c.status || n <= 0) return null;
    return { path: 'status', params: { n } };
  },
});

export const CRE_080 = display('CRE-080', 'format');
export const CRE_090 = display('CRE-090', 'list');

const NATIVE = ['NATIVE_SITE', 'NATIVE_VIDEO'] as const satisfies readonly CreativeKindKey[];

export const CRE_100 = def({
  id: 'CRE-100',
  severity: 'error',
  triggers: ['blur', 'save'],
  reads: [
    'native.headline',
    'native.body',
    'native.callToAction',
    'native.advertiserName',
    'optimized.headlines',
    'optimized.descriptions',
    'optimized.businessName',
  ],
  message: MSG.MAX_CHARS,
  appliesTo: (c) => is(c, ...NATIVE),
  check: (c): Violation[] => {
    const out: Violation[] = [];
    const text = (
      path: string,
      value: string | null | undefined,
      max: number,
      required: boolean,
    ) => {
      if (isBlank(value)) {
        if (required) out.push({ path, message: MSG.ENTER_VALUE });
      } else if (codePointLength(value ?? '') > max) out.push({ path, params: { max } });
    };
    const o = c.optimized;
    if (o) {
      o.headlines.forEach((h, i) =>
        text(`optimized.headlines[${i}]`, h, CREATIVE_LIMITS.OPTIMIZED_HEADLINE_CHARS, i === 0),
      );
      o.descriptions.forEach((d, i) =>
        text(
          `optimized.descriptions[${i}]`,
          d,
          CREATIVE_LIMITS.OPTIMIZED_DESCRIPTION_CHARS,
          i === 0,
        ),
      );
      text('optimized.businessName', o.businessName, CREATIVE_LIMITS.NATIVE_ADVERTISER_MAX, true);
      return out;
    }
    const n = c.native ?? {};
    text('native.headline', n.headline, CREATIVE_LIMITS.NATIVE_HEADLINE_MAX, true);
    text('native.body', n.body, CREATIVE_LIMITS.NATIVE_BODY_MAX, true);
    text('native.callToAction', n.callToAction, CREATIVE_LIMITS.NATIVE_CTA_MAX, true);
    text('native.advertiserName', n.advertiserName, CREATIVE_LIMITS.NATIVE_ADVERTISER_MAX, true);
    return out;
  },
});

export const CRE_101 = def({
  id: 'CRE-101',
  severity: 'error',
  triggers: ['save'],
  reads: ['mainAsset', 'logoAsset', 'optimized.imageCount', 'optimized.logoCount'],
  message: MSG.CRE_NATIVE_ASSETS,
  appliesTo: (c) => is(c, ...NATIVE),
  check: (c) => {
    if (c.optimized) {
      if (c.optimized.imageCount < 1) return { path: 'mainAsset' };
      return c.optimized.logoCount < 1 ? { path: 'logoAsset' } : null;
    }
    return c.mainAsset && c.logoAsset ? null : { path: c.mainAsset ? 'logoAsset' : 'mainAsset' };
  },
});

export const CRE_102 = def({
  id: 'CRE-102',
  severity: 'error',
  triggers: ['cross', 'save'],
  reads: ['skippable', 'skipOffsetSec', 'durationSeconds'],
  message: MSG.CRE_SKIP_OFFSET,
  appliesTo: (c) => is(c, 'VIDEO_FILE', 'THIRD_PARTY_VIDEO') && !!c.skippable,
  check: (c) => {
    const duration = toNum(c.durationSeconds) ?? c.mainAsset?.durationSeconds ?? null;
    const offset = toNum(c.skipOffsetSec) ?? CREATIVE_LIMITS.SKIP_DEFAULT_SEC;
    if (duration === null) return null;
    return duration < CREATIVE_LIMITS.SKIP_MIN_VIDEO_SEC || offset >= duration
      ? { path: 'skipOffsetSec' }
      : null;
  },
});

export const CRE_103 = def({
  id: 'CRE-103',
  severity: 'error',
  triggers: ['save'],
  reads: ['mainAsset', 'logoAsset'],
  message: MSG.CRE_FILE_TOO_LARGE,
  check: (c): Violation[] => {
    const out: Violation[] = [];
    const limit = CREATIVE_LIMITS.OTHER_MAX_BYTES;
    // The main asset of image, HTML5, video and audio kinds has its own limit and message (CRE-020 to CRE-023).
    const ownLimit = is(c, 'STANDARD_IMAGE', 'STANDARD_HTML5', 'VIDEO_FILE', 'AUDIO_FILE');
    if (!ownLimit && c.mainAsset && c.mainAsset.sizeBytes > limit) out.push({ path: 'mainAsset' });
    if (c.logoAsset && c.logoAsset.sizeBytes > limit) out.push({ path: 'logoAsset' });
    return out;
  },
});

export const CRE_104 = def({
  id: 'CRE-104',
  severity: 'error',
  triggers: ['save'],
  reads: ['formatKey'],
  message: MSG.CRE_GWD_ONLY,
  appliesTo: (c) => c.formatKey === 'PARALLAX' || c.formatKey === 'SWIRL',
  check: () => ({ path: 'formatKey' }),
});

export const creativeRules: readonly AnyRule[] = [
  CRE_001,
  CRE_002,
  CRE_003,
  CRE_004,
  CRE_005,
  CRE_006,
  CRE_007,
  CRE_008,
  CRE_009,
  CRE_010,
  CRE_011,
  CRE_012,
  CRE_020,
  CRE_021,
  CRE_022,
  CRE_023,
  CRE_024,
  CRE_025,
  CRE_026,
  CRE_030,
  CRE_040,
  CRE_041,
  CRE_042,
  CRE_043,
  CRE_050,
  CRE_060,
  CRE_070,
  CRE_080,
  CRE_090,
  CRE_100,
  CRE_101,
  CRE_102,
  CRE_103,
  CRE_104,
];
