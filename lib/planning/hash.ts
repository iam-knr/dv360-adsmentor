// FNV-1a string hash and a 0..1 float from it. No node:crypto: this file is imported by client components.
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export const unit = (s: string): number => fnv1a(s) / 0x1_0000_0000;
export const hex = (s: string): string => fnv1a(s).toString(16).padStart(8, '0');
