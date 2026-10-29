// Defaults and option lists of the creative form (module 12 4.2). Pure, client safe.
import type { CreativeKind } from '@prisma/client';
import type { CreativeInput } from '@/lib/validation/types';
import { CREATIVE_LIMITS } from './limits';

export const EXPAND_DIRECTIONS: { value: string; label: string }[] = [
  { value: 'NONE', label: 'None' },
  { value: 'UP', label: 'Up' },
  { value: 'DOWN', label: 'Down' },
  { value: 'LEFT', label: 'Left' },
  { value: 'RIGHT', label: 'Right' },
  { value: 'UP_AND_LEFT', label: 'Up and left' },
  { value: 'UP_AND_RIGHT', label: 'Up and right' },
  { value: 'DOWN_AND_LEFT', label: 'Down and left' },
  { value: 'DOWN_AND_RIGHT', label: 'Down and right' },
];

export const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'ARCHIVED', label: 'Archived' },
];

export const AI_LABEL_OPTIONS = [
  { value: 'AI_GENERATED', label: 'Label this creative as created or edited with AI' },
  { value: 'NOT_AI_GENERATED', label: "Don't label this creative" },
];

/** A blank form value. The seen third-party display form prefills `http://` in the landing page URL. */
export function newCreativeInput(
  kind: CreativeKind,
  formatKey: string | null = null,
): CreativeInput {
  return {
    kind,
    formatKey,
    name: '',
    landingPageUrl: kind === 'THIRD_PARTY_DISPLAY' ? 'http://' : '',
    ...(kind === 'THIRD_PARTY_DISPLAY' ? { width: 0, height: 0, thirdPartyTag: '' } : {}),
    expandDirection: 'NONE',
    expandsOnHover: false,
    requiresMraid: false,
    requiresHtml5: false,
    dontScaleToFit: false,
    appendTrackingTag: false,
    requiresPing: false,
    aiLabel: 'UNSET',
    integrationCode: '',
    notes: '',
    skippable: false,
    skipOffsetSec: CREATIVE_LIMITS.SKIP_DEFAULT_SEC,
    ...(kind === 'THIRD_PARTY_VIDEO' ? { vastTag: '', width: 640, height: 360 } : {}),
    ...(kind === 'THIRD_PARTY_AUDIO' ? { vastTag: '' } : {}),
    ...(kind === 'YOUTUBE_VIDEO' ? { youtubeVideo: '' } : {}),
    ...(kind === 'NATIVE_SITE' || kind === 'NATIVE_VIDEO'
      ? formatKey === 'OPTIMIZED'
        ? {
            optimized: {
              headlines: [''],
              descriptions: [''],
              imageCount: 0,
              logoCount: 0,
              businessName: '',
              callToAction: '',
            },
          }
        : {
            native: {
              headline: '',
              body: '',
              callToAction: '',
              advertiserName: '',
              displayUrl: '',
            },
          }
      : {}),
  };
}
