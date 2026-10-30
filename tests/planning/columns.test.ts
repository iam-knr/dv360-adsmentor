// Plan table columns (module 04 2.2, AC-04-13, AC-04-16): defaults, groups, normalisation, CSV column order.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLAN_COLUMNS,
  PLAN_COLUMNS,
  PLAN_COLUMN_GROUPS,
  normalizePlanColumns,
} from '@/lib/planning/columns';

describe('plan columns', () => {
  it('the default view is the seventeen columns of the spec, Name first', () => {
    expect(DEFAULT_PLAN_COLUMNS).toHaveLength(17);
    expect(DEFAULT_PLAN_COLUMNS[0]).toBe('name');
    expect(DEFAULT_PLAN_COLUMNS).not.toContain('trueviewViews');
    expect(DEFAULT_PLAN_COLUMNS).not.toContain('conversions');
  });
  it('every column belongs to one of the four groups', () => {
    const groups = new Set(PLAN_COLUMN_GROUPS.map((g) => g.id));
    for (const c of PLAN_COLUMNS) expect(groups.has(c.group)).toBe(true);
  });
  it('Name is locked and first, unknown and repeated ids are dropped', () => {
    expect(normalizePlanColumns(['budget', 'bogus', 'name', 'budget', 'trps'])).toEqual([
      'name',
      'budget',
      'trps',
    ]);
  });
  it('an empty or missing order falls back to the default', () => {
    expect(normalizePlanColumns(null)).toEqual(DEFAULT_PLAN_COLUMNS);
    expect(normalizePlanColumns([])).toEqual(DEFAULT_PLAN_COLUMNS);
    expect(normalizePlanColumns(['name'])).toEqual(DEFAULT_PLAN_COLUMNS);
  });
  it('reorder persistence payload keeps the order given', () => {
    expect(normalizePlanColumns(['trps', 'budget', 'name'])).toEqual(['name', 'trps', 'budget']);
  });
});
