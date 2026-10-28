import { cyrb128 } from '../rng/xoshiro';

/** JSON with object keys sorted, so the hash never depends on key order. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/** 128-bit non-cryptographic hash as 32 hex characters. */
export function hashString(s: string): string {
  return cyrb128(s)
    .map((n) => n.toString(16).padStart(8, '0'))
    .join('');
}

export const hashJson = (value: unknown): string => hashString(stableStringify(value));
