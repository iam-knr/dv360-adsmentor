// MX-16 Limits catalogue (validation.md 3). Only the keys the implemented domains read are typed here;
// later sessions add the rest next to their rules.

export const LIMITS = {
  NAME_MAX_240: 240,
  NAME_MAX_255: 255,
  NAME_MAX_512: 512,
  NAME_MAX_200: 200,
  NAME_MAX_128: 128,
  NAME_MAX_100: 100,
  HYPOTHESIS_MAX: 400,
  TEMPLATE_DESC_MAX: 600,
  AD_HEADLINE_MAX: 30,
  AD_LONG_HEADLINE_MAX: 90,
  AD_DESCRIPTION_MAX: 90,
  AD_CTA_MAX: 10,
  AD_BUSINESS_NAME_MAX: 25,
  AD_DISPLAY_PATH_MAX: 15,
  DG_HEADLINE_MAX: 40,
  LANDING_URL_MAX: 1024,
  /** Bytes, not characters. */
  INTEGRATION_CODE_MAX: 500,
  CAMPAIGN_KEYWORDS_MAX: 5,
  FEES_MAX_PER_KIND: 5,
  ALERT_UNDERPACING_DEFAULT: 90,
  AUDIENCE_DELAY_HOURS: 4,
  BULK_STATUS_ROWS: 100,
} as const;
