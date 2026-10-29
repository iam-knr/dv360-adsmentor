// AD rules: YouTube ad (validation.md 2.13). "From 12 Oct 2026" gates the business name and logo rules (AD-011, AD-014).
import { LIMITS } from '../constants/limits';
import { MSG } from '../messages';
import { codePointLength, isBlank, isUrl, today } from '../primitives';
import type { AdInput, AnyRule, Rule, Violation } from '../types';

function def(rule: Omit<Rule<AdInput>, 'kind'>): Rule<AdInput> {
  return { kind: 'ad', ...rule };
}

/** Business name and logo became required for YouTube ads on this date. */
export const BRANDING_REQUIRED_FROM = '2026-10-12';

export const AD_001 = def({
  id: 'AD-001',
  severity: 'error',
  triggers: ['blur', 'save'],
  reads: ['name'],
  message: MSG.ENTER_VALUE,
  check: (a) => (isBlank(a.name) ? { path: 'name' } : null),
});

export const AD_002 = def({
  id: 'AD-002',
  severity: 'error',
  triggers: ['save'],
  reads: ['name'],
  message: MSG.MAX_CHARS,
  check: (a) =>
    codePointLength(a.name) > LIMITS.NAME_MAX_255
      ? { path: 'name', params: { max: LIMITS.NAME_MAX_255 } }
      : null,
});

export const AD_003 = def({
  id: 'AD-003',
  severity: 'error',
  triggers: ['save'],
  reads: ['videoRef'],
  message: MSG.ENTER_VALUE,
  check: (a) => (isBlank(a.videoRef) ? { path: 'videoRef' } : null),
});

export const AD_004 = def({
  id: 'AD-004',
  severity: 'error',
  triggers: ['blur', 'save'],
  reads: ['videoRef', 'videoId'],
  message: MSG.YT_VIDEO_NOT_FOUND,
  needs: ['youtubeVideos'],
  appliesTo: (a) => !isBlank(a.videoRef),
  check: (a, ctx) => {
    const video = a.videoId ? ctx.lookups.youtubeVideos?.get(a.videoId) : undefined;
    return video?.isPublic ? null : { path: 'videoRef' };
  },
});

export const AD_005 = def({
  id: 'AD-005',
  severity: 'error',
  triggers: ['blur', 'save'],
  reads: ['headline'],
  message: MSG.MAX_CHARS,
  check: (a) =>
    codePointLength(a.headline ?? '') > LIMITS.AD_HEADLINE_MAX
      ? { path: 'headline', params: { max: LIMITS.AD_HEADLINE_MAX } }
      : null,
});

export const AD_006 = def({
  id: 'AD-006',
  severity: 'error',
  triggers: ['blur', 'save'],
  reads: ['longHeadline'],
  message: MSG.ENTER_VALUE,
  check: (a) => (isBlank(a.longHeadline) ? { path: 'longHeadline' } : null),
});

export const AD_007 = def({
  id: 'AD-007',
  severity: 'error',
  triggers: ['save'],
  reads: ['longHeadline'],
  message: MSG.MAX_CHARS,
  check: (a) =>
    codePointLength(a.longHeadline ?? '') > LIMITS.AD_LONG_HEADLINE_MAX
      ? { path: 'longHeadline', params: { max: LIMITS.AD_LONG_HEADLINE_MAX } }
      : null,
});

export const AD_008 = def({
  id: 'AD-008',
  severity: 'error',
  triggers: ['blur', 'save'],
  reads: ['description'],
  message: MSG.ENTER_VALUE,
  check: (a) => (isBlank(a.description) ? { path: 'description' } : null),
});

export const AD_009 = def({
  id: 'AD-009',
  severity: 'error',
  triggers: ['save'],
  reads: ['description'],
  message: MSG.MAX_CHARS,
  check: (a) =>
    codePointLength(a.description ?? '') > LIMITS.AD_DESCRIPTION_MAX
      ? { path: 'description', params: { max: LIMITS.AD_DESCRIPTION_MAX } }
      : null,
});

export const AD_010 = def({
  id: 'AD-010',
  severity: 'error',
  triggers: ['save'],
  reads: ['callToAction'],
  message: MSG.MAX_CHARS,
  check: (a) =>
    codePointLength(a.callToAction ?? '') > LIMITS.AD_CTA_MAX
      ? { path: 'callToAction', params: { max: LIMITS.AD_CTA_MAX } }
      : null,
});

