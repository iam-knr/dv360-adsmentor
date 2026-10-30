// Advertisers list, Create advertiser and status (module 02 4.1 to 4.3; AC-02-1 to AC-02-8).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { createAdvertiser, listAdvertisers, setAdvertiserStatus } from '@/lib/settings/advertisers';
import { getBrandControls } from '@/lib/settings/brand-controls';
import { dropWorld } from '../db/helpers';
import { addAdvertiser, adminFor, groupsOf, settingsWorld, userFor, type World } from './helpers';

let w: World;
beforeAll(async () => {
  w = await settingsWorld('setadv');
});
afterAll(async () => {
  // the SGD to INR rate this file adds is global: leave none behind for tests/metrics/fixtures.db.test.ts
  await prisma.fxRate.deleteMany({
    where: { fromCurrency: 'SGD', toCurrency: 'INR', validFrom: new Date('2020-01-01T00:00:00Z') },
  });
  await dropWorld(w);
  await prisma.$disconnect();
});

const valid = {
  name: 'New advertiser',
  website: 'https://new.example',
  currencyCode: 'SGD',
  timeZone: 'Asia/Singapore',
  adServer: 'THIRD_PARTY_ONLY' as const,
};

describe('createAdvertiser', () => {
  it('empty name and website give "Enter a value" and write nothing (AC-02-5)', async () => {
    const before = await prisma.advertiser.count({ where: { partnerId: w.partnerId } });
    const res = await createAdvertiser(userFor(w), w.partnerId, {
      ...valid,
      name: '',
      website: '',
    });
    expect(!res.ok && res.issues.map((i) => [i.path, i.message])).toEqual([
      ['name', 'Enter a value'],
      ['website', 'Enter a value'],
    ]);
    expect(await prisma.advertiser.count({ where: { partnerId: w.partnerId } })).toBe(before);
  });

  it('read only roles are refused (AC-02-8)', async () => {
    expect(await createAdvertiser(userFor(w, 'READ_ONLY'), w.partnerId, valid)).toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });
  });

  it('creates the advertiser with 10 alert preferences, a Floodlight group and a CREATE history group (AC-02-6)', async () => {
    const res = await createAdvertiser(userFor(w), w.partnerId, valid);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const a = await prisma.advertiser.findUniqueOrThrow({ where: { id: res.data.id } });
    expect(a).toMatchObject({
      status: 'ACTIVE',
      currencyCode: 'SGD',
      sdfVersion: 'V11',
      googleInventoryEnabled: true,
    });
    expect(a.floodlightGroupId).toBeTruthy();
    const prefs = await prisma.advertiserAlertPreference.findMany({
      where: { advertiserId: a.id },
    });
    expect(prefs).toHaveLength(10);
    expect(prefs.find((p) => p.alertType === 'UNDERPACING')).toMatchObject({
      enabled: true,
      thresholdPct: 90,
    });
    expect(prefs.find((p) => p.alertType === 'EXCEEDED_SPEND_THRESHOLD')).toMatchObject({
      enabled: false,
    });
    expect(await prisma.floodlightGroup.count({ where: { advertiserId: a.id } })).toBe(1);
    const groups = await groupsOf(a.id);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.entries.every((e) => e.kind === 'CREATE')).toBe(true);
    expect(groups[0]?.entries.length).toBeGreaterThan(5);
  });

  it('copy settings from another advertiser copies authorizations, alert preferences and SDF (ADV-022 for foreign ones)', async () => {
    const src = await addAdvertiser(w, 'Copy source');
    await prisma.advertiser.update({
      where: { id: src.id },
      data: { sdfVersion: 'V9', adBadging: false, sdfAdminEmail: 'sdf@example.test' },
    });
    await prisma.advertiserAlertPreference.create({
      data: {
        sandboxId: w.sandboxId,
        advertiserId: src.id,
        alertType: 'UNDERPACING',
        enabled: true,
        thresholdPct: 60,
      },
    });
    const res = await createAdvertiser(userFor(w), w.partnerId, {
      ...valid,
      name: 'Copy target',
      copyFromAdvertiserId: src.id,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const a = await prisma.advertiser.findUniqueOrThrow({ where: { id: res.data.id } });
    expect(a).toMatchObject({
      sdfVersion: 'V9',
      adBadging: false,
      sdfAdminEmail: 'sdf@example.test',
    });
    expect(
      await prisma.advertiserAlertPreference.findFirst({
        where: { advertiserId: a.id, alertType: 'UNDERPACING' },
      }),
    ).toMatchObject({ thresholdPct: 60 });
    const bad = await createAdvertiser(userFor(w), w.partnerId, {
      ...valid,
      name: 'Bad copy',
      copyFromAdvertiserId: 'does-not-exist',
    });
    expect(!bad.ok && bad.issues.map((i) => i.code)).toEqual(['ADV-022']);
  });

  it('a partner holds up to 50 advertisers (ADV-023)', async () => {
    const have = await prisma.advertiser.count({ where: { partnerId: w.partnerId } });
    await prisma.advertiser.createMany({
      data: Array.from({ length: 50 - have }, (_, i) => ({
        sandboxId: w.sandboxId,
        partnerId: w.partnerId,
        name: `Filler ${i}`,
        websiteUrl: 'https://f.example',
        currencyCode: 'INR',
        timeZone: 'UTC',
        status: 'PAUSED' as const,
      })),
    });
    const res = await createAdvertiser(userFor(w), w.partnerId, { ...valid, name: 'One too many' });
    expect(!res.ok && res.issues.map((i) => [i.code, i.message])).toEqual([
      ['ADV-023', 'This partner can have up to 50 advertisers.'],
    ]);
    await prisma.advertiser.deleteMany({
      where: { partnerId: w.partnerId, name: { startsWith: 'Filler' } },
    });
  });
});

