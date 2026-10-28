// Parsers for docs/specs/validation.md used by the sync tests.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const ROOT = resolve(__dirname, '../..');

export function readDoc(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

/** Splits a table row on `|` that are not inside backticks. */
export function splitRow(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inCode = false;
  for (const ch of line) {
    if (ch === '`') inCode = !inCode;
    if (ch === '|' && !inCode) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  // leading and trailing pipes give empty first and last cells
  return cells.slice(1, -1);
}

export function backtickSpans(cell: string): string[] {
  return [...cell.matchAll(/`([^`]*)`/g)].map((m) => m[1]!);
}

/** The domains `P3-06a` implements: GEN, CMP, IO, LI and the type files except YouTube. */
export const IMPLEMENTED =
  /^(GEN|CMP|IO|LI|LI-DSP|LI-VID|LI-CTV|LI-AUD|LI-APP|LI-DG|LI-DOOH)-\d{3}$/;

export interface DocRule {
  id: string;
  alias: string | null;
  field: string;
  severity: 'error' | 'warning' | 'info';
  messageCell: string;
  /** First backticked span of the message cell with the [SIM] marker removed, or null. */
  text: string | null;
  sim: boolean;
  trigger: string;
}

const SEVERITY = { E: 'error', W: 'warning', I: 'info' } as const;

export function parseRuleTables(markdown: string): DocRule[] {
  const rules: DocRule[] = [];
  for (const line of markdown.split('\n')) {
    if (!line.startsWith('| ')) continue;
    const cells = splitRow(line);
    const idCell = cells[0] ?? '';
    const match = /^([A-Z]+(?:-[A-Z]+)?-\d{3})(?: ~([A-Z]+(?:-[A-Z]+)?-\d{3}))?$/.exec(idCell);
    if (!match || cells.length < 6) continue;
    const sev = SEVERITY[cells[3] as keyof typeof SEVERITY];
    if (!sev) continue;
    const messageCell = cells[4] ?? '';
    const span = backtickSpans(messageCell)[0] ?? null;
    const sim = span?.startsWith('[SIM] ') ?? false;
    rules.push({
      id: match[1]!,
      alias: match[2] ?? null,
      field: cells[1] ?? '',
      severity: sev,
      messageCell,
      text: span === null ? null : span.replace(/^\[SIM\] /, ''),
      sim,
      trigger: cells[5] ?? '',
    });
  }
  return rules;
}

/** Rule tables of the implemented domains only. */
export function implementedDocRules(): DocRule[] {
  return parseRuleTables(readDoc('docs/specs/validation.md')).filter((r) => IMPLEMENTED.test(r.id));
}

/** Which engine triggers a doc Trigger cell implies. B -> blur, X -> cross, A -> activate, S -> save, n/a -> none. */
export function expectedTriggers(cell: string): string[] {
  const text = cell.replace(/\(.*?\)/g, '').trim();
  if (text === 'n/a') return [];
  const out: string[] = [];
  if (/\bB\b/.test(text)) out.push('blur');
  if (/\bX\b/.test(text)) out.push('cross');
  if (/\bA\b/.test(text)) out.push('activate');
  if (out.length === 0 && /\bS\b/.test(text)) out.push('save');
  return out;
}
