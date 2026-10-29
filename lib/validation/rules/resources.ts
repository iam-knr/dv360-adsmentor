// CH, KW, LOC, FL rules: channels, keyword lists, location lists, Floodlight (validation.md 2.21, module 15 4).
// Custom bidding (CB) stays empty here: module 15 task M15-08 belongs to session P4-05.
import { RESOURCE_LIMITS } from '@/lib/resources/limits';
import { parseKeywords } from '@/lib/resources/keywords';
import { resolveLocationEntries, type GeoOptionRef } from '@/lib/resources/location';
import { parseSites } from '@/lib/resources/parse-sites';
import { COUNTING_METHODS_BY_ACTIVITY } from '../constants/conversions';
import { LIMITS } from '../constants/limits';
import { MSG } from '../messages';
import { isBlank, isWhole, toNum } from '../primitives';
import type { AnyRule, Num, Rule } from '../types';

// ---------------------------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------------------------

export interface ChannelInput {
  name: string;
  /** One site per line of the textarea. */
  sites: string[];
  /** Channel delete: line items that include or exclude it (CH-008). */
  usedByLineItems?: number;
}

export interface KeywordListInput {
  name: string;
  /** Raw text chunks; newlines and commas both split. */
  keywords: string[];
  /** List delete: line items using it (KW-005). */
  usedByLineItems?: number;
}

export interface LocationListInput {
  name: string;
  type: 'REGIONAL' | 'PROXIMITY' | null;
  entries: string[];
  /** Geography options the regional entries resolve against. */
  geoOptions?: readonly GeoOptionRef[];
  /** Stored type on edit (LOC-002). */
  storedType?: 'REGIONAL' | 'PROXIMITY' | null;
}

export interface FloodlightGroupInput {
  name: string;
  clickDays?: Num;
  impressionDays?: Num;
  viewableImpressionPct?: Num;
  /** Variable keys, `u1`..`u100`. */
  variableKeys?: string[];
}

export type FloodlightPlatformKey = 'WEB' | 'MOBILE_APP' | 'CONNECTED_TV';

