// Message catalogue: validation.md 1.2 (verbatim) plus the shared simulator wordings used by more than one rule.
// No rule may inline a string that exists here. docs-sync.test.ts compares the 1.2 block with the document.

export const MSG = {
  ENTER_VALUE: 'Enter a value',
  ENTER_POSITIVE: 'Enter a number greater than 0',
  ENTER_LARGER: 'Enter a larger number',
  SELECT_CREATIVE_TYPE: 'Please select at least one creative type.',
  KPI_NOT_RECOMMENDED: 'This KPI is not recommended for the selected campaign goal.',
  SELECTION_REQUIRED: 'A selection is required',
  LI_TYPE_INCOMPAT: '{Type} line items aren\'t compatible with your insertion order\'s objective setting.',
  DG_PREREQ: 'To create Demand Gen line items:',
  DG_PREREQ_BULLET: 'Enable Floodlight optimization in this advertiser',
  AG_NO_ADS: 'This active ad group doesn\'t have any ads. It won\'t run until you create ads.',
  LS_SELECT_IO: 'Select at least one eligible insertion order to add a lift study',
  CB_MIN_RULE: 'At least 1 rule is required',
  INV_MIN_TARGETING: 'At least 1 targeting setting is required',
  LOOKALIKE_MIN: 'The first-party list must have a minimum of 1,000 active users.',
  LI_BUDGET_GT_IO: 'The total budget of all line items is greater than the insertion order budget.',
  IO_AUTOMATION_CONTENT: 'Your insertion order may only contain cross-exchange display, video and Connected TV line items',
  FREQ_HIGHER_LI: 'The higher level frequency cap is set to {n} exposures per {period}',
  FREQ_CAMPAIGN_IO: 'The campaign\'s frequency cap is set to {n} exposures per {period}',
  NEG_KW_LIMIT: 'Your list can contain up to 5,000 keywords.',
  CHANNEL_UNSAVED: 'You have made changes to this channel that have not yet been saved and will be lost.',
  DEAL_VIEW_ONLY: 'Inventory is view only. It is editable by users with write access to all advertisers assigned to this deal.',
  ADV_PAUSED_BANNER: 'This advertiser is currently paused. None of its campaigns or deals are serving.',
  AUD_DELAY: 'Recently added audiences will be available within 4 hours, except for Combined Audiences which are immediately available.',
  AUD_FORECAST_NA: 'Audience forecasting is not available for this configuration.',
  LS_LANG_OBJ: 'The selected metrics only support certain languages and object types.',
  LIFT_NA_FOR_LI: 'Lift studies are not applicable for line items, or cross-exchange insertion orders…',
  INV_AVAIL_UNKNOWN: 'Inventory availability could not be determined. You may need to add creatives.',
  UNSAVED_TITLE: 'Unsaved Changes',
  UNSAVED_BODY: 'You have made changes that have not been saved and will be lost.',
  UNSAVED_DISCARD: 'Discard changes',
  UNSAVED_CONTINUE: 'Continue editing',
  SDF9_DEPRECATION: 'SDF version 9 will no longer be supported starting January 28, 2027. Upgrade to the latest version… upgrade to SDF version 11.',
  SDF_EU_DEFAULT: 'Line items without an answer for EU political ads will get "No"',
  COPY_SUBLOC_DATA: 'Reach and impressions data is available from January 2024 if you select sub-location(s)',

  // Wordings that more than one rule uses. Written for the simulator ([SIM] in validation.md), so no marker here.
  END_BEFORE_START: 'End date must be on or after the start date.',
  MAX_CHARS: 'Use {max} characters or fewer.',
  CHOOSE_STATUS: 'Choose a status.',
  LOCKED_AFTER_CREATE: "This setting can't be changed after it is created.",
  VALID_URL: 'Enter a valid URL.',
  WHOLE_NUMBER: 'Enter a whole number.',
  PCT_RANGE: 'Enter a number between 0 and 100.',
  NON_NEGATIVE: 'Enter a number that is 0 or greater.',
  START_IN_PAST: "The start date can't be in the past.",
  PACING_COMBO: "This pacing type isn't available for the selected pacing period.",
  BID_UNAVAILABLE_IO: 'Choose a bid strategy that is available for this insertion order.',
  PICK_FEE_TYPE: 'Choose a fee type.',
  FEE_LOCKED: "This fee can't be changed.",
  FEES_MAX: 'You can add up to 5 fees of each kind.',
  EU_POLITICAL_REQUIRED: 'Select whether this line item has EU political ads.',
  PICK_INVENTORY_SOURCE: 'Select at least one inventory source.',
  AUTOMATION_LI_TYPE: "Line items of this type can't be added to an insertion order that automates bid and budget.",
  DIMENSION_NA: "{Dimension} targeting isn't available for {Type} line items.",
  CREATIVE_NOT_ALLOWED: "This creative can't be used in {Type} line items.",
  TARGETING_LOCKED_ADV: "This targeting is set in the advertiser's targeting rules.",
  TARGETING_LOCKED_TYPE: "This targeting can't be changed for {Type} line items.",
  EXCHANGES_SELECTED: '{n} exchanges and 0 subexchanges are selected',
} as const;

export type MsgKey = keyof typeof MSG;

export type MsgParams = Record<string, string | number>;

/** Fills {name} placeholders. Unknown placeholders stay visible so missing params show up in tests (6.6). */
export function format(template: string, params?: MsgParams): string {
  if (!params) return template;
  return template.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : whole,
  );
}
