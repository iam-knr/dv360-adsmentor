// The YouTube section of the line item form and its columns (module 09 3.2, 2.7).
import { describe, expect, it } from 'vitest';
import {
  defaultYoutubeInput,
  formatsToSurfaces,
  isYoutubeType,
  surfacesToFormats,
  youtubeColumns,
  youtubeFromRow,
} from '@/lib/youtube/li';

describe('defaultYoutubeInput', () => {
  it('maps the step 1 choice to the subtype and starts with every format and source', () => {
    const efficient = defaultYoutubeInput('YT_VIDEO', {
      optimization: 'REACH',
      choice: 'EFFICIENT',
    });
    expect(efficient).toMatchObject({
      subtype: 'EFFICIENT_REACH',
      adFormats: { inStream: true, inFeed: true, shorts: true },
      inventorySources: ['YOUTUBE', 'GOOGLE_TV', 'VIDEO_PARTNERS'],
      targetFrequency: null,
    });
    const tf = defaultYoutubeInput('YT_VIDEO', {
      optimization: 'TARGET_FREQUENCY',
      choice: 'IN_STREAM_ONLY',
    });
    expect(tf.subtype).toBe('TARGET_FREQUENCY_IN_STREAM');
    expect(tf.adFormats).toEqual({ inStream: true, inFeed: false, shorts: false });
    expect(tf.targetFrequency).toMatchObject({ mode: 'LIMITED', maxImpressions: '' });
    expect(
      defaultYoutubeInput('YT_VIDEO', { optimization: 'TRUEVIEW_VIEWS', choice: null }).subtype,
    ).toBe('TRUEVIEW_VIEWS');
    expect(defaultYoutubeInput('YT_AUDIO').subtype).toBe('AUDIO_REACH');
  });

  it('knows the YouTube types', () => {
    expect(['YT_VIDEO', 'YT_AUDIO', 'YT_ON_CTV'].every(isYoutubeType)).toBe(true);
    expect(isYoutubeType('VIDEO')).toBe(false);
    expect(isYoutubeType(null)).toBe(false);
  });
});

describe('formats and surfaces', () => {
  it('round-trips the ticks and ignores them for fixed subtypes', () => {
    const ticks = { inStream: true, inFeed: false, shorts: true };
    expect(formatsToSurfaces('EFFICIENT_REACH', ticks)).toEqual(['IN_STREAM', 'SHORTS']);
    expect(surfacesToFormats(['IN_STREAM', 'SHORTS'])).toEqual(ticks);
    expect(formatsToSurfaces('NON_SKIPPABLE_REACH', ticks)).toEqual(['IN_STREAM']);
  });
});

describe('youtubeColumns and youtubeFromRow', () => {
  it('stores the view cap only where the subtype has one (MX-07)', () => {
    const base = defaultYoutubeInput('YT_VIDEO', { optimization: 'REACH', choice: 'EFFICIENT' });
    const cols = youtubeColumns(
      {
        ...base,
        viewCap: { mode: 'LIMITED', maxImpressions: '3', periodCount: 2, period: 'DAY' },
        productFeed: true,
        relatedVideoIds: ['a', 'a', 'b'],
      },
      'EFFICIENT_REACH',
    );
    expect(cols).toMatchObject({
      ytSubtype: 'EFFICIENT_REACH',
      viewFreqMode: 'LIMITED',
      viewFreqMax: 3,
      viewFreqUnit: 'DAY',
      viewFreqUnitCount: 2,
      productFeedEnabled: true,
      relatedVideoIds: ['a', 'b'],
      targetFreqExposures: null,
    });
    const tf = defaultYoutubeInput('YT_VIDEO', {
      optimization: 'TARGET_FREQUENCY',
      choice: 'ALL_FORMATS',
    });
    const tfCols = youtubeColumns(
      {
        ...tf,
        viewCap: { mode: 'LIMITED', maxImpressions: 9 },
        targetFrequency: { mode: 'LIMITED', maxImpressions: '4', periodCount: 1, period: 'WEEK' },
      },
      'TARGET_FREQUENCY',
    );
    expect(tfCols).toMatchObject({
      viewFreqMode: 'UNLIMITED',
      viewFreqMax: null,
      targetFreqExposures: 4,
      targetFreqUnit: 'WEEK',
    });
  });

  it('reads a stored row back into the form section', () => {
    const yt = youtubeFromRow(
      {
        ytSubtype: 'TARGET_FREQUENCY',
        ytSurfaces: ['IN_STREAM', 'IN_FEED', 'SHORTS'],
        viewFreqMode: 'UNLIMITED',
        viewFreqMax: null,
        viewFreqUnit: null,
        viewFreqUnitCount: null,
        targetFreqExposures: 4,
        targetFreqUnit: 'WEEK',
        targetFreqUnitCount: 1,
        productFeedEnabled: false,
        relatedVideoIds: [],
      },
      ['YOUTUBE'],
      0,
    );
    expect(yt).toMatchObject({
      subtype: 'TARGET_FREQUENCY',
      inventorySources: ['YOUTUBE'],
      targetFrequency: { maxImpressions: 4, period: 'WEEK' },
    });
  });
});
