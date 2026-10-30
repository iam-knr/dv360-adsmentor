// Advertiser basic details, panels, deletion, alert preferences, data manager and policy center (module 03).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import {
  cancelAdvertiserDeletion,
  getAdvertiserDetails,
  scheduleAdvertiserDeletion,
  updateAdvertiser,
  type AdvertiserDetails,
  type UpdateAdvertiserInput,
} from '@/lib/settings/advertiser-details';
import { listAdvertisers } from '@/lib/settings/advertisers';
import { getAlertPreferences, saveAlertPreferences } from '@/lib/settings/alert-prefs';
import {
  getDataManager,
  linkAccount,
  removeLinkedAccount,
  requestCreatorVideoAccess,
} from '@/lib/settings/data-manager';
import {
  decidePolicyCertificate,
  getPolicyCenter,
  requestPolicyCertificate,
} from '@/lib/settings/policy';
import { dropWorld } from '../db/helpers';
import { adminFor, groupsOf, settingsWorld, userFor, type World } from './helpers';

let w: World;
beforeAll(async () => {
  w = await settingsWorld('setdet');
  // The EU answer is required (ADV-011); a world without one would make the first save a change.
  await prisma.advertiser.update({
    where: { id: w.advertiserId },
    data: { euPoliticalAds: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADS' },
  });
  await prisma.thirdPartyVendor.upsert({
    where: { key: 'test-viewability' },
    create: { key: 'test-viewability', name: 'Test Viewability', group: 'VIEWABILITY' },
    update: {},
  });
  await prisma.thirdPartyVendor.upsert({
    where: { key: 'test-bidder' },
    create: { key: 'test-bidder', name: 'Test Bidder', group: 'BIDDING', feePct: '5' },
    update: {},
  });
});
afterAll(async () => {
  await dropWorld(w);
  await prisma.thirdPartyVendor.deleteMany({
    where: { key: { in: ['test-viewability', 'test-bidder'] } },
  });
  await prisma.$disconnect();
});

const details = async (user = userFor(w)): Promise<AdvertiserDetails> => {
  const res = await getAdvertiserDetails(user, w.advertiserId);
  if (!res.ok) throw new Error('details');
  return res.data;
};

function inputOf(
  d: AdvertiserDetails,
  over: Partial<UpdateAdvertiserInput> = {},
): UpdateAdvertiserInput {
  return {
    name: d.name,
    status: d.status,
    website: d.website,
    currencyCode: d.currencyCode,
    timeZone: d.timeZone,
    sdfVersion: d.sdfVersion,
    sdfAdminEmail: d.sdfAdminEmail,
    adServer: d.adServer,
    attributionFloodlightGroupId: d.attributionFloodlightGroupId,
    authorizations: d.authorizations,
    euPoliticalAds: d.euPoliticalAds ?? 'NO',
    demandGenFloodlightOptimization: d.demandGenFloodlightOptimization,
    businessName: d.businessName,
    integrationCode: d.integrationCode,
    iasClientId: d.iasClientId,
    vendors: d.selectedVendors,
    rateCards: d.rateCards,
    ...over,
  };
}

describe('getAdvertiserDetails', () => {
  it('read only callers get limitedAccess and cannot edit (AC-03-21)', async () => {
    const ro = await details(userFor(w, 'READ_ONLY'));
    expect(ro).toMatchObject({ limitedAccess: true, canEdit: false, canSchedule: false });
    const student = await details();
    expect(student).toMatchObject({
      canEdit: true,
      canEditAdmin: false,
      canSchedule: false,
      currencyCode: 'INR',
    });
    expect(await details(adminFor(w))).toMatchObject({ canSchedule: true, canEditAdmin: true });
  });
});

describe('updateAdvertiser', () => {
  it('a forged currency change returns ADV-004 and writes no history (AC-03-4)', async () => {
    const d = await details();
    const res = await updateAdvertiser(
      userFor(w),
      w.advertiserId,
      inputOf(d, { currencyCode: 'USD' }),
    );
    expect(!res.ok && res.issues.map((i) => i.code)).toEqual(['ADV-004']);
    expect(await groupsOf(w.advertiserId)).toHaveLength(0);
  });

  it('READ_ONLY gets FORBIDDEN (AC-03-21)', async () => {
    const d = await details();
    expect(
      await updateAdvertiser(userFor(w, 'READ_ONLY'), w.advertiserId, inputOf(d, { name: 'x' })),
    ).toMatchObject({ ok: false, code: 'FORBIDDEN' });
  });

  it('saving unchanged data writes no history group (AC-03-23, ADV-020)', async () => {
    const d = await details();
    const res = await updateAdvertiser(userFor(w), w.advertiserId, inputOf(d));
    expect(res.ok).toBe(true);
    expect(await groupsOf(w.advertiserId)).toHaveLength(0);
  });

  it('one entry per changed field with canonical old and new values (AC-03-23, AC-03-3)', async () => {
    const d = await details();
    const res = await updateAdvertiser(
      userFor(w),
      w.advertiserId,
      inputOf(d, {
        name: 'Renamed',
        status: 'PAUSED',
        sdfVersion: '9.1',
        authorizations: { ...d.authorizations, adBadging: !d.authorizations.adBadging },
      }),
      { expectedVersion: d.version, note: 'why' },
    );
    expect(res.ok).toBe(true);
    const g = (await groupsOf(w.advertiserId))[0];
    expect(g?.note).toBe('why');
    const byLabel = Object.fromEntries(
      (g?.entries ?? []).map((e) => [e.label, [e.oldValue, e.newValue]]),
    );
    expect(byLabel['Name']).toEqual([d.name, 'Renamed']);
    expect(byLabel['Status']).toEqual(['ACTIVE', 'PAUSED']);
    expect(byLabel['SDF version']).toEqual(['V9', 'V9_1']);
    expect(Object.keys(byLabel)).toHaveLength(4);
    const list = await listAdvertisers(userFor(w), w.partnerId, { status: ['PAUSED'] });
    expect(list.ok && list.data.rows.map((r) => r.name)).toContain('Renamed');
  });

  it('a stale version returns CONFLICT (DLG-11)', async () => {
    const d = await details();
    expect(
      await updateAdvertiser(userFor(w), w.advertiserId, inputOf(d, { name: 'Late' }), {
        expectedVersion: d.version - 1,
      }),
    ).toMatchObject({ ok: false, code: 'CONFLICT' });
    await prisma.advertiser.update({ where: { id: w.advertiserId }, data: { status: 'ACTIVE' } });
  });

  it('a STANDARD user cannot change the ad server or integration code; an Admin can (RC-047)', async () => {
    const d = await details();
    const res = await updateAdvertiser(
      userFor(w),
      w.advertiserId,
      inputOf(d, { adServer: 'CM360_HYBRID' }),
    );
    expect(res).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(
      await updateAdvertiser(userFor(w), w.advertiserId, inputOf(d, { integrationCode: 'abc' })),
    ).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    const ok = await updateAdvertiser(
      adminFor(w),
      w.advertiserId,
      inputOf(d, { adServer: 'CM360_HYBRID', integrationCode: 'abc', businessName: 'Acme' }),
    );
    expect(ok.ok).toBe(true);
    expect(await details()).toMatchObject({
      adServer: 'CM360_HYBRID',
      integrationCode: 'abc',
      businessName: 'Acme',
    });
  });

  it('validates SDF, e-mail, business name and the Floodlight group of the same partner (AC-03-5, AC-03-10)', async () => {
    const d = await details();
    const res = await updateAdvertiser(
      adminFor(w),
      w.advertiserId,
      inputOf(d, { sdfVersion: '12', sdfAdminEmail: 'bad', businessName: 'x'.repeat(26) }),
    );
    expect(!res.ok && res.issues.map((i) => i.code).sort()).toEqual([
      'ADV-006',
      'ADV-007',
      'ADV-013',
    ]);
    const foreign = await updateAdvertiser(
      adminFor(w),
      w.advertiserId,
      inputOf(d, { attributionFloodlightGroupId: 'someone-elses-group' }),
    );
    expect(!foreign.ok && foreign.issues[0]?.path).toBe('attributionFloodlightGroupId');
  });

  it('stores vendors and affirmed rate cards (AC-03-7)', async () => {
    const d = await details(adminFor(w));
    const bad = await updateAdvertiser(
      adminFor(w),
      w.advertiserId,
      inputOf(d, { rateCards: [{ vendorKey: 'test-bidder', selected: true, affirmed: false }] }),
    );
    expect(!bad.ok && bad.issues.map((i) => i.code)).toEqual(['ADV-018']);
    const ok = await updateAdvertiser(
      adminFor(w),
      w.advertiserId,
      inputOf(d, {
        vendors: ['test-viewability'],
        rateCards: [{ vendorKey: 'test-bidder', selected: true, affirmed: true }],
        iasClientId: 42,
      }),
    );
    expect(ok.ok).toBe(true);
    const after = await details(adminFor(w));
    expect(after.selectedVendors).toEqual(['test-viewability']);
    expect(after.rateCards).toEqual([{ vendorKey: 'test-bidder', selected: true, affirmed: true }]);
    expect(after.iasClientId).toBe(42);
    const card = await prisma.thirdPartyRateCard.findFirstOrThrow({
      where: { advertiserId: w.advertiserId },
    });
    expect(Number(card.rateMediaFeePct)).toBe(5);
    const bad2 = await updateAdvertiser(
      adminFor(w),
      w.advertiserId,
      inputOf(after, { iasClientId: '1.5' }),
    );
    expect(!bad2.ok && bad2.issues[0]).toMatchObject({
      code: 'ADV-017',
      message: 'Enter a whole number.',
    });
  });

  it('turning the Demand Gen switch off warns with the count and saves (AC-03-9)', async () => {
    await prisma.advertiser.update({
      where: { id: w.advertiserId },
      data: { demandGenFloodlightOptimization: true },
    });
    for (const n of ['DG 1', 'DG 2'])
      await prisma.lineItem.create({
        data: {
          sandboxId: w.sandboxId,
          ioId: w.ioId,
          campaignId: w.campaignId,
          advertiserId: w.advertiserId,
          name: n,
          type: 'DEMAND_GEN',
        },
      });
    const d = await details();
    const res = await updateAdvertiser(
      userFor(w),
      w.advertiserId,
      inputOf(d, { demandGenFloodlightOptimization: false }),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.warnings?.[0]).toMatchObject({
      code: 'ADV-012',
      message: '2 Demand Gen line items will stop delivering until this is turned back on.',
    });
    expect((await details()).demandGenLineItems).toBe(2);
  });

  it('EU political ads: one Bulk status row and one History group per line item (AC-03-8)', async () => {
    await prisma.advertiser.update({
      where: { id: w.advertiserId },
      data: { euPoliticalAds: null },
    });
    const d = await details();
    expect(d.euPoliticalAds).toBeNull();
    const total = await prisma.lineItem.count({ where: { advertiserId: w.advertiserId } });
    const res = await updateAdvertiser(
      userFor(w),
      w.advertiserId,
      inputOf(d, { euPoliticalAds: 'YES' }),
    );
    expect(res).toMatchObject({ ok: true, data: { affectedLineItems: total } });
    const job = await prisma.bulkJob.findFirstOrThrow({
      where: { advertiserId: w.advertiserId },
      orderBy: { requestedAt: 'desc' },
    });
    expect(job).toMatchObject({
      source: 'BULK_EDIT',
      description: `EU political ads set to Yes on ${total} line items`,
      status: 'COMPLETED',
    });
    const lis = await prisma.lineItem.findMany({ where: { advertiserId: w.advertiserId } });
    expect(lis.every((l) => l.euPoliticalAds === 'CONTAINS_EU_POLITICAL_ADS')).toBe(true);
    const groups = await prisma.changeGroup.findMany({
      where: { bulkJobId: job.id, entityType: 'LINE_ITEM' },
    });
    expect(groups).toHaveLength(total);
    expect(groups.every((g) => g.source === 'BULK_EDIT')).toBe(true);
    // the same answer again changes nothing and starts no second job
    const again = await updateAdvertiser(
      userFor(w),
      w.advertiserId,
      inputOf(await details(), { euPoliticalAds: 'YES' }),
    );
    expect(again.ok && again.data.affectedLineItems).toBeUndefined();
  });
});

describe('schedule and cancel deletion', () => {
  it('a STANDARD student cannot schedule (AC-03-12); an Admin can and the list hides the advertiser (AC-03-11)', async () => {
    expect(await scheduleAdvertiserDeletion(userFor(w), w.advertiserId)).toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });
    const res = await scheduleAdvertiserDeletion(adminFor(w), w.advertiserId);
    expect(res.ok).toBe(true);
    const d = await details();
    expect(d.status).toBe('SCHEDULED_FOR_DELETION');
    expect(d.scheduledDeletionAt).toBeTruthy();
    const list = await listAdvertisers(userFor(w), w.partnerId);
    expect(list.ok && list.data.rows.some((r) => r.id === w.advertiserId)).toBe(false);
    // read only until the deletion is cancelled
    expect(await updateAdvertiser(userFor(w), w.advertiserId, inputOf(d))).toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });
  });

  it('cancelling restores the previous status', async () => {
    const res = await cancelAdvertiserDeletion(adminFor(w), w.advertiserId);
    expect(res).toMatchObject({ ok: true, data: { status: 'ACTIVE' } });
    expect(await details()).toMatchObject({ status: 'ACTIVE', scheduledDeletionAt: null });
    expect(await cancelAdvertiserDeletion(adminFor(w), w.advertiserId)).toMatchObject({
      ok: false,
      code: 'INVALID',
    });
  });

  it('a paused advertiser comes back paused', async () => {
    await prisma.advertiser.update({ where: { id: w.advertiserId }, data: { status: 'PAUSED' } });
    await scheduleAdvertiserDeletion(adminFor(w), w.advertiserId);
    expect(await cancelAdvertiserDeletion(adminFor(w), w.advertiserId)).toMatchObject({
      ok: true,
      data: { status: 'PAUSED' },
    });
    await prisma.advertiser.update({ where: { id: w.advertiserId }, data: { status: 'ACTIVE' } });
  });
});

