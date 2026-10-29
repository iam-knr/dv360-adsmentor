import 'server-only';
// Read side of the line item service: stored rows to form values, the parent IO, and the validation context
// (validation.md 6.2 ContextLoader backed by Prisma). Every function takes the sandbox transaction.
import type { CreativeKind, Prisma } from '@prisma/client';
import type { Tx } from '@/lib/db';
import { fromMinor, toMinor, type CurrencyCode } from '@/lib/money';
import { emptyTargetingState, loadTargetingState } from '@/lib/targeting';
import { periodLabel } from '@/lib/validation/constants/frequency';
import type { CreativeFormat } from '@/lib/validation/constants/creatives';
import type {
  BidStrategy,
  CreativeInfo,
  FrequencyCapInput,
  IoSnapshot,
  LiType,
  RoleKey,
  ValidationContext,
} from '@/lib/validation/types';
import type { SessionUser } from '@/lib/auth/types';
import { defaultTargetingInput, toValidationInput, type FormIo, type LiFormValue } from './form';
import { exchangeFormatOf, exchangeSupports } from './type-config';

export const LI_INCLUDE = {
  assignments: { orderBy: { creativeId: 'asc' } },
  fees: { orderBy: [{ kind: 'asc' }, { slot: 'asc' }] },
  lineItemFloodlightActivities: { orderBy: { activityId: 'asc' } },
  lineItemInventories: { orderBy: [{ kind: 'asc' }, { refId: 'asc' }] },
} satisfies Prisma.LineItemInclude;

export type StoredLi = Prisma.LineItemGetPayload<{ include: typeof LI_INCLUDE }>;

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export const isoDate = (d: Date | null | undefined): string | null =>
  d ? d.toISOString().slice(0, 10) : null;
const dateOf = (s: string | null | undefined): Date | null =>
  s ? new Date(`${s}T00:00:00.000Z`) : null;
const dec = (v: Prisma.Decimal | null | undefined): string | null =>
  v === null || v === undefined ? null : v.toString();

/** Sim clock now (ENG 1.2: simStart + tickIndex hours). Falls back to the real clock. */
export async function simNow(tx: Tx, sandboxId: string): Promise<Date> {
  const clock = await tx.simClock.findUnique({
    where: { sandboxId },
    select: { simStart: true, tickIndex: true },
  });
  return clock
    ? new Date(clock.simStart.getTime() + Number(clock.tickIndex) * HOUR_MS)
    : new Date();
}

export function capOf(row: {
  freqMode: 'INHERIT' | 'UNLIMITED' | 'LIMITED';
  freqMaxExposures: number | null;
  freqUnit: 'MONTH' | 'WEEK' | 'DAY' | 'HOUR' | 'MINUTE' | null;
  freqUnitCount: number | null;
}): FrequencyCapInput {
  return {
    mode: row.freqMode,
    maxImpressions: row.freqMaxExposures,
    periodCount: row.freqUnitCount ?? 1,
    period: row.freqUnit ?? 'MONTH',
  };
}

function capText(cap: FrequencyCapInput): string | null {
  if (cap.mode !== 'LIMITED' || !cap.maxImpressions || !cap.period) return null;
  const n = Number(cap.maxImpressions);
  return `The higher level frequency cap is set to ${n} exposures per ${periodLabel({
    n,
    periodCount: Number(cap.periodCount ?? 1),
    period: cap.period,
  })}`;
}

