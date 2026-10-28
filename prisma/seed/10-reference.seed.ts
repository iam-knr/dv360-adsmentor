// Global reference data: exchanges and the targeting catalogue (data-model 3.1 step 1). Idempotent.
import { prisma } from '../../lib/db/client';
import { seedReferenceData } from '../../lib/seed/reference-db';

export async function run(): Promise<void> {
  const result = await seedReferenceData(prisma);
  console.log(
    `  exchanges: ${result.exchanges.created} created, ${result.exchanges.updated} updated`,
  );
  console.log(
    `  targeting options: ${result.targetingOptions.created} created, ${result.targetingOptions.updated} updated`,
  );
}
