import 'server-only';
// Cross-media reach services (module 04 4.9). Reports are written without a change-log entry: `REPORT` has no registry
// until P4-12 (same gap as module 16, docs/gaps/p4-07.md #1). The computation is synchronous and deterministic.
import type { CrossMediaCountry, Prisma } from '@prisma/client';
import type { SessionUser } from '@/lib/auth/types';
import { peopleByIds } from '@/lib/accounts/directory';
import { withSandbox, type Tx } from '@/lib/db';
import {
  asResult,
  forbidden,
  notFound,
  serviceCtx,
  ServiceFailure,
  type Result,
  type ServiceCtx,
} from '@/lib/campaigns/service-kit';
import { can } from '@/lib/rbac/can';
import { parseIdRef, whereId } from '@/lib/routes/params';
import { simDateIn } from '@/lib/metrics/date-range';
import type { Issue } from '@/lib/validation/types';
import {
  CROSS_MEDIA_COUNTRIES,
  CURRENCY_NAME,
  convertCurrency,
  crossMediaCountry,
} from './countries';
import { crossMediaMath, type CrossMediaMath } from './cross-media';
import { crossMediaIssues } from './rules';
import {
  SUB_LOCATION_FROM,
  TV_VENDOR,
  TV_WINDOW,
  subLocations,
  tvCampaignById,
  tvCampaigns,
} from './tv-catalogue';

const canView = (u: SessionUser) =>
  !!u.sandboxId && can(u, 'report_view', { sandboxId: u.sandboxId, area: 'reporting' });
const canBuild = (u: SessionUser) =>
  !!u.sandboxId && can(u, 'report_build', { sandboxId: u.sandboxId, area: 'reporting' });

async function withCtx<T>(
  user: SessionUser,
  write: boolean,
  fn: (tx: Tx, ctx: ServiceCtx) => Promise<T>,
): Promise<T> {
  if (!canView(user)) throw notFound();
  if (write && !canBuild(user)) throw forbidden();
  const ctx = await serviceCtx(user);
  return withSandbox(ctx.sandboxId, (tx) => fn(tx, ctx), { timeout: 60_000 });
}

const toWire = (i: Issue) => ({
  path: i.path,
  severity: i.severity,
  code: i.ruleId,
  message: i.message,
});

async function partnerOf(tx: Tx, pid: string) {
  const ref = parseIdRef(pid);
  const p = ref
    ? await tx.partner.findFirst({
        where: whereId(ref),
        select: { id: true, publicId: true, name: true },
      })
    : null;
  if (!p) throw notFound();
  return p;
}

async function advertiserOf(tx: Tx, partnerId: string, aid: string) {
  const ref = parseIdRef(aid);
  const a = ref
    ? await tx.advertiser.findFirst({
        where: { ...whereId(ref), partnerId },
        select: { id: true, publicId: true, name: true, currencyCode: true, timeZone: true },
      })
    : null;
  if (!a) throw notFound();
  return a;
}

export interface CrossMediaScopeIn {
  partnerId: string;
  advertiserId?: string | undefined;
}

export interface CrossMediaRow {
  id: string;
  publicId: string;
  name: string;
  country: string;
  scope: 'NATIONAL' | 'SUB_LOCATION';
  status: 'PROCESSING' | 'DONE' | 'FAILED';
  createdAt: string;
  createdBy: string;
  advertiserName: string | null;
}

