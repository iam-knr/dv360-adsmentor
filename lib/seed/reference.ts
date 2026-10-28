// Global reference data as plain rows (data-model 3.1 step 1). Pure: reads data/reference/*.json, returns rows with
// deterministic ids so the sandbox plan can point at them without a database round trip.
import exchangesJson from '../../data/reference/exchanges.json';
import geographyJson from '../../data/reference/geography.json';
import languagesJson from '../../data/reference/languages.json';
import categoriesJson from '../../data/reference/categories.json';
import technologyJson from '../../data/reference/technology.json';
import labelsJson from '../../data/reference/labels.json';
import appsJson from '../../data/reference/apps.json';
import googleAudiencesJson from '../../data/reference/google-audiences.json';
import fxJson from '../../data/reference/fx-rates.json';
import { VENDOR_ALLOW_LIST } from './vendors';
import { stableId } from './prng';

export type ExchangeKindKey = 'EXCHANGE' | 'APP_MEDIATION_PARTNER';
export type AuctionTypeKey = 'FIRST_PRICE' | 'SECOND_PRICE';

/** Engine keys of ENG 2.7 plus long_tail (RC-029). */
export const SIM_CLASSES = [
  'google_ad_manager',
  'index_exchange',
  'pubmatic',
  'openx',
  'magnite',
  'magnite_springserve',
  'equativ',
  'adform',
  'gumgum',
  'triplelift',
  'freewheel_ssp',
  'adswizz',
  'spotify_ad_exchange',
  'long_tail',
] as const;
export type SimClass = (typeof SIM_CLASSES)[number];

export interface ExchangeSeed {
  id: string;
  code: string;
  name: string;
  kind: ExchangeKindKey;
  /** Engine key. Not a database column before P3-05c (data-model DELTA-02-1); kept in the seed data and in this module. */
  simClass: SimClass;
  supportsDisplay: boolean;
  supportsVideo: boolean;
  supportsAudio: boolean;
  supportsCtv: boolean;
  supportsDooh: boolean;
  needsSeatId: boolean;
  needsNetworkId: boolean;
  enabledByDefault: boolean;
  sortOrder: number;
  auctionType: AuctionTypeKey;
  /** Share inside its simClass over the rows that are enabled by default (RC-029): sums to 1. */
  simSupplyShare: string;
  simFloorCpm: string;
}

interface RawExchange {
  code: string;
  name: string;
  kind: string;
  simClass: string;
  supportsDisplay: boolean;
  supportsVideo: boolean;
  supportsAudio: boolean;
  supportsCtv: boolean;
  supportsDooh: boolean;
  needsSeatId: boolean;
  needsNetworkId: boolean;
  enabledByDefault: boolean;
  auctionType: string;
  weight: number;
  sortOrder: number;
}

/** Floor CPM (INR per 1,000) by the cheapest format a row supports; invented, close to the engine's format floors. */
function floorCpm(r: RawExchange): number {
  if (r.supportsCtv) return 220;
  if (r.supportsAudio) return 90;
  if (r.supportsDooh) return 120;
  if (r.supportsVideo) return 70;
  return 15;
}

export function exchangeId(code: string): string {
  return stableId('exchange', code);
}

function buildExchanges(): ExchangeSeed[] {
  const raw = exchangesJson as RawExchange[];
  const classWeight = new Map<string, number>();
  for (const r of raw) {
    if (r.enabledByDefault)
      classWeight.set(r.simClass, (classWeight.get(r.simClass) ?? 0) + r.weight);
  }
  // Largest enabled row of a class takes the rounding remainder so the class sums to exactly 1.
  const lastEnabled = new Map<string, string>();
  for (const r of raw) if (r.enabledByDefault) lastEnabled.set(r.simClass, r.code);
  const used = new Map<string, number>();
  return raw.map((r) => {
    const total = classWeight.get(r.simClass) ?? r.weight;
    let share: number;
    if (r.enabledByDefault && lastEnabled.get(r.simClass) === r.code) {
      share = Math.round((1 - (used.get(r.simClass) ?? 0)) * 1e6) / 1e6;
    } else {
      share = Math.round((r.weight / total) * 1e6) / 1e6;
      if (r.enabledByDefault) used.set(r.simClass, (used.get(r.simClass) ?? 0) + share);
    }
    return {
      id: exchangeId(r.code),
      code: r.code,
      name: r.name,
      kind: r.kind as ExchangeKindKey,
      simClass: r.simClass as SimClass,
      supportsDisplay: r.supportsDisplay,
      supportsVideo: r.supportsVideo,
      supportsAudio: r.supportsAudio,
      supportsCtv: r.supportsCtv,
      supportsDooh: r.supportsDooh,
      needsSeatId: r.needsSeatId,
      needsNetworkId: r.needsNetworkId,
      enabledByDefault: r.enabledByDefault,
      sortOrder: r.sortOrder,
      auctionType: r.auctionType as AuctionTypeKey,
      simSupplyShare: share.toFixed(6),
      simFloorCpm: floorCpm(r).toFixed(6),
    };
  });
}

