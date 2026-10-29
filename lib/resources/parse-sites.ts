// Channel sites parser (module 15 4.1 `parseSites`, CH-003, CH-007). Pure: no database. App names come from the
// optional `lookupName` callback, which the service backs with `AppCatalog`.
import type { ChannelEntryKind } from '@prisma/client';

export interface ChannelEntryDraft {
  kind: ChannelEntryKind;
  value: string;
  displayName: string | null;
}

export interface ParsedSites {
  entries: ChannelEntryDraft[];
  /** 1-based line numbers count blank lines too, so they match the textarea. */
  invalidLines: { line: number; text: string }[];
  /** Entries removed because they repeat an earlier line (CH-007). */
  duplicates: number;
}

export interface ParseStats {
  urls: number;
  apps: number;
  duplicates: number;
  invalid: number;
}

/** Reverse-DNS roots that mark a dotted token as an Android package, not a host name `[SIM]`. */
const PACKAGE_ROOTS = new Set([
  'com',
  'org',
  'net',
  'io',
  'in',
  'co',
  'de',
  'uk',
  'app',
  'me',
  'tv',
  'fr',
  'jp',
  'sg',
  'us',
  'au',
  'br',
  'ca',
]);

const DISPLAY_FORM = /^(.+?)\s+-\s+(Android|iOS|CTV)\s+\(([^()]+)\)$/;
const ANDROID_PACKAGE = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+){2,}$/i;
const IOS_ID = /^(?:id)?(\d{6,12})$/i;
const HOST = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;

const KIND_OF_LABEL: Record<string, ChannelEntryKind> = {
  Android: 'ANDROID_APP',
  iOS: 'IOS_APP',
  CTV: 'CTV_APP',
};

function isAndroidPackage(token: string): boolean {
  if (!ANDROID_PACKAGE.test(token)) return false;
  return PACKAGE_ROOTS.has(token.split('.')[0]!.toLowerCase());
}

/** Scheme optional, host with a dot, no spaces. Returns the stored value or null. */
export function normaliseUrl(raw: string): string | null {
  if (/\s/.test(raw)) return null;
  const stripped = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const [hostPart = '', ...rest] = stripped.split('/');
  const host = hostPart.toLowerCase();
  if (!HOST.test(host)) return null;
  const path = rest.join('/').replace(/\/+$/, '');
  return path ? `${host}/${path}` : host;
}

function classify(
  token: string,
  lookupName: ((kind: ChannelEntryKind, value: string) => string | null) | undefined,
): ChannelEntryDraft | null {
  const shown = DISPLAY_FORM.exec(token);
  if (shown) {
    const kind = KIND_OF_LABEL[shown[2]!]!;
    const id = shown[3]!.trim();
    if (kind === 'ANDROID_APP' && !isAndroidPackage(id)) return null;
    if (kind === 'IOS_APP') {
      const m = IOS_ID.exec(id);
      return m ? { kind, value: m[1]!, displayName: shown[1]!.trim() } : null;
    }
    return id ? { kind, value: id, displayName: shown[1]!.trim() } : null;
  }
  const ios = IOS_ID.exec(token);
  if (ios) {
    const value = ios[1]!;
    return { kind: 'IOS_APP', value, displayName: lookupName?.('IOS_APP', value) ?? null };
  }
  if (isAndroidPackage(token)) {
    return {
      kind: 'ANDROID_APP',
      value: token,
      displayName: lookupName?.('ANDROID_APP', token) ?? null,
    };
  }
  const url = normaliseUrl(token);
  return url ? { kind: 'URL', value: url, displayName: null } : null;
}

/** Parse the textarea of the channel editor, one site per line. */
export function parseSites(
  text: string,
  lookupName?: (kind: ChannelEntryKind, value: string) => string | null,
): ParsedSites {
  const entries: ChannelEntryDraft[] = [];
  const invalidLines: { line: number; text: string }[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  text.split(/\r?\n/).forEach((raw, i) => {
    const token = raw.trim();
    if (!token) return;
    const entry = classify(token, lookupName);
    if (!entry) {
      invalidLines.push({ line: i + 1, text: token });
      return;
    }
    const key = `${entry.kind}:${entry.value.toLowerCase()}`;
    if (seen.has(key)) {
      duplicates += 1;
      return;
    }
    seen.add(key);
    entries.push(entry);
  });
  return { entries, invalidLines, duplicates };
}

export function statsOf(parsed: ParsedSites): ParseStats {
  const urls = parsed.entries.filter((e) => e.kind === 'URL').length;
  return {
    urls,
    apps: parsed.entries.length - urls,
    duplicates: parsed.duplicates,
    invalid: parsed.invalidLines.length,
  };
}

/** Non-blank lines of the textarea, the number the `n / 10000` counter shows. */
export function countSiteLines(text: string): number {
  return text.split(/\r?\n/).filter((l) => l.trim() !== '').length;
}

/** Text form of stored entries, the inverse of `parseSites` for the editor. */
export function formatSites(
  entries: { kind: ChannelEntryKind; value: string; displayName: string | null }[],
): string {
  return entries
    .map((e) => {
      if (e.kind === 'URL') return e.value;
      const label = e.kind === 'ANDROID_APP' ? 'Android' : e.kind === 'IOS_APP' ? 'iOS' : 'CTV';
      return e.displayName ? `${e.displayName} - ${label} (${e.value})` : e.value;
    })
    .join('\n');
}
