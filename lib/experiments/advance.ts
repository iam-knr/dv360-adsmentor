// Engine tick steps of module 17 (Δ17-14, Δ17-16): `advanceExperiments` (SCHEDULED to ACTIVE, ended by date) and
// `advanceLiftStudies` (flight progress, status, results at the 25, 50, 75 and 100 percent milestones), plus the arm
// supply shares the engine reads each tick (engine 6.7). Called from the engine persist step; plain writes like
// `advanceAudiences` (engine output, no History entry).
import type { Tx } from '@/lib/db';
import { simDateIn } from '@/lib/metrics/date-range';
import { lineItemIdsOf } from './data';
import {
  flightProgress,
  inrMultiplier,
  liftParams,
  loadStudyLis,
  milestone,
  writeFlightResults,
} from './lift-engine';
import { liftRequirement } from './lift-math';

const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

/** SCHEDULED tests whose start date came become ACTIVE; ACTIVE tests whose end date passed become COMPLETED. */
export async function advanceExperiments(
  tx: Tx,
  sandboxId: string,
  advertiserId: string,
  atMs: number,
): Promise<number> {
  const adv = await tx.advertiser.findUnique({ where: { id: advertiserId }, select: { timeZone: true } });
  if (!adv) return 0;
  const today = simDateIn(new Date(atMs), adv.timeZone);
  const open = await tx.experiment.findMany({
    where: { sandboxId, advertiserId, status: { in: ['SCHEDULED', 'ACTIVE'] } },
    select: { id: true, status: true, startDate: true, endDate: true },
  });
  let n = 0;
  for (const e of open) {
    if (e.status === 'SCHEDULED' && isoDay(e.startDate) <= today) {
      await tx.experiment.update({ where: { id: e.id }, data: { status: 'ACTIVE' } });
      n++;
    } else if (e.status === 'ACTIVE' && e.endDate && isoDay(e.endDate) < today) {
      await tx.experiment.update({
        where: { id: e.id },
        data: { status: 'COMPLETED', endedAt: new Date(atMs) },
      });
      n++;
    }
  }
  return n;
}

export interface ExperimentShareParams {
  contaminationShare: number;
  identifiedOnlyShare: number;
}

/**
 * Supply share per line item in an ACTIVE test (engine 6.7). An arm sees its split of the supply; a share
 * `contaminationShare` of requests carries no stable ID and may serve any arm. "Exclude unidentified users" removes
 * those requests and keeps only `identifiedOnlyShare` of the supply. Line items outside a test are not in the map.
 */
export async function experimentSupplyShares(
  tx: Tx,
  sandboxId: string,
  advertiserId: string,
  p: ExperimentShareParams,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const tests = await tx.experiment.findMany({
    where: { sandboxId, advertiserId, status: 'ACTIVE' },
    select: {
      target: true,
      excludeUnidentifiedUsers: true,
      arms: { select: { splitPct: true, entities: { select: { ioId: true, lineItemId: true } } } },
    },
  });
  for (const t of tests) {
    for (const arm of t.arms) {
      const split = arm.splitPct / 100;
      const share = t.excludeUnidentifiedUsers
        ? split * p.identifiedOnlyShare
        : split * (1 - p.contaminationShare) + (1 - split) * p.contaminationShare;
      const ids = await lineItemIdsOf(
        tx,
        t.target,
        arm.entities.map((e) => (e.ioId ?? e.lineItemId) as string),
      );
      for (const id of ids) out.set(id, Math.min(out.get(id) ?? 1, Math.max(0.01, share)));
    }
  }
  return out;
}

/** Flight progress, status and milestone results. Returns the number of rows changed. */
export async function advanceLiftStudies(
  tx: Tx,
  sandboxId: string,
  advertiserId: string,
  atMs: number,
): Promise<number> {
  const adv = await tx.advertiser.findUnique({
    where: { id: advertiserId },
    select: { timeZone: true, currencyCode: true },
  });
  if (!adv) return 0;
  const today = simDateIn(new Date(atMs), adv.timeZone);
  const flights = await tx.liftFlight.findMany({
    where: {
      sandboxId,
      study: { advertiserId },
      status: { in: ['ELIGIBLE', 'NOT_ELIGIBLE', 'IN_PROGRESS', 'PAUSED'] },
    },
    include: { study: { include: { entities: true, searchTerms: true } } },
  });
  let n = 0;
  const inr = flights.length ? await inrMultiplier(tx, adv.currencyCode) : 1;
  for (const f of flights) {
    const ioIds = f.study.entities.map((e) => e.ioId);
    const [lis, ios] = await Promise.all([
      loadStudyLis(tx, ioIds),
      tx.insertionOrder.findMany({ where: { id: { in: ioIds } }, select: { id: true, name: true, status: true } }),
    ]);
    if (f.status === 'NOT_ELIGIBLE') {
      // re-evaluated only on Review & fix, never by the engine
      continue;
    }
    const required = f.requiredMediaCost
      ? Number(f.requiredMediaCost)
      : liftRequirement(f.liftType, f.study.strength, liftParams(), inr);
    const startDate = isoDay(f.startedAt);
    const prog = await flightProgress(tx, { lis, type: f.liftType, startDate, today, required });
    const allPaused = ios.length > 0 && ios.every((i) => i.status !== 'ACTIVE');
    const status = prog.pct >= 100 ? 'COMPLETE' : allPaused ? 'PAUSED' : 'IN_PROGRESS';
    const crossed = milestone(prog.pct) > milestone(f.pctComplete) || (status === 'COMPLETE' && f.status !== 'COMPLETE');
    const changed =
      status !== f.status || prog.pct !== f.pctComplete || prog.mediaCostSoFar !== Number(f.mediaCostSoFar);
    if (!changed && !crossed) continue;
    await tx.liftFlight.update({
      where: { id: f.id },
      data: {
        status,
        pctComplete: prog.pct,
        mediaCostSoFar: prog.mediaCostSoFar,
        ...(status === 'COMPLETE' ? { endedAt: new Date(atMs) } : {}),
      },
    });
    n++;
    if (crossed) {
      n += await writeFlightResults(tx, {
        sandboxId,
        study: { id: f.study.id, brandLiftMetrics: f.study.brandLiftMetrics, strength: f.study.strength },
        flightId: f.id,
        type: f.liftType,
        startDate,
        today,
        lis,
        ioNames: new Map(ios.map((i) => [i.id, i.name])),
        groups: f.study.searchTerms.length,
      });
    }
    await syncStudyStatus(tx, f.study.id);
  }
  return n;
}

/** Study status follows its flights: the most advanced open flight, else the latest closed one. */
export async function syncStudyStatus(tx: Tx, studyId: string): Promise<void> {
  const flights = await tx.liftFlight.findMany({ where: { studyId }, select: { status: true, number: true, liftType: true } });
  if (flights.length === 0) return;
  const order = ['IN_PROGRESS', 'PAUSED', 'NOT_ELIGIBLE', 'ELIGIBLE', 'COMPLETE', 'ENDED'] as const;
  const status = order.find((s) => flights.some((f) => f.status === s)) ?? flights[0]!.status;
  await tx.liftStudy.update({ where: { id: studyId }, data: { status } });
}

