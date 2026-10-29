// Pure helpers of the Apps & URLs editor: bulk line parser (TGT-020, TGT-023), composite list CSV, catalogue and
// URL suggestions. No React, so the unit tests import it directly.
import appsJson from '../../../../data/reference/apps.json';
import type { Sel, TargetingCriteria } from '@/lib/targeting/types';

type AppsUrls = NonNullable<TargetingCriteria['appsAndUrls']>;

export const APPS_URLS_MESSAGES = {
  TGT_020: 'Enter a valid URL or app ID.',
  TGT_021: "An item can't be both included and excluded.",
  TGT_023: "{n} entries couldn't be added.",
} as const;

const URL_RE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i;
const APP_RE = /^([A-Za-z][\w]*(\.[A-Za-z_][\w]*)+|\d{5,}|id\d{5,})$/;

/** `com.example.app` reads as a package name, not a host: reverse-DNS prefix and two dots or more. */
const REVERSE_DNS = /^(com|org|net|io|app|co|in)\.[A-Za-z_]\w*\.[A-Za-z_][\w.]*$/;

export interface BulkLine {
  line: number;
  text: string;
}
export interface BulkResult {
  urls: string[];
  apps: string[];
  rejected: BulkLine[];
}

/** One entry per line or comma. URLs are lower-cased without a trailing slash; duplicates are dropped. */
export function parseBulk(text: string): BulkResult {
  const urls = new Set<string>();
  const apps = new Set<string>();
  const rejected: BulkLine[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    for (const part of raw.split(',')) {
      const t = part.trim();
      if (!t) continue;
      if (REVERSE_DNS.test(t) || (!URL_RE.test(t) && APP_RE.test(t))) apps.add(t);
      else if (URL_RE.test(t)) urls.add(t.replace(/\/+$/, '').toLowerCase());
      else rejected.push({ line: i + 1, text: t });
    }
  });
  return { urls: [...urls], apps: [...apps], rejected };
}

export interface AppRow {
  code: string;
  label: string;
  platform: string;
  category: string;
}

export const APP_CATALOGUE: readonly AppRow[] = (
  appsJson as { id: string; name: string; platform: string; category: string }[]
).map((a) => ({ code: a.id, label: a.name, platform: a.platform, category: a.category }));

/** Collections are dynamic groups of related apps: one per app category (Δ-10-6). */
export const COLLECTIONS: readonly { code: string; label: string }[] = [
  ...new Set(APP_CATALOGUE.map((a) => a.category)),
]
  .sort()
  .map((c) => ({
    code: `COLLECTION_${c.toUpperCase().replace(/[^A-Z]+/g, '_')}`,
    label: `${c} apps`,
  }));

export function appName(code: string): string {
  return APP_CATALOGUE.find((a) => a.code === code)?.label ?? code;
}

const csvCell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** "Download composite list": every selected channel, collection, URL and app as Type,Value,Name,Mode rows. */
export function compositeListCsv(a: AppsUrls): string {
  const rows: string[][] = [['Type', 'Value', 'Name', 'Mode']];
  const add = (type: string, sels: Sel[], name: (s: Sel) => string) => {
    for (const s of sels)
      rows.push([type, s.id, name(s), s.mode === 'INCLUDE' ? 'Include' : 'Exclude']);
  };
  add('Channel', a.channelIds, (s) => s.label ?? s.id);
  add(
    'Collection',
    a.collections,
    (s) => s.label ?? COLLECTIONS.find((c) => c.code === s.id)?.label ?? s.id,
  );
  add('URL', a.urls, (s) => s.label ?? s.id);
  add('App', a.apps, (s) => s.label ?? appName(s.id));
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** Rows with the same id in both modes (TGT-021); the editor keeps one mode per id, so this is a guard for saved state. */
export function bothModes(a: AppsUrls): boolean {
  return (['channelIds', 'collections', 'urls', 'apps'] as const).some((k) => {
    const inc = new Set(a[k].filter((s) => s.mode === 'INCLUDE').map((s) => s.id));
    return a[k].some((s) => s.mode === 'EXCLUDE' && inc.has(s.id));
  });
}

export function countSelected(a: AppsUrls): number {
  return a.channelIds.length + a.collections.length + a.urls.length + a.apps.length;
}

/** Deterministic suggestions from the campaign's landing pages and keywords (the URL suggestions card). */
export function urlSuggestions(
  landingUrls: readonly string[],
  keywords: readonly string[],
): string[] {
  const out = new Set<string>();
  for (const u of landingUrls) {
    const host = u
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      ?.replace(/^www\./i, '');
    if (!host) continue;
    out.add(`news.${host}`);
    out.add(`reviews.${host}`);
  }
  for (const k of keywords) {
    const slug = k
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (slug) out.add(`${slug}.example.com`);
  }
  return [...out].slice(0, 12);
}