describe('listAdvertisers', () => {
  it('hides paused advertisers by default and shows them when asked (AC-02-1, AC-02-2)', async () => {
    const paused = await addAdvertiser(w, 'Paused one', { status: 'PAUSED' });
    const def = await listAdvertisers(userFor(w), w.partnerId);
    expect(def.ok).toBe(true);
    if (!def.ok) return;
    expect(def.data.rows.some((r) => r.id === paused.id)).toBe(false);
    expect(def.data.canCreate).toBe(true);
    const all = await listAdvertisers(userFor(w), w.partnerId, {
      status: ['ACTIVE', 'PAUSED', 'SCHEDULED_FOR_DELETION'],
    });
    expect(all.ok && all.data.rows.some((r) => r.id === paused.id)).toBe(true);
    const q = await listAdvertisers(userFor(w), w.partnerId, { q: 'paused', status: ['PAUSED'] });
    expect(q.ok && q.data.rows.map((r) => r.name)).toEqual(['Paused one']);
  });

  it('a read only user gets limitedAccess and cannot create', async () => {
    const res = await listAdvertisers(userFor(w, 'READ_ONLY'), w.partnerId);
    expect(res.ok && res.data).toMatchObject({ canCreate: false, limitedAccess: true });
  });

  it('sums delivery of the day and converts the cards through FxRate (AC-02-3)', async () => {
    await prisma.fxRate.upsert({
      where: {
        fromCurrency_toCurrency_validFrom: {
          fromCurrency: 'SGD',
          toCurrency: 'INR',
          validFrom: new Date('2020-01-01T00:00:00Z'),
        },
      },
      create: {
        fromCurrency: 'SGD',
        toCurrency: 'INR',
        rate: '60',
        validFrom: new Date('2020-01-01T00:00:00Z'),
      },
      update: { rate: '60' },
    });
    const sgd = await addAdvertiser(w, 'SGD advertiser', { currencyCode: 'SGD' });
    const camp = await prisma.campaign.create({
      data: {
        sandboxId: w.sandboxId,
        advertiserId: sgd.id,
        name: 'C',
        plannedStart: new Date('2026-01-01T00:00:00Z'),
      },
    });
    const io = await prisma.insertionOrder.create({
      data: {
        sandboxId: w.sandboxId,
        campaignId: camp.id,
        advertiserId: sgd.id,
        name: 'IO SGD',
        objective: 'CLICKS',
        status: 'ACTIVE',
      },
    });
    const seg = await prisma.budgetSegment.create({
      data: {
        sandboxId: w.sandboxId,
        ioId: io.id,
        amount: '100',
        startDate: new Date('2025-12-01T00:00:00Z'),
        endDate: new Date('2026-12-01T00:00:00Z'),
      },
    });
    const li = await prisma.lineItem.create({
      data: {
        sandboxId: w.sandboxId,
        ioId: io.id,
        campaignId: camp.id,
        advertiserId: sgd.id,
        name: 'LI SGD',
        type: 'DISPLAY',
      },
    });
    const day = new Date('2026-01-01T00:00:00Z'); // the world's clock starts 2026-01-01, so "yesterday" is 2025-12-31
    const yesterday = new Date('2025-12-31T00:00:00Z');
    await prisma.simDailyMetric.create({
      data: {
        sandboxId: w.sandboxId,
        classroomId: w.classroomId,
        lineItemId: li.id,
        simDate: yesterday,
        impressions: 1234n,
        revenue: '12.5',
      },
    });
    await prisma.simPacingSnapshot.create({
      data: {
        sandboxId: w.sandboxId,
        ioId: io.id,
        budgetSegmentId: seg.id,
        simDate: yesterday,
        actualSpendToDate: '20',
        budgetAtRisk: '30',
        underpacing: true,
      },
    });
    void day;
    const res = await listAdvertisers(userFor(w), w.partnerId);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.date).toBe('2025-12-31');
    const row = res.data.rows.find((r) => r.id === sgd.id);
    expect(row).toMatchObject({
      currencyCode: 'SGD',
      impressions: 1234,
      revenue: 12.5,
      currentBudget: 100,
      budgetAtRisk: 30,
      underpacing: 1,
      totalActive: 1,
    });
    // 100 SGD * 60 = 6000 INR; at risk 30 %, spent 20 %, the rest likely: adds to 100.
    expect(res.data.summary.budgetAtRisk).toMatchObject({
      total: 6000,
      spendPct: 20,
      atRiskPct: 30,
      likelyPct: 50,
    });
    expect(res.data.summary.pacing).toMatchObject({ active: 1, underpacingPct: 100, pacingPct: 0 });
    const split = await listAdvertisers(userFor(w), w.partnerId, { segment: 'BUDGET_TYPE' });
    expect(
      split.ok && split.data.rows.filter((r) => r.id === sgd.id).map((r) => r.budgetType),
    ).toEqual(['AMOUNT']);
  });
});

