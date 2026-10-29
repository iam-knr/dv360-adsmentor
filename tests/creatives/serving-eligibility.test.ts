// MX-09 B: each of the conditions failing alone, plus all passing.
import { describe, expect, it } from 'vitest';
import {
  servingEligibility,
  type EligibilityCreative,
  type EligibilityLineItem,
} from '@/lib/creatives/eligibility';

const creative = (over: Partial<EligibilityCreative> = {}): EligibilityCreative => ({
  kind: 'STANDARD_IMAGE',
  status: 'ACTIVE',
  dv360Review: 'SERVABLE',
  exchanges: { ex1: 'APPROVED', ex2: 'DISAPPROVED' },
  restrictedCountries: [],
  width: 300,
  height: 250,
  ...over,
});
const li = (over: Partial<EligibilityLineItem> = {}): EligibilityLineItem => ({
  type: 'DISPLAY',
  exchangeIds: ['ex1', 'ex2'],
  targetedCountries: ['IN'],
  ...over,
});

describe('serving eligibility', () => {
  it('passes when every condition holds', () =>
    expect(servingEligibility(creative(), li())).toEqual({ canServe: true }));

  it('fails alone on the format', () => {
    const r = servingEligibility(creative({ kind: 'VIDEO_FILE' }), li());
    expect(r.code).toBe('C.FORMAT_MISMATCH');
    expect(r.why).toBe("This creative's format can't be used in Display line items.");
  });
  it('fails alone on the creative status', () => {
    expect(servingEligibility(creative({ status: 'PAUSED' }), li()).code).toBe('C.NOT_ACTIVE');
    expect(servingEligibility(creative({ status: 'ARCHIVED' }), li()).why).toBe(
      'The creative is archived.',
    );
  });
  it('fails alone on the DV360 review', () => {
    expect(servingEligibility(creative({ dv360Review: 'NOT_SERVABLE' }), li()).code).toBe(
      'C.NOT_APPROVED_EXCHANGE:DV360_NOT_SERVABLE',
    );
    expect(servingEligibility(creative({ dv360Review: 'PENDING' }), li()).code).toBe(
      'C.NOT_APPROVED_EXCHANGE:DV360_PENDING',
    );
  });
  it('fails alone when no bought exchange approved', () => {
    expect(
      servingEligibility(creative({ exchanges: { ex1: 'PENDING', ex2: 'DISAPPROVED' } }), li())
        .code,
    ).toBe('C.NOT_APPROVED_EXCHANGE:PENDING');
    expect(servingEligibility(creative({ exchanges: { ex1: 'DISAPPROVED' } }), li()).code).toBe(
      'C.NOT_APPROVED_EXCHANGE:DISAPPROVED',
    );
    // approved on an exchange the line item does not buy on does not count
    expect(servingEligibility(creative(), li({ exchangeIds: ['ex2'] })).canServe).toBe(false);
    // an exchange with no entry does not serve
    expect(
      servingEligibility(creative({ exchanges: {} }), li({ exchangeIds: ['ex1'] })).canServe,
    ).toBe(false);
  });
  it('fails alone on a restricted country the line item targets', () => {
    const c = creative({ restrictedCountries: [{ code: 'CN', name: 'China' }] });
    const r = servingEligibility(c, li({ targetedCountries: ['CN', 'IN'] }));
    expect(r.code).toBe('C.GEO_POLICY');
    expect(r.why).toBe('This creative is restricted from serving in line items that target China.');
    expect(servingEligibility(c, li()).canServe).toBe(true);
  });
  it('fails alone on the slot size', () => {
    expect(servingEligibility(creative({ width: 468, height: 61 }), li()).code).toBe(
      'C.SIZE_MISMATCH',
    );
    expect(
      servingEligibility(creative({ width: 160, height: 600 }), li({ slotSizes: [[300, 250]] }))
        .code,
    ).toBe('C.SIZE_MISMATCH');
    expect(
      servingEligibility(creative({ width: 300, height: 250 }), li({ slotSizes: [[300, 250]] }))
        .canServe,
    ).toBe(true);
  });
  it('reports the first failure in MX-09 order', () => {
    const r = servingEligibility(
      creative({ status: 'PAUSED', dv360Review: 'NOT_SERVABLE', width: 1, height: 1 }),
      li(),
    );
    expect(r.code).toBe('C.NOT_ACTIVE');
  });
});
