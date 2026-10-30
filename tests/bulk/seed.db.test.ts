// T11-11: the seed writes 12 jobs across every source and status, two saved views and two chart cards, once.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { seedBulk } from '@/lib/bulk/seed';
import { dropWorld } from '../db/helpers';
import { createLiWorld, type World } from '../services/line-items/helpers';

let w: World;
beforeAll(async () => {
  w = await createLiWorld('bseed');
  await prisma.bulkJob.deleteMany({ where: { sandboxId: w.sandboxId } });
});
afterAll(async () => {
  await dropWorld(w);
  await prisma.$disconnect();
});

describe('seedBulk', () => {
  it('writes the history once', async () => {
    const first = await prisma.$transaction((tx) => seedBulk(tx, { sandboxId: w.sandboxId, ownerUserId: w.userId, ownerName: 'Student' }));
    expect(first).toEqual({ jobs: 12, views: 2, charts: 2 });
    const second = await prisma.$transaction((tx) => seedBulk(tx, { sandboxId: w.sandboxId, ownerUserId: w.userId }));
    expect(second).toEqual({ jobs: 0, views: 0, charts: 0 });
    const jobs = await prisma.bulkJob.findMany({ where: { sandboxId: w.sandboxId } });
    expect(new Set(jobs.map((j) => j.source))).toEqual(new Set(['DUPLICATION', 'BULK_EDIT', 'CAMPAIGN_DOWNLOAD', 'SDF_DOWNLOAD', 'SDF_UPLOAD']));
    expect(jobs.some((j) => j.status === 'FAILED')).toBe(true);
  });
});
