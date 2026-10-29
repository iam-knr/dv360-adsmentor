// MX-09 B: can an assigned creative serve for a line item (module 12 S4 "Line item eligibility", AC 11). Pure.
import {
  creativeFormatAllowed,
  isStandardDisplaySize,
  type AppAdType,
} from '@/lib/validation/constants/creatives';
import { LI_TYPE_LABEL, type LiType } from '@/lib/validation/constants/li-compat';
import { mx09FormatOf } from './kinds';
import type { CreativeKind } from '@prisma/client';

export interface EligibilityCreative {
  kind: CreativeKind;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  dv360Review: 'PENDING' | 'SERVABLE' | 'NOT_SERVABLE';
  /** exchange id to review status */
  exchanges: Readonly<Record<string, 'APPROVED' | 'PENDING' | 'DISAPPROVED'>>;
  restrictedCountries: readonly { code: string; name: string }[];
  width: number;
  height: number;
}

export interface EligibilityLineItem {
  type: LiType;
  adType?: AppAdType | null;
  /** Exchanges the line item buys on; empty means every exchange. */
  exchangeIds: readonly string[];
  targetedCountries: readonly string[];
  /** Engine `params.slotSizes` for the line item's format; omitted: standard sizes. */
  slotSizes?: readonly (readonly [number, number])[];
}

export type EligibilityCode =
  | 'C.FORMAT_MISMATCH'
  | 'C.NOT_ACTIVE'
  | 'C.NOT_APPROVED_EXCHANGE:DV360_NOT_SERVABLE'
  | 'C.NOT_APPROVED_EXCHANGE:DV360_PENDING'
  | 'C.NOT_APPROVED_EXCHANGE:DISAPPROVED'
  | 'C.NOT_APPROVED_EXCHANGE:PENDING'
  | 'C.GEO_POLICY'
  | 'C.SIZE_MISMATCH';

export interface Eligibility {
  canServe: boolean;
  /** First failing condition in MX-09 order (format first, then 1 to 5). */
  code?: EligibilityCode;
  why?: string;
}

const fail = (code: EligibilityCode, why: string): Eligibility => ({ canServe: false, code, why });

export function servingEligibility(c: EligibilityCreative, li: EligibilityLineItem): Eligibility {
  const label = LI_TYPE_LABEL[li.type];
  if (!creativeFormatAllowed(li.type, mx09FormatOf(c.kind), li.adType))
    return fail(
      'C.FORMAT_MISMATCH',
      `This creative's format can't be used in ${label} line items.`,
    );
  if (c.status !== 'ACTIVE')
    return fail(
      'C.NOT_ACTIVE',
      `The creative is ${c.status === 'PAUSED' ? 'paused' : 'archived'}.`,
    );
  if (c.dv360Review === 'NOT_SERVABLE')
    return fail(
      'C.NOT_APPROVED_EXCHANGE:DV360_NOT_SERVABLE',
      'Display & Video 360 marked this creative as not servable.',
    );
  if (c.dv360Review === 'PENDING')
    return fail(
      'C.NOT_APPROVED_EXCHANGE:DV360_PENDING',
      'Display & Video 360 is still reviewing this creative.',
    );
  const buys = li.exchangeIds.length ? li.exchangeIds : Object.keys(c.exchanges);
  const statuses = buys.map((id) => c.exchanges[id]);
  if (!statuses.includes('APPROVED')) {
    return statuses.includes('PENDING')
      ? fail(
          'C.NOT_APPROVED_EXCHANGE:PENDING',
          'No exchange this line item buys on has approved the creative yet.',
        )
      : fail(
          'C.NOT_APPROVED_EXCHANGE:DISAPPROVED',
          'Every exchange this line item buys on disapproved or has no review of the creative.',
        );
  }
  const blocked = c.restrictedCountries.find((r) => li.targetedCountries.includes(r.code));
  if (blocked)
    return fail(
      'C.GEO_POLICY',
      `This creative is restricted from serving in line items that target ${blocked.name}.`,
    );
  if (
    ['IMAGE', 'HTML5', 'TP_DISPLAY'].includes(mx09FormatOf(c.kind)) &&
    c.width > 0 &&
    c.height > 0
  ) {
    const fits = li.slotSizes
      ? li.slotSizes.some(([w, h]) => w === c.width && h === c.height)
      : isStandardDisplaySize(c.width, c.height);
    if (!fits)
      return fail(
        'C.SIZE_MISMATCH',
        `The creative size (${c.width}x${c.height}) doesn't fit the line item's inventory.`,
      );
  }
  return { canServe: true };
}