describe('setAdvertiserStatus', () => {
  it('a STANDARD student can pause and resume; the change is logged (RC-047)', async () => {
    const a = await addAdvertiser(w, 'Pause me');
    const res = await setAdvertiserStatus(userFor(w), a.id, 'PAUSED');
    expect(res).toMatchObject({ ok: true, data: { status: 'PAUSED' } });
    const g = (await groupsOf(a.id))[0];
    expect(g?.summary).toBe('Status changed to Paused');
    expect(g?.entries[0]).toMatchObject({
      kind: 'STATUS_CHANGE',
      oldValue: 'ACTIVE',
      newValue: 'PAUSED',
    });
    expect(await setAdvertiserStatus(userFor(w), a.id, 'ACTIVE')).toMatchObject({
      ok: true,
      data: { status: 'ACTIVE' },
    });
    expect(await setAdvertiserStatus(userFor(w, 'READ_ONLY'), a.id, 'PAUSED')).toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });
  });
});

describe('getBrandControls', () => {
  it('reads coverage per advertiser from targeting rows (AC-02-18, AC-02-19)', async () => {
    const a = await addAdvertiser(w, 'Brand advertiser');
    const camp = await prisma.campaign.create({
      data: {
        sandboxId: w.sandboxId,
        advertiserId: a.id,
        name: 'BC',
        plannedStart: new Date('2026-01-01T00:00:00Z'),
      },
    });
    const io = await prisma.insertionOrder.create({
      data: {
        sandboxId: w.sandboxId,
        campaignId: camp.id,
        advertiserId: a.id,
        name: 'IO',
        objective: 'CLICKS',
      },
    });
    const mk = (name: string, type: 'DISPLAY' | 'YT_VIDEO', over: object = {}) =>
      prisma.lineItem.create({
        data: {
          sandboxId: w.sandboxId,
          ioId: io.id,
          campaignId: camp.id,
          advertiserId: a.id,
          name,
          type,
          status: 'ACTIVE',
          ...over,
        },
      });
    const one = await mk('One', 'DISPLAY', { inventoryQuality: 'AUTHORIZED_DIRECT_SELLERS' });
    await mk('Two', 'DISPLAY');
    await mk('Paused', 'DISPLAY', { status: 'PAUSED' });
    await mk('YT', 'YT_VIDEO');
    await prisma.targetingAssignment.create({
      data: {
        sandboxId: w.sandboxId,
        ownerType: 'LINE_ITEM',
        lineItemId: one.id,
        dimension: 'KEYWORD',
        mode: 'EXCLUDE',
      },
    });
    await prisma.targetingAssignment.create({
      data: {
        sandboxId: w.sandboxId,
        ownerType: 'ADVERTISER',
        advertiserId: a.id,
        dimension: 'BRAND_SUITABILITY',
        isLocked: true,
      },
    });
    const res = await getBrandControls(userFor(w), w.partnerId, 'DISPLAY_VIDEO');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const row = res.data.find((r) => r.advertiserId === a.id);
    expect(row?.activeLineItems).toBe(2);
    expect(row?.coverage.KEYWORDS).toEqual({ pct: 50, covered: 1, total: 2 });
    expect(row?.coverage.DIGITAL_CONTENT_LABELS).toEqual({ pct: 100, covered: 2, total: 2 });
    expect(row?.coverage.AUTHORIZED_SELLERS).toEqual({ pct: 50, covered: 1, total: 2 });
    const yt = await getBrandControls(userFor(w), w.partnerId, 'YOUTUBE');
    expect(yt.ok && yt.data.find((r) => r.advertiserId === a.id)?.activeLineItems).toBe(1);
  });
});

void adminFor;
