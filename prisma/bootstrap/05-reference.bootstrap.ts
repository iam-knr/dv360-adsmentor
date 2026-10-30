// Makes sure the global reference data exists (exchanges, targeting catalogue, report reference, Marketplace). Runs on
// every deploy, in production too, before the Super admin step. Idempotent; creates no accounts, classrooms or sandboxes.
// The demo seeds (prisma/seed/20-*) stay behind the production guard.
import { prisma } from '../../lib/db/client';
import { ensureReferenceData } from '../../lib/seed/ensure';

export async function run(): Promise<void> {
  const r = await ensureReferenceData(prisma);
  console.log(
    `  reference data: exchanges +${r.exchanges.created}/~${r.exchanges.updated}, targeting +${r.targetingOptions.created}/~${r.targetingOptions.updated}, marketplace ${r.marketplaceProducts}`,
  );
}
