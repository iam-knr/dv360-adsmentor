// Rule-based phrase to filter-link resolver (module 01 8.7, AC-01-13). Pure: no clock, no I/O, so the overlay and the
// API share it. Every word must be understood (entity, status, filter word, number or stop word); a phrase with a
// word left over is a name or ID search, because dropping it would show the wrong list.
import {
  DEFAULT_CPA_THRESHOLD,
  DEFAULT_CPC_THRESHOLD,
  EXPIRING_SOON_DAYS,
  YOUTUBE_LI_TYPES,
  type SearchTarget,
} from './suggestions';

export const SEARCH_QUERY_MAX = 200;
export const NO_MATCH_LEAD = "I couldn't match that to a saved search.";
export const NO_MATCH_TEXT = `${NO_MATCH_LEAD} Search by name or ID instead.`;

export type SearchScope = 'advertiser' | 'partner';

export interface ResolveResult {
  /** "Showing paused line items", or the no-match text. */
  interpretation: string;
  target: SearchTarget | null;
  /** Name/ID search link, offered when `target` is null (and on partner pages). */
  fallback: SearchTarget;
}

const STOP = new Set([
  'show',
  'me',
  'the',
  'all',
  'my',
  'of',
  'in',
  'with',
  'for',
  'that',
  'are',
  'is',
  'which',
  'have',
  'has',
  'find',
  'list',
  'get',
  'display',
  'a',
  'an',
  'and',
  'where',
  'whose',
  'what',
  'type',
  'than',
  'to',
  'on',
]);

type Entity = 'li' | 'io' | 'campaign';
const ENTITY_WORDS: Record<string, Entity> = {
  li: 'li',
  lis: 'li',
  lineitem: 'li',
  lineitems: 'li',
  line: 'li',
  lines: 'li',
  item: 'li',
  items: 'li',
  io: 'io',
  ios: 'io',
  insertion: 'io',
  order: 'io',
  orders: 'io',
  insertionorder: 'io',
  insertionorders: 'io',
  campaign: 'campaign',
  campaigns: 'campaign',
};
const STATUS_WORDS: Record<string, string> = {
  paused: 'PAUSED',
  pause: 'PAUSED',
  active: 'ACTIVE',
  running: 'ACTIVE',
  live: 'ACTIVE',
  draft: 'DRAFT',
  drafts: 'DRAFT',
  archived: 'ARCHIVED',
};
const STATUS_LABEL: Record<string, string> = {
  PAUSED: 'paused',
  ACTIVE: 'active',
  DRAFT: 'draft',
  ARCHIVED: 'archived',
};
const NOUN: Record<Entity, string> = {
  li: 'line items',
  io: 'insertion orders',
  campaign: 'campaigns',
};
const ROUTE: Record<Entity, string> = { li: 'explorerlis', io: 'explorerios', campaign: 'cs' };
const PACING_TYPES = ['AHEAD', 'EVEN', 'ASAP'] as const;

const PERIODS: { re: RegExp; d: string; text: string }[] = [
  { re: /\blast week\b/, d: 'LAST_WEEK', text: 'last week' },
  { re: /\blast 7 days\b/, d: 'LAST_7_DAYS', text: 'in the last 7 days' },
  { re: /\blast 14 days\b/, d: 'LAST_14_DAYS', text: 'in the last 14 days' },
  { re: /\blast 30 days\b/, d: 'LAST_30_DAYS', text: 'in the last 30 days' },
  { re: /\blast month\b/, d: 'LAST_MONTH', text: 'last month' },
  { re: /\bthis month\b/, d: 'THIS_MONTH', text: 'this month' },
  { re: /\byesterday\b/, d: 'YESTERDAY', text: 'yesterday' },
];

