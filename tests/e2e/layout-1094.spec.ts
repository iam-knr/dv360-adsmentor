// Q13: at a 1094 px window the page must not stay scrolled sideways (left edge cut off) after a side panel is opened and
// closed or the account menu is opened. Nothing on the page may be scrolled horizontally at any step.
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';
import { cleanup } from '../auth/fixtures';
import { createShellWorld, type ShellWorld } from '../shell/e2e-world';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
let w: ShellWorld;

test.beforeAll(async () => {
  w = await createShellWorld(db, { tag: `pwlay-${Date.now()}` });
});
test.afterAll(async () => {
  await cleanup(db, { userIds: w.userIds, classroomIds: [w.classroomId] });
  await db.$disconnect();
});

test.use({ viewport: { width: 1094, height: 768 } });

/** Every element scrolled sideways, plus the window itself. */
async function sideways(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    if (window.scrollX !== 0) out.push(`window:${window.scrollX}`);
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
      if (el.scrollLeft !== 0 && getComputedStyle(el).direction !== 'rtl')
        out.push(
          `${el.tagName.toLowerCase()}#${el.id}.${String(el.className).slice(0, 40)}:${el.scrollLeft}`,
        );
    }
    return out;
  });
}

test('Q13 no sideways scroll after a panel is opened and closed and the account menu is opened (1094 px)', async ({
  page,
}) => {
  await page.goto('/sim/login');
  await page.getByLabel('Email').fill(w.email);
  await page.getByLabel('Password').fill(w.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sim/login'));
  await page.goto(`/p/${w.ids.pid}/a/${w.ids.aid}/cs`);
  await expect(page.getByRole('main')).toBeVisible();
  expect(await sideways(page)).toEqual([]);

  const rail = page.getByRole('complementary', { name: 'Side panels' });
  await rail.getByRole('button', { name: 'Ask Advisor' }).click();
  await expect(page.getByText('What can I help you with today?')).toBeVisible();
  expect(await sideways(page)).toEqual([]);
  await rail.getByRole('button', { name: 'Ask Advisor' }).click();
  await expect(page.getByText('What can I help you with today?')).toHaveCount(0);
  expect(await sideways(page)).toEqual([]);

  await page.getByRole('button', { name: /^Account:/ }).click();
  expect(await sideways(page)).toEqual([]);
  const box = await page.locator('header').first().boundingBox();
  expect(box?.x ?? 0).toBeGreaterThanOrEqual(0);
  await page.keyboard.press('Escape');
  expect(await sideways(page)).toEqual([]);
});
