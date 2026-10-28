// Prisma config. Replaces the deprecated package.json#prisma block.
// Schema folder and migrations folder are set here so migrations stay in prisma/migrations (build-plan 2.5).
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

export default defineConfig({
  schema: 'prisma/schema',
  migrations: { path: 'prisma/migrations' },
});
