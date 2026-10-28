import { expect, test } from '@playwright/test';

test('home page renders the product name', async ({ page }) => {
  const res = await page.goto('/');
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'DV360 Simulator by Adsmetor' })).toBeVisible();
});

test('health endpoint reports the database', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { ok: boolean; db: boolean };
  expect(body.ok).toBe(true);
  expect(body.db).toBe(true);
});
