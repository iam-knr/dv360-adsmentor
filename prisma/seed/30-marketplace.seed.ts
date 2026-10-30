// Global Marketplace catalogue (module 13 3.3, P4-02). Written with the other reference data by lib/seed/ensure.ts
// (also run by the production bootstrap); this file re-runs it so `npm run db:seed` stays complete.
import { prisma } from '../../lib/db/client';
import { ensureReferenceData } from '../../lib/seed/ensure';

export async function run(): Promise<void> {
  const r = await ensureReferenceData(prisma);
  console.log(`  marketplace products: ${r.marketplaceProducts} upserted`);
}
