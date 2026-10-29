// One case per CRE rule, valid and invalid (module 12 6.3, validation.md 2.18).
import { describe, expect, it } from 'vitest';
import { CREATIVE_KINDS } from '@/lib/creatives/kinds';
import { youtubeIdOf } from '@/lib/validation/rules/creative';
import type { CreativeInput } from '@/lib/validation/types';
import { ids, png, run, TAG, valid } from './fixtures';

const v = (kind: string, patch: Partial<CreativeInput> = {}): CreativeInput => ({
  ...valid[kind]!,
  ...patch,
});

describe('valid creatives', () => {
  it.each(Object.keys(valid))('%s has no blocking issue', (kind) => {
    expect(ids(run(valid[kind]!), 'error')).toEqual([]);
  });
  it('every kind has a fixture or is a variant of one', () => {
    for (const k of CREATIVE_KINDS) {
      if (k === 'NATIVE_VIDEO') continue;
      expect(valid[k], k).toBeTruthy();
    }
  });
});

describe('CRE rules', () => {
  it('CRE-001 empty name', () => {
    expect(ids(run(v('THIRD_PARTY_DISPLAY', { name: ' ' })))).toContain('CRE-001');
    expect(
      run(v('THIRD_PARTY_DISPLAY', { name: '' })).find((i) => i.ruleId === 'CRE-001')?.message,
    ).toBe('Enter a value');
  });
  it('CRE-002 name over 512', () => {
    expect(ids(run(v('STANDARD_IMAGE', { name: 'x'.repeat(513) })))).toContain('CRE-002');
    expect(ids(run(v('STANDARD_IMAGE', { name: 'x'.repeat(512) })))).not.toContain('CRE-002');
  });
  it('CRE-003 third-party display needs a size', () => {
    const issue = run(v('THIRD_PARTY_DISPLAY', { width: 0, height: 0 })).find(
      (i) => i.ruleId === 'CRE-003',
    );
    expect(issue?.message).toBe("Enter the creative's width and height.");
    expect(ids(run(v('STANDARD_IMAGE')))).not.toContain('CRE-003');
  });
  it('CRE-004 landing page: empty or prefill, invalid, too long', () => {
    expect(
      run(v('THIRD_PARTY_DISPLAY', { landingPageUrl: 'http://' })).find(
        (i) => i.ruleId === 'CRE-004',
      )?.message,
    ).toBe('Enter a value');
    expect(
      run(v('THIRD_PARTY_DISPLAY', { landingPageUrl: 'not a url' })).find(
        (i) => i.ruleId === 'CRE-004',
      )?.message,
    ).toBe('Enter a valid URL.');
    expect(
      ids(run(v('THIRD_PARTY_DISPLAY', { landingPageUrl: `https://e.com/${'a'.repeat(1030)}` }))),
    ).toContain('CRE-004');
    // optional on VAST and audio kinds
    expect(ids(run(v('THIRD_PARTY_VIDEO', { landingPageUrl: '' })))).not.toContain('CRE-004');
    expect(ids(run(v('AUDIO_FILE')))).not.toContain('CRE-004');
  });
  it('CRE-005 empty tag', () => {
    expect(ids(run(v('THIRD_PARTY_DISPLAY', { thirdPartyTag: '' })))).toContain('CRE-005');
  });
  it('CRE-006 tag without click macro is a warning, variants accepted', () => {
    const issues = run(
      v('THIRD_PARTY_DISPLAY', { thirdPartyTag: '<img src="https://e.com/a.png">' }),
    );
    expect(issues.find((i) => i.ruleId === 'CRE-006')?.severity).toBe('warning');
    for (const macro of ['${CLICK_URL}', '${CLICK_URL_ESC}', '%%CLICK_URL_UNESC%%', '[CLICK_URL]'])
      expect(
        ids(run(v('THIRD_PARTY_DISPLAY', { thirdPartyTag: `<a href="${macro}x">` }))),
      ).not.toContain('CRE-006');
  });
  it('CRE-007 expands on hover needs a direction', () => {
    expect(
      ids(run(v('THIRD_PARTY_DISPLAY', { expandsOnHover: true, expandDirection: 'NONE' }))),
    ).toContain('CRE-007');
    expect(
      ids(run(v('THIRD_PARTY_DISPLAY', { expandsOnHover: true, expandDirection: 'UP' }))),
    ).not.toContain('CRE-007');
  });
  it('CRE-008 never fires from the form (needs a line item)', () => {
    expect(ids(run(v('THIRD_PARTY_DISPLAY', { requiresMraid: true })))).not.toContain('CRE-008');
  });
  it('CRE-009 integration code over 500 bytes', () => {
    expect(ids(run(v('STANDARD_IMAGE', { integrationCode: 'é'.repeat(251) })))).toContain(
      'CRE-009',
    );
    expect(ids(run(v('STANDARD_IMAGE', { integrationCode: 'é'.repeat(250) })))).not.toContain(
      'CRE-009',
    );
  });
  it('CRE-010 status on edit only', () => {
    expect(ids(run(v('STANDARD_IMAGE', { status: null }), { mode: 'edit' }))).toContain('CRE-010');
    expect(
      ids(
        run(v('STANDARD_IMAGE', { status: 'PAUSED' }), {
          mode: 'edit',
          original: v('STANDARD_IMAGE', { status: 'PAUSED' }),
        }),
      ),
    ).not.toContain('CRE-010');
    expect(ids(run(v('STANDARD_IMAGE')))).not.toContain('CRE-010');
  });
  it('CRE-011 http tag warns about SSL', () => {
    const issues = run(
      v('THIRD_PARTY_DISPLAY', {
        thirdPartyTag: TAG.replace('https://example.com/ad', 'http://example.com/ad'),
      }),
    );
    expect(issues.find((i) => i.ruleId === 'CRE-011')?.severity).toBe('warning');
    expect(ids(run(v('THIRD_PARTY_DISPLAY')))).not.toContain('CRE-011');
  });
  it('CRE-012 consent notice is info on third-party display', () => {
    expect(run(v('THIRD_PARTY_DISPLAY')).find((i) => i.ruleId === 'CRE-012')?.severity).toBe(
      'info',
    );
    expect(ids(run(v('STANDARD_IMAGE')))).not.toContain('CRE-012');
  });
  it('CRE-020 image type and size', () => {
    expect(
      ids(run(v('STANDARD_IMAGE', { mainAsset: png({ sizeBytes: 150 * 1024 + 1 }) }))),
    ).toContain('CRE-020');
    expect(
      ids(
        run(v('STANDARD_IMAGE', { mainAsset: png({ fileName: 'a.bmp', mimeType: 'image/bmp' }) })),
      ),
    ).toContain('CRE-020');
    expect(ids(run(v('STANDARD_IMAGE', { mainAsset: null })))).toContain('CRE-020');
    expect(
      ids(run(v('STANDARD_IMAGE', { mainAsset: png({ sizeBytes: 150 * 1024 }) }))),
    ).not.toContain('CRE-020');
  });
  it('CRE-021 HTML5 zip with one entry file', () => {
    const zip = (over: object) => ({
      fileName: 'a.zip',
      mimeType: 'application/zip',
      sizeBytes: 1000,
      entryHtml: true,
      ...over,
    });
    expect(ids(run(v('STANDARD_HTML5', { mainAsset: zip({ entryHtml: false }) })))).toContain(
      'CRE-021',
    );
    expect(ids(run(v('STANDARD_HTML5', { mainAsset: zip({ fileName: 'a.rar' }) })))).toContain(
      'CRE-021',
    );
    expect(
      ids(run(v('STANDARD_HTML5', { mainAsset: zip({ sizeBytes: 10 * 1024 * 1024 + 1 }) }))),
    ).toContain('CRE-021');
    expect(ids(run(v('STANDARD_HTML5')))).not.toContain('CRE-021');
  });
  it('CRE-022 video type, size, duration', () => {
    const vid = (over: object) => ({
      fileName: 's.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 1000,
      durationSeconds: 15,
      ...over,
    });
    expect(ids(run(v('VIDEO_FILE', { mainAsset: vid({ mimeType: 'video/avi' }) })))).toContain(
      'CRE-022',
    );
    expect(ids(run(v('VIDEO_FILE', { mainAsset: vid({ durationSeconds: 601 }) })))).toContain(
      'CRE-022',
    );
    expect(ids(run(v('VIDEO_FILE', { mainAsset: vid({ durationSeconds: 4 }) })))).toContain(
      'CRE-022',
    );
    expect(ids(run(v('VIDEO_FILE')))).not.toContain('CRE-022');
  });
  it('CRE-023 audio type and 5 to 180 seconds', () => {
    const aud = (over: object) => ({
      fileName: 'a.mp3',
      mimeType: 'audio/mpeg',
      sizeBytes: 1000,
      durationSeconds: 30,
      ...over,
    });
    expect(ids(run(v('AUDIO_FILE', { mainAsset: aud({ durationSeconds: 181 }) })))).toContain(
      'CRE-023',
    );
    expect(ids(run(v('AUDIO_FILE', { mainAsset: aud({ durationSeconds: 4 }) })))).toContain(
      'CRE-023',
    );
    expect(ids(run(v('AUDIO_FILE', { mainAsset: aud({ mimeType: 'audio/wav' }) })))).toContain(
      'CRE-023',
    );
    expect(ids(run(v('AUDIO_FILE')))).not.toContain('CRE-023');
  });
  it('CRE-024 VAST', () => {
    expect(
      run(v('THIRD_PARTY_VIDEO', { vastTag: '' })).find((i) => i.ruleId === 'CRE-024')?.message,
    ).toBe('Enter a value');
    expect(
      run(v('THIRD_PARTY_VIDEO', { vastTag: '<html></html>' })).find((i) => i.ruleId === 'CRE-024')
        ?.message,
    ).toBe('Enter a valid VAST tag.');
    expect(
      ids(run(v('THIRD_PARTY_AUDIO', { vastTag: '<VAST version="4.2"></VAST>' }))),
    ).not.toContain('CRE-024');
  });
  it('CRE-025 YouTube id', () => {
    expect(ids(run(v('YOUTUBE_VIDEO', { youtubeVideo: 'short' })))).toContain('CRE-025');
    expect(
      ids(run(v('YOUTUBE_VIDEO', { youtubeVideo: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }))),
    ).not.toContain('CRE-025');
    expect(youtubeIdOf('https://youtu.be/dQw4w9WgXcQ?t=3')).toBe('dQw4w9WgXcQ');
    expect(youtubeIdOf('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });
  it('CRE-026 non-standard size warns', () => {
    expect(
      run(v('THIRD_PARTY_DISPLAY', { width: 301, height: 251 })).find((i) => i.ruleId === 'CRE-026')
        ?.severity,
    ).toBe('warning');
    expect(ids(run(v('THIRD_PARTY_DISPLAY')))).not.toContain('CRE-026');
  });
  it('CRE-030 AI label is info on uploaded kinds only', () => {
    expect(ids(run(v('STANDARD_IMAGE')))).toContain('CRE-030');
    expect(ids(run(v('THIRD_PARTY_DISPLAY')))).not.toContain('CRE-030');
  });
  it('CRE-043 appeal on a servable creative', () => {
    expect(ids(run({ ...v('STANDARD_IMAGE'), appeal: { servableEverywhere: true } }))).toContain(
      'CRE-043',
    );
    expect(
      ids(run({ ...v('STANDARD_IMAGE'), appeal: { servableEverywhere: false } })),
    ).not.toContain('CRE-043');
  });
  it('CRE-060 CM360 creatives keep only name and status', () => {
    const original = { ...v('THIRD_PARTY_DISPLAY'), source: 'CM360' as const };
    const edit = (patch: Partial<CreativeInput>) =>
      run({ ...original, ...patch }, { mode: 'edit', original: { ...original, status: 'ACTIVE' } });
    expect(ids(edit({ landingPageUrl: 'https://other.example.com', status: 'ACTIVE' }))).toContain(
      'CRE-060',
    );
    expect(ids(edit({ name: 'Renamed', status: 'PAUSED' }))).not.toContain('CRE-060');
  });
  it('CRE-070 pausing a creative on active line items warns with the count', () => {
    const original = { ...v('STANDARD_IMAGE'), status: 'ACTIVE' as const };
    const issues = run(
      { ...original, status: 'PAUSED', activeLineItemCount: 3 },
      { mode: 'edit', original },
    );
    const w = issues.find((i) => i.ruleId === 'CRE-070');
    expect(w?.severity).toBe('warning');
    expect(w?.message).toBe('This creative is assigned to 3 active line items.');
    expect(
      ids(
        run({ ...original, status: 'PAUSED', activeLineItemCount: 0 }, { mode: 'edit', original }),
      ),
    ).not.toContain('CRE-070');
  });
  it('CRE-100 native text assets', () => {
    const native = (n: object) =>
      v('NATIVE_SITE', { native: { ...valid.NATIVE_SITE!.native, ...n } });
    expect(run(native({ headline: '' })).find((i) => i.ruleId === 'CRE-100')?.message).toBe(
      'Enter a value',
    );
    expect(
      run(native({ headline: 'x'.repeat(26) })).find((i) => i.ruleId === 'CRE-100')?.message,
    ).toBe('Use 25 characters or fewer.');
    expect(ids(run(native({ body: 'x'.repeat(91) })))).toContain('CRE-100');
  });
  it('CRE-101 native needs a main image and a logo', () => {
    expect(
      run(v('NATIVE_SITE', { logoAsset: null })).find((i) => i.ruleId === 'CRE-101')?.message,
    ).toBe('Add a main image and a logo.');
    expect(ids(run(v('NATIVE_SITE')))).not.toContain('CRE-101');
  });
  it('CRE-100 and CRE-101 on the Optimized asset group', () => {
    const optimized = (o: object) =>
      v('NATIVE_SITE', {
        formatKey: 'OPTIMIZED',
        native: undefined,
        optimized: {
          headlines: ['Buy now'],
          descriptions: ['A short text'],
          imageCount: 1,
          logoCount: 1,
          businessName: 'Brand',
          callToAction: 'Shop',
          ...o,
        },
      });
    expect(ids(run(optimized({})), 'error')).toEqual([]);
    expect(run(optimized({ headlines: [''] })).find((i) => i.ruleId === 'CRE-100')?.path).toBe(
      'optimized.headlines[0]',
    );
    expect(
      run(optimized({ headlines: ['Buy now', 'x'.repeat(31)] })).find((i) => i.ruleId === 'CRE-100')
        ?.message,
    ).toBe('Use 30 characters or fewer.');
    expect(ids(run(optimized({ businessName: '' })))).toContain('CRE-100');
    expect(ids(run(optimized({ imageCount: 0 })))).toContain('CRE-101');
    expect(ids(run(optimized({ logoCount: 0 })))).toContain('CRE-101');
  });
  it('CRE-102 skip offset', () => {
    expect(ids(run(v('VIDEO_FILE', { skippable: true, skipOffsetSec: 15 })))).toContain('CRE-102');
    expect(ids(run(v('VIDEO_FILE', { skippable: true, skipOffsetSec: 5 })))).not.toContain(
      'CRE-102',
    );
    expect(ids(run(v('VIDEO_FILE', { skippable: false, skipOffsetSec: 99 })))).not.toContain(
      'CRE-102',
    );
  });
  it('CRE-103 oversized logo', () => {
    expect(
      ids(run(v('NATIVE_SITE', { logoAsset: png({ sizeBytes: 6 * 1024 * 1024 }) }))),
    ).toContain('CRE-103');
  });
  it('CRE-104 gallery formats built outside the simulator', () => {
    expect(ids(run(v('NATIVE_SITE', { formatKey: 'PARALLAX' })))).toContain('CRE-104');
    expect(ids(run(v('NATIVE_SITE', { formatKey: 'OPTIMIZED' })))).not.toContain('CRE-104');
  });
});
