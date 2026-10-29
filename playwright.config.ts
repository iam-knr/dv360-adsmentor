import { defineConfig } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3100';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: 'tests/e2e',
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    extraHTTPHeaders: bypass ? { 'x-vercel-protection-bypass': bypass } : {},
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [{ name: 'chromium' }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run build && npm run start -- -p 3100',
        url: 'http://127.0.0.1:3100/api/health',
        timeout: 240_000,
        reuseExistingServer: !process.env.CI,
        env: {
          DATABASE_URL: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? '',
          DIRECT_URL: process.env.DATABASE_URL_TEST ?? process.env.DIRECT_URL ?? '',
          CRON_SECRET: process.env.CRON_SECRET ?? 'e2e-demo-cron-secret', // tests/e2e/demo-path.spec.ts (P3-INT), test only
          ENABLE_GALLERY: '1', // tests/e2e/gallery.spec.ts (P3-04); the gallery is 404 in production otherwise
        },
      },
});
