// MX-18 Date rules (validation.md 3). "Today" is the advertiser time zone date.

/** Archiving a campaign or IO cascades to its children after DLG-03 (RC-040). An instructor setting may flip it later. */
export const CASCADE_ARCHIVE = true;

export const DATE_RULES = {
  campaign: { startRequired: true, endOptional: true, startLockedAfterStart: true },
  campaignBudgetRow: { startOptional: true, endOptional: true },
  ioSegment: { startRequired: true, endRequired: true, startLockedAfterStart: true },
  lineItem: { sameAsIoOrCustom: true, startLockedAfterStart: true },
} as const;
