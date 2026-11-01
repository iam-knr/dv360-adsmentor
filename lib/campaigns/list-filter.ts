// Filter chips of the Campaigns and Insertion orders lists (fidelity audit CAM-006, CAM-065). Pure: the chip state of
// `DvFilterBar` (`{ fieldId, values }[]` plus the text being typed) to a row predicate. Client safe.
import type { CampaignRow } from './wire';

export interface ChipValue {
  fieldId: string;
  values: string[];
}

/** Field id of the Name/ID chip (same id as `NAME_ID_FIELD` of DvFilterBar). */
export const NAME_ID = '__nameId';

export const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ARCHIVED', label: 'Archived' },
];

export const BUDGET_OPTIONS = [
  { value: 'SET', label: 'Has a budget' },
  { value: 'UNKNOWN', label: 'Unknown' },
];

/** `f.status` of the URL to the starting chips: a status, `*` for none, nothing for the list default (Active). */
export function initialChips(initialStatus?: string | null): ChipValue[] {
  if (initialStatus === '*') return [];
  return [{ fieldId: 'status', values: [initialStatus ?? 'ACTIVE'] }];
}

const valuesOf = (chips: ChipValue[], id: string) =>
  chips.find((c) => c.fieldId === id)?.values ?? [];

/** Free text matches the name (contains, any case) or the ID (contains). Several terms are alternatives. */
export function matchesNameId(row: { name: string; publicId: string }, terms: string[]): boolean {
  const live = terms.map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (live.length === 0) return true;
  return live.some((t) => row.name.toLowerCase().includes(t) || row.publicId.includes(t));
}

export function filterByChips<T extends { name: string; publicId: string; status: string }>(
  rows: T[],
  chips: ChipValue[],
  text: string,
  extra?: (row: T, chips: ChipValue[]) => boolean,
): T[] {
  const status = valuesOf(chips, 'status');
  const terms = [...valuesOf(chips, NAME_ID), text];
  return rows.filter(
    (r) =>
      (status.length === 0 || status.includes(r.status)) &&
      matchesNameId(r, terms) &&
      (extra ? extra(r, chips) : true),
  );
}

export function filterCampaignRows(rows: CampaignRow[], chips: ChipValue[], text: string) {
  return filterByChips(rows, chips, text, (r, c) => {
    const goal = valuesOf(c, 'goal');
    const budget = valuesOf(c, 'budget');
    return (
      (goal.length === 0 || (r.goal !== null && goal.includes(r.goal))) &&
      (budget.length === 0 || budget.includes(r.budget === null ? 'UNKNOWN' : 'SET'))
    );
  });
}
