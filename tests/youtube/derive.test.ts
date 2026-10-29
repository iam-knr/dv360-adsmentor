// V-09-01 to V-09-05: subtype mapping, derived formats, video references and the preview model.
import { describe, expect, it } from 'vitest';
import {
  DEVICES,
  deriveAdFormats,
  parseYoutubeRef,
  previewComboValid,
  step1Of,
  subtypeFrom,
  SURFACES,
  YT_SUBTYPES,
  AD_FORMAT_ORDER,
} from '@/lib/validation/constants/youtube';
import { buildPreviewModel, previewCaption, type PreviewVideo } from '@/lib/youtube/preview';

describe('V-09-01 subtypeFrom', () => {
  it.each([
    ['REACH', 'EFFICIENT', 'EFFICIENT_REACH'],
    ['REACH', 'NON_SKIPPABLE', 'NON_SKIPPABLE_REACH'],
    ['REACH', null, 'EFFICIENT_REACH'],
    ['TARGET_FREQUENCY', 'ALL_FORMATS', 'TARGET_FREQUENCY'],
    ['TARGET_FREQUENCY', 'IN_STREAM_ONLY', 'TARGET_FREQUENCY_IN_STREAM'],
    ['TRUEVIEW_VIEWS', null, 'TRUEVIEW_VIEWS'],
    ['AD_SEQUENCE', null, 'AD_SEQUENCE'],
    ['REACH', 'ALL_FORMATS', null],
    ['TARGET_FREQUENCY', 'EFFICIENT', null],
    ['TRUEVIEW_VIEWS', 'EFFICIENT', null],
  ] as const)('%s + %s = %s', (o, c, expected) => {
    expect(subtypeFrom(o, c)).toBe(expected);
  });
  it('audio is always AUDIO_REACH', () => expect(subtypeFrom(null, null, true)).toBe('AUDIO_REACH'));
  it('round trips through step1Of', () => {
    for (const s of YT_SUBTYPES.filter((x) => x !== 'AUDIO_REACH')) {
      const { optimization, choice } = step1Of(s);
      expect(subtypeFrom(optimization, choice)).toBe(s);
    }
  });
});

describe('V-09-02 deriveAdFormats', () => {
  const h = (durationSec: number) => ({ orientation: 'HORIZONTAL' as const, durationSec });
  const v = (durationSec: number) => ({ orientation: 'VERTICAL' as const, durationSec });
  it.each([
    [h(1), ['BUMPER']],
    [h(6), ['BUMPER']],
    [h(7), ['IN_FEED']],
    [h(9), ['IN_FEED']],
    [h(10), ['IN_STREAM_SKIPPABLE', 'IN_FEED']],
    [h(60), ['IN_STREAM_SKIPPABLE', 'IN_FEED']],
    [h(61), ['IN_FEED']],
    [h(90), ['IN_FEED']],
    [v(4), []],
    [v(5), ['SHORTS']],
    [v(60), ['SHORTS']],
    [v(61), []],
  ])('%j', (video, expected) => {
    expect(deriveAdFormats(video)).toEqual(expected);
  });
  it('non-skippable line items use the 5 to 30 s row', () => {
    expect(deriveAdFormats(h(15), { nonSkippable: true })).toEqual(['NON_SKIPPABLE_IN_STREAM']);
    expect(deriveAdFormats(h(31), { nonSkippable: true })).toEqual([]);
    expect(deriveAdFormats(h(4), { nonSkippable: true })).toEqual([]);
  });
});

describe('V-09-03 parseYoutubeRef', () => {
  const id = 'dQw4w9WgXcQ';
  it.each([
    [id, id],
    [`https://www.youtube.com/watch?v=${id}`, id],
    [`https://www.youtube.com/watch?v=${id}&t=10`, id],
    [`https://youtu.be/${id}`, id],
    [`https://www.youtube.com/shorts/${id}`, id],
    [`youtube.com/embed/${id}`, id],
    ['', null],
    ['not a url', null],
    ['https://example.com/watch?v=dQw4w9WgXcQ', null],
    ['https://www.youtube.com/watch?v=short', null],
    [null, null],
  ])('%s', (input, expected) => {
    expect(parseYoutubeRef(input as string | null)).toBe(expected);
  });
});

