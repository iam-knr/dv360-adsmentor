import 'server-only';
// Advertisers list, Create advertiser and status (module 02 4.1 to 4.3; S1, S2).
import { withChangeLog } from '@/lib/changelog';
import { withSandbox, type Tx } from '@/lib/db';
import { addDaysIso, simDateIn } from '@/lib/metrics/date-range';
import { FxRateMissingError, fxRate, loadFxTable, type FxTable } from '@/lib/metrics/fx';
import type { SessionUser } from '@/lib/auth/types';
import {
  ALERT_ROWS,
  CURRENCIES,
  MAX_ADVERTISERS_PER_PARTNER,
  TIME_ZONES,
  UNDERPACING_DEFAULT_PCT,
} from './constants';
import {
  advertiserCap,
  copySourceInvalid,
  validateCreateAdvertiser,
  type CreateAdvertiserInput,
} from './rules';
import {
  asResult,
  assertCan,
  changeCtx,
  checkVersion,
  failIf,
  isLimited,
  loadAdvertiser,
  loadPartner,
  mayDo,
  notFound,
  forbidden,
  serviceCtx,
  ServiceFailure,
  type Result,
  type WriteMeta,
} from './kit';

export type ListedStatus = 'ACTIVE' | 'PAUSED' | 'SCHEDULED_FOR_DELETION';

export interface AdvertiserRow {
  id: string;
  publicId: string;
  name: string;
  status: ListedStatus;
  currencyCode: string;
  /** Set on the sub-rows of "Segment by Budget type". */
  budgetType?: 'AMOUNT' | 'IMPRESSIONS';
  impressions: number;
  revenue: number;
  budgetAtRisk: number;
  currentBudget: number;
  underpacing: number;
  totalActive: number;
}

export interface AdvertiserSummary {
  currencyCode: string;
  budgetAtRisk: { total: number; likelyPct: number; atRiskPct: number; spendPct: number };
  pacing: { active: number; pacingPct: number; underpacingPct: number };
}

export interface AdvertisersList {
  rows: AdvertiserRow[];
  summary: AdvertiserSummary;
  date: string;
  canCreate: boolean;
  limitedAccess: boolean;
}

export interface ListQuery {
  status?: ListedStatus[];
  q?: string;
  segment?: 'NONE' | 'BUDGET_TYPE';
  /** YYYY-MM-DD; default = sim yesterday (RT R9). */
  date?: string;
}

const DEFAULT_STATUS: ListedStatus[] = ['ACTIVE'];

/** Split three percentages that should add to 100 so that rounding keeps the sum exact (AC-02-3). */
export function donut(
  spend: number,
  atRisk: number,
  total: number,
): { likelyPct: number; atRiskPct: number; spendPct: number } {
  if (total <= 0) return { likelyPct: 0, atRiskPct: 0, spendPct: 0 };
  const spendPct = Math.min(100, Math.round((spend / total) * 100));
  const atRiskPct = Math.min(100 - spendPct, Math.round((atRisk / total) * 100));
  return { spendPct, atRiskPct, likelyPct: 100 - spendPct - atRiskPct };
}

/** A pair without an FxRate row must not break the page: the card then adds the amounts unconverted. */
function rateOrOne(fx: FxTable, from: string, to: string): number {
  try {
    return fxRate(fx, from, to);
  } catch (e) {
    if (e instanceof FxRateMissingError) return 1;
    throw e;
  }
}

