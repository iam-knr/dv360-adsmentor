import 'server-only';
// Troubleshooter read model (module 08 5.1, L20 and L21): sums `DeliveryDiagnostic` rows over the date range and the
// inventory filter, derives the banner from the lifecycle and the funnel, and renders the CSV.
import type { SessionUser } from '@/lib/auth/types';
import { withSandbox } from '@/lib/db';
import {
  assertRead,
  asResult,
  notFound,
  serviceCtx,
  type Result,
} from '@/lib/campaigns/service-kit';
import { parseIdRef, whereId } from '@/lib/routes/params';
import { DateRangeParamError, parseDateRangeParam, simDateIn } from '@/lib/metrics/date-range';
import { liveStatusFromFunnel, type LiveStatus } from '@/lib/engine/diagnostics/liveStatus';
import type { FunnelRow } from '@/lib/engine/diagnostics/recorder';
import { liPath } from '@/lib/routes/paths';
import { bannerFor, NO_FUNNEL } from './banner';
import {
  buildTroubleshooter,
  troubleshooterCsv,
  type TroubleshooterBanner,
  type TroubleshooterBuilt,
} from './build';

export interface InventoryOption {
  key: string;
  label: string;
  kind: 'ALL' | 'EXCHANGE' | 'DEAL';
}

export interface TroubleshooterData extends TroubleshooterBuilt {
  asOf: string;
  liName: string;
  range: { from: string; to: string };
  inventory: string;
  inventoryOptions: InventoryOption[];
  banner?: TroubleshooterBanner & { href?: string };
  /** Draft, paused and ended line items show the banner only. */
  funnel: boolean;
}

interface Req {
  inventory?: string;
  d?: string;
}

