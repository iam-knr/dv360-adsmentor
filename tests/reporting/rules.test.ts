// Validation rules RPT-001..020 (module 16 4.6, 6.3 rules.report).
import { describe, expect, it } from 'vitest';
import {
  ruleFileName,
  ruleName,
  ruleSchedule,
  ruleShare,
  ruleTruncated,
  ruleViz,
  validateForRun,
  validateForSave,
} from '@/lib/reporting/engine/rules';
import type { ReportDefinition } from '@/lib/reporting/types';

const def = (over: Partial<ReportDefinition> = {}): ReportDefinition => ({
  kind: 'INSTANT',
  name: 'R',
  timeZone: 'ADVERTISER',
  dateRange: 'LAST_7_DAYS',
  filters: [{ field: 'partner', op: 'IN', values: ['1'] }],
  dimensions: ['advertiser'],
  metrics: ['impressions'],
  viz: { type: 'TABLE' },
  ...over,
});
const ctx = (over = {}) => ({
  today: '2026-10-28',
  range: { from: '2026-10-21', to: '2026-10-27' },
  hourlyRetentionDays: 14,
  allowPartnerCost: true,
  ...over,
});
const ids = (d: ReportDefinition, c = ctx()) => validateForRun(d, c).map((i) => i.ruleId);

describe('report rules', () => {
  it('RPT-001 and RPT-019: name', () => {
    expect(ruleName('').map((i) => i.ruleId)).toEqual(['RPT-001']);
    expect(ruleName('x'.repeat(255))).toEqual([]);
    expect(ruleName('x'.repeat(256)).map((i) => i.ruleId)).toEqual(['RPT-019']);
  });
  it('RPT-002 is the UI gate: a draft without metrics still saves', () => {
    expect(validateForSave(def({ metrics: [] })).filter((i) => i.severity === 'error')).toEqual([]);
  });
  it('RPT-003: expires before starts; RPT-004: empty file name', () => {
    const s = { active: true, timeZone: 'UTC', repeats: 'DAILY' as const, every: 1, starts: '2026-10-10' };
    expect(ruleSchedule({ ...s, expires: '2026-10-01' }).map((i) => i.ruleId)).toEqual(['RPT-003']);
    expect(ruleSchedule({ ...s, every: 0 }).map((i) => i.ruleId)).toEqual(['RPT-003']);
    expect(ruleFileName(' ').map((i) => i.ruleId)).toEqual(['RPT-004']);
    const off = validateForSave(
      def({ kind: 'OFFLINE', offlineType: 'FLOODLIGHT', schedule: s, delivery: { format: 'CSV', fileName: '', emailOwner: false, shareWith: [] } }),
    );
    expect(off.map((i) => i.ruleId)).toContain('RPT-004');
  });
  it('RPT-010: no metric', () => {
    expect(ids(def({ metrics: [] }))).toContain('RPT-010');
    expect(ids(def())).toEqual([]);
  });
  it('RPT-011: incompatible fields, with the field names in the message', () => {
    const issues = validateForRun(def({ metrics: ['impression_reach'], dimensions: ['device_type'] }), ctx());
    expect(issues.map((i) => i.ruleId)).toContain('RPT-011');
    expect(issues.find((i) => i.ruleId === 'RPT-011')?.message).toMatch(/can't be used with/);
    expect(ids(def({ metrics: ['nope'] }))).toContain('RPT-011');
  });
  it('RPT-012: bad date ranges', () => {
    expect(ids(def(), ctx({ range: null }))).toContain('RPT-012');
    expect(ids(def(), ctx({ range: { from: '2026-10-27', to: '2026-10-21' } }))).toContain('RPT-012');
    expect(ids(def(), ctx({ range: { from: '2026-10-27', to: '2026-10-29' } }))).toContain('RPT-012');
    expect(ids(def(), ctx({ range: { from: '2020-01-01', to: '2026-10-27' } }))).toContain('RPT-012');
  });
  it('RPT-013: hourly data only inside the retention window', () => {
    const d = def({ dimensions: ['hour'] });
    expect(ids(d)).toEqual([]);
    const issues = validateForRun(d, ctx({ range: { from: '2026-08-01', to: '2026-10-27' } }));
    expect(issues.find((i) => i.ruleId === 'RPT-013')?.message).toBe(
      'Hourly data is only available for the last 14 days.',
    );
  });
  it('RPT-014: partner filter', () => {
    expect(ids(def({ filters: [] }))).toContain('RPT-014');
    expect(ids(def({ filters: [{ field: 'partner', op: 'IN', values: [] }] }))).toContain('RPT-014');
  });
  it('RPT-015: chart requirements', () => {
    expect(ruleViz(def({ viz: { type: 'TIME_SERIES' } })).map((i) => i.message)).toEqual([
      'This chart needs a Date dimension.',
    ]);
    expect(ruleViz(def({ viz: { type: 'TIME_SERIES' }, dimensions: ['date'] }))).toEqual([]);
    expect(ruleViz(def({ viz: { type: 'PIE' }, metrics: ['impressions', 'clicks'] })).length).toBe(1);
    expect(ruleViz(def({ viz: { type: 'SCATTER' } })).length).toBe(1);
    expect(ruleViz(def({ viz: { type: 'SCATTER' }, metrics: ['impressions', 'clicks'] }))).toEqual([]);
  });
  it('RPT-017: partner cost fields for PARTNER_CLIENT', () => {
    const d = def({ metrics: ['revenue_partner'] });
    expect(ids(d, ctx({ allowPartnerCost: false }))).toContain('RPT-017');
    expect(ids(d)).toEqual([]);
  });
  it('RPT-018 and RPT-020', () => {
    expect(ruleTruncated(200_001, 200_000)[0]).toMatchObject({ ruleId: 'RPT-018', severity: 'warning' });
    expect(ruleTruncated(200_000, 200_000)).toEqual([]);
    expect(ruleShare(false)[0]?.message).toBe("That person can't access this partner.");
    expect(ruleShare(true)).toEqual([]);
  });
});
