// Pure mapping helpers from database rows to the engine World (engine.md 1.1, 2.3). No Prisma import, so the unit
// project can test them. loadWorld.ts reads the rows and calls these.
import type { Params } from '../params/schema';
import type { Device, Environment } from '../types';
import type {
  AlertCode,
  AlertPrefs,
  ApprovalState,
  FloodlightActivity,
  FloodlightCategory,
  FrequencyCap,
  FreqUnit,
  IoKpi,
  ListSelection,
  PartnerCost,
  TargetingSpec,
} from '../world';

export interface TargetRow {
  dimension: string;
  mode: 'INCLUDE' | 'EXCLUDE';
  optionId: string | null;
  refType: string | null;
  refId: string | null;
  groupIndex: number;
  config: unknown;
}

export interface OptionInfo {
  code: string;
  name: string;
}

const DAY_INDEX: Record<string, number> = {
  MON: 0,
  TUE: 1,
  WED: 2,
  THU: 3,
  FRI: 4,
  SAT: 5,
  SUN: 6,
};

/** Offset of an IANA zone from UTC in minutes at `atMs` (a fixed offset per World, engine.md 1.2). */
export function tzOffsetMinutes(timeZone: string, atMs: number): number {
  const zone = timeZone === 'Asia/Calcutta' ? 'Asia/Kolkata' : timeZone;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(new Date(atMs));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asUtc = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour'),
      get('minute'),
      get('second'),
    );
    return Math.round((asUtc - Math.floor(atMs / 1000) * 1000) / 60_000);
  } catch {
    return 0;
  }
}

