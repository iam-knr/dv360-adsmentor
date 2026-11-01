// Search resolver (module 01 8.7, AC-01-13): the 7 chips, synonyms, thresholds, gibberish fallback, partner scope.
import { describe, expect, it } from 'vitest';
import { NO_MATCH_TEXT, resolveSearch, targetHref } from '@/lib/search/resolve';
import { SEARCH_SUGGESTIONS } from '@/lib/search/suggestions';

describe('resolveSearch', () => {
  it('has exactly the 7 chips of the real DV360', () => {
    expect(SEARCH_SUGGESTIONS.map((s) => s.label)).toEqual([
      'YouTube line items',
      'Paused line items',
      'Line items expiring soon',
      'Line items with unused pacing',
      'IOs with pacing type AHEAD',
      'LIs with CPC over X last week',
      'LIs with CPA over X last week',
    ]);
  });

  it('maps each chip text to its saved filter link', () => {
    for (const s of SEARCH_SUGGESTIONS) {
      const r = resolveSearch(s.label);
      expect(r.target, s.label).toEqual({ route: s.route, query: s.query });
      expect(r.interpretation).toBe(`Showing ${s.intent}`);
    }
  });

  it('AC-01-13: "paused line items" is [A]/explorerlis?f.status=PAUSED', () => {
    const r = resolveSearch('paused line items');
    expect(r.interpretation).toBe('Showing paused line items');
    expect(targetHref('/p/1/a/2', r.target!)).toBe('/p/1/a/2/explorerlis?f.status=PAUSED');
  });

  it('AC-01-13: "IOs with pacing type ahead" is [A]/explorerios?f.pacingType=AHEAD', () => {
    const r = resolveSearch('IOs with pacing type ahead');
    expect(targetHref('/p/1/a/2', r.target!)).toBe('/p/1/a/2/explorerios?f.pacingType=AHEAD');
  });

  it.each([
    ['paused LIs', 'explorerlis', { 'f.status': ['PAUSED'] }],
    ['Paused Line Items', 'explorerlis', { 'f.status': ['PAUSED'] }],
    ['show me the paused line items', 'explorerlis', { 'f.status': ['PAUSED'] }],
    ['active campaigns', 'cs', { 'f.status': ['ACTIVE'] }],
    ['archived insertion orders', 'explorerios', { 'f.status': ['ARCHIVED'] }],
    ['draft IOs', 'explorerios', { 'f.status': ['DRAFT'] }],
    ['pacing ahead', 'explorerios', { 'f.pacingType': ['AHEAD'] }],
    ['ASAP pacing line items', 'explorerlis', { 'f.pacingType': ['ASAP'] }],
    ['campaigns', 'cs', {}],
    ['line items ending soon', 'explorerlis', { 'f.endsWithin': ['7'] }],
    ['underpacing line items', 'explorerlis', { 'f.pacing': ['UNDER'], d: ['LIFETIME'] }],
  ])('synonym "%s"', (phrase, route, query) => {
    const r = resolveSearch(phrase);
    expect(r.target).toEqual({ route, query });
  });

  it('YouTube shows every status unless one is named', () => {
    expect(resolveSearch('youtube line items').target?.query).toEqual({
      'f.type': ['YT_VIDEO', 'YT_AUDIO', 'YT_ON_CTV'],
      'f.status': ['*'],
    });
    expect(resolveSearch('paused YouTube LIs').target?.query).toEqual({
      'f.type': ['YT_VIDEO', 'YT_AUDIO', 'YT_ON_CTV'],
      'f.status': ['PAUSED'],
    });
  });

  it('reads numeric thresholds for CPC and CPA', () => {
    expect(resolveSearch('LIs with CPC over 2.5 last week').target?.query).toEqual({
      'f.cpcOver': ['2.5'],
      d: ['LAST_WEEK'],
    });
    expect(resolveSearch('line items with cpa above $1,200').target?.query).toEqual({
      'f.cpaOver': ['1200'],
      d: ['LAST_WEEK'],
    });
    const r = resolveSearch('LIs with CPA over 30 last 30 days');
    expect(r.target?.query).toEqual({ 'f.cpaOver': ['30'], d: ['LAST_30_DAYS'] });
    expect(r.interpretation).toBe('Showing line items with CPA over 30 in the last 30 days');
  });

  it('uses the default threshold for the X chips and says so in the link', () => {
    expect(resolveSearch('LIs with CPC over X last week').target?.query['f.cpcOver']).toEqual([
      '1',
    ]);
    expect(resolveSearch('LIs with CPA over X last week').target?.query['f.cpaOver']).toEqual([
      '20',
    ]);
  });

  it('falls back to a name/ID search for gibberish, with the no-match text', () => {
    const r = resolveSearch('asdf qwerty');
    expect(r.target).toBeNull();
    expect(r.interpretation).toBe(NO_MATCH_TEXT);
    expect(r.fallback).toEqual({ route: 'cs', query: { q: ['asdf qwerty'], 'f.status': ['*'] } });
  });

  it('does not drop unknown words: "paused festive" is a name search', () => {
    expect(resolveSearch('paused festive line items').target).toBeNull();
    expect(resolveSearch('1234567').target).toBeNull();
    expect(resolveSearch('').target).toBeNull();
    expect(resolveSearch('campaigns and ios').target).toBeNull();
  });

  it('YouTube campaigns make no sense: name search', () => {
    expect(resolveSearch('youtube campaigns').target).toBeNull();
    expect(resolveSearch('IOs with cpc over 3').target).toBeNull();
  });

  it('on partner pages searches advertisers by name or ID only', () => {
    const r = resolveSearch('paused line items', 'partner');
    expect(r.target).toEqual({ route: 'advertisers', query: { q: ['paused line items'] } });
    expect(targetHref('/p/1', r.target!)).toBe('/p/1/advertisers?q=paused+line+items');
  });
});
