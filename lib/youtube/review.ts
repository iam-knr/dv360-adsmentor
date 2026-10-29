// Simulated ad review (module 09 Δ-09-8, Q-09-06). Pure and deterministic: the verdict and the delay (1 to 3 sim hours)
// are planned when the ad is saved and settled when the time has passed. The simulator has no real policy engine, so a
// few teaching keywords decide: misleading claims reject, alcohol and gambling restrict.
import type { ReviewStatus } from './types';

export interface ReviewText {
  name?: string | null;
  headline?: string | null;
  longHeadline?: string | null;
  description?: string | null;
}

export interface ReviewPlan {
  verdict: Exclude<ReviewStatus, 'PENDING'>;
  delayHours: 1 | 2 | 3;
  feedback: string | null;
}

const REJECT = /\b(guaranteed|free money|miracle|cure[sd]?|get rich|100% safe)\b/i;
const RESTRICT = /\b(alcohol|beer|vodka|whisky|wine|casino|betting|gambling|lottery)\b/i;

export const REJECT_FEEDBACK =
  'Misleading claims: the ad makes promises that cannot be verified. Edit the text and the ad is reviewed again.';
export const RESTRICT_FEEDBACK =
  'Alcohol or gambling content: the ad can serve, but its reach is limited by this policy.';

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The plan for an ad saved with `text`; `seed` (the ad id or its name) varies the delay. */
export function planReview(seed: string, text: ReviewText): ReviewPlan {
  const body = [text.name, text.headline, text.longHeadline, text.description]
    .filter(Boolean)
    .join(' ');
  const delayHours = ((hash(seed) % 3) + 1) as 1 | 2 | 3;
  if (REJECT.test(body)) return { verdict: 'REJECTED', delayHours, feedback: REJECT_FEEDBACK };
  if (RESTRICT.test(body))
    return { verdict: 'RESTRICTED', delayHours, feedback: RESTRICT_FEEDBACK };
  return { verdict: 'APPROVED', delayHours, feedback: null };
}

export function feedbackFor(verdict: ReviewStatus): string | null {
  return verdict === 'REJECTED'
    ? REJECT_FEEDBACK
    : verdict === 'RESTRICTED'
      ? RESTRICT_FEEDBACK
      : null;
}
