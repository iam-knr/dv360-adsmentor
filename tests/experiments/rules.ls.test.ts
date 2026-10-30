// LS rules (module 17 4.5, acceptance 12).
import { describe, expect, it } from 'vitest';
import { brandLiftIssues, lsIssues, type LsRuleCtx } from '@/lib/experiments/rules';
import type { BrandLiftInput, LiftStudyInput } from '@/lib/experiments/types';

const brand = (over: Partial<BrandLiftInput> = {}): BrandLiftInput => ({
  metrics: ['AWARENESS'],
  brandName: 'Brand',
  competitors: ['Rival'],
  language: 'en-US',
  objectType: 'Brand',
  intendedAction: null,
  ...over,
});
const study = (over: Partial<LiftStudyInput> = {}): LiftStudyInput => ({
  name: 'Study',
  ioIds: ['io1'],
  ioGroup: 'OTHER',
  liftTypes: ['BRAND_LIFT'],
  brandLift: brand(),
  strength: 'STANDARD',
  searchGroups: [],
  ...over,
});
const ctx = (over: Partial<LsRuleCtx> = {}): LsRuleCtx => ({
  mode: 'create',
  groups: { yt: 0, other: 1 },
  eligibleIoCount: 1,
  perType: [
    { type: 'BRAND_LIFT', measurableLis: 2, eligible: true },
    { type: 'SEARCH_LIFT', measurableLis: 1, eligible: true },
  ],
  allMeasurableYoutube: true,
  ...over,
});
const ids = (i: ReturnType<typeof lsIssues>) => i.map((x) => x.ruleId);

describe('LS rules', () => {
  it('accepts a filled study', () => {
    expect(lsIssues(study(), ctx()).filter((i) => i.blocking)).toEqual([]);
  });
  it('LS-001 name', () => {
    expect(lsIssues(study({ name: '' }), ctx()).find((i) => i.ruleId === 'LS-001')?.message).toBe('Enter a value');
    expect(lsIssues(study({ name: 'x'.repeat(129) }), ctx()).find((i) => i.ruleId === 'LS-001')?.message).toBe('Use 128 characters or fewer.');
  });
  it('LS-002 both IO groups', () => {
    expect(ids(lsIssues(study(), ctx({ groups: { yt: 1, other: 1 } })))).toContain('LS-002');
  });
  it('LS-003 no eligible insertion order disables lift types', () => {
    const i = lsIssues(study({ ioIds: [], liftTypes: [] }), ctx({ eligibleIoCount: 0, groups: { yt: 0, other: 0 } }));
    expect(i.find((x) => x.ruleId === 'LS-003')?.message).toBe('Select at least one eligible insertion order to add a lift study');
    expect(ids(i)).not.toContain('LS-004');
  });
  it('LS-004 no lift type, LS-005 type without measurable line items', () => {
    expect(ids(lsIssues(study({ liftTypes: [] }), ctx()))).toContain('LS-004');
    const none = ctx({ perType: [{ type: 'SEARCH_LIFT', measurableLis: 0, eligible: false }] });
    expect(ids(lsIssues(study({ liftTypes: ['SEARCH_LIFT'], searchGroups: [['a']] }), none))).toContain('LS-005');
  });
  it('LS-006 one to three metrics', () => {
    expect(ids(brandLiftIssues(brand({ metrics: [] }), 'b', ['BRAND_LIFT']))).toContain('LS-006');
    expect(ids(brandLiftIssues(brand({ metrics: ['AWARENESS', 'CONSIDERATION', 'FAVORABILITY', 'ASSOCIATION'] }), 'b', ['BRAND_LIFT']))).toContain('LS-006');
  });
  it('LS-007 brand name, LS-008 competitors, LS-019 duplicates', () => {
    expect(ids(brandLiftIssues(brand({ brandName: '' }), 'b', ['BRAND_LIFT']))).toContain('LS-007');
    expect(brandLiftIssues(brand({ brandName: 'x'.repeat(31) }), 'b', ['BRAND_LIFT']).find((i) => i.ruleId === 'LS-007')?.message).toBe('Use 30 characters or fewer.');
    expect(ids(brandLiftIssues(brand({ competitors: ['a', 'b', 'c', 'd'] }), 'b', ['BRAND_LIFT']))).toContain('LS-008');
    expect(ids(brandLiftIssues(brand({ competitors: ['Brand'] }), 'b', ['BRAND_LIFT']))).toContain('LS-019');
  });
  it('LS-010 object type, LS-011 intended action with Purchase intent', () => {
    expect(ids(brandLiftIssues(brand({ objectType: null }), 'b', ['BRAND_LIFT']))).toContain('LS-010');
    expect(ids(brandLiftIssues(brand({ metrics: ['PURCHASE_INTENT'] }), 'b', ['BRAND_LIFT']))).toContain('LS-011');
    expect(ids(brandLiftIssues(brand({ metrics: ['PURCHASE_INTENT'], intendedAction: 'BUY' }), 'b', ['BRAND_LIFT']))).not.toContain('LS-011');
  });
  it('LS-012 enhanced strength is YouTube only', () => {
    expect(ids(lsIssues(study({ strength: 'ENHANCED' }), ctx({ allMeasurableYoutube: false })))).toContain('LS-012');
    expect(ids(lsIssues(study({ strength: 'ENHANCED' }), ctx()))).not.toContain('LS-012');
  });
  it('LS-013 search groups: 1 to 3 terms, up to 5 groups', () => {
    const base = { liftTypes: ['SEARCH_LIFT' as const] };
    expect(ids(lsIssues(study({ ...base, searchGroups: Array.from({ length: 6 }, () => ['a']) }), ctx()))).toContain('LS-013');
    expect(ids(lsIssues(study({ ...base, searchGroups: [['a', 'b', 'c', 'd']] }), ctx()))).toContain('LS-013');
    expect(ids(lsIssues(study({ ...base, searchGroups: [['a']] }), ctx()))).not.toContain('LS-013');
  });
  it('LS-015 lift types are locked on Review and fix', () => {
    const c = ctx({ mode: 'edit', originalTypes: ['BRAND_LIFT'] });
    expect(lsIssues(study({ liftTypes: ['BRAND_LIFT', 'SEARCH_LIFT'], searchGroups: [['a']] }), c).find((i) => i.ruleId === 'LS-015')?.message).toBe("This setting can't be changed after it is created.");
    expect(ids(lsIssues(study(), c))).not.toContain('LS-015');
  });
});
