// Audience sizes (module 14 4.3, 5): buckets, availability, and the pure size functions for lookalike, combined,
// custom lists and customer match. Client safe: no server or database imports. Every number is synthetic `[SIM]`.

export const AVAILABILITY_HOURS = 4;
export const MIN_USABLE_USERS = 1000;
/** Display users in the synthetic regional pool. */
export const POOL_USERS = 40_000_000;
/** Overlap between unrelated members of a combined audience (Δ14-13). */
export const COMBINED_OVERLAP = 0.15;
export const LOOKALIKE_CAP_FRACTION = 0.25;
export const LOOKALIKE_REACH_STOPS = [2.5, 5, 7.5, 10] as const;
export const CUSTOMER_MATCH_ROW_CAP = 100_000;
export const MEMBERSHIP_MIN_DAYS = 1;
export const MEMBERSHIP_MAX_DAYS = 540;

export type SizeBucket = '< 1K' | '1K-10K' | '10K-100K' | '100K-1M' | '1M-10M' | '10M+';

/** `< 1K`, `1K-10K`, ... (MX-12). 999 is `< 1K`, 1,000 is `1K-10K`. */
export function bucketOf(n: number | bigint | null | undefined): SizeBucket {
  const v = n === null || n === undefined ? 0 : Number(n);
  if (v < 1_000) return '< 1K';
  if (v < 10_000) return '1K-10K';
  if (v < 100_000) return '10K-100K';
  if (v < 1_000_000) return '100K-1M';
  if (v < 10_000_000) return '1M-10M';
  return '10M+';
}

/** 0 to 1 position of a size on the bar (log scale, 100 to 100M). */
export function barFraction(n: number | bigint | null | undefined): number {
  const v = Number(n ?? 0);
  if (v <= 100) return 0;
  return Math.min(1, Math.log10(v / 100) / 6);
}

export type SizeMap = {
  display: number;
  youtube: number;
  mobileApp: number;
  ctv: number;
};

export const ZERO_SIZES: SizeMap = { display: 0, youtube: 0, mobileApp: 0, ctv: 0 };

/** Per inventory type shares of the Display size for a first-party list `[SIM]`. */
export function spreadSizes(display: number, shares = { youtube: 0.6, mobileApp: 0.5, ctv: 0.2 }): SizeMap {
  const d = Math.max(0, Math.round(display));
  return {
    display: d,
    youtube: Math.round(d * shares.youtube),
    mobileApp: Math.round(d * shares.mobileApp),
    ctv: Math.round(d * shares.ctv),
  };
}

/** Lists under 1,000 users share 0 in the engine (engine 2.3). */
export const isUsable = (display: number | bigint | null | undefined): boolean =>
  Number(display ?? 0) >= MIN_USABLE_USERS;

/** Hours until a list is available, rounded up; 0 when it already is. */
export function hoursUntil(availableAt: Date | null | undefined, now: Date): number {
  if (!availableAt) return 0;
  const ms = availableAt.getTime() - now.getTime();
  return ms > 0 ? Math.ceil(ms / 3_600_000) : 0;
}

export function availabilityFor(
  type: string,
  now: Date,
): { status: 'PROCESSING' | 'ACTIVE'; availableAt: Date } {
  if (type === 'COMBINED') return { status: 'ACTIVE', availableAt: now };
  return { status: 'PROCESSING', availableAt: new Date(now.getTime() + AVAILABILITY_HOURS * 3_600_000) };
}

/** FNV-1a, 32 bit. Local on purpose: lib/seed/prng pulls in node:crypto, and this file runs in the browser too. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Deterministic number in [lo, hi) from a key. */
export function keyed(key: string, lo: number, hi: number): number {
  const h = hashString(key) / 0xffffffff;
  return lo + h * (hi - lo);
}

// ---- lookalike ---------------------------------------------------------------------------------

/** Expansion factor `4 × (reachPct / 5)` (Δ14-13, conflicts C7). */
export const lookalikeExpansion = (reachPct: number): number => 4 * (reachPct / 5);

/** `seedTotal × expansion`, capped at 25% of the regional pool. */
export function lookalikeSize(seedTotal: number, reachPct: number): number {
  const raw = seedTotal * lookalikeExpansion(reachPct);
  return Math.round(Math.min(raw, POOL_USERS * LOOKALIKE_CAP_FRACTION));
}

// ---- combined ----------------------------------------------------------------------------------

/** Union of member sizes with a pairwise overlap: the largest plus the rest discounted. Order independent. */
export function unionSize(sizes: number[]): number {
  if (sizes.length === 0) return 0;
  const sorted = [...sizes].sort((a, b) => b - a);
  const [first = 0, ...rest] = sorted;
  return Math.min(POOL_USERS, first + rest.reduce((s, v) => s + v * (1 - COMBINED_OVERLAP), 0));
}

/** Include groups are AND-ed (conflicts C5), members of a group are OR-ed, Exclude subtracts its union. */
export function combinedSize(include: number[][], exclude: number[]): number {
  const groups = include.filter((g) => g.length > 0).map(unionSize);
  if (groups.length === 0) return 0;
  let base = groups[0]!;
  // An intersection of unrelated groups keeps the overlap share of the smaller one: it narrows, as the builder tip says.
  for (const g of groups.slice(1)) base = Math.min(base, g) * COMBINED_OVERLAP;
  const out = exclude.length ? Math.max(0, base - Math.min(base, unionSize(exclude) * COMBINED_OVERLAP)) : base;
  return Math.round(out);
}

