// Plan line item table columns (module 04 2.2, S3). The default view is a constant; a user's order is a `SavedView`
// with `grid = PLAN` (DM 5.14).
export type PlanColumnGroup = 'ALL' | 'AWARENESS' | 'CONSIDERATION' | 'ACTION';

export interface PlanColumnDef {
  id: string;
  label: string;
  group: PlanColumnGroup;
  defaultOn: boolean;
  /** Name cannot be removed or moved. */
  locked?: boolean;
}

export const PLAN_COLUMN_GROUPS: { id: PlanColumnGroup; label: string }[] = [
  { id: 'ALL', label: 'All objectives' },
  { id: 'AWARENESS', label: 'Awareness' },
  { id: 'CONSIDERATION', label: 'Consideration' },
  { id: 'ACTION', label: 'Action' },
];

export const PLAN_COLUMNS: PlanColumnDef[] = [
  { id: 'name', label: 'Name', group: 'ALL', defaultOn: true, locked: true },
  { id: 'locations', label: 'Locations', group: 'ALL', defaultOn: true },
  { id: 'dateRange', label: 'Date range', group: 'ALL', defaultOn: true },
  { id: 'targeting', label: 'Targeting', group: 'ALL', defaultOn: true },
  { id: 'buyingMethod', label: 'Buying Method', group: 'ALL', defaultOn: true },
  { id: 'budget', label: 'Budget', group: 'ALL', defaultOn: true },
  { id: 'budgetPct', label: 'Total Budget %', group: 'ALL', defaultOn: true },
  { id: 'onTargetReach', label: 'On-target reach', group: 'AWARENESS', defaultOn: true },
  { id: 'onTargetFrequency', label: 'On-target frequency', group: 'AWARENESS', defaultOn: true },
  { id: 'trps', label: 'TRPs', group: 'AWARENESS', defaultOn: true },
  { id: 'costPerReach', label: 'Cost-per-reach', group: 'AWARENESS', defaultOn: true },
  { id: 'cpa', label: 'CPA', group: 'ACTION', defaultOn: true },
  { id: 'onTargetImpressions', label: 'On-target impressions', group: 'ALL', defaultOn: true },
  { id: 'billableUnits', label: 'Total billable units', group: 'ALL', defaultOn: true },
  { id: 'avgCost', label: 'Total avg. cost', group: 'ALL', defaultOn: true },
  { id: 'viewableCpm', label: 'Viewable CPM', group: 'CONSIDERATION', defaultOn: true },
  { id: 'viewabilityRate', label: 'Viewability rate', group: 'CONSIDERATION', defaultOn: true },
  { id: 'trueviewViews', label: 'TrueView views', group: 'CONSIDERATION', defaultOn: false },
  { id: 'conversions', label: 'Conversions', group: 'ACTION', defaultOn: false },
];

/** Default column order: the "defaults on" list in the order of the table (spec 2.2). */
export const DEFAULT_PLAN_COLUMNS: string[] = PLAN_COLUMNS.filter((c) => c.defaultOn).map((c) => c.id);

const KNOWN = new Set(PLAN_COLUMNS.map((c) => c.id));

/** Clean a saved or submitted order: drop unknown and repeated ids, force Name first. Falls back to the default. */
export function normalizePlanColumns(order: readonly string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = ['name'];
  seen.add('name');
  for (const id of order ?? []) {
    if (KNOWN.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out.length > 1 ? out : [...DEFAULT_PLAN_COLUMNS];
}

export const planColumn = (id: string): PlanColumnDef | undefined =>
  PLAN_COLUMNS.find((c) => c.id === id);