export interface FloodlightConversionInput {
  platform: FloodlightPlatformKey | null;
  name: string;
  format: 'GOOGLE_TAG' | 'IFRAME_TAG' | 'IMAGE_TAG' | null;
  type: 'COUNTER' | 'SALE' | null;
  countingMethod: string | null;
  status: 'ACTIVE' | 'ARCHIVED' | null;
  remarketing?: boolean;
  valueBasedBidding?: boolean;
  appId?: string | null;
  ctvAppId?: string | null;
  conversionEventName?: string | null;
  /** Archive: line items that count this conversion (FL-033). */
  usedByLineItems?: number;
  /** Stored platform, format and type on edit (FL-032). */
  stored?: {
    platform: FloodlightPlatformKey;
    format: 'GOOGLE_TAG' | 'IFRAME_TAG' | 'IMAGE_TAG';
    type: 'COUNTER' | 'SALE';
  };
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

function def<T>(kind: Rule<T>['kind'], rule: Omit<Rule<T>, 'kind'>): AnyRule {
  return { kind, ...rule };
}

const channel = (rule: Omit<Rule<ChannelInput>, 'kind'>) => def<ChannelInput>('channel', rule);
const keywordList = (rule: Omit<Rule<KeywordListInput>, 'kind'>) =>
  def<KeywordListInput>('keywordList', rule);
const locationList = (rule: Omit<Rule<LocationListInput>, 'kind'>) =>
  def<LocationListInput>('locationList', rule);
const group = (rule: Omit<Rule<FloodlightGroupInput>, 'kind'>) =>
  def<FloodlightGroupInput>('floodlightGroup', rule);
const conversion = (rule: Omit<Rule<FloodlightConversionInput>, 'kind'>) =>
  def<FloodlightConversionInput>('floodlightConversion', rule);

const PLATFORMS = ['WEB', 'MOBILE_APP', 'CONNECTED_TV'] as const;
const FORMATS = ['GOOGLE_TAG', 'IFRAME_TAG', 'IMAGE_TAG'] as const;

/** Whole days from 1 to 90 (FL-020). An empty field is left to the form's required check. */
function badWindow(value: Num | undefined): boolean {
  if (value === undefined) return false;
  const n = toNum(value);
  return (
    n === null ||
    !isWhole(value) ||
    n < RESOURCE_LIMITS.WINDOW_MIN_DAYS ||
    n > RESOURCE_LIMITS.WINDOW_MAX_DAYS
  );
}

const VARIABLE_KEY = /^u([1-9]\d?|100)$/;

// ---------------------------------------------------------------------------------------------
// Channels (CH)
// ---------------------------------------------------------------------------------------------

export const channelRules: readonly AnyRule[] = [
  channel({
    id: 'CH-001',
    severity: 'error',
    triggers: ['blur', 'save'],
    reads: ['name'],
    message: MSG.ENTER_VALUE,
    check: (c) => (isBlank(c.name) ? { path: 'name' } : null),
  }),
  channel({
    id: 'CH-002',
    severity: 'error',
    triggers: ['save'],
    reads: ['name'],
    message: MSG.MAX_CHARS,
    check: (c) =>
      c.name.length > LIMITS.NAME_MAX_255
        ? { path: 'name', params: { max: LIMITS.NAME_MAX_255 } }
        : null,
  }),
  channel({
    id: 'CH-003',
    severity: 'error',
    triggers: ['save'],
    reads: ['sites'],
    message: 'Enter a valid URL or app ID.',
    check: (c) => {
      const { invalidLines } = parseSites(c.sites.join('\n'));
      return invalidLines.length
        ? invalidLines.map((l) => ({ path: `sites[${l.line - 1}]`, params: { line: l.line } }))
        : null;
    },
  }),
  channel({
    id: 'CH-004',
    severity: 'error',
    triggers: ['blur', 'save'],
    reads: ['sites'],
    message: 'Use 10,000 entries or fewer.',
    check: (c) =>
      c.sites.filter((s) => s.trim() !== '').length > RESOURCE_LIMITS.CHANNEL_SITES_MAX
        ? { path: 'sites' }
        : null,
  }),
  channel({
    id: 'CH-005',
    severity: 'error',
    triggers: [],
    reads: ['name', 'sites'],
    message: null,
    check: () => null,
  }),
  channel({
    id: 'CH-006',
    severity: 'info',
    triggers: [],
    reads: ['name', 'sites'],
    // The unsaved-changes dialog (MSG.CHANNEL_UNSAVED) is a UI behaviour, so the rule documents it only.
    message: null,
    check: () => null,
  }),
  channel({
    id: 'CH-007',
    severity: 'info',
    triggers: ['save'],
    reads: ['sites'],
    message: null,
    check: () => null,
  }),
  channel({
    id: 'CH-008',
    severity: 'warning',
    triggers: ['save'],
    reads: ['usedByLineItems'],
    message: '{n} line items use this channel.',
    check: (c) =>
      (c.usedByLineItems ?? 0) > 0 ? { path: '*', params: { n: c.usedByLineItems! } } : null,
  }),
];

// ---------------------------------------------------------------------------------------------
// Negative keyword lists (KW)
// ---------------------------------------------------------------------------------------------

export const keywordListRules: readonly AnyRule[] = [
  keywordList({
    id: 'KW-001',
    severity: 'error',
    triggers: ['blur', 'save'],
    reads: ['name'],
    message: MSG.ENTER_VALUE,
    check: (k) => (isBlank(k.name) ? { path: 'name' } : null),
  }),
  keywordList({
    id: 'KW-002',
    severity: 'error',
    triggers: ['save'],
    reads: ['keywords'],
    message: MSG.NEG_KW_LIMIT,
    check: (k) =>
      parseKeywords(k.keywords).keywords.length > RESOURCE_LIMITS.KEYWORDS_MAX
        ? { path: 'keywords' }
        : null,
  }),
  keywordList({
    id: 'KW-003',
    severity: 'info',
    triggers: ['blur'],
    reads: ['keywords'],
    message: null,
    check: () => null,
  }),
  keywordList({
    id: 'KW-004',
    severity: 'error',
    triggers: ['blur', 'save'],
    reads: ['keywords'],
    message: MSG.MAX_CHARS,
    check: (k) => {
      const { tooLong } = parseKeywords(k.keywords);
      return tooLong.length
        ? tooLong.map((t) => ({
            path: `keywords[${t.index}]`,
            params: { max: RESOURCE_LIMITS.KEYWORD_LENGTH_MAX },
          }))
        : null;
    },
  }),
  keywordList({
    id: 'KW-005',
    severity: 'warning',
    triggers: ['save'],
    reads: ['usedByLineItems'],
    message: '{n} line items use this list.',
    check: (k) =>
      (k.usedByLineItems ?? 0) > 0 ? { path: '*', params: { n: k.usedByLineItems! } } : null,
  }),
];

// ---------------------------------------------------------------------------------------------
// Location lists (LOC)
// ---------------------------------------------------------------------------------------------

export const locationListRules: readonly AnyRule[] = [
  locationList({
    id: 'LOC-001',
    severity: 'error',
    triggers: ['blur', 'save'],
    reads: ['name'],
    message: MSG.ENTER_VALUE,
    check: (l) => (isBlank(l.name) ? { path: 'name' } : null),
  }),
  locationList({
    id: 'LOC-002',
    severity: 'error',
    triggers: ['save'],
    reads: ['type'],
    message: MSG.SELECTION_REQUIRED,
    check: (l) => {
      const valid = l.type === 'REGIONAL' || l.type === 'PROXIMITY';
      const changed = l.storedType != null && l.type !== l.storedType;
      return !valid || changed ? { path: 'type' } : null;
    },
  }),
  locationList({
    id: 'LOC-003',
    severity: 'error',
    triggers: ['save'],
    reads: ['entries'],
    message: MSG.ENTER_VALUE,
    check: (l) => (l.entries.every((e) => e.trim() === '') ? { path: 'entries' } : null),
  }),
  locationList({
    id: 'LOC-004',
    severity: 'error',
    triggers: ['save'],
    reads: ['entries', 'type'],
    message: "Line {n} isn't a valid {kind}.",
    appliesTo: (l) => l.type === 'REGIONAL' || l.type === 'PROXIMITY',
    check: (l) => {
      const { unresolved } = resolveLocationEntries(
        l.type as 'REGIONAL' | 'PROXIMITY',
        l.entries.join('\n'),
        l.geoOptions ?? [],
      );
      const kind =
        l.type === 'REGIONAL' ? 'postal code or DMA region' : 'street address or lat,long pair';
      return unresolved.length
        ? unresolved.map((u) => ({
            path: `entries[${u.line - 1}]`,
            params: { n: u.line, kind },
          }))
        : null;
    },
  }),
  locationList({
    id: 'LOC-005',
    severity: 'error',
    triggers: ['blur', 'save'],
    reads: ['entries'],
    message: 'Use {max} locations or fewer.',
    check: (l) =>
      l.entries.filter((e) => e.trim() !== '').length > RESOURCE_LIMITS.LOCATION_ENTRIES_MAX
        ? {
            path: 'entries',
            params: { max: RESOURCE_LIMITS.LOCATION_ENTRIES_MAX.toLocaleString('en-US') },
          }
        : null,
  }),
];

// ---------------------------------------------------------------------------------------------
// Floodlight group (FL-001, FL-02x) and conversions (FL-01x, FL-03x)
// ---------------------------------------------------------------------------------------------

export const floodlightRules: readonly AnyRule[] = [
  group({
    id: 'FL-001',
    severity: 'error',
    triggers: ['blur', 'save'],
    reads: ['name'],
    message: MSG.ENTER_VALUE,
    check: (g) => (isBlank(g.name) ? { path: 'name' } : null),
  }),
  group({
    id: 'FL-020',
    severity: 'error',
    triggers: ['blur', 'save'],
    reads: ['clickDays', 'impressionDays'],
    message: 'Enter a number between 1 and 90.',
    check: (g) => {
      const out = [];
      if (badWindow(g.clickDays)) out.push({ path: 'attribution.clickDays' });
      if (badWindow(g.impressionDays)) out.push({ path: 'attribution.impressionDays' });
      return out.length ? out : null;
    },
  }),
  group({
    id: 'FL-021',
    severity: 'error',
    triggers: ['blur', 'save'],
    reads: ['viewableImpressionPct'],
    message: MSG.PCT_RANGE,
    check: (g) => {
      if (g.viewableImpressionPct === undefined) return null;
      const n = toNum(g.viewableImpressionPct);
      return n === null || n < 0 || n > 100 ? { path: 'viewableImpressionPct' } : null;
    },
  }),
  group({
    id: 'FL-022',
    severity: 'error',
    triggers: ['save'],
    reads: ['variableKeys'],
    message: 'Variable names run from u1 to u100.',
    check: (g) => {
      const bad = (g.variableKeys ?? [])
        .map((key, i) => ({ key, i }))
        .filter(({ key }) => !VARIABLE_KEY.test(key));
      return bad.length ? bad.map(({ i }) => ({ path: `customVariables[${i}]` })) : null;
    },
  }),
  group({
    id: 'FL-023',
    severity: 'info',
    triggers: [],
    reads: ['name'],
    message: null,
    check: () => null,
  }),
];

export const floodlightConversionRules: readonly AnyRule[] = [
  conversion({
    id: 'FL-010',
    severity: 'error',
    triggers: ['save'],
    reads: ['platform'],
    message: MSG.SELECTION_REQUIRED,
    check: (c) => (c.platform && PLATFORMS.includes(c.platform) ? null : { path: 'platform' }),
  }),
  conversion({
    id: 'FL-011',
    severity: 'error',
    triggers: ['blur', 'save'],
    reads: ['name'],
    message: MSG.ENTER_VALUE,
    check: (c) => (isBlank(c.name) ? { path: 'name' } : null),
  }),
  conversion({
    id: 'FL-012',
    severity: 'error',
    triggers: ['save'],
    reads: ['format'],
    message: MSG.SELECTION_REQUIRED,
    check: (c) => (c.format && FORMATS.includes(c.format) ? null : { path: 'format' }),
  }),
  conversion({
    id: 'FL-013',
    severity: 'error',
    triggers: ['save'],
    reads: ['type'],
    message: MSG.SELECTION_REQUIRED,
    check: (c) => (c.type === 'COUNTER' || c.type === 'SALE' ? null : { path: 'type' }),
  }),
  conversion({
    id: 'FL-014',
    severity: 'error',
    triggers: ['cross', 'save'],
    reads: ['type', 'countingMethod'],
    message: "This counting method isn't available for the selected type.",
    appliesTo: (c) => c.type === 'COUNTER' || c.type === 'SALE',
    check: (c) =>
      c.countingMethod === null ||
      !(COUNTING_METHODS_BY_ACTIVITY[c.type!] as readonly string[]).includes(c.countingMethod)
        ? { path: 'countingMethod' }
        : null,
  }),
  conversion({
    id: 'FL-015',
    severity: 'error',
    triggers: ['cross', 'save'],
    reads: ['valueBasedBidding'],
    message: 'Turn on Floodlight optimization for YouTube first.',
    check: (c, ctx) =>
      c.valueBasedBidding && !ctx.advertiser.demandGenFloodlightOptimization
        ? { path: 'valueBasedBidding' }
        : null,
  }),
  conversion({
    id: 'FL-016',
    severity: 'info',
    triggers: ['cross'],
    reads: ['remarketing'],
    message: 'The first-party list can take up to an hour to fill.',
    check: (c) => (c.remarketing ? { path: 'remarketing' } : null),
  }),
  conversion({
    id: 'FL-017',
    severity: 'error',
    triggers: ['save'],
    reads: ['status'],
    message: MSG.CHOOSE_STATUS,
    check: (c) => (c.status === 'ACTIVE' || c.status === 'ARCHIVED' ? null : { path: 'status' }),
  }),
  conversion({
    id: 'FL-030',
    severity: 'error',
    triggers: ['save'],
    reads: ['platform', 'appId', 'ctvAppId'],
    message: 'Select an app',
    appliesTo: (c) => c.platform === 'MOBILE_APP' || c.platform === 'CONNECTED_TV',
    check: (c) => {
      const id = c.platform === 'MOBILE_APP' ? c.appId : c.ctvAppId;
      return isBlank(id) ? { path: c.platform === 'MOBILE_APP' ? 'appId' : 'ctvAppId' } : null;
    },
  }),
  conversion({
    id: 'FL-031',
    severity: 'error',
    triggers: ['blur', 'save'],
    reads: ['platform', 'conversionEventName'],
    message: MSG.ENTER_VALUE,
    appliesTo: (c) => c.platform === 'MOBILE_APP' || c.platform === 'CONNECTED_TV',
    check: (c) => (isBlank(c.conversionEventName) ? { path: 'conversionEventName' } : null),
  }),
  conversion({
    id: 'FL-032',
    severity: 'error',
    triggers: ['save'],
    reads: ['platform', 'format', 'type'],
    message: MSG.LOCKED_AFTER_CREATE,
    appliesTo: (_c, ctx) => ctx.mode === 'edit',
    check: (c) => {
      if (!c.stored) return null;
      const out = [];
      if (c.platform !== c.stored.platform) out.push({ path: 'platform' });
      if (c.format !== c.stored.format) out.push({ path: 'format' });
      if (c.type !== c.stored.type) out.push({ path: 'type' });
      return out.length ? out : null;
    },
  }),
  conversion({
    id: 'FL-033',
    severity: 'warning',
    triggers: ['save'],
    reads: ['status', 'usedByLineItems'],
    message: '{n} line items count this conversion.',
    check: (c) =>
      c.status === 'ARCHIVED' && (c.usedByLineItems ?? 0) > 0
        ? { path: 'status', params: { n: c.usedByLineItems! } }
        : null,
  }),
];

export const customBiddingRules: readonly AnyRule[] = [];
