// Demand Gen ad groups and ads (module 09 4.6, T09-09; `(from public docs)`, approximate). Pure and client safe.
// Demand Gen ads reuse the ad table with the formats DEMAND_GEN_VIDEO, DEMAND_GEN_IMAGE and DEMAND_GEN_CAROUSEL; the
// rules are LI-DG-007..009 (limits on headline, description and business name) plus the three media checks below.
import { LIMITS } from '@/lib/validation/constants/limits';
import { codePointLength, isBlank } from '@/lib/validation/primitives';
import { format, MSG } from '@/lib/validation/messages';
import type { Issue } from '@/lib/validation/types';

export const DG_FORMATS = ['DEMAND_GEN_VIDEO', 'DEMAND_GEN_IMAGE', 'DEMAND_GEN_CAROUSEL'] as const;
export type DgFormat = (typeof DG_FORMATS)[number];

export const DG_FORMAT_LABEL: Record<DgFormat, string> = {
  DEMAND_GEN_VIDEO: 'Video',
  DEMAND_GEN_IMAGE: 'Image',
  DEMAND_GEN_CAROUSEL: 'Carousel',
};

export const isDgFormat = (v: string | null | undefined): v is DgFormat =>
  (DG_FORMATS as readonly string[]).includes(v ?? '');

/** Image ratios a Demand Gen image ad accepts, shown as help text. */
export const DG_IMAGE_HELP =
  'Landscape 1.91:1, square 1:1 or portrait 4:5. PNG, JPG or GIF up to 5 MB.';
export const DG_CAROUSEL_MIN = 2;
export const DG_CAROUSEL_MAX = 10;

export type DgSurface = 'DISCOVER' | 'GMAIL' | 'YOUTUBE';
export const DG_SURFACES: readonly DgSurface[] = ['DISCOVER', 'GMAIL', 'YOUTUBE'];
export const DG_SURFACE_LABEL: Record<DgSurface, string> = {
  DISCOVER: 'Discover feed',
  GMAIL: 'Gmail promotion',
  YOUTUBE: 'YouTube in-feed',
};

/** Caption of the Demand Gen preview. */
export const dgCaption = (format: DgFormat, surface: DgSurface): string =>
  `Example of your ${DG_FORMAT_LABEL[format].toLowerCase()} ad in ${DG_SURFACE_LABEL[surface]}`;

export interface DgAdFields {
  dgFormat: DgFormat | null;
  videoId: string | null;
  videoFound: boolean;
  imageAssetIds: string[];
  headline: string;
  description: string;
  businessName: string;
}

const error = (ruleId: string, path: string, message: string): Issue => ({
  ruleId,
  severity: 'error',
  path,
  message,
  blocking: true,
});

/** LI-DG-007..009 and the media checks of one Demand Gen ad. Paths are the form fields. */
export function dgIssues(a: DgAdFields): Issue[] {
  const out: Issue[] = [];
  if (!a.dgFormat) out.push(error('AD-DG-001', 'dgFormat', MSG.SELECTION_REQUIRED));
  if (codePointLength(a.headline) > LIMITS.DG_HEADLINE_MAX)
    out.push(
      error('LI-DG-007', 'headline', format(MSG.MAX_CHARS, { max: LIMITS.DG_HEADLINE_MAX })),
    );
  if (codePointLength(a.description) > LIMITS.AD_DESCRIPTION_MAX)
    out.push(
      error('LI-DG-008', 'description', format(MSG.MAX_CHARS, { max: LIMITS.AD_DESCRIPTION_MAX })),
    );
  if (isBlank(a.businessName)) out.push(error('LI-DG-009', 'businessName', MSG.ENTER_VALUE));
  else if (codePointLength(a.businessName) > LIMITS.AD_BUSINESS_NAME_MAX)
    out.push(
      error(
        'LI-DG-009',
        'businessName',
        format(MSG.MAX_CHARS, { max: LIMITS.AD_BUSINESS_NAME_MAX }),
      ),
    );
  if (a.dgFormat === 'DEMAND_GEN_VIDEO') {
    if (!a.videoId || !a.videoFound)
      out.push(error('AD-DG-002', 'videoRef', MSG.YT_VIDEO_NOT_FOUND));
  } else if (a.dgFormat === 'DEMAND_GEN_IMAGE') {
    if (a.imageAssetIds.length === 0)
      out.push(error('AD-DG-003', 'imageAssetIds', 'Upload an image.'));
  } else if (a.dgFormat === 'DEMAND_GEN_CAROUSEL') {
    if (a.imageAssetIds.length < DG_CAROUSEL_MIN || a.imageAssetIds.length > DG_CAROUSEL_MAX)
      out.push(
        error(
          'AD-DG-003',
          'imageAssetIds',
          `Upload ${DG_CAROUSEL_MIN} to ${DG_CAROUSEL_MAX} images for a carousel.`,
        ),
      );
  }
  return out;
}
