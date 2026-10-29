// TGT rules: targeting (validation.md 2.16). They read the card state that the LI form passes as
// `targeting.state` (lib/targeting toLiTargetingInput). TGT-003 is an alias of LI-102 and is not registered.
import type { CriteriaKey, Sel, TargetingCriteria, TargetingState } from '@/lib/targeting/types';
import { CONNECTION_SPEEDS } from '@/lib/targeting/options';
import { ABS_REPLACES, verificationCost } from '@/lib/targeting/verification';
import { format as money } from '@/lib/money';
import type { LiType } from '../constants/li-compat';
import { LI_TYPE_LABEL, YOUTUBE_LI_TYPES } from '../constants/li-compat';
import { MSG } from '../messages';
import type { AnyRule, LineItemInput, Rule, ValidationContext, Violation } from '../types';

/** Lookups this domain reads that the P3-06a context type does not list yet; rules skip when they are absent. */
export interface AudienceInfo {
  id: string;
  kind: 'FIRST_PARTY' | 'GOOGLE' | 'COMBINED' | 'CUSTOM' | 'LOOKALIKE';
  eligibleTypes?: LiType[];
  createdAt?: string;
  sizeBucket?: string;
  permitted?: boolean;
}
interface TargetingLookups {
  audiences?: Map<string, AudienceInfo>;
  channels?: Map<string, { id: string; ownedByAdvertiserOrPartner: boolean }>;
}
const lookups = (ctx: ValidationContext) => ctx.lookups as TargetingLookups;
/** Verification providers turned on in Advertiser settings, Third-party services (TGT-092). */
const enabledProviders = (ctx: ValidationContext) =>
  (ctx.advertiser as { thirdPartyServices?: string[] }).thirdPartyServices;

export type TargetingLineItem = LineItemInput & {
  targeting: LineItemInput['targeting'] & { state?: TargetingState | null; bulkRejected?: number };
};

const cr = (l: TargetingLineItem): TargetingCriteria => l.targeting.state?.criteria ?? {};
const has = (l: TargetingLineItem, key: CriteriaKey) => cr(l)[key] !== undefined;

function def(
  rule: Omit<Rule<TargetingLineItem>, 'kind' | 'appliesTo'> & { when?: CriteriaKey },
): Rule<LineItemInput> {
  const { when, ...rest } = rule;
  return {
    kind: 'lineItem',
    ...rest,
    appliesTo: (l: TargetingLineItem) => !!l.targeting.state && (!when || has(l, when)),
  } as unknown as Rule<LineItemInput>;
}

const one = (cond: boolean, path: string, params?: Violation['params']): Violation | null =>
  cond ? { path, ...(params ? { params } : {}) } : null;

const SEL_LISTS: [string, (c: TargetingCriteria) => Sel[] | undefined][] = [
  ['geography.regions', (c) => c.geography?.regions],
  ['categories', (c) => c.categories],
  ['language', (c) => c.language],
  ['browser', (c) => c.browser],
  ['device.types', (c) => c.device?.types],
  ['device.os', (c) => c.device?.os],
  ['device.makeModel', (c) => c.device?.makeModel],
  ['carrierIsp', (c) => c.carrierIsp],
  ['doohVenue', (c) => c.doohVenue],
];

const both = (sels: Sel[]) => {
  const inc = new Set(sels.filter((s) => s.mode === 'INCLUDE').map((s) => s.id));
  return sels.some((s) => s.mode === 'EXCLUDE' && inc.has(s.id));
};

const empty = (
  key: 'categories' | 'language' | 'browser' | 'carrierIsp',
  id: string,
  message: string,
) =>
  def({
    id,
    severity: 'error',
    triggers: ['save'],
    reads: [`targeting.${key}`],
    message,
    when: key,
    check: (l) => one((cr(l)[key] ?? []).length === 0, `targeting.${key}`),
  });

const URL_RE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i;
const APP_RE = /^([A-Za-z][\w]*(\.[A-Za-z_][\w]*)+|\d{5,}|id\d{5,})$/;
const VIEW_STEPS = [90, 80, 70, 60, 50, 40, 30, 20, 10];
const SPEEDS = CONNECTION_SPEEDS.map((o) => o.code);
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

function audienceIds(c: TargetingCriteria) {
  const a = c.audienceLists;
  if (!a) return { include: [] as string[], exclude: [] as string[] };
  return {
    include: [
      ...a.include.firstPartyGroups.flat(),
      ...a.include.google,
      ...a.include.combined,
      ...a.include.custom,
    ],
    exclude: [...a.exclude.firstParty, ...a.exclude.google],
  };
}

