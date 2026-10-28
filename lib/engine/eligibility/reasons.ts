// Reason codes of the Troubleshooter funnel (engine.md 3.2). Codes are stored as-is.

import type { TargetingDim } from '../supply/shares';

export type DiagStage =
  | 'AVAILABLE'
  | 'TARGETING'
  | 'CREATIVE'
  | 'FREQUENCY'
  | 'BUDGET'
  | 'PACING'
  | 'AUCTION'
  | 'EXTERNAL'
  | 'WON';

export const T_CODE: Record<TargetingDim, string> = {
  INVENTORY_SOURCE: 'T.INVENTORY_SOURCE',
  ENVIRONMENT: 'T.ENVIRONMENT',
  DEVICE_TYPE: 'T.DEVICE_TYPE',
  GEO: 'T.GEO',
  LANGUAGE: 'T.LANGUAGE',
  DAYPART: 'T.DAYPART',
  DEVICE_DETAIL: 'T.DEVICE_DETAIL',
  BROWSER: 'T.BROWSER',
  CONNECTION: 'T.CONNECTION',
  CARRIER_ISP: 'T.CARRIER_ISP',
  VIEWABILITY: 'T.VIEWABILITY',
  POSITION: 'T.POSITION',
  CONTENT_CATEGORY: 'T.CONTENT_CATEGORY',
  KEYWORD: 'T.KEYWORD',
  APP_URL: 'T.APP_URL',
  BRAND_SUITABILITY: 'T.BRAND_SUITABILITY',
  VERIFICATION_3P: 'T.VERIFICATION_3P',
  DEMOGRAPHICS: 'T.DEMOGRAPHICS',
  AUDIENCE: 'T.AUDIENCE',
};

export const C_CODES = {
  NONE_ASSIGNED: 'C.NONE_ASSIGNED',
  NOT_APPROVED_EXCHANGE: 'C.NOT_APPROVED_EXCHANGE',
  NOT_APPROVED_PENDING: 'C.NOT_APPROVED_EXCHANGE:PENDING',
  NOT_APPROVED_DISAPPROVED: 'C.NOT_APPROVED_EXCHANGE:DISAPPROVED',
  NOT_APPROVED_NOT_SERVABLE: 'C.NOT_APPROVED_EXCHANGE:DV360_NOT_SERVABLE',
  SIZE_MISMATCH: 'C.SIZE_MISMATCH',
  GEO_POLICY: 'C.GEO_POLICY',
  FORMAT_MISMATCH: 'C.FORMAT_MISMATCH',
  ENV_REQUIREMENT: 'C.ENV_REQUIREMENT',
} as const;

export const F_CODES = {
  LI: 'F.LINE_ITEM',
  IO: 'F.INSERTION_ORDER',
  CAMPAIGN: 'F.CAMPAIGN',
  AD_GROUP: 'F.AD_GROUP',
} as const;

export const B_CODES = {
  LI_BUDGET: 'B.LINE_ITEM_BUDGET',
  LI_DAILY: 'B.LINE_ITEM_DAILY',
  IO_SEGMENT: 'B.IO_SEGMENT',
  IO_DAILY: 'B.IO_DAILY',
} as const;

export const P_CODES = {
  LI_PACING: 'P.LINE_ITEM_PACING',
  IO_PACING: 'P.IO_PACING',
  IO_ALLOCATION: 'P.IO_ALLOCATION',
} as const;

export const A_CODES = {
  BELOW_MIN_BID: 'A.BELOW_MIN_BID',
  LOST_INTERNAL: 'A.LOST_INTERNAL',
  LOST_INTERNAL_OWN: 'A.LOST_INTERNAL:OWN_LINE_ITEM',
} as const;

export const E_CODES = {
  BID_TOO_LOW: 'E.BID_TOO_LOW',
  CREATIVE: 'E.CREATIVE',
  OTHER: 'E.OTHER',
  LOST_NOT_REPORTED: 'E.LOST_NOT_REPORTED',
} as const;

export const MILESTONES = {
  AVAILABLE: 'M.AVAILABLE',
  ELIGIBLE: 'M.ELIGIBLE',
  BIDS_SUBMITTED: 'M.BIDS_SUBMITTED',
  BID_RESPONSES: 'M.BID_RESPONSES',
  WON: 'M.WON',
} as const;

