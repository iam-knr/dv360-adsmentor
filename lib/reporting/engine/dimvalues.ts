// Dimension values (module 16 4.2 DimSource): entity attributes, stored slice keys, calendar parts and derived
// allocations, printed the way the files print them (dates YYYY/MM/DD, enums in title case).
import geography from '../../../data/reference/geography.json';
import type { ReportFieldDef } from '../catalogue';
import { allocationPrint, baseAllocation } from './allocations';
import type { StoredKind } from './plan';
import type { LineItemInfo, SegmentInfo, World } from './world';

export type DimValue = string | number | null;

const pairs = (rows: string[][]): [string, string][] => rows.map((r) => [r[0] ?? '', r[1] ?? '']);
const COUNTRY = new Map<string, string>(pairs(geography.countries));
const STATE = new Map<string, string>(pairs(geography.inStates));

const SPECIAL: Record<string, string> = {
  COMPUTER: 'Computer',
  SMARTPHONE: 'Smart Phone',
  TABLET: 'Tablet',
  CONNECTED_TV: 'Connected TV',
  WEB: 'Web',
  APP: 'App',
  YT_VIDEO: 'YouTube Video',
  YT_AUDIO: 'YouTube Audio',
  YT_ON_CTV: 'YouTube on CTV',
  MOBILE_APP_INSTALL: 'Mobile App Install',
  ADS_IN_MOBILE_APPS: 'Ads in Mobile Apps',
  DOOH_DISPLAY: 'DOOH Display',
  DOOH_VIDEO: 'DOOH Video',
  CTV: 'CTV',
  SCHEDULED_FOR_DELETION: 'Scheduled for deletion',
  AUTOMATED: 'Automated',
  FIXED: 'Fixed',
};

export function pretty(value: string): string {
  const s = SPECIAL[value];
  if (s) return s;
  if (/^[A-Z0-9_]+$/.test(value)) {
    const words = value.toLowerCase().split('_');
    return words.map((w, i) => (i === 0 ? w[0]?.toUpperCase() + w.slice(1) : w)).join(' ');
  }
  return value;
}

export const slashDate = (iso: string | null): string => (iso ? iso.replace(/-/g, '/') : '');

export interface CellCtx {
  world: World;
  li: LineItemInfo;
  /** YYYY-MM-DD in the report time zone. */
  date: string;
  /** 0..23 in the report time zone, hourly reports only. */
  hour?: number;
  /** Stored slice keys of the cell, by kind. */
  keys: Partial<Record<StoredKind, string>>;
  /** Derived allocation labels by base allocation id. */
  derived: Record<string, string>;
  segment: SegmentInfo | null;
}

export function segmentAt(world: World, ioId: string, date: string): SegmentInfo | null {
  const segs = world.ios.get(ioId)?.segments ?? [];
  const hit = segs.find((s) => s.start <= date && date <= s.end);
  if (hit) return hit;
  // before the first or after the last segment: the nearest one, so budget fields do not go blank
  if (segs.length === 0) return null;
  const first = segs[0] as SegmentInfo;
  const last = segs[segs.length - 1] as SegmentInfo;
  return date < first.start ? first : last;
}

function entityValue(path: string, c: CellCtx): DimValue {
  const { world: w, li } = c;
  const adv = w.advertisers.get(li.advertiserId);
  const camp = w.campaigns.get(li.campaignId);
  const io = w.ios.get(li.ioId);
  switch (path) {
    case 'partner.name':
      return w.partner.name;
    case 'partner.id':
      return w.partner.publicId;
    case 'partner.currency':
      return w.partner.currencyCode;
    case 'partner.status':
      return pretty(w.partner.status);
    case 'advertiser.name':
      return adv?.name ?? '';
    case 'advertiser.id':
      return adv?.publicId ?? '';
    case 'advertiser.currency':
      return adv?.currencyCode ?? '';
    case 'advertiser.status':
      return adv ? pretty(adv.status) : '';
    case 'advertiser.timeZone':
      return adv?.timeZone ?? '';
    case 'advertiser.integrationCode':
      return adv?.integrationCode ?? '';
    case 'campaign.name':
      return camp?.name ?? '';
    case 'campaign.id':
      return camp?.publicId ?? '';
    case 'campaign.status':
      return camp ? pretty(camp.status) : '';
    case 'campaign.goal':
      return camp?.goal ? pretty(camp.goal) : '';
    case 'campaign.startDate':
      return slashDate(camp?.start ?? null);
    case 'campaign.endDate':
      return slashDate(camp?.end ?? null);
    case 'io.name':
      return io?.name ?? '';
    case 'io.id':
      return io?.publicId ?? '';
    case 'io.status':
      return io ? pretty(io.status) : '';
    case 'io.goalType':
      return io?.kpi ? pretty(io.kpi) : '';
    case 'io.goalValue':
      return io?.kpiValue ?? null;
    case 'io.integrationCode':
      return io?.integrationCode ?? '';
    case 'io.dailyFrequency':
      return io?.dailyFrequency ?? '';
    case 'io.startDate':
      return slashDate(io?.segments[0]?.start ?? null);
    case 'io.endDate':
      return slashDate(io?.segments[io.segments.length - 1]?.end ?? null);
    case 'lineItem.name':
      return li.name;
    case 'lineItem.id':
      return li.publicId;
    case 'lineItem.type':
      return pretty(li.type);
    case 'lineItem.status':
      return pretty(li.status);
    case 'lineItem.budget':
      return li.budget;
    case 'lineItem.startDate':
      return slashDate(li.start);
    case 'lineItem.endDate':
      return slashDate(li.end);
    case 'lineItem.integrationCode':
      return li.integrationCode ?? '';
    case 'lineItem.dailyFrequency':
      return li.dailyFrequency;
    case 'lineItem.lifetimeFrequency':
      return li.lifetimeFrequency;
    case 'lineItem.bidStrategyType':
      return pretty(li.bidStrategyType);
    case 'lineItem.optimizedTargeting':
      return li.optimizedTargeting ? 'Yes' : 'No';
    case 'lineItem.pacingPct':
      return null;
    case 'segment.name':
      return c.segment?.name ?? '';
    case 'segment.budget':
      return c.segment?.amount ?? null;
    case 'segment.startDate':
      return slashDate(c.segment?.start ?? null);
    case 'segment.endDate':
      return slashDate(c.segment?.end ?? null);
    case 'segment.type':
      return c.segment ? 'Budget segment' : '';
  }
  return '';
}

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function isoWeekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // weeks start on Sunday (date presets)
  return d.toISOString().slice(0, 10);
}

