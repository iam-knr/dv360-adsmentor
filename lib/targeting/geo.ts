// Geography helpers for the editor (module 10 2.4): region catalogue search, bulk point-of-interest parser,
// radius range, map cells. Pure; the catalogue reads data/reference/geography.json, the same file the seed uses,
// so codes match TargetingOption.code (`IN-MH`, `IN-MH-mumbai`).
import geographyJson from '../../data/reference/geography.json';
import type { OptionDef } from './options';
import type { RadiusPoint, Sel } from './types';

export const GEO_MESSAGES = {
  NO_LOCATION: 'Select at least one location.',
  BAD_POINT: 'Enter a street address or a latitude and longitude pair on each line.',
  BAD_RADIUS: 'Enter a distance between 1 and 500 km.',
} as const;

export type GeoKind = 'Country' | 'State' | 'City' | 'Region' | 'DMA' | 'Airport' | 'University';

export interface GeoOption extends OptionDef {
  kind: GeoKind;
  /** Parent code, for the hierarchy rule TGT-013. */
  parent?: string;
  path: string;
}

const cities = geographyJson.inCities as Record<string, string[]>;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, '-');

/** Airports and universities of the sample catalogue (module 10 3.4), attached to Indian cities. */
const EXTRA: [GeoKind, string, string, string][] = [
  ['Airport', 'IN-MH-mumbai', 'Chhatrapati Shivaji Maharaj International Airport', 'airport-bom'],
  ['Airport', 'IN-DL-new-delhi', 'Indira Gandhi International Airport', 'airport-del'],
  ['Airport', 'IN-KA-bengaluru', 'Kempegowda International Airport', 'airport-blr'],
  ['Airport', 'IN-TN-chennai', 'Chennai International Airport', 'airport-maa'],
  ['Airport', 'IN-WB-kolkata', 'Netaji Subhas Chandra Bose International Airport', 'airport-ccu'],
  ['Airport', 'IN-TG-hyderabad', 'Rajiv Gandhi International Airport', 'airport-hyd'],
  ['University', 'IN-MH-pune', 'Savitribai Phule Pune University', 'university-sppu'],
  ['University', 'IN-DL-new-delhi', 'Jawaharlal Nehru University', 'university-jnu'],
  ['University', 'IN-KA-bengaluru', 'Indian Institute of Science', 'university-iisc'],
  ['University', 'IN-TN-chennai', 'Indian Institute of Technology Madras', 'university-iitm'],
];

function build(): GeoOption[] {
  const out: GeoOption[] = [];
  const countryName = (c: string) =>
    (geographyJson.countries.find(([k]) => k === c) as string[])[1] as string;
  for (const [code, name] of geographyJson.countries as [string, string][])
    out.push({ code, label: name, kind: 'Country', path: name });
  const stateName = new Map<string, string>();
  for (const [code, name] of geographyJson.inStates as [string, string][]) {
    stateName.set(code, name);
    out.push({
      code: `IN-${code}`,
      label: name,
      kind: 'State',
      parent: 'IN',
      path: `${countryName('IN')} » ${name}`,
    });
  }
  const cityOf = new Map<string, GeoOption>();
  for (const [state, list] of Object.entries(cities))
    for (const city of list) {
      const o: GeoOption = {
        code: `IN-${state}-${slug(city)}`,
        label: city,
        kind: 'City',
        parent: `IN-${state}`,
        path: `${countryName('IN')} » ${stateName.get(state) ?? state} » ${city}`,
      };
      cityOf.set(o.code, o);
      out.push(o);
    }
  geographyJson.sgAreas.forEach((area, i) =>
    out.push({
      code: `SG-${i + 1}`,
      label: area,
      kind: 'Region',
      parent: 'SG',
      path: `Singapore » ${area}`,
    }),
  );
  geographyJson.usDmas.forEach((dma) =>
    out.push({
      code: `US-DMA-${slug(dma)}`,
      label: dma,
      kind: 'DMA',
      parent: 'US',
      path: `United States » ${dma}`,
    }),
  );
  for (const [kind, parent, label, key] of EXTRA) {
    const city = cityOf.get(parent);
    if (!city) continue;
    out.push({ code: `${parent}-${key}`, label, kind, parent, path: `${city.path} » ${label}` });
  }
  return out;
}

