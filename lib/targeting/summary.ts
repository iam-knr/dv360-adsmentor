// Row summary text per dimension (module 10 2.1, Δ-10-10: shared client and server code).
import type { MatrixDimension } from '@/lib/validation/constants/targeting-availability';
import {
  BROWSERS,
  CATEGORY_OPTIONS,
  CONNECTION_SPEEDS,
  DAYS,
  DEVICE_TYPES,
  GENDERS,
  HOUSEHOLD_INCOMES,
  LANGUAGES,
  PARENTAL_STATUSES,
  POSITION_IN_CONTENT,
  POSITION_NATIVE,
  POSITION_ON_SCREEN,
  POSITION_VIDEO,
  VIDEO_PLAYER_SIZES,
  labelOf,
  type OptionDef,
} from './options';
import type { DaySegment, Sel, TargetingCriteria } from './types';

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

function selText(sels: Sel[], options: readonly OptionDef[] = []): string {
  const name = (s: Sel) => s.label ?? labelOf(options, s.id);
  const inc = sels.filter((s) => s.mode === 'INCLUDE').map(name);
  const exc = sels.filter((s) => s.mode === 'EXCLUDE').map(name);
  const parts = [];
  if (inc.length) parts.push(`Include: ${inc.join(', ')}`);
  if (exc.length) parts.push(`Exclude: ${exc.join(', ')}`);
  return parts.join('; ') || 'None selected';
}

