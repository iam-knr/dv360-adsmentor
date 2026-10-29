// Custom bidding model readiness (module 15 5, engine.md 4.3): readiness = min(1, trainingImpressions / 5000). An
// algorithm in TRAINING becomes ACTIVE when readiness reaches 100 %; a SUSPENDED one stays suspended. Called by the
// engine persist step once per tick (M15-09); the wizard and the list belong to session P4-05.
import type { CustomBiddingReadiness, CustomBiddingStatus } from '@prisma/client';
import type { Tx } from '@/lib/db';

export const TRAINING_TARGET_IMPRESSIONS = 5000;
/** Share of impressions where a rule could not be evaluated `[SIM]` (engine 4.3: 0.5 %). */
export const BASE_ERROR_PCT = 0.5;

export interface TrainingState {
  trainingImpressions: number;
  status: CustomBiddingStatus;
}

export interface TrainingResult {
  trainingImpressions: number;
  readinessPct: number;
  status: CustomBiddingStatus;
  modelReadiness: CustomBiddingReadiness;
}

export function readinessPct(trainingImpressions: number): number {
  return Math.min(
    100,
    Math.floor((Math.max(0, trainingImpressions) / TRAINING_TARGET_IMPRESSIONS) * 100),
  );
}

export function nextTraining(prev: TrainingState, labelledImpressions: number): TrainingResult {
  const trainingImpressions =
    prev.trainingImpressions + Math.max(0, Math.round(labelledImpressions));
  const pct = readinessPct(trainingImpressions);
  const status: CustomBiddingStatus =
    prev.status === 'SUSPENDED' ? 'SUSPENDED' : pct >= 100 ? 'ACTIVE' : 'TRAINING';
  const modelReadiness: CustomBiddingReadiness =
    pct >= 100 ? 'READY' : pct > 0 ? 'TRAINING' : 'NOT_READY';
  return { trainingImpressions, readinessPct: pct, status, modelReadiness };
}

/** Add this tick's impressions of the line items that use each algorithm and refresh the list columns. */
export async function advanceCustomBidding(
  tx: Tx,
  sandboxId: string,
  hourly: readonly { lineItemId: string; metrics: { impressions?: number } }[],
): Promise<number> {
  const byLi = new Map<string, number>();
  for (const h of hourly) {
    const n = h.metrics.impressions ?? 0;
    if (n > 0) byLi.set(h.lineItemId, (byLi.get(h.lineItemId) ?? 0) + n);
  }
  if (byLi.size === 0) return 0;
  const lis = await tx.lineItem.findMany({
    where: {
      sandboxId,
      id: { in: [...byLi.keys()] },
      customBiddingAlgorithmId: { not: null },
    },
    select: { id: true, customBiddingAlgorithmId: true },
  });
  const perAlgorithm = new Map<string, number>();
  for (const li of lis) {
    const id = li.customBiddingAlgorithmId!;
    perAlgorithm.set(id, (perAlgorithm.get(id) ?? 0) + (byLi.get(li.id) ?? 0));
  }
  let updated = 0;
  for (const [id, impressions] of perAlgorithm) {
    const alg = await tx.customBiddingAlgorithm.findUnique({
      where: { id },
      select: { trainingImpressions: true, status: true },
    });
    if (!alg) continue;
    const next = nextTraining(
      { trainingImpressions: Number(alg.trainingImpressions), status: alg.status },
      impressions,
    );
    await tx.customBiddingAlgorithm.update({
      where: { id },
      data: {
        trainingImpressions: BigInt(next.trainingImpressions),
        readinessPct: next.readinessPct,
        status: next.status,
        modelReadiness: next.modelReadiness,
        errorPct: BASE_ERROR_PCT,
        activeLineItems: await tx.lineItem.count({
          where: { customBiddingAlgorithmId: id, status: 'ACTIVE' },
        }),
      },
    });
    updated += 1;
  }
  return updated;
}
