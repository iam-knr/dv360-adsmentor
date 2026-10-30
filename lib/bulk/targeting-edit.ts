// Bulk edit of targeting (module 11 2.4, K7): Add / Replace / Remove on a TargetingState. Pure.
// List dimensions merge by option id; single-value dimensions (Connection speed, Viewability, Environment,
// Position) are overwritten, and Remove deletes the row. Dimensions the line item type does not offer (MX-10) are
// skipped by the caller before this runs.
import type {
  Day,
  DaySegment,
  Sel,
  TargetingCriteria,
  TargetingState,
} from '@/lib/targeting/types';
import type { BulkTargetingDimension, EditMode } from './types';

const mergeSels = (current: Sel[] | undefined, value: Sel[], mode: EditMode): Sel[] => {
  const cur = current ?? [];
  if (mode === 'REPLACE') return value;
  if (mode === 'REMOVE') {
    const drop = new Set(value.map((s) => s.id));
    return cur.filter((s) => !drop.has(s.id));
  }
  const byId = new Map(cur.map((s) => [s.id, s] as const));
  for (const s of value) byId.set(s.id, s);
  return [...byId.values()];
};

const mergeStrings = (current: string[] | undefined, value: string[], mode: EditMode): string[] => {
  const cur = current ?? [];
  if (mode === 'REPLACE') return [...new Set(value)];
  if (mode === 'REMOVE') return cur.filter((v) => !value.includes(v));
  return [...new Set([...cur, ...value])];
};

const segKey = (s: DaySegment) => `${s.day}|${s.from}|${s.to}`;

export interface TargetingEditValue {
  sels?: Sel[];
  device?: { types?: Sel[]; os?: Sel[]; makeModel?: Sel[] };
  keywords?: { include?: string[]; exclude?: string[] };
  appsAndUrls?: Partial<{ channelIds: Sel[]; collections: Sel[]; urls: Sel[]; apps: Sel[] }>;
  audience?: {
    google?: string[];
    combined?: string[];
    custom?: string[];
    firstParty?: string[];
    excludeFirstParty?: string[];
    excludeGoogle?: string[];
  };
  daySegments?: DaySegment[];
  tz?: 'LOCAL' | 'ADVERTISER';
  demographics?: Partial<NonNullable<TargetingCriteria['demographics']>>;
  environment?: { web: boolean; app: boolean };
  position?: { onScreen: string[]; inContent: string[]; native: string[] };
  viewability?: { openMeasurement: boolean; predictedPct: number | null };
  connectionSpeed?: string;
}

const EMPTY_DEMO: NonNullable<TargetingCriteria['demographics']> = {
  gender: [],
  ageRange: [18, 65],
  ageUnknown: true,
  parental: [],
  income: [],
};