describe('alert preferences', () => {
  it('returns the demo defaults when no rows exist (AC-03-16)', async () => {
    const res = await getAlertPreferences(userFor(w), w.advertiserId);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(Object.keys(res.data.prefs)).toHaveLength(10);
    expect(res.data.prefs.UNDERPACING).toEqual({
      enabled: true,
      thresholdPct: 90,
      thresholdAmount: null,
    });
    expect(res.data.prefs.EXCEEDED_SPEND_THRESHOLD.enabled).toBe(false);
  });

  it('validates the ranges and the Underpacing dependency', async () => {
    const res0 = await getAlertPreferences(userFor(w), w.advertiserId);
    if (!res0.ok) throw new Error('prefs');
    const base = res0.data.prefs;
    const bad = await saveAlertPreferences(userFor(w), w.advertiserId, {
      ...base,
      UNDERPACING: { enabled: true, thresholdPct: 101 },
    });
    expect(!bad.ok && bad.issues[0]).toMatchObject({
      code: 'ADV-015',
      message: 'Enter a number between 1 and 100.',
    });
    const dep = await saveAlertPreferences(userFor(w), w.advertiserId, {
      ...base,
      UNDERPACING: { enabled: false, thresholdPct: 90 },
    });
    expect(!dep.ok && dep.issues.map((i) => i.code)).toEqual(['ADV-019', 'ADV-019']);
  });

  it('saves, logs the change, and resolves open alerts of a disabled type (Q5, AC-03-17)', async () => {
    await prisma.alert.create({
      data: {
        sandboxId: w.sandboxId,
        advertiserId: w.advertiserId,
        type: 'REJECTED_CREATIVE',
        severity: 'NEEDS_ATTENTION',
        category: 'CREATIVES',
        title: 'Rejected creative',
      },
    });
    const res0 = await getAlertPreferences(userFor(w), w.advertiserId);
    if (!res0.ok) throw new Error('prefs');
    const before = (await groupsOf(w.advertiserId)).length;
    const res = await saveAlertPreferences(userFor(w), w.advertiserId, {
      ...res0.data.prefs,
      UNDERPACING: { enabled: true, thresholdPct: 80 },
      REJECTED_CREATIVE: { enabled: false, thresholdPct: null, thresholdAmount: null },
    });
    expect(res).toMatchObject({ ok: true, data: { resolvedAlerts: 1 } });
    const alert = await prisma.alert.findFirstOrThrow({
      where: { advertiserId: w.advertiserId, type: 'REJECTED_CREATIVE' },
    });
    expect(alert).toMatchObject({ state: 'RESOLVED', diagnosticCode: 'PREF_DISABLED' });
    expect((await groupsOf(w.advertiserId)).length).toBe(before + 1);
    const after = await getAlertPreferences(userFor(w), w.advertiserId);
    expect(after.ok && after.data.prefs.UNDERPACING.thresholdPct).toBe(80);
    expect(after.ok && after.data.prefs.REJECTED_CREATIVE.enabled).toBe(false);
    expect(
      await saveAlertPreferences(userFor(w, 'READ_ONLY'), w.advertiserId, res0.data.prefs),
    ).toMatchObject({ ok: false, code: 'FORBIDDEN' });
  });
});