/** `9:00 AM` from `09:00`; `24:00` reads as `12:00 AM`. */
export function clock(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  const hour = h % 24;
  return `${hour % 12 === 0 ? 12 : hour % 12}:${String(m).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

const SHORT: Record<string, string> = {
  MON: 'Mon',
  TUE: 'Tue',
  WED: 'Wed',
  THU: 'Thu',
  FRI: 'Fri',
  SAT: 'Sat',
  SUN: 'Sun',
};

/** Groups segments with the same hours into day ranges: "Mon-Fri 9:00 AM-5:00 PM". */
export function dayTimeText(segments: DaySegment[], tz: 'LOCAL' | 'ADVERTISER'): string {
  const byHours = new Map<string, number[]>();
  for (const s of segments) {
    const key = `${s.from}-${s.to}`;
    byHours.set(key, [...(byHours.get(key) ?? []), DAYS.indexOf(s.day)]);
  }
  const parts = [...byHours.entries()].map(([hours, days]) => {
    const sorted = [...new Set(days)].sort((a, b) => a - b);
    const runs: string[] = [];
    for (let i = 0; i < sorted.length;) {
      let j = i;
      while (j + 1 < sorted.length && sorted[j + 1] === sorted[j]! + 1) j++;
      const a = SHORT[DAYS[sorted[i]!]!]!;
      runs.push(j > i ? `${a}-${SHORT[DAYS[sorted[j]!]!]}` : a);
      i = j + 1;
    }
    const [from = '', to = ''] = hours.split('-');
    return `${runs.join(', ')} ${clock(from)}-${clock(to)}`;
  });
  const zone = tz === 'LOCAL' ? 'Local time zone' : 'Advertiser time zone';
  return parts.length ? `${parts.join('; ')} (${zone})` : 'No times selected';
}

function demographicsText(d: NonNullable<TargetingCriteria['demographics']>): string {
  const all = (picked: string[], options: OptionDef[]) =>
    picked.length === options.length
      ? 'All'
      : picked.map((c) => labelOf(options, c)).join(', ') || 'None';
  const max = d.ageRange[1] >= 65 ? '65+' : String(d.ageRange[1]);
  const age = `${d.ageRange[0]}-${max}${d.ageUnknown ? ', Unknown' : ''}`;
  return `Gender: ${all(d.gender, GENDERS)}, Age: ${age}, Parental status: ${all(d.parental, PARENTAL_STATUSES)}, Household income: ${all(d.income, HOUSEHOLD_INCOMES)}`;
}

/** Summary line of one card row, or null when the dimension is not in the state. */
export function summarizeTargeting(dim: MatrixDimension, c: TargetingCriteria): string | null {
  switch (dim) {
    case 'INVENTORY_SOURCES':
      return 'YouTube, Google TV, Video partners';
    case 'BRAND_SUITABILITY': {
      const b = c.brandSuitability;
      if (!b) return null;
      const mode = b.inventoryMode === 'MAXIMUM' ? 'Maximum inventory' : 'Not yet labeled';
      const n = b.thirdParty.options.length;
      return b.thirdParty.provider === 'NONE'
        ? `Inventory mode: ${mode}`
        : `Inventory mode: ${mode}; Third-party brand suitability: ${plural(n, 'item')} selected`;
    }
    case 'APPS_URLS': {
      const a = c.appsAndUrls;
      if (!a) return null;
      const n = a.channelIds.length + a.collections.length + a.urls.length + a.apps.length;
      return n ? `${plural(n, 'item')} selected` : 'None selected';
    }
    case 'KEYWORDS':
    case 'KEYWORD_EXCLUSIONS': {
      const k = c.keywords;
      if (!k) return null;
      if (dim === 'KEYWORD_EXCLUSIONS') return `Exclude: ${plural(k.exclude.length, 'keyword')}`;
      return `Include: ${plural(k.include.length, 'keyword')}. Exclude: ${plural(k.exclude.length, 'keyword')}`;
    }
    case 'CATEGORIES':
      return c.categories ? selText(c.categories, CATEGORY_OPTIONS) : null;
    case 'ENVIRONMENT': {
      const e = c.environment;
      if (!e) return null;
      const on = [e.web && 'Web', e.app && 'App'].filter(Boolean);
      return on.length ? `Include: ${on.join(', ')}` : 'None selected';
    }
    case 'POSITION': {
      const p = c.position;
      if (!p) return null;
      const on = p.onScreen.map((v) => labelOf(POSITION_ON_SCREEN, v));
      const inc = p.inContent.map((v) => labelOf([...POSITION_IN_CONTENT, ...POSITION_VIDEO], v));
      const nat = p.native.map((v) => labelOf(POSITION_NATIVE, v));
      if (p.inContent.length === 1 && p.inContent[0] === 'IN_STREAM' && !on.length && !nat.length)
        return 'In-stream, all positions';
      const parts = [];
      if (on.length) parts.push(`On screen: ${on.join(', ')}`);
      if (inc.length) parts.push(`In content: ${inc.join(', ')}`);
      if (nat.length) parts.push(`Native: ${nat.join(', ')}`);
      return parts.join('; ') || 'None selected';
    }
    case 'VIEWABILITY': {
      const v = c.viewability;
      if (!v) return null;
      const parts = [];
      if (v.openMeasurement) parts.push('Open Measurement');
      if (v.predictedPct !== null)
        parts.push(`Predicted viewability ${v.predictedPct}% or greater`);
      return parts.join('; ') || 'All impressions';
    }
    case 'LANGUAGE':
      return c.language ? selText(c.language, LANGUAGES) : null;
    case 'AUDIENCE_LISTS': {
      const a = c.audienceLists;
      if (!a) return null;
      const inc =
        a.include.firstPartyGroups.flat().length +
        a.include.google.length +
        a.include.combined.length +
        a.include.custom.length;
      const exc = a.exclude.firstParty.length + a.exclude.google.length;
      return `Include: ${plural(inc, 'list')}; Exclude: ${plural(exc, 'list')}`;
    }
    case 'GEOGRAPHY': {
      const g = c.geography;
      if (!g) return null;
      const inc = g.regions.filter((r) => r.mode === 'INCLUDE').map((r) => r.label ?? r.id);
      const exc = g.regions.filter((r) => r.mode === 'EXCLUDE').map((r) => r.label ?? r.id);
      const points = g.radius?.points.length ?? 0;
      if (!inc.length && !points && !g.regions.length) return 'All locations';
      return (
        [
          inc.length ? `Region inclusions: ${inc.join(', ')}` : '',
          exc.length ? `Region exclusions: ${exc.join(', ')}` : '',
          points ? `${plural(points, 'radius target')}` : '',
        ]
          .filter(Boolean)
          .join('; ') || selText(g.regions)
      );
    }
    case 'DAY_TIME':
      return c.dayAndTime ? dayTimeText(c.dayAndTime.segments, c.dayAndTime.tz) : null;
    case 'DEMOGRAPHICS':
      return c.demographics ? demographicsText(c.demographics) : null;
    case 'BROWSER':
      return c.browser ? selText(c.browser, BROWSERS) : null;
    case 'DEVICE': {
      const d = c.device;
      if (!d) return null;
      const base = selText(d.types, DEVICE_TYPES);
      const extra = d.os.length + d.makeModel.length;
      return extra ? `${base}; ${plural(extra, 'operating system or model')}` : base;
    }
    case 'CONNECTION_SPEED':
      return c.connectionSpeed === undefined ? null : labelOf(CONNECTION_SPEEDS, c.connectionSpeed);
    case 'CARRIER_ISP':
      return c.carrierIsp ? selText(c.carrierIsp) : null;
    case 'VIDEO_PLAYER_SIZE':
      return c.videoPlayerSize
        ? c.videoPlayerSize.map((v) => labelOf(VIDEO_PLAYER_SIZES, v)).join(', ') || 'None selected'
        : null;
    case 'CONTENT_DURATION':
      return c.contentDuration ? plural(c.contentDuration.length, 'duration') : null;
    case 'LIVESTREAM':
      return c.livestream
        ? c.livestream === 'INCLUDE'
          ? 'Include livestream'
          : 'Exclude livestream'
        : null;
    case 'REWARDED':
      return c.rewarded
        ? c.rewarded === 'INCLUDE'
          ? 'Include rewarded'
          : 'Exclude rewarded'
        : null;
    case 'DOOH_VENUE_SCREEN':
      return c.doohVenue ? selText(c.doohVenue) : null;
    default:
      return null;
  }
}
