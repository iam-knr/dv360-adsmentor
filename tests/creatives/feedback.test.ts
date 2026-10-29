import { describe, expect, it } from 'vitest';
import { FEEDBACK, feedbackFor, REASON_CODES } from '@/lib/creatives/feedback';

describe('feedback', () => {
  it.each(REASON_CODES)('%s has text and fix steps', (code) => {
    expect(FEEDBACK[code].summary.length).toBeGreaterThan(10);
    expect(FEEDBACK[code].steps.length).toBeGreaterThan(0);
    expect(feedbackFor(code)).toBe(FEEDBACK[code]);
  });
  it('keeps an unknown code as text and returns null for none', () => {
    expect(feedbackFor('Some exchange text')).toEqual({ summary: 'Some exchange text', steps: [] });
    expect(feedbackFor(null)).toBeNull();
  });
});
