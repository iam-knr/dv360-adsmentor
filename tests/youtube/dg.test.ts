// Demand Gen ad rules and preview caption (module 09 4.6, V-09-14, AC-09-23).
import { describe, expect, it } from 'vitest';
import { dgCaption, dgIssues, isDgFormat, type DgAdFields } from '@/lib/youtube/dg';

const ok: DgAdFields = {
  dgFormat: 'DEMAND_GEN_IMAGE',
  videoId: null,
  videoFound: false,
  imageAssetIds: ['a'],
  headline: 'x'.repeat(40),
  description: 'y'.repeat(90),
  businessName: 'z'.repeat(25),
};
const ids = (a: DgAdFields) => dgIssues(a).map((i) => `${i.ruleId}:${i.path}`);

describe('dgIssues', () => {
  it('accepts the limits exactly (40 / 90 / 25)', () => {
    expect(dgIssues(ok)).toEqual([]);
  });

  it('LI-DG-007..009 fire one past the limit', () => {
    expect(ids({ ...ok, headline: 'x'.repeat(41) })).toEqual(['LI-DG-007:headline']);
    expect(ids({ ...ok, description: 'y'.repeat(91) })).toEqual(['LI-DG-008:description']);
    expect(ids({ ...ok, businessName: 'z'.repeat(26) })).toEqual(['LI-DG-009:businessName']);
    expect(ids({ ...ok, businessName: '  ' })).toEqual(['LI-DG-009:businessName']);
  });

  it('needs a format, then the media of that format', () => {
    expect(ids({ ...ok, dgFormat: null })).toEqual(['AD-DG-001:dgFormat']);
    expect(ids({ ...ok, imageAssetIds: [] })).toEqual(['AD-DG-003:imageAssetIds']);
    const video = { ...ok, dgFormat: 'DEMAND_GEN_VIDEO' as const, imageAssetIds: [] };
    expect(ids(video)).toEqual(['AD-DG-002:videoRef']);
    expect(ids({ ...video, videoId: 'SIMbump0001', videoFound: true })).toEqual([]);
    expect(ids({ ...video, videoId: 'SIMbump0001', videoFound: false })).toEqual([
      'AD-DG-002:videoRef',
    ]);
  });

  it('a carousel takes 2 to 10 images', () => {
    const carousel = { ...ok, dgFormat: 'DEMAND_GEN_CAROUSEL' as const };
    expect(ids({ ...carousel, imageAssetIds: ['a'] })).toEqual(['AD-DG-003:imageAssetIds']);
    expect(ids({ ...carousel, imageAssetIds: ['a', 'b'] })).toEqual([]);
    expect(
      ids({ ...carousel, imageAssetIds: Array.from({ length: 11 }, (_, i) => `i${i}`) }),
    ).toEqual(['AD-DG-003:imageAssetIds']);
  });
});

describe('dg helpers', () => {
  it('recognises the three formats and builds the caption', () => {
    expect(isDgFormat('DEMAND_GEN_VIDEO')).toBe(true);
    expect(isDgFormat('RESPONSIVE')).toBe(false);
    expect(isDgFormat(null)).toBe(false);
    expect(dgCaption('DEMAND_GEN_CAROUSEL', 'GMAIL')).toBe(
      'Example of your carousel ad in Gmail promotion',
    );
  });
});
