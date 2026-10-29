// TargetingState <-> TargetingAssignment rows (data-model 5.8 mapping table, module 10 3.2). Pure and lossless:
// rowsToState(stateToRows(s)) equals s for every state whose dimensions hold at least one value (AC-10-24).
import type { DaySegment, Sel, TargetMode, TargetingCriteria, TargetingState } from './types';
import { matrixDimensionOf } from '@/lib/validation/constants/targeting-availability';
import { DAYS } from './options';

export type AudienceSection = 'FIRST_PARTY_AND_PARTNER' | 'GOOGLE' | 'COMBINED' | 'CUSTOM_LIST';
export type RefType =
  'AUDIENCE' | 'GOOGLE_AUDIENCE' | 'CHANNEL' | 'COLLECTION' | 'LOCATION_LIST' | 'CUSTOM_LIST';

/** One TargetingAssignment row without owner and ids. `code` is resolved to `optionId` by the server layer. */
export interface TargetingRow {
  dimension: string;
  mode: TargetMode;
  code?: string;
  label?: string;
  refType?: RefType;
  refId?: string;
  valueText?: string;
  groupIndex?: number;
  audienceSection?: AudienceSection;
  config?: Record<string, unknown>;
  isLocked?: boolean;
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
const toHhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

function selRows(dimension: string, sels: Sel[] | undefined): TargetingRow[] {
  return (sels ?? []).map((s) => ({
    dimension,
    mode: s.mode,
    code: s.id,
    ...withLabel(s),
  }));
}
function codeRows(
  dimension: string,
  codes: string[] | undefined,
  config?: Record<string, unknown>,
) {
  return (codes ?? []).map((code): TargetingRow => ({
    dimension,
    mode: 'INCLUDE',
    code,
    ...(config ? { config } : {}),
  }));
}
const refRows = (
  dimension: string,
  refType: RefType,
  ids: string[],
  extra: Partial<TargetingRow> = {},
): TargetingRow[] => ids.map((refId) => ({ dimension, mode: 'INCLUDE', refType, refId, ...extra }));

export function stateToRows(state: TargetingState): TargetingRow[] {
  const c = state.criteria;
  const rows: TargetingRow[] = [];
  const push = (...r: TargetingRow[]) => rows.push(...r);

  if (c.geography) {
    push(...selRows('GEOGRAPHY', c.geography.regions));
    for (const p of c.geography.radius?.points ?? [])
      push({
        dimension: 'GEOGRAPHY',
        mode: 'INCLUDE',
        config: {
          kind: 'RADIUS',
          center: { lat: p.lat, lng: p.lng },
          radiusKm: p.radiusKm,
          ...(p.label !== undefined ? { label: p.label } : {}),
        },
      });
    push(...refRows('GEOGRAPHY', 'LOCATION_LIST', c.geography.locationListIds ?? []));
  }
  if (c.appsAndUrls) {
    const a = c.appsAndUrls;
    push(
      ...a.channelIds.map((s): TargetingRow => ({
        dimension: 'APPS_AND_URLS',
        mode: s.mode,
        refType: 'CHANNEL',
        refId: s.id,
        ...withLabel(s),
      })),
    );
    push(
      ...a.collections.map((s): TargetingRow => ({
        dimension: 'APPS_AND_URLS',
        mode: s.mode,
        refType: 'COLLECTION',
        refId: s.id,
        ...withLabel(s),
      })),
    );
    for (const [kind, list] of [
      ['URL', a.urls],
      ['APP', a.apps],
    ] as const)
      push(
        ...list.map((s): TargetingRow => ({
          dimension: 'APPS_AND_URLS',
          mode: s.mode,
          valueText: s.id,
          config: { kind },
          ...withLabel(s),
        })),
      );
  }
  if (c.keywords) {
    push(
      ...c.keywords.include.map((k): TargetingRow => ({
        dimension: 'KEYWORD',
        mode: 'INCLUDE',
        valueText: k,
      })),
    );
    push(
      ...c.keywords.exclude.map((k): TargetingRow => ({
        dimension: 'KEYWORD',
        mode: 'EXCLUDE',
        valueText: k,
      })),
    );
  }
  push(...selRows('CATEGORY', c.categories));
  if (c.environment) {
    if (c.environment.web) push({ dimension: 'ENVIRONMENT', mode: 'INCLUDE', code: 'WEB' });
    if (c.environment.app) push({ dimension: 'ENVIRONMENT', mode: 'INCLUDE', code: 'APP' });
  }
  if (c.position) {
    push(...codeRows('POSITION_ON_SCREEN', c.position.onScreen));
    push(...codeRows('POSITION_IN_CONTENT', c.position.inContent));
    push(...codeRows('POSITION_IN_CONTENT', c.position.native, { native: true }));
  }
  if (c.viewability)
    push({
      dimension: 'VIEWABILITY',
      mode: 'INCLUDE',
      config: {
        openMeasurement: c.viewability.openMeasurement,
        predictedPct: c.viewability.predictedPct,
      },
    });
  push(...selRows('LANGUAGE', c.language));
  if (c.brandSuitability) {
    push({
      dimension: 'BRAND_SUITABILITY',
      mode: 'INCLUDE',
      config: { inventoryMode: c.brandSuitability.inventoryMode },
    });
    push({
      dimension: 'THIRD_PARTY_VERIFIER',
      mode: 'INCLUDE',
      config: {
        ...c.brandSuitability.thirdParty,
        options: [...c.brandSuitability.thirdParty.options],
      },
    });
  }
  if (c.audienceLists) {
    const { include, exclude } = c.audienceLists;
    include.firstPartyGroups.forEach((group, groupIndex) =>
      push(
        ...refRows('AUDIENCE_LIST', 'AUDIENCE', group, {
          groupIndex,
          audienceSection: 'FIRST_PARTY_AND_PARTNER',
        }),
      ),
    );
    push(
      ...refRows('AUDIENCE_LIST', 'GOOGLE_AUDIENCE', include.google, { audienceSection: 'GOOGLE' }),
    );
    push(
      ...refRows('AUDIENCE_LIST', 'AUDIENCE', include.combined, { audienceSection: 'COMBINED' }),
    );
    push(
      ...refRows('AUDIENCE_LIST', 'CUSTOM_LIST', include.custom, {
        audienceSection: 'CUSTOM_LIST',
      }),
    );
    push(
      ...refRows('AUDIENCE_LIST', 'AUDIENCE', exclude.firstParty, {
        mode: 'EXCLUDE',
        audienceSection: 'FIRST_PARTY_AND_PARTNER',
      }),
    );
    push(
      ...refRows('AUDIENCE_LIST', 'GOOGLE_AUDIENCE', exclude.google, {
        mode: 'EXCLUDE',
        audienceSection: 'GOOGLE',
      }),
    );
  }
  if (c.demographics) {
    const d = c.demographics;
    push(...codeRows('GENDER', d.gender));
    push({
      dimension: 'AGE',
      mode: 'INCLUDE',
      config: { min: d.ageRange[0], max: d.ageRange[1], includeUnknown: d.ageUnknown },
    });
    push(...codeRows('PARENTAL_STATUS', d.parental));
    push(...codeRows('HOUSEHOLD_INCOME', d.income));
  }
  if (c.dayAndTime) {
    const tz = c.dayAndTime.tz;
    for (const s of c.dayAndTime.segments)
      push({
        dimension: 'DAY_TIME',
        mode: 'INCLUDE',
        config: {
          days: [DAYS.indexOf(s.day) + 1],
          startMin: toMin(s.from),
          endMin: toMin(s.to),
          tz,
        },
      });
  }
  push(...selRows('BROWSER', c.browser));
  if (c.device) {
    push(...selRows('DEVICE_TYPE', c.device.types));
    push(...selRows('OPERATING_SYSTEM', c.device.os));
    push(...selRows('DEVICE_MAKE_MODEL', c.device.makeModel));
  }
  if (c.connectionSpeed !== undefined)
    push({ dimension: 'CONNECTION_SPEED', mode: 'INCLUDE', config: { speed: c.connectionSpeed } });
  push(...selRows('CARRIER_ISP', c.carrierIsp));
  push(...codeRows('VIDEO_PLAYER_SIZE', c.videoPlayerSize));
  if (c.contentDuration)
    push({
      dimension: 'CONTENT_DURATION',
      mode: 'INCLUDE',
      config: { values: [...c.contentDuration] },
    });
  if (c.livestream)
    push({ dimension: 'CONTENT_STREAM_TYPE', mode: c.livestream, code: 'LIVESTREAM' });
  if (c.rewarded) push({ dimension: 'REWARDED', mode: c.rewarded, code: 'REWARDED' });
  push(...selRows('DOOH_VENUE', c.doohVenue));
  if (c.optimizedTargeting !== undefined)
    push({
      dimension: 'OPTIMIZED_TARGETING',
      mode: 'INCLUDE',
      config: { enabled: c.optimizedTargeting },
    });

  const locked = new Set(state.locked ?? []);
  return locked.size === 0
    ? rows
    : rows.map((r) => (lockedFor(r.dimension, locked) ? { ...r, isLocked: true } : r));
}

/** A row is locked when the matrix label that owns its DM dimension is locked (RC-011 mapping). */
function lockedFor(dimension: string, locked: Set<string>): boolean {
  return locked.has(matrixDimensionOf(dimension) ?? dimension);
}

const withLabel = (s: Sel) => (s.label !== undefined ? { label: s.label } : {});

function toSel(r: TargetingRow, id = r.code ?? r.valueText ?? ''): Sel {
  return { id, mode: r.mode, ...(r.label !== undefined ? { label: r.label } : {}) };
}

/** Rebuilds the state. Tolerates the seed's legacy shapes (DAY_TIME `fromHour`, VIEWABILITY `predictedViewabilityMin`). */
export function rowsToState(rows: readonly TargetingRow[], lineItemType: string): TargetingState {
  const c: TargetingCriteria = {};
  const locked = new Set<string>();
  const of = (dim: string) => rows.filter((r) => r.dimension === dim);
  const codes = (list: TargetingRow[]) => list.map((r) => r.code ?? r.valueText ?? '');
  const sels = (dim: string) => of(dim).map((r) => toSel(r));
  const cfg = (r: TargetingRow | undefined) => (r?.config ?? {}) as Record<string, unknown>;

  for (const r of rows) {
    if (!r.isLocked) continue;
    locked.add(matrixDimensionOf(r.dimension) ?? r.dimension);
  }

  const geo = of('GEOGRAPHY');
  if (geo.length > 0) {
    const regions = geo.filter((r) => !r.refType && cfg(r).kind !== 'RADIUS').map((r) => toSel(r));
    const points = geo
      .filter((r) => cfg(r).kind === 'RADIUS')
      .map((r) => {
        const k = cfg(r);
        const center = (k.center ?? {}) as { lat: number; lng: number };
        return {
          lat: center.lat,
          lng: center.lng,
          radiusKm: k.radiusKm as number,
          ...(k.label !== undefined ? { label: k.label as string } : {}),
        };
      });
    const lists = geo.filter((r) => r.refType === 'LOCATION_LIST').map((r) => r.refId!);
    c.geography = {
      regions,
      ...(points.length ? { radius: { points } } : {}),
      ...(lists.length ? { locationListIds: lists } : {}),
    };
  }
  const apps = of('APPS_AND_URLS');
  if (apps.length > 0) {
    const pick = (f: (r: TargetingRow) => boolean, id: (r: TargetingRow) => string) =>
      apps.filter(f).map((r) => toSel(r, id(r)));
    c.appsAndUrls = {
      channelIds: pick(
        (r) => r.refType === 'CHANNEL',
        (r) => r.refId!,
      ),
      collections: pick(
        (r) => r.refType === 'COLLECTION',
        (r) => r.refId!,
      ),
      urls: pick(
        (r) => cfg(r).kind === 'URL',
        (r) => r.valueText!,
      ),
      apps: pick(
        (r) => cfg(r).kind === 'APP',
        (r) => r.valueText!,
      ),
    };
  }
  const kw = of('KEYWORD');
  if (kw.length > 0)
    c.keywords = {
      include: kw.filter((r) => r.mode === 'INCLUDE').map((r) => r.valueText!),
      exclude: kw.filter((r) => r.mode === 'EXCLUDE').map((r) => r.valueText!),
    };
  if (of('CATEGORY').length) c.categories = sels('CATEGORY');
  const env = codes(of('ENVIRONMENT'));
  if (env.length) c.environment = { web: env.includes('WEB'), app: env.includes('APP') };
  const onScreen = of('POSITION_ON_SCREEN');
  const inContent = of('POSITION_IN_CONTENT');
  if (onScreen.length + inContent.length > 0)
    c.position = {
      onScreen: codes(onScreen),
      inContent: codes(inContent.filter((r) => !cfg(r).native)),
      native: codes(inContent.filter((r) => cfg(r).native)),
    };
  const view = of('VIEWABILITY')[0];
  if (view) {
    const k = cfg(view);
    const pct = (k.predictedPct ?? k.predictedViewabilityMin ?? null) as number | null;
    c.viewability = {
      openMeasurement: k.openMeasurement === true,
      predictedPct: pct === 0 ? null : pct,
    };
  }
  if (of('LANGUAGE').length) c.language = sels('LANGUAGE');
  const bs = of('BRAND_SUITABILITY')[0];
  const tpv = of('THIRD_PARTY_VERIFIER')[0];
  if (bs || tpv) {
    const t = cfg(tpv);
    c.brandSuitability = {
      inventoryMode:
        (cfg(bs).inventoryMode as 'MAXIMUM' | 'NOT_YET_LABELED' | undefined) ?? 'MAXIMUM',
      thirdParty: {
        provider: (t.provider as 'NONE') ?? 'NONE',
        options: (t.options as string[] | undefined) ?? [],
      },
    };
  }
  const aud = of('AUDIENCE_LIST');
  if (aud.length > 0) {
    const ids = (mode: TargetMode, section: AudienceSection) =>
      aud
        .filter(
          (r) => r.mode === mode && (r.audienceSection ?? 'FIRST_PARTY_AND_PARTNER') === section,
        )
        .map((r) => r.refId!);
    const groups: string[][] = [];
    for (const r of aud)
      if (
        r.mode === 'INCLUDE' &&
        (r.audienceSection ?? 'FIRST_PARTY_AND_PARTNER') === 'FIRST_PARTY_AND_PARTNER'
      )
        (groups[r.groupIndex ?? 0] ??= []).push(r.refId!);
    c.audienceLists = {
      include: {
        firstPartyGroups: groups.filter(Boolean),
        google: ids('INCLUDE', 'GOOGLE'),
        combined: ids('INCLUDE', 'COMBINED'),
        custom: ids('INCLUDE', 'CUSTOM_LIST'),
      },
      exclude: {
        firstParty: ids('EXCLUDE', 'FIRST_PARTY_AND_PARTNER'),
        google: ids('EXCLUDE', 'GOOGLE'),
      },
    };
  }
  const age = of('AGE')[0];
  if (age || of('GENDER').length || of('PARENTAL_STATUS').length || of('HOUSEHOLD_INCOME').length) {
    const k = cfg(age);
    c.demographics = {
      gender: codes(of('GENDER')),
      ageRange: [(k.min as number | undefined) ?? 18, (k.max as number | undefined) ?? 65],
      ageUnknown: (k.includeUnknown as boolean | undefined) ?? true,
      parental: codes(of('PARENTAL_STATUS')),
      income: codes(of('HOUSEHOLD_INCOME')),
    };
  }
  const dt = of('DAY_TIME');
  if (dt.length > 0) {
    const segments: DaySegment[] = [];
    let tz: 'LOCAL' | 'ADVERTISER' = 'ADVERTISER';
    for (const r of dt) {
      const k = cfg(r);
      tz = ((k.tz ?? k.timeZone) as 'LOCAL' | 'ADVERTISER' | undefined) ?? tz;
      const start =
        (k.startMin as number | undefined) ?? ((k.fromHour as number | undefined) ?? 0) * 60;
      const end = (k.endMin as number | undefined) ?? ((k.toHour as number | undefined) ?? 24) * 60;
      for (const d of (k.days ?? []) as (number | string)[]) {
        const day = typeof d === 'number' ? DAYS[d - 1] : (d as DaySegment['day']);
        if (day) segments.push({ day, from: toHhmm(start), to: toHhmm(end) });
      }
    }
    c.dayAndTime = { segments, tz };
  }
  if (of('BROWSER').length) c.browser = sels('BROWSER');
  if (of('DEVICE_TYPE').length + of('OPERATING_SYSTEM').length + of('DEVICE_MAKE_MODEL').length > 0)
    c.device = {
      types: sels('DEVICE_TYPE'),
      os: sels('OPERATING_SYSTEM'),
      makeModel: sels('DEVICE_MAKE_MODEL'),
    };
  const speed = of('CONNECTION_SPEED')[0];
  if (speed) c.connectionSpeed = (cfg(speed).speed as string | undefined) ?? speed.code ?? 'ALL';
  if (of('CARRIER_ISP').length) c.carrierIsp = sels('CARRIER_ISP');
  if (of('VIDEO_PLAYER_SIZE').length) c.videoPlayerSize = codes(of('VIDEO_PLAYER_SIZE'));
  const dur = of('CONTENT_DURATION')[0];
  if (dur) c.contentDuration = (cfg(dur).values as string[] | undefined) ?? [];
  const live = of('CONTENT_STREAM_TYPE')[0];
  if (live) c.livestream = live.mode;
  const rew = of('REWARDED')[0];
  if (rew) c.rewarded = rew.mode;
  if (of('DOOH_VENUE').length) c.doohVenue = sels('DOOH_VENUE');
  const opt = of('OPTIMIZED_TARGETING')[0];
  if (opt) c.optimizedTargeting = cfg(opt).enabled === true;

  return {
    version: 1,
    lineItemType,
    criteria: c,
    ...(locked.size ? { locked: [...locked].sort() } : {}),
  };
}
