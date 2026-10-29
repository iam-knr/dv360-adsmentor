// Location list entry resolution (module 15 4.1 "Resolution rules [SIM]", LOC-003..005). Pure: the caller passes
// the DMA/region options it loaded from `TargetingOption`.
import type { LocationListType } from '@prisma/client';
import { RESOURCE_LIMITS } from './limits';

export interface GeoOptionRef {
  id: string;
  code: string;
  name: string;
  kind: string | null;
}

export interface ResolvedEntry {
  value: string;
  resolvedOptionId: string | null;
  resolvedLabel: string;
  lat: number | null;
  lng: number | null;
  radiusKm: number | null;
}

export interface UnresolvedLine {
  line: number;
  text: string;
  reason: string;
}

export interface LocationResolution {
  resolved: ResolvedEntry[];
  unresolved: UnresolvedLine[];
  duplicates: number;
}

/** Latitude / longitude boxes of the countries the sim ships. Unknown country: India. */
const BOXES: Record<string, { lat: [number, number]; lng: [number, number] }> = {
  IN: { lat: [8.4, 34.5], lng: [68.5, 96.5] },
  US: { lat: [25.5, 48.9], lng: [-123.5, -67.5] },
  SG: { lat: [1.22, 1.46], lng: [103.62, 103.98] },
};

function fnv(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Deterministic stand-in for geocoding: the same address always lands on the same point `[SIM]`. */
export function geocode(address: string, country = 'IN'): { lat: number; lng: number } {
  const box = BOXES[country] ?? BOXES.IN!;
  const a = fnv(`lat:${address.toLowerCase()}`) / 0xffffffff;
  const b = fnv(`lng:${address.toLowerCase()}`) / 0xffffffff;
  const round = (n: number) => Math.round(n * 1e6) / 1e6;
  return {
    lat: round(box.lat[0] + a * (box.lat[1] - box.lat[0])),
    lng: round(box.lng[0] + b * (box.lng[1] - box.lng[0])),
  };
}

const POSTAL = /^[A-Za-z0-9][A-Za-z0-9 -]{2,9}$/;
const LAT_LNG = /^(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/;

function postalCountry(code: string): string {
  const digits = code.replace(/\D/g, '');
  if (/^\d{5}(-\d{4})?$/.test(code)) return 'US';
  if (/^\d{6}$/.test(digits) && digits === code) return code.startsWith('0') ? 'SG' : 'IN';
  return 'IN';
}

function splitRadius(text: string): { body: string; radius: number | null; bad: boolean } {
  const idx = text.lastIndexOf(';');
  if (idx < 0) return { body: text.trim(), radius: null, bad: false };
  const raw = text.slice(idx + 1).trim();
  const radius = Number(raw);
  const bad =
    raw === '' ||
    !Number.isFinite(radius) ||
    radius < RESOURCE_LIMITS.RADIUS_MIN_KM ||
    radius > RESOURCE_LIMITS.RADIUS_MAX_KM;
  return { body: text.slice(0, idx).trim(), radius: bad ? null : radius, bad };
}

function resolveRegional(text: string, options: readonly GeoOptionRef[]): ResolvedEntry | string {
  const lower = text.toLowerCase();
  const byName = options.find(
    (o) =>
      o.kind === 'DMA' &&
      (o.code.toLowerCase() === lower ||
        o.name.toLowerCase() === lower ||
        o.name.toLowerCase().replace(/\s*\(.*\)$/, '') === lower),
  );
  if (byName)
    return {
      value: text,
      resolvedOptionId: byName.id,
      resolvedLabel: `${byName.name} (DMA region)`,
      lat: null,
      lng: null,
      radiusKm: null,
    };
  if (POSTAL.test(text) && /\d/.test(text)) {
    const country = postalCountry(text);
    const parent = options.find((o) => o.kind === 'COUNTRY' && o.code === country) ?? null;
    return {
      value: text,
      resolvedOptionId: parent?.id ?? null,
      resolvedLabel: `${text} (postal code, ${parent?.name ?? country})`,
      lat: null,
      lng: null,
      radiusKm: null,
    };
  }
  return "isn't a valid postal code or DMA region";
}

function resolveProximity(text: string, country: string): ResolvedEntry | string {
  const { body, radius, bad } = splitRadius(text);
  if (bad)
    return `radius must be ${RESOURCE_LIMITS.RADIUS_MIN_KM} to ${RESOURCE_LIMITS.RADIUS_MAX_KM} km`;
  const radiusKm = radius ?? RESOURCE_LIMITS.RADIUS_DEFAULT_KM;
  const pair = LAT_LNG.exec(body);
  if (pair) {
    const lat = Number(pair[1]);
    const lng = Number(pair[2]);
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180)
      return "isn't a valid latitude and longitude pair";
    return {
      value: text,
      resolvedOptionId: null,
      resolvedLabel: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      lat,
      lng,
      radiusKm,
    };
  }
  const parts = body
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return "isn't a valid street address or latitude and longitude pair";
  const point = geocode(body, country);
  return { value: text, resolvedOptionId: null, resolvedLabel: body, ...point, radiusKm };
}

/** Resolve the textarea lines of a location list. Blank lines are skipped; numbering counts them. */
export function resolveLocationEntries(
  type: LocationListType,
  text: string,
  options: readonly GeoOptionRef[],
  country = 'IN',
): LocationResolution {
  const resolved: ResolvedEntry[] = [];
  const unresolved: UnresolvedLine[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const key = line.toLowerCase();
    if (seen.has(key)) {
      duplicates += 1;
      return;
    }
    seen.add(key);
    const out =
      type === 'REGIONAL' ? resolveRegional(line, options) : resolveProximity(line, country);
    if (typeof out === 'string') unresolved.push({ line: i + 1, text: line, reason: out });
    else resolved.push(out);
  });
  return { resolved, unresolved, duplicates };
}

export function countLocationLines(text: string): number {
  return text.split(/\r?\n/).filter((l) => l.trim() !== '').length;
}