/** Returns a new state; the input is not changed. `value` is trusted to have the shape of the dimension. */
export function applyTargetingEdit(
  state: TargetingState,
  dimension: BulkTargetingDimension,
  mode: EditMode,
  value: TargetingEditValue,
): TargetingState {
  const c: TargetingCriteria = structuredClone(state.criteria);
  switch (dimension) {
    case 'LANGUAGE': {
      const next = mergeSels(c.language, value.sels ?? [], mode);
      if (next.length) c.language = next;
      else delete c.language;
      break;
    }
    case 'CATEGORIES': {
      const next = mergeSels(c.categories, value.sels ?? [], mode);
      if (next.length) c.categories = next;
      else delete c.categories;
      break;
    }
    case 'BROWSER': {
      const next = mergeSels(c.browser, value.sels ?? [], mode);
      if (next.length) c.browser = next;
      else delete c.browser;
      break;
    }
    case 'CARRIER_ISP': {
      const next = mergeSels(c.carrierIsp, value.sels ?? [], mode);
      if (next.length) c.carrierIsp = next;
      else delete c.carrierIsp;
      break;
    }
    case 'GEOGRAPHY': {
      const geo = c.geography ?? { regions: [] };
      const regions = mergeSels(geo.regions, value.sels ?? [], mode);
      if (regions.length || geo.radius || geo.locationListIds?.length)
        c.geography = { ...geo, regions };
      else delete c.geography;
      break;
    }
    case 'DEVICE': {
      const d = c.device ?? { types: [], os: [], makeModel: [] };
      const v = value.device ?? {};
      const next = {
        types: v.types ? mergeSels(d.types, v.types, mode) : d.types,
        os: v.os ? mergeSels(d.os, v.os, mode) : d.os,
        makeModel: v.makeModel ? mergeSels(d.makeModel, v.makeModel, mode) : d.makeModel,
      };
      if (next.types.length || next.os.length || next.makeModel.length) c.device = next;
      else delete c.device;
      break;
    }
    case 'KEYWORDS': {
      const k = c.keywords ?? { include: [], exclude: [] };
      const v = value.keywords ?? {};
      const next = {
        include: v.include ? mergeStrings(k.include, v.include, mode) : k.include,
        exclude: v.exclude ? mergeStrings(k.exclude, v.exclude, mode) : k.exclude,
      };
      if (next.include.length || next.exclude.length) c.keywords = next;
      else delete c.keywords;
      break;
    }
    case 'APPS_URLS': {
      const a = c.appsAndUrls ?? { channelIds: [], collections: [], urls: [], apps: [] };
      const v = value.appsAndUrls ?? {};
      const next = {
        channelIds: v.channelIds ? mergeSels(a.channelIds, v.channelIds, mode) : a.channelIds,
        collections: v.collections ? mergeSels(a.collections, v.collections, mode) : a.collections,
        urls: v.urls ? mergeSels(a.urls, v.urls, mode) : a.urls,
        apps: v.apps ? mergeSels(a.apps, v.apps, mode) : a.apps,
      };
      if (next.channelIds.length || next.collections.length || next.urls.length || next.apps.length)
        c.appsAndUrls = next;
      else delete c.appsAndUrls;
      break;
    }
    case 'AUDIENCE_LISTS': {
      const a = c.audienceLists ?? {
        include: { firstPartyGroups: [], google: [], combined: [], custom: [] },
        exclude: { firstParty: [], google: [] },
      };
      const v = value.audience ?? {};
      const groups = a.include.firstPartyGroups;
      let firstPartyGroups = groups;
      if (v.firstParty) {
        if (mode === 'REPLACE') firstPartyGroups = v.firstParty.length ? [v.firstParty] : [];
        else if (mode === 'ADD')
          firstPartyGroups = v.firstParty.length ? [...groups, v.firstParty] : groups;
        else
          firstPartyGroups = groups
            .map((g) => g.filter((id) => !v.firstParty!.includes(id)))
            .filter((g) => g.length);
      }
      const next = {
        include: {
          firstPartyGroups,
          google: v.google ? mergeStrings(a.include.google, v.google, mode) : a.include.google,
          combined: v.combined
            ? mergeStrings(a.include.combined, v.combined, mode)
            : a.include.combined,
          custom: v.custom ? mergeStrings(a.include.custom, v.custom, mode) : a.include.custom,
        },
        exclude: {
          firstParty: v.excludeFirstParty
            ? mergeStrings(a.exclude.firstParty, v.excludeFirstParty, mode)
            : a.exclude.firstParty,
          google: v.excludeGoogle
            ? mergeStrings(a.exclude.google, v.excludeGoogle, mode)
            : a.exclude.google,
        },
      };
      const any =
        next.include.firstPartyGroups.length ||
        next.include.google.length ||
        next.include.combined.length ||
        next.include.custom.length ||
        next.exclude.firstParty.length ||
        next.exclude.google.length;
      if (any) c.audienceLists = next;
      else delete c.audienceLists;
      break;
    }
    case 'DAY_TIME': {
      const d = c.dayAndTime ?? { segments: [], tz: 'ADVERTISER' as const };
      const incoming = value.daySegments ?? [];
      let segments = d.segments;
      if (mode === 'REPLACE') segments = incoming;
      else if (mode === 'REMOVE') {
        const drop = new Set(incoming.map(segKey));
        segments = d.segments.filter((s) => !drop.has(segKey(s)));
      } else {
        const have = new Set(d.segments.map(segKey));
        segments = [...d.segments, ...incoming.filter((s) => !have.has(segKey(s)))];
      }
      segments = [...segments].sort(
        (a, b) => DAY_ORDER[a.day] - DAY_ORDER[b.day] || a.from.localeCompare(b.from),
      );
      if (segments.length) c.dayAndTime = { segments, tz: value.tz ?? d.tz };
      else delete c.dayAndTime;
      break;
    }
    case 'DEMOGRAPHICS': {
      const d = c.demographics ?? EMPTY_DEMO;
      const v = value.demographics ?? {};
      if (mode === 'REMOVE' && !v.gender && !v.parental && !v.income) {
        delete c.demographics;
        break;
      }
      c.demographics = {
        gender: v.gender ? mergeStrings(d.gender, v.gender, mode) : d.gender,
        parental: v.parental ? mergeStrings(d.parental, v.parental, mode) : d.parental,
        income: v.income ? mergeStrings(d.income, v.income, mode) : d.income,
        ageRange: mode === 'REMOVE' ? d.ageRange : (v.ageRange ?? d.ageRange),
        ageUnknown: mode === 'REMOVE' ? d.ageUnknown : (v.ageUnknown ?? d.ageUnknown),
      };
      break;
    }
    case 'ENVIRONMENT':
      if (mode === 'REMOVE') delete c.environment;
      else if (value.environment) c.environment = value.environment;
      break;
    case 'POSITION':
      if (mode === 'REMOVE') delete c.position;
      else if (value.position) c.position = value.position;
      break;
    case 'VIEWABILITY':
      if (mode === 'REMOVE') delete c.viewability;
      else if (value.viewability) c.viewability = value.viewability;
      break;
    case 'CONNECTION_SPEED':
      if (mode === 'REMOVE') delete c.connectionSpeed;
      else if (value.connectionSpeed) c.connectionSpeed = value.connectionSpeed;
      break;
    default:
      break;
  }
  return { ...state, criteria: c };
}

const DAY_ORDER: Record<Day, number> = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5, SUN: 6 };

/** Dimensions that overwrite instead of merging (Add, Replace and Remove still differ: Remove deletes the row). */
export const SINGLE_VALUE_DIMENSIONS: readonly BulkTargetingDimension[] = [
  'CONNECTION_SPEED',
  'VIEWABILITY',
  'ENVIRONMENT',
  'POSITION',
];