/** Market key in params.markets for an advertiser currency (INR gives IN, SGD gives SG). */
export function countryForCurrency(params: Params, currency: string): string {
  for (const [key, m] of Object.entries(params.markets)) if (m.currency === currency) return key;
  return 'IN';
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function num(x: unknown, fallback = 0): number {
  if (x === null || x === undefined) return fallback;
  const n = typeof x === 'number' ? x : Number(x); // Decimal and bigint convert through valueOf
  return Number.isFinite(n) ? n : fallback;
}

const UNIT: Record<string, FreqUnit> = {
  MINUTE: 'MINUTE',
  HOUR: 'HOUR',
  DAY: 'DAY',
  WEEK: 'WEEK',
  MONTH: 'MONTH',
};

export function mapFrequency(r: {
  mode: string;
  maxExposures: number | null;
  unit: string | null;
  unitCount: number | null;
}): FrequencyCap {
  if (r.mode === 'LIMITED' && r.maxExposures && r.unit) {
    return {
      mode: 'LIMITED',
      maxExposures: r.maxExposures,
      unit: UNIT[r.unit] ?? 'DAY',
      unitCount: r.unitCount ?? 1,
    };
  }
  if (r.mode === 'UNLIMITED') return { mode: 'UNLIMITED' };
  return { mode: 'INHERIT' };
}

const KPI_KIND: Record<string, IoKpi['kind']> = {
  CPM: 'CPM',
  CPC: 'CPC',
  CTR: 'CTR',
  CPA: 'CPA',
  VCPM: 'VCPM',
  VIEWABLE_PCT: 'VIEWABILITY',
  CPV: 'CPV',
  VTR: 'VTR',
  CLICK_CVR: 'CVR',
  IMPR_CVR: 'CVR',
};

export function mapKpi(kpi: string | null, value: unknown): IoKpi | undefined {
  if (!kpi) return undefined;
  const kind = KPI_KIND[kpi];
  const v = num(value, 0);
  if (!kind || v <= 0) return undefined;
  return { kind, value: v };
}

export function mapPartnerCost(r: {
  kind: string;
  slot: number;
  amount: unknown;
  percentage: unknown;
  invoiced: boolean;
}): PartnerCost | null {
  const slot = r.slot === 2 ? 2 : 1;
  if (r.kind === 'CPM_FEE') {
    return { kind: 'CPM_FEE', slot, amount: num(r.amount), invoiced: r.invoiced };
  }
  if (r.kind === 'MEDIA_FEE') {
    return { kind: 'MEDIA_FEE', slot, amount: num(r.percentage) / 100, invoiced: r.invoiced };
  }
  return null;
}

export function creativeType(kind: string): 'display' | 'native' | 'video' | 'audio' {
  switch (kind) {
    case 'NATIVE_SITE':
      return 'native';
    case 'NATIVE_VIDEO':
    case 'VIDEO_FILE':
    case 'YOUTUBE_VIDEO':
    case 'THIRD_PARTY_VIDEO':
      return 'video';
    case 'AUDIO_FILE':
    case 'THIRD_PARTY_AUDIO':
      return 'audio';
    default:
      return 'display';
  }
}

/** Worst state wins: one disapproval blocks, then pending (engine.md 3.2 creative stage). */
export function foldApproval(states: readonly string[]): ApprovalState {
  if (states.includes('DISAPPROVED')) return 'DISAPPROVED';
  if (states.includes('PENDING')) return 'PENDING';
  return states.length > 0 ? 'APPROVED' : 'PENDING';
}

const FL_CATEGORY: Record<string, FloodlightCategory> = {
  PURCHASE: 'purchase',
  ADD_TO_CART: 'add_to_cart',
  BEGIN_CHECKOUT: 'begin_checkout',
  SUBSCRIBE_PAID: 'subscribe',
  CONTACT: 'contact',
  SUBMIT_LEAD_FORM: 'submit_lead_form',
  BOOK_APPOINTMENT: 'book_appointment',
  SIGN_UP: 'sign_up',
  REQUEST_QUOTE: 'request_quote',
  GET_DIRECTIONS: 'get_directions',
  OUTBOUND_CLICK: 'outbound_click',
  QUALIFIED_LEAD: 'qualified_lead',
  CONVERTED_LEAD: 'converted_lead',
  PAGE_VIEW: 'page_view',
};
const FL_COUNTING: Record<string, FloodlightActivity['countingMethod']> = {
  STANDARD: 'standard',
  UNIQUE: 'unique',
  PER_SESSION: 'perSession',
  TRANSACTIONS: 'transactions',
  ITEMS_SOLD: 'itemsSold',
};

export function mapActivity(r: {
  id: string;
  name: string;
  status: string;
  type: string;
  countingMethod: string;
  category: string | null;
  remarketingEnabled: boolean;
}): FloodlightActivity {
  return {
    id: r.id,
    name: r.name,
    type: r.type === 'SALE' ? 'sale' : 'counter',
    countingMethod: FL_COUNTING[r.countingMethod] ?? 'standard',
    category: (r.category ? FL_CATEGORY[r.category] : undefined) ?? 'page_view',
    tagStatus: r.status === 'ACTIVE' ? 'active' : 'inactive',
    remarketing: r.remarketingEnabled,
  };
}

export function mapAttribution(
  id: string | null,
): 'last_click' | 'linear' | 'time_decay' | 'position_based' | 'data_driven' {
  switch ((id ?? '').toUpperCase()) {
    case 'LINEAR':
      return 'linear';
    case 'TIME_DECAY':
      return 'time_decay';
    case 'POSITION_BASED':
      return 'position_based';
    case 'DATA_DRIVEN':
      return 'data_driven';
    default:
      return 'last_click';
  }
}

export function mapInventoryQuality(q: string): 'DIRECT_ONLY' | 'DIRECT_AND_RESELLERS' | 'ALL' {
  if (q === 'AUTHORIZED_DIRECT_SELLERS') return 'DIRECT_ONLY';
  if (q === 'AUTHORIZED_AND_NON_PARTICIPATING') return 'ALL';
  return 'DIRECT_AND_RESELLERS';
}

export function mapAudienceType(
  t: string,
): 'affinity' | 'in_market' | 'custom' | 'first_party' | 'lookalike' | 'demographics' {
  switch (t) {
    case 'LOOKALIKE':
      return 'lookalike';
    case 'COMBINED':
    case 'CUSTOM_INTENT_YOUTUBE':
      return 'custom';
    case 'CUSTOM_AFFINITY':
      return 'affinity';
    case 'CUSTOM_INTENT_DISPLAY_VIDEO':
      return 'in_market';
    default:
      return 'first_party';
  }
}

// ---- alert preferences ----------------------------------------------------------------------------------------

const ALERT_CODES: Record<string, AlertCode[]> = {
  NO_SPEND: ['NO_SPEND_LI', 'NO_SPEND_IO'],
  UNDERPACING: ['UNDERPACING_IO'],
  UNDERPERFORMING: ['UNDERPERFORMING_IO'],
  LIMITED_AUDIENCE_SIZE: ['LIMITED_AUDIENCE_LI'],
  RESTRICTED_AUDIENCE_LIST: ['RESTRICTED_AUDIENCE_LIST_LI'],
  REJECTED_CREATIVE: ['CREATIVE_REJECTED'],
  RESTRICTED_CREATIVE: ['CREATIVE_RESTRICTED'],
  EXCEEDED_SPEND_THRESHOLD: ['SPEND_THRESHOLD'],
  CONFLICTING_SETTINGS: ['CONFLICT_IO', 'CONFLICT_LI'],
};

export function mapAlertPrefs(
  rows: {
    alertType: string;
    enabled: boolean;
    thresholdPct: number | null;
    thresholdAmount: unknown;
  }[],
): AlertPrefs {
  const enabled: Partial<Record<AlertCode, boolean>> = {};
  const prefs: AlertPrefs = { enabled };
  for (const r of rows) {
    for (const code of ALERT_CODES[r.alertType] ?? []) enabled[code] = r.enabled;
    if (r.alertType === 'UNDERPACING' && r.thresholdPct)
      prefs.underpacingThresholdPct = r.thresholdPct;
    if (r.alertType === 'EXCEEDED_SPEND_THRESHOLD' && r.enabled && num(r.thresholdAmount) > 0) {
      prefs.spendThreshold = num(r.thresholdAmount);
    }
  }
  return prefs;
}

/** Alert type and category of the Alert table for an engine alert code (RC-013; module 01 4.8). */
export function alertTypeOf(code: AlertCode): {
  type:
    | 'NO_SPEND'
    | 'UNDERPACING'
    | 'UNDERPERFORMING'
    | 'LIMITED_AUDIENCE_SIZE'
    | 'RESTRICTED_AUDIENCE_LIST'
    | 'REJECTED_CREATIVE'
    | 'RESTRICTED_CREATIVE'
    | 'EXCEEDED_SPEND_THRESHOLD'
    | 'CONFLICTING_SETTINGS';
  category: 'BUDGET' | 'CREATIVES' | 'PERFORMANCE' | 'TARGETING' | 'SETTINGS' | 'SPEND_THRESHOLD';
} {
  switch (code) {
    case 'NO_SPEND_LI':
    case 'NO_SPEND_IO':
      return { type: 'NO_SPEND', category: 'BUDGET' };
    case 'UNDERPACING_IO':
      return { type: 'UNDERPACING', category: 'BUDGET' };
    case 'UNDERPERFORMING_IO':
      return { type: 'UNDERPERFORMING', category: 'PERFORMANCE' };
    case 'LIMITED_AUDIENCE_LI':
      return { type: 'LIMITED_AUDIENCE_SIZE', category: 'TARGETING' };
    case 'RESTRICTED_AUDIENCE_LIST_LI':
      return { type: 'RESTRICTED_AUDIENCE_LIST', category: 'TARGETING' };
    case 'CREATIVE_REJECTED':
      return { type: 'REJECTED_CREATIVE', category: 'CREATIVES' };
    case 'CREATIVE_RESTRICTED':
      return { type: 'RESTRICTED_CREATIVE', category: 'CREATIVES' };
    case 'SPEND_THRESHOLD':
      return { type: 'EXCEEDED_SPEND_THRESHOLD', category: 'SPEND_THRESHOLD' };
    case 'CONFLICT_IO':
    case 'CONFLICT_LI':
      return { type: 'CONFLICTING_SETTINGS', category: 'SETTINGS' };
  }
}

// ---- targeting -------------------------------------------------------------------------------------------------

/** Table key for an option name: 'Chrome 120' with table keys chrome, safari gives 'chrome'; unknown gives 'other'. */
export function allocKey(table: Record<string, number>, name: string, code: string): string | null {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9+]+/g, '_')
      .replace(/^_|_$/g, '');
  const keys = Object.keys(table);
  for (const raw of [name, code]) {
    const n = norm(raw);
    const hit = keys.find(
      (k) => n === k || n.startsWith(`${k}_`) || n.replace(/_/g, '') === k.replace(/_/g, ''),
    );
    if (hit) return hit;
  }
  return keys.includes('other') ? 'other' : null;
}

