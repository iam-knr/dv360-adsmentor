// Deterministic sandbox plan (data-model 3.1 step 2). Pure: same template, seed value, sandbox id, date and knobs give
// byte-identical rows. No database access here; lib/seed/write.ts inserts the plan, lib/seed/history-stub.ts adds metrics.
import type { Prisma } from '@prisma/client';
import { addDays, daysBetween, maxIso, minIso, toDate } from './dates';
import {
  creativeSpecs,
  formatForType,
  LEGACY_BANNER,
  poolForFormat,
  type CreativeSpec,
} from './creatives';
import {
  healthyPasses,
  passProduct,
  defaultReasons,
  NARROW_TARGETING_REASONS,
  SIZE_MISMATCH_REASONS,
  NO_CREATIVE_REASONS,
  TIGHT_FREQUENCY_REASONS,
  EXHAUSTED_BUDGET_REASONS,
} from './funnel';
import { resolveKnobs, type PlantedProblem, type SeedKnobs, type TemplateKey } from './knobs';
import { assertSyntheticName, brandNames, brandWebsite, syntheticEmail } from './names';
import {
  DV360_FEE_PCT,
  expectedPriceFactor,
  FORMAT_PARAMS,
  formatExchanges,
  inrTo,
} from './params-stub';
import { hashString, Rng, stableId } from './prng';
import { recipeFor, type Recipe } from './recipes';
import {
  EXCHANGES,
  EXCHANGE_BY_CODE,
  FX_PER_USD,
  exchangeId,
  targetingOptionId,
} from './reference';
import {
  advertiserLockedRows,
  targetingRowsForLineItem,
  targetingRowsForTemplate,
  type TargetingContext,
} from './targeting';
import type { Format, LiProfile, PlannedSegment, SandboxPlan, StoryTag } from './types';

export const PLAN_VERSION = 1;

export interface PlanInput {
  template: TemplateKey;
  seedValue: number;
  sandboxId: string;
  classroomId: string;
  /** Sim "today" as an ISO date. All seeded dates are relative to it (data-model 3.3). */
  today: string;
  partnerName: string;
  knobs?: Partial<SeedKnobs>;
}

type EntityStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

interface LiDraft {
  a: number;
  c: number;
  i: number;
  l: number;
  key: string;
  id: string;
  name: string;
  type: string;
  format: Format;
  status: EntityStatus;
  flightMode: 'INHERIT_IO' | 'CUSTOM';
  flightStart?: string;
  flightEnd?: string;
  budgetMode: 'UNLIMITED_UP_TO_IO' | 'FIXED';
  budgetAmount?: number;
  bidKind: 'AUTOMATED' | 'FIXED';
  bidGoal: string | null;
  bidTarget: number | null;
  fixedCpm: number | null;
  freq: {
    mode: 'INHERIT' | 'LIMITED';
    max?: number;
    unit?: 'MONTH' | 'WEEK' | 'DAY';
    unitCount?: number;
  };
  conversionMode: 'ALL' | 'POST_CLICK_ONLY' | 'PERCENTAGE';
  conversionPct: number | null;
  attributionModelId: string | null;
  optimizedTargeting: boolean;
  useTemplate: boolean;
  verifier: boolean;
  narrow: boolean;
  smallAudience: boolean;
  noCreatives: boolean;
  sizeMismatch: boolean;
  disapproved: string | null;
  tags: PlantedProblem[];
  share: number;
  stopAt: string | null;
  stopReason: LiProfile['stopReason'];
  neverLive: boolean;
  supplyMul: number;
  passOverride: Partial<LiProfile['passes']>;
  reasonOverride: Partial<LiProfile['reasons']>;
  ctrMul: number;
  cvrMul: number;
  budgetCap: number | null;
  conversionPctLabel?: string;
  creativeIds: string[];
}

interface IoDraft {
  a: number;
  c: number;
  i: number;
  key: string;
  id: string;
  name: string;
  recipe: Recipe;
  status: EntityStatus;
  start: string;
  end: string;
  segments: { start: string; end: string; amount: number }[];
  budget: number;
  liveUntil: string | null;
  stopReason: LiProfile['stopReason'];
  /** Pace the story asks for (1 = on plan). Untagged line items of the IO get a supply factor that reaches it. */
  targetPace: number;
  feeIo: boolean;
  tags: PlantedProblem[];
  lis: LiDraft[];
  freq: { mode: 'INHERIT' | 'LIMITED'; max?: number; unit?: 'DAY' | 'WEEK'; unitCount?: number };
  /** Campaign index inside the advertiser. */
  campaignId: string;
  advertiserId: string;
}

const CAMPAIGN_STATUS = (a: number, c: number): EntityStatus => {
  const slot = c % 3;
  if (slot < 2) return 'ACTIVE';
  return a % 2 === 0 ? 'PAUSED' : 'ARCHIVED';
};

const GOALS = [
  { goal: 'AWARENESS', kpi: 'CPM', value: 80 },
  { goal: 'ONLINE_ACTION', kpi: 'CPA', value: 450 },
  { goal: 'APP_INSTALLS', kpi: 'CPC', value: 14 },
  { goal: 'OFFLINE_SALES', kpi: 'CPV', value: 2.5 },
  { goal: 'ONLINE_ACTION', kpi: 'OTHER', value: 0 },
  { goal: 'AWARENESS', kpi: 'CPC', value: 12 }, // not recommended for awareness: shows the warning
] as const;

/** Relative budget share of line items that carry a story (untagged line items have 1). */
const STORY_SHARE: Record<string, number> = {
  'bid-too-low': 0.12,
  'targeting-too-narrow': 0.12,
  'audience-too-small': 0.12,
  'creative-size-mismatch': 0.12,
  'li-no-creatives': 0.2,
  'budget-exhausted': 0.12,
  'frequency-cap-too-tight': 0.35,
  'creative-disapproved-exchange': 0.5,
  'paused-li': 0.4,
};

/** Expected delivery of a line item against its plan, from its pass overrides and stop dates (used to size the IO pace). */
function deliveryFactor(profile: LiProfile, today: string): number {
  if (profile.liveFrom === null) return 0;
  const healthy = healthyPasses(profile.format);
  let f = 1;
  for (const key of ['targeting', 'creative', 'frequency', 'belowMinBid'] as const) {
    f *= profile.passes[key] / healthy[key];
  }
  if (profile.disapprovedExchangeCodes.length > 0) {
    const blocked = formatExchanges(profile.format)
      .filter((e) => profile.disapprovedExchangeCodes.includes(e.code))
      .reduce((x, e) => x + e.weight, 0);
    f *= 1 - blocked;
  }
  const yesterday = addDays(today, -1);
  const plannedDays = Math.max(1, daysBetween(profile.liveFrom, yesterday) + 1);
  const liveDays = Math.max(
    0,
    daysBetween(profile.liveFrom, minIso(profile.liveUntil ?? yesterday, yesterday)) + 1,
  );
  f *= liveDays / plannedDays;
  if (profile.budgetCap !== null) {
    const seg = profile.segments[0];
    const dailySpend = seg ? (seg.dailyImpressions * profile.plannedCpm) / 1000 : 0;
    if (dailySpend > 0) f *= Math.min(1, profile.budgetCap / (dailySpend * liveDays));
  }
  return f;
}

const round = (n: number, step: number) => Math.round(n / step) * step;
const money = (n: number) => n.toFixed(6);