export function normalizePhrase(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[“”"']/g, '')
    .replace(/[^a-z0-9.,<>%₹$€£\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "1,500.50", "$2", "₹ 30" → number; null when none. Returns the match so the caller can remove it. */
function threshold(
  text: string,
  metric: 'cpc' | 'cpa',
): { value: number | null; rest: string } | null {
  const words =
    metric === 'cpc'
      ? '(?:cpc|cost per click)'
      : '(?:cpa|cost per (?:acquisition|conversion|action))';
  const re = new RegExp(
    `\\b${words}\\s*(?:over|above|greater than|more than|higher than|exceeding|>)?\\s*(?:[$\\u20b9€£]\\s*)?(\\d[\\d,]*(?:\\.\\d+)?|x)?\\b`,
  );
  const alt = new RegExp(
    `\\b${words}\\s*(?:>)\\s*(?:[$\\u20b9€£]\\s*)?(\\d[\\d,]*(?:\\.\\d+)?|x)?`,
  );
  const m = re.exec(text) ?? alt.exec(text);
  if (!m) return null;
  const raw = m[1];
  const n = raw && raw !== 'x' ? Number(raw.replace(/,/g, '')) : NaN;
  const rest = (text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)).replace(
    /\s+/g,
    ' ',
  );
  // "over" is part of the grammar; a metric word with neither "over" nor a number is just a mention, still accepted
  return { value: Number.isFinite(n) && n > 0 ? n : null, rest };
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

function nameIdFallback(text: string, scope: SearchScope): SearchTarget {
  const q = text.trim();
  return scope === 'partner'
    ? { route: 'advertisers', query: { q: [q] } }
    : { route: 'cs', query: { q: [q], 'f.status': ['*'] } };
}

export function resolveSearch(phrase: string, scope: SearchScope = 'advertiser'): ResolveResult {
  const raw = phrase.trim().slice(0, SEARCH_QUERY_MAX);
  const fallback = nameIdFallback(raw, scope);
  const none: ResolveResult = { interpretation: NO_MATCH_TEXT, target: null, fallback };
  if (!raw) return none;
  if (scope === 'partner') {
    return { interpretation: `Searching advertisers for "${raw}"`, target: fallback, fallback };
  }

  let text = normalizePhrase(raw);
  const query: Record<string, string[]> = {};
  const entities = new Set<Entity>();
  let matched = false;
  let status: string | null = null;
  let youtube = false;
  const clauses: string[] = [];

  // Multi-word phrases first, then single words.
  const cpc = threshold(text, 'cpc');
  let cpcValue: number | null = null;
  let cpaValue: number | null = null;
  if (cpc) {
    text = cpc.rest;
    cpcValue = cpc.value ?? DEFAULT_CPC_THRESHOLD;
    matched = true;
    entities.add('li');
  }
  const cpa = threshold(text, 'cpa');
  if (cpa) {
    text = cpa.rest;
    cpaValue = cpa.value ?? DEFAULT_CPA_THRESHOLD;
    matched = true;
    entities.add('li');
  }
  let period: (typeof PERIODS)[number] | null = null;
  for (const p of PERIODS) {
    if (p.re.test(text)) {
      period = p;
      text = text.replace(p.re, ' ');
      break;
    }
  }
  let expiring = false;
  if (
    /\b(expiring|expires|expire|ending|ends|about to end|running out)(?: very)?(?: soon)?\b/.test(
      text,
    )
  ) {
    expiring = true;
    matched = true;
    text = text.replace(
      /\b(expiring|expires|expire|ending|ends|about to end|running out)(?: very)?(?: soon)?\b/,
      ' ',
    );
    entities.add('li');
  }
  let unused = false;
  const unusedRe =
    /\b(?:unused pacing|under ?pacing|underpaced|under paced|pacing (?:unused|behind|under)|behind pacing|under pacing|not pacing)\b/;
  if (unusedRe.test(text)) {
    unused = true;
    matched = true;
    text = text.replace(unusedRe, ' ');
    entities.add('li');
  }
  let pacingType: string | null = null;
  const pt =
    /\b(?:pacing(?: type)?\s+(ahead|even|asap)|(ahead|even|asap)\s+pacing)\b/.exec(text) ?? null;
  if (pt) {
    pacingType = (pt[1] ?? pt[2] ?? '').toUpperCase();
    matched = true;
    text = text.replace(pt[0], ' ');
  }

  for (const word of text.split(' ').filter(Boolean)) {
    const w = word.replace(/[.,]+$/, '');
    if (!w || STOP.has(w)) continue;
    if (w === 'youtube' || w === 'yt' || w === 'trueview') {
      youtube = true;
      matched = true;
      entities.add('li');
      continue;
    }
    const e = ENTITY_WORDS[w];
    if (e) {
      // "line"/"item"/"order" alone only count as part of a two word entity; accept them, harmless
      entities.add(e);
      matched = true;
      continue;
    }
    const s = STATUS_WORDS[w];
    if (s) {
      status = s;
      matched = true;
      continue;
    }
    return none;
  }
  if (!matched) return none;

  // Two different lists in one phrase ("campaigns and IOs"): ambiguous, so a name or ID search
  if (entities.size > 1) return none;
  const entity: Entity = [...entities][0] ?? (pacingType ? 'io' : 'li');
  if (
    entity !== 'li' &&
    (youtube || expiring || unused || cpcValue !== null || cpaValue !== null)
  ) {
    return none;
  }
  if (pacingType && entity === 'campaign') return none;

  if (youtube) {
    query['f.type'] = [...YOUTUBE_LI_TYPES];
    if (!status) query['f.status'] = ['*'];
  }
  if (status) query['f.status'] = [status];
  if (expiring) query['f.endsWithin'] = [String(EXPIRING_SOON_DAYS)];
  if (unused) {
    query['f.pacing'] = ['UNDER'];
    query['d'] = ['LIFETIME'];
  }
  if (pacingType && (PACING_TYPES as readonly string[]).includes(pacingType)) {
    query['f.pacingType'] = [pacingType];
  }
  if (cpcValue !== null) query['f.cpcOver'] = [fmt(cpcValue)];
  if (cpaValue !== null) query['f.cpaOver'] = [fmt(cpaValue)];
  if (cpcValue !== null || cpaValue !== null) query['d'] = [period?.d ?? 'LAST_WEEK'];
  else if (period) query['d'] = [period.d];

  const parts: string[] = [];
  if (status) parts.push(STATUS_LABEL[status] ?? status.toLowerCase());
  if (youtube) parts.push('YouTube');
  parts.push(NOUN[entity]);
  if (expiring) clauses.push('expiring soon');
  if (unused) clauses.push('with unused pacing');
  if (pacingType) clauses.push(`with pacing type ${pacingType}`);
  const periodText = period?.text ?? 'last week';
  if (cpcValue !== null) clauses.push(`with CPC over ${fmt(cpcValue)} ${periodText}`);
  if (cpaValue !== null) clauses.push(`with CPA over ${fmt(cpaValue)} ${periodText}`);
  const target: SearchTarget = { route: ROUTE[entity], query };
  return {
    interpretation: `Showing ${[...parts, ...clauses].join(' ')}`,
    target,
    fallback,
  };
}

/** `?f.status=PAUSED&d=LAST_WEEK` from a query map. Empty map → empty string. */
export function toSearchString(query: Record<string, string[]>): string {
  const sp = new URLSearchParams();
  for (const [k, values] of Object.entries(query)) for (const v of values) sp.append(k, v);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Full href of a target below `base` (`/p/1/a/2` or `/p/1`). */
export function targetHref(base: string, target: SearchTarget): string {
  return `${base}/${target.route}${toSearchString(target.query)}`;
}