function region(
  code: string,
  regions: string[],
  country: string,
): { region: string | null; city: boolean } {
  const parts = code.split('-');
  if (parts.length < 2) return { region: null, city: false };
  const state = `${parts[0]}-${parts[1]}`;
  const city = parts.length > 2;
  if (regions.includes(state)) return { region: state, city };
  if (regions.includes(`${country}-REST`)) return { region: `${country}-REST`, city };
  return { region: null, city };
}

const DEVICE_OF: Record<string, Device> = {
  COMPUTER: 'computer',
  SMARTPHONE: 'smartphone',
  TABLET: 'tablet',
  CONNECTED_TV: 'ctv',
};
const ALL_DEVICES: Device[] = ['computer', 'smartphone', 'tablet', 'ctv'];

export interface TargetCtx {
  country: string;
  params: Params;
  options: Map<string, OptionInfo>;
  /** Engine exchange key for a database exchange id. */
  exchangeKey: (exchangeId: string) => string | undefined;
}

/** First string among the candidates, else ''. */
function str(...vs: unknown[]): string {
  for (const v of vs) if (typeof v === 'string') return v;
  return '';
}

function cfgOf(c: unknown): Record<string, unknown> {
  return c && typeof c === 'object' && !Array.isArray(c) ? (c as Record<string, unknown>) : {};
}