export const EXCHANGES: readonly ExchangeSeed[] = buildExchanges();
export const EXCHANGE_BY_CODE: ReadonlyMap<string, ExchangeSeed> = new Map(
  EXCHANGES.map((e) => [e.code, e]),
);

export function exchangeSimClass(code: string): SimClass | undefined {
  return EXCHANGE_BY_CODE.get(code)?.simClass;
}

/** Every real vendor name that the reference data uses; checked against the allow-list by a unit test. */
export function referenceVendorNames(): string[] {
  return [...EXCHANGES.map((e) => e.name), ...THIRD_PARTY_VERIFIERS];
}

export const THIRD_PARTY_VERIFIERS: readonly string[] = VENDOR_ALLOW_LIST.verifiers;

// ---------------------------------------------------------------------------
// Targeting catalogue
// ---------------------------------------------------------------------------

export interface TargetingOptionSeed {
  id: string;
  dimension: string;
  code: string;
  name: string;
  path: string | null;
  parentId: string | null;
  sortOrder: number;
  meta: Record<string, unknown> | null;
}

export function targetingOptionId(dimension: string, code: string): string {
  return stableId('targeting-option', `${dimension}:${code}`);
}

function option(
  dimension: string,
  code: string,
  name: string,
  opts: {
    parentCode?: string;
    path?: string;
    sortOrder?: number;
    meta?: Record<string, unknown>;
  } = {},
): TargetingOptionSeed {
  return {
    id: targetingOptionId(dimension, code),
    dimension,
    code,
    name,
    path: opts.path ?? null,
    parentId: opts.parentCode ? targetingOptionId(dimension, opts.parentCode) : null,
    sortOrder: opts.sortOrder ?? 0,
    meta: opts.meta ?? null,
  };
}

function flat(
  dimension: string,
  pairs: readonly (readonly [string, string])[],
): TargetingOptionSeed[] {
  return pairs.map(([code, name], i) => option(dimension, code, name, { sortOrder: i }));
}

function simple(
  dimension: string,
  names: readonly string[],
  prefix: string,
): TargetingOptionSeed[] {
  return names.map((name, i) => option(dimension, `${prefix}${i + 1}`, name, { sortOrder: i }));
}

function geography(): TargetingOptionSeed[] {
  const out: TargetingOptionSeed[] = [];
  const dim = 'GEOGRAPHY';
  geographyJson.countries.forEach(([code, name], i) =>
    out.push(
      option(dim, code as string, name as string, {
        sortOrder: i,
        meta: { kind: 'COUNTRY', country: code },
      }),
    ),
  );
  const countryName = (c: string) =>
    (geographyJson.countries.find(([k]) => k === c) as string[])[1] as string;
  geographyJson.inStates.forEach(([code, name], i) => {
    const full = `IN-${code}`;
    out.push(
      option(dim, full, name as string, {
        parentCode: 'IN',
        path: `${countryName('IN')} » ${name}`,
        sortOrder: i,
        meta: { kind: 'STATE', country: 'IN', regionCode: full },
      }),
    );
  });
  const cities = geographyJson.inCities as Record<string, string[]>;
  for (const [state, list] of Object.entries(cities)) {
    const stateName = (geographyJson.inStates.find(([k]) => k === state) as string[])[1];
    list.forEach((city, i) =>
      out.push(
        option(dim, `IN-${state}-${city.toLowerCase().replace(/[^a-z]+/g, '-')}`, city, {
          parentCode: `IN-${state}`,
          path: `${countryName('IN')} » ${stateName} » ${city}`,
          sortOrder: i,
          meta: { kind: 'CITY', country: 'IN', regionCode: `IN-${state}` },
        }),
      ),
    );
  }
  geographyJson.sgAreas.forEach((area, i) =>
    out.push(
      option(dim, `SG-${i + 1}`, area, {
        parentCode: 'SG',
        path: `Singapore » ${area}`,
        sortOrder: i,
        meta: { kind: 'REGION', country: 'SG', regionCode: 'SG' },
      }),
    ),
  );
  geographyJson.usDmas.forEach((dma, i) =>
    out.push(
      option(dim, `US-DMA-${i + 1}`, dma, {
        parentCode: 'US',
        path: `United States » ${dma}`,
        sortOrder: i,
        meta: { kind: 'DMA', country: 'US', regionCode: 'US' },
      }),
    ),
  );
  return out;
}

function categories(): TargetingOptionSeed[] {
  const out: TargetingOptionSeed[] = [];
  const tree = categoriesJson.tree as Record<string, Record<string, string[]>>;
  let top = 0;
  for (const [name, children] of Object.entries(tree)) {
    top++;
    const topCode = `C${top}`;
    out.push(option('CATEGORY', topCode, name, { sortOrder: top, path: name }));
    let child = 0;
    for (const [childName, grand] of Object.entries(children)) {
      child++;
      const childCode = `${topCode}.${child}`;
      out.push(
        option('CATEGORY', childCode, childName, {
          parentCode: topCode,
          sortOrder: child,
          path: `${name} » ${childName}`,
        }),
      );
      grand.forEach((g, i) =>
        out.push(
          option('CATEGORY', `${childCode}.${i + 1}`, g, {
            parentCode: childCode,
            sortOrder: i,
            path: `${name} » ${childName} » ${g}`,
          }),
        ),
      );
    }
  }
  return out;
}

