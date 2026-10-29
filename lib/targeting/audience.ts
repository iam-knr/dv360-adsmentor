// Audience builder logic (module 10 2.5, RC-030): the expression, its validation (TGT-100 to TGT-105), the
// Impressions summary (Δ-10-4) and the catalogue of Google audiences. Pure: the engine is called through the
// functions passed in, so the route handler owns the database.
import googleAudiencesJson from '../../data/reference/google-audiences.json';
import { LI_TYPE_LABEL, type LiType } from '@/lib/validation/constants/li-compat';
import type { TargetingCriteria } from './types';

export type AudienceLists = NonNullable<TargetingCriteria['audienceLists']>;

export const AUDIENCE_MESSAGES = {
  TGT_100: "An item can't be both included and excluded.",
  TGT_101: "This audience can't be used in {Type} line items.",
  TGT_102: 'This audience is small and may limit delivery.',
  TGT_103: "This audience isn't available yet. New audiences take up to 4 hours.",
  TGT_105: 'Lookalike audiences can only be used in YouTube & partners and Demand Gen line items.',
  UNAVAILABLE: 'Audience forecasting is not available for this configuration.',
} as const;

export const emptyAudienceLists = (): AudienceLists => ({
  include: { firstPartyGroups: [], google: [], combined: [], custom: [] },
  exclude: { firstParty: [], google: [] },
});

/** Every list in the state with its section, in builder order. */
export type AudienceSection = 'FIRST_PARTY' | 'GOOGLE' | 'COMBINED' | 'CUSTOM';
export interface AudienceRef {
  id: string;
  side: 'INCLUDE' | 'EXCLUDE';
  section: AudienceSection;
  group?: number;
}

export function audienceRefs(a: AudienceLists): AudienceRef[] {
  return [
    ...a.include.firstPartyGroups.flatMap((g, group) =>
      g.map((id): AudienceRef => ({ id, side: 'INCLUDE', section: 'FIRST_PARTY', group })),
    ),
    ...a.include.google.map((id): AudienceRef => ({ id, side: 'INCLUDE', section: 'GOOGLE' })),
    ...a.include.combined.map((id): AudienceRef => ({ id, side: 'INCLUDE', section: 'COMBINED' })),
    ...a.include.custom.map((id): AudienceRef => ({ id, side: 'INCLUDE', section: 'CUSTOM' })),
    ...a.exclude.firstParty.map((id): AudienceRef => ({
      id,
      side: 'EXCLUDE',
      section: 'FIRST_PARTY',
    })),
    ...a.exclude.google.map((id): AudienceRef => ({ id, side: 'EXCLUDE', section: 'GOOGLE' })),
  ];
}

export function audienceCount(a: AudienceLists): number {
  return audienceRefs(a).length;
}

// ---- Google audiences catalogue ---------------------------------------------------------------------------------

export interface GoogleAudience {
  id: string;
  name: string;
  kind: string;
  path: string[];
}

export const GOOGLE_AUDIENCES: readonly GoogleAudience[] = (
  googleAudiencesJson as GoogleAudience[]
).map((g) => ({ id: g.id, name: g.name, kind: g.kind, path: g.path }));

const GOOGLE_BY_ID = new Map(GOOGLE_AUDIENCES.map((g) => [g.id, g]));
export const googleAudience = (id: string) => GOOGLE_BY_ID.get(id);

export const GOOGLE_KIND_LABEL: Record<string, string> = {
  AFFINITY: 'Affinity',
  IN_MARKET: 'In-market',
  LIFE_EVENT: 'Life events',
  DETAILED_DEMOGRAPHIC: 'Detailed demographics',
};

// ---- expression -------------------------------------------------------------------------------------------------

const unionShare = (xs: number[]): number => 1 - xs.reduce((acc, s) => acc * (1 - s), 1);

