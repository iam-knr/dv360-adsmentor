// `npm run engine:golden` regenerates lib/engine/testing/goldens/determinism.7d.json and prints a
// diff of every changed field, so a golden change is always reviewed (engine.md 11.1 item 10).
// Use `--check` to compare without writing; the exit code is 1 when the golden is stale.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeGolden, type GoldenSnapshot } from './goldens';

const file = resolve(dirname(fileURLToPath(import.meta.url)), 'goldens', 'determinism.7d.json');
const check = process.argv.includes('--check');
const out = (line: string) => process.stdout.write(`${line}\n`);

const next = computeGolden();
const prev: GoldenSnapshot | null = existsSync(file)
  ? (JSON.parse(readFileSync(file, 'utf8')) as GoldenSnapshot)
  : null;

function flat(o: unknown, prefix = ''): Record<string, unknown> {
  if (o === null || typeof o !== 'object') return { [prefix]: o };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o as Record<string, unknown>))
    Object.assign(out, flat(v, prefix ? `${prefix}.${k}` : k));
  return out;
}

const a = flat(prev ?? {});
const b = flat(next);
const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
let changed = 0;
for (const k of keys) {
  if (a[k] !== b[k]) {
    changed++;
    out(`- ${k}: ${String(a[k])}`);
    out(`+ ${k}: ${String(b[k])}`);
  }
}
if (changed === 0) {
  out('golden unchanged');
} else if (check) {
  out(`${changed} field(s) differ. Run "npm run engine:golden" and review the diff.`);
  process.exit(1);
} else {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
  out(`golden written (${changed} field(s) changed): ${file}`);
}
