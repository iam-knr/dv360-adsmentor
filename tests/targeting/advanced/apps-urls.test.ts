import { describe, expect, it } from 'vitest';
import {
  APPS_URLS_MESSAGES,
  APP_CATALOGUE,
  COLLECTIONS,
  bothModes,
  compositeListCsv,
  countSelected,
  parseBulk,
  urlSuggestions,
} from '@/components/targeting/editors/apps-urls/composite';

describe('Apps & URLs bulk add (TGT-020, TGT-023)', () => {
  it('sorts lines into URLs and app IDs and rejects the rest', () => {
    const r = parseBulk(
      'https://news.example.com/\nexample.org\ncom.example.app\n12345678\nnot valid',
    );
    expect(r.urls).toEqual(['https://news.example.com', 'example.org']);
    expect(r.apps).toEqual(['com.example.app', '12345678']);
    expect(r.rejected).toEqual([{ line: 5, text: 'not valid' }]);
  });
  it('accepts commas and drops duplicates', () => {
    const r = parseBulk('a.com, A.com\n a.com ');
    expect(r.urls).toEqual(['a.com']);
  });
  it('the messages are the validation texts', () => {
    expect(APPS_URLS_MESSAGES.TGT_023.replace('{n}', '2')).toBe("2 entries couldn't be added.");
    expect(APPS_URLS_MESSAGES.TGT_020).toBe('Enter a valid URL or app ID.');
  });
});

describe('Download composite list (AC-10-05)', () => {
  const state = {
    channelIds: [],
    collections: [{ id: COLLECTIONS[0]!.code, mode: 'INCLUDE' as const }],
    urls: [
      { id: 'a.com', mode: 'INCLUDE' as const },
      { id: 'b,"x".com', mode: 'EXCLUDE' as const },
    ],
    apps: [{ id: APP_CATALOGUE[0]!.code, mode: 'EXCLUDE' as const }],
  };
  it('writes a header and one row per selection, quoting cells that need it', () => {
    const lines = compositeListCsv(state).trim().split('\r\n');
    expect(lines[0]).toBe('Type,Value,Name,Mode');
    expect(lines).toHaveLength(5);
    expect(lines[1]).toMatch(/^Collection,COLLECTION_/);
    expect(lines[2]).toBe('URL,a.com,a.com,Include');
    expect(lines[3]).toBe('URL,"b,""x"".com","b,""x"".com",Exclude');
    expect(lines[4]).toContain(`App,${APP_CATALOGUE[0]!.code},${APP_CATALOGUE[0]!.label},Exclude`);
  });
  it('an empty selection is the header only', () => {
    expect(compositeListCsv({ channelIds: [], collections: [], urls: [], apps: [] })).toBe(
      'Type,Value,Name,Mode\r\n',
    );
  });
  it('counts and guards the two modes (TGT-021)', () => {
    expect(countSelected(state)).toBe(4);
    expect(bothModes(state)).toBe(false);
    expect(
      bothModes({
        ...state,
        urls: [
          { id: 'a.com', mode: 'INCLUDE' },
          { id: 'a.com', mode: 'EXCLUDE' },
        ],
      }),
    ).toBe(true);
  });
});

describe('URL suggestions', () => {
  it('come from landing pages and keywords, and are empty without them', () => {
    expect(urlSuggestions([], [])).toEqual([]);
    const s = urlSuggestions(['https://www.shop.example.com/sale'], ['Running Shoes']);
    expect(s).toContain('news.shop.example.com');
    expect(s).toContain('running-shoes.example.com');
  });
});