export async function listCrossMediaReports(
  user: SessionUser,
  scope: CrossMediaScopeIn,
): Promise<{ rows: CrossMediaRow[]; canWrite: boolean; partner: boolean }> {
  return withCtx(user, false, async (tx) => {
    const partner = await partnerOf(tx, scope.partnerId);
    const adv = scope.advertiserId ? await advertiserOf(tx, partner.id, scope.advertiserId) : null;
    const reports = await tx.crossMediaReachReport.findMany({
      where: { partnerId: partner.id, ...(adv ? { advertiserId: adv.id } : {}) },
      include: { advertiser: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const people = await peopleByIds([...new Set(reports.map((r) => r.createdById))]);
    const nameOf = new Map(people.map((p) => [p.id, p.name]));
    return {
      canWrite: canBuild(user),
      partner: !adv,
      rows: reports.map((r) => ({
        id: r.id,
        publicId: r.publicId.toString(),
        name: r.name,
        country: crossMediaCountry(r.country).name,
        scope: r.scope,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        createdBy: nameOf.get(r.createdById) ?? '',
        advertiserName: r.advertiser?.name ?? null,
      })),
    };
  });
}

export interface CrossMediaOptions {
  currency: { code: string; name: string; symbol: string };
  subLocations: { code: string; name: string }[];
  tree: {
    advertiserId: string;
    advertiserPublicId: string;
    name: string;
    campaigns: {
      id: string;
      publicId: string;
      name: string;
      spend: number;
      disabled: boolean;
      ios: { id: string; publicId: string; name: string }[];
    }[];
  }[];
  tvDataWindow: { from: string; to: string; nextUpdate: string; subLocationFrom: string };
  tvCompanies: { company: string; campaigns: { id: string; name: string }[] }[];
  tvVendor: string;
}

/** Spend and impressions per line item over the available history (last 24 months), in advertiser currency. */
async function metricsByLineItem(tx: Tx, lineItemIds: string[]) {
  if (!lineItemIds.length) return new Map<string, { impressions: number; cost: number }>();
  const rows = await tx.simDailyMetric.groupBy({
    by: ['lineItemId'],
    where: { lineItemId: { in: lineItemIds }, sliceKind: 'total' },
    _sum: { impressions: true, mediaCost: true },
  });
  return new Map(
    rows.map((r) => [
      r.lineItemId,
      { impressions: Number(r._sum.impressions ?? 0), cost: Number(r._sum.mediaCost ?? 0) },
    ]),
  );
}

export async function getCrossMediaOptions(
  user: SessionUser,
  input: { country: CrossMediaCountry; scope: CrossMediaScopeIn },
): Promise<CrossMediaOptions> {
  return withCtx(user, false, async (tx) => {
    const partner = await partnerOf(tx, input.scope.partnerId);
    const country = crossMediaCountry(input.country);
    const advRow = input.scope.advertiserId
      ? await advertiserOf(tx, partner.id, input.scope.advertiserId)
      : null;
    const advertisers = await tx.advertiser.findMany({
      where: advRow ? { id: advRow.id } : { partnerId: partner.id },
      select: { id: true, publicId: true, name: true, currencyCode: true },
      orderBy: { name: 'asc' },
    });
    const campaigns = await tx.campaign.findMany({
      where: { advertiserId: { in: advertisers.map((a) => a.id) } },
      select: { id: true, publicId: true, name: true, advertiserId: true },
      orderBy: { name: 'asc' },
    });
    const ios = await tx.insertionOrder.findMany({
      where: { advertiserId: { in: advertisers.map((a) => a.id) } },
      select: { id: true, publicId: true, name: true, campaignId: true },
      orderBy: { name: 'asc' },
    });
    const lis = await tx.lineItem.findMany({
      where: { advertiserId: { in: advertisers.map((a) => a.id) } },
      select: { id: true, campaignId: true },
    });
    const m = await metricsByLineItem(
      tx,
      lis.map((l) => l.id),
    );
    const spendByCampaign = new Map<string, number>();
    for (const l of lis)
      spendByCampaign.set(
        l.campaignId,
        (spendByCampaign.get(l.campaignId) ?? 0) + (m.get(l.id)?.cost ?? 0),
      );
    const curOf = new Map(advertisers.map((a) => [a.id, a.currencyCode]));
    const cur = CURRENCY_NAME[country.currency] ?? {
      name: country.currency,
      symbol: country.currency,
    };
    return {
      currency: { code: country.currency, name: cur.name, symbol: cur.symbol },
      subLocations: subLocations(country.code).map((s) => ({ code: s.code, name: s.name })),
      tree: advertisers.map((a) => ({
        advertiserId: a.id,
        advertiserPublicId: a.publicId.toString(),
        name: a.name,
        campaigns: campaigns
          .filter((c) => c.advertiserId === a.id)
          .map((c) => {
            const spend = convertCurrency(
              spendByCampaign.get(c.id) ?? 0,
              curOf.get(c.advertiserId) ?? country.currency,
              country.currency,
            );
            return {
              id: c.id,
              publicId: c.publicId.toString(),
              name: c.name,
              spend: Math.round(spend * 100) / 100,
              disabled: spend <= 0,
              ios: ios
                .filter((i) => i.campaignId === c.id)
                .map((i) => ({ id: i.id, publicId: i.publicId.toString(), name: i.name })),
            };
          }),
      })),
      tvDataWindow: { ...TV_WINDOW, subLocationFrom: SUB_LOCATION_FROM },
      tvCompanies: [...new Set(tvCampaigns(country.code).map((t) => t.company))].map((company) => ({
        company,
        campaigns: tvCampaigns(country.code)
          .filter((t) => t.company === company)
          .map((t) => ({ id: t.id, name: t.campaign })),
      })),
      tvVendor: TV_VENDOR,
    };
  });
}

export interface CreateCrossMediaInput {
  scope: CrossMediaScopeIn;
  country: CrossMediaCountry | null;
  reportScope: 'NATIONAL' | 'SUB_LOCATION';
  subLocationIds?: string[];
  ioIds: string[];
  tvCampaignIds: string[];
  name?: string;
}

export async function createCrossMediaReport(
  user: SessionUser,
  input: CreateCrossMediaInput,
): Promise<Result<{ id: string; publicId: string }>> {
  return asResult(async () => {
    const data = await withCtx(user, true, async (tx, ctx) => {
      const issues = crossMediaIssues({
        country: input.country,
        scope: input.reportScope,
        subLocationCount: input.subLocationIds?.length ?? 0,
        ioCount: input.ioIds.length,
        tvCount: input.tvCampaignIds.length,
      });
      if (issues.some((i) => i.blocking))
        throw new ServiceFailure('INVALID', issues.filter((i) => i.blocking).map(toWire));
      const country = crossMediaCountry(input.country as CrossMediaCountry);
      const partner = await partnerOf(tx, input.scope.partnerId);
      const adv = input.scope.advertiserId
        ? await advertiserOf(tx, partner.id, input.scope.advertiserId)
        : null;
      const ios = await tx.insertionOrder.findMany({
        where: {
          id: { in: input.ioIds },
          ...(adv ? { advertiserId: adv.id } : { advertiser: { partnerId: partner.id } }),
        },
        select: { id: true, advertiser: { select: { currencyCode: true } } },
      });
      if (ios.length !== input.ioIds.length) throw notFound();
      const tvs = input.tvCampaignIds.map((id) => tvCampaignById(id));
      if (tvs.some((t) => !t || t.countryCode !== country.code)) throw notFound();
      const today = simDateIn(ctx.simNow, adv?.timeZone ?? 'UTC');
      const name = (input.name ?? '').trim() || `Cross-media reach - ${country.name} - ${today}`;
      const created = await tx.crossMediaReachReport.create({
        data: {
          sandboxId: ctx.sandboxId,
          partnerId: partner.id,
          advertiserId: adv?.id ?? null,
          createdById: user.id,
          name,
          country: input.country as CrossMediaCountry,
          currencyCode: country.currency,
          scope: input.reportScope,
          subLocations: input.reportScope === 'SUB_LOCATION' ? (input.subLocationIds ?? []) : [],
          ioIds: input.ioIds,
          tvCampaigns: input.tvCampaignIds,
          dateStart: new Date(
            `${input.reportScope === 'SUB_LOCATION' ? SUB_LOCATION_FROM : TV_WINDOW.from}T00:00:00Z`,
          ),
          dateEnd: new Date(`${today}T00:00:00Z`),
          status: 'PROCESSING',
        },
        select: { id: true, publicId: true },
      });
      try {
        const result = await computeResult(tx, {
          countryCode: country.code,
          currency: country.currency,
          ioIds: input.ioIds,
          tvIds: input.tvCampaignIds,
          subLocationIds: input.reportScope === 'SUB_LOCATION' ? (input.subLocationIds ?? []) : [],
        });
        await tx.crossMediaReachReport.update({
          where: { id: created.id },
          data: { status: 'DONE', result: result as unknown as Prisma.InputJsonValue },
        });
      } catch {
        await tx.crossMediaReachReport.update({
          where: { id: created.id },
          data: { status: 'FAILED' },
        });
      }
      return { id: created.id, publicId: created.publicId.toString() };
    });
    return { data };
  });
}

async function computeResult(
  tx: Tx,
  v: {
    countryCode: string;
    currency: string;
    ioIds: string[];
    tvIds: string[];
    subLocationIds: string[];
  },
): Promise<CrossMediaMath & { currency: string }> {
  const country = CROSS_MEDIA_COUNTRIES.find((c) => c.code === v.countryCode);
  if (!country) throw new Error('Unknown country');
  const lis = await tx.lineItem.findMany({
    where: { ioId: { in: v.ioIds } },
    select: { id: true, ioId: true },
  });
  const m = await metricsByLineItem(
    tx,
    lis.map((l) => l.id),
  );
  const byIo = new Map<string, number>();
  for (const l of lis) byIo.set(l.ioId, (byIo.get(l.ioId) ?? 0) + (m.get(l.id)?.impressions ?? 0));
  const subs = subLocations(country.code).filter((s) => v.subLocationIds.includes(s.code));
  const scale = subs.length ? subs.reduce((s, x) => s + x.populationShare, 0) : 1;
  const tv = v.tvIds.map((id) => tvCampaignById(id)).filter((t): t is NonNullable<typeof t> => !!t);
  const math = crossMediaMath({
    population: country.digital,
    digital: v.ioIds.map((id) => ({ impressions: (byIo.get(id) ?? 0) * scale })),
    tv: tv.map((t) => ({ reachPct: t.reachPct, grps: t.grps, impressions: t.impressions })),
    scale,
  });
  return { ...math, currency: v.currency };
}

export interface CrossMediaDetail {
  id: string;
  publicId: string;
  name: string;
  country: string;
  countryKey: CrossMediaCountry;
  scope: 'NATIONAL' | 'SUB_LOCATION';
  subLocations: string[];
  status: 'PROCESSING' | 'DONE' | 'FAILED';
  currency: { code: string; name: string; symbol: string };
  window: { from: string; to: string };
  ioNames: string[];
  tvNames: string[];
  result: (CrossMediaMath & { currency: string }) | null;
  canWrite: boolean;
  advertiserPublicId: string | null;
}

export async function getCrossMediaReport(
  user: SessionUser,
  scope: CrossMediaScopeIn,
  id: string,
): Promise<CrossMediaDetail> {
  return withCtx(user, false, async (tx) => {
    const partner = await partnerOf(tx, scope.partnerId);
    const ref = parseIdRef(id);
    const adv = scope.advertiserId ? await advertiserOf(tx, partner.id, scope.advertiserId) : null;
    const r = ref
      ? await tx.crossMediaReachReport.findFirst({
          where: {
            ...whereId(ref),
            partnerId: partner.id,
            ...(adv ? { advertiserId: adv.id } : {}),
          },
          include: { advertiser: { select: { publicId: true } } },
        })
      : null;
    if (!r) throw notFound();
    const country = crossMediaCountry(r.country);
    const ios = await tx.insertionOrder.findMany({
      where: { id: { in: r.ioIds } },
      select: { name: true },
    });
    const cur = CURRENCY_NAME[r.currencyCode] ?? { name: r.currencyCode, symbol: r.currencyCode };
    const subs = subLocations(country.code).filter((s) => r.subLocations.includes(s.code));
    return {
      id: r.id,
      publicId: r.publicId.toString(),
      name: r.name,
      country: country.name,
      countryKey: r.country,
      scope: r.scope,
      subLocations: subs.map((s) => s.name),
      status: r.status,
      currency: { code: r.currencyCode, ...cur },
      window: {
        from: r.dateStart ? r.dateStart.toISOString().slice(0, 10) : TV_WINDOW.from,
        to: r.dateEnd ? r.dateEnd.toISOString().slice(0, 10) : TV_WINDOW.to,
      },
      ioNames: ios.map((i) => i.name),
      tvNames: ((r.tvCampaigns ?? []) as string[])
        .map((tid) => tvCampaignById(tid)?.campaign)
        .filter((n): n is string => !!n),
      result: (r.result ?? null) as unknown as CrossMediaDetail['result'],
      canWrite: canBuild(user),
      advertiserPublicId: r.advertiser ? r.advertiser.publicId.toString() : null,
    };
  });
}

export async function renameCrossMediaReport(
  user: SessionUser,
  scope: CrossMediaScopeIn,
  id: string,
  name: string,
): Promise<Result<null>> {
  return asResult(async () => {
    await withCtx(user, true, async (tx) => {
      const partner = await partnerOf(tx, scope.partnerId);
      const trimmed = name.trim();
      if (!trimmed)
        throw new ServiceFailure('INVALID', [
          { path: 'name', severity: 'error', code: 'GEN-001', message: 'Enter a value' },
        ]);
      const ref = parseIdRef(id);
      const r = ref
        ? await tx.crossMediaReachReport.findFirst({
            where: { ...whereId(ref), partnerId: partner.id },
            select: { id: true },
          })
        : null;
      if (!r) throw notFound();
      await tx.crossMediaReachReport.update({ where: { id: r.id }, data: { name: trimmed } });
    });
    return { data: null };
  });
}

export async function deleteCrossMediaReport(
  user: SessionUser,
  scope: CrossMediaScopeIn,
  id: string,
): Promise<Result<null>> {
  return asResult(async () => {
    await withCtx(user, true, async (tx) => {
      const partner = await partnerOf(tx, scope.partnerId);
      const ref = parseIdRef(id);
      const r = ref
        ? await tx.crossMediaReachReport.findFirst({
            where: { ...whereId(ref), partnerId: partner.id },
            select: { id: true },
          })
        : null;
      if (!r) throw notFound();
      await tx.crossMediaReachReport.delete({ where: { id: r.id } });
    });
    return { data: null };
  });
}
