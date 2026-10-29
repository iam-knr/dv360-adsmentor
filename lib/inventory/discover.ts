// Marketplace Discover search (module 13 S7, RC-054: canned, no model call). Pure.
export interface DiscoverFilters {
  inventoryType?: string[];
  deviceType?: string[];
  format?: string[];
  gender?: string[];
  age?: string[];
  audience?: string[];
  country?: string[];
  category?: string[];
  genre?: string[];
  exchange?: string[];
}

export interface SearchableProduct {
  id: string;
  type: string;
  exchangeId: string;
  exchangeName: string;
  name: string;
  searchText: string;
  sevenDayImpressions: number;
  format: string;
  device: string[];
  categories: string[];
  country: string[];
  genre: string[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Keyword score: every token must match somewhere; name hits weigh 5, exact-word hits 2, substring hits 1. */
export function keywordScore(query: string, p: Pick<SearchableProduct, 'name' | 'searchText'>): number {
  const tokens = norm(query).split(' ').filter(Boolean);
  if (tokens.length === 0) return 1;
  const name = norm(p.name);
  const text = norm(`${p.name} ${p.searchText}`);
  const words = new Set(text.split(' '));
  let score = 0;
  for (const t of tokens) {
    if (!text.includes(t)) return 0;
    score += 1;
    if (words.has(t)) score += 1;
    if (name.includes(t)) score += 5;
  }
  return score;
}

const PHRASES: { re: RegExp; apply: (f: DiscoverFilters) => void; chip: string }[] = [
  { re: /\b(video|ctv|streaming|connected tv)\b/, apply: (f) => (f.format = [...(f.format ?? []), 'VIDEO']), chip: 'Format: Video' },
  { re: /\b(audio|podcast|music|radio)\b/, apply: (f) => (f.format = [...(f.format ?? []), 'AUDIO']), chip: 'Format: Audio' },
  { re: /\b(display|banner|high viewability)\b/, apply: (f) => (f.format = [...(f.format ?? []), 'DISPLAY']), chip: 'Format: Display' },
  { re: /\b(mobile|phone|app|apps)\b/, apply: (f) => (f.deviceType = [...(f.deviceType ?? []), 'Mobile']), chip: 'Device: Mobile' },
  { re: /\b(tv|television|living room)\b/, apply: (f) => (f.deviceType = [...(f.deviceType ?? []), 'Connected TV']), chip: 'Device: Connected TV' },
  { re: /\b(india|indian)\b/, apply: (f) => (f.country = [...(f.country ?? []), 'India']), chip: 'Country: India' },
  { re: /\b(singapore)\b/, apply: (f) => (f.country = [...(f.country ?? []), 'Singapore']), chip: 'Country: Singapore' },
  { re: /\b(sports?|cricket)\b/, apply: (f) => (f.category = [...(f.category ?? []), 'Sports']), chip: 'Category: Sports' },
  { re: /\b(news)\b/, apply: (f) => (f.category = [...(f.category ?? []), 'News']), chip: 'Category: News' },
  { re: /\b(entertainment|movies?|shows?)\b/, apply: (f) => (f.category = [...(f.category ?? []), 'Entertainment']), chip: 'Category: Entertainment' },
  { re: /\b(premium|always on)\b/, apply: (f) => (f.inventoryType = [...(f.inventoryType ?? []), 'PACKAGE']), chip: 'Inventory type: Package' },
];

/** AI mode: map phrases to filters with canned rules and report the interpreted chips. */
export function interpretPhrase(query: string): { filters: DiscoverFilters; chips: string[]; rest: string } {
  const q = norm(query);
  const filters: DiscoverFilters = {};
  const chips: string[] = [];
  for (const p of PHRASES) {
    if (p.re.test(q)) {
      p.apply(filters);
      chips.push(p.chip);
    }
  }
  return { filters, chips, rest: '' };
}

function matches(vals: string[] | undefined, have: string[]): boolean {
  return !vals?.length || vals.some((v) => have.includes(v));
}

export function applyFilters(p: SearchableProduct, f: DiscoverFilters): boolean {
  return (
    matches(f.inventoryType, [p.type]) &&
    matches(f.format, [p.format]) &&
    matches(f.deviceType, p.device) &&
    matches(f.country, p.country) &&
    matches(f.category, p.categories) &&
    matches(f.genre, p.genre) &&
    matches(f.exchange, [p.exchangeId])
  );
}

export function mergeFilters(a: DiscoverFilters, b: DiscoverFilters): DiscoverFilters {
  const out: DiscoverFilters = { ...a };
  for (const [k, v] of Object.entries(b) as [keyof DiscoverFilters, string[]][]) {
    out[k] = [...new Set([...(out[k] ?? []), ...v])];
  }
  return out;
}

export function rank<T extends SearchableProduct>(
  rows: T[],
  query: string,
  filters: DiscoverFilters,
  mode: 'AI' | 'KEYWORD',
): { rows: T[]; chips: string[] } {
  let all = filters;
  let chips: string[] = [];
  let text = query;
  if (mode === 'AI') {
    const i = interpretPhrase(query);
    all = mergeFilters(filters, i.filters);
    chips = i.chips;
    text = '';
  }
  const scored = rows
    .filter((r) => applyFilters(r, all))
    .map((r) => ({ r, s: keywordScore(text, r) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || b.r.sevenDayImpressions - a.r.sevenDayImpressions || a.r.name.localeCompare(b.r.name));
  return { rows: scored.map((x) => x.r), chips };
}