describe('data manager', () => {
  it('links a YouTube channel, counts it, refuses a duplicate id (AC-03-15)', async () => {
    const res = await linkAccount(adminFor(w), w.advertiserId, {
      type: 'YOUTUBE_CHANNEL',
      displayName: 'My channel',
      externalId: 'UC-1',
    });
    expect(res.ok).toBe(true);
    const dm = await getDataManager(adminFor(w), w.advertiserId);
    expect(dm.ok && dm.data.counts).toMatchObject({ YOUTUBE_CHANNEL: 1 });
    const dup = await linkAccount(adminFor(w), w.advertiserId, {
      type: 'YOUTUBE_CHANNEL',
      displayName: 'Again',
      externalId: 'UC-1',
    });
    expect(!dup.ok && dup.issues[0]).toMatchObject({
      code: 'ADV-026',
      message: 'This account is already linked.',
    });
    const noName = await linkAccount(adminFor(w), w.advertiserId, {
      type: 'GOOGLE_ADS',
      displayName: ' ',
    });
    expect(!noName.ok && noName.issues[0]).toMatchObject({
      code: 'ADV-025',
      message: 'Enter a value',
    });
    expect(
      await linkAccount(userFor(w), w.advertiserId, { type: 'GOOGLE_ADS', displayName: 'x' }),
    ).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(
      (await groupsOf(w.advertiserId)).some(
        (g) => g.summary === 'Linked account added: My channel',
      ),
    ).toBe(true);
  });

  it('removes a link and keeps the creator-video request pending', async () => {
    const dm = await getDataManager(adminFor(w), w.advertiserId);
    if (!dm.ok) throw new Error('dm');
    const row = dm.data.accounts.find((a) => a.externalId === 'UC-1');
    expect(row).toBeTruthy();
    expect((await removeLinkedAccount(adminFor(w), w.advertiserId, row!.id)).ok).toBe(true);
    const req = await requestCreatorVideoAccess(adminFor(w), w.advertiserId);
    expect(req.ok).toBe(true);
    const again = await requestCreatorVideoAccess(adminFor(w), w.advertiserId);
    expect(again.ok && req.ok && again.data.id).toBe(req.ok && req.data.id);
    const after = await getDataManager(adminFor(w), w.advertiserId);
    expect(after.ok && after.data.accounts.map((a) => [a.type, a.status])).toEqual([
      ['YOUTUBE_CREATOR_VIDEOS', 'PENDING'],
    ]);
    expect(after.ok && after.data.counts.YOUTUBE_CHANNEL).toBeUndefined();
  });
});

