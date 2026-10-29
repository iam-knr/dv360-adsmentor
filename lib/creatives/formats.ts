// Format gallery catalogue (module 12 S6). Code, not database. Descriptions are Adsmetor paraphrases (PROJECT.md R2, R5).
import type { LiType } from '@/lib/validation/constants/li-compat';
import { creativeFormatAllowed, type CreativeFormat } from '@/lib/validation/constants/creatives';
import { LI_TYPES } from '@/lib/validation/constants/li-compat';

export const FORMAT_TABS = ['ALL', 'VIDEO', 'DISPLAY', 'NATIVE', 'OPTIMIZED'] as const;
export type FormatTab = (typeof FORMAT_TABS)[number];
export const FORMAT_TAB_LABEL: Record<FormatTab, string> = {
  ALL: 'All Formats',
  VIDEO: 'Video',
  DISPLAY: 'Display',
  NATIVE: 'Native',
  OPTIMIZED: 'Optimized',
};

export type FormatBadge = 'NEW' | 'BETA' | 'ONLY IN GWD';
export type FormatEnvironment = 'Mobile app' | 'Mobile web' | 'Desktop';

export interface FormatDef {
  key: string;
  name: string;
  tabs: readonly Exclude<FormatTab, 'ALL'>[];
  badges: readonly FormatBadge[];
  /** `Create` is shown only when buildable (CRE-080). */
  buildable: boolean;
  /** `?kind=` the Create action opens, when buildable. */
  createKind?: string;
  environments: readonly FormatEnvironment[];
  description: string;
  requirements: readonly string[];
  /** MX-09 format used to list the supported line item types in Details. */
  mx09?: CreativeFormat;
  recommended?: boolean;
  /** A creative of this format needs the Google Web Designer, which the simulator does not include (CRE-104). */
  gwdOnly?: boolean;
}

const ALL_ENV: readonly FormatEnvironment[] = ['Mobile app', 'Mobile web', 'Desktop'];

export const FORMATS: readonly FormatDef[] = [
  {
    key: 'OPTIMIZED',
    name: 'Optimized',
    tabs: ['OPTIMIZED', 'DISPLAY'],
    badges: ['NEW'],
    buildable: true,
    createKind: 'format-optimized',
    environments: ALL_ENV,
    description:
      'Give us headlines, descriptions, images and a logo and the system assembles the ad to fit each placement.',
    requirements: [
      'Up to 5 headlines (30 characters each) and 5 descriptions (90 characters each)',
      'Up to 15 images and 5 logos',
      'Business name, call to action and a landing page URL',
    ],
    mx09: 'NATIVE_SITE',
    recommended: true,
  },
  {
    key: 'NATIVE_DISPLAY',
    name: 'Native display',
    tabs: ['NATIVE', 'DISPLAY'],
    badges: [],
    buildable: true,
    createKind: 'native-site',
    environments: ALL_ENV,
    description:
      'An ad that takes the look of the page around it: a headline, a short body, an image and a logo.',
    requirements: [
      'Headline, body, call to action and advertiser name',
      'Main image (1200x628 or 1200x1200) and a square logo',
    ],
    mx09: 'NATIVE_SITE',
    recommended: true,
  },
  {
    key: 'NATIVE_VIDEO',
    name: 'Native video',
    tabs: ['NATIVE', 'VIDEO'],
    badges: [],
    buildable: true,
    createKind: 'native-video',
    environments: ['Mobile app', 'Mobile web'],
    description:
      'A native card that plays a short video inside the feed, with the same text assets as native display.',
    requirements: ['Everything native display needs', 'A video file'],
    mx09: 'NATIVE_VIDEO',
    recommended: true,
  },
  {
    key: 'PARALLAX',
    name: 'Parallax',
    tabs: ['DISPLAY'],
    badges: ['BETA', 'ONLY IN GWD'],
    buildable: false,
    environments: ['Mobile web'],
    description: 'An image that moves at a different pace from the page as the viewer scrolls.',
    requirements: ['Built in an external design tool; not available in this simulator'],
    gwdOnly: true,
  },
  {
    key: 'SWIRL',
    name: 'Swirl',
    tabs: ['DISPLAY'],
    badges: ['ONLY IN GWD'],
    buildable: false,
    environments: ['Mobile web'],
    description: 'A 3D object the viewer can rotate by tilting or dragging.',
    requirements: ['Built in an external design tool; not available in this simulator'],
    gwdOnly: true,
  },
  {
    key: 'HTML5_DISPLAY',
    name: 'HTML5 or image',
    tabs: ['DISPLAY'],
    badges: [],
    buildable: true,
    createKind: 'upload-image',
    environments: ALL_ENV,
    description: 'Upload a finished image or a zipped HTML5 ad.',
    requirements: [
      'Image: GIF, PNG or JPEG up to 150 KB',
      'HTML5: a ZIP with one HTML file up to 10 MB',
    ],
    mx09: 'HTML5',
  },
  {
    key: 'VIDEO_FILE',
    name: 'Video',
    tabs: ['VIDEO'],
    badges: [],
    buildable: true,
    createKind: 'upload-video',
    environments: ALL_ENV,
    description: 'Upload a video file for in-stream and Connected TV placements.',
    requirements: [
      'MP4 or MOV up to 10 MB in the simulator',
      'Optional skip button and companion banner',
    ],
    mx09: 'VIDEO_FILE',
  },
];

export function listFormats(tab: FormatTab): { recommended: FormatDef[]; all: FormatDef[] } {
  const all = FORMATS.filter((f) => tab === 'ALL' || f.tabs.includes(tab));
  return { recommended: all.filter((f) => f.recommended), all };
}

export function formatByKey(key: string): FormatDef | undefined {
  return FORMATS.find((f) => f.key === key);
}

/** Line item types a format can serve in (MX-09 A), for the Details slide-over. */
export function supportedLiTypes(format: FormatDef): LiType[] {
  if (!format.mx09) return [];
  const mx = format.mx09;
  return LI_TYPES.filter(
    (t) =>
      creativeFormatAllowed(t, mx) &&
      creativeFormatAllowed(t, mx, 'VIDEO') &&
      !t.startsWith('YT_') &&
      t !== 'DEMAND_GEN',
  );
}
