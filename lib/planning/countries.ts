// Planning countries (module 04 DELTA-04-2, C-04-4): the union of the nine engine markets and the thirteen Cross-media
// countries. Constants, not a table: the data is global, fixed and tiny. Populations are synthetic `[SIM]` values
// chosen so Singapore gives the demo numbers (census 3.68M, YouTube 3.54M).
import type { CrossMediaCountry } from '@prisma/client';

export interface PlanCountryDef {
  code: string;
  name: string;
  currency: string;
  census: number;
  digital: number;
  tv: number;
  youtube: number;
  /** Clearing CPM of open auction display in USD (before the plan currency conversion). */
  cpmUsd: number;
  /** Linear TV CPM in USD (`plan.tvCpm`, Q4). */
  tvCpmUsd: number;
  /** Engine market key (ENG 2.6), when the country is one of the nine. */
  engineMarket?: string;
  /** Set for the 13 Cross-media countries. */
  crossMedia?: CrossMediaCountry;
}

const C = (
  code: string,
  name: string,
  currency: string,
  census: number,
  digitalPct: number,
  tvPct: number,
  youtubePct: number,
  cpmUsd: number,
  tvCpmUsd: number,
  extra: Partial<Pick<PlanCountryDef, 'engineMarket' | 'crossMedia'>> = {},
): PlanCountryDef => ({
  code,
  name,
  currency,
  census,
  digital: Math.round(census * digitalPct),
  tv: Math.round(census * tvPct),
  youtube: Math.round(census * youtubePct),
  cpmUsd,
  tvCpmUsd,
  ...extra,
});

export const PLAN_COUNTRIES: readonly PlanCountryDef[] = [
  C('IN', 'India', 'INR', 1_050_000_000, 0.55, 0.62, 0.5, 0.75, 1.4, { engineMarket: 'IN' }),
  C('ID', 'Indonesia', 'IDR', 220_000_000, 0.7, 0.8, 0.62, 0.55, 1.2, { engineMarket: 'ID' }),
  C('AE', 'United Arab Emirates', 'AED', 8_800_000, 0.97, 0.9, 0.9, 2.6, 5.5, {
    engineMarket: 'AE',
  }),
  C('SG', 'Singapore', 'SGD', 3_680_000, 0.96, 0.85, 0.962, 1.5, 4.2, { engineMarket: 'SG' }),
  C('AU', 'Australia', 'AUD', 21_000_000, 0.95, 0.88, 0.85, 3.2, 8.4, {
    engineMarket: 'AU',
    crossMedia: 'AUSTRALIA',
  }),
  C('UK', 'United Kingdom', 'GBP', 55_000_000, 0.96, 0.9, 0.83, 3.6, 9.2, {
    engineMarket: 'UK',
    crossMedia: 'UNITED_KINGDOM',
  }),
  C('DE', 'Germany', 'EUR', 71_000_000, 0.94, 0.9, 0.8, 3.1, 8.0, {
    engineMarket: 'DE',
    crossMedia: 'GERMANY',
  }),
  C('US', 'United States', 'USD', 270_000_000, 0.94, 0.88, 0.82, 4.2, 11.5, {
    engineMarket: 'US',
    crossMedia: 'UNITED_STATES',
  }),
  C('BR', 'Brazil', 'BRL', 175_000_000, 0.8, 0.9, 0.78, 1.1, 2.6, {
    engineMarket: 'BR',
    crossMedia: 'BRAZIL',
  }),
  C('AR', 'Argentina', 'ARS', 38_000_000, 0.87, 0.9, 0.8, 1.0, 2.2, { crossMedia: 'ARGENTINA' }),
  C('CA', 'Canada', 'CAD', 30_000_000, 0.95, 0.9, 0.82, 3.3, 8.8, { crossMedia: 'CANADA' }),
  C('CL', 'Chile', 'CLP', 16_000_000, 0.9, 0.92, 0.8, 1.3, 2.9, { crossMedia: 'CHILE' }),
  C('CO', 'Colombia', 'COP', 42_000_000, 0.8, 0.9, 0.75, 1.0, 2.1, { crossMedia: 'COLOMBIA' }),
  C('FR', 'France', 'EUR', 55_000_000, 0.93, 0.92, 0.78, 2.9, 7.4, { crossMedia: 'FRANCE' }),
  C('JP', 'Japan', 'JPY', 105_000_000, 0.93, 0.95, 0.8, 2.7, 7.0, { crossMedia: 'JAPAN' }),
  C('MX', 'Mexico', 'MXN', 105_000_000, 0.77, 0.9, 0.74, 1.2, 2.8, { crossMedia: 'MEXICO' }),
  C('VN', 'Vietnam', 'VND', 80_000_000, 0.75, 0.85, 0.7, 0.6, 1.1, { crossMedia: 'VIETNAM' }),
];

/** Units of each currency per 1 USD (ENG params `fx.perUSD`, extended for the Cross-media countries). */
export const PER_USD: Record<string, number> = {
  USD: 1,
  INR: 88,
  SGD: 1.34,
  AED: 3.67,
  GBP: 0.78,
  EUR: 0.92,
  AUD: 1.52,
  IDR: 16300,
  BRL: 5.4,
  JPY: 150,
  ARS: 950,
  CAD: 1.37,
  CLP: 920,
  COP: 4000,
  MXN: 18,
  VND: 25000,
};