export function buildSandboxPlan(input: PlanInput): SandboxPlan {
  const knobs = resolveKnobs(input.template, input.knobs);
  const has = (p: PlantedProblem) => knobs.plantedProblems.includes(p);
  const T = input.today;
  const sid = input.sandboxId;
  const id = (key: string) => stableId(sid, key);
  const root = new Rng(hashString(`${input.template}:${input.seedValue}:${PLAN_VERSION}`));
  const stories: StoryTag[] = [];
  const coverageGaps: string[] = [];

  // ---------------------------------------------------------------- partner and exchanges
  const partnerId = id('partner');
  const partner: Prisma.PartnerCreateManyInput = {
    id: partnerId,
    sandboxId: sid,
    name: assertSyntheticName(input.partnerName),
    status: 'ACTIVE',
    timeZone: 'Asia/Calcutta',
    currencyCode: 'INR',
    nielsenContractCountry: 'IN',
    includeDataInCmTransfer: false,
    reportCostToCm: false,
    autoEnableNewExchanges: false,
    sdfVersion: 'V11',
    sdfAdminEmail: syntheticEmail(`sdf.admin.${input.seedValue}`),
    dataTermsAcceptedAt: toDate(addDays(T, -60)),
    createdAt: toDate(addDays(T, -60)),
    updatedAt: toDate(addDays(T, -60)),
  };
  const exRng = root.child('exchanges');
  const partnerExchanges: Prisma.PartnerExchangeCreateManyInput[] = EXCHANGES.map((e) => ({
    id: id(`pex:${e.code}`),
    sandboxId: sid,
    partnerId,
    exchangeId: e.id,
    enabled: e.enabledByDefault,
    seatId: e.needsSeatId ? `ST-${exRng.int(100000, 999999)}` : null,
    networkId: e.needsNetworkId ? String(exRng.int(10_000_000, 99_999_999)) : null,
    agencyId: e.needsNetworkId ? String(exRng.int(1_000_000, 9_999_999)) : null,
  }));

  // ---------------------------------------------------------------- advertisers
  const names = brandNames(root.child('brands'), knobs.advertisers);
  const currencies = ['INR', 'SGD'] as const;
  const advertisers: Prisma.AdvertiserCreateManyInput[] = [];
  const advCurrency: string[] = [];
  const advCountry: ('IN' | 'SG')[] = [];
  const advIds: string[] = [];
  const industries = ['Retail', 'Travel', 'Finance', 'Automotive'];
  for (let a = 0; a < knobs.advertisers; a++) {
    const currency = currencies[a % 2] as 'INR' | 'SGD';
    advCurrency.push(currency);
    advCountry.push(currency === 'INR' ? 'IN' : 'SG');
    const advId = id(`adv${a}`);
    advIds.push(advId);
    const name = names[a] as string;
    advertisers.push({
      id: advId,
      sandboxId: sid,
      partnerId,
      name,
      status: 'ACTIVE',
      websiteUrl: brandWebsite(name),
      industry: industries[a % industries.length],
      currencyCode: currency,
      timeZone: currency === 'INR' ? 'Asia/Calcutta' : 'Asia/Singapore',
      adServer: 'THIRD_PARTY_ONLY',
      floodlightGroupId: null,
      sdfVersion: 'V9',
      sdfAdminEmail: syntheticEmail(`adv${a}.sdf`),
      productImprovement: true,
      adBadging: true,
      euPoliticalAds: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADS',
      // One advertiser with Floodlight optimisation on, one without (module 08 3.4, Demand Gen gate).
      demandGenFloodlightOptimization: a % 2 === 1,
      googleInventoryEnabled: true,
      integrationCode: `MP${100000 + a * 37}`,
      createdAt: toDate(addDays(T, -60)),
      updatedAt: toDate(addDays(T, -60)),
    });
  }

  // ---------------------------------------------------------------- audiences (first party)
  const audiences: Prisma.AudienceCreateManyInput[] = [];
  const advAudienceIds: string[][] = [];
  const advSmallAudience: (string | null)[] = [];
  const AUD_KINDS = [
    { type: 'TAG_BASED', name: 'All site visitors', size: 420_000, days: 30 },
    { type: 'TAG_BASED', name: 'Cart abandoners', size: 86_000, days: 14 },
    { type: 'CUSTOMER_MATCH', name: 'CRM customers', size: 52_000, days: 540 },
    { type: 'LOOKALIKE', name: 'Lookalike of customers', size: 1_800_000, days: null },
    { type: 'CUSTOM_AFFINITY', name: 'Custom affinity: gadget fans', size: 2_600_000, days: null },
    {
      type: 'CUSTOM_INTENT_DISPLAY_VIDEO',
      name: 'Custom intent: buying a phone',
      size: 940_000,
      days: null,
    },
  ] as const;
  for (let a = 0; a < knobs.advertisers; a++) {
    const ids: string[] = [];
    AUD_KINDS.forEach((k, n) => {
      const audId = id(`aud${a}.${n}`);
      ids.push(audId);
      audiences.push({
        id: audId,
        sandboxId: sid,
        advertiserId: advIds[a] as string,
        name: `${names[a]} ${k.name}`,
        type: k.type,
        status: 'ACTIVE',
        source: 'DISPLAY_VIDEO_360',
        sizeDisplay: k.size,
        sizeYoutube: Math.round(k.size * 0.6),
        sizeMobileApp: Math.round(k.size * 0.5),
        sizeCtv: Math.round(k.size * 0.2),
        membershipDays: k.days,
        lookalikeReachPct: k.type === 'LOOKALIKE' ? '5.0' : null,
        lookalikeCountries: k.type === 'LOOKALIKE' ? [advCountry[a] as string] : [],
        availableAt: toDate(addDays(T, -50)),
        createdAt: toDate(addDays(T, -55)),
        updatedAt: toDate(addDays(T, -55)),
      });
    });
    // Audience below the minimum size (limited audience story)
    const small = id(`aud${a}.small`);
    audiences.push({
      id: small,
      sandboxId: sid,
      advertiserId: advIds[a] as string,
      name: `${names[a]} Premium club members`,
      type: 'CUSTOMER_MATCH',
      status: 'ACTIVE',
      source: 'DISPLAY_VIDEO_360',
      sizeDisplay: 800,
      sizeYoutube: 300,
      sizeMobileApp: 400,
      sizeCtv: 0,
      membershipDays: 365,
      availableAt: toDate(addDays(T, -50)),
      createdAt: toDate(addDays(T, -55)),
      updatedAt: toDate(addDays(T, -55)),
    });
    advAudienceIds.push(ids);
    advSmallAudience.push(small);
  }

  // ---------------------------------------------------------------- skeleton: campaigns, IOs, line items
  const ios: IoDraft[] = [];
  const campaignInfo: {
    a: number;
    c: number;
    id: string;
    status: EntityStatus;
    start: string;
    end: string | null;
    pausedAt: string | null;
  }[] = [];
  const dateRng = root.child('dates');
  const budgetRng = root.child('budgets');
  const liRng = root.child('lis');
  const GAP_PAUSE_DAYS = 12;

  for (let a = 0; a < knobs.advertisers; a++) {
    for (let c = 0; c < knobs.campaignsPerAdvertiser; c++) {
      const campaignId = id(`cmp${a}.${c}`);
      const status = CAMPAIGN_STATUS(a, c);
      const iosOfCampaign: IoDraft[] = [];
      for (let i = 0; i < knobs.iosPerCampaign; i++) {
        const recipe = recipeFor(a, c, i);
        const r = dateRng.child(`io${a}.${c}.${i}`);
        let start = addDays(T, -r.int(14, 40));
        let end = addDays(T, r.int(20, 70));
        const completed = a === 0 && c === 0 && i === 1;
        if (completed) {
          start = addDays(T, -45);
          end = addDays(T, -6);
        }
        if (recipe.segments === 3) start = addDays(T, -36);
        // Long enough for the budget-exhausted story: 20 days of spend, then 14 days at zero.
        if (a === 0 && c === 0 && i === 0) start = addDays(T, -40);
        const ioId = id(`io${a}.${c}.${i}`);
        const currencyFactor = inrTo(advCurrency[a] as string, FX_PER_USD);
        const budget = round(
          budgetRng.child(`io${a}.${c}.${i}`).lognormal(recipe.medianBudgetInr, 0.2) *
            currencyFactor,
          100,
        );
        const days = daysBetween(start, end) + 1;
        let segments: IoDraft['segments'];
        if (recipe.segments === 3) {
          const d1 = 14;
          const d2 = daysBetween(addDays(start, d1), addDays(T, 15)) + 1;
          const d3 = days - d1 - d2;
          const w = [d1 * 0.9, d2 * 1.0, d3 * 1.2];
          const sum = w[0]! + w[1]! + w[2]!;
          const amounts = w.map((x) => round((budget * x) / sum, 100));
          segments = [
            { start, end: addDays(start, d1 - 1), amount: amounts[0] as number },
            { start: addDays(start, d1), end: addDays(T, 15), amount: amounts[1] as number },
            { start: addDays(T, 16), end, amount: amounts[2] as number },
          ];
        } else {
          segments = [{ start, end, amount: budget }];
        }
        if (recipe.budgetUnit === 'IMPRESSIONS') {
          const cpmCur = FORMAT_PARAMS.display.clearCpm * currencyFactor;
          segments = segments.map((s) => ({
            ...s,
            amount: round((s.amount / cpmCur) * 1000, 1000),
          }));
        }
        iosOfCampaign.push({
          a,
          c,
          i,
          key: `${a}.${c}.${i}`,
          id: ioId,
          name: '',
          recipe,
          status: 'ACTIVE',
          start,
          end,
          segments,
          budget: segments.reduce((s, x) => s + x.amount, 0),
          liveUntil: null,
          stopReason: null,
          targetPace: 1,
          feeIo: a === 0 && c === 0 && i === 0,
          tags: [],
          lis: [],
          freq:
            a === 0 && c === 0 && i === 0
              ? { mode: 'LIMITED', max: 10, unit: 'DAY', unitCount: 1 }
              : { mode: 'INHERIT' },
          campaignId,
          advertiserId: advIds[a] as string,
        });
      }
      const start = iosOfCampaign.reduce((m, x) => minIso(m, x.start), '9999-12-31');
      const lastEnd = iosOfCampaign.reduce((m, x) => maxIso(m, x.end), '0000-01-01');
      const pausedAt =
        status === 'PAUSED' || status === 'ARCHIVED' ? addDays(T, -GAP_PAUSE_DAYS) : null;
      campaignInfo.push({
        a,
        c,
        id: campaignId,
        status,
        start,
        end: a === 0 && c === 1 ? null : lastEnd,
        pausedAt,
      });
      ios.push(...iosOfCampaign);
    }
  }

  const campaignOf = (io: IoDraft) => campaignInfo.find((x) => x.a === io.a && x.c === io.c)!;

  // names and statuses of IOs
  const themes = root
    .child('themes')
    .shuffle([
      'Festive Sale',
      'Brand Awareness',
      'App Launch',
      'Back to School',
      'Monsoon Offers',
      'New Arrivals',
      'Loyalty Push',
      'Summer Reach',
      'Retargeting Always On',
      'Product Launch',
      'Year End Clearance',
      'Weekend Flash',
    ]);
  ios.forEach((io, n) => {
    const camp = campaignOf(io);
    const label =
      io.recipe.ioType === 'CTV_OTT'
        ? 'CTV & OTT'
        : io.recipe.ioType === 'DOOH'
          ? 'DOOH'
          : {
              BRAND_AWARENESS: 'Awareness',
              CLICKS: 'Clicks',
              CONVERSIONS: 'Conversions',
              CUSTOM: 'Custom',
              NONE: 'No objective',
            }[io.recipe.objective];
    io.name = `${themes[n % themes.length]} | ${label} | IO ${io.c + 1}.${io.i + 1}`;
    if (camp.status === 'ARCHIVED') io.status = 'ARCHIVED';
  });
  const ioAt = (a: number, c: number, i: number) =>
    ios.find((x) => x.a === a && x.c === c && x.i === i);

  // line items
  const fxFactor = (a: number) => inrTo(advCurrency[a] as string, FX_PER_USD);
  const CONVERSION_CYCLE = ['ALL', 'POST_CLICK_ONLY', 'PERCENTAGE'] as const;
  let liCounter = 0;
  for (const io of ios) {
    const r = liRng.child(`io${io.key}`);
    for (let l = 0; l < knobs.lineItemsPerIo; l++) {
      const type = io.recipe.liTypes[l % io.recipe.liTypes.length] as string;
      const format = formatForType(type);
      const isAuto = io.recipe.control === 'IO_AUTOMATED';
      const n = liCounter++;
      const cpmBase = FORMAT_PARAMS[format].clearCpm * fxFactor(io.a);
      let bidKind: LiDraft['bidKind'] = 'AUTOMATED';
      let bidGoal: string | null = null;
      let bidTarget: number | null = null;
      let fixedCpm: number | null = null;
      if (!isAuto) {
        if (type === 'AUDIO' || type.startsWith('DOOH') || io.recipe.objective === 'CUSTOM') {
          bidKind = 'FIXED';
          fixedCpm = round(cpmBase * 1.15, 0.5);
        } else if (io.recipe.objective === 'BRAND_AWARENESS') {
          bidGoal = type === 'DISPLAY' ? 'MAX_VIEWABLE_IMPRESSIONS' : 'MAX_REACH';
        } else if (io.recipe.objective === 'CLICKS') {
          bidGoal = 'MAX_CLICKS';
        } else if (io.recipe.objective === 'CONVERSIONS') {
          bidGoal = type === 'DISPLAY' ? 'TARGET_CPA' : 'MAX_CONVERSIONS';
          if (bidGoal === 'TARGET_CPA')
            bidTarget = round(io.recipe.kpiValue ?? 500, 5) * fxFactor(io.a);
        } else {
          bidGoal = type === 'DISPLAY' ? 'MAX_REACH' : 'TARGET_CPM';
          if (bidGoal === 'TARGET_CPM') bidTarget = round(cpmBase, 1);
        }
      }
      io.lis.push({
        a: io.a,
        c: io.c,
        i: io.i,
        l,
        key: `${io.key}.${l}`,
        id: id(`li${io.key}.${l}`),
        name: `${type
          .replace(/_/g, ' ')
          .toLowerCase()
          .replace(/^./, (s) =>
            s.toUpperCase(),
          )} ${['prospecting', 'retargeting', 'always on', 'reach', 'launch', 'seasonal'][l % 6]} ${n + 1}`,
        type,
        format,
        status: 'ACTIVE',
        flightMode: 'INHERIT_IO',
        budgetMode: 'UNLIMITED_UP_TO_IO',
        bidKind,
        bidGoal,
        bidTarget,
        fixedCpm,
        freq: { mode: 'INHERIT' },
        conversionMode: CONVERSION_CYCLE[n % 3] as LiDraft['conversionMode'],
        conversionPct: CONVERSION_CYCLE[n % 3] === 'PERCENTAGE' ? 50 : null,
        attributionModelId: null,
        optimizedTargeting: false,
        useTemplate: false,
        verifier: false,
        narrow: false,
        smallAudience: false,
        noCreatives: false,
        sizeMismatch: false,
        disapproved: null,
        tags: [],
        share: 0.8 + r.float() * 0.4,
        stopAt: null,
        stopReason: null,
        neverLive: false,
        supplyMul: 1,
        passOverride: {},
        reasonOverride: {},
        ctrMul: 1,
        cvrMul: 1,
        budgetCap: null,
        creativeIds: [],
      });
    }
  }

  // ---------------------------------------------------------------- status variety (always, not a "problem")
  const liAt = (a: number, c: number, i: number, l: number) => ioAt(a, c, i)?.lis[l];
  const setIoStatus = (io: IoDraft | undefined, status: EntityStatus, label: string) => {
    if (!io) {
      coverageGaps.push(`no IO slot for status ${label}`);
      return;
    }
    io.status = status;
  };
  // Draft IO and Paused IO live in the paused campaign of the first advertiser.
  const draftIo = ioAt(0, 2, 1);
  setIoStatus(draftIo, 'DRAFT', 'IO draft');
  const pausedIo = ioAt(0, 2, 0);
  setIoStatus(pausedIo, 'PAUSED', 'IO paused');
  if (pausedIo) {
    pausedIo.liveUntil = addDays(T, -GAP_PAUSE_DAYS);
    pausedIo.stopReason = 'PARENT_PAUSED';
  }
  const completedIo = ioAt(0, 0, 1);
  if (!completedIo) coverageGaps.push('no completed IO slot');
  const draftLi = liAt(0, 2, 0, 2);
  if (draftLi) draftLi.status = 'DRAFT';
  else coverageGaps.push('no draft line item slot');
  const pausedLi = liAt(0, 1, 0, 2);
  if (pausedLi) {
    pausedLi.status = 'PAUSED';
    pausedLi.stopAt = addDays(T, -GAP_PAUSE_DAYS);
    pausedLi.stopReason = 'PAUSED';
  } else coverageGaps.push('no paused line item slot');
  for (const io of ios) {
    for (const li of io.lis) {
      if (io.status === 'ARCHIVED') li.status = 'ARCHIVED';
      if (io.status === 'DRAFT') li.status = 'DRAFT';
    }
  }
  // An individually archived line item inside an active IO.
  const archivedLi = liAt(0, 0, 1, 2);
  if (archivedLi) {
    archivedLi.status = 'ARCHIVED';
    archivedLi.stopAt = addDays(T, -20);
    archivedLi.stopReason = 'ENDED';
  }

  // ---------------------------------------------------------------- always-on feature picks
  const healthyLi = liAt(0, 0, 0, 0);
  if (healthyLi) {
    healthyLi.optimizedTargeting = true;
    healthyLi.verifier = true;
  }
  const templateLi = liAt(1, 0, 0, 1) ?? liAt(0, 0, 0, 1);
  if (templateLi) templateLi.useTemplate = true;
  const nonPrimary = liAt(1, 0, 0, 1) ?? liAt(0, 0, 0, 1);
  if (nonPrimary) nonPrimary.attributionModelId = 'LAST_CLICK';

  // ---------------------------------------------------------------- stories
  const tagLi = (li: LiDraft | undefined, tag: PlantedProblem, note: string) => {
    if (!li) {
      coverageGaps.push(`story ${tag}: no line item slot`);
      return;
    }
    li.tags.push(tag);
    stories.push({ tag, entity: 'LINE_ITEM', entityId: li.id, entityName: li.name, note });
  };
  const tagIo = (io: IoDraft | undefined, tag: PlantedProblem, note: string) => {
    if (!io) {
      coverageGaps.push(`story ${tag}: no IO slot`);
      return;
    }
    io.tags.push(tag);
    stories.push({ tag, entity: 'INSERTION_ORDER', entityId: io.id, entityName: io.name, note });
  };

  if (has('healthy'))
    tagLi(
      healthyLi,
      'healthy',
      'Everything on: delivers evenly, no filters beyond normal targeting.',
    );
  if (has('bid-too-low')) {
    const li = liAt(1, 0, 0, 0);
    if (li) {
      li.bidKind = 'FIXED';
      li.bidGoal = null;
      li.bidTarget = null;
      li.fixedCpm = round(FORMAT_PARAMS[li.format].clearCpm * fxFactor(1) * 0.09, 0.1);
      li.passOverride.belowMinBid = 0.04;
    }
    tagLi(
      li,
      'bid-too-low',
      'Fixed bid far below the exchange floors: A.BELOW_MIN_BID filters most bids.',
    );
  }
  if (has('targeting-too-narrow')) {
    const li = liAt(1, 0, 0, 2);
    if (li) {
      li.narrow = true;
      li.passOverride.targeting = 0.004;
      li.reasonOverride.targeting = NARROW_TARGETING_REASONS;
    }
    tagLi(
      li,
      'targeting-too-narrow',
      'One city, one tiny audience and a rare language: T.GEO and T.AUDIENCE filter almost everything.',
    );
  }
  if (has('creative-disapproved-exchange')) {
    const li1 = liAt(1, 0, 1, 1);
    if (li1) li1.disapproved = 'google-ad-manager';
    tagLi(
      li1,
      'creative-disapproved-exchange',
      'All assigned creatives are disapproved on Google Ad Manager and approved on the other exchanges.',
    );
    const li2 = liAt(0, 1, 0, 0);
    if (li2) li2.disapproved = 'freewheel-ssp';
    tagLi(
      li2,
      'creative-disapproved-exchange',
      'All assigned creatives are disapproved on FreeWheel SSP.',
    );
  }
  if (has('creative-size-mismatch')) {
    const li = liAt(0, 0, 0, 2);
    if (li) {
      li.sizeMismatch = true;
      li.passOverride.creative = 0.06;
      li.reasonOverride.creative = SIZE_MISMATCH_REASONS;
    }
    tagLi(
      li,
      'creative-size-mismatch',
      'The only creative is a 468x60 banner that fits almost no slot: C.SIZE_MISMATCH.',
    );
  }
  if (has('budget-exhausted')) {
    const li = liAt(0, 0, 0, 1);
    if (li) {
      li.budgetMode = 'FIXED';
      li.reasonOverride.budget = EXHAUSTED_BUDGET_REASONS;
    }
    tagLi(
      li,
      'budget-exhausted',
      'Fixed line item budget used up about two weeks ago: B.LINE_ITEM_BUDGET.',
    );
  }
  if (has('frequency-cap-too-tight')) {
    const li = liAt(0, 1, 0, 1);
    if (li) {
      li.freq = { mode: 'LIMITED', max: 1, unit: 'MONTH', unitCount: 1 };
      li.passOverride.frequency = 0.22;
      li.reasonOverride.frequency = TIGHT_FREQUENCY_REASONS;
    }
    tagLi(
      li,
      'frequency-cap-too-tight',
      'Cap of 1 impression per month: F.LINE_ITEM filters most eligible requests.',
    );
  }
  if (has('paused-li'))
    tagLi(pausedLi, 'paused-li', 'Line item was paused 12 days ago; no funnel rows since.');
  if (has('li-under-paused-io')) {
    const io = ioAt(1, 1, 1);
    if (io) {
      io.status = 'PAUSED';
      io.liveUntil = addDays(T, -5);
      io.stopReason = 'PARENT_PAUSED';
    }
    tagLi(
      io?.lis[0],
      'li-under-paused-io',
      'Line item is Active but its insertion order was paused 5 days ago.',
    );
  }
  if (has('li-no-creatives')) {
    const li = liAt(1, 0, 1, 2);
    if (li) {
      li.noCreatives = true;
      li.passOverride.creative = 0;
      li.reasonOverride.creative = NO_CREATIVE_REASONS;
    }
    tagLi(
      li,
      'li-no-creatives',
      'No creative assigned: C.NONE_ASSIGNED filters every eligible request.',
    );
  }
  if (has('li-future-flight')) {
    const li = liAt(1, 1, 0, 1);
    if (li) {
      li.flightMode = 'CUSTOM';
      li.flightStart = addDays(T, 10);
      // inside the IO flight: only the conflicting-settings story leaves it on purpose
      li.flightEnd = minIso(addDays(T, 40), ioAt(1, 1, 0)?.end ?? addDays(T, 40));
      li.neverLive = true;
    }
    tagLi(
      li,
      'li-future-flight',
      'Custom flight starts in 10 days; the line item has not started.',
    );
  }
  if (has('io-conflicting-settings')) {
    const io = ioAt(1, 1, 0);
    const li = io?.lis[0];
    if (io && li) {
      li.flightMode = 'CUSTOM';
      li.flightStart = addDays(io.end, 3);
      li.flightEnd = addDays(io.end, 30);
      li.neverLive = true;
      li.budgetMode = 'FIXED';
      li.budgetAmount = round(io.budget * 0.05, 100);
    }
    tagIo(
      io,
      'io-conflicting-settings',
      'Line item flight starts after the IO flight ends (CONF.LI_FLIGHT_OUTSIDE_IO) and fixed budgets are far below the IO budget.',
    );
  }
  if (has('io-underpacing')) {
    const io60 = ioAt(0, 1, 0);
    if (io60) io60.targetPace = 0.6;
    tagIo(
      io60,
      'io-underpacing',
      'Underpacing about 60 percent: tight frequency cap, a paused line item and a creative disapproved on one exchange.',
    );
    const io85 = ioAt(1, 0, 0);
    if (io85) io85.targetPace = 0.85;
    tagIo(
      io85,
      'io-underpacing',
      'Underpacing about 85 percent: one line item bids too low and one is targeted too narrowly.',
    );
  }
  if (has('io-overpacing')) {
    const io = ioAt(0, 1, 1);
    if (io) io.targetPace = 1.15;
    tagIo(io, 'io-overpacing', 'Delivers about 115 percent of plan (informational).');
  }
  if (has('io-underperforming')) {
    const io = ioAt(1, 0, 1);
    if (io) for (const li of io.lis) li.cvrMul = 0.35;
    tagIo(
      io,
      'io-underperforming',
      'CPA more than 20 percent worse than the IO goal over the last 7 days.',
    );
  }
  if (has('audience-too-small')) {
    const li = liAt(1, 0, 0, 1);
    if (li) {
      li.smallAudience = true;
      li.passOverride.targeting = 0.012;
    }
    tagLi(li, 'audience-too-small', 'Includes an audience of 800 users, below the minimum size.');
  }

  // ---------------------------------------------------------------- stop dates and flights
  for (const io of ios) {
    const camp = campaignOf(io);
    if (camp.status === 'PAUSED' || camp.status === 'ARCHIVED') {
      io.liveUntil = io.liveUntil ? minIso(io.liveUntil, camp.pausedAt as string) : camp.pausedAt;
      io.stopReason = camp.status === 'ARCHIVED' ? 'ENDED' : 'PARENT_PAUSED';
    }
  }

  // ---------------------------------------------------------------- creatives
  const creatives: Prisma.CreativeCreateManyInput[] = [];
  const creativeAssets: Prisma.CreativeAssetCreateManyInput[] = [];
  const creativeReviews: Prisma.CreativeReviewCreateManyInput[] = [];
  const creativeAssignments: Prisma.CreativeAssignmentCreateManyInput[] = [];
  const pools: Record<string, { id: string; spec: CreativeSpec }[]>[] = [];
  const legacyByAdv: (string | null)[] = [];
  const specs = creativeSpecs(knobs.creativesPerAdvertiser);
  const makeCreative = (
    a: number,
    spec: CreativeSpec,
    n: number,
    mode: 'ok' | 'pending' | 'not-servable' | 'restricted',
  ) => {
    const cid = id(`cr${a}.${spec.slug}`);
    const created = toDate(addDays(T, -50 + (n % 10)));
    creatives.push({
      id: cid,
      sandboxId: sid,
      advertiserId: advIds[a] as string,
      name: `${names[a]} ${spec.label} ${spec.width ? `${spec.width}x${spec.height}` : ''}`.trim(),
      status: 'ACTIVE',
      kind: spec.kind,
      formatKey: spec.pool,
      source: 'DV360',
      width: spec.width,
      height: spec.height,
      durationSeconds: spec.durationSeconds,
      landingPageUrl: `${brandWebsite(names[a] as string)}/landing/${n + 1}`,
      requiresHtml5: spec.kind === 'STANDARD_HTML5',
      aiLabel: 'NOT_AI_GENERATED',
      dv360Review:
        mode === 'pending' ? 'PENDING' : mode === 'not-servable' ? 'NOT_SERVABLE' : 'SERVABLE',
      dv360Feedback:
        mode === 'not-servable'
          ? 'Asset fails technical checks (seed example)'
          : mode === 'restricted'
            ? 'Restricted: not eligible in some countries (seed example)'
            : null,
      reviewCompletedAt: mode === 'pending' ? null : toDate(addDays(T, -49 + (n % 10))),
      createdAt: created,
      updatedAt: created,
    });
    creativeAssets.push({
      id: id(`asset${a}.${spec.slug}`),
      sandboxId: sid,
      advertiserId: advIds[a] as string,
      creativeId: cid,
      role: 'MAIN',
      fileName: `${spec.slug}-${spec.width}x${spec.height}.${spec.mime === 'image/png' ? 'png' : spec.mime === 'video/mp4' ? 'mp4' : spec.mime === 'audio/mpeg' ? 'mp3' : 'zip'}`,
      mimeType: spec.mime,
      sizeBytes: spec.sizeBytes,
      storageKey: `seed/${sid}/${cid}/main`,
      width: spec.width || null,
      height: spec.height || null,
      durationSeconds: spec.durationSeconds,
    });
    return cid;
  };
  const reviewCreative = (
    cid: string,
    pool: string,
    disapprovedOn: string | null,
    pending: boolean,
  ) => {
    const fmt: Format =
      pool === 'video'
        ? 'video_instream'
        : pool === 'ctv'
          ? 'ctv'
          : pool === 'audio'
            ? 'audio'
            : pool === 'dooh'
              ? 'dooh'
              : 'display';
    for (const ex of formatExchanges(fmt)) {
      const bad = disapprovedOn === ex.code;
      creativeReviews.push({
        id: id(`rev:${cid}:${ex.code}`),
        sandboxId: sid,
        creativeId: cid,
        exchangeId: exchangeId(ex.code),
        status: pending ? 'PENDING' : bad ? 'DISAPPROVED' : 'APPROVED',
        sslStatus: pending ? 'PENDING' : 'APPROVED',
        feedback: bad ? 'Destination does not match the ad (seed example)' : null,
        lastSyncAt: toDate(addDays(T, -2)),
        decideAt: pending ? null : toDate(addDays(T, -48)),
      });
    }
  };
  for (let a = 0; a < knobs.advertisers; a++) {
    const pool: Record<string, { id: string; spec: CreativeSpec }[]> = {
      display: [],
      video: [],
      ctv: [],
      audio: [],
      dooh: [],
    };
    specs.forEach((spec, n) => {
      // The last display creative is pending review, the one before it is not servable, one video is restricted.
      const isPendingSlot = n === specs.length - 1 && specs.length > 6;
      const mode: 'ok' | 'pending' | 'not-servable' | 'restricted' = isPendingSlot
        ? 'pending'
        : spec.slug === 'cr6'
          ? 'not-servable'
          : spec.slug === 'cr8'
            ? 'restricted'
            : 'ok';
      const cid = makeCreative(a, spec, n, mode);
      reviewCreative(cid, spec.pool, null, mode === 'pending');
      // Pending and not-servable creatives stay out of the assignment pools.
      if (mode === 'ok' || mode === 'restricted') pool[spec.pool]!.push({ id: cid, spec });
    });
    pools.push(pool);
    if (has('creative-size-mismatch')) {
      const spec: CreativeSpec = { ...LEGACY_BANNER, slug: 'legacy' };
      const cid = makeCreative(a, spec, specs.length, 'ok');
      reviewCreative(cid, 'display', null, false);
      legacyByAdv.push(cid);
    } else legacyByAdv.push(null);
  }

  // ---------------------------------------------------------------- targeting templates (6 per advertiser, one archived)
  const targetingTemplates: Prisma.TargetingTemplateCreateManyInput[] = [];
  const targetingAssignments: Prisma.TargetingAssignmentCreateManyInput[] = [];
  const TEMPLATE_DEFS = [
    { name: 'Display India broad', type: 'DISPLAY' },
    { name: 'Display mobile only', type: 'DISPLAY' },
    { name: 'Video reach', type: 'VIDEO' },
    { name: 'CTV premium', type: 'CTV' },
    { name: 'YouTube core', type: 'YT_VIDEO' },
    { name: 'Demand Gen audiences', type: 'DEMAND_GEN' },
  ] as const;
  const templateByAdv: string[][] = [];
  for (let a = 0; a < knobs.advertisers; a++) {
    const ids: string[] = [];
    TEMPLATE_DEFS.forEach((t, n) => {
      const tid = id(`tpl${a}.${n}`);
      ids.push(tid);
      targetingTemplates.push({
        id: tid,
        sandboxId: sid,
        advertiserId: advIds[a] as string,
        name: `${names[a]} ${t.name}`,
        description: 'Seeded template',
        lineItemType: t.type,
        optimizedTargeting: false,
        exchangeIds: [],
        status: n === 5 ? 'ARCHIVED' : 'ACTIVE',
        createdAt: toDate(addDays(T, -55)),
        updatedAt: toDate(addDays(T, -55)),
      });
      targetingAssignments.push(
        ...targetingRowsForTemplate(tid, `tpl${a}.${n}`, {
          sandboxId: sid,
          country: advCountry[a] as 'IN' | 'SG',
        }),
      );
    });
    templateByAdv.push(ids);
    targetingAssignments.push(...advertiserLockedRows(advIds[a] as string, `adv${a}`, sid));
  }

  // ---------------------------------------------------------------- emit campaigns, IOs, fees, line items
  const campaigns: Prisma.CampaignCreateManyInput[] = [];
  const campaignBudgets: Prisma.CampaignBudgetCreateManyInput[] = [];
  const insertionOrders: Prisma.InsertionOrderCreateManyInput[] = [];
  const budgetSegments: Prisma.BudgetSegmentCreateManyInput[] = [];
  const partnerCosts: Prisma.PartnerCostCreateManyInput[] = [];
  const lineItems: Prisma.LineItemCreateManyInput[] = [];
  const profiles: LiProfile[] = [];
  const alerts: Prisma.AlertCreateManyInput[] = [];

  for (const camp of campaignInfo) {
    const goal = GOALS[
      (camp.a * knobs.campaignsPerAdvertiser + camp.c) % GOALS.length
    ] as (typeof GOALS)[number];
    const created = toDate(addDays(camp.start, -2));
    const campaignIos = ios.filter((x) => x.a === camp.a && x.c === camp.c);
    const planned = campaignIos.reduce((s, x) => s + x.budget, 0);
    const isFirst = camp.a === 0 && camp.c === 0;
    campaigns.push({
      id: camp.id,
      sandboxId: sid,
      advertiserId: advIds[camp.a] as string,
      name: `${names[camp.a]} | ${themes[(camp.a * 3 + camp.c + 5) % themes.length]}`,
      status: camp.status,
      goal: goal.goal,
      kpi: goal.kpi,
      kpiValue: goal.kpi === 'OTHER' ? null : String(goal.value),
      kpiOtherText: goal.kpi === 'OTHER' ? 'Store visits per 1,000 impressions' : null,
      creativeTypes: ['DISPLAY', 'VIDEO'],
      plannedSpend: campaignIos.every((x) => x.recipe.budgetUnit === 'CURRENCY')
        ? money(planned)
        : null,
      plannedStart: toDate(camp.start),
      plannedEnd: camp.end ? toDate(camp.end) : null,
      freqMode: isFirst ? 'LIMITED' : 'UNLIMITED',
      freqMaxExposures: isFirst ? 3 : null,
      freqUnit: isFirst ? 'WEEK' : null,
      freqUnitCount: isFirst ? 1 : null,
      landingPageUrls:
        camp.a === 0 && camp.c === 1
          ? [
              `${brandWebsite(names[0] as string)}/offers`,
              `${brandWebsite(names[0] as string)}/new`,
            ]
          : [],
      keywords:
        camp.a === 0 && camp.c === 1 ? ['festive offers', 'new arrivals', 'free delivery'] : [],
      budgetUnit: 'CURRENCY',
      createdAt: created,
      updatedAt: created,
    });
    // Budget rows: three on the first campaign, none on the second ("Unknown"), one on the others.
    if (isFirst) {
      const part = round(planned / 3, 100);
      ['Q1 flight', 'Festive burst', 'Always on'].forEach((label, n) =>
        campaignBudgets.push({
          id: id(`cbud${camp.a}.${camp.c}.${n}`),
          sandboxId: sid,
          campaignId: camp.id,
          amount: money(n === 2 ? planned - 2 * part : part),
          name: label,
          startDate: toDate(camp.start),
          endDate: camp.end ? toDate(camp.end) : null,
        }),
      );
    } else if (!(camp.a === 0 && camp.c === 1)) {
      campaignBudgets.push({
        id: id(`cbud${camp.a}.${camp.c}.0`),
        sandboxId: sid,
        campaignId: camp.id,
        amount: money(planned),
        name: 'Campaign budget',
        startDate: toDate(camp.start),
        endDate: camp.end ? toDate(camp.end) : null,
      });
    }
  }

  const tctx: Record<number, TargetingContext> = {};
  for (let a = 0; a < knobs.advertisers; a++) {
    tctx[a] = {
      sandboxId: sid,
      advertiserId: advIds[a] as string,
      country: advCountry[a] as 'IN' | 'SG',
      audienceIds: advAudienceIds[a] as string[],
      smallAudienceId: advSmallAudience[a] ?? null,
    };
  }
  const tgtRng = root.child('targeting');
  const asgRng = root.child('assign');
  const alertTimes = (key: string) => {
    const first = toDate(addDays(T, -((hashString(key) % 5) + 2)));
    return { firstSeenAt: first, lastSeenAt: toDate(T) };
  };
  const addAlert = (
    key: string,
    a: number,
    c: number,
    ioId: string | null,
    liId: string | null,
    type: Prisma.AlertCreateManyInput['type'],
    severity: 'CRITICAL' | 'NEEDS_ATTENTION',
    category: Prisma.AlertCreateManyInput['category'],
    title: string,
    detail: string,
    code: string,
    story: PlantedProblem,
    affected = 1,
  ) => {
    alerts.push({
      id: id(`alert:${key}`),
      sandboxId: sid,
      advertiserId: advIds[a] as string,
      campaignId: id(`cmp${a}.${c}`),
      ioId,
      lineItemId: liId,
      type,
      severity,
      category,
      state: 'OPEN',
      title,
      detail,
      affectedCount: affected,
      diagnosticCode: code,
      payload: { seed: true, story },
      ...alertTimes(key),
    });
  };

  for (const io of ios) {
    const r = io.recipe;
    const ioCreated = toDate(addDays(io.start, -1));
    insertionOrders.push({
      id: io.id,
      sandboxId: sid,
      campaignId: io.campaignId,
      advertiserId: io.advertiserId,
      name: io.name,
      status: io.status,
      type: r.ioType,
      objective: r.objective,
      budgetUnit: r.budgetUnit,
      pacingPeriod: r.pacingPeriod,
      pacingType: r.pacingType,
      dailyMaxAmount:
        r.pacingPeriod === 'DAILY'
          ? money(round((io.budget / (daysBetween(io.start, io.end) + 1)) * 1.1, 100))
          : null,
      kpi: r.kpi,
      kpiValue:
        r.kpiValue === null
          ? null
          : String(
              r.kpiValue *
                (r.kpi === 'CPM' || r.kpi === 'CPC' || r.kpi === 'CPA' ? fxFactor(io.a) : 1),
            ),
      bidBudgetControl: r.control,
      optimizeTarget: r.optimizeTarget ?? null,
      prioritizeFullBudget: true,
      autoBudgetAllocation: r.autoBudgetAllocation,
      ytReachFreqOptimization: r.ytReachFreqOptimization,
      freqMode: io.freq.mode,
      freqMaxExposures: io.freq.max ?? null,
      freqUnit: io.freq.unit ?? null,
      freqUnitCount: io.freq.unitCount ?? null,
      integrationCode: `IO${io.a}${io.c}${io.i}`,
      createdAt: ioCreated,
      updatedAt: ioCreated,
    });
    io.segments.forEach((s, n) =>
      budgetSegments.push({
        id: id(`seg${io.key}.${n}`),
        sandboxId: sid,
        ioId: io.id,
        ordinal: n,
        amount: money(s.amount),
        description:
          io.segments.length === 3 ? ['Launch', 'Mid flight', 'Closing push'][n] : 'Flight budget',
        startDate: toDate(s.start),
        endDate: toDate(s.end),
        externalBudgetId: `MP${io.a}${io.c}${io.i}${n}`,
        createdAt: ioCreated,
        updatedAt: ioCreated,
      }),
    );
    // Locked DV360 media fee 1 on every IO; the fee IO also has CPM fee 1 and media fee 2.
    partnerCosts.push({
      id: id(`fee${io.key}.dv`),
      sandboxId: sid,
      ioId: io.id,
      kind: 'MEDIA_FEE',
      slot: 1,
      feeType: 'DV360_FEE',
      percentage: '10.0000',
      invoiced: true,
      isSystem: true,
    });
    if (io.feeIo) {
      partnerCosts.push({
        id: id(`fee${io.key}.cpm1`),
        sandboxId: sid,
        ioId: io.id,
        kind: 'CPM_FEE',
        slot: 1,
        feeType: 'THIRD_PARTY_AD_SERVER',
        amount: money(12 * fxFactor(io.a)),
        invoiced: false,
        isSystem: false,
      });
      partnerCosts.push({
        id: id(`fee${io.key}.media2`),
        sandboxId: sid,
        ioId: io.id,
        kind: 'MEDIA_FEE',
        slot: 2,
        feeType: 'AGENCY_TRADING_DESK',
        percentage: '8.0000',
        invoiced: false,
        isSystem: false,
      });
    }

    // Plan shares among the line items that are meant to deliver. Story line items get a small share of the IO budget,
    // so that the IO keeps a believable pace (module 01 3.3) while the story line items still show their problem.
    for (const li of io.lis) li.share *= STORY_SHARE[li.tags[0] ?? ''] ?? 1;
    const planned = io.lis.filter(
      (li) => (li.status === 'ACTIVE' || li.status === 'PAUSED') && !li.neverLive,
    );
    const shareSum = planned.reduce((s, li) => s + li.share, 0) || 1;
    const ioProfiles: { li: LiDraft; profile: LiProfile }[] = [];

    for (const li of io.lis) {
      const created = toDate(addDays(io.start, -1));
      const format = li.format;
      const flightStart = li.flightMode === 'CUSTOM' ? (li.flightStart as string) : io.start;
      const flightEnd = li.flightMode === 'CUSTOM' ? (li.flightEnd as string) : io.end;
      const fx = fxFactor(li.a);
      const isFeeIo = io.feeIo;
      const verificationCpm = li.verifier ? 20.95 * fx : 0;

      // delivery profile
      const passes = { ...healthyPasses(format) };
      const healthyProduct = passProduct(passes);
      Object.assign(passes, li.passOverride);
      const reasons = { ...defaultReasons(), ...li.reasonOverride };
      const live =
        li.status === 'ACTIVE' ||
        li.status === 'PAUSED' ||
        (li.status === 'ARCHIVED' && li.stopAt !== null);
      const ioLiveFrom = maxIso(flightStart, addDays(T, -knobs.historyDays));
      let liveUntil: string | null = minIso(flightEnd, addDays(T, -1));
      let stopReason: LiProfile['stopReason'] = flightEnd < T ? 'ENDED' : null;
      const stops: [string | null, LiProfile['stopReason']][] = [
        [li.stopAt, li.stopReason],
        [io.liveUntil, io.stopReason],
      ];
      for (const [d, why] of stops)
        if (d && d < liveUntil) {
          liveUntil = d;
          stopReason = why;
        }
      const neverLive =
        li.neverLive ||
        !live ||
        io.status === 'DRAFT' ||
        li.status === 'DRAFT' ||
        ioLiveFrom > liveUntil;
      // All-in CPM the plan assumes: expected clearing price plus the fees the IO budget has to cover.
      const mediaFee2Pct = isFeeIo ? 8 : 0;
      const plannedCpm =
        FORMAT_PARAMS[format].clearCpm *
          fx *
          expectedPriceFactor(format) *
          (1 + DV360_FEE_PCT + mediaFee2Pct / 100) +
        (isFeeIo ? 12 * fx : 0) +
        verificationCpm;
      const segs: PlannedSegment[] = io.segments.map((s) => {
        const segDays = daysBetween(s.start, s.end) + 1;
        const share = li.status === 'DRAFT' || li.neverLive ? 0 : li.share / shareSum;
        const perDay = (s.amount / segDays) * share;
        return {
          start: s.start,
          end: s.end,
          dailyImpressions:
            io.recipe.budgetUnit === 'IMPRESSIONS'
              ? Math.round(perDay)
              : Math.round((perDay / plannedCpm) * 1000),
        };
      });
      let budgetCap: number | null = null;
      if (li.tags.includes('budget-exhausted')) {
        // Budget used up 14 days ago: 20 days of healthy spend before that.
        const exhaustedAt = addDays(T, -14);
        const daily = ((segs[0]?.dailyImpressions ?? 0) * plannedCpm) / 1000;
        const spendDays = Math.max(
          1,
          daysBetween(maxIso(flightStart, addDays(exhaustedAt, -20)), exhaustedAt),
        );
        budgetCap = round(daily * spendDays, 100);
        li.budgetAmount = budgetCap;
      }
      lineItems.push({
        id: li.id,
        sandboxId: sid,
        ioId: io.id,
        campaignId: io.campaignId,
        advertiserId: io.advertiserId,
        name: li.name,
        status: li.status,
        type: li.type as Prisma.LineItemCreateManyInput['type'],
        appAdFormat:
          li.type === 'MOBILE_APP_INSTALL' || li.type === 'ADS_IN_MOBILE_APPS'
            ? li.l % 2 === 0
              ? 'DISPLAY'
              : 'VIDEO'
            : null,
        mobileAppPlatform: li.type === 'MOBILE_APP_INSTALL' ? 'ANDROID' : null,
        mobileAppId: li.type === 'MOBILE_APP_INSTALL' ? 'com.example.pixel.harbor.play' : null,
        ytSurfaces: [],
        inventoryQuality: 'AUTHORIZED_DIRECT_SELLERS_AND_RESELLERS',
        optimizedTargeting: li.optimizedTargeting,
        targetingTemplateId: li.useTemplate
          ? (templateByAdv[li.a]?.[li.format === 'video_instream' ? 2 : 0] ?? null)
          : null,
        flightMode: li.flightMode,
        flightStart: li.flightMode === 'CUSTOM' ? toDate(flightStart) : null,
        flightEnd: li.flightMode === 'CUSTOM' ? toDate(flightEnd) : null,
        budgetMode: li.budgetMode,
        budgetAmount: li.budgetMode === 'FIXED' ? money(li.budgetAmount ?? 0) : null,
        pacingPeriod: 'FLIGHT',
        pacingType: io.recipe.pacingType === 'AHEAD' ? 'AHEAD' : 'EVEN',
        bidKind: li.bidKind,
        bidGoal: li.bidGoal as Prisma.LineItemCreateManyInput['bidGoal'],
        bidPriority: li.bidTarget !== null ? 'TARGET_VALUE' : 'SPEND_FULL_BUDGET',
        bidTargetValue: li.bidTarget === null ? null : money(li.bidTarget),
        fixedBidCpm: li.fixedCpm === null ? null : money(li.fixedCpm),
        creativeOptimization: true,
        freqMode: li.freq.mode,
        freqMaxExposures: li.freq.max ?? null,
        freqUnit: li.freq.unit ?? null,
        freqUnitCount: li.freq.unitCount ?? null,
        conversionCounting: li.conversionMode,
        conversionCountingPct: li.conversionPct,
        attributionModelId: li.attributionModelId,
        euPoliticalAds: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADS',
        revenueModelType: 'TOTAL_MEDIA_COST_MARKUP',
        revenueMarkupPct: '0.0000',
        relatedVideoIds: [],
        integrationCode: `LI${li.a}${li.c}${li.i}${li.l}`,
        createdAt: created,
        updatedAt: created,
      });
      if (li.verifier) {
        partnerCosts.push({
          id: id(`fee${li.key}.dv`),
          sandboxId: sid,
          lineItemId: li.id,
          kind: 'CPM_FEE',
          slot: 1,
          feeType: 'DOUBLEVERIFY',
          amount: money(verificationCpm),
          invoiced: false,
          isSystem: false,
        });
      }

      // targeting rows
      const tr = tgtRng.child(li.key);
      targetingAssignments.push(
        ...targetingRowsForLineItem(
          {
            lineItemId: li.id,
            key: li.key,
            isDisplayLike: format === 'display' || format === 'native',
            isVideoLike: format === 'video_instream' || format === 'ctv',
            narrow: li.narrow,
            verifier: li.verifier,
            optimized: li.optimizedTargeting,
            smallAudience: li.smallAudience,
          },
          tctx[li.a] as TargetingContext,
          tr,
        ),
      );

      // creative assignment
      const pool =
        (pools[li.a] as Record<string, { id: string; spec: CreativeSpec }[]>)[
          poolForFormat(format, li.type)
        ] ?? [];
      const ar = asgRng.child(li.key);
      let assigned: string[] = [];
      if (li.noCreatives) assigned = [];
      else if (li.sizeMismatch) assigned = legacyByAdv[li.a] ? [legacyByAdv[li.a] as string] : [];
      else if (pool.length > 0) {
        const want =
          format === 'display' || format === 'native'
            ? ar.int(2, Math.min(5, pool.length))
            : ar.int(1, Math.min(3, pool.length));
        assigned = ar
          .shuffle(pool)
          .slice(0, want)
          .map((p) => p.id);
      }
      li.creativeIds = assigned;
      for (const cid of assigned) {
        creativeAssignments.push({
          id: id(`asg:${li.key}:${cid}`),
          sandboxId: sid,
          lineItemId: li.id,
          creativeId: cid,
          assignedAt: created,
        });
      }
      if (li.disapproved) {
        for (const cid of assigned) {
          const rev = creativeReviews.find(
            (x) => x.creativeId === cid && x.exchangeId === exchangeId(li.disapproved as string),
          );
          if (rev) {
            rev.status = 'DISAPPROVED';
            rev.feedback = 'Destination does not match the ad (seed example)';
          }
        }
      }

      const profile: LiProfile = {
        liId: li.id,
        noiseKey: `${input.seedValue}:${li.key}`,
        ioId: io.id,
        type: li.type,
        format,
        currency: advCurrency[li.a] as string,
        liveFrom: neverLive ? null : ioLiveFrom,
        liveUntil: neverLive ? null : liveUntil,
        stopReason: neverLive ? null : stopReason,
        segments: segs,
        supplyMul: li.supplyMul,
        passes,
        reasons,
        disapprovedExchangeCodes: li.disapproved ? [li.disapproved] : [],
        ctrMul: li.ctrMul,
        cvrMul: li.cvrMul,
        viewMul: 1,
        budgetCap,
        cpmFee1: isFeeIo ? 12 * fx : 0,
        mediaFee2Pct,
        plannedCpm,
        verificationCpm,
        conversionMode: li.conversionMode,
        conversionPct: li.conversionPct ?? 0,
        planShare: li.status === 'DRAFT' || li.neverLive ? 0 : li.share / shareSum,
        healthyProduct,
      };
      ioProfiles.push({ li, profile });
    }

    // Untagged line items absorb the gap between the pace the story asks for and what the story line items deliver.
    const live = ioProfiles.filter(({ profile }) => profile.planShare > 0);
    if (live.length > 0) {
      const isStory = (li: LiDraft) => li.tags.some((t) => t !== 'healthy');
      const tagged = live.filter(({ li }) => isStory(li));
      const untagged = live.filter(({ li }) => !isStory(li));
      const planTotal = live.reduce((x, { profile }) => x + profile.planShare, 0);
      const taggedDelivery = tagged.reduce(
        (x, { profile }) => x + profile.planShare * deliveryFactor(profile, T),
        0,
      );
      const untaggedShare = untagged.reduce((x, { profile }) => x + profile.planShare, 0);
      if (untaggedShare > 0) {
        const m = Math.min(
          1.1,
          Math.max(0.3, (io.targetPace * planTotal - taggedDelivery) / untaggedShare),
        );
        for (const { profile } of untagged) profile.supplyMul = m;
      }
    }
    profiles.push(...ioProfiles.map((x) => x.profile));
  }

  // ---------------------------------------------------------------- alerts from the stories
  for (const s of stories) {
    const li = ios.flatMap((x) => x.lis).find((x) => x.id === s.entityId);
    const io = ios.find((x) => x.id === s.entityId);
    if (s.entity === 'LINE_ITEM' && li) {
      const parent = ios.find((x) => x.lis.includes(li)) as IoDraft;
      if (s.tag === 'li-no-creatives' || s.tag === 'budget-exhausted') {
        addAlert(
          `${s.tag}:${li.key}`,
          li.a,
          li.c,
          parent.id,
          li.id,
          'NO_SPEND',
          'CRITICAL',
          'BUDGET',
          'Line items not spending',
          `${li.name} has not spent anything today or yesterday.`,
          'NO_SPEND_LI',
          s.tag,
        );
      } else if (s.tag === 'creative-disapproved-exchange') {
        addAlert(
          `${s.tag}:${li.key}`,
          li.a,
          li.c,
          parent.id,
          li.id,
          'REJECTED_CREATIVE',
          'NEEDS_ATTENTION',
          'CREATIVES',
          'Creatives rejected',
          `Creatives of ${li.name} are disapproved on ${li.disapproved}.`,
          'CREATIVE_REJECTED',
          s.tag,
        );
      } else if (s.tag === 'audience-too-small') {
        addAlert(
          `${s.tag}:${li.key}`,
          li.a,
          li.c,
          parent.id,
          li.id,
          'LIMITED_AUDIENCE_SIZE',
          'NEEDS_ATTENTION',
          'TARGETING',
          'Line items with a very limited audience',
          `${li.name} targets an audience below the minimum size.`,
          'LIMITED_AUDIENCE_LI',
          s.tag,
        );
      }
    } else if (s.entity === 'INSERTION_ORDER' && io) {
      if (s.tag === 'io-underpacing')
        addAlert(
          `${s.tag}:${io.key}`,
          io.a,
          io.c,
          io.id,
          null,
          'UNDERPACING',
          'NEEDS_ATTENTION',
          'BUDGET',
          'Insertion orders are underpacing',
          `${io.name} is delivering below its budget plan.`,
          'UNDERPACING_IO',
          s.tag,
        );
      if (s.tag === 'io-conflicting-settings')
        addAlert(
          `${s.tag}:${io.key}`,
          io.a,
          io.c,
          io.id,
          null,
          'CONFLICTING_SETTINGS',
          'NEEDS_ATTENTION',
          'SETTINGS',
          'Conflicting settings',
          `${io.name} has conflicting settings which may prevent your budget from being spent.`,
          'CONFLICT_IO',
          s.tag,
        );
      if (s.tag === 'io-underperforming')
        addAlert(
          `${s.tag}:${io.key}`,
          io.a,
          io.c,
          io.id,
          null,
          'UNDERPERFORMING',
          'NEEDS_ATTENTION',
          'PERFORMANCE',
          'Insertion orders are underperforming',
          `${io.name} is more than 20 percent worse than its goal.`,
          'UNDERPERFORMING_IO',
          s.tag,
        );
    }
  }

  // ---------------------------------------------------------------- change history written by SIM_SEED (hidden)
  const changeGroups: Prisma.ChangeGroupCreateManyInput[] = [];
  const changeEntries: Prisma.ChangeEntryCreateManyInput[] = [];
  const addChange = (
    key: string,
    entityType: Prisma.ChangeGroupCreateManyInput['entityType'],
    entityId: string,
    name: string,
    at: string,
    scope: { advertiserId?: string; campaignId?: string; ioId?: string; lineItemId?: string },
    summary: string,
    fieldPath: string,
    label: string,
    newValue: string,
  ) => {
    const gid = id(`chg:${key}`);
    changeGroups.push({
      id: gid,
      sandboxId: sid,
      classroomId: input.classroomId,
      advertiserId: scope.advertiserId ?? null,
      campaignId: scope.campaignId ?? null,
      ioId: scope.ioId ?? null,
      lineItemId: scope.lineItemId ?? null,
      entityType,
      entityId,
      entityName: name,
      actorType: 'SYSTEM',
      systemActor: 'SIM_SEED',
      source: 'SEED',
      summary,
      isHidden: true,
      occurredAt: toDate(at),
    });
    changeEntries.push({
      id: id(`che:${key}`),
      groupId: gid,
      sandboxId: sid,
      kind: 'CREATE',
      fieldPath,
      label,
      newValue,
      sortOrder: 0,
    });
  };
  addChange(
    'partner',
    'PARTNER',
    partnerId,
    partner.name,
    addDays(T, -60),
    {},
    'Partner created by seed',
    'name',
    'Name',
    partner.name,
  );
  advertisers.forEach((adv, a) =>
    addChange(
      `adv${a}`,
      'ADVERTISER',
      adv.id as string,
      adv.name,
      addDays(T, -60),
      { advertiserId: adv.id },
      'Advertiser created by seed',
      'name',
      'Name',
      adv.name,
    ),
  );
  campaigns.forEach((c) =>
    addChange(
      `cmp:${c.id}`,
      'CAMPAIGN',
      c.id as string,
      c.name,
      addDays(T, -50),
      { advertiserId: c.advertiserId, campaignId: c.id },
      'Campaign created by seed',
      'name',
      'Name',
      c.name,
    ),
  );
  insertionOrders.forEach((o) =>
    addChange(
      `io:${o.id}`,
      'INSERTION_ORDER',
      o.id as string,
      o.name,
      addDays(T, -45),
      { advertiserId: o.advertiserId, campaignId: o.campaignId, ioId: o.id },
      'Insertion order created by seed',
      'name',
      'Name',
      o.name,
    ),
  );
  lineItems.forEach((l) =>
    addChange(
      `li:${l.id}`,
      'LINE_ITEM',
      l.id as string,
      l.name,
      addDays(T, -44),
      {
        advertiserId: l.advertiserId,
        campaignId: l.campaignId,
        ioId: l.ioId,
        lineItemId: l.id,
      },
      'Line item created by seed',
      'name',
      'Name',
      l.name,
    ),
  );
  stories.forEach((s, n) => {
    const li = s.entity === 'LINE_ITEM' ? lineItems.find((x) => x.id === s.entityId) : undefined;
    const io =
      s.entity === 'INSERTION_ORDER' ? insertionOrders.find((x) => x.id === s.entityId) : undefined;
    const scope = li
      ? {
          advertiserId: li.advertiserId,
          campaignId: li.campaignId,
          ioId: li.ioId,
          lineItemId: li.id as string,
        }
      : { advertiserId: io!.advertiserId, campaignId: io!.campaignId, ioId: io!.id as string };
    addChange(
      `story${n}`,
      s.entity,
      s.entityId,
      s.entityName,
      T,
      scope,
      `Seed story: ${s.tag}`,
      'seed.story',
      'Seed story',
      s.tag,
    );
  });

  const simStart = toDate(addDays(T, -knobs.historyDays));
  const plan: SandboxPlan = {
    meta: {
      template: input.template,
      seedValue: input.seedValue,
      sandboxId: sid,
      classroomId: input.classroomId,
      today: T,
      knobs,
      planVersion: PLAN_VERSION,
    },
    simClock: {
      simStart,
      tickIndex: knobs.historyDays * 24,
      marketSeed: `market:${input.template}`,
      sandboxSeed: String(input.seedValue),
      paramsVersion: 'seed-stub-1',
    },
    partner,
    partnerExchanges,
    advertisers,
    campaigns,
    campaignBudgets,
    insertionOrders,
    budgetSegments,
    partnerCosts,
    lineItems,
    creatives,
    creativeAssets,
    creativeReviews,
    creativeAssignments,
    audiences,
    targetingTemplates,
    targetingAssignments,
    alerts,
    changeGroups,
    changeEntries,
    profiles,
    stories,
    coverageGaps,
  };
  coverageGaps.push(...checkCoverage(plan, knobs));
  return plan;
}