export async function listAdvertisers(
  user: SessionUser,
  pid: string,
  query: ListQuery = {},
): Promise<Result<AdvertisersList>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const p = await loadPartner(tx, pid);
      const statuses = query.status && query.status.length ? query.status : DEFAULT_STATUS;
      const advertisers = await tx.advertiser.findMany({
        where: {
          partnerId: p.id,
          status: { in: statuses },
          ...(query.q ? { name: { contains: query.q, mode: 'insensitive' as const } } : {}),
        },
        orderBy: { name: 'asc' },
        select: { id: true, publicId: true, name: true, status: true, currencyCode: true },
      });
      const clock = await tx.simClock.findUnique({
        where: { sandboxId: ctx.sandboxId },
        select: { simStart: true, tickIndex: true },
      });
      const simNow = clock
        ? new Date(clock.simStart.getTime() + Number(clock.tickIndex) * 3_600_000)
        : ctx.simNow;
      const today = simDateIn(simNow, p.timeZone);
      const date = query.date ?? addDaysIso(today, -1);
      const day = new Date(`${date}T00:00:00.000Z`);
      const ids = advertisers.map((a) => a.id);
      const [metrics, ios, fx] = await Promise.all([
        tx.simDailyMetric.findMany({
          where: { simDate: day, sliceKind: 'total', lineItem: { advertiserId: { in: ids } } },
          select: {
            impressions: true,
            revenue: true,
            lineItem: { select: { advertiserId: true } },
          },
        }),
        tx.insertionOrder.findMany({
          where: { advertiserId: { in: ids }, status: 'ACTIVE' },
          select: {
            advertiserId: true,
            budgetUnit: true,
            segments: { select: { id: true, amount: true, startDate: true, endDate: true } },
          },
        }),
        loadFxTable(tx, simNow),
      ]);
      const segIds = ios.flatMap((io) => io.segments.map((s) => s.id));
      const snaps = await tx.simPacingSnapshot.findMany({
        where: { budgetSegmentId: { in: segIds }, simDate: { lte: day } },
        orderBy: { simDate: 'desc' },
        select: {
          budgetSegmentId: true,
          budgetAtRisk: true,
          actualSpendToDate: true,
          underpacing: true,
        },
      });
      const latest = new Map<string, (typeof snaps)[number]>();
      for (const s of snaps) if (!latest.has(s.budgetSegmentId)) latest.set(s.budgetSegmentId, s);

      const buckets = new Map<string, AdvertiserRow & { spent: number }>();
      const key = (id: string, bt?: string) => `${id}|${bt ?? ''}`;
      const base = (a: (typeof advertisers)[number], bt?: 'AMOUNT' | 'IMPRESSIONS') => {
        const k = key(a.id, bt);
        let row = buckets.get(k);
        if (!row) {
          row = {
            id: a.id,
            publicId: a.publicId.toString(),
            name: a.name,
            status: a.status as ListedStatus,
            currencyCode: a.currencyCode,
            ...(bt ? { budgetType: bt } : {}),
            impressions: 0,
            revenue: 0,
            budgetAtRisk: 0,
            currentBudget: 0,
            underpacing: 0,
            totalActive: 0,
            spent: 0,
          };
          buckets.set(k, row);
        }
        return row;
      };
      const segment = query.segment === 'BUDGET_TYPE';
      for (const a of advertisers) {
        if (!segment) base(a);
      }
      for (const m of metrics) {
        const a = advertisers.find((x) => x.id === m.lineItem.advertiserId);
        if (!a) continue;
        const row = segment ? base(a, 'AMOUNT') : base(a);
        row.impressions += Number(m.impressions);
        row.revenue += Number(m.revenue.toString());
      }
      for (const io of ios) {
        const a = advertisers.find((x) => x.id === io.advertiserId);
        if (!a) continue;
        const row = segment
          ? base(a, io.budgetUnit === 'IMPRESSIONS' ? 'IMPRESSIONS' : 'AMOUNT')
          : base(a);
        row.totalActive += 1;
        let ioUnder = false;
        for (const s of io.segments) {
          const current = s.startDate <= day && day <= s.endDate;
          if (!current) continue;
          row.currentBudget += Number(s.amount.toString());
          const snap = latest.get(s.id);
          if (snap) {
            row.budgetAtRisk += Number(snap.budgetAtRisk.toString());
            row.spent += Number(snap.actualSpendToDate.toString());
            if (snap.underpacing) ioUnder = true;
          }
        }
        if (ioUnder) row.underpacing += 1;
      }
      const rows = [...buckets.values()]
        .sort(
          (x, y) =>
            x.name.localeCompare(y.name) || (x.budgetType ?? '').localeCompare(y.budgetType ?? ''),
        )
        .map((r) => {
          const { spent: _spent, ...rest } = r;
          void _spent;
          return rest;
        });

      // Cards sum in the partner currency through FxRate (module 02 2.1).
      let total = 0;
      let atRisk = 0;
      let spent = 0;
      let active = 0;
      let under = 0;
      for (const r of buckets.values()) {
        const rate = rateOrOne(fx, r.currencyCode, p.currencyCode);
        if (r.budgetType === 'IMPRESSIONS') {
          active += r.totalActive;
          under += r.underpacing;
          continue; // impression budgets have no money total
        }
        total += r.currentBudget * rate;
        atRisk += r.budgetAtRisk * rate;
        spent += r.spent * rate;
        active += r.totalActive;
        under += r.underpacing;
      }
      const d = donut(spent, atRisk, total);
      const underpacingPct = active ? Math.round((under / active) * 100) : 0;
      return {
        data: {
          rows,
          summary: {
            currencyCode: p.currencyCode,
            budgetAtRisk: { total: Math.round(total), ...d },
            pacing: { active, pacingPct: active ? 100 - underpacingPct : 0, underpacingPct },
          },
          date,
          canCreate: mayDo(ctx, 'entity.write'),
          limitedAccess: isLimited(ctx),
        },
      };
    });
  });
}

export interface CreateAdvertiserWire extends CreateAdvertiserInput {
  billingProfileId?: string | null;
  copyFromAdvertiserId?: string | null;
}

async function defaultFlagEnabled(
  tx: Tx,
  partnerId: string,
  key: 'GOOGLE_PARTNER_INVENTORY',
): Promise<boolean> {
  const flag = await tx.partnerFeatureFlag.findUnique({
    where: { partnerId_key: { partnerId, key } },
  });
  if (!flag) return true; // module 02 3.3 default: on for all advertisers
  return flag.enabled && flag.scope === 'ALL_ADVERTISERS';
}

