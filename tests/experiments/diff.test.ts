// Difference algorithm (module 17 4.4, acceptance 10): omitted equal settings, minimum-difference pairing.
import { describe, expect, it } from 'vitest';
import { diffArms, diffSettings, pairEntities } from '@/lib/experiments/diff';

const e = (name: string, s: Record<string, string>) => ({ name, settings: s });

describe('diffSettings', () => {
  it('lists only the settings that differ and prefixes the entity', () => {
    const rows = diffSettings({ a: '1', b: '2' }, { a: '1', b: '3' }, 'Line item 1');
    expect(rows).toEqual([{ setting: 'Line item 1: b', control: '2', variant: '3' }]);
  });
  it('identical settings give no rows ("No results")', () => {
    expect(diffSettings({ a: '1' }, { a: '1' })).toEqual([]);
  });
  it('a setting on one side only differs from "-"', () => {
    expect(diffSettings({ a: '1' }, {})).toEqual([{ setting: 'a', control: '1', variant: '-' }]);
  });
});

describe('pairEntities', () => {
  it('pairs by the smallest number of differences, not by order', () => {
    const control = [e('A', { x: '1', y: '1' }), e('B', { x: '2', y: '2' })];
    const variant = [e('V1', { x: '2', y: '2' }), e('V2', { x: '1', y: '1' })];
    const pairs = pairEntities(control, variant).map(([c, v]) => `${c?.name}-${v?.name}`);
    expect(pairs.sort()).toEqual(['A-V2', 'B-V1']);
  });
  it('unequal counts: the extra entity is unmatched', () => {
    const pairs = pairEntities([e('A', { x: '1' })], [e('V1', { x: '1' }), e('V2', { x: '9' })]);
    expect(pairs).toHaveLength(2);
    expect(pairs.filter(([c, v]) => c && v)).toHaveLength(1);
    expect(pairs.find(([c]) => !c)?.[1]?.name).toBe('V2');
  });
  it('ties break by name', () => {
    const pairs = pairEntities([e('B', { x: '1' }), e('A', { x: '1' })], [e('V2', { x: '1' }), e('V1', { x: '1' })]);
    expect(pairs[0]?.map((p) => p?.name)).toEqual(['A', 'V1']);
  });
});

describe('diffArms', () => {
  it('reports unmatched entities by name and the differing rows of matched ones', () => {
    const rows = diffArms([e('A', { bid: 'fixed' })], [e('V1', { bid: 'auto' }), e('V2', { bid: 'x' })], 'Line item');
    expect(rows.some((r) => r.setting === 'Line item 1: bid' && r.control === 'fixed' && r.variant === 'auto')).toBe(true);
    expect(rows.some((r) => r.variant === 'V2' || r.control === 'V2')).toBe(true);
  });
  it('identical arms give no rows', () => {
    expect(diffArms([e('A', { bid: 'x' })], [e('B', { bid: 'x' })], 'Line item')).toEqual([]);
  });
});
