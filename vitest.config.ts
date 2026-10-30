import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const alias = {
  '@': resolve(__dirname),
  'server-only': resolve(__dirname, 'tests/stubs/server-only.ts'),
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'node',
          include: [
            'tests/{unit,validation,engine,seed,metrics,changelog,auth,targeting,accounts,settings,creatives,resources,inventory,reporting,youtube,audiences,planning,bulk,sdf,charts}/**/*.test.ts',
            'tests/experiments/**/*.test.ts',
            'tests/{optimisation,troubleshooter}/**/*.test.ts',
          ],
          exclude: ['**/*.db.test.ts', '**/db/**'],
          setupFiles: ['./vitest.setup.ts'],
          testTimeout: 30_000,
        },
      },
      {
        esbuild: { jsx: 'automatic' },
        resolve: { alias },
        test: {
          name: 'components',
          environment: 'jsdom',
          include: [
            'tests/{components,shell,settings}/**/*.test.tsx',
            'tests/creatives/**/*.test.tsx',
            'tests/reporting/**/*.test.tsx',
          ],
          setupFiles: ['./vitest.setup.ts'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'db',
          environment: 'node',
          include: ['tests/{db,engine-io,services}/**/*.test.ts', 'tests/**/*.db.test.ts'],
          pool: 'forks',
          poolOptions: { forks: { singleFork: true } }, // one process, files run in sequence
          globalSetup: ['./tests/db/global-setup.ts'],
          setupFiles: ['./vitest.setup.ts'],
          testTimeout: 30_000,
        },
      },
    ],
  },
});
