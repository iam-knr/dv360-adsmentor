// Negative keyword parser (module 15 4.1, KW-002..004).
import { describe, expect, it } from 'vitest';
import { RESOURCE_LIMITS } from '@/lib/resources/limits';
import { parseKeywords } from '@/lib/resources/keywords';

describe('parseKeywords', () => {
  it('splits on newlines and commas, trims, lower-cases and de-duplicates', () => {
    const r = parseKeywords('  Free Download,CRACK\ncrack\n\n, torrent ,Free download');
    expect(r.keywords).toEqual(['free download', 'crack', 'torrent']);
    expect(r.duplicates).toBe(2);
  });

  it('accepts an array of chunks', () => {
    expect(parseKeywords(['a, b', 'c\nd']).keywords).toEqual(['a', 'b', 'c', 'd']);
  });

  it('flags a keyword longer than 80 characters (KW-004)', () => {
    const long = 'x'.repeat(RESOURCE_LIMITS.KEYWORD_LENGTH_MAX + 1);
    expect(parseKeywords(`ok\n${long}`).tooLong).toEqual([{ index: 1, text: long }]);
  });

  it('keeps counting past the cap so the rule can reject it (KW-002)', () => {
    const text = Array.from({ length: RESOURCE_LIMITS.KEYWORDS_MAX + 1 }, (_, i) => `kw${i}`).join(
      '\n',
    );
    expect(parseKeywords(text).keywords).toHaveLength(5001);
  });
});