/** The IO with its campaign, advertiser and budget segments, as the form and the rules need it. */
export async function loadIo(tx: Tx, ioId: string) {
  const io = await tx.insertionOrder.findUnique({
    where: { id: ioId },
    include: {
      segments: { orderBy: { startDate: 'asc' } },
      campaign: true,
      advertiser: { include: { floodlightGroups: { include: { models: true } } } },
    },
  });
  if (!io) return null;
  const currency = io.advertiser.currencyCode as CurrencyCode;
  const starts = io.segments.map((s) => s.startDate.getTime());
  const ends = io.segments.map((s) => s.endDate.getTime());
  const flight = io.segments.length
    ? {
        start: isoDate(new Date(Math.min(...starts)))!,
        end: isoDate(new Date(Math.max(...ends)))!,
      }
    : null;
  const optimizedTowards = (io.optimizeTarget as BidStrategy | null) ?? null;
  const form: FormIo = {
    id: io.id,
    name: io.name,
    type: io.type,
    objective: io.objective,
    mode: io.bidBudgetControl,
    optimizedTowards,
    flight,
  };
  const budgetTotal = io.segments.reduce(
    (sum, s) =>
      sum + (io.budgetUnit === 'CURRENCY' ? toMinor(Number(s.amount), currency) : Number(s.amount)),
    0,
  );
  const ioCap = capOf(io);
  const campaignCap = capOf(io.campaign);
  const snapshot: IoSnapshot = {
    id: io.id,
    type: io.type,
    objective: io.objective,
    mode: io.bidBudgetControl,
    optimizedTowards,
    status: io.status === 'SCHEDULED_FOR_DELETION' ? 'ARCHIVED' : io.status,
    budgetType: io.budgetUnit,
    budgetTotal,
    flight,
    frequencyCap: ioCap,
  };
  return {
    row: io,
    form,
    snapshot,
    currency,
    timeZone: io.advertiser.timeZone,
    higherCapText: capText(ioCap) ?? capText(campaignCap),
    campaignSnapshot: {
      id: io.campaign.id,
      goal: io.campaign.goal,
      status:
        io.campaign.status === 'ARCHIVED' || io.campaign.status === 'SCHEDULED_FOR_DELETION'
          ? ('ARCHIVED' as const)
          : io.campaign.status === 'PAUSED'
            ? ('PAUSED' as const)
            : ('ACTIVE' as const),
      frequencyCap: campaignCap,
    },
    attributionModelIds: io.advertiser.floodlightGroups.flatMap((g) => g.models.map((m) => m.id)),
  };
}

export type LoadedIo = NonNullable<Awaited<ReturnType<typeof loadIo>>>;

/** Partner exchanges that support a line item type's format (public inventory default). */
export async function exchangeIdsFor(
  tx: Tx,
  partnerId: string,
  type: LiType,
  adType?: 'DISPLAY' | 'VIDEO' | null,
): Promise<string[]> {
  const fmt = exchangeFormatOf(type, adType);
  if (!fmt) return [];
  const rows = await tx.partnerExchange.findMany({
    where: { partnerId, enabled: true },
    include: { exchange: true },
    orderBy: { exchange: { sortOrder: 'asc' } },
  });
  return rows.filter((r) => exchangeSupports(fmt, r.exchange)).map((r) => r.exchangeId);
}

const EU: Record<string, 'YES' | 'NO'> = {
  CONTAINS_EU_POLITICAL_ADS: 'YES',
  DOES_NOT_CONTAIN_EU_POLITICAL_ADS: 'NO',
};

