// PLN rules (module 04 4.2, 4.7, 4.9): pass and fail pairs.
import { describe, expect, it } from 'vitest';
import {
  PLN_MSG,
  convertIssues,
  crossMediaIssues,
  planHeaderIssues,
  planRowCapIssues,
  planRowIssues,
} from '@/lib/planning/rules';

const header = {
  name: 'Plan',
  location: 'SG',
  start: '2026-02-01',
  end: '2026-03-01',
  ageMin: 18,
  ageMax: 64,
  today: '2026-01-10',
  checkStart: true,
};
const ids = (r: { ruleId: string }[]) => r.map((i) => i.ruleId);

describe('planHeaderIssues', () => {
  it('passes a valid header', () => expect(planHeaderIssues(header)).toEqual([]));
  it('PLN-020 empty name', () =>
    expect(ids(planHeaderIssues({ ...header, name: ' ' }))).toContain('PLN-020'));
  it('GEN-004 name over 100 characters', () =>
    expect(ids(planHeaderIssues({ ...header, name: 'x'.repeat(101) }))).toContain('GEN-004'));
  it('GEN-005 location required', () =>
    expect(ids(planHeaderIssues({ ...header, location: '' }))).toContain('GEN-005'));
  it('GEN-008 end before start', () =>
    expect(ids(planHeaderIssues({ ...header, end: '2026-01-01' }))).toContain('GEN-008'));
  it('PLN-021 start in the past on create and copy only', () => {
    expect(ids(planHeaderIssues({ ...header, start: '2026-01-02' }))).toContain('PLN-021');
    expect(
      ids(planHeaderIssues({ ...header, start: '2026-01-02', checkStart: false })),
    ).not.toContain('PLN-021');
  });
  it('PLN-022 longer than 365 days', () => {
    expect(ids(planHeaderIssues({ ...header, end: '2027-03-01' }))).toContain('PLN-022');
    expect(planHeaderIssues({ ...header, start: '2026-02-01', end: '2027-01-31' })).toEqual([]);
  });
  it('PLN-023 age range', () =>
    expect(ids(planHeaderIssues({ ...header, ageMin: 40, ageMax: 30 }))).toContain('PLN-023'));
});

const row = {
  name: 'Row',
  buyingMethod: 'OPEN_AUCTION' as const,
  start: '2026-02-05',
  end: '2026-02-20',
  budgetNet: 1000,
  planStart: '2026-02-01',
  planEnd: '2026-03-01',
};

describe('planRowIssues', () => {
  it('passes a valid row', () => expect(planRowIssues(row, 0)).toEqual([]));
  it('GEN-001 name', () =>
    expect(ids(planRowIssues({ ...row, name: '' }, 0))).toContain('GEN-001'));
  it('GEN-002 budget above zero', () => {
    expect(ids(planRowIssues({ ...row, budgetNet: 0 }, 0))).toContain('GEN-002');
    expect(ids(planRowIssues({ ...row, budgetNet: null }, 0))).toContain('GEN-002');
  });
  it('GEN-002 max CPM above zero when given', () =>
    expect(ids(planRowIssues({ ...row, maxCpm: 0 }, 0))).toContain('GEN-002'));
  it('PLN-024 dates inside the plan', () => {
    const r = planRowIssues({ ...row, end: '2026-04-01' }, 2);
    expect(ids(r)).toContain('PLN-024');
    expect(r[0]?.path).toBe('rows.2.dates');
    expect(r[0]?.message).toBe(PLN_MSG.ROW_DATES);
  });
  it('PLN-025 deal required for deal methods', () => {
    expect(ids(planRowIssues({ ...row, buyingMethod: 'PROGRAMMATIC_GUARANTEED' }, 0))).toContain(
      'PLN-025',
    );
    expect(
      planRowIssues({ ...row, buyingMethod: 'PROGRAMMATIC_GUARANTEED', dealId: 'd1' }, 0),
    ).toEqual([]);
  });
  it('PLN-026 row cap of 50', () => {
    expect(planRowCapIssues(50)).toEqual([]);
    expect(ids(planRowCapIssues(51))).toEqual(['PLN-026']);
  });
});

describe('convertIssues', () => {
  const ok = {
    status: 'PLANNED',
    locked: false,
    rowCount: 2,
    target: 'CAMPAIGN' as const,
    campaignFound: false,
  };
  it('passes', () => expect(convertIssues(ok)).toEqual([]));
  it('PLN-004 only a planned plan converts', () =>
    expect(ids(convertIssues({ ...ok, status: 'TRAFFICKED' }))).toEqual(['PLN-004']));
  it('PLN-002 locked', () =>
    expect(ids(convertIssues({ ...ok, locked: true }))).toEqual(['PLN-002']));
  it('PLN-028 needs a row', () =>
    expect(ids(convertIssues({ ...ok, rowCount: 0 }))).toEqual(['PLN-028']));
  it('PLN-029 existing campaign must belong to the advertiser', () =>
    expect(ids(convertIssues({ ...ok, target: 'IO' }))).toEqual(['PLN-029']));
});

describe('crossMediaIssues', () => {
  const ok = {
    country: 'SINGAPORE',
    scope: 'NATIONAL' as const,
    subLocationCount: 0,
    ioCount: 1,
    tvCount: 0,
  };
  it('passes', () => expect(crossMediaIssues(ok)).toEqual([]));
  it('PLN-010 country', () =>
    expect(ids(crossMediaIssues({ ...ok, country: null }))).toContain('PLN-010'));
  it('PLN-011 sub-location', () =>
    expect(ids(crossMediaIssues({ ...ok, scope: 'SUB_LOCATION' }))).toContain('PLN-011'));
  it('PLN-012 pick one', () =>
    expect(ids(crossMediaIssues({ ...ok, ioCount: 0 }))).toContain('PLN-012'));
  it('PLN-031 maxima', () => {
    expect(ids(crossMediaIssues({ ...ok, ioCount: 51 }))).toContain('PLN-031');
    expect(ids(crossMediaIssues({ ...ok, tvCount: 21 }))).toContain('PLN-031');
  });
});
