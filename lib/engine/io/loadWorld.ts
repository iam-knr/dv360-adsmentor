// Database to World (engine.md 1.1, 1.4). One World per advertiser: the pure core prices one advertiser's currency,
// time zone and market at a time, so a sandbox with two advertisers runs two Worlds that share the tick index.
import { exchangeSimClass } from '@/lib/seed/reference';
import type { Tx } from '@/lib/db';
import type { LoadedParams } from '../params/load';
import type {
  AudienceEntity,
  CampaignEntity,
  CreativeEntity,
  EntityStatus,
  FloodlightActivity,
  IoEntity,
  LineItemEntity,
  World,
} from '../world';
import {
  countryForCurrency,
  creativeType,
  foldApproval,
  isoDay,
  mapActivity,
  mapAlertPrefs,
  mapAttribution,
  mapAudienceType,
  mapFrequency,
  mapInventoryQuality,
  mapKpi,
  mapPartnerCost,
  mapTargeting,
  num,
  tzOffsetMinutes,
  type OptionInfo,
  type TargetRow,
} from './map';
import type { ClockRow, LoadedSandbox } from './types';

function entityStatus(s: string): EntityStatus {
  return s === 'ACTIVE' || s === 'PAUSED' || s === 'DRAFT' || s === 'ARCHIVED' ? s : 'ARCHIVED';
}

export async function loadClock(tx: Tx, sandboxId: string): Promise<ClockRow | null> {
  const c = await tx.simClock.findUnique({ where: { sandboxId } });
  if (!c) return null;
  const sb = await tx.sandbox.findUnique({
    where: { id: sandboxId },
    select: { classroomId: true },
  });
  return {
    sandboxId,
    classroomId: sb?.classroomId ?? '',
    simStartMs: c.simStart.getTime(),
    tickIndex: Number(c.tickIndex),
    state: c.state,
    minutesPerSimDay: c.minutesPerSimDay,
    lastAdvanceRealMs: c.lastAdvanceRealAt ? c.lastAdvanceRealAt.getTime() : null,
    remainderMs: c.remainderMs,
    marketSeed: c.marketSeed,
    sandboxSeed: c.sandboxSeed,
    paramsVersion: c.paramsVersion,
    runOutsideSession: c.runOutsideSession,
  };
}

/** Engine key for a database Exchange id (data/reference/exchanges.json simClass). */
async function exchangeKeys(tx: Tx): Promise<Map<string, string>> {
  const rows = await tx.exchange.findMany({ select: { id: true, code: true } });
  const out = new Map<string, string>();
  for (const r of rows) {
    const key = exchangeSimClass(r.code);
    if (key) out.set(r.id, key);
  }
  return out;
}

