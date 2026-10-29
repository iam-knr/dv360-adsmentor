import { describe, expect, it } from 'vitest';
import {
  applyFilters,
  interpretPhrase,
  keywordScore,
  rank,
  type SearchableProduct,
} from '@/lib/inventory/discover';

const p = (o: Partial<SearchableProduct> & { id: string; name: string }): SearchableProduct => ({
  type: 'PACKAGE',
  exchangeId: 'e1',
  exchangeName: 'Exchange',
  searchText: '',
  sevenDayImpressions: 1000,
  format: 'DISPLAY',
  device: ['Desktop'],
  categories: [],
  country: ['India'],
  genre: [],
  ...o,
});
const rows = [
  p({ id: '1', name: 'Premium CTV Video', format: 'VIDEO', device: ['Connected TV'], searchText: 'streaming premium', sevenDayImpressions: 500 }),
  p({ id: '2', name: 'News Display', categories: ['News'], searchText: 'banner news', sevenDayImpressions: 900 }),
  p({ id: '3', name: 'Video Highlights', format: 'VIDEO', searchText: 'sports clips', categories: ['Sports'], sevenDayImpressions: 800 }),
];

describe('keyword search', () => {
  it('requires every token and ranks name hits first', () => {
    const r = rank(rows, 'video', {}, 'KEYWORD');
    expect(r.rows.map((x) => x.id)).toEqual(['3', '1']); // equal score, more impressions first
    expect(keywordScore('video sports', rows[2]!)).toBeGreaterThan(0);
    expect(keywordScore('video sports', rows[0]!)).toBe(0);
  });
  it('empty query keeps everything, ordered by impressions', () => {
    expect(rank(rows, '', {}, 'KEYWORD').rows.map((x) => x.id)).toEqual(['2', '3', '1']);
  });
  it('combines text with filters', () => {
    const r = rank(rows, 'video', { format: ['VIDEO'], deviceType: ['Connected TV'] }, 'KEYWORD');
    expect(r.rows.map((x) => x.id)).toEqual(['1']);
    expect(applyFilters(rows[1]!, { format: ['VIDEO'] })).toBe(false);
  });
});

describe('AI mode (canned phrase rules)', () => {
  it('maps phrases to filters and reports chips', () => {
    const i = interpretPhrase('sports video for mobile in India');
    expect(i.filters.format).toEqual(['VIDEO']);
    expect(i.filters.country).toEqual(['India']);
    expect(i.chips).toEqual(
      expect.arrayContaining(['Format: Video', 'Device: Mobile', 'Country: India', 'Category: Sports']),
    );
  });
  it('applies the interpreted filters to the results', () => {
    const r = rank(rows, 'sports video', {}, 'AI');
    expect(r.rows.map((x) => x.id)).toEqual(['3']);
    expect(r.chips).toContain('Category: Sports');
  });
});
