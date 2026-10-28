// Static scan behind AC-05-7: a service file must not write a tenant model outside withChangeLog.
// Lexical, on purpose: it needs no type information, so it runs in the unit project and in a fixture test.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ENGINE_OWNED_TABLES, UI_STATE_TABLES } from './ui-state-tables';

export interface Violation {
  file: string;
  line: number;
  model: string;
  op: string;
}

export interface ScanOptions {
  /** Prisma model names that carry a sandboxId (see lib/db/schema-info.ts). */
  tenantModels: readonly string[];
  /** Tables whose writes need no log entry. Default: UI_STATE_TABLES plus ENGINE_OWNED_TABLES. */
  exempt?: readonly string[];
}

/** Where the real repository scan looks (module 05 4.1.1) and which paths inside it are exempt by design. */
export const SCAN_ROOTS = ['lib/services', 'lib/actions', 'app'] as const;
export const SCAN_EXEMPT_PATHS: readonly RegExp[] = [
  /^lib\/engine\//,
  /^lib\/seed\//,
  /^lib\/db\//,
  /^lib\/changelog\//,
  /^lib\/sandbox\//,
  /^app\/api\/sim\/engine\//,
];

const WRITE_OPS =
  'create|createMany|createManyAndReturn|update|updateMany|upsert|delete|deleteMany';

/** Blank out comments and string contents, keeping offsets and newlines, so brackets inside them are ignored. */
export function blankNonCode(src: string): string {
  const out = src.split('');
  let i = 0;
  const blank = (from: number, to: number) => {
    for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' ';
  };
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') {
      const end = src.indexOf('\n', i);
      const stop = end === -1 ? src.length : end;
      blank(i, stop);
      i = stop;
    } else if (c === '/' && n === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? src.length : end + 2;
      blank(i, stop);
      i = stop;
    } else if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === '\\' ? 2 : 1;
      blank(i + 1, j);
      i = j + 1;
    } else {
      i++;
    }
  }
  return out.join('');
}

function matchingParen(code: string, open: number): number {
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === '(') depth++;
    else if (code[i] === ')' && --depth === 0) return i;
  }
  return code.length;
}

const lineOf = (src: string, index: number) => src.slice(0, index).split('\n').length;
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function scanSource(file: string, source: string, opts: ScanOptions): Violation[] {
  const exempt = new Set(opts.exempt ?? [...UI_STATE_TABLES, ...ENGINE_OWNED_TABLES]);
  const byDelegate = new Map(
    opts.tenantModels.filter((m) => !exempt.has(m)).map((m) => [lowerFirst(m), m] as const),
  );
  const tenant = new Set(opts.tenantModels.filter((m) => !exempt.has(m)));
  const code = blankNonCode(source);

  const spans: Array<[number, number]> = [];
  for (const m of code.matchAll(/\bwithChangeLog\s*\(/g)) {
    const open = m.index + m[0].length - 1;
    spans.push([open, matchingParen(code, open)]);
  }
  const inside = (index: number) => spans.some(([a, b]) => index > a && index < b);

  const found: Violation[] = [];
  for (const m of code.matchAll(new RegExp(`\\.(\\w+)\\.(${WRITE_OPS})\\s*\\(`, 'g'))) {
    const model = byDelegate.get(m[1] as string);
    if (model && !inside(m.index)) {
      found.push({ file, line: lineOf(source, m.index), model, op: m[2] as string });
    }
  }
  for (const m of code.matchAll(/\$executeRaw(?:Unsafe)?\s*[`(]/g)) {
    const text = source.slice(m.index, m.index + 600);
    const sql = /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+"?(\w+)"?/i.exec(text);
    const model = sql?.[1];
    if (model && tenant.has(model) && !inside(m.index)) {
      found.push({ file, line: lineOf(source, m.index), model, op: 'raw SQL' });
    }
  }
  return found.sort((a, b) => a.line - b.line);
}

function* walk(dir: string): Generator<string> {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) yield full;
  }
}

/** Scan the repository roots. Paths in the result are relative to `root` with forward slashes. */
export function scanRepository(root: string, opts: ScanOptions): Violation[] {
  const out: Violation[] = [];
  for (const dir of SCAN_ROOTS) {
    for (const abs of walk(join(root, dir))) {
      const rel = relative(root, abs).split('\\').join('/');
      if (SCAN_EXEMPT_PATHS.some((re) => re.test(rel))) continue;
      out.push(...scanSource(rel, readFileSync(abs, 'utf8'), opts));
    }
  }
  return out;
}
