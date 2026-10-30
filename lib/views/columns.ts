// Column views (module 11 2.7, K15). Client safe: the catalog of columns each grid can show, the four predefined
// views and the resolver that turns a view key into an ordered column list. The columns are the ones the grids
// of this build hold; the extra metrics of the spec (win rate, pacing %) wait for the engine columns (gap list).
export type ViewGrid = 'CAMPAIGN' | 'IO' | 'LI';

export interface ViewColumn {
  id: string;
  label: string;
  group: string;
  /** The name column cannot be removed. */
  fixed?: boolean;
}

export const GRID_COLUMNS: Record<ViewGrid, readonly ViewColumn[]> = {
  CAMPAIGN: [
    { id: 'name', label: 'Campaign', group: 'Settings', fixed: true },
    { id: 'id', label: 'ID', group: 'Settings' },
    { id: 'budget', label: 'Budget', group: 'Settings' },
    { id: 'kpiGoal', label: 'Goal', group: 'Goal' },
    { id: 'kpiActual', label: 'KPI actual', group: 'Goal' },
    { id: 'spent', label: 'Spent', group: 'Delivery' },
  ],
  IO: [
    { id: 'name', label: 'Insertion order', group: 'Settings', fixed: true },
    { id: 'id', label: 'ID', group: 'Settings' },
    { id: 'type', label: 'Type', group: 'Settings' },
    { id: 'budget', label: 'Budget', group: 'Settings' },
    { id: 'goal', label: 'Goal', group: 'Goal' },
    { id: 'impressions', label: 'Impr.', group: 'Delivery' },
    { id: 'revenue', label: 'Revenue', group: 'Delivery' },
  ],
  LI: [
    { id: 'name', label: 'Line item', group: 'Settings', fixed: true },
    { id: 'id', label: 'ID', group: 'Settings' },
    { id: 'type', label: 'Type', group: 'Settings' },
    { id: 'budget', label: 'Budget', group: 'Settings' },
    { id: 'goal', label: 'Goal', group: 'Goal' },
    { id: 'impressions', label: 'Impr.', group: 'Delivery' },
    { id: 'clicks', label: 'Clicks', group: 'Interactions' },
    { id: 'trueViewViews', label: 'TrueView: Views', group: 'Interactions' },
    { id: 'revenue', label: 'Revenue', group: 'Delivery' },
  ],
};

export const PREDEFINED = ['performance', 'summary', 'pacing', 'optimization'] as const;
export type PredefinedView = (typeof PREDEFINED)[number];

export const PREDEFINED_LABEL: Record<PredefinedView, string> = {
  performance: 'Performance',
  summary: 'Summary',
  pacing: 'Pacing',
  optimization: 'Optimization',
};

const SETS: Record<PredefinedView, Record<ViewGrid, string[]>> = {
  performance: {
    CAMPAIGN: ['name', 'id', 'budget', 'spent', 'kpiGoal', 'kpiActual'],
    IO: ['name', 'id', 'type', 'budget', 'goal', 'impressions', 'revenue'],
    LI: ['name', 'id', 'type', 'budget', 'goal', 'impressions', 'clicks', 'trueViewViews', 'revenue'],
  },
  summary: {
    CAMPAIGN: ['name', 'id', 'budget', 'spent'],
    IO: ['name', 'id', 'type', 'budget', 'impressions', 'revenue'],
    LI: ['name', 'id', 'type', 'budget', 'impressions', 'clicks', 'revenue'],
  },
  pacing: {
    CAMPAIGN: ['name', 'id', 'budget', 'spent'],
    IO: ['name', 'id', 'budget', 'revenue'],
    LI: ['name', 'id', 'budget', 'revenue'],
  },
  optimization: {
    CAMPAIGN: ['name', 'id', 'kpiGoal', 'kpiActual'],
    IO: ['name', 'id', 'type', 'goal'],
    LI: ['name', 'id', 'type', 'goal', 'clicks'],
  },
};

export const DEFAULT_VIEW: PredefinedView = 'performance';

export const predefinedColumns = (grid: ViewGrid, view: PredefinedView): string[] => SETS[view][grid];

export interface CustomView {
  id: string;
  name: string;
  columns: string[];
  isPinned?: boolean;
}

export const customKey = (id: string) => `custom:${id}`;

/** The ordered column ids for a view key: `performance`, `custom:{id}`. Unknown keys fall back to Performance. */
export function resolveView(grid: ViewGrid, key: string | undefined, custom: readonly CustomView[]): string[] {
  const known = new Set(GRID_COLUMNS[grid].map((c) => c.id));
  if (key?.startsWith('custom:')) {
    const v = custom.find((c) => customKey(c.id) === key);
    if (v) return v.columns.filter((c) => known.has(c));
  }
  const p = (PREDEFINED as readonly string[]).includes(key ?? '') ? (key as PredefinedView) : DEFAULT_VIEW;
  return SETS[p][grid];
}

/** K15 / V-11-21: a view needs a name that is not taken and at least one column. */
export function validateView(
  name: string,
  columns: readonly string[],
  others: readonly CustomView[],
  selfId?: string,
): string | null {
  const n = name.trim();
  if (!n) return 'Enter a name.';
  if (n.length > 80) return 'Use 80 characters or fewer.';
  if (others.some((o) => o.id !== selfId && o.name.toLowerCase() === n.toLowerCase()))
    return 'A view with this name already exists.';
  if (columns.length < 1) return 'Select at least one column.';
  return null;
}
