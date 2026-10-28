// Writes the global reference rows (data-model 3.1 step 1). Idempotent: rows are keyed by code, only changed rows are written.
import type { Prisma, PrismaClient } from '@prisma/client';
import { stableStringify } from './hash';
import {
  EXCHANGES,
  TARGETING_OPTIONS,
  type ExchangeSeed,
  type TargetingOptionSeed,
} from './reference';

type Db = PrismaClient | Prisma.TransactionClient;

export interface ReferenceSeedResult {
  exchanges: { created: number; updated: number };
  targetingOptions: { created: number; updated: number };
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const exchangeData = (e: ExchangeSeed) => ({
  name: e.name,
  kind: e.kind,
  supportsDisplay: e.supportsDisplay,
  supportsVideo: e.supportsVideo,
  supportsAudio: e.supportsAudio,
  supportsCtv: e.supportsCtv,
  supportsDooh: e.supportsDooh,
  needsSeatId: e.needsSeatId,
  needsNetworkId: e.needsNetworkId,
  enabledByDefault: e.enabledByDefault,
  sortOrder: e.sortOrder,
  auctionType: e.auctionType,
  simSupplyShare: e.simSupplyShare,
  simFloorCpm: e.simFloorCpm,
});

export async function seedExchanges(db: Db): Promise<ReferenceSeedResult['exchanges']> {
  const existing = new Map((await db.exchange.findMany()).map((r) => [r.code, r]));
  const toCreate: ExchangeSeed[] = [];
  let updated = 0;
  for (const e of EXCHANGES) {
    const row = existing.get(e.code);
    if (!row) {
      toCreate.push(e);
      continue;
    }
    const want = exchangeData(e);
    const same =
      row.name === want.name &&
      row.kind === want.kind &&
      row.supportsDisplay === want.supportsDisplay &&
      row.supportsVideo === want.supportsVideo &&
      row.supportsAudio === want.supportsAudio &&
      row.supportsCtv === want.supportsCtv &&
      row.supportsDooh === want.supportsDooh &&
      row.needsSeatId === want.needsSeatId &&
      row.needsNetworkId === want.needsNetworkId &&
      row.enabledByDefault === want.enabledByDefault &&
      row.sortOrder === want.sortOrder &&
      row.auctionType === want.auctionType &&
      row.simSupplyShare.toFixed(6) === want.simSupplyShare &&
      row.simFloorCpm.toFixed(6) === want.simFloorCpm;
    if (!same) {
      await db.exchange.update({ where: { id: row.id }, data: want });
      updated++;
    }
  }
  if (toCreate.length > 0) {
    await db.exchange.createMany({
      data: toCreate.map((e) => ({ id: e.id, code: e.code, ...exchangeData(e) })),
    });
  }
  return { created: toCreate.length, updated };
}

export async function seedTargetingOptions(
  db: Db,
): Promise<ReferenceSeedResult['targetingOptions']> {
  const existing = new Map(
    (await db.targetingOption.findMany()).map((r) => [`${r.dimension}:${r.code}`, r]),
  );
  const toCreate: TargetingOptionSeed[] = [];
  let updated = 0;
  for (const o of TARGETING_OPTIONS) {
    const row = existing.get(`${o.dimension}:${o.code}`);
    if (!row) {
      toCreate.push(o);
      continue;
    }
    const same =
      row.name === o.name &&
      row.path === o.path &&
      row.parentId === o.parentId &&
      row.sortOrder === o.sortOrder &&
      stableStringify(row.meta ?? null) === stableStringify(o.meta ?? null);
    if (!same) {
      await db.targetingOption.update({
        where: { id: row.id },
        data: {
          name: o.name,
          path: o.path,
          parentId: o.parentId,
          sortOrder: o.sortOrder,
          meta: (o.meta ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
      updated++;
    }
  }
  // Parents come before children in TARGETING_OPTIONS, so sequential batches satisfy the self reference.
  for (const part of chunk(toCreate, 500)) {
    await db.targetingOption.createMany({
      data: part.map((o) => ({
        id: o.id,
        dimension: o.dimension as Prisma.TargetingOptionCreateManyInput['dimension'],
        code: o.code,
        name: o.name,
        path: o.path,
        parentId: o.parentId,
        sortOrder: o.sortOrder,
        meta: (o.meta ?? undefined) as Prisma.InputJsonValue | undefined,
      })),
    });
  }
  return { created: toCreate.length, updated };
}

/**
 * Global seed. FxRate and GoogleAudience are not loaded: their models arrive with P3-05c (data-model Appendix C).
 * The rows live in data/reference/fx-rates.json and data/reference/google-audiences.json and are exposed by lib/seed/reference.ts.
 */
export async function seedReferenceData(db: Db): Promise<ReferenceSeedResult> {
  return { exchanges: await seedExchanges(db), targetingOptions: await seedTargetingOptions(db) };
}