describe('policy center', () => {
  it('lists the 14 kinds in order with "No certificates." state (AC-03-19)', async () => {
    const res = await getPolicyCenter(userFor(w), w.advertiserId);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.certificates).toHaveLength(14);
    expect(res.data.certificates[0]).toMatchObject({ kind: 'ADDICTION_SERVICES', status: 'NONE' });
    expect(res.data.certificates.every((c) => c.status === 'NONE')).toBe(true);
  });

  it('gambling needs a country, then becomes Requested; a second request shows ADV-028', async () => {
    const noCountry = await requestPolicyCertificate(userFor(w), w.advertiserId, {
      kind: 'GAMBLING',
    });
    expect(!noCountry.ok && noCountry.issues[0]).toMatchObject({
      code: 'ADV-027',
      message: 'A selection is required',
    });
    const ok = await requestPolicyCertificate(userFor(w), w.advertiserId, {
      kind: 'GAMBLING',
      countryCode: 'IN',
      notes: 'please',
    });
    expect(ok.ok).toBe(true);
    const again = await requestPolicyCertificate(userFor(w), w.advertiserId, {
      kind: 'GAMBLING',
      countryCode: 'IN',
    });
    expect(!again.ok && again.issues[0]).toMatchObject({
      code: 'ADV-028',
      message: 'A request for this certificate is already pending.',
    });
    const center = await getPolicyCenter(userFor(w), w.advertiserId);
    expect(center.ok && center.data.certificates.find((c) => c.kind === 'GAMBLING')).toMatchObject({
      status: 'REQUESTED',
      countryCode: 'IN',
      notes: 'please',
    });
    expect(
      await requestPolicyCertificate(userFor(w, 'READ_ONLY'), w.advertiserId, {
        kind: 'ONLINE_PHARMACY',
      }),
    ).toMatchObject({ ok: false, code: 'FORBIDDEN' });
  });

  it('a student cannot decide, an instructor can (AC-03-20)', async () => {
    const cert = await prisma.policyCertificate.findFirstOrThrow({
      where: { advertiserId: w.advertiserId, kind: 'GAMBLING' },
    });
    expect(await decidePolicyCertificate(userFor(w), cert.id, 'APPROVED')).toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });
    const instructor = { ...userFor(w), appRole: 'super_admin' as const };
    expect((await decidePolicyCertificate(instructor, cert.id, 'APPROVED')).ok).toBe(true);
    const center = await getPolicyCenter(userFor(w), w.advertiserId);
    expect(center.ok && center.data.certificates.find((c) => c.kind === 'GAMBLING')?.status).toBe(
      'APPROVED',
    );
    // a rejected request can be asked for again
    await decidePolicyCertificate(instructor, cert.id, 'REJECTED', 'Documents missing');
    const rejected = await getPolicyCenter(userFor(w), w.advertiserId);
    expect(
      rejected.ok && rejected.data.certificates.find((c) => c.kind === 'GAMBLING'),
    ).toMatchObject({ status: 'REJECTED', rejectionReason: 'Documents missing' });
    expect(
      (
        await requestPolicyCertificate(userFor(w), w.advertiserId, {
          kind: 'GAMBLING',
          countryCode: 'IN',
        })
      ).ok,
    ).toBe(true);
  });
});
