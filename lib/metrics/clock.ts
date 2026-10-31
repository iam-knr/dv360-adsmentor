// Sim "today" for date presets (RT R9): the sandbox sim clock read in the advertiser time zone.
import type { Tx } from '@/lib/db';
import { parseDateRangeParam, simDateIn } from './date-range';
import type { DateRange, MetricLevel } from './types';

const HOUR_MS = 3_600_000;

/** The sandbox sim instant `simStart + tickIndex hours` (ENG 1.2); real time when the sandbox has no clock. */
export async function simNowFor(tx: Tx, sandboxId: string): Promise<Date> {
  const clock = await tx.simClock.findUnique({
    where: { sandboxId },
    select: { simStart: true, tickIndex: true },
  });
  return clock ? new Date(clock.simStart.getTime() + Number(clock.tickIndex) * HOUR_MS) : new Date();
}

/** Sim date of `simNow = simStart + tickIndex hours` (ENG 1.2) in `timeZone`. */
export async function simTodayFor(tx: Tx, sandboxId: string, timeZone: string): Promise<string> {
  const clock = await tx.simClock.findUnique({
    where: { sandboxId },
    select: { simStart: true, tickIndex: true },
  });
  const simNow = clock
    ? new Date(clock.simStart.getTime() + Number(clock.tickIndex) * HOUR_MS)
    : new Date();
  return simDateIn(simNow, timeZone);
}

async function advertiserOf(tx: Tx, level: MetricLevel, id: string) {
  const select = {
    advertiser: { select: { timeZone: true, currencyCode: true, partnerId: true } },
  };
  switch (level) {
    case 'advertiser':
      return tx.advertiser.findUnique({
        where: { id },
        select: { timeZone: true, currencyCode: true, partnerId: true },
      });
    case 'campaign':
      return (await tx.campaign.findUnique({ where: { id }, select }))?.advertiser ?? null;
    case 'io':
      return (await tx.insertionOrder.findUnique({ where: { id }, select }))?.advertiser ?? null;
    case 'li':
      return (await tx.lineItem.findUnique({ where: { id }, select }))?.advertiser ?? null;
    case 'adGroup':
      return (await tx.adGroup.findUnique({ where: { id }, select }))?.advertiser ?? null;
  }
}

/**
 * Resolve a `d` param for a list whose first row is `firstId`: "today" in that row's advertiser time zone. A list
 * spans one advertiser except the partner Advertisers list, where the partner time zone is the documented
 * approximation (one range for the whole page).
 */
export async function resolveRangeForEntity(
  tx: Tx,
  sandboxId: string,
  level: MetricLevel,
  firstId: string | undefined,
  d: string | null | undefined,
): Promise<{ range: DateRange; today: string; partnerCurrency: string | null }> {
  const adv = firstId ? await advertiserOf(tx, level, firstId) : null;
  let timeZone = adv?.timeZone ?? 'Asia/Calcutta';
  let partnerCurrency: string | null = null;
  if (adv) {
    const partner = await tx.partner.findUnique({
      where: { id: adv.partnerId },
      select: { timeZone: true, currencyCode: true },
    });
    partnerCurrency = partner?.currencyCode ?? null;
    if (level === 'advertiser' && partner) timeZone = partner.timeZone;
  }
  const today = await simTodayFor(tx, sandboxId, timeZone);
  return { range: parseDateRangeParam(d, today), today, partnerCurrency };
}
