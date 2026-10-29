import { describe, expect, it } from 'vitest';
import {
  acceptNegotiationIssues,
  assignIssues,
  bidBelowRateIssues,
  counterIssues,
  dealDatesIssues,
  dealGroupIssues,
  formatIssue,
  importNegotiationIssues,
  instantDealIssues,
  pgDirectLockedIssues,
  pgUnassignedIssues,
} from '@/lib/inventory/rules';

const good = {
  sellerId: 's1',
  name: 'Deal',
  targeting: { format: ['Video'] },
  advertiserIds: ['a1'],
  forecastToken: 't',
};
const ids = (v: { ruleId: string }[]) => v.map((i) => i.ruleId);

describe('instant deal (INV-001..007)', () => {
  it('passes a complete payload', () => expect(instantDealIssues(good)).toEqual([]));
  it('empty payload gives the three texts of AC 6', () => {
    const out = instantDealIssues({ sellerId: null, name: '', targeting: {}, advertiserIds: ['a'], forecastToken: 'x' });
    expect(out.map((i) => [i.ruleId, i.message])).toEqual([
      ['INV-001', 'A selection is required'],
      ['INV-002', 'Enter a value'],
      ['INV-004', 'At least 1 targeting setting is required'],
    ]);
  });
  it('INV-002 caps the name at 200 characters', () => {
    expect(ids(instantDealIssues({ ...good, name: 'x'.repeat(201) }))).toEqual(['INV-002']);
    expect(instantDealIssues({ ...good, name: 'x'.repeat(200) })).toEqual([]);
  });
  it('INV-004 treats empty value lists as All values', () =>
    expect(ids(instantDealIssues({ ...good, targeting: { format: [] } }))).toEqual(['INV-004']));
  it('INV-005, INV-006, INV-007', () => {
    expect(ids(instantDealIssues({ ...good, advertiserIds: [] }))).toEqual(['INV-005']);
    expect(ids(instantDealIssues({ ...good, forecastToken: null }))).toEqual(['INV-006']);
    expect(ids(instantDealIssues({ ...good, youtubeTermsMissing: true }))).toEqual(['INV-007']);
  });
  it('all issues here are blocking errors', () =>
    expect(instantDealIssues({ ...good, forecastToken: null })[0]?.blocking).toBe(true));
});

describe('deal groups, assign, dates, PG', () => {
  it('INV-015, INV-016, INV-042', () => {
    expect(ids(dealGroupIssues({ name: '', type: 'DEAL_GROUP', memberCount: 1 }))).toEqual(['INV-015']);
    const w = dealGroupIssues({ name: 'g', type: 'DEAL_GROUP', memberCount: 0 });
    expect(w[0]).toMatchObject({ ruleId: 'INV-016', severity: 'warning', blocking: false });
    expect(ids(dealGroupIssues({ name: 'g', type: null, memberCount: 1 }))).toEqual(['INV-042']);
  });
  it('INV-040, INV-041', () => {
    expect(ids(assignIssues({ lineItemCount: 0, advertiserCount: 0, alreadyAssigned: false }))).toEqual(['INV-040']);
    expect(assignIssues({ lineItemCount: 1, advertiserCount: 0, alreadyAssigned: true })[0]).toMatchObject({
      ruleId: 'INV-041',
      blocking: false,
    });
    expect(assignIssues({ lineItemCount: 1, advertiserCount: 0, alreadyAssigned: false })).toEqual([]);
  });
  it('INV-020 dates', () => {
    expect(ids(dealDatesIssues(new Date('2026-02-01'), new Date('2026-01-01')))).toEqual(['INV-020']);
    expect(dealDatesIssues(new Date('2026-01-01'), new Date('2026-01-01'))).toEqual([]);
  });
  it('INV-012, INV-011, INV-019', () => {
    expect(ids(pgUnassignedIssues('GUARANTEED', 0))).toEqual(['INV-012']);
    expect(pgUnassignedIssues('GUARANTEED', 1)).toEqual([]);
    expect(pgUnassignedIssues('NON_GUARANTEED', 0)).toEqual([]);
    expect(ids(pgDirectLockedIssues(new Date('2026-01-01'), new Date('2026-02-01'), true))).toEqual(['INV-011']);
    expect(pgDirectLockedIssues(new Date('2026-03-01'), new Date('2026-02-01'), true)).toEqual([]);
    expect(ids(bidBelowRateIssues(150, 100))).toEqual(['INV-019']);
    expect(bidBelowRateIssues(150, 150)).toEqual([]);
  });
  it('INV-017 text names the line item type', () => {
    expect(formatIssue('VIDEO', 'DISPLAY')[0]?.message).toBe("This package can't be assigned to Display line items.");
    expect(formatIssue('VIDEO', 'CTV')).toEqual([]);
  });
});

describe('negotiations (INV-018, 030..034)', () => {
  it('import', () => {
    expect(importNegotiationIssues({ rfpId: ' ', found: false, alreadyImported: false })[0]?.message).toBe('Enter a value');
    expect(importNegotiationIssues({ rfpId: 'x', found: false, alreadyImported: false })[0]?.ruleId).toBe('INV-018');
    expect(importNegotiationIssues({ rfpId: 'x', found: true, alreadyImported: true })[0]?.ruleId).toBe('INV-032');
    expect(importNegotiationIssues({ rfpId: 'x', found: true, alreadyImported: false })).toEqual([]);
  });
  it('counter', () => {
    expect(ids(counterIssues({ rate: 0, volume: 5, round: 0, maxRounds: 3 }))).toEqual(['INV-030']);
    expect(ids(counterIssues({ rate: 10, volume: 1.5, round: 0, maxRounds: 3 }))).toEqual(['INV-031']);
    expect(ids(counterIssues({ rate: 10, volume: 0, round: 0, maxRounds: 3 }))).toEqual(['INV-031']);
    expect(counterIssues({ rate: 10, volume: undefined, round: 2, maxRounds: 3 })).toEqual([]);
    expect(counterIssues({ rate: 10, volume: 5, round: 3, maxRounds: 3 })[0]?.message).toBe(
      'The seller has made a final offer. Accept or decline it.',
    );
  });
  it('accept', () => {
    expect(acceptNegotiationIssues({ status: 'PROPOSED', awaiting: 'BUYER', resultingDealId: null })).toEqual([]);
    expect(ids(acceptNegotiationIssues({ status: 'COUNTERED', awaiting: 'SELLER', resultingDealId: null }))).toEqual(['INV-033']);
    expect(ids(acceptNegotiationIssues({ status: 'ACCEPTED', awaiting: 'NONE', resultingDealId: 'd' }))).toEqual(['INV-033']);
  });
});
