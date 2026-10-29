// Audience analysis (module 14 S17, S18, Δ14-14): geographic distribution of a seed list and the composition of the
// audience a line item reaches with optimized targeting. Deterministic: the same seed list gives the same numbers.
// Client safe. All values are synthetic `[SIM]`.
import { keyed } from './sizes';

export interface Bucket {
  label: string;
  sharePct: number;
  index: number;
}

export interface GeoRegion {
  code: string;
  name: string;
  index: number;
  sharePct: number;
  suggested: boolean;
}

export interface GeoDistribution {
  seed: { id: string; name: string; size: number };
  regions: GeoRegion[];
  generatedAt: string;
}

export interface AudienceInsights {
  liId: string;
  sampleSize: number;
  age: Bucket[];
  gender: Bucket[];
  device: Bucket[];
  regions: Bucket[];
  interests: Bucket[];
}

/** Share of the population per region (sums to 100). */
const POPULATION: Record<string, { code: string; name: string; pop: number }[]> = {
  IN: [
    { code: 'MH', name: 'Maharashtra', pop: 9.3 },
    { code: 'UP', name: 'Uttar Pradesh', pop: 16.5 },
    { code: 'KA', name: 'Karnataka', pop: 5.0 },
    { code: 'TN', name: 'Tamil Nadu', pop: 5.7 },
    { code: 'DL', name: 'Delhi', pop: 1.4 },
    { code: 'GJ', name: 'Gujarat', pop: 5.0 },
    { code: 'WB', name: 'West Bengal', pop: 7.4 },
    { code: 'TS', name: 'Telangana', pop: 3.1 },
    { code: 'KL', name: 'Kerala', pop: 2.8 },
    { code: 'RJ', name: 'Rajasthan', pop: 5.7 },
    { code: 'Other', name: 'Other regions', pop: 38.1 },
  ],
  US: [
    { code: 'CA', name: 'California', pop: 11.8 },
    { code: 'TX', name: 'Texas', pop: 8.7 },
    { code: 'FL', name: 'Florida', pop: 6.5 },
    { code: 'NY', name: 'New York', pop: 5.8 },
    { code: 'IL', name: 'Illinois', pop: 3.8 },
    { code: 'PA', name: 'Pennsylvania', pop: 3.9 },
    { code: 'OH', name: 'Ohio', pop: 3.5 },
    { code: 'WA', name: 'Washington', pop: 2.3 },
    { code: 'Other', name: 'Other regions', pop: 53.7 },
  ],
  SG: [
    { code: 'CE', name: 'Central Region', pop: 30 },
    { code: 'EA', name: 'East Region', pop: 20 },
    { code: 'NO', name: 'North Region', pop: 12 },
    { code: 'NE', name: 'North-East Region', pop: 20 },
    { code: 'WE', name: 'West Region', pop: 18 },
  ],
};

export const SUGGESTED_INDEX = 120;

export const regionsFor = (country: string) => POPULATION[country] ?? POPULATION.IN!;

/** Ranked regions: index against the population, share of the seed audience, suggested at an index of 120 or more. */
export function geoDistribution(
  seed: { id: string; name: string; size: number },
  country: string,
  generatedAt: string,
): GeoDistribution {
  const regions = regionsFor(country);
  const weights = regions.map((r) => ({
    r,
    w: r.pop * keyed(`geo:${seed.id}:${r.code}`, 0.45, 1.9),
  }));
  const total = weights.reduce((s, x) => s + x.w, 0);
  // Shares in tenths of a percent so that they sum to exactly 100.
  const tenths = weights.map((x) => Math.floor((x.w / total) * 1000));
  let rest = 1000 - tenths.reduce((s, v) => s + v, 0);
  const order = weights.map((_, i) => i).sort((a, b) => weights[b]!.w - weights[a]!.w);
  for (let k = 0; rest > 0; k = (k + 1) % order.length, rest--) tenths[order[k]!]! += 1;
  const rows: GeoRegion[] = weights.map((x, i) => {
    const sharePct = tenths[i]! / 10;
    const index = Math.round((sharePct / x.r.pop) * 100);
    return { code: x.r.code, name: x.r.name, index, sharePct, suggested: index >= SUGGESTED_INDEX };
  });
  rows.sort((a, b) => b.index - a.index || a.code.localeCompare(b.code));
  return { seed, regions: rows, generatedAt };
}

function buckets(key: string, labels: string[], base: number[]): Bucket[] {
  const w = labels.map((l, i) => base[i]! * keyed(`${key}:${l}`, 0.6, 1.5));
  const total = w.reduce((s, v) => s + v, 0);
  return labels.map((label, i) => {
    const sharePct = Math.round((w[i]! / total) * 1000) / 10;
    return { label, sharePct, index: Math.round((sharePct / base[i]!) * 100) };
  });
}

const norm = (xs: number[]): number[] => {
  const s = xs.reduce((a, b) => a + b, 0);
  return xs.map((x) => (x / s) * 100);
};

const AGE = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const GENDER = ['Female', 'Male', 'Unknown'];
const DEVICE = ['Smartphone', 'Computer', 'Tablet', 'Connected TV'];
const INTERESTS = [
  'Sports Fans',
  'Technophiles',
  'Foodies',
  'Travel Buffs',
  'Shoppers',
  'Movie Lovers',
  'Fitness Enthusiasts',
];

/** Composition of the audience reached by a line item with optimized targeting. */
export function audienceInsights(liId: string, country: string, sampleSize: number): AudienceInsights {
  const regions = regionsFor(country);
  return {
    liId,
    sampleSize,
    age: buckets(`age:${liId}`, AGE, norm([18, 24, 20, 16, 13, 9])),
    gender: buckets(`gender:${liId}`, GENDER, norm([47, 49, 4])),
    device: buckets(`device:${liId}`, DEVICE, norm([62, 24, 6, 8])),
    regions: buckets(`regions:${liId}`, regions.slice(0, 6).map((r) => r.name), norm(regions.slice(0, 6).map((r) => r.pop))),
    interests: buckets(`interests:${liId}`, INTERESTS, norm([14, 16, 15, 12, 18, 13, 12])),
  };
}
