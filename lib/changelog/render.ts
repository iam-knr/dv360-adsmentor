// Read-side text for stored entries (module 05 4.4). Pure. The log stores canonical values; labels are applied here.
import type { FieldDef, FmtCtx } from './registry-types';

/** "SCHEDULED_FOR_DELETION" -> "Scheduled for deletion". Default formatter for enum keys. */
export function sentenceCase(key: string): string {
  if (!key) return key;
  const words = key.toLowerCase().split('_').join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export interface StoredEntry {
  kind: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';
  fieldPath: string;
  label: string;
  oldValue: string | null;
  newValue: string | null;
  parentPath?: string | null;
}

function show(value: string | null, def: FieldDef | undefined, ctx: FmtCtx): string {
  if (value === null || value === '') return '(none)';
  if (def?.format) return def.format(value, ctx);
  if (def?.kind === 'bool') return value === 'true' ? 'Checked' : 'Unchecked';
  if (def?.kind === 'enum') return sentenceCase(value);
  return value;
}

/** One display line for one entry. */
export function renderLine(entry: StoredEntry, def?: FieldDef, ctx: FmtCtx = {}): string {
  const prefix = entry.parentPath ? `${entry.parentPath}: ` : '';
  switch (entry.kind) {
    case 'STATUS_CHANGE': {
      const statusDef = def ?? { path: 'status', label: 'Status', kind: 'enum' as const };
      return `Status changed from "${show(entry.oldValue, statusDef, ctx)}" to "${show(entry.newValue, statusDef, ctx)}"`;
    }
    case 'UPDATE':
      return `${prefix}${entry.label} changed from "${show(entry.oldValue, def, ctx)}" to "${show(entry.newValue, def, ctx)}"`;
    case 'CREATE':
      return entry.newValue === null && entry.fieldPath.includes('[')
        ? entry.label
        : `${entry.label} is ${show(entry.newValue, def, ctx)}`;
    case 'DELETE':
      return entry.label;
  }
}