export interface AudienceShares {
  /** Share of users in the include expression (1 when no include list is chosen). */
  include: number;
  /** Share of users in the exclude union. */
  exclude: number;
  /** include minus exclude. */
  net: number;
  /** Overlap of include and exclude, for the Venn diagram. */
  overlap: number;
}

/**
 * RC-030 with independent audiences: OR inside a group, AND between the first-party groups, OR between sections,
 * then subtract the exclusions. `frac` is the user share of one list.
 */
export function evaluateShares(a: AudienceLists, frac: (id: string) => number): AudienceShares {
  const excl = [...a.exclude.firstParty, ...a.exclude.google];
  // A list on both sides is its own exclusion: it contributes no included users (AC-10-25).
  const f = (id: string) => (excl.includes(id) ? 0 : frac(id));
  const groups = a.include.firstPartyGroups.filter((g) => g.length > 0);
  const sections: number[] = [];
  if (groups.length > 0) sections.push(groups.reduce((acc, g) => acc * unionShare(g.map(f)), 1));
  for (const ids of [a.include.google, a.include.combined, a.include.custom])
    if (ids.length > 0) sections.push(unionShare(ids.map(f)));
  const include = sections.length > 0 ? unionShare(sections) : 1;
  const exclude = excl.length > 0 ? unionShare(excl.map(frac)) : 0;
  return { include, exclude, net: include * (1 - exclude), overlap: include * exclude };
}

/** Same expression over explicit user sets (ENG 2.3 fixtures, test V-10-16). */
export function evaluateMembers(
  a: AudienceLists,
  members: (id: string) => ReadonlySet<string>,
  everyone: ReadonlySet<string> = new Set(),
): Set<string> {
  const union = (ids: string[]) => {
    const out = new Set<string>();
    for (const id of ids) for (const u of members(id)) out.add(u);
    return out;
  };
  const sections: Set<string>[] = [];
  const groups = a.include.firstPartyGroups.filter((g) => g.length > 0);
  if (groups.length > 0) {
    let acc = union(groups[0]!);
    for (const g of groups.slice(1)) {
      const u = union(g);
      acc = new Set([...acc].filter((x) => u.has(x)));
    }
    sections.push(acc);
  }
  for (const ids of [a.include.google, a.include.combined, a.include.custom])
    if (ids.length > 0) sections.push(union(ids));
  const include =
    sections.length > 0 ? new Set(sections.flatMap((s) => [...s])) : new Set(everyone);
  const exclude = union([...a.exclude.firstParty, ...a.exclude.google]);
  return new Set([...include].filter((u) => !exclude.has(u)));
}

// ---- validation -------------------------------------------------------------------------------------------------

export interface AudienceMeta {
  id: string;
  name: string;
  kind: 'FIRST_PARTY' | 'GOOGLE' | 'COMBINED' | 'CUSTOM' | 'LOOKALIKE';
  /** LI types the list may be used in; absent = every type. */
  eligibleTypes?: LiType[];
  /** Sim hours until the list is usable (TGT-103); absent or 0 = usable. */
  availableInHours?: number;
  /** Size bucket text of the list (TGT-102 when below 1K). */
  sizeBucket?: string;
}

export interface AudienceIssue {
  ruleId: 'TGT-100' | 'TGT-101' | 'TGT-102' | 'TGT-103' | 'TGT-105';
  severity: 'error' | 'warning';
  id: string;
  message: string;
}

const LOOKALIKE_TYPES: readonly LiType[] = ['YT_VIDEO', 'YT_AUDIO', 'DEMAND_GEN'];

