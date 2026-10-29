import { describe, expect, it } from 'vitest';
import { FIELD_BY_KEY } from '@/lib/reporting/catalogue';
import { generateReport } from '@/lib/reporting/generate';
import { TEMPLATES, definitionFromTemplate } from '@/lib/reporting/templates';
import { validateForSave } from '@/lib/reporting/engine/rules';

describe('generate report (canned)', () => {
  it('maps "impressions and clicks by device last 14 days"', () => {
    const r = generateReport('impressions and clicks by device last 14 days', '123');
    expect(r.definition.dimensions).toEqual(['device_type']);
    expect(r.definition.metrics).toEqual(['impressions', 'clicks']);
    expect(r.definition.dateRange).toBe('14D_YESTERDAY');
    expect(r.definition.filters).toEqual([{ field: 'partner', op: 'IN', values: ['123'] }]);
    expect(r.ignored).toEqual([]);
  });
  it.each([
    ['conversions by creative yesterday', ['creative'], ['total_conversions'], 'YESTERDAY'],
    ['pacing by insertion order this month', ['insertion_order'], ['budget_segment_pacing_percentage'], 'MONTH_TO_DATE'],
    ['clicks by exchange', ['exchange'], ['clicks'], 'LAST_7_DAYS'],
  ])('%s', (prompt, dims, metrics, range) => {
    const r = generateReport(prompt, '1');
    expect(r.definition.dimensions).toEqual(dims);
    for (const m of metrics) expect(r.definition.metrics).toContain(m);
    expect(r.definition.dateRange).toBe(range);
  });
  it('a trend asks for a time series on Date; unknown words are listed', () => {
    const r = generateReport('impressions trend zebra', '1');
    expect(r.definition.viz.type).toBe('TIME_SERIES');
    expect(r.definition.dimensions).toEqual(['date']);
    expect(r.ignored).toEqual(['zebra']);
  });
  it('falls back to impressions and clicks', () => {
    expect(generateReport('hello', '1').definition.metrics).toEqual(['impressions', 'clicks']);
  });
});

describe('suggested templates', () => {
  it('are seven, in the families of the hub, and use real fields', () => {
    expect(TEMPLATES).toHaveLength(7);
    expect(TEMPLATES.map((t) => t.family)).toEqual(['BASIC', 'BASIC', 'BASIC', 'REACH', 'REACH', 'REACH', 'VIDEO']);
    for (const t of TEMPLATES) {
      for (const k of [...t.definition.dimensions, ...t.definition.metrics])
        expect(FIELD_BY_KEY.has(k), `${t.key}: ${k}`).toBe(true);
    }
  });
  it('each opens as a valid unsaved definition', () => {
    for (const t of TEMPLATES) {
      const d = definitionFromTemplate(t.key, '99');
      expect(d).not.toBeNull();
      expect(validateForSave(d!).filter((i) => i.severity === 'error')).toEqual([]);
    }
    expect(definitionFromTemplate('nope', '99')).toBeNull();
  });
});
