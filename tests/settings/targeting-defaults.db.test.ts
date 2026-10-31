// Partner targeting defaults (module 02 4.6; AC-02-15) and the Create advertiser context (module 02 2.2).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { getCreateAdvertiserContext } from '@/lib/settings/create-advertiser-context';
import { getTargetingDefaults, saveTargetingDefaults } from '@/lib/settings/targeting-defaults';
import { dropWorld } from '../db/helpers';
import { addAdvertiser, adminFor, settingsWorld, userFor, type World } from './helpers';

let w: World;
beforeAll(async () => {
  w = await settingsWorld('settgtdef');
});
afterAll(async () => {
  await dropWorld(w);
  await prisma.$disconnect();
});

describe('getTargetingDefaults', () => {
  it('starts with no rows, so the page shows the default summaries', async () => {
    const res = await getTargetingDefaults(adminFor(w), w.partnerId);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.state.criteria).toEqual({});
    expect(res.data.canWrite).toBe(true);
    expect(res.data.limitedAccess).toBe(false);
  });

  it('marks a student as read only', async () => {
    const res = await getTargetingDefaults(userFor(w), w.partnerId);
    expect(res.ok && res.data.canWrite).toBe(false);
  });
});

describe('saveTargetingDefaults', () => {
  it('stores Environment and Position as partner rows and reads them back', async () => {
    const admin = adminFor(w);
    const before = await getTargetingDefaults(admin, w.partnerId);
    if (!before.ok) throw new Error('load');
    const res = await saveTargetingDefaults(
      admin,
      w.partnerId,
      {
        criteria: {
          environment: { web: true, app: false },
          position: { onScreen: ['ABOVE_THE_FOLD'], inContent: [], native: [] },
        },
        autoEnableNewExchanges: false,
      },
      { expectedVersion: before.data.version },
    );
    expect(res.ok).toBe(true);
    const rows = await prisma.targetingAssignment.findMany({
      where: { ownerType: 'PARTNER', partnerId: w.partnerId },
    });
    expect(rows.map((r) => r.dimension).sort()).toEqual(['ENVIRONMENT', 'POSITION_ON_SCREEN']);
    const after = await getTargetingDefaults(admin, w.partnerId);
    if (!after.ok) throw new Error('reload');
    expect(after.data.state.criteria.environment).toEqual({ web: true, app: false });
    expect(after.data.autoEnableNewExchanges).toBe(false);
    expect(after.data.version).toBe(before.data.version + 1);
  });

  it('replaces the rows on the next save and drops removed dimensions', async () => {
    const admin = adminFor(w);
    const res = await saveTargetingDefaults(admin, w.partnerId, {
      criteria: { environment: { web: true, app: true } },
      autoEnableNewExchanges: true,
    });
    expect(res.ok).toBe(true);
    const rows = await prisma.targetingAssignment.findMany({
      where: { ownerType: 'PARTNER', partnerId: w.partnerId },
    });
    expect(rows.map((r) => r.dimension).sort()).toEqual(['ENVIRONMENT', 'ENVIRONMENT']);
  });

  it('does not touch line item rows of the same sandbox', async () => {
    const adv = await addAdvertiser(w, 'Defaults other');
    await prisma.targetingAssignment.create({
      data: {
        sandboxId: w.sandboxId,
        ownerType: 'ADVERTISER',
        advertiserId: adv.id,
        dimension: 'ENVIRONMENT',
        mode: 'INCLUDE',
      },
    });
    await saveTargetingDefaults(adminFor(w), w.partnerId, {
      criteria: {},
      autoEnableNewExchanges: true,
    });
    expect(
      await prisma.targetingAssignment.count({
        where: { ownerType: 'ADVERTISER', advertiserId: adv.id },
      }),
    ).toBe(1);
    expect(
      await prisma.targetingAssignment.count({
        where: { ownerType: 'PARTNER', partnerId: w.partnerId },
      }),
    ).toBe(0);
  });

  it('returns FORBIDDEN for a student and CONFLICT for a stale version', async () => {
    const denied = await saveTargetingDefaults(userFor(w), w.partnerId, {
      criteria: {},
      autoEnableNewExchanges: true,
    });
    expect(!denied.ok && denied.code).toBe('FORBIDDEN');
    const stale = await saveTargetingDefaults(
      adminFor(w),
      w.partnerId,
      { criteria: {}, autoEnableNewExchanges: true },
      { expectedVersion: 0 },
    );
    expect(!stale.ok && stale.code).toBe('CONFLICT');
  });
});

describe('getCreateAdvertiserContext', () => {
  it('lists the partner currency, time zone and the advertisers to copy from', async () => {
    const res = await getCreateAdvertiserContext(adminFor(w), w.partnerId);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.advertisers.length).toBeGreaterThanOrEqual(1);
    expect(res.data.canCreate).toBe(true);
    expect(res.data.atCap).toBe(false);
    expect(res.data.partnerCurrency).toBeTruthy();
  });
});
