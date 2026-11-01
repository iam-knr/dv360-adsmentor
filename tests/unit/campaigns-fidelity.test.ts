import { describe, expect, it } from 'vitest';
import { toCsv } from '@/lib/campaigns/csv';
import { REQUIRED_VALUE, realFormIssues } from '@/lib/campaigns/form-issues';
import {
  filterCampaignRows,
  initialChips,
  matchesNameId,
  NAME_ID,
} from '@/lib/campaigns/list-filter';
import { compactRange, defaultRange, rangeFromParam } from '@/lib/campaigns/range';
import { newCampaignValue, type CampaignRow, type WireIssue } from '@/lib/campaigns/wire';
import { paramFromValue, valueFromParam } from '@/components/dv/date-param';

const issue = (path: string, message: string): WireIssue => ({
  path,
  severity: 'error',
  code: 'X',
  message,
});

describe('realFormIssues (audit CAM-047, CAM-048)', () => {
  it('an empty form gives the four required errors with the real wording', () => {
    const server = [
      issue('name', 'Enter a value'),
      issue('goal', 'Choose a goal.'),
      issue('creativeTypes', 'Please select at least one creative type.'),
    ];
    const out = realFormIssues(server, newCampaignValue('2026-11-01'));
    expect(out.map((i) => [i.path, i.message])).toEqual([
      ['name', 'Enter a value'],
      ['goal', REQUIRED_VALUE],
      ['creativeTypes', 'Please select at least one creative type.'],
      ['kpi.type', REQUIRED_VALUE],
    ]);
  });
  it('does not add a KPI error when the form is accepted', () => {
    expect(realFormIssues([], newCampaignValue('2026-11-01'))).toEqual([]);
  });
});

describe('date range `d` param', () => {
  const today = '2026-11-01';
  it('every picker preset resolves to the days the picker shows', () => {
    for (const d of [
      'TODAY',
      'YESTERDAY',
      'LAST_7_DAYS',
      'LAST_14_DAYS',
      'LAST_30_DAYS',
      'MONTH_TO_DATE',
      'QUARTER_TO_DATE',
      'YEAR_TO_DATE',
      'LIFETIME',
      '30D_TODAY',
      '30D_YESTERDAY',
    ]) {
      const v = valueFromParam(d, today);
      const r = rangeFromParam(d, today);
      const iso = (x: Date) =>
        `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
      expect([d, iso(v.start), iso(v.end)]).toEqual([d, r.from, r.to]);
      expect(paramFromValue(v)).toBe(d);
    }
  });
  it('Today is the sim date, not the wall clock', () => {
    expect(rangeFromParam('TODAY', '2027-02-20')).toEqual({ from: '2027-02-20', to: '2027-02-20' });
  });
  it('a custom range round-trips and a bad value falls back to the last 7 days', () => {
    expect(paramFromValue(valueFromParam('20261025:20261031', today))).toBe('20261025:20261031');
    expect(rangeFromParam('NOPE', today)).toEqual(defaultRange(today));
    expect(compactRange(defaultRange(today))).toBe('20261026:20261101');
  });
});

describe('list filter chips', () => {
  const row = (name: string, publicId: string, status: CampaignRow['status']): CampaignRow => ({
    id: publicId,
    publicId,
    name,
    status,
    alertCount: 0,
    alertSeverity: null,
    budget: null,
    spent: 0,
    goal: null,
    kpiGoal: null,
    kpiActual: null,
    kpiActualTrueView: null,
  });
  const rows = [row('Alpha', '101', 'ACTIVE'), row('Beta', '202', 'PAUSED')];
  it('starts on Status: Active, "*" has no chip', () => {
    expect(initialChips()).toEqual([{ fieldId: 'status', values: ['ACTIVE'] }]);
    expect(initialChips('*')).toEqual([]);
    expect(filterCampaignRows(rows, initialChips(), '').map((r) => r.name)).toEqual(['Alpha']);
  });
  it('free text matches the name and the ID', () => {
    expect(matchesNameId(rows[1]!, ['bet'])).toBe(true);
    expect(matchesNameId(rows[1]!, ['202'])).toBe(true);
    expect(matchesNameId(rows[1]!, ['zzz'])).toBe(false);
    expect(
      filterCampaignRows(rows, [{ fieldId: NAME_ID, values: ['202'] }], '').map((r) => r.name),
    ).toEqual(['Beta']);
  });
});

describe('toCsv', () => {
  it('quotes commas, quotes and line breaks', () => {
    expect(toCsv(['a', 'b'], [['x,y', 'say "hi"'], [1, null]])).toBe(
      'a,b\r\n"x,y","say ""hi"""\r\n1,\r\n',
    );
  });
});
