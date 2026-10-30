// V-11-16, V-11-21, AC-11-23, AC-11-24: the canned prompt grammar and the view rules.
import { describe, expect, it } from 'vitest';
import { AI_FAILURE, parseChartPrompt, validateCards } from '@/lib/charts/spec';
import { customKey, resolveView, validateView, GRID_COLUMNS } from '@/lib/views/columns';

describe('parseChartPrompt', () => {
  it('builds a bubble chart for the first explore example', () => {
    const r = parseChartPrompt('Bubble chart of CPA vs conversions');
    expect(r).toMatchObject({
      ok: true,
      spec: {
        kind: 'BUBBLE',
        metrics: { x: 'CONVERSIONS', y: 'CPA', size: 'REVENUE' },
        dimension: 'LINE_ITEM',
      },
    });
  });
  it('builds a top N bar chart for the second', () => {
    const r = parseChartPrompt('Conversions for top 5 LIs by revenue');
    expect(r).toMatchObject({
      ok: true,
      spec: {
        kind: 'BAR',
        metrics: { y: 'CONVERSIONS' },
        topN: { by: 'REVENUE', n: 5, entity: 'LINE_ITEM' },
      },
    });
  });
  it('builds a two series line for the third', () => {
    const r = parseChartPrompt('Compare CPMs and CTRs');
    expect(r).toMatchObject({
      ok: true,
      spec: { kind: 'LINE', metrics: { y: 'CPM', extra: ['CTR'] }, dimension: 'DATE' },
    });
  });
  it.each([
    ['pie chart of revenue by campaign', 'PIE', 'CAMPAIGN'],
    ['clicks by exchange', 'BAR', 'EXCHANGE'],
    ['impressions trend', 'LINE', 'DATE'],
    ['daily revenue', 'BAR', 'DATE'],
    ['viewability by device', 'BAR', 'DEVICE'],
    ['top 3 insertion orders by clicks', 'BAR', 'INSERTION_ORDER'],
  ])('reads %s', (text, kind, dimension) => {
    expect(parseChartPrompt(text)).toMatchObject({ ok: true, spec: { kind, dimension } });
  });
  it('answers gibberish and blanks with the failure text', () => {
    for (const t of ['asdf qwerty', '', '   '])
      expect(parseChartPrompt(t)).toEqual({ ok: false, message: AI_FAILURE });
  });
});

describe('cards and views', () => {
  it('limits notes and the number of cards', () => {
    const note = {
      id: 'n',
      kind: 'NOTE' as const,
      title: 'Note',
      ordinal: 0,
      note: 'x'.repeat(501),
    };
    expect(validateCards([note])).toMatch(/500/);
    expect(
      validateCards(Array.from({ length: 13 }, (_, i) => ({ ...note, id: String(i), note: 'ok' }))),
    ).toMatch(/12/);
    expect(validateCards([{ ...note, note: 'ok' }])).toBeNull();
  });
  it('validates view names and columns (V-11-21)', () => {
    const others = [{ id: 'a', name: 'Mine', columns: ['name'] }];
    expect(validateView('', ['name'], others)).toBe('Enter a name.');
    expect(validateView('Mine', ['name'], others)).toMatch(/already exists/);
    expect(validateView('Mine', ['name'], others, 'a')).toBeNull();
    expect(validateView('New', [], others)).toBe('Select at least one column.');
  });
  it('resolves predefined and custom keys and falls back to Performance', () => {
    const custom = [{ id: 'v1', name: 'V', columns: ['name', 'budget', 'nope'] }];
    expect(resolveView('LI', 'custom:v1', custom)).toEqual(['name', 'budget']);
    expect(resolveView('LI', 'summary', custom)).toContain('clicks');
    expect(resolveView('LI', 'gone', custom)).toEqual(resolveView('LI', 'performance', custom));
    expect(customKey('v1')).toBe('custom:v1');
    for (const g of ['CAMPAIGN', 'IO', 'LI'] as const)
      for (const key of ['performance', 'summary', 'pacing', 'optimization'])
        for (const id of resolveView(g, key, []))
          expect(GRID_COLUMNS[g].some((c) => c.id === id)).toBe(true);
  });
});
