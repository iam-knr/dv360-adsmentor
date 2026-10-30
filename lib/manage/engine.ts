import 'server-only';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Engine parameters, read only: the version is the content hash (engine.md 2.7). Editing is not in v1. */
export function readEngineParams(): { hash: string; bytes: number; top: [string, unknown][] } {
  const raw = readFileSync(join(process.cwd(), 'engine', 'params.json'), 'utf8');
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return {
    hash: createHash('sha256').update(raw).digest('hex').slice(0, 12),
    bytes: raw.length,
    top: Object.entries(parsed).map(([k, v]) => [k, v]),
  };
}
