// Global reference data every environment needs before a student sandbox can be built: exchanges, the targeting
// catalogue, report reference rows and the Marketplace catalogue. Idempotent (rows keyed by code or stable id) and
// serialised by a transaction-scoped advisory lock, so parallel builds and parallel sandbox claims cannot interleave.
// It never creates accounts, classrooms or sandboxes. Called from the production bootstrap
// (prisma/bootstrap/05-reference.bootstrap.ts), from prisma/seed/10-reference.seed.ts and, as a self-heal, from
// provisionSandbox. Relative imports only: it runs under tsx.
import type { PrismaClient } from '@prisma/client';
import { buildCatalogue } from '../inventory/catalogue';
import { seedReferenceData, type ReferenceSeedResult } from './reference-db';
import { EXCHANGES } from './reference';

/** Arbitrary constant key for pg_advisory_xact_lock. */
const REFERENCE_LOCK_KEY = 7_302_410_001;

export interface EnsureReferenceResult extends ReferenceSeedResult {
  marketplaceProducts: number;
}

/** Writes the global reference rows in one transaction. Safe to run any number of times, concurrently. */
export async function ensureReferenceData(db: PrismaClient): Promise<EnsureReferenceResult> {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${REFERENCE_LOCK_KEY})`;
      const result = await seedReferenceData(tx);
      // Needs the exchanges written just above.
      const products = buildCatalogue();
      for (const p of products) {
        const data = {
          type: p.type,
          exchangeId: p.exchangeId,
          name: p.name,
          description: p.description,
          sellerKind: p.sellerKind,
          isInstantSeller: p.isInstantSeller,
          instantTargetingOptions: p.instantTargetingOptions ?? undefined,
          sevenDayImpressions: p.sevenDayImpressions,
          floorPrice: p.floorPrice,
          floorCurrency: p.floorCurrency,
          featuredCarousel: p.featuredCarousel,
          featuredCarouselOrder: p.featuredCarouselOrder,
          bannerKey: p.bannerKey,
          categories: p.categories,
          googleAudienceCount: p.googleAudienceCount,
          scale: p.scale as object,
          searchText: p.searchText,
        };
        await tx.marketplaceProduct.upsert({
          where: { id: p.id },
          create: { id: p.id, ...data },
          update: data,
        });
      }
      return { ...result, marketplaceProducts: products.length };
    },
    { timeout: 120_000, maxWait: 30_000 },
  );
}

/** True when any exchange of the catalogue is absent (what a sandbox build checks, lib/seed/write.ts). */
export async function referenceDataMissing(db: PrismaClient): Promise<boolean> {
  return (
    (await db.exchange.count({ where: { id: { in: EXCHANGES.map((e) => e.id) } } })) <
    EXCHANGES.length
  );
}
