import { describe, expect, it } from 'vitest';
import { paramRows, paramText, readEngineParams } from '@/lib/manage/engine';

describe('S12 engine parameter table', () => {
  it('flattens one level and keeps long values short', () => {
    const rows = paramRows({
      currency: 'INR',
      pacing: { aheadFactor: 1.2, list: [1, 2, 3] },
      big: { x: 'y'.repeat(200) },
    });
    expect(rows).toContainEqual({ section: 'general', name: 'currency', value: 'INR' });
    expect(rows).toContainEqual({ section: 'pacing', name: 'aheadFactor', value: '1.2' });
    expect(rows).toContainEqual({ section: 'pacing', name: 'list', value: '[1,2,3]' });
    expect(paramText({ a: 'z'.repeat(200) }).length).toBeLessThanOrEqual(90);
  });
  it('reads the shipped file: a table row for every section and the raw text for the toggle', () => {
    const p = readEngineParams();
    expect(p.hash).toMatch(/^[0-9a-f]{12}$/);
    expect(p.rows.length).toBeGreaterThan(50);
    expect(p.tickMinutes).toBe(60);
    expect(JSON.parse(p.raw)).toBeTypeOf('object');
  });
});