/** Stored line item to the form value. Exchanges are the partner list for the format (no stored subset). */
export async function rowToForm(tx: Tx, li: StoredLi, partnerId: string): Promise<LiFormValue> {
  const type = li.type as LiType;
  const adType = li.appAdFormat ?? null;
  const app =
    type === 'MOBILE_APP_INSTALL'
      ? { platform: li.mobileAppPlatform ?? 'ALL', storeId: li.mobileAppId }
      : null;
  const loaded = await loadTargetingState(tx, li.id);
  const targetingState = loaded.lineItemType === 'unknown' ? emptyTargetingState(type) : loaded;
  return {
    name: li.name,
    status: li.status === 'SCHEDULED_FOR_DELETION' ? 'ARCHIVED' : li.status,
    type,
    ioId: li.ioId,
    inventory: {
      quality: li.inventoryQuality,
      exchanges: await exchangeIdsFor(tx, partnerId, type, adType),
      deals: li.lineItemInventories.filter((r) => r.kind !== 'GROUP').map((r) => r.refId),
      dealGroups: li.lineItemInventories.filter((r) => r.kind === 'GROUP').map((r) => r.refId),
      targetCuratedCtv: li.targetCuratedCtv,
    },
    flight:
      li.flightMode === 'CUSTOM'
        ? { mode: 'CUSTOM', startDate: isoDate(li.flightStart), endDate: isoDate(li.flightEnd) }
        : { mode: 'SAME_AS_IO', startDate: null, endDate: null },
    budget:
      li.budgetMode === 'FIXED'
        ? { mode: 'AMOUNT', amount: dec(li.budgetAmount) }
        : { mode: 'UNLIMITED', amount: null },
    pacing: { period: li.pacingPeriod, type: li.pacingType, dailyAmount: dec(li.dailyMaxAmount) },
    bid: {
      mode: li.bidKind,
      fixedCpm: dec(li.fixedBidCpm),
      optimizedTowards: (li.bidGoal as BidStrategy | null) ?? null,
      priority: li.bidPriority === 'TARGET_VALUE' ? 'TARGET' : 'FULL_BUDGET',
      targetValue: dec(li.bidTargetValue),
      customBiddingAlgorithmId: li.customBiddingAlgorithmId,
    },
    frequencyCap: capOf(li),
    creatives: li.assignments.map((a) => a.creativeId),
    conversions: {
      activities: li.lineItemFloodlightActivities.map((a) => a.activityId),
      countingMode: li.conversionCounting,
      postViewPct: li.conversionCountingPct ?? 100,
      attributionModelId: li.attributionModelId,
    },
    euPoliticalAds: li.euPoliticalAds ? (EU[li.euPoliticalAds] ?? null) : null,
    revenueModel: {
      type: li.revenueModelType === 'CPM_VALUE' ? 'CPM_VALUE' : 'TOTAL_MEDIA_COST_MARKUP',
      value: li.revenueModelType === 'CPM_VALUE' ? dec(li.revenueCpm) : dec(li.revenueMarkupPct),
    },
    partnerCosts: {
      cpmFees: li.fees
        .filter((f) => f.kind === 'CPM_FEE')
        .map((f) => ({ type: f.feeType, amount: dec(f.amount) })),
      mediaFees: li.fees
        .filter((f) => f.kind === 'MEDIA_FEE')
        .map((f) => ({
          type: f.feeType,
          amount: dec(f.percentage),
          ...(f.isSystem ? { system: true } : {}),
        })),
    },
    integrationCode: li.integrationCode ?? '',
    integrationDetail: li.integrationDetail ?? '',
    targeting: defaultTargetingInput(
      type,
      app?.storeId ? { platform: app.platform, storeId: app.storeId } : null,
    ),
    app,
    adType,
    copiedFromType: null,
    optimizedTargeting: li.optimizedTargeting,
    creativeOptimization: li.creativeOptimization,
    targetingState,
  };
}

const FORMAT_OF_KIND: Record<CreativeKind, CreativeFormat> = {
  STANDARD_IMAGE: 'IMAGE',
  STANDARD_HTML5: 'HTML5',
  THIRD_PARTY_DISPLAY: 'TP_DISPLAY',
  NATIVE_SITE: 'NATIVE_SITE',
  NATIVE_VIDEO: 'NATIVE_VIDEO',
  VIDEO_FILE: 'VIDEO_FILE',
  YOUTUBE_VIDEO: 'YOUTUBE_VIDEO',
  AUDIO_FILE: 'AUDIO_FILE',
  THIRD_PARTY_VIDEO: 'TP_VIDEO',
  THIRD_PARTY_AUDIO: 'TP_AUDIO',
};

export function creativeFormatOf(kind: CreativeKind): CreativeFormat {
  return FORMAT_OF_KIND[kind];
}

/** Creative rows of an advertiser as validation lookups (LI-060, LI-061, LI-064, LI-DSP-031). */
export async function creativeLookups(tx: Tx, advertiserId: string) {
  const rows = await tx.creative.findMany({
    where: { advertiserId },
    include: { reviews: true, creativeRestrictions: true },
  });
  const map = new Map<string, CreativeInfo>();
  for (const c of rows) {
    map.set(c.id, {
      id: c.id,
      format: creativeFormatOf(c.kind),
      status: c.status === 'PAUSED' ? 'PAUSED' : c.status === 'ACTIVE' ? 'ACTIVE' : 'ARCHIVED',
      review: c.dv360Review,
      exchangeStatus: Object.fromEntries(c.reviews.map((r) => [r.exchangeId, r.status])),
      restrictedCountries: c.creativeRestrictions.flatMap((r) =>
        r.countryCode ? [r.countryCode] : [],
      ),
      width: c.width,
      height: c.height,
    });
  }
  return { rows, map };
}