function audienceRule(
  id: string,
  severity: 'error' | 'warning',
  message: string,
  bad: (info: AudienceInfo, l: TargetingLineItem, ctx: ValidationContext) => boolean,
  params?: (l: TargetingLineItem) => Violation['params'],
) {
  return def({
    id,
    severity,
    triggers: ['save'],
    reads: ['targeting.audienceLists'],
    message,
    when: 'audienceLists',
    check: (l, ctx) =>
      audienceIds(cr(l)).include.flatMap((aid, i): Violation[] => {
        const info = lookups(ctx).audiences?.get(aid);
        if (!info || !bad(info, l, ctx)) return [];
        const p = params?.(l);
        return [{ path: `targeting.audienceLists.include[${i}]`, ...(p ? { params: p } : {}) }];
      }),
  });
}

const typeLabel = (l: TargetingLineItem) => (l.type ? LI_TYPE_LABEL[l.type] : '');
const LOOKALIKE_TYPES: readonly LiType[] = ['YT_VIDEO', 'YT_AUDIO', 'DEMAND_GEN'];
const DELAY_MS = 4 * 3600_000;

export const targetingRules: readonly AnyRule[] = [
  def({
    id: 'TGT-001',
    severity: 'error',
    triggers: ['save'],
    reads: ['targeting'],
    message: "An item can't be both included and excluded.",
    check: (l) =>
      SEL_LISTS.filter(([, get]) => both(get(cr(l)) ?? [])).map(([path]) => ({
        path: `targeting.${path}`,
      })),
  }),
  def({
    id: 'TGT-002',
    severity: 'error',
    triggers: ['save'],
    reads: ['targeting.appsAndUrls', 'targeting.doohVenue'],
    message: 'Select at least one item.',
    check: (l) => {
      const a = cr(l).appsAndUrls;
      const apps =
        a && a.channelIds.length + a.collections.length + a.urls.length + a.apps.length === 0;
      const venue = cr(l).doohVenue?.length === 0;
      return [one(!!apps, 'targeting.appsAndUrls'), one(venue, 'targeting.doohVenue')].filter(
        (v): v is Violation => v !== null,
      );
    },
  }),
  {
    id: 'TGT-004',
    kind: 'lineItem',
    severity: 'info',
    triggers: ['cross'],
    reads: ['targeting'],
    message: null,
    check: () => null,
  } as AnyRule,
  def({
    id: 'TGT-010',
    severity: 'error',
    triggers: ['save'],
    reads: ['targeting.geography'],
    message: 'Select at least one location.',
    when: 'geography',
    check: (l) => {
      const g = cr(l).geography!;
      const youtube = !!l.type && YOUTUBE_LI_TYPES.includes(l.type); // "All locations" row (C-10-10)
      const none =
        g.regions.length + (g.radius?.points.length ?? 0) + (g.locationListIds?.length ?? 0) === 0;
      return one(none && !youtube, 'targeting.geography');
    },
  }),
  def({
    id: 'TGT-011',
    severity: 'error',
    triggers: ['blur', 'save'],
    reads: ['targeting.geography'],
    message: 'Enter a street address or a latitude and longitude pair on each line.',
    when: 'geography',
    check: (l) =>
      (cr(l).geography!.radius?.points ?? []).flatMap((p, i) =>
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lng) &&
        Math.abs(p.lat) <= 90 &&
        Math.abs(p.lng) <= 180
          ? []
          : [{ path: `targeting.geography.radius.points[${i}]` }],
      ),
  }),
  def({
    id: 'TGT-012',
    severity: 'error',
    triggers: ['blur', 'save'],
    reads: ['targeting.geography'],
    message: 'Enter a distance between 1 and 500 km.',
    when: 'geography',
    check: (l) =>
      (cr(l).geography!.radius?.points ?? []).flatMap((p, i) =>
        p.radiusKm >= 1 && p.radiusKm <= 500
          ? []
          : [{ path: `targeting.geography.radius.points[${i}].radiusKm` }],
      ),
  }),
  def({
    id: 'TGT-013',
    severity: 'warning',
    triggers: ['cross'],
    reads: ['targeting.geography'],
    message: "{Region} is inside an excluded location, so it won't be targeted.",
    when: 'geography',
    check: (l) => {
      const regions = cr(l).geography!.regions;
      const excluded = regions.filter((r) => r.mode === 'EXCLUDE').map((r) => r.id);
      // Geography codes are hierarchical (`IN-MH-mumbai` sits inside `IN-MH`).
      return regions.flatMap((r, i) =>
        r.mode === 'INCLUDE' && excluded.some((e) => r.id.startsWith(`${e}-`))
          ? [{ path: `targeting.geography.regions[${i}]`, params: { Region: r.label ?? r.id } }]
          : [],
      );
    },
  }),
  def({
    id: 'TGT-020',
    severity: 'error',
    triggers: ['blur', 'save'],
    reads: ['targeting.appsAndUrls'],
    message: 'Enter a valid URL or app ID.',
    when: 'appsAndUrls',
    check: (l) => {
      const a = cr(l).appsAndUrls!;
      return [
        ...a.urls.flatMap((u, i) =>
          URL_RE.test(u.id) ? [] : [{ path: `targeting.appsAndUrls.urls[${i}]` }],
        ),
        ...a.apps.flatMap((u, i) =>
          APP_RE.test(u.id) ? [] : [{ path: `targeting.appsAndUrls.apps[${i}]` }],
        ),
      ];
    },
  }),
  def({
    id: 'TGT-021',
    severity: 'error',
    triggers: ['save'],
    reads: ['targeting.appsAndUrls'],
    message: "An item can't be both included and excluded.",
    when: 'appsAndUrls',
    check: (l) => {
      const a = cr(l).appsAndUrls!;
      return (['channelIds', 'collections', 'urls', 'apps'] as const)
        .filter((k) => both(a[k]))
        .map((k) => ({ path: `targeting.appsAndUrls.${k}` }));
    },
  }),
  def({
    id: 'TGT-022',
    severity: 'error',
    triggers: ['save'],
    reads: ['targeting.appsAndUrls'],
    message: 'Choose a channel from this advertiser or partner.',
    when: 'appsAndUrls',
    check: (l, ctx) =>
      cr(l).appsAndUrls!.channelIds.flatMap((c, i) => {
        const info = lookups(ctx).channels?.get(c.id);
        return info && !info.ownedByAdvertiserOrPartner
          ? [{ path: `targeting.appsAndUrls.channelIds[${i}]` }]
          : [];
      }),
  }),
  def({
    id: 'TGT-023',
    severity: 'warning',
    triggers: ['save'],
    reads: ['targeting.bulkRejected'],
    message: "{n} entries couldn't be added.",
    check: (l) =>
      one((l.targeting.bulkRejected ?? 0) > 0, 'targeting.appsAndUrls', {
        n: l.targeting.bulkRejected ?? 0,
      }),
  }),
  def({
    id: 'TGT-030',
    severity: 'error',
    triggers: ['save'],
    reads: ['targeting.keywords'],
    message: MSG.ENTER_VALUE,
    when: 'keywords',
    check: (l) =>
      one(
        cr(l).keywords!.include.length + cr(l).keywords!.exclude.length === 0,
        'targeting.keywords',
      ),
  }),
  {
    id: 'TGT-031',
    kind: 'lineItem',
    severity: 'info',
    triggers: ['blur'],
    reads: ['targeting.keywords'],
    message: null,
    check: () => null,
  } as AnyRule,
  def({
    id: 'TGT-032',
    severity: 'error',
    triggers: ['blur', 'save'],
    reads: ['targeting.keywords'],
    message: MSG.MAX_CHARS,
    when: 'keywords',
    check: (l) => {
      const k = cr(l).keywords!;
      return [...k.include, ...k.exclude].some((w) => w.length > 80)
        ? { path: 'targeting.keywords', params: { max: 80 } }
        : null;
    },
  }),
  def({
    id: 'TGT-033',
    severity: 'error',
    triggers: ['save'],
    reads: ['targeting.keywords'],
    message: 'Use 5,000 keywords or fewer.',
    when: 'keywords',
    check: (l) => one(cr(l).keywords!.include.length > 5000, 'targeting.keywords.include'),
  }),
  def({
    id: 'TGT-034',
    severity: 'error',
    triggers: ['save'],
    reads: ['targeting.keywords'],
    message: "An item can't be both included and excluded.",
    when: 'keywords',
    check: (l) => {
      const k = cr(l).keywords!;
      return one(
        k.include.some((w) => k.exclude.includes(w)),
        'targeting.keywords',
      );
    },
  }),
  empty('categories', 'TGT-040', 'Select at least one item.'),
  def({
    id: 'TGT-050',
    severity: 'error',
    triggers: ['save'],
    reads: ['targeting.environment'],
    message: 'Select at least one environment.',
    when: 'environment',
    check: (l) => one(!cr(l).environment!.web && !cr(l).environment!.app, 'targeting.environment'),
  }),
  def({
    id: 'TGT-060',
    severity: 'error',
    triggers: ['save'],
    reads: ['targeting.position'],
    message: 'Select at least one position.',
    when: 'position',
    check: (l) => {
      const p = cr(l).position!;
      const content = p.inContent.length + p.native.length;
      // Display: on screen AND in content must both have a value (AC-10-08).
      const bad =
        l.type === 'DISPLAY'
          ? p.onScreen.length === 0 || content === 0
          : p.onScreen.length + content === 0;
      return one(bad, 'targeting.position');
    },
  }),
  def({
    id: 'TGT-070',
    severity: 'error',
    triggers: ['save'],
    reads: ['targeting.viewability'],
    message: 'Choose a viewability option.',
    when: 'viewability',
    check: (l) => {
      const pct = cr(l).viewability!.predictedPct;
      return one(pct !== null && !VIEW_STEPS.includes(pct), 'targeting.viewability');
    },
  }),
  empty('language', 'TGT-080', 'Select at least one item.'),
  def({
    id: 'TGT-090',
    severity: 'error',
    triggers: ['save'],
    reads: ['targeting.brandSuitability'],
    message: 'Choose a verification provider.',
    when: 'brandSuitability',
    check: (l) =>
      one(
        !['NONE', 'DOUBLEVERIFY', 'IAS', 'SCOPE3'].includes(
          cr(l).brandSuitability!.thirdParty.provider,
        ),
        'targeting.brandSuitability.thirdParty.provider',
      ),
  }),
  def({
    id: 'TGT-091',
    severity: 'error',
    triggers: ['cross'],
    reads: ['targeting.brandSuitability'],
    message: 'Authentic Brand Safety replaces standard brand safety and fraud and invalid traffic.',
    when: 'brandSuitability',
    check: (l) => {
      const t = cr(l).brandSuitability!.thirdParty;
      return one(
        t.provider === 'DOUBLEVERIFY' &&
          t.options.includes('authentic-brand-safety') &&
          t.options.some((o) => ABS_REPLACES.includes(o)),
        'targeting.brandSuitability.thirdParty.options',
      );
    },
  }),
  def({
    id: 'TGT-092',
    severity: 'error',
    triggers: ['save'],
    reads: ['targeting.brandSuitability'],
    message: 'Turn on this verification service in Advertiser settings first.',
    when: 'brandSuitability',
    check: (l, ctx) => {
      const provider = cr(l).brandSuitability!.thirdParty.provider;
      const enabled = enabledProviders(ctx);
      return one(
        !!enabled && provider !== 'NONE' && !enabled.includes(provider),
        'targeting.brandSuitability.thirdParty.provider',
      );
    },
  }),
  def({
    id: 'TGT-093',
    severity: 'info',
    triggers: ['cross'],
    reads: ['targeting.brandSuitability'],
    message: 'Total cost: ~{amount} CPM',
    when: 'brandSuitability',
    check: (l, ctx) => {
      const t = cr(l).brandSuitability!.thirdParty;
      return t.provider === 'NONE'
        ? null
        : {
            path: 'targeting.brandSuitability.totalCost',
            params: {
              amount: money(verificationCost(t.provider, t.options), ctx.advertiser.currency),
            },
          };
    },
  }),
  def({
    id: 'TGT-100',
    severity: 'error',
    triggers: ['save'],
    reads: ['targeting.audienceLists'],
    message: "An item can't be both included and excluded.",
    when: 'audienceLists',
    check: (l) => {
      const { include, exclude } = audienceIds(cr(l));
      return one(
        include.some((id) => exclude.includes(id)),
        'targeting.audienceLists',
      );
    },
  }),
  audienceRule(
    'TGT-101',
    'error',
    "This audience can't be used in {Type} line items.",
    (a, l) =>
      a.kind !== 'LOOKALIKE' && !!a.eligibleTypes && !!l.type && !a.eligibleTypes.includes(l.type),
    (l) => ({ Type: typeLabel(l) }),
  ),
  audienceRule(
    'TGT-102',
    'warning',
    'This audience is small and may limit delivery.',
    (a) => a.sizeBucket === '<1K',
  ),
  audienceRule(
    'TGT-103',
    'error',
    "This audience isn't available yet. New audiences take up to 4 hours.",
    (a, _l, ctx) =>
      a.kind !== 'COMBINED' &&
      !!a.createdAt &&
      ctx.now.getTime() - Date.parse(a.createdAt) < DELAY_MS,
  ),
  audienceRule(
    'TGT-104',
    'warning',
    "You don't have permission to use this audience list.",
    (a) => a.permitted === false,
  ),
  audienceRule(
    'TGT-105',
    'error',
    'Lookalike audiences can only be used in YouTube & partners and Demand Gen line items.',
    (a, l) => a.kind === 'LOOKALIKE' && !(l.type && LOOKALIKE_TYPES.includes(l.type)),
  ),
  def({
    id: 'TGT-110',
    severity: 'error',
    triggers: ['save'],
    reads: ['targeting.demographics'],
    message: 'Choose a valid age range.',
    when: 'demographics',
    check: (l) =>
      one(
        cr(l).demographics!.ageRange[0] > cr(l).demographics!.ageRange[1],
        'targeting.demographics.ageRange',
      ),
  }),
  def({
    id: 'TGT-111',
    severity: 'error',
    triggers: ['save'],
    reads: ['targeting.demographics'],
    message: 'Select at least one option.',
    when: 'demographics',
    check: (l) => {
      const d = cr(l).demographics!;
      return (['gender', 'parental', 'income'] as const)
        .filter((k) => d[k].length === 0)
        .map((k) => ({ path: `targeting.demographics.${k}` }));
    },
  }),
  def({
    id: 'TGT-120',
    severity: 'error',
    triggers: ['blur', 'save'],
    reads: ['targeting.dayAndTime'],
    message: 'Choose a start time that is before the end time.',
    when: 'dayAndTime',
    check: (l) => {
      const segs = cr(l).dayAndTime!.segments;
      if (segs.length === 0) return { path: 'targeting.dayAndTime.segments' };
      return segs.flatMap((s, i) =>
        toMin(s.from) >= toMin(s.to) ? [{ path: `targeting.dayAndTime.segments[${i}]` }] : [],
      );
    },
  }),
  def({
    id: 'TGT-121',
    severity: 'error',
    triggers: ['save'],
    reads: ['targeting.dayAndTime'],
    message: 'Choose a time zone.',
    when: 'dayAndTime',
    check: (l) =>
      one(!['LOCAL', 'ADVERTISER'].includes(cr(l).dayAndTime!.tz), 'targeting.dayAndTime.tz'),
  }),
  def({
    id: 'TGT-122',
    severity: 'warning',
    triggers: ['blur'],
    reads: ['targeting.dayAndTime'],
    message: 'Overlapping times were merged.',
    when: 'dayAndTime',
    check: (l) => {
      const segs = cr(l).dayAndTime!.segments;
      const overlap = segs.some((a, i) =>
        segs.some(
          (b, j) =>
            j > i && a.day === b.day && toMin(a.from) < toMin(b.to) && toMin(b.from) < toMin(a.to),
        ),
      );
      return one(overlap, 'targeting.dayAndTime.segments');
    },
  }),
  def({
    id: 'TGT-130',
    severity: 'error',
    triggers: ['save'],
    reads: ['targeting.device'],
    message: 'Select at least one option.',
    when: 'device',
    check: (l) => {
      const types = cr(l).device!.types;
      return one(
        types.length > 0 && !types.some((t) => t.mode === 'INCLUDE'),
        'targeting.device.types',
      );
    },
  }),
  def({
    id: 'TGT-131',
    severity: 'error',
    triggers: ['save'],
    reads: ['targeting.connectionSpeed'],
    message: 'Choose a connection speed.',
    when: 'connectionSpeed',
    check: (l) => one(!SPEEDS.includes(cr(l).connectionSpeed!), 'targeting.connectionSpeed'),
  }),
  def({
    id: 'TGT-132',
    severity: 'error',
    triggers: ['save'],
    reads: ['targeting.carrierIsp', 'targeting.browser'],
    message: 'Select at least one item.',
    check: (l) =>
      (['carrierIsp', 'browser'] as const)
        .filter((k) => cr(l)[k]?.length === 0)
        .map((k) => ({ path: `targeting.${k}` })),
  }),
  def({
    id: 'TGT-140',
    severity: 'info',
    triggers: ['cross'],
    reads: ['targeting.optimizedTargeting'],
    message: 'Optimized targeting can improve results by about 25% on average.',
    check: (l) => one(cr(l).optimizedTargeting === true, 'targeting.optimizedTargeting'),
  }),
  {
    id: 'TGT-150',
    kind: 'lineItem',
    severity: 'info',
    triggers: ['cross'],
    reads: ['targeting'],
    message: null,
    check: () => null,
  } as AnyRule,
];