/** Stage a code belongs to. Milestones map to the stage they close. */
export function stageOfCode(code: string): DiagStage {
  switch (code.charAt(0)) {
    case 'T':
      return 'TARGETING';
    case 'C':
      return 'CREATIVE';
    case 'F':
      return 'FREQUENCY';
    case 'B':
      return 'BUDGET';
    case 'P':
      return 'PACING';
    case 'A':
      return 'AUCTION';
    case 'E':
      return 'EXTERNAL';
    default:
      return code === MILESTONES.AVAILABLE
        ? 'AVAILABLE'
        : code === MILESTONES.WON
          ? 'WON'
          : 'AVAILABLE';
  }
}

/** Display labels used by the Troubleshooter (engine.md 3.2). */
export const REASON_LABELS: Record<string, string> = {
  'T.INVENTORY_SOURCE': 'Inventory source',
  'T.ENVIRONMENT': 'Environment',
  'T.DEVICE_TYPE': 'Device type',
  'T.GEO': 'Geography',
  'T.LANGUAGE': 'Language',
  'T.DAYPART': 'Day and time',
  'T.DEVICE_DETAIL': 'Device make, model and operating system',
  'T.BROWSER': 'Browser',
  'T.CONNECTION': 'Connection speed',
  'T.CARRIER_ISP': 'Carrier and ISP',
  'T.VIEWABILITY': 'Predicted viewability',
  'T.POSITION': 'Position',
  'T.CONTENT_CATEGORY': 'Categories, formats and content',
  'T.KEYWORD': 'Keywords',
  'T.APP_URL': 'Apps and URLs',
  'T.BRAND_SUITABILITY': 'Brand suitability',
  'T.VERIFICATION_3P': 'Third-party verification',
  'T.DEMOGRAPHICS': 'Demographics',
  'T.AUDIENCE': 'Audience lists',
  'C.NONE_ASSIGNED': 'No creative assigned',
  'C.NOT_APPROVED_EXCHANGE': 'Creative not approved on the exchange',
  'C.NOT_APPROVED_EXCHANGE:PENDING': 'Creative review pending',
  'C.NOT_APPROVED_EXCHANGE:DISAPPROVED': 'Creative disapproved',
  'C.NOT_APPROVED_EXCHANGE:DV360_NOT_SERVABLE': 'Creative not servable',
  'C.SIZE_MISMATCH': 'Creative size does not fit',
  'C.GEO_POLICY': 'Creative restricted in the location',
  'C.FORMAT_MISMATCH': 'Creative type does not match the inventory',
  'C.ENV_REQUIREMENT': 'Creative environment requirement',
  'F.LINE_ITEM': 'Line item frequency cap',
  'F.INSERTION_ORDER': 'Insertion order frequency cap',
  'F.CAMPAIGN': 'Campaign frequency cap',
  'F.AD_GROUP': 'Ad group frequency cap',
  'B.LINE_ITEM_BUDGET': 'Line item budget used',
  'B.LINE_ITEM_DAILY': 'Line item daily cap reached',
  'B.IO_SEGMENT': 'Insertion order budget segment used',
  'B.IO_DAILY': 'Insertion order daily cap reached',
  'P.LINE_ITEM_PACING': 'Line item pacing',
  'P.IO_PACING': 'Insertion order pacing',
  'P.IO_ALLOCATION': 'Budget allocated to other line items',
  'A.BELOW_MIN_BID': 'Below the minimum bid',
  'A.LOST_INTERNAL': 'Auction lost (internal)',
  'A.LOST_INTERNAL:OWN_LINE_ITEM': 'Auction lost to your own line item',
  'E.BID_TOO_LOW': 'Bid too low',
  'E.CREATIVE': 'Creative rejected by the exchange',
  'E.OTHER': 'Other',
  'E.LOST_NOT_REPORTED': 'Externally lost (not reported)',
  'M.AVAILABLE': 'Total available requests',
  'M.ELIGIBLE': 'Eligible impressions',
  'M.BIDS_SUBMITTED': 'Bids submitted',
  'M.BID_RESPONSES': 'Bid responses',
  'M.WON': 'Impressions won',
};

export function reasonLabel(code: string): string {
  return REASON_LABELS[code] ?? code;
}
