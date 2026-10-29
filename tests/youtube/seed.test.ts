// The synthetic video catalogue (module 09 Δ-09-4, 3.4): ids parse, shapes cover every derive-format row.
import { describe, expect, it } from 'vitest';
import { deriveAdFormats, parseYoutubeRef } from '@/lib/validation/constants/youtube';
import { buildVideoCatalogue } from '@/lib/youtube/seed';

describe('buildVideoCatalogue', () => {
  const videos = buildVideoCatalogue();

  it('has 60 unique videos whose ids parse as YouTube ids', () => {
    expect(videos).toHaveLength(60);
    expect(new Set(videos.map((v) => v.videoId)).size).toBe(60);
    for (const v of videos) expect(parseYoutubeRef(v.videoId)).toBe(v.videoId);
  });

  it('covers bumper, skippable, in-feed and Shorts formats', () => {
    const formats = new Set(videos.flatMap((v) => deriveAdFormats(v)));
    expect([...formats].sort()).toEqual(['BUMPER', 'IN_FEED', 'IN_STREAM_SKIPPABLE', 'SHORTS']);
    expect(videos.some((v) => v.orientation === 'VERTICAL' && v.durationSec === 5)).toBe(true);
    expect(videos.some((v) => v.durationSec === 90)).toBe(true);
  });
});
