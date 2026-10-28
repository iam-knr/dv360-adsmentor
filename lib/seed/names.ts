// Synthetic names (data-model 3.3, PROJECT.md R5). Brands are built from fictional parts; a blocklist rejects real brands.
import brands from '../../data/reference/brands.json';
import type { Rng } from './prng';

export const BRAND_FIRST: readonly string[] = brands.first;
export const BRAND_SECOND: readonly string[] = brands.second;
export const REAL_BRAND_BLOCKLIST: readonly string[] = brands.realBrandBlocklist;

/** True when the text contains a known real brand (case-insensitive substring). */
export function containsRealBrand(
  text: string,
  blocklist: readonly string[] = REAL_BRAND_BLOCKLIST,
): boolean {
  const lower = text.toLowerCase();
  return blocklist.some((b) => lower.includes(b));
}

export function assertSyntheticName(text: string): string {
  if (containsRealBrand(text)) throw new Error(`Generated name "${text}" matches a real brand`);
  return text;
}

/** Brand names for n advertisers. Names are unique inside one call. */
export function brandNames(rng: Rng, count: number): string[] {
  const names: string[] = [];
  const firsts = rng.shuffle(BRAND_FIRST);
  const seconds = rng.shuffle(BRAND_SECOND);
  for (let i = 0; i < count; i++) {
    const first = firsts[i % firsts.length] as string;
    const second = seconds[(i * 3 + 1) % seconds.length] as string;
    names.push(assertSyntheticName(`${first} ${second}`));
  }
  return names;
}

export function brandSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** https://brand-name.example (data-model 3.3: landing pages use example domains). */
export function brandWebsite(name: string): string {
  return `https://${brandSlug(name)}.example`;
}

/** Synthetic e-mail on the .invalid TLD (data-model 3.3). */
export function syntheticEmail(local: string): string {
  return `${local}@sim.adsmetor.invalid`;
}
