// MX-09 A matrix: 10 formats x 8 line item types (validation.md 3).
import { describe, expect, it } from 'vitest';
import {
  CREATIVE_FORMATS,
  creativeFormatAllowed,
  type CreativeFormat,
} from '@/lib/validation/constants/creatives';
import type { LiType } from '@/lib/validation/constants/li-compat';

type Col = [LiType, 'DISPLAY' | 'VIDEO' | null];
const COLUMNS: Col[] = [
  ['DISPLAY', null],
  ['VIDEO', null],
  ['CTV', null],
  ['AUDIO', null],
  ['MOBILE_APP_INSTALL', 'DISPLAY'],
  ['MOBILE_APP_INSTALL', 'VIDEO'],
  ['DOOH_DISPLAY', null],
  ['DOOH_VIDEO', null],
];

// Y/N rows in the order of COLUMNS, copied from validation.md MX-09 A.
const TABLE: Record<CreativeFormat, string> = {
  IMAGE: 'YNNNYNYN',
  HTML5: 'YNNNYNNN',
  NATIVE_SITE: 'YNNNYNNN',
  NATIVE_VIDEO: 'YYNNNYNN',
  VIDEO_FILE: 'NYYNNYNY',
  YOUTUBE_VIDEO: 'NYNNNNNN',
  AUDIO_FILE: 'NNNYNNNN',
  TP_DISPLAY: 'YNNNYNNN',
  TP_VIDEO: 'NYYNNYNY',
  TP_AUDIO: 'NNNYNNNN',
};

describe('MX-09 A', () => {
  it('covers every format', () =>
    expect(Object.keys(TABLE).sort()).toEqual([...CREATIVE_FORMATS].sort()));
  for (const format of CREATIVE_FORMATS) {
    it(`${format} row`, () => {
      const got = COLUMNS.map(([type, adType]) =>
        creativeFormatAllowed(type, format, adType) ? 'Y' : 'N',
      ).join('');
      expect(got).toBe(TABLE[format]);
    });
  }
  it('app install video follows the ad type', () => {
    expect(creativeFormatAllowed('ADS_IN_MOBILE_APPS', 'VIDEO_FILE', 'VIDEO')).toBe(true);
    expect(creativeFormatAllowed('ADS_IN_MOBILE_APPS', 'VIDEO_FILE', 'DISPLAY')).toBe(false);
  });
});