export const AD_011 = def({
  id: 'AD-011',
  severity: 'error',
  triggers: ['save'],
  reads: ['businessName'],
  message: MSG.ENTER_VALUE,
  suppressedBy: ['AD-013'],
  appliesTo: (_a, ctx) => today(ctx) >= BRANDING_REQUIRED_FROM,
  check: (a) => (isBlank(a.businessName) ? { path: 'businessName' } : null),
});

export const AD_012 = def({
  id: 'AD-012',
  severity: 'error',
  triggers: ['save'],
  reads: ['businessName'],
  message: MSG.MAX_CHARS,
  check: (a) =>
    codePointLength(a.businessName ?? '') > LIMITS.AD_BUSINESS_NAME_MAX
      ? { path: 'businessName', params: { max: LIMITS.AD_BUSINESS_NAME_MAX } }
      : null,
});

export const AD_013 = def({
  id: 'AD-013',
  severity: 'error',
  triggers: ['save'],
  reads: ['businessName'],
  message: MSG.YT_BUSINESS_LOCKED,
  appliesTo: (a, ctx) => !isBlank(ctx.advertiser.businessName) && isBlank(a.businessName),
  check: () => ({ path: 'businessName' }),
});

export const AD_014 = def({
  id: 'AD-014',
  severity: 'error',
  triggers: ['save'],
  reads: ['logoAssetId'],
  message: MSG.YT_ADD_LOGO,
  appliesTo: (_a, ctx) => today(ctx) >= BRANDING_REQUIRED_FROM,
  check: (a) => (isBlank(a.logoAssetId) ? { path: 'logoAssetId' } : null),
});

export const AD_015 = def({
  id: 'AD-015',
  severity: 'error',
  triggers: ['blur', 'save'],
  reads: ['path1', 'path2'],
  message: MSG.MAX_CHARS,
  check: (a) =>
    (['path1', 'path2'] as const)
      .filter((k) => codePointLength(a[k] ?? '') > LIMITS.AD_DISPLAY_PATH_MAX)
      .map((k): Violation => ({ path: k, params: { max: LIMITS.AD_DISPLAY_PATH_MAX } })),
});

export const AD_016 = def({
  id: 'AD-016',
  severity: 'error',
  triggers: ['blur', 'save'],
  reads: ['landingPageUrl'],
  message: MSG.ENTER_VALUE,
  check: (a) => (isBlank(a.landingPageUrl) ? { path: 'landingPageUrl' } : null),
});

const HTTP = /^https?:\/\//i;

export const AD_017 = def({
  id: 'AD-017',
  severity: 'error',
  triggers: ['blur', 'save'],
  reads: ['landingPageUrl', 'clickTrackerUrl', 'impressionTrackerUrl'],
  message: MSG.VALID_URL,
  check: (a) =>
    (['landingPageUrl', 'clickTrackerUrl', 'impressionTrackerUrl'] as const)
      .filter((k) => !isBlank(a[k]) && !(HTTP.test(a[k]!) && isUrl(a[k]!, LIMITS.LANDING_URL_MAX)))
      .map((k): Violation => ({ path: k })),
});

export const AD_018 = def({
  id: 'AD-018',
  severity: 'error',
  triggers: ['save'],
  reads: ['companionMode', 'companionAssetId'],
  message: MSG.YT_COMPANION,
  appliesTo: (a) => a.companionMode === 'OWN',
  check: (a) => (isBlank(a.companionAssetId) ? { path: 'companionAssetId' } : null),
});

export const AD_019 = def({
  id: 'AD-019',
  severity: 'error',
  triggers: ['save'],
  reads: ['status'],
  message: MSG.CHOOSE_STATUS,
  check: (a) => (a.status === 'ACTIVE' || a.status === 'PAUSED' ? null : { path: 'status' }),
});

export const AD_020 = def({
  id: 'AD-020',
  severity: 'info',
  triggers: ['cross'],
  reads: ['videoRef'],
  message: MSG.YT_AI_LABEL,
  check: () => ({ path: 'media' }),
});

export const adRules: readonly AnyRule[] = [
  AD_001,
  AD_002,
  AD_003,
  AD_004,
  AD_005,
  AD_006,
  AD_007,
  AD_008,
  AD_009,
  AD_010,
  AD_011,
  AD_012,
  AD_013,
  AD_014,
  AD_015,
  AD_016,
  AD_017,
  AD_018,
  AD_019,
  AD_020,
];
