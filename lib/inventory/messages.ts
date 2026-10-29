// Wordings of the INV rules that are not in the shared catalogue (validation.md 2.20, module 13 4.5).
// `[SIM]` wordings are written for the simulator, so the marker is not part of the text.
export const INV_MSG = {
  NAME_TOO_LONG: 'Use 200 characters or fewer.',
  SELECT_ADVERTISER: 'Select at least one advertiser.',
  FORECAST_FIRST: 'You will be able to accept an instant deal after reviewing the forecast.',
  YT_TERMS: 'Accept the YouTube guaranteed instant deals terms in Advertiser configurations.',
  PG_DIRECT_LOCKED: "This setting can't be changed after it is created.",
  NOT_ASSIGNED: "This deal isn't assigned to a line item.",
  STATUS_NOT_ALLOWED: "This status change isn't allowed for the deal's current status.",
  NO_PAUSE: "The seller doesn't allow this deal to be paused.",
  GROUP_EMPTY: 'This group has no deals.',
  BID_BELOW_RATE: 'The bid is below the deal rate, so this line item may not win the deal.',
  DATES: 'End date must be on or after the start date.',
  ENTER_POSITIVE: 'Enter a number greater than 0',
  RFP_IMPORTED: 'That RFP ID has already been imported.',
  RFP_UNKNOWN: "We couldn't find a negotiation with that RFP ID.",
  CANT_ACCEPT: "This negotiation can't be accepted right now.",
  FINAL_OFFER: 'The seller has made a final offer. Accept or decline it.',
  ALREADY_ASSIGNED: 'This item is already assigned.',
  NOT_WRITER: 'You need access to all advertisers on a deal to edit it.',
} as const;

/** INV-017: `{Type}` is the line item type label. */
export const packageCantAssign = (typeLabel: string): string =>
  `This package can't be assigned to ${typeLabel} line items.`;