export async function loadWorlds(
  tx: Tx,
  clock: ClockRow,
  loaded: LoadedParams,
): Promise<LoadedSandbox> {
  const sandboxId = clock.sandboxId;
  const where = { sandboxId };
  const [
    partner,
    advertisers,
    campaigns,
    ios,
    segments,
    fees,
    lis,
    creatives,
    reviews,
    restrictions,
    assignments,
    audiences,
    flRows,
    liFl,
    targets,
    prefs,
    keyById,
  ] = await Promise.all([
    tx.partner.findFirst({ where, orderBy: { id: 'asc' } }),
    tx.advertiser.findMany({ where, orderBy: { id: 'asc' } }),
    tx.campaign.findMany({ where }),
    tx.insertionOrder.findMany({ where }),
    tx.budgetSegment.findMany({ where, orderBy: [{ ioId: 'asc' }, { ordinal: 'asc' }] }),
    tx.partnerCost.findMany({ where }),
    tx.lineItem.findMany({ where }),
    tx.creative.findMany({ where }),
    tx.creativeReview.findMany({ where }),
    tx.creativeRestriction.findMany({ where }),
    tx.creativeAssignment.findMany({ where }),
    tx.audience.findMany({ where }),
    tx.floodlightActivity.findMany({ where }),
    tx.lineItemFloodlightActivity.findMany({ where }),
    tx.targetingAssignment.findMany({ where: { sandboxId, ownerType: 'LINE_ITEM' } }),
    tx.advertiserAlertPreference.findMany({ where }),
    exchangeKeys(tx),
  ]);
  const partnerExchanges = partner
    ? await tx.partnerExchange.findMany({ where: { sandboxId, partnerId: partner.id } })
    : [];
  const optionIds = [...new Set(targets.map((t) => t.optionId).filter((x): x is string => !!x))];
  const optionRows = optionIds.length
    ? await tx.targetingOption.findMany({
        where: { id: { in: optionIds } },
        select: { id: true, code: true, name: true },
      })
    : [];
  const options = new Map<string, OptionInfo>(
    optionRows.map((o) => [o.id, { code: o.code, name: o.name }]),
  );

  const enabledKeys = [
    ...new Set(
      partnerExchanges
        .filter((p) => p.enabled)
        .map((p) => keyById.get(p.exchangeId))
        .filter((k): k is string => !!k),
    ),
  ].sort();

  const groupBy = <T>(xs: readonly T[], key: (x: T) => string | null): Map<string, T[]> => {
    const m = new Map<string, T[]>();
    for (const x of xs) {
      const k = key(x);
      if (k === null) continue;
      const a = m.get(k);
      if (a) a.push(x);
      else m.set(k, [x]);
    }
    return m;
  };
  const segsByIo = groupBy(segments, (s) => s.ioId);
  const feesByIo = groupBy(fees, (f) => f.ioId);
  const feesByLi = groupBy(fees, (f) => f.lineItemId);
  const assignByLi = groupBy(assignments, (a) => a.lineItemId);
  const reviewByCreative = groupBy(reviews, (r) => r.creativeId);
  const restrictionByCreative = groupBy(restrictions, (r) => r.creativeId);
  const flByLi = groupBy(liFl, (l) => l.lineItemId);
  const targetsByLi = groupBy(targets, (t) => t.lineItemId);
  const prefsByAdv = groupBy(prefs, (p) => p.advertiserId);
  // Module 15 (M15-09): the Floodlight group supplies the conversion windows and the tag fault of its activities.
  const flGroups = new Map((await tx.floodlightGroup.findMany({ where })).map((g) => [g.id, g]));
  const groupOf = new Map(flRows.map((f) => [f.id, flGroups.get(f.groupId)]));
  const flById = new Map<string, FloodlightActivity>(
    flRows.map((f) => [f.id, mapActivity(f, groupOf.get(f.id)?.tagStatus)]),
  );
  const keyOfExchange = (idOrCode: string): string | undefined =>
    keyById.get(idOrCode) ?? exchangeSimClass(idOrCode);

  const out: LoadedSandbox = { clock, worlds: [] };
  for (const adv of advertisers) {
    const country = countryForCurrency(loaded.params, adv.currencyCode);
    const tzOffsetMin = tzOffsetMinutes(adv.timeZone, clock.simStartMs);
    const advCampaigns = campaigns.filter((c) => c.advertiserId === adv.id);
    const advIos = ios.filter((i) => i.advertiserId === adv.id);
    const advLis = lis.filter((l) => l.advertiserId === adv.id);
    const advCreatives = creatives.filter((c) => c.advertiserId === adv.id);
    const advAudiences = audiences.filter((a) => a.advertiserId === adv.id);

    const worldCampaigns: CampaignEntity[] = advCampaigns.map((c) => ({
      id: c.id,
      status: entityStatus(c.status),
      frequency: mapFrequency({
        mode: c.freqMode,
        maxExposures: c.freqMaxExposures,
        unit: c.freqUnit,
        unitCount: c.freqUnitCount,
      }),
    }));

    const worldIos: IoEntity[] = advIos.map((io) => {
      const impressions = io.budgetUnit === 'IMPRESSIONS';
      const daily = impressions ? num(io.dailyMaxImpressions, 0) : num(io.dailyMaxAmount, 0);
      return {
        id: io.id,
        campaignId: io.campaignId,
        status: entityStatus(io.status),
        budgetUnit: io.budgetUnit,
        segments: (segsByIo.get(io.id) ?? []).map((s) => ({
          id: s.id,
          amount: num(s.amount),
          startDay: isoDay(s.startDate),
          endDay: isoDay(s.endDate),
        })),
        pacing: {
          period: io.pacingPeriod,
          type: io.pacingType,
          ...(daily > 0 ? { dailyAmount: daily } : {}),
        },
        bidBudgetControl: io.bidBudgetControl,
        ...(io.optimizeTarget ? { optimizeTarget: io.optimizeTarget } : {}),
        autoBudgetAllocation: io.autoBudgetAllocation,
        frequency: mapFrequency({
          mode: io.freqMode,
          maxExposures: io.freqMaxExposures,
          unit: io.freqUnit,
          unitCount: io.freqUnitCount,
        }),
        ...(mapKpi(io.kpi, io.kpiValue) ? { kpi: mapKpi(io.kpi, io.kpiValue) } : {}),
        partnerCosts: (feesByIo.get(io.id) ?? [])
          .map(mapPartnerCost)
          .filter((x): x is NonNullable<typeof x> => x !== null),
      } satisfies IoEntity;
    });

    const worldLis: LineItemEntity[] = advLis.map((li) => {
      const ownFees = feesByLi.get(li.id);
      const daily = num(li.dailyMaxAmount, 0) || num(li.dailyMaxImpressions, 0);
      const rows: TargetRow[] = (targetsByLi.get(li.id) ?? []).map((t) => ({
        dimension: t.dimension,
        mode: t.mode,
        optionId: t.optionId,
        refType: t.refType,
        refId: t.refId,
        groupIndex: t.groupIndex,
        config: t.config,
      }));
      const targeting = mapTargeting(rows, {
        country,
        params: loaded.params,
        options,
        exchangeKey: keyOfExchange,
      });
      return {
        id: li.id,
        ioId: li.ioId,
        status: entityStatus(li.status),
        type: li.type,
        inventoryQuality: mapInventoryQuality(li.inventoryQuality),
        ...(li.flightMode === 'CUSTOM' && li.flightStart && li.flightEnd
          ? { flight: { start: isoDay(li.flightStart), end: isoDay(li.flightEnd) } }
          : {}),
        budget: {
          mode: li.budgetMode,
          ...(li.budgetMode === 'FIXED' ? { amount: num(li.budgetAmount) } : {}),
        },
        pacing: {
          period: li.pacingPeriod,
          type: li.pacingType,
          ...(daily > 0 ? { dailyAmount: daily } : {}),
        },
        bid:
          li.bidKind === 'FIXED'
            ? { kind: 'FIXED', fixedCpm: num(li.fixedBidCpm) }
            : {
                kind: 'AUTOMATED',
                ...(li.bidGoal ? { goal: li.bidGoal } : {}),
                ...(li.bidTargetValue !== null ? { targetValue: num(li.bidTargetValue) } : {}),
              },
        frequency: mapFrequency({
          mode: li.freqMode,
          maxExposures: li.freqMaxExposures,
          unit: li.freqUnit,
          unitCount: li.freqUnitCount,
        }),
        targeting,
        creativeIds: (assignByLi.get(li.id) ?? []).map((a) => a.creativeId).sort(),
        floodlight: (flByLi.get(li.id) ?? [])
          .map((l) => {
            const g = groupOf.get(l.activityId);
            return {
              activityId: l.activityId,
              ...(g
                ? {
                    postClickWindowDays: g.clickWindowDays,
                    postViewWindowDays: g.impressionWindowDays,
                  }
                : {}),
            };
          })
          .sort((a, b) => (a.activityId < b.activityId ? -1 : 1)),
        conversionCounting: {
          mode: li.conversionCounting,
          ...(li.conversionCountingPct !== null ? { pct: li.conversionCountingPct } : {}),
        },
        attributionModel: mapAttribution(li.attributionModelId),
        revenueModel: {
          type: li.revenueModelType,
          markup: num(li.revenueMarkupPct) / 100,
          cpm: num(li.revenueCpm),
        },
        ...(ownFees
          ? {
              partnerCosts: ownFees
                .map(mapPartnerCost)
                .filter((x): x is NonNullable<typeof x> => x !== null),
            }
          : {}),
        optimizedTargeting: li.optimizedTargeting,
        creativeOptimization: li.creativeOptimization,
      } satisfies LineItemEntity;
    });

    const worldCreatives: CreativeEntity[] = advCreatives.map((c) => {
      const states = (reviewByCreative.get(c.id) ?? []).map((r) => r.status);
      const byEngine = new Map<string, string[]>();
      for (const r of reviewByCreative.get(c.id) ?? []) {
        const key = keyById.get(r.exchangeId);
        if (!key) continue;
        const a = byEngine.get(key);
        if (a) a.push(r.status);
        else byEngine.set(key, [r.status]);
      }
      const approval: CreativeEntity['approval'] = { '*': foldApproval(states) };
      for (const [k, v] of [...byEngine].sort()) approval[k] = foldApproval(v);
      const regions = (restrictionByCreative.get(c.id) ?? [])
        .filter((r) => r.blocksGeoTargeting && r.countryCode)
        .map((r) => r.countryCode as string);
      const status =
        c.status === 'ACTIVE' ? 'ACTIVE' : c.status === 'ARCHIVED' ? 'ARCHIVED' : 'PAUSED';
      return {
        id: c.id,
        status,
        type: creativeType(c.kind),
        ...(c.width > 0 && c.height > 0 ? { size: `${c.width}x${c.height}` } : {}),
        dv360Servable: c.dv360Review === 'SERVABLE',
        approval,
        ...(regions.length > 0 ? { restrictedRegions: regions } : {}),
        ...(c.requiresMraid ? { mraid: true } : {}),
        ...(c.requiresHtml5 || c.kind === 'STANDARD_HTML5' ? { rich: true } : {}),
        ...(c.dontScaleToFit ? { scaled: false } : {}),
      } satisfies CreativeEntity;
    });

    const worldAudiences: AudienceEntity[] = advAudiences.map((a) => {
      const availableMs = a.availableAt ? a.availableAt.getTime() : null;
      const cfg = (a.config && typeof a.config === 'object' ? a.config : {}) as Record<
        string,
        unknown
      >;
      const size = a.sizeDisplay !== null ? Number(a.sizeDisplay) : undefined;
      return {
        id: a.id,
        type: mapAudienceType(a.type),
        ...(size !== undefined ? { size } : {}),
        ...(a.lookalikeReachPct !== null ? { reachPct: num(a.lookalikeReachPct) } : {}),
        ...(availableMs !== null
          ? { usableFromTick: Math.max(0, Math.ceil((availableMs - clock.simStartMs) / 3_600_000)) }
          : {}),
        ...(cfg.restricted === true ? { restricted: true } : {}),
      } satisfies AudienceEntity;
    });

    const usedActivities = new Set(
      advLis.flatMap((l) => (flByLi.get(l.id) ?? []).map((x) => x.activityId)),
    );
    const world: World = {
      sandboxId,
      marketSeed: clock.marketSeed,
      sandboxSeed: clock.sandboxSeed,
      simStartMs: clock.simStartMs,
      tzOffsetMin,
      country,
      partner: {
        id: partner?.id ?? adv.partnerId,
        currency: partner?.currencyCode ?? adv.currencyCode,
        ...(enabledKeys.length > 0 ? { enabledExchanges: enabledKeys } : {}),
      },
      advertiser: {
        id: adv.id,
        currency: adv.currencyCode,
        tzOffsetMin,
        vertical: adv.industry?.toLowerCase().replace(/[^a-z0-9]+/g, '_') ?? 'default',
        alertPrefs: mapAlertPrefs(
          (prefsByAdv.get(adv.id) ?? []).map((p) => ({
            alertType: p.alertType,
            enabled: p.enabled,
            thresholdPct: p.thresholdPct,
            thresholdAmount: p.thresholdAmount,
          })),
        ),
      },
      campaigns: worldCampaigns,
      insertionOrders: worldIos,
      lineItems: worldLis,
      creatives: worldCreatives,
      audiences: worldAudiences,
      floodlightActivities: [...usedActivities]
        .sort()
        .map((id) => flById.get(id))
        .filter((x): x is FloodlightActivity => !!x),
      deals: [],
    };
    out.worlds.push({
      advertiserId: adv.id,
      world,
      segmentEnds: new Map(
        segments
          .filter((s) => advIos.some((i) => i.id === s.ioId))
          .map((s) => [s.id, isoDay(s.endDate)]),
      ),
      ioOfSegment: new Map(
        segments.filter((s) => advIos.some((i) => i.id === s.ioId)).map((s) => [s.id, s.ioId]),
      ),
      campaignOfIo: new Map(advIos.map((i) => [i.id, i.campaignId])),
      ioOfLi: new Map(advLis.map((l) => [l.id, l.ioId])),
    });
  }
  return out;
}