/** Module 06/07/08 3.4 requirements that depend on the layout; returns the ones that are missing. */
export function checkCoverage(plan: SandboxPlan, knobs: SeedKnobs): string[] {
  const gaps: string[] = [];
  const types = new Set(plan.lineItems.map((l) => l.type));
  for (const t of [
    'DISPLAY',
    'VIDEO',
    'CTV',
    'AUDIO',
    'MOBILE_APP_INSTALL',
    'ADS_IN_MOBILE_APPS',
    'DOOH_DISPLAY',
    'DOOH_VIDEO',
    'DEMAND_GEN',
  ] as const) {
    if (!types.has(t)) gaps.push(`line item type ${t} missing`);
  }
  const statuses = new Set(plan.lineItems.map((l) => l.status));
  for (const s of ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'] as const)
    if (!statuses.has(s)) gaps.push(`line item status ${s} missing`);
  const ioTypes = new Set(plan.insertionOrders.map((o) => o.type));
  for (const t of ['STANDARD', 'CTV_OTT', 'DOOH'] as const)
    if (!ioTypes.has(t)) gaps.push(`IO type ${t} missing`);
  const objectives = new Set(plan.insertionOrders.map((o) => o.objective));
  for (const o of ['BRAND_AWARENESS', 'CLICKS', 'CONVERSIONS', 'CUSTOM', 'NONE'] as const)
    if (!objectives.has(o)) gaps.push(`IO objective ${o} missing`);
  void knobs;
  return gaps;
}

export { EXCHANGE_BY_CODE, targetingOptionId };