/** AC-02-5, AC-02-6. Side effects of module 02 4.2. */
export async function createAdvertiser(
  user: SessionUser,
  pid: string,
  input: CreateAdvertiserWire,
): Promise<Result<{ id: string; publicId: string }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertCan(ctx, 'entity.write');
    return withSandbox(ctx.sandboxId, async (tx) => {
      const p = await loadPartner(tx, pid);
      const issues = validateCreateAdvertiser(input, {
        currencies: CURRENCIES,
        timeZones: TIME_ZONES,
      });
      if (
        (await tx.advertiser.count({ where: { partnerId: p.id } })) >= MAX_ADVERTISERS_PER_PARTNER
      )
        issues.push(advertiserCap());
      let source = null as Awaited<ReturnType<typeof tx.advertiser.findFirst>>;
      if (input.copyFromAdvertiserId) {
        source = await tx.advertiser.findFirst({
          where: { id: input.copyFromAdvertiserId, partnerId: p.id },
        });
        if (!source) issues.push(copySourceInvalid());
      }
      failIf(issues);
      const googleOn = await defaultFlagEnabled(tx, p.id, 'GOOGLE_PARTNER_INVENTORY');
      const sourcePrefs = source
        ? await tx.advertiserAlertPreference.findMany({ where: { advertiserId: source.id } })
        : [];
      const created = await withChangeLog(
        changeCtx(ctx, tx),
        { type: 'ADVERTISER', chain: {} },
        async (t) => {
          const adv = await t.advertiser.create({
            data: {
              sandboxId: ctx.sandboxId,
              partnerId: p.id,
              name: input.name.trim(),
              status: 'ACTIVE',
              websiteUrl: input.website.trim(),
              industry: input.industry || null,
              currencyCode: input.currencyCode,
              timeZone: input.timeZone,
              adServer: input.adServer,
              sdfVersion: source?.sdfVersion ?? p.sdfVersion, // RC-045
              sdfAdminEmail: source?.sdfAdminEmail ?? null,
              productImprovement: source?.productImprovement ?? true,
              orderIdReporting: source?.orderIdReporting ?? false,
              adBadging: source?.adBadging ?? true,
              shareDataWithCommercePartners: source?.shareDataWithCommercePartners ?? false,
              creativesContainTracking: source?.creativesContainTracking ?? false,
              authorizeVideoForTvReporting: source?.authorizeVideoForTvReporting ?? false,
              prismaEnabled: source?.prismaEnabled ?? false,
              ...(source?.thirdPartyConfig ? { thirdPartyConfig: source.thirdPartyConfig } : {}),
              googleInventoryEnabled: googleOn,
            },
            select: { id: true, publicId: true },
          });
          const fl = await t.floodlightGroup.create({
            data: {
              sandboxId: ctx.sandboxId,
              advertiserId: adv.id,
              name: `${input.name.trim()} Floodlight group`,
            },
            select: { id: true },
          });
          await t.advertiser.update({
            where: { id: adv.id },
            data: { floodlightGroupId: fl.id },
            select: { id: true },
          });
          await t.advertiserAlertPreference.createMany({
            data: ALERT_ROWS.map((r) => {
              const copied = sourcePrefs.find((s) => s.alertType === r.type);
              return {
                sandboxId: ctx.sandboxId,
                advertiserId: adv.id,
                alertType: r.type,
                enabled: copied ? copied.enabled : r.default,
                thresholdPct: copied
                  ? copied.thresholdPct
                  : r.type === 'UNDERPACING'
                    ? UNDERPACING_DEFAULT_PCT
                    : null,
                thresholdAmount: copied
                  ? copied.thresholdAmount
                  : r.type === 'EXCEEDED_SPEND_THRESHOLD'
                    ? 0
                    : null,
              };
            }),
          });
          return adv;
        },
      );
      return { data: { id: created.id, publicId: created.publicId.toString() } };
    });
  });
}

/** AC-03-3 / module 02 4.3. ACTIVE or PAUSED only; a scheduled advertiser uses cancelAdvertiserDeletion. */
export async function setAdvertiserStatus(
  user: SessionUser,
  aid: string,
  status: 'ACTIVE' | 'PAUSED',
  meta: WriteMeta = {},
): Promise<Result<{ status: 'ACTIVE' | 'PAUSED'; version: number }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertCan(ctx, 'entity.write');
    if (status !== 'ACTIVE' && status !== 'PAUSED')
      throw new ServiceFailure('INVALID', [
        { path: 'status', severity: 'error', code: 'ADV-005', message: 'Choose a status.' },
      ]);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const a = await loadAdvertiser(tx, aid);
      if (a.status === 'SCHEDULED_FOR_DELETION' || a.status === 'ARCHIVED') throw forbidden();
      checkVersion(a.version, meta.expectedVersion);
      const updated = await withChangeLog(
        changeCtx(ctx, tx, { ...(meta.note ? { note: meta.note } : {}) }),
        { type: 'ADVERTISER', id: a.id, chain: { advertiserId: a.id } },
        (t) =>
          t.advertiser.update({
            where: { id: a.id },
            data: { status, version: { increment: 1 } },
            select: { id: true, version: true },
          }),
      );
      return { data: { status, version: updated.version } };
    });
  });
}

export { notFound };
