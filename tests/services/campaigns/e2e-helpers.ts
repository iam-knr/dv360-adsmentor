// Shared by tests/e2e/campaigns.spec.ts and tests/e2e/insertion-orders.spec.ts: sign-in and seeded rows for a ShellWorld.
// Synthetic data only. Rows are written with the plain client (table owner, not subject to RLS).
import type { PrismaClient } from '@prisma/client';
import type { Page } from '@playwright/test';
import type { ShellWorld } from '../../shell/e2e-world';

export async function signIn(page: Page, w: ShellWorld) {
  await page.goto('/sim/login');
  await page.getByLabel('Email').fill(w.email);
  await page.getByLabel('Password').fill(w.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sim/login'));
}

export const advPath = (w: ShellWorld, sub = '') => `/p/${w.ids.pid}/a/${w.ids.aid}${sub}`;

/** A started, active campaign with Awareness / CPM, optionally with a frequency cap. */
export async function seedCampaign(
  db: PrismaClient,
  w: ShellWorld,
  name: string,
  over: { freqMax?: number; status?: 'ACTIVE' | 'PAUSED' } = {},
) {
  const c = await db.campaign.create({
    data: {
      sandboxId: w.sandboxId,
      advertiserId: w.rows.advertiserId,
      name,
      goal: 'AWARENESS',
      kpi: 'CPM',
      kpiValue: '50',
      creativeTypes: ['DISPLAY'],
      plannedStart: new Date('2025-06-01T00:00:00Z'),
      ...(over.status ? { status: over.status } : {}),
      ...(over.freqMax
        ? {
            freqMode: 'LIMITED' as const,
            freqMaxExposures: over.freqMax,
            freqUnit: 'MONTH' as const,
            freqUnitCount: 1,
          }
        : {}),
    },
  });
  return { id: c.id, publicId: c.publicId.toString() };
}

/** An IO with one segment, in an existing campaign (by row id). */
export async function seedIo(
  db: PrismaClient,
  w: ShellWorld,
  campaignRowId: string,
  name: string,
  over: { status?: 'DRAFT' | 'ACTIVE' | 'PAUSED'; amount?: string } = {},
) {
  const io = await db.insertionOrder.create({
    data: {
      sandboxId: w.sandboxId,
      campaignId: campaignRowId,
      advertiserId: w.rows.advertiserId,
      name,
      type: 'STANDARD',
      objective: 'CLICKS',
      kpi: 'CPC',
      kpiValue: '5',
      status: over.status ?? 'DRAFT',
    },
  });
  const segment = await db.budgetSegment.create({
    data: {
      sandboxId: w.sandboxId,
      ioId: io.id,
      ordinal: 0,
      amount: over.amount ?? '1000',
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-12-31T00:00:00Z'),
    },
  });
  return { id: io.id, publicId: io.publicId.toString(), segmentId: segment.id };
}