async function load(user: SessionUser, liId: string, req: Req) {
  const ctx = await serviceCtx(user);
  assertRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const ref = parseIdRef(liId);
    if (!ref) throw notFound();
    const li = await tx.lineItem.findFirst({
      where: whereId(ref),
      select: {
        id: true,
        publicId: true,
        name: true,
        status: true,
        flightMode: true,
        flightStart: true,
        flightEnd: true,
        io: {
          select: {
            id: true,
            publicId: true,
            status: true,
            segments: { select: { startDate: true, endDate: true } },
            campaign: {
              select: {
                publicId: true,
                status: true,
                advertiser: {
                  select: {
                    publicId: true,
                    timeZone: true,
                    partner: { select: { publicId: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!li) throw notFound();
    const adv = li.io.campaign.advertiser;
    const todayIso = simDateIn(ctx.simNow, adv.timeZone);
    let range;
    try {
      range = parseDateRangeParam(req.d ?? 'LAST_7_DAYS', todayIso);
    } catch (e) {
      if (e instanceof DateRangeParamError) range = parseDateRangeParam('LAST_7_DAYS', todayIso);
      else throw e;
    }
    const inventory = req.inventory && req.inventory !== 'ALL' ? req.inventory : 'ALL';
    const where = {
      lineItemId: li.id,
      adGroupId: null,
      date: { gte: new Date(`${range.from}T00:00:00Z`), lte: new Date(`${range.to}T00:00:00Z`) },
    };
    const all = await tx.deliveryDiagnostic.groupBy({
      by: ['exchangeId', 'reasonCode'],
      where,
      _sum: { count: true },
    });
    const keys = [...new Set(all.map((r) => r.exchangeId))].sort();
    const codes = keys.filter((k) => !k.startsWith('deal:'));
    const exchanges = codes.length
      ? await tx.exchange.findMany({
          where: { code: { in: codes } },
          select: { code: true, name: true },
        })
      : [];
    const names = new Map(exchanges.map((e) => [e.code, e.name]));
    const options: InventoryOption[] = [
      { key: 'ALL', label: 'All', kind: 'ALL' },
      ...codes.map((k) => ({ key: k, label: names.get(k) ?? k, kind: 'EXCHANGE' as const })),
      ...keys
        .filter((k) => k.startsWith('deal:'))
        .map((k) => ({ key: k, label: `Deal ${k.slice(5)}`, kind: 'DEAL' as const })),
    ];
    const picked = all
      .filter((r) => inventory === 'ALL' || r.exchangeId === inventory)
      .map((r) => ({ reasonCode: r.reasonCode, count: Number(r._sum.count ?? 0) }));
    const built = buildTroubleshooter(picked);

    // lifecycle first, then the funnel
    const flightStart = li.flightMode === 'CUSTOM' ? li.flightStart : null;
    const flightEnd = li.flightMode === 'CUSTOM' ? li.flightEnd : null;
    const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
    const segs = li.io.segments;
    let status: LiveStatus | null = null;
    if (li.status === 'ARCHIVED') status = 'ARCHIVED';
    else if (li.status === 'DRAFT') status = 'DRAFT';
    else if (li.status === 'PAUSED') status = 'PAUSED';
    else if (li.io.status !== 'ACTIVE' || li.io.campaign.status !== 'ACTIVE')
      status = 'PARENT_PAUSED';
    else if (iso(flightStart) && todayIso < (iso(flightStart) as string)) status = 'NOT_STARTED';
    else if (iso(flightEnd) && todayIso > (iso(flightEnd) as string)) status = 'ENDED';
    else if (segs.length === 0) status = 'NO_BUDGET_SEGMENT';
    else if (segs.every((s) => todayIso < (iso(s.startDate) as string))) status = 'NOT_STARTED';
    else if (segs.every((s) => todayIso > (iso(s.endDate) as string))) status = 'ENDED';
    if (!status) {
      const funnel: FunnelRow[] = picked.map((r) => ({
        lineItemId: li.id,
        date: todayIso,
        exchangeId: inventory,
        stage: 'AVAILABLE',
        reasonCode: r.reasonCode,
        count: r.count,
      }));
      status =
        built.kpis.availableRequests > 0
          ? liveStatusFromFunnel(funnel).status
          : 'ACTIVE_DELIVERING';
    }
    const p = adv.partner.publicId.toString();
    const a = adv.publicId.toString();
    const c = li.io.campaign.publicId.toString();
    const io = li.io.publicId.toString();
    const base = liPath(p, a, c, io, li.publicId.toString());
    const banner = bannerFor(status);
    const hrefOf = (t: NonNullable<TroubleshooterBanner['action']>['target']) =>
      t === 'parent' || t === 'io'
        ? `/p/${p}/a/${a}/c/${c}/io/${io}`
        : t === 'inventory'
          ? `/p/${p}/a/${a}/marketplace/inventory`
          : t === 'details'
            ? `${base}/details`
            : `${base}/details#${t}`;
    const data: TroubleshooterData = {
      ...built,
      asOf: ctx.simNow.toISOString(),
      liName: li.name,
      range,
      inventory,
      inventoryOptions: options,
      funnel: !NO_FUNNEL.includes(status),
      ...(banner
        ? {
            banner: { ...banner, ...(banner.action ? { href: hrefOf(banner.action.target) } : {}) },
          }
        : {}),
    };
    return data;
  });
}

export async function getTroubleshooter(
  user: SessionUser,
  liId: string,
  req: Req,
): Promise<Result<TroubleshooterData>> {
  return asResult(async () => ({ data: await load(user, liId, req) }));
}

export async function getTroubleshooterCsv(
  user: SessionUser,
  liId: string,
  req: Req,
): Promise<Result<{ name: string; csv: string }>> {
  return asResult(async () => {
    const d = await load(user, liId, req);
    const label = d.inventoryOptions.find((o) => o.key === d.inventory)?.label ?? 'All';
    const safe = d.liName.replace(/[^\w.-]+/g, '_');
    return {
      data: {
        name: `${safe}-troubleshooter-${d.range.from}-${d.range.to}.csv`,
        csv: troubleshooterCsv(d, { inventory: label, ...d.range }),
      },
    };
  });
}
