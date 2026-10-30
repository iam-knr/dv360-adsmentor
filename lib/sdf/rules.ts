// BLK-020 to BLK-035 and the SDF-specific texts (module 11 4.7, Δ-11-5). All simulator wording. These rules are
// raised by the upload pipeline, not by the validation registry (the registry's BLK table is still empty).
import type { SdfVersion } from './versions';

export const BLK = {
  'BLK-001': 'Select at least one entity type.',
  'BLK-002': 'Upload one CSV file per entity type.',
  'BLK-003':
    'Inventory source and targeting are managed at the line item level. Leave these columns empty.',
  'BLK-020': "This file isn't a valid CSV file.",
  'BLK-022': 'SDF version 9 is no longer supported. Upgrade to the latest version.',
  'BLK-023': 'This file is too large. Split it into smaller files.',
  'BLK-024': 'This row was changed after you downloaded it. Download the file again.',
  'BLK-027': 'This Id appears more than once in the file.',
  'BLK-028': 'This column is read only. The value was ignored.',
  'BLK-029': 'The parent row failed, so this row was skipped.',
  'BLK-034': 'You can upload up to 5,000 rows at a time.',
} as const;

export const blk021 = (v: SdfVersion) => `The columns in this file don't match SDF version ${v}.`;
export const blk025 = (noun: string) => `We couldn't find this ${noun}.`;
export const blk026 = (noun: string) => `The parent ${noun} doesn't exist.`;
export const blk033 = (what: string) => `${what} can't be changed after it's created.`;