export function audienceIssues(
  a: AudienceLists,
  type: LiType | null,
  meta: (id: string) => AudienceMeta | undefined,
): AudienceIssue[] {
  const out: AudienceIssue[] = [];
  const refs = audienceRefs(a);
  const excluded = new Set(refs.filter((r) => r.side === 'EXCLUDE').map((r) => r.id));
  const seen = new Set<string>();
  for (const r of refs.filter((x) => x.side === 'INCLUDE')) {
    if (excluded.has(r.id) && !seen.has(`100:${r.id}`)) {
      seen.add(`100:${r.id}`);
      out.push({
        ruleId: 'TGT-100',
        severity: 'error',
        id: r.id,
        message: AUDIENCE_MESSAGES.TGT_100,
      });
    }
    const m = meta(r.id);
    if (!m || !type) continue;
    if (m.kind === 'LOOKALIKE') {
      if (!LOOKALIKE_TYPES.includes(type))
        out.push({
          ruleId: 'TGT-105',
          severity: 'error',
          id: r.id,
          message: AUDIENCE_MESSAGES.TGT_105,
        });
    } else if (m.eligibleTypes && !m.eligibleTypes.includes(type)) {
      out.push({
        ruleId: 'TGT-101',
        severity: 'error',
        id: r.id,
        message: AUDIENCE_MESSAGES.TGT_101.replace('{Type}', LI_TYPE_LABEL[type]),
      });
    }
    if (m.kind !== 'COMBINED' && (m.availableInHours ?? 0) > 0)
      out.push({
        ruleId: 'TGT-103',
        severity: 'error',
        id: r.id,
        message: AUDIENCE_MESSAGES.TGT_103,
      });
    if (m.sizeBucket === '< 1K')
      out.push({
        ruleId: 'TGT-102',
        severity: 'warning',
        id: r.id,
        message: AUDIENCE_MESSAGES.TGT_102,
      });
  }
  return out;
}

/** Whether a list may be picked for the type: the picker's "Audience eligibility" filter (TGT-101, TGT-105). */
export function eligibleFor(m: AudienceMeta, type: LiType | null): boolean {
  if (!type) return true;
  if (m.kind === 'LOOKALIKE') return LOOKALIKE_TYPES.includes(type);
  return !m.eligibleTypes || m.eligibleTypes.includes(type);
}

// ---- Impressions summary ----------------------------------------------------------------------------------------

/** Δ-10-4. Counts are impressions over the flight; shares are fractions of 1. */
export interface ImpressionsSummary {
  asOf: string;
  basis: 'FLIGHT_AND_TARGETING_NO_EXPANSION';
  overall: number;
  included: number;
  excluded: number;
  otherTargeting: number;
  venn: { includedPct: number; excludedPct: number; overlapPct: number };
  gender: { male: number; female: number; coveragePct: number };
  age: Record<'18-24' | '25-34' | '35-44' | '45-54' | '55-64' | '65+', number>;
  device: { desktop: number; mobile: number; tablet: number; ctv: number };
}

export interface SummaryMix {
  gender: { male: number; female: number };
  age: ImpressionsSummary['age'];
  device: ImpressionsSummary['device'];
}

const norm = <T extends Record<string, number>>(o: T): T => {
  const total = Object.values(o).reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v / total])) as T;
};

/**
 * Builds the summary from the engine's untargeted size (`overall`, impressions over the flight), the share the other
 * targeting passes, and the audience shares. `included` is what the include lists reach before the other targeting,
 * `excluded` the part removed by exclusions.
 */
export function buildSummary(input: {
  asOf: string;
  overall: number;
  otherShare: number;
  shares: AudienceShares;
  mix: SummaryMix;
  hasAudience: boolean;
}): ImpressionsSummary {
  const { overall, otherShare, shares, mix, hasAudience } = input;
  const includeShare = hasAudience ? shares.include : 1;
  const included = overall * includeShare;
  const excluded = overall * shares.overlap;
  const other = overall * otherShare;
  const gender = norm(mix.gender);
  return {
    asOf: input.asOf,
    basis: 'FLIGHT_AND_TARGETING_NO_EXPANSION',
    overall,
    included,
    excluded,
    otherTargeting: other,
    venn: {
      includedPct: includeShare * 100,
      excludedPct: shares.exclude * 100,
      overlapPct: shares.overlap * 100,
    },
    gender: { male: gender.male, female: gender.female, coveragePct: 95 },
    age: norm(mix.age),
    device: norm(mix.device),
  };
}

