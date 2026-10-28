// DLG-01..DLG-12 and the Unsaved Changes rules (validation.md 5). Texts without the [SIM] marker.
import { CASCADE_ARCHIVE } from './constants/dates';
import { format, MSG, type MsgParams } from './messages';

export interface DialogSpec {
  id: string;
  /** null = no title (DLG-02, toast). */
  title: string | null;
  body: string;
  /** Extra body lines or bullets, shown below the body. */
  bullets?: readonly string[];
  /** First button is the primary action; the last one is the safe one (Esc). */
  buttons: readonly string[];
  /** The button that Esc and a click on the scrim act as. */
  safeButton: string;
  /** Which element has focus when the dialog opens (5.1: Continue editing). */
  initialFocus: string;
}

export const DIALOGS = {
  'DLG-01': {
    id: 'DLG-01',
    title: MSG.UNSAVED_TITLE,
    body: MSG.UNSAVED_BODY,
    buttons: [MSG.UNSAVED_DISCARD, MSG.UNSAVED_CONTINUE],
    safeButton: MSG.UNSAVED_CONTINUE,
    initialFocus: MSG.UNSAVED_CONTINUE,
  },
  'DLG-02': {
    id: 'DLG-02',
    title: null,
    body: MSG.CHANNEL_UNSAVED,
    buttons: ['Discard', 'Keep editing'],
    safeButton: 'Keep editing',
    initialFocus: 'Keep editing',
  },
  'DLG-03': {
    id: 'DLG-03',
    title: 'Archive {n} {entity}?',
    body: 'Archived items stop serving and are hidden from the default view.',
    buttons: ['Archive', 'Cancel'],
    safeButton: 'Cancel',
    initialFocus: 'Cancel',
  },
  'DLG-04': {
    id: 'DLG-04',
    title: 'Download Structured Data Files',
    body: '',
    buttons: ['Next', 'Cancel'],
    safeButton: 'Cancel',
    initialFocus: 'Cancel',
  },
  'DLG-05': {
    id: 'DLG-05',
    title: 'Schedule {name} for deletion?',
    body: 'Its campaigns, insertion orders and line items will stop serving. You can cancel the deletion until {date}.',
    buttons: ['Schedule for deletion', 'Cancel'],
    safeButton: 'Cancel',
    initialFocus: 'Cancel',
  },
  'DLG-06': {
    id: 'DLG-06',
    title: 'Remove plan?',
    body: "{name} will be removed. This can't be undone.",
    buttons: ['Remove', 'Cancel'],
    safeButton: 'Cancel',
    initialFocus: 'Cancel',
  },
  'DLG-07': {
    id: 'DLG-07',
    title: 'End {name}?',
    body: "Ending stops the {kind}. This can't be undone.",
    buttons: ['End', 'Cancel'],
    safeButton: 'Cancel',
    initialFocus: 'Cancel',
  },
  'DLG-08': {
    id: 'DLG-08',
    title: 'Delete {name}?',
    body: 'This ad group and its ads will be deleted.',
    buttons: ['Delete', 'Cancel'],
    safeButton: 'Cancel',
    initialFocus: 'Cancel',
  },
  // DLG-09: trash on a targeting row has no dialog; the row leaves the form and the form becomes dirty.
  'DLG-10': {
    id: 'DLG-10',
    title: 'Copy settings',
    body: '',
    buttons: ['Copy Settings', 'Cancel'],
    safeButton: 'Cancel',
    initialFocus: 'Cancel',
  },
  'DLG-11': {
    id: 'DLG-11',
    title: 'This item changed',
    body: 'Someone else saved changes while you were editing. Reload to see the latest version.',
    buttons: ['Reload', 'Keep my changes'],
    safeButton: 'Reload',
    initialFocus: 'Reload',
  },
  'DLG-12': {
    id: 'DLG-12',
    title: null,
    body: MSG.DG_PREREQ,
    bullets: [MSG.DG_PREREQ_BULLET],
    buttons: ['Dismiss'],
    safeButton: 'Dismiss',
    initialFocus: 'Dismiss',
  },
} as const satisfies Record<string, DialogSpec>;

export type DialogId = keyof typeof DIALOGS;

/** DLG-03 adds the cascade sentence for campaigns and IOs only while the cascade flag is on (RC-040). */
export function archiveCascadeNote(entity: 'campaign' | 'insertionOrder' | 'lineItem'): string | null {
  if (!CASCADE_ARCHIVE) return null;
  if (entity === 'campaign') return 'Their insertion orders and line items will also be archived.';
  if (entity === 'insertionOrder') return 'Their line items will also be archived.';
  return null;
}

/** Title and body with their {placeholders} filled. */
export function renderDialog(id: DialogId, params?: MsgParams): { title: string | null; body: string } {
  const spec: DialogSpec = DIALOGS[id];
  return {
    title: spec.title === null ? null : format(spec.title, params),
    body: format(spec.body, params),
  };
}

// ---------------------------------------------------------------------------------------------
// Dirty state (5.1): isDirty = !deepEqual(normalize(current), normalize(initial))
// ---------------------------------------------------------------------------------------------

export interface DirtyOptions {
  /** Paths that never count: the change note, counters, expanded panels. */
  ignore?: readonly string[];
  /** Arrays whose trailing empty rows are dropped before comparing (budget grids). */
  trailingEmptyRows?: readonly string[];
  /** Arrays that are sets: compared without regard to order. */
  unordered?: readonly string[];
}

export const DEFAULT_DIRTY_OPTIONS: Required<DirtyOptions> = {
  ignore: ['changeNote'],
  trailingEmptyRows: ['budgets', 'budget.segments'],
  unordered: [
    'creativeTypes',
    'creatives',
    'inventory.exchanges',
    'inventory.deals',
    'inventory.dealGroups',
    'conversions.activities',
    'targeting.dimensions',
  ],
};

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.every(isEmptyValue);
  if (typeof value === 'object') return Object.values(value).every(isEmptyValue);
  return false;
}

function normalize(value: unknown, path: string, opts: Required<DirtyOptions>): unknown {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    let items = value.map((item) => normalize(item, `${path}[]`, opts));
    if (opts.trailingEmptyRows.includes(path)) {
      while (items.length > 0 && isEmptyValue(items[items.length - 1])) items = items.slice(0, -1);
    }
    if (opts.unordered.includes(path)) items = [...items].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    return items;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const childPath = path ? `${path}.${key}` : key;
      if (opts.ignore.includes(childPath)) continue;
      const child = (value as Record<string, unknown>)[key];
      if (child === undefined) continue;
      out[key] = normalize(child, childPath, opts);
    }
    return out;
  }
  return value;
}

/** `normalize` trims strings, drops empty trailing budget rows, sorts unordered lists and skips ignored paths. */
export function normalizeForDirty(value: unknown, options: DirtyOptions = {}): unknown {
  return normalize(value, '', { ...DEFAULT_DIRTY_OPTIONS, ...options });
}

/** Typing then reverting is clean. `initial` is the snapshot taken after defaults were applied. */
export function isDirty(current: unknown, initial: unknown, options: DirtyOptions = {}): boolean {
  return JSON.stringify(normalizeForDirty(current, options)) !== JSON.stringify(normalizeForDirty(initial, options));
}

/** UC-3: Apply copies a slide-over's edits into the parent form; Cancel, the X and the scrim discard them. */
export function commitSlideOver<T>(parent: T, edits: Partial<T>, action: 'apply' | 'cancel'): T {
  return action === 'apply' ? { ...parent, ...edits } : parent;
}