function calendar(part: string, date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  switch (part) {
    case 'dayOfWeek':
      return DOW[d.getUTCDay()] as string;
    case 'week':
      return slashDate(isoWeekStart(date));
    case 'month':
      return MONTHS[d.getUTCMonth()] as string;
    case 'monthYear':
      return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    case 'quarter':
      return `${d.getUTCFullYear()}/Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
    case 'year':
      return String(d.getUTCFullYear());
  }
  return '';
}

function sliceValue(kind: string, part: string | undefined, c: CellCtx): DimValue {
  const key = c.keys[kind as StoredKind] ?? '';
  const w = c.world;
  switch (kind) {
    case 'exchange': {
      const ex = w.exchangesById.get(key) ?? w.exchangesByCode.get(key);
      if (part === 'id') return ex?.id ?? key;
      if (part === 'code') return ex?.code ?? key;
      if (part === 'public') return 'Yes';
      return ex?.name ?? (key || '');
    }
    case 'device':
      if (part === 'platform')
        return key === 'CONNECTED_TV'
          ? 'CTV'
          : key === 'COMPUTER'
            ? 'Desktop'
            : key
              ? 'Mobile'
              : '';
      return key ? pretty(key) : '';
    case 'environment':
      return key ? pretty(key) : '';
    case 'format':
      if (part === 'clickType') return key ? 'Click' : '';
      return key ? pretty(key) : '';
    case 'region': {
      const [country = '', st = ''] = key.split('-');
      if (part === 'country') return COUNTRY.get(country) ?? country;
      if (part === 'id') return key;
      return STATE.get(st) ?? (st === 'ALL' || !st ? 'All regions' : st);
    }
    case 'creative': {
      const cr = w.creatives.get(key);
      switch (part) {
        case 'id':
          return cr?.publicId ?? key;
        case 'size':
          return cr && cr.width ? `${cr.width}x${cr.height}` : '';
        case 'type':
          return cr ? pretty(cr.kind) : '';
        case 'status':
          return cr ? pretty(cr.status) : '';
        case 'source':
          return cr ? pretty(cr.source) : '';
        case 'width':
          return cr?.width ?? null;
        case 'height':
          return cr?.height ?? null;
        case 'integrationCode':
          return cr?.integrationCode ?? '';
        case 'companionName':
          return cr?.companionId ? (w.creatives.get(cr.companionId)?.name ?? '') : '';
        case 'companionId':
          return cr?.companionId ? (w.creatives.get(cr.companionId)?.publicId ?? '') : '';
        case 'companionSize': {
          const co = cr?.companionId ? w.creatives.get(cr.companionId) : undefined;
          return co ? `${co.width}x${co.height}` : '';
        }
        default:
          return cr?.name ?? (key === '(none)' ? '' : key);
      }
    }
    case 'activity': {
      const a = w.activities.get(key);
      if (part === 'id') return a?.publicId ?? key;
      if (part === 'name') return a?.name ?? key;
      return key ? 'Floodlight' : '';
    }
    case 'adGroup': {
      const g = w.adGroups.get(key);
      return part === 'id' ? (g?.id ?? key) : (g?.name ?? key);
    }
    default:
      return key;
  }
}

/** The printed value of one dimension for one cell. */
export function dimValue(field: ReportFieldDef, c: CellCtx): DimValue {
  const s = field.source;
  switch (s.t) {
    case 'ENTITY':
      return entityValue(s.path, c);
    case 'SLICE':
      if (s.kind === 'date') return slashDate(c.date);
      if (s.kind === 'hour') {
        if (s.part === 'dateHour')
          return `${slashDate(c.date)} ${String(c.hour ?? 0).padStart(2, '0')}:00`;
        return c.hour ?? 0;
      }
      return sliceValue(s.kind, s.part, c);
    case 'DERIVED': {
      const label = c.derived[baseAllocation(s.allocation)];
      return label === undefined ? '' : allocationPrint(s.allocation, label);
    }
    case 'CALENDAR':
      return calendar(s.part, c.date);
    case 'CONST':
      return '';
    default:
      return '';
  }
}
