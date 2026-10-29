// Inserts a sandbox plan and its history stub (data-model 3.1 step 2). Runs inside the caller's transaction.
import type { Prisma } from '@prisma/client';
import { Rng, hashString } from './prng';
import type { HistoryRows } from './history-stub';
import type { SandboxPlan } from './types';

type Tx = Prisma.TransactionClient;

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function insert<T>(
  rows: readonly T[],
  size: number,
  write: (batch: T[]) => Promise<unknown>,
): Promise<void> {
  for (const batch of chunk(rows, size)) await write(batch);
}

/**
 * Public ids come from entity_public_id_seq with small random gaps (data-model 3.3). The gaps are drawn from the plan's
 * seed, so a re-seed uses the same pattern; the numbers themselves depend on the sequence and are not part of the hash.
 */
async function nextPublicIds(tx: Tx, count: number, seedValue: number): Promise<bigint[]> {
  const rng = new Rng(hashString(`public-ids:${seedValue}`));
  const skips: number[] = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const skip = rng.chance(0.3) ? rng.int(1, 3) : 0;
    skips.push(skip);
    total += 1 + skip;
  }
  const rows = await tx.$queryRaw<
    { id: bigint }[]
  >`SELECT next_public_id() AS id FROM generate_series(1, ${total}::int)`;
  const out: bigint[] = [];
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    cursor += skips[i] as number;
    out.push((rows[cursor] as { id: bigint }).id);
    cursor += 1;
  }
  return out;
}

export interface InsertResult {
  rows: Record<string, number>;
}

export async function insertPlan(
  tx: Tx,
  plan: SandboxPlan,
  history: HistoryRows,
): Promise<InsertResult> {
  const sandboxId = plan.meta.sandboxId;
  const exchangeCount = await tx.exchange.count({
    where: { id: { in: plan.partnerExchanges.map((p) => p.exchangeId) } },
  });
  if (exchangeCount !== plan.partnerExchanges.length) {
    throw new Error(
      'Reference data is missing: run the global seed (npm run db:seed) before building a sandbox',
    );
  }

  const total =
    1 +
    plan.advertisers.length +
    plan.campaigns.length +
    plan.insertionOrders.length +
    plan.lineItems.length +
    plan.creatives.length +
    plan.audiences.length +
    plan.targetingTemplates.length;
  const ids = await nextPublicIds(tx, total, plan.meta.seedValue);
  let at = 0;
  const take = () => ids[at++] as bigint;
  const withPublicId = <T extends object>(rows: readonly T[]): (T & { publicId: bigint })[] =>
    rows.map((r) => ({ ...r, publicId: take() }));

  await tx.simClock.create({
    data: {
      sandboxId,
      simStart: plan.simClock.simStart,
      tickIndex: BigInt(plan.simClock.tickIndex),
      state: 'PAUSED',
      marketSeed: plan.simClock.marketSeed,
      sandboxSeed: plan.simClock.sandboxSeed,
      paramsVersion: plan.simClock.paramsVersion,
    },
  });
  await tx.partner.create({ data: { ...plan.partner, publicId: take() } });
  await tx.partnerExchange.createMany({ data: plan.partnerExchanges });
  await tx.advertiser.createMany({ data: withPublicId(plan.advertisers) });
  await tx.audience.createMany({ data: withPublicId(plan.audiences) });
  await tx.targetingTemplate.createMany({ data: withPublicId(plan.targetingTemplates) });
  await tx.campaign.createMany({ data: withPublicId(plan.campaigns) });
  await tx.campaignBudget.createMany({ data: plan.campaignBudgets });
  await tx.insertionOrder.createMany({ data: withPublicId(plan.insertionOrders) });
  await tx.budgetSegment.createMany({ data: plan.budgetSegments });
  await tx.lineItem.createMany({ data: withPublicId(plan.lineItems) });
  await tx.partnerCost.createMany({ data: plan.partnerCosts });
  await tx.creative.createMany({ data: withPublicId(plan.creatives) });
  await tx.creativeAsset.createMany({ data: plan.creativeAssets });
  await tx.creativeReview.createMany({ data: plan.creativeReviews });
  await tx.creativeAssignment.createMany({ data: plan.creativeAssignments });
  await insert(plan.targetingAssignments, 1000, (b) =>
    tx.targetingAssignment.createMany({ data: b }),
  );
  await tx.alert.createMany({ data: plan.alerts });
  await insert(plan.changeGroups, 1000, (b) => tx.changeGroup.createMany({ data: b }));
  await insert(plan.changeEntries, 1000, (b) => tx.changeEntry.createMany({ data: b }));
  await insert(history.daily, 400, (b) => tx.simDailyMetric.createMany({ data: b }));
  await insert(history.hourly, 400, (b) => tx.simHourlyMetric.createMany({ data: b }));
  await insert(history.diagnostics, 2000, (b) => tx.deliveryDiagnostic.createMany({ data: b }));

  return {
    rows: {
      partner: 1,
      advertisers: plan.advertisers.length,
      campaigns: plan.campaigns.length,
      insertionOrders: plan.insertionOrders.length,
      lineItems: plan.lineItems.length,
      creatives: plan.creatives.length,
      dailyMetrics: history.daily.length,
      hourlyMetrics: history.hourly.length,
      diagnostics: history.diagnostics.length,
    },
  };
}

/**
 * Removes every row the seed writes for one sandbox (reset, data-model 2.2). Sandbox, SimClock owner row and user access
 * grants stay; the partner keeps its id across re-seeds, so grants keep pointing at it.
 */
export async function clearSandboxData(tx: Tx, sandboxId: string): Promise<void> {
  const where = { sandboxId };
  await tx.inboxMessage.deleteMany({ where });
  await tx.changeEntry.deleteMany({ where });
  await tx.changeGroup.deleteMany({ where });
  await tx.simHourlyMetric.deleteMany({ where });
  await tx.simDailyMetric.deleteMany({ where });
  await tx.deliveryDiagnostic.deleteMany({ where });
  await tx.alert.deleteMany({ where });
  await tx.targetingAssignment.deleteMany({ where });
  await tx.creativeAssignment.deleteMany({ where });
  await tx.creativeReview.deleteMany({ where });
  await tx.creativeAsset.deleteMany({ where });
  await tx.creative.deleteMany({ where });
  await tx.targetingTemplate.deleteMany({ where });
  await tx.audience.deleteMany({ where });
  await tx.partnerCost.deleteMany({ where });
  await tx.budgetSegment.deleteMany({ where });
  await tx.ad.deleteMany({ where });
  await tx.adGroup.deleteMany({ where });
  await tx.lineItem.deleteMany({ where });
  await tx.insertionOrder.deleteMany({ where });
  await tx.campaignBudget.deleteMany({ where });
  await tx.campaign.deleteMany({ where });
  await tx.advertiser.deleteMany({ where });
  await tx.partnerExchange.deleteMany({ where });
  await tx.partner.deleteMany({ where });
  await tx.simClock.deleteMany({ where });
}