function technology(): TargetingOptionSeed[] {
  const out: TargetingOptionSeed[] = [];
  out.push(...flat('DEVICE_TYPE', technologyJson.deviceTypes as [string, string][]));
  out.push(...flat('ENVIRONMENT', technologyJson.environments as [string, string][]));
  out.push(...simple('OPERATING_SYSTEM', technologyJson.operatingSystems, 'OS'));
  let family = 0;
  for (const [name, versions] of Object.entries(
    technologyJson.browsers as Record<string, string[]>,
  )) {
    family++;
    const code = `B${family}`;
    out.push(option('BROWSER', code, name, { sortOrder: family }));
    versions.forEach((v, i) =>
      out.push(
        option('BROWSER', `${code}.${i + 1}`, v, {
          parentCode: code,
          sortOrder: i,
          path: `${name} » ${v}`,
        }),
      ),
    );
  }
  let make = 0;
  for (const [name, models] of Object.entries(
    technologyJson.deviceMakes as Record<string, string[]>,
  )) {
    make++;
    const code = `M${make}`;
    out.push(option('DEVICE_MAKE_MODEL', code, name, { sortOrder: make }));
    models.forEach((m, i) =>
      out.push(
        option('DEVICE_MAKE_MODEL', `${code}.${i + 1}`, m, {
          parentCode: code,
          sortOrder: i,
          path: `${name} » ${m}`,
        }),
      ),
    );
  }
  out.push(...simple('CONNECTION_SPEED', technologyJson.connectionSpeeds, 'CS'));
  out.push(...simple('CARRIER_ISP', technologyJson.carriers, 'CI'));
  return out;
}

function labelOptions(): TargetingOptionSeed[] {
  const out: TargetingOptionSeed[] = [];
  out.push(...flat('GENDER', labelsJson.genders as [string, string][]));
  out.push(...flat('AGE', labelsJson.ages as [string, string][]));
  out.push(...flat('PARENTAL_STATUS', labelsJson.parentalStatus as [string, string][]));
  out.push(...flat('HOUSEHOLD_INCOME', labelsJson.householdIncome as [string, string][]));
  out.push(...simple('VIEWABILITY', labelsJson.viewability, 'V'));
  out.push(...flat('DIGITAL_CONTENT_LABEL', labelsJson.digitalContentLabels as [string, string][]));
  out.push(...simple('SENSITIVE_CATEGORY', labelsJson.sensitiveCategories, 'S'));
  out.push(...simple('CONTENT_GENRE', labelsJson.contentGenres, 'G'));
  out.push(...simple('DOOH_VENUE', labelsJson.doohVenues, 'D'));
  out.push(...simple('POSITION_ON_SCREEN', labelsJson.positionOnScreen, 'P'));
  out.push(...simple('POSITION_IN_CONTENT', labelsJson.positionInContent, 'Q'));
  out.push(...simple('THIRD_PARTY_VERIFIER', THIRD_PARTY_VERIFIERS, 'TV'));
  out.push(
    ...EXCHANGES.map((e, i) =>
      option('INVENTORY_SOURCE', e.code, e.name, {
        sortOrder: i,
        meta: { exchangeId: e.id, kind: 'EXCHANGE' },
      }),
    ),
  );
  return out;
}

export const TARGETING_OPTIONS: readonly TargetingOptionSeed[] = [
  ...geography(),
  ...flat('LANGUAGE', languagesJson as [string, string][]),
  ...categories(),
  ...technology(),
  ...labelOptions(),
];

export function targetingOption(dimension: string, code: string): TargetingOptionSeed {
  const found = TARGETING_OPTIONS.find((o) => o.dimension === dimension && o.code === code);
  if (!found) throw new Error(`Unknown targeting option ${dimension}:${code}`);
  return found;
}

// ---------------------------------------------------------------------------
// Other catalogues
// ---------------------------------------------------------------------------

export interface GoogleAudienceSeed {
  id: string;
  kind: string;
  path: string[];
  name: string;
}
/** Subset of 60 rows (task). Loaded into the database once `GoogleAudience` has a model (P3-05c). */
export const GOOGLE_AUDIENCES: readonly GoogleAudienceSeed[] = googleAudiencesJson;

export interface AppSeed {
  id: string;
  name: string;
  platform: 'IOS' | 'ANDROID';
  category: string;
}
export const APPS: readonly AppSeed[] = appsJson as AppSeed[];

export const FX_PER_USD: Readonly<Record<string, number>> = fxJson.perUSD;
