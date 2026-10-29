// Exchange feedback texts keyed by reason code, with "How to fix this?" steps (module 12 4.5 item 5). Adsmetor wording.
export const REASON_CODES = [
  'SSL',
  'POLICY_TAG_MISSING_CLICK_MACRO',
  'POLICY_DESTINATION',
  'SIZE_UNSUPPORTED',
  'ASSET_QUALITY',
  'OTHER',
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

export interface FeedbackText {
  summary: string;
  steps: readonly string[];
}

export const FEEDBACK: Record<ReasonCode, FeedbackText> = {
  SSL: {
    summary: 'The creative is not SSL compliant.',
    steps: [
      'Make sure the tag and every asset URL start with https://.',
      'Replace any http:// resources inside the tag.',
      'Save the creative to send it for review again.',
    ],
  },
  POLICY_TAG_MISSING_CLICK_MACRO: {
    summary: 'The tag does not contain a click macro, so clicks cannot be counted.',
    steps: [
      'Add the click macro (${CLICK_URL}) in front of the landing page URL inside the tag.',
      'Save the creative to send it for review again.',
    ],
  },
  POLICY_DESTINATION: {
    summary: 'The landing page did not meet the exchange policy.',
    steps: [
      'Check that the landing page loads and matches what the ad promises.',
      'Remove redirects that end on a different site.',
      'Update the landing page URL and save, or submit an appeal.',
    ],
  },
  SIZE_UNSUPPORTED: {
    summary: 'This creative size is not supported on the exchange.',
    steps: [
      'Use one of the standard display sizes, for example 300x250 or 728x90.',
      'Upload a creative in a supported size.',
    ],
  },
  ASSET_QUALITY: {
    summary: 'An asset did not meet the quality guidelines.',
    steps: [
      'Replace blurry or low-resolution assets.',
      'Check that text is readable and not cut off.',
    ],
  },
  OTHER: {
    summary: 'The exchange rejected this creative.',
    steps: ['Review the exchange policies.', 'Edit the creative and save, or submit an appeal.'],
  },
};

export function feedbackFor(code: string | null | undefined): FeedbackText | null {
  if (!code) return null;
  if ((REASON_CODES as readonly string[]).includes(code)) return FEEDBACK[code as ReasonCode];
  return { summary: code, steps: [] };
}
