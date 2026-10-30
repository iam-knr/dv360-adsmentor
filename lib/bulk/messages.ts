// Descriptions and texts of the bulk framework (module 11 3.2, validation.md BLK-010..015). Client safe.
import { nounFor, type BulkEntityKey } from './entities';
import type { BulkOp } from './types';

export const BLK_010 = (n: number, m: number) => `${n} of ${m} selected items couldn't be updated.`;
export const BLK_012 = (n: number, type: string) =>
  `${n} ${n === 1 ? 'line item was' : 'line items were'} skipped because the template is for ${type} line items.`;
export const BLK_013 = 'Enter a number greater than 0';
export const BLK_015 = 'Only showing 100 most recent bulk actions';
export const NOT_ELIGIBLE = "This item isn't eligible for the action.";
export const NOT_FOUND = (entity: BulkEntityKey) => `We couldn't find this ${nounFor(entity, 1)}.`;

/** Description column of the Bulk status page (3.2). */
export function describeJob(
  op: BulkOp,
  entity: BulkEntityKey,
  n: number,
  extra: { copies?: number; parentType?: string; parentId?: string } = {},
): string {
  const noun = nounFor(entity, n);
  switch (op) {
    case 'ACTIVATE':
    case 'PAUSE':
      return `Status edited on ${n} ${noun}`;
    case 'ARCHIVE':
      return `Archiving ${n} ${noun}`;
    case 'UNARCHIVE':
      return `Unarchiving ${n} ${noun}`;
    case 'DUPLICATE':
      return `Duplicating ${n} ${noun} with ${extra.copies ?? 1} ${(extra.copies ?? 1) === 1 ? 'copy' : 'copies'} to ${extra.parentType ?? 'parent'} ${extra.parentId ?? ''}`.trim();
    case 'APPLY_TARGETING_TEMPLATE':
      return `Targeting template applied to ${n} ${noun}`;
    case 'EDIT_SETTINGS':
    case 'EDIT_TARGETING':
    case 'EDIT_CREATIVE_ASSIGNMENT':
      return `Bulk edit of ${n} ${noun}`;
  }
}

export const SOURCE_LABEL: Record<string, string> = {
  DUPLICATION: 'Duplication',
  BULK_EDIT: 'Bulk Edit',
  CAMPAIGN_DOWNLOAD: 'Campaign Download',
  SDF_DOWNLOAD: 'SDF Download',
  SDF_UPLOAD: 'SDF Upload',
  CREATIVE_BULK_ADD: 'Creative upload',
};

export const PARENT_TYPE: Record<BulkEntityKey, string> = {
  campaign: 'advertiser',
  insertionOrder: 'campaign',
  lineItem: 'insertion order',
};
