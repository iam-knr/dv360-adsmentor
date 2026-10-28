// Stable serialisation and hashing for the determinism tests (acceptance: byte-identical rows).
import { createHash } from 'node:crypto';

function normalise(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return `${value}n`;
  if (value instanceof Date) return `date:${value.toISOString()}`;
  if (Array.isArray(value)) return value.map(normalise);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    // Prisma.Decimal serialises through toString; it is the only non-plain object the plans hold besides Date.
    if (obj.constructor?.name === 'Decimal')
      return `dec:${(value as { toString(): string }).toString()}`;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      if (obj[key] !== undefined) out[key] = normalise(obj[key]);
    }
    return out;
  }
  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(normalise(value));
}

export function hashValue(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}