const ROLE: Record<SessionUser['dvRole'], RoleKey> = {
  ADMIN: 'ADMIN',
  STANDARD: 'STANDARD',
  READ_ONLY: 'READ_ONLY',
  REPORTING_ONLY: 'REPORTING_ONLY',
  PARTNER_CLIENT: 'PARTNER_CLIENT',
  CREATIVE: 'CREATIVE',
};

/** The authoritative validation context for a line item in `io` (validation.md 6.6). */
export async function buildLiContext(
  tx: Tx,
  user: SessionUser,
  io: LoadedIo,
  original?: LiFormValue,
): Promise<ValidationContext> {
  const advertiser = io.row.advertiser;
  const [exchanges, creatives, activities, algorithms, templates, now] = await Promise.all([
    tx.partnerExchange.findMany({
      where: { partnerId: advertiser.partnerId, enabled: true },
      include: { exchange: true },
    }),
    creativeLookups(tx, advertiser.id),
    tx.floodlightActivity.findMany({
      where: { group: { advertiserId: advertiser.id } },
      select: { id: true, status: true },
    }),
    tx.customBiddingAlgorithm.findMany({
      where: { OR: [{ advertiserId: advertiser.id }, { partnerId: advertiser.partnerId }] },
      select: { id: true, status: true },
    }),
    tx.targetingTemplate.findMany({
      where: { advertiserId: advertiser.id },
      select: { id: true, lineItemType: true },
    }),
    simNow(tx, io.row.sandboxId),
  ]);
  return {
    mode: original ? 'edit' : 'create',
    now,
    actor: {
      userId: user.id,
      role: ROLE[user.dvRole],
      limitedAccess: user.dvRole === 'READ_ONLY' || user.dvRole === 'PARTNER_CLIENT',
    },
    source: 'form',
    ...(original ? { original: toValidationInput(original, io.currency) } : {}),
    partner: { enabledExchangeIds: exchanges.map((e) => e.exchangeId) },
    advertiser: {
      currency: io.currency,
      timeZone: advertiser.timeZone,
      demandGenFloodlightOptimization: advertiser.demandGenFloodlightOptimization,
      googleInventoryEnabled: advertiser.googleInventoryEnabled,
      appAttributionLinked: false,
      attributionModelIds: io.attributionModelIds,
    },
    campaign: io.campaignSnapshot,
    io: io.snapshot,
    lookups: {
      exchanges: new Map(
        exchanges.map((e) => [
          e.exchangeId,
          { id: e.exchangeId, name: e.exchange.name, isDooh: e.exchange.supportsDooh },
        ]),
      ),
      creatives: creatives.map,
      floodlightActivities: new Map(
        activities.map((a) => [
          a.id,
          {
            id: a.id,
            status: a.status === 'ACTIVE' ? ('ACTIVE' as const) : ('ARCHIVED' as const),
            linkedToAdvertiser: true,
          },
        ]),
      ),
      customBidding: new Map(
        algorithms.map((a) => [
          a.id,
          {
            id: a.id,
            status: a.status,
          },
        ]),
      ),
      templates: new Map(
        templates.map((t) => [t.id, { id: t.id, liType: t.lineItemType as LiType }]),
      ),
    },
  };
}

/** True when the stored line item has started (LI-023): its start, or the IO's, is today or earlier. */
export function hasStarted(value: LiFormValue, io: LoadedIo, now: Date): boolean {
  const start = value.flight.mode === 'CUSTOM' ? value.flight.startDate : io.form.flight?.start;
  if (!start) return false;
  return start <= new Date(now.getTime()).toISOString().slice(0, 10);
}

export { DAY_MS, dateOf, fromMinor };
