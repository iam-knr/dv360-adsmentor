// Synthetic TV catalogue for Cross-media reach (module 04 DELTA-04-6, DELTA-04-7, Q4). Generated, deterministic and
// the same in every sandbox: 13 countries x 6 companies x 3 campaigns, and 4 sub-locations per country.
import { CROSS_MEDIA_COUNTRIES, type PlanCountryDef } from './countries';
import { fnv1a } from './hash';

export const TV_VENDOR = 'Adsmetor Panel (synthetic)';

export interface TvCampaignDef {
  id: string;
  countryCode: string;
  company: string;
  brand: string;
  campaign: string;
  startDate: string;
  endDate: string;
  spend: number;
  grps: number;
  /** Percent of the population reached nationally. */
  reachPct: number;
  avgFrequency: number;
  impressions: number;
}

const COMPANIES: [string, string][] = [
  ['Northwind Foods', 'Harvest Crunch'],
  ['Lumen Mobile', 'Lumen Go'],
  ['Atlas Motors', 'Atlas Terra'],
  ['Bluebell Retail', 'Bluebell Home'],
  ['Crestline Bank', 'Crest Everyday'],
  ['Orbit Travel', 'Orbit Escapes'],
];
const BURSTS = ['Spring burst', 'Summer always-on', 'Festive push'];
const SUB_NAMES = ['North', 'South', 'East', 'West'];
const SUB_SHARES = [0.31, 0.27, 0.24, 0.18];

/** Seed period of the catalogue: sandboxes start in early 2026, so the windows cover Jan 2025 to the end of 2026. */
export const TV_WINDOW = { from: '2025-01-01', to: '2026-12-31', nextUpdate: '2027-01-15' } as const;
/** First day with sub-location data (PLN-013). */
export const SUB_LOCATION_FROM = '2025-01-01';

function build(country: PlanCountryDef): TvCampaignDef[] {
  const out: TvCampaignDef[] = [];
  COMPANIES.forEach(([company, brand], ci) => {
    BURSTS.forEach((burst, bi) => {
      const h = fnv1a(`${country.code}|${company}|${burst}`);
      const reachPct = 22 + (h % 3300) / 100; // 22 .. 55
      const avgFrequency = 2.2 + ((h >>> 8) % 400) / 100; // 2.2 .. 6.2
      const grps = Math.round(reachPct * avgFrequency);
      const month = 1 + ((ci * 3 + bi * 4) % 10);
      const start = `2026-${String(month).padStart(2, '0')}-01`;
      const end = `2026-${String(month + 1).padStart(2, '0')}-28`;
      out.push({
        id: `tv-${country.code}-${ci}${bi}`,
        countryCode: country.code,
        company,
        brand,
        campaign: `${brand} - ${burst}`,
        startDate: start,
        endDate: end,
        spend: Math.round(((grps * country.tv) / 100 / 1000) * country.tvCpmUsd) * 10,
        grps,
        reachPct: Math.round(reachPct * 10) / 10,
        avgFrequency: Math.round(avgFrequency * 100) / 100,
        impressions: Math.round((grps / 100) * country.tv),
      });
    });
  });
  return out;
}

const CACHE = new Map<string, TvCampaignDef[]>();

export function tvCampaigns(countryCode: string): TvCampaignDef[] {
  let v = CACHE.get(countryCode);
  if (!v) {
    const c = CROSS_MEDIA_COUNTRIES.find((x) => x.code === countryCode);
    v = c ? build(c) : [];
    CACHE.set(countryCode, v);
  }
  return v;
}

export function tvCampaignById(id: string): TvCampaignDef | undefined {
  const code = id.split('-')[1];
  return code ? tvCampaigns(code).find((c) => c.id === id) : undefined;
}

export interface SubLocationDef {
  code: string;
  name: string;
  populationShare: number;
}

export function subLocations(countryCode: string): SubLocationDef[] {
  return SUB_NAMES.map((n, i) => ({
    code: `${countryCode}-${n.slice(0, 1)}`,
    name: `${n} region`,
    populationShare: SUB_SHARES[i] as number,
  }));
}
