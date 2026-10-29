import { describe, expect, it } from 'vitest';
import { approvedByText, countExchanges, exchangeStatusText } from '@/lib/creatives/review';

describe('exchange summary strings', () => {
  it.each([
    [['APPROVED', 'APPROVED'], 'Servable (2 of 2)', 'Approved by 2 of 2 exchanges'],
    [['APPROVED', 'PENDING', 'DISAPPROVED'], 'Servable (1 of 3)', 'Approved by 1 of 3 exchanges'],
    [['PENDING'], 'Not servable (0 of 1)', 'Approved by 0 of 1 exchanges'],
  ])('%j', (statuses, list, summary) => {
    const counts = countExchanges(statuses);
    expect(exchangeStatusText(counts)).toBe(list);
    expect(approvedByText(counts)).toBe(summary);
  });
});