export const GEO_OPTIONS: readonly GeoOption[] = build();
const BY_CODE = new Map(GEO_OPTIONS.map((o) => [o.code, o]));

export function geoOption(code: string): GeoOption | undefined {
  return BY_CODE.get(code);
}

/** "Mumbai, Maharashtra, India (City)": the search result row of the editor. */
export function geoRowLabel(o: GeoOption): string {
  const parts = o.path.split(' » ').reverse();
  return `${parts.join(', ')} (${o.kind})`;
}

/** Region search: all words must appear in the path (case-insensitive). At most `limit` rows. */
export function searchRegions(query: string, limit = 50): GeoOption[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return GEO_OPTIONS.slice(0, limit);
  return GEO_OPTIONS.filter((o) => {
    const hay = `${o.label} ${o.path}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  }).slice(0, limit);
}

// ---- bulk points of interest (G2, TGT-011) ----------------------------------------------------------------------

export interface ParsedPoint {
  lat: number;
  lng: number;
  label: string;
  source: 'LATLNG' | 'ADDRESS';
  line: number;
}
export interface PointError {
  line: number;
  text: string;
  ruleId: 'TGT-011';
  message: string;
}
export interface ParsePointsResult {
  points: ParsedPoint[];
  errors: PointError[];
}

const NUM = String.raw`[-+]?\d{1,3}(?:\.\d+)?`;
const LATLNG = new RegExp(String.raw`^\(?\s*(${NUM})\s*[,;\s]\s*(${NUM})\s*\)?$`);

/** Bounding box [south, west, north, east] of the cities the gazetteer knows. */
const CITY_BOX: Record<string, [number, number, number, number]> = {
  mumbai: [18.89, 72.78, 19.27, 72.99],
  'new delhi': [28.5, 77.1, 28.7, 77.3],
  delhi: [28.4, 76.84, 28.88, 77.35],
  bengaluru: [12.85, 77.46, 13.14, 77.75],
  bangalore: [12.85, 77.46, 13.14, 77.75],
  chennai: [12.9, 80.12, 13.2, 80.31],
  kolkata: [22.45, 88.25, 22.65, 88.45],
  hyderabad: [17.3, 78.35, 17.55, 78.6],
  pune: [18.45, 73.75, 18.62, 73.95],
  singapore: [1.23, 103.62, 1.47, 104.0],
};

/** Deterministic unit value in [0, 1) from text and a salt (FNV-1a). */
function unit(text: string, salt: string): number {
  let h = 2166136261;
  for (const ch of `${salt}|${text}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}

/** Synthetic gazetteer: needs a known city token in the address; coordinate is a hash inside the city box. */
function geocode(text: string): { lat: number; lng: number } | null {
  const lower = text.toLowerCase();
  const city = Object.keys(CITY_BOX).find((c) => lower.includes(c));
  if (!city || !/[a-z]/i.test(text) || text.trim().length < 5) return null;
  const [s, w, n, e] = CITY_BOX[city]!;
  const lat = s + (n - s) * unit(lower, 'lat');
  const lng = w + (e - w) * unit(lower, 'lng');
  return { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 };
}

/** One line per point: `lat,lng` or a street address. Valid lines are returned even when others fail. */
export function parsePoints(text: string): ParsePointsResult {
  const points: ParsedPoint[] = [];
  const errors: PointError[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const t = raw.trim();
    if (!t) return;
    const line = i + 1;
    const m = LATLNG.exec(t);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        points.push({ lat, lng, label: `${lat}, ${lng}`, source: 'LATLNG', line });
        return;
      }
    } else {
      const g = geocode(t);
      if (g) {
        points.push({ ...g, label: t, source: 'ADDRESS', line });
        return;
      }
    }
    errors.push({ line, text: t, ruleId: 'TGT-011', message: GEO_MESSAGES.BAD_POINT });
  });
  return { points, errors };
}

// ---- radius (TGT-012) -------------------------------------------------------------------------------------------

export type DistanceUnit = 'KM' | 'MI';
const KM_PER_MI = 1.609344;

