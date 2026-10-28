// Group summary text (module 05 4.3).
import type { EntryDraft } from './diff';
import { sentenceCase } from './render';

export type SaveKind = 'CREATE' | 'UPDATE' | 'DELETE';

const plural = (n: number, singular: string, pluralForm: string | null) =>
  n === 1 ? singular : (pluralForm ?? `${singular}s`);

export function summarise(input: { kind: SaveKind; entries: EntryDraft[]; noun: string }): string {
  const { kind, entries, noun } = input;
  const n = entries.length;
  if (kind === 'CREATE') return `${n} changes made.`;
  if (kind === 'DELETE') return `1 ${noun} deleted`;
  const first = entries[0];
  if (!first) return `0 changes to ${noun}`;
  if (n === 1 && first.kind === 'STATUS_CHANGE') {
    return `Status changed to ${sentenceCase(first.newValue ?? '')}`;
  }
  // list additions or removals of one list only: "2 ad exchanges removed"
  const listed = entries.filter((e) => e.list);
  const firstList = first.list;
  if (
    firstList?.noun &&
    listed.length === n &&
    entries.every((e) => e.list?.path === firstList.path && e.kind === first.kind)
  ) {
    const word = plural(n, firstList.noun, firstList.nounPlural);
    return `${n} ${word} ${first.kind === 'CREATE' ? 'added' : 'removed'}`;
  }
  return `${n} ${n === 1 ? 'change' : 'changes'} to ${noun}`;
}