export function mapTargeting(rows: readonly TargetRow[], ctx: TargetCtx): TargetingSpec {
  const spec: TargetingSpec = {};
  const regions = Object.keys(
    ctx.params.markets[ctx.country]?.regionShare ?? { [`${ctx.country}-ALL`]: 1 },
  );
  const alloc = ctx.params.targeting.allocation;
  const opt = (r: TargetRow) => (r.optionId ? ctx.options.get(r.optionId) : undefined);
  const list = (
    key: 'deviceDetail' | 'browser' | 'connection' | 'carrier' | 'position',
    table: Record<string, number>,
    r: TargetRow,
  ) => {
    const o = opt(r);
    if (!o) return;
    const k = allocKey(table, o.name, o.code);
    if (!k) return;
    const sel: ListSelection = (spec[key] ??= {});
    const side = r.mode === 'INCLUDE' ? 'include' : 'exclude';
    (sel[side] ??= []).push(k);
  };

  for (const r of rows) {
    const o = opt(r);
    const cfg = cfgOf(r.config);
    switch (r.dimension) {
      case 'GEOGRAPHY': {
        if (!o) break;
        const g = region(o.code, regions, ctx.country);
        const geo = (spec.geo ??= {});
        if (g.region === null) break; // country level, or a single-region market: no restriction
        if (r.mode === 'EXCLUDE') {
          if (!g.city) (geo.excludeRegions ??= []).push(g.region);
        } else if (g.city) {
          (geo.pincodes ??= []).push({ region: g.region, count: 10 });
        } else {
          (geo.includeRegions ??= []).push(g.region);
        }
        break;
      }
      case 'LANGUAGE':
        if (o && r.mode === 'INCLUDE') (spec.languages ??= []).push(o.code);
        break;
      case 'DEVICE_TYPE': {
        const d = o ? DEVICE_OF[o.code] : undefined;
        if (!d) break;
        if (r.mode === 'INCLUDE') (spec.devices ??= []).push(d);
        else spec.devices = (spec.devices ?? ALL_DEVICES).filter((x) => x !== d);
        break;
      }
      case 'ENVIRONMENT': {
        const e: Environment | undefined =
          o?.code === 'APP' ? 'app' : o?.code === 'WEB' ? 'web' : undefined;
        if (!e) break;
        if (r.mode === 'INCLUDE') (spec.environment ??= []).push(e);
        else
          spec.environment = (spec.environment ?? (['web', 'app'] as Environment[])).filter(
            (x) => x !== e,
          );
        break;
      }
      case 'DAY_TIME': {
        if (r.mode !== 'INCLUDE') break;
        const days = (Array.isArray(cfg.days) ? cfg.days : [])
          .map((d) => DAY_INDEX[String(d)])
          .filter((d): d is number => d !== undefined);
        const from = num(cfg.fromHour, 0);
        const to = num(cfg.toHour, 24);
        if (days.length > 0)
          (spec.daypart ??= { windows: [] }).windows.push({ days, startHour: from, endHour: to });
        break;
      }
      case 'VIEWABILITY': {
        const min = num(cfg.predictedViewabilityMin, 0) / 100;
        if (r.mode === 'INCLUDE' && min > 0)
          spec.viewabilityMin = Math.min(0.9, Math.max(0.5, min));
        break;
      }
      case 'AUDIENCE_LIST': {
        if (r.refType !== 'AUDIENCE' || !r.refId) break;
        const a = (spec.audiences ??= {});
        if (r.mode === 'EXCLUDE') (a.exclude ??= []).push(r.refId);
        else {
          const groups = (a.includeGroups ??= []);
          while (groups.length <= r.groupIndex) groups.push([]);
          (groups[r.groupIndex] as string[]).push(r.refId);
        }
        break;
      }
      case 'THIRD_PARTY_VERIFIER': {
        const provider = str(cfg.provider, o?.name).toLowerCase();
        const key =
          provider.includes('integral') || provider.includes('ias')
            ? 'ias'
            : provider.includes('scope3')
              ? 'scope3'
              : provider.includes('double') || provider.includes('dv')
                ? 'dv_abs'
                : null;
        if (key) (spec.verification ??= []).push(key);
        break;
      }
      case 'DEVICE_MAKE_MODEL':
      case 'OPERATING_SYSTEM':
        list('deviceDetail', alloc.deviceDetail, r);
        break;
      case 'BROWSER':
        list('browser', alloc.browser, r);
        break;
      case 'CONNECTION_SPEED':
        list('connection', alloc.connection, r);
        break;
      case 'CARRIER_ISP':
        list('carrier', alloc.carrier, r);
        break;
      case 'POSITION_ON_SCREEN':
        list('position', alloc.position, r);
        break;
      case 'CATEGORY': {
        if (!o) break;
        const k = allocKey(alloc.category, o.name, o.code);
        if (!k) break;
        const sel: ListSelection = (spec.categories ??= {});
        (sel[r.mode === 'INCLUDE' ? 'include' : 'exclude'] ??= []).push(k);
        break;
      }
      case 'KEYWORD':
        if (r.mode === 'INCLUDE') {
          const k = (spec.keywords ??= { includeCount: 0 });
          k.includeCount += Math.max(1, num(cfg.count, 1));
        }
        break;
      case 'NEGATIVE_KEYWORD_LIST': {
        const k = (spec.keywords ??= { includeCount: 0 });
        k.negativeCount = (k.negativeCount ?? 0) + Math.max(1, num(cfg.count, 1));
        break;
      }
      case 'APPS_AND_URLS': {
        const a = (spec.appUrl ??= {});
        const n = Math.max(1, num(cfg.count, 1));
        if (r.mode === 'INCLUDE') a.includeCount = (a.includeCount ?? 0) + n;
        else a.excludeCount = (a.excludeCount ?? 0) + n;
        break;
      }
      case 'BRAND_SUITABILITY': {
        const mode = str(cfg.mode, o?.code, 'standard').toLowerCase();
        const b = (spec.brandSuitability ??= {});
        b.mode = mode.includes('max') ? 'maximum' : mode.includes('limit') ? 'limited' : 'standard';
        break;
      }
      case 'DIGITAL_CONTENT_LABEL':
        if (r.mode === 'EXCLUDE') {
          const b = (spec.brandSuitability ??= {});
          b.excludedLabels = (b.excludedLabels ?? 0) + 1;
        }
        break;
      case 'SENSITIVE_CATEGORY':
        if (r.mode === 'EXCLUDE') {
          const b = (spec.brandSuitability ??= {});
          b.excludedCategories = (b.excludedCategories ?? 0) + 1;
        }
        break;
      case 'AGE':
      case 'GENDER':
      case 'PARENTAL_STATUS':
      case 'HOUSEHOLD_INCOME': {
        if (!o || r.mode !== 'INCLUDE') break;
        const table =
          r.dimension === 'AGE'
            ? alloc.age
            : r.dimension === 'GENDER'
              ? alloc.gender
              : r.dimension === 'PARENTAL_STATUS'
                ? alloc.parental
                : alloc.income;
        const k = allocKey(table, o.code, o.name);
        const dKey =
          r.dimension === 'AGE'
            ? 'age'
            : r.dimension === 'GENDER'
              ? 'gender'
              : r.dimension === 'PARENTAL_STATUS'
                ? 'parental'
                : 'income';
        if (k) ((spec.demographics ??= {})[dKey] ??= []).push(k);
        break;
      }
      case 'INVENTORY_SOURCE': {
        const key = r.refId ? ctx.exchangeKey(r.refId) : o ? ctx.exchangeKey(o.code) : undefined;
        if (key && r.mode === 'INCLUDE') (spec.exchanges ??= []).push(key);
        break;
      }
      default:
        break;
    }
  }
  // Remove empty containers so the compiled targeting treats the dimension as unrestricted.
  if (spec.geo && !spec.geo.includeRegions && !spec.geo.excludeRegions && !spec.geo.pincodes)
    delete spec.geo;
  if (spec.devices) spec.devices = [...new Set(spec.devices)].sort();
  if (spec.exchanges) spec.exchanges = [...new Set(spec.exchanges)].sort();
  return spec;
}