export function toKm(value: number, unit: DistanceUnit): number {
  return unit === 'MI' ? value * KM_PER_MI : value;
}
export function fromKm(km: number, unit: DistanceUnit): number {
  return unit === 'MI' ? km / KM_PER_MI : km;
}
/** 1 to 500 in the chosen unit (the same numbers for km and miles, validation.md TGT-012). */
export function radiusError(value: number): string | null {
  return Number.isFinite(value) && value >= 1 && value <= 500 ? null : GEO_MESSAGES.BAD_RADIUS;
}

export function toRadiusPoint(p: ParsedPoint, value: number, unit: DistanceUnit): RadiusPoint {
  return { lat: p.lat, lng: p.lng, radiusKm: toKm(value, unit), label: p.label };
}

/** Radius targets that fall outside the allowed range after unit conversion, by index. */
export function badRadii(points: RadiusPoint[]): number[] {
  return points.flatMap((p, i) => (p.radiusKm >= 1 && p.radiusKm <= 500 + 1e-9 ? [] : [i]));
}

// ---- map (static SVG, DS Q19) -----------------------------------------------------------------------------------

/** Tile cartogram of the Indian states: [column, row] on a grid, north at the top. */
const STATE_TILE: Record<string, [number, number]> = {
  JK: [3, 0],
  LA: [4, 0],
  PB: [3, 1],
  HP: [4, 1],
  UT: [5, 1],
  CH: [3, 2],
  DL: [4, 2],
  HR: [3, 3],
  RJ: [2, 3],
  UP: [5, 3],
  BR: [7, 3],
  SK: [8, 2],
  AR: [10, 2],
  AS: [9, 3],
  NL: [10, 3],
  ML: [9, 4],
  MN: [10, 4],
  MZ: [10, 5],
  TR: [9, 5],
  GJ: [1, 4],
  MP: [4, 4],
  CG: [6, 5],
  JH: [7, 4],
  WB: [8, 5],
  OR: [7, 6],
  MH: [3, 6],
  GA: [2, 7],
  TG: [5, 7],
  AP: [6, 8],
  KA: [4, 8],
  KL: [4, 10],
  TN: [5, 10],
};
export const MAP_TILE = 28;
export const MAP_COLS = 11;
export const MAP_ROWS = 11;

export interface MapCell {
  code: string;
  x: number;
  y: number;
  label: string;
}

/** Cell per Indian state (and union territory in the sample). */
export const MAP_CELLS: MapCell[] = Object.entries(STATE_TILE)
  .map(([st, [c, r]]) => ({
    code: `IN-${st}`,
    x: c * MAP_TILE,
    y: r * MAP_TILE,
    label: (geographyJson.inStates as [string, string][]).find(([k]) => k === st)?.[1] ?? st,
  }))
  .filter((c) => GEO_OPTIONS.some((o) => o.code === c.code));

export type MapShade = 'INCLUDE' | 'EXCLUDE' | 'NONE';

/** A cell is shaded when its code, one of its ancestors (the country) or a city inside it is selected. */
export function mapShade(code: string, regions: readonly Sel[]): MapShade {
  const hit = (s: Sel) => s.id === code || s.id.startsWith(`${code}-`) || s.id === 'IN';
  const mine = regions.filter(hit);
  if (mine.some((s) => s.mode === 'EXCLUDE' && (s.id === code || s.id === 'IN'))) return 'EXCLUDE';
  if (mine.some((s) => s.mode === 'INCLUDE')) return 'INCLUDE';
  return 'NONE';
}

/** Selected cell codes of the "Fit targeted locations" view box: [x, y, w, h]. */
export function fitViewBox(regions: readonly Sel[]): [number, number, number, number] {
  const hit = MAP_CELLS.filter((c) => mapShade(c.code, regions) === 'INCLUDE');
  if (hit.length === 0) return [0, 0, MAP_COLS * MAP_TILE, MAP_ROWS * MAP_TILE];
  const x0 = Math.min(...hit.map((c) => c.x)) - MAP_TILE;
  const y0 = Math.min(...hit.map((c) => c.y)) - MAP_TILE;
  const x1 = Math.max(...hit.map((c) => c.x)) + 2 * MAP_TILE;
  const y1 = Math.max(...hit.map((c) => c.y)) + 2 * MAP_TILE;
  return [x0, y0, Math.max(x1 - x0, 3 * MAP_TILE), Math.max(y1 - y0, 3 * MAP_TILE)];
}