describe('V-09-04 and V-09-05 preview', () => {
  const video = (durationSec: number, orientation: 'HORIZONTAL' | 'VERTICAL' = 'HORIZONTAL'): PreviewVideo => ({
    videoId: 'AAAAAAAAAAA',
    title: 't',
    channelName: 'c',
    durationSec,
    orientation,
    thumbnailUrl: null,
  });
  it('caption template for every valid combination', () => {
    let n = 0;
    for (const f of AD_FORMAT_ORDER)
      for (const d of DEVICES)
        for (const s of SURFACES) {
          if (!previewComboValid(f, d, s)) continue;
          n++;
          expect(previewCaption(f, d, s)).toMatch(/^(Mobile phone|Computer|TV) example of your .+ ad on (YouTube|Google video partners|Google TV)$/);
        }
    // 3 formats everywhere (9 each) + in-feed (2 devices x 1) + Shorts (1)
    expect(n).toBe(27 + 2 + 1);
  });
  it('Shorts and in-feed are not available on TV or Google TV', () => {
    expect(previewComboValid('SHORTS', 'TV', 'YOUTUBE')).toBe(false);
    expect(previewComboValid('SHORTS', 'COMPUTER', 'YOUTUBE')).toBe(false);
    expect(previewComboValid('IN_FEED', 'TV', 'YOUTUBE')).toBe(false);
    expect(previewComboValid('IN_FEED', 'PHONE', 'GOOGLE_TV')).toBe(false);
    expect(previewComboValid('BUMPER', 'TV', 'GOOGLE_TV')).toBe(true);
  });
  it('a 6 s video previews as a bumper on a phone on YouTube', () => {
    const m = buildPreviewModel(
      { video: video(6), headline: 'Hi' },
      { filter: 'ALL', format: null, device: 'PHONE', surface: 'YOUTUBE' },
    );
    expect(m.caption).toBe('Mobile phone example of your bumper ad on YouTube');
    expect(m.frame.headline).toBe('Hi');
  });
  it('switching to TV and Google TV updates the caption', () => {
    const m = buildPreviewModel(
      { video: video(6) },
      { filter: 'ALL', format: 'BUMPER', device: 'TV', surface: 'GOOGLE_TV' },
    );
    expect(m.caption).toBe('TV example of your bumper ad on Google TV');
  });
  it('a horizontal video filtered to Shorts warns', () => {
    const m = buildPreviewModel(
      { video: video(15) },
      { filter: 'SHORTS', format: null, device: 'PHONE', surface: 'YOUTUBE' },
    );
    expect(m.formats).toEqual([]);
    expect(m.warnings[0]).toBe("This video can't serve as a Shorts ad because it is horizontal");
  });
  it('formats follow the line item ticks', () => {
    const m = buildPreviewModel(
      { video: video(30), allowedSurfaces: ['IN_FEED'] },
      { filter: 'ALL', format: null, device: 'PHONE', surface: 'YOUTUBE' },
    );
    expect(m.formats).toEqual(['IN_FEED']);
  });
  it('companion banner shows only for computer in-stream', () => {
    const draft = { video: video(30), companionBannerUrl: '/c.png' };
    const pc = buildPreviewModel(draft, { filter: 'ALL', format: 'IN_STREAM_SKIPPABLE', device: 'COMPUTER', surface: 'YOUTUBE' });
    const phone = buildPreviewModel(draft, { filter: 'ALL', format: 'IN_STREAM_SKIPPABLE', device: 'PHONE', surface: 'YOUTUBE' });
    expect(pc.frame.companionBannerUrl).toBe('/c.png');
    expect(phone.frame.companionBannerUrl).toBeUndefined();
  });
});