// ---- customer match ----------------------------------------------------------------------------

/** Match rate 38% to 72%, fixed by sandbox, audience and file (Q2). */
export function matchRate(sandboxSeed: string, audienceId: string, fileHash: string): number {
  return keyed(`match:${sandboxSeed}:${audienceId}:${fileHash}`, 0.38, 0.72);
}

const ID_COLUMNS: Record<string, RegExp> = {
  EMAIL: /^(e-?mail|email address|hashed[_ ]?email)$/i,
  PHONE: /^(phone|phone number|mobile|hashed[_ ]?phone)$/i,
  MAIL_ADDRESS: /^(address|mailing address|street|zip|postal code)$/i,
  MOBILE_DEVICE_ID: /^(mobile[_ ]?device[_ ]?id|device[_ ]?id|idfa|aaid|maid)$/i,
};

export interface ParsedMatchFile {
  ok: boolean;
  rows: number;
  identifierColumns: string[];
  /** 'NO_FILE' | 'NOT_CSV' | 'NO_IDENTIFIER' | 'TOO_MANY_ROWS' (AUD-021, AUD-025). */
  error?: 'NO_FILE' | 'NOT_CSV' | 'NO_IDENTIFIER' | 'TOO_MANY_ROWS';
}

/** Header detection: the first line must name at least one identifier column. Counts the non-empty rows after it. */
export function parseCustomerMatchCsv(text: string, fileName = 'upload.csv'): ParsedMatchFile {
  if (!text.trim()) return { ok: false, rows: 0, identifierColumns: [], error: 'NO_FILE' };
  if (!/\.csv$/i.test(fileName)) return { ok: false, rows: 0, identifierColumns: [], error: 'NOT_CSV' };
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  const header = (lines[0] ?? '').split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const found = header.filter((h) => Object.values(ID_COLUMNS).some((re) => re.test(h)));
  if (found.length === 0) return { ok: false, rows: 0, identifierColumns: [], error: 'NO_IDENTIFIER' };
  const rows = lines.length - 1;
  if (rows > CUSTOMER_MATCH_ROW_CAP)
    return { ok: false, rows, identifierColumns: found, error: 'TOO_MANY_ROWS' };
  return { ok: true, rows, identifierColumns: found };
}

export function matchResult(
  rows: number,
  rate: number,
): { rows: number; matched: number; matchRatePct: number } {
  const matched = Math.floor(rows * rate);
  return { rows, matched, matchRatePct: rows > 0 ? Math.round((matched / rows) * 1000) / 10 : 0 };
}

export const CSV_TEMPLATES: Record<string, string> = {
  EMAIL: 'email\nstudent1@example.com\nstudent2@example.com\n',
  PHONE: 'phone\n+911234567890\n+919876543210\n',
  MAIL_ADDRESS: 'address,zip\n1 Example Street,560001\n',
  MOBILE_DEVICE_ID: 'mobile_device_id\n00000000-0000-0000-0000-000000000001\n',
};

// ---- custom lists and the Impressions Estimator -------------------------------------------------

export interface CustomEntries {
  interests: string[];
  urls: string[];
  apps: string[];
  keywords: string[];
}

export const entryCount = (e: CustomEntries): number =>
  e.interests.length + e.urls.length + e.apps.length + e.keywords.length;

/** `unavailable` iff the list has no entries (AUD-051). Otherwise 0.5% to 3% of the pool, grown a little per entry. */
export function estimateCustomList(e: CustomEntries): SizeMap | { unavailable: true } {
  const n = entryCount(e);
  if (n === 0) return { unavailable: true };
  const key = [...e.interests, ...e.urls, ...e.apps, ...e.keywords].map((s) => s.toLowerCase()).sort().join('|');
  const fraction = Math.min(0.03, keyed(`custom:${key}`, 0.005, 0.02) + Math.min(0.01, n * 0.0008));
  return spreadSizes(POOL_USERS * fraction, { youtube: 0.7, mobileApp: 0.4, ctv: 0.15 });
}

/** Whole-list size of the engine fraction table for a created list (custom 0.5 to 3%). */
export const customListSize = (key: string): number =>
  Math.round(POOL_USERS * keyed(`customlist:${key}`, 0.005, 0.03));

// ---- Google audiences --------------------------------------------------------------------------

/** Display size of a Google audience: affinity 2 to 9% of the pool, in-market 1 to 5%, others 0.5 to 3% (engine 2.3). */
export function googleAudienceSize(id: string, kind: string): SizeMap {
  const [lo, hi] = kind === 'AFFINITY' ? [0.02, 0.09] : kind === 'IN_MARKET' ? [0.01, 0.05] : [0.005, 0.03];
  return spreadSizes(POOL_USERS * keyed(`google:${id}`, lo, hi), { youtube: 0.8, mobileApp: 0.55, ctv: 0.25 });
}
