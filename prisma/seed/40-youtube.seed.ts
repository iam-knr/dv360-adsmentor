// YouTube seed data (module 09 3.4): the synthetic video catalogue and, for every ready sandbox without them,
// YouTube line items with ad groups and ads. Runs after 30-resources. New sandboxes get the same rows from
// lib/seed/sandbox.ts (provisionSandbox).
import { prisma } from '../../lib/db/client';
import { seedYoutube, seedYoutubeVideos } from '../../lib/youtube/seed';

export async function run(): Promise<void> {
  const videos = await seedYoutubeVideos(prisma);
  console.log(`  youtube videos: ${videos} added`);
  const sandboxes = await prisma.sandbox.findMany({
    where: { provisionState: 'READY' },
    select: { id: true, seedTemplateKey: true, seedValue: true },
  });
  let advertisers = 0;
  for (const s of sandboxes) {
    advertisers += await prisma.$transaction(
      (tx) =>
        seedYoutube(tx, {
          sandboxId: s.id,
          template: s.seedTemplateKey ?? 'starter-agency',
          seedValue: s.seedValue ?? 0,
        }),
      { timeout: 120_000 },
    );
  }
  console.log(`  youtube: ${advertisers} advertisers seeded in ${sandboxes.length} sandboxes`);
}
