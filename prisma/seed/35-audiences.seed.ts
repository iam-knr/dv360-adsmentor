// Audience seed data (module 14 3.3): the extra lists of every seeded sandbox that has no combined audience yet.
// Runs after 30-resources (Floodlight activities). New sandboxes get the same rows from lib/seed/sandbox.ts.
import { prisma } from '../../lib/db/client';
import { seedAudiences } from '../../lib/audiences/seed';

export async function run(): Promise<void> {
  const sandboxes = await prisma.sandbox.findMany({
    where: { provisionState: 'READY' },
    select: { id: true, seedTemplateKey: true, seedValue: true },
  });
  let advertisers = 0;
  for (const s of sandboxes) {
    advertisers += await prisma.$transaction(
      (tx) =>
        seedAudiences(tx, {
          sandboxId: s.id,
          template: s.seedTemplateKey ?? 'starter-agency',
          seedValue: s.seedValue ?? 0,
        }),
      { timeout: 120_000 },
    );
  }
  console.log(`  audiences: ${advertisers} advertisers seeded in ${sandboxes.length} sandboxes`);
}