export const CURRENCY_NAME: Record<string, { name: string; symbol: string }> = {
  USD: { name: 'US dollar', symbol: '$' },
  INR: { name: 'Indian rupee', symbol: '₹' },
  SGD: { name: 'Singapore dollar', symbol: '$' },
  AED: { name: 'UAE dirham', symbol: 'د.إ' },
  GBP: { name: 'Pound sterling', symbol: '£' },
  EUR: { name: 'Euro', symbol: '€' },
  AUD: { name: 'Australian dollar', symbol: '$' },
  IDR: { name: 'Indonesian rupiah', symbol: 'Rp' },
  BRL: { name: 'Brazilian real', symbol: 'R$' },
  JPY: { name: 'Japanese yen', symbol: '¥' },
  ARS: { name: 'Argentine peso', symbol: '$' },
  CAD: { name: 'Canadian dollar', symbol: '$' },
  CLP: { name: 'Chilean peso', symbol: '$' },
  COP: { name: 'Colombian peso', symbol: '$' },
  MXN: { name: 'Mexican peso', symbol: '$' },
  VND: { name: 'Vietnamese dong', symbol: '₫' },
};

export function planCountry(code: string): PlanCountryDef | undefined {
  return PLAN_COUNTRIES.find((c) => c.code === code);
}

export const planCountryOrDefault = (code: string): PlanCountryDef =>
  planCountry(code) ?? (PLAN_COUNTRIES.find((c) => c.code === 'SG') as PlanCountryDef);

/** Plan country for an advertiser currency (the default location of a new plan, spec 4.2). */
export function countryForCurrency(currency: string): PlanCountryDef {
  return PLAN_COUNTRIES.find((c) => c.currency === currency) ?? planCountryOrDefault('SG');
}

export const CROSS_MEDIA_COUNTRIES: readonly PlanCountryDef[] = PLAN_COUNTRIES.filter(
  (c) => c.crossMedia,
);

export const crossMediaCountry = (key: CrossMediaCountry): PlanCountryDef =>
  CROSS_MEDIA_COUNTRIES.find((c) => c.crossMedia === key) as PlanCountryDef;

/** Convert an amount between currencies through USD. */
export function convertCurrency(amount: number, from: string, to: string): number {
  if (from === to) return amount;
  const f = PER_USD[from] ?? 1;
  const t = PER_USD[to] ?? 1;
  return (amount / f) * t;
}

// ---- Demographics -----------------------------------------------------------------------------

export const AGE_BRACKETS = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'] as const;
export type AgeBracket = (typeof AGE_BRACKETS)[number];
export const GENDERS = ['MALE', 'FEMALE', 'UNKNOWN'] as const;
export type Gender = (typeof GENDERS)[number];

/** Share of the census population per age bracket (adults only, sums to 1 over 18+). */
const AGE_SHARE: Record<AgeBracket, number> = {
  '18-24': 0.14,
  '25-34': 0.21,
  '35-44': 0.2,
  '45-54': 0.18,
  '55-64': 0.15,
  '65+': 0.12,
};
const GENDER_SHARE: Record<Gender, number> = { MALE: 0.49, FEMALE: 0.49, UNKNOWN: 0.02 };

export interface PlanDemographics {
  genders: Gender[];
  ageMin: number;
  ageMax: number;
}

/** "All people": every gender (unknown included) and every bracket, 18 to 65+ (stored as 120, like the editor's 65+). */
export const DEFAULT_DEMOGRAPHICS: PlanDemographics = {
  genders: ['MALE', 'FEMALE', 'UNKNOWN'],
  ageMin: 18,
  ageMax: 120,
};

const BRACKET_RANGE: Record<AgeBracket, [number, number]> = {
  '18-24': [18, 24],
  '25-34': [25, 34],
  '35-44': [35, 44],
  '45-54': [45, 54],
  '55-64': [55, 64],
  '65+': [65, 120],
};

/** Brackets that overlap the age range (a bracket counts when the range reaches into it). */
export function bracketsFor(d: PlanDemographics): AgeBracket[] {
  return AGE_BRACKETS.filter((b) => {
    const [lo, hi] = BRACKET_RANGE[b];
    return d.ageMin <= hi && d.ageMax >= lo;
  });
}

/** Share of the census population inside the demographic selection. */
export function demoShare(d: PlanDemographics): number {
  const ages = bracketsFor(d).reduce((s, b) => s + AGE_SHARE[b], 0);
  const sexes = d.genders.reduce((s, g) => s + GENDER_SHARE[g], 0);
  return Math.max(0, Math.min(1, ages * sexes));
}

export const ageShare = (b: AgeBracket): number => AGE_SHARE[b];
export const genderShare = (g: Gender): number => GENDER_SHARE[g];

/** "All people, 18 - 65+" or "Male and Female, 25 - 64" (explore 13). One label for the wizard, the editor, the CSV. */
export function demographicsLabel(d: PlanDemographics): string {
  const known = d.genders.filter((g) => g !== 'UNKNOWN');
  const all = d.genders.includes('UNKNOWN') && known.length === 2;
  const sex = all
    ? 'All people'
    : known.length === 2 || known.length === 0
      ? 'Male and Female'
      : known[0] === 'MALE'
        ? 'Male'
        : 'Female';
  return `${sex}, ${d.ageMin} - ${d.ageMax >= 65 ? '65+' : d.ageMax}`;
}