/** 7310000000000 reads 7.31T (module 10 2.5). */
export function formatImpressions(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  const units: [number, string][] = [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];
  for (const [size, suffix] of units) if (n >= size) return `${(n / size).toFixed(2)}${suffix}`;
  return String(Math.round(n));
}

// ---- editing ----------------------------------------------------------------------------------------------------

export type PickTarget =
  | { side: 'INCLUDE'; section: 'FIRST_PARTY'; group: number | 'new' }
  | { side: 'INCLUDE'; section: 'GOOGLE' | 'COMBINED' | 'CUSTOM' }
  | { side: 'EXCLUDE'; section: 'FIRST_PARTY' | 'GOOGLE' };

/** Ids currently picked in the section the target names (the picker's starting selection). */
export function currentPick(a: AudienceLists, t: PickTarget): string[] {
  if (t.side === 'EXCLUDE') return t.section === 'GOOGLE' ? a.exclude.google : a.exclude.firstParty;
  if (t.section === 'FIRST_PARTY')
    return t.group === 'new' ? [] : (a.include.firstPartyGroups[t.group] ?? []);
  return t.section === 'GOOGLE'
    ? a.include.google
    : t.section === 'COMBINED'
      ? a.include.combined
      : a.include.custom;
}

/**
 * Replaces the picked section with `ids`. An id already on the other side is refused and returned in `blocked`
 * (TGT-100: an item can't be both included and excluded).
 */
export function applyPick(
  a: AudienceLists,
  t: PickTarget,
  ids: string[],
): { lists: AudienceLists; blocked: string[] } {
  const opposite = new Set(
    audienceRefs(a)
      .filter((r) => r.side !== t.side)
      .map((r) => r.id),
  );
  const blocked = ids.filter((id) => opposite.has(id));
  const ok = [...new Set(ids.filter((id) => !opposite.has(id)))];
  const next: AudienceLists = structuredClone(a);
  if (t.side === 'EXCLUDE') {
    if (t.section === 'GOOGLE') next.exclude.google = ok;
    else next.exclude.firstParty = ok;
  } else if (t.section === 'FIRST_PARTY') {
    const groups = next.include.firstPartyGroups;
    if (t.group === 'new') {
      if (ok.length > 0) groups.push(ok);
    } else if (ok.length > 0) groups[t.group] = ok;
    else groups.splice(t.group, 1);
  } else if (t.section === 'GOOGLE') next.include.google = ok;
  else if (t.section === 'COMBINED') next.include.combined = ok;
  else next.include.custom = ok;
  return { lists: next, blocked };
}

export function removeAudience(a: AudienceLists, ref: AudienceRef): AudienceLists {
  const next: AudienceLists = structuredClone(a);
  if (ref.side === 'EXCLUDE') {
    if (ref.section === 'GOOGLE')
      next.exclude.google = next.exclude.google.filter((x) => x !== ref.id);
    else next.exclude.firstParty = next.exclude.firstParty.filter((x) => x !== ref.id);
  } else if (ref.section === 'FIRST_PARTY') {
    const g = next.include.firstPartyGroups;
    g[ref.group!] = (g[ref.group!] ?? []).filter((x) => x !== ref.id);
    next.include.firstPartyGroups = g.filter((x) => x.length > 0);
  } else if (ref.section === 'GOOGLE')
    next.include.google = next.include.google.filter((x) => x !== ref.id);
  else if (ref.section === 'COMBINED')
    next.include.combined = next.include.combined.filter((x) => x !== ref.id);
  else next.include.custom = next.include.custom.filter((x) => x !== ref.id);
  return next;
}
