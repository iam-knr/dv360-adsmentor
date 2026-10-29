// Simulated ad review plan (module 09 Δ-09-8, Q-09-06): deterministic verdicts and 1 to 3 hour delays.
import { describe, expect, it } from 'vitest';
import { feedbackFor, planReview, REJECT_FEEDBACK, RESTRICT_FEEDBACK } from '@/lib/youtube/review';

describe('planReview', () => {
  it('approves ordinary copy', () => {
    expect(planReview('seed', { headline: 'Step into the festive season' })).toMatchObject({
      verdict: 'APPROVED',
      feedback: null,
    });
  });

  it('rejects misleading claims and restricts alcohol and gambling', () => {
    expect(planReview('a', { headline: 'Guaranteed results' })).toMatchObject({
      verdict: 'REJECTED',
      feedback: REJECT_FEEDBACK,
    });
    expect(planReview('a', { description: 'Free money for everyone' }).verdict).toBe('REJECTED');
    expect(planReview('a', { longHeadline: 'Wine tasting night' })).toMatchObject({
      verdict: 'RESTRICTED',
      feedback: RESTRICT_FEEDBACK,
    });
    expect(planReview('a', { name: 'Casino weekend' }).verdict).toBe('RESTRICTED');
  });

  it('is deterministic and the delay stays between 1 and 3 hours', () => {
    const delays = new Set<number>();
    for (let i = 0; i < 60; i++) {
      const a = planReview(`seed-${i}`, { headline: 'x' });
      expect(planReview(`seed-${i}`, { headline: 'x' })).toEqual(a);
      expect([1, 2, 3]).toContain(a.delayHours);
      delays.add(a.delayHours);
    }
    expect(delays.size).toBe(3);
  });

  it('keeps the feedback text with the verdict', () => {
    expect(feedbackFor('REJECTED')).toBe(REJECT_FEEDBACK);
    expect(feedbackFor('RESTRICTED')).toBe(RESTRICT_FEEDBACK);
    expect(feedbackFor('APPROVED')).toBeNull();
    expect(feedbackFor('PENDING')).toBeNull();
  });
});
