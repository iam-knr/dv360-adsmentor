// Diff of a before and after image through a field registry (module 05 4.1 steps 3 to 5). Pure; no database.
import type { ChangeKind } from '@prisma/client';
import { canonical } from './canon';
import {
  MAX_CREATE_ENTRIES,
  type EntityRegistry,
  type FieldDef,
  type FmtCtx,
  type Image,
} from './registry-types';

export interface EntryDraft {
  kind: ChangeKind;
  fieldPath: string;
  label: string;
  oldValue: string | null;
  newValue: string | null;
  parentPath: string | null;
  sortOrder: number;
  /** Not stored. Set for list element entries so the summary can say "2 ad exchanges removed". */
  list?: { path: string; noun: string | null; nounPlural: string | null };
}

const elementKeyOf = (def: FieldDef, el: Image): string =>
  def.elementKey ? def.elementKey(el) : String(el.id);
const elementLabelOf = (def: FieldDef, el: Image): string =>
  def.elementLabel ? def.elementLabel(el) : elementKeyOf(def, el);

const asList = (v: unknown): Image[] => (Array.isArray(v) ? (v as Image[]) : []);

function listMeta(def: FieldDef) {
  return {
    path: def.path,
    noun: def.elementNoun ?? null,
    nounPlural: def.elementNounPlural ?? null,
  };
}

/** Entries for a save of an existing entity. Empty when nothing really changed (AC-05-2). */
export function diffImages(
  registry: EntityRegistry,
  before: Image,
  after: Image,
  fmt: FmtCtx = {},
): EntryDraft[] {
  const out: EntryDraft[] = [];
  const push = (e: Omit<EntryDraft, 'sortOrder'>) => out.push({ ...e, sortOrder: out.length });

  for (const def of registry.fields) {
    if (def.ignore) continue;
    if (def.kind === 'list') {
      const b = new Map(asList(before[def.path]).map((el) => [elementKeyOf(def, el), el]));
      const a = new Map(asList(after[def.path]).map((el) => [elementKeyOf(def, el), el]));
      for (const [key, el] of a) {
        const prev = b.get(key);
        if (!prev) {
          push({
            kind: 'CREATE',
            fieldPath: `${def.path}[${key}]`,
            label: elementLabelOf(def, el),
            oldValue: null,
            newValue: null,
            parentPath: null,
            list: listMeta(def),
          });
          continue;
        }
        for (const child of def.childFields ?? []) {
          if (child.ignore) continue;
          const o = canonical(prev[child.path], child.kind, fmt);
          const n = canonical(el[child.path], child.kind, fmt);
          if (o === n) continue;
          push({
            kind: 'UPDATE',
            fieldPath: `${def.path}[${key}].${child.path}`,
            label: child.label,
            oldValue: o,
            newValue: n,
            parentPath: elementLabelOf(def, el),
          });
        }
      }
      for (const [key, el] of b) {
        if (a.has(key)) continue;
        push({
          kind: 'DELETE',
          fieldPath: `${def.path}[${key}]`,
          label: elementLabelOf(def, el),
          oldValue: null,
          newValue: null,
          parentPath: null,
          list: listMeta(def),
        });
      }
      continue;
    }
    const o = canonical(before[def.path], def.kind, fmt);
    const n = canonical(after[def.path], def.kind, fmt);
    if (o === n) continue;
    push({
      kind: def.path === 'status' ? 'STATUS_CHANGE' : 'UPDATE',
      fieldPath: def.path,
      label: def.path === 'status' ? 'Status' : def.label,
      oldValue: o,
      newValue: n,
      parentPath: null,
    });
  }
  return out;
}

/** Entries for a new entity: one CREATE per non-null registered field, registry order, capped at 60. */
export function createEntries(
  registry: EntityRegistry,
  after: Image,
  fmt: FmtCtx = {},
): EntryDraft[] {
  const out: EntryDraft[] = [];
  const push = (e: Omit<EntryDraft, 'sortOrder'>) => {
    if (out.length < MAX_CREATE_ENTRIES) out.push({ ...e, sortOrder: out.length });
  };
  for (const def of registry.fields) {
    if (def.ignore) continue;
    if (def.kind === 'list') {
      for (const el of asList(after[def.path])) {
        push({
          kind: 'CREATE',
          fieldPath: `${def.path}[${elementKeyOf(def, el)}]`,
          label: elementLabelOf(def, el),
          oldValue: null,
          newValue: null,
          parentPath: null,
          list: listMeta(def),
        });
      }
      continue;
    }
    const n = canonical(after[def.path], def.kind, fmt);
    if (n === null) continue;
    push({
      kind: 'CREATE',
      fieldPath: def.path,
      label: def.label,
      oldValue: null,
      newValue: n,
      parentPath: null,
    });
  }
  return out;
}

/** A hard delete writes one DELETE entry that names the removed row. */
export function deleteEntries(registry: EntityRegistry, before: Image): EntryDraft[] {
  const name = typeof before.name === 'string' ? before.name : null;
  return [
    {
      kind: 'DELETE',
      fieldPath: '$entity',
      label: registry.noun.charAt(0).toUpperCase() + registry.noun.slice(1),
      oldValue: name,
      newValue: null,
      parentPath: null,
      sortOrder: 0,
    },
  ];
}
