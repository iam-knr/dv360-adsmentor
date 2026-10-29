// Resource seed data (module 15 3.3): AppCatalog (global) and the resources of every seeded sandbox that has none yet.
// Runs after 20-template-sandboxes. New sandboxes get the same rows from lib/seed/sandbox.ts (provisionSandbox).
import { prisma } from '../../lib/db/client';
import { seedAppCatalog, seedResources } from '../../lib/resources/seed';

export async function run(): Promise<void> {
  const apps = await seedAppCatalog(prisma);
  console.log(`  app catalog: ${apps} apps added`);
  const sandboxes = await prisma.sandbox.findMany({
    where: { provisionState: 'READY' },
    select: { id: true, seedTemplateKey: true, seedValue: true },
  });
  let advertisers = 0;
  for (const s of sandboxes) {
    advertisers += await prisma.$transaction(
      (tx) =>
        seedResources(tx, {
          sandboxId: s.id,
          template: s.seedTemplateKey ?? 'starter-agency',
          seedValue: s.seedValue ?? 0,
        }),
      { timeout: 120_000 },
    );
  }
  console.log(`  resources: ${advertisers} advertisers seeded in ${sandboxes.length} sandboxes`);
}
