// Partner basic details, exchanges and advertiser configurations (module 02 4.4 to 4.7; AC-02-7 to AC-02-17).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import {
  getAdvertiserConfigurations,
  saveAdvertiserConfigurations,
} from '@/lib/settings/configurations';
import {
  acceptAppMediationFees,
  getExchangesPanel,
  getPartnerDetails,
  saveExchanges,
  updatePartner,
  type UpdatePartnerInput,
} from '@/lib/settings/partner';
import { dropWorld } from '../db/helpers';
import {
  addAdvertiser,
  addExchange,
  adminFor,
  groupsOf,
  settingsWorld,
  userFor,
  type World,
} from './helpers';

let w: World;
let gam: string;
let yl: string;
beforeAll(async () => {
  w = await settingsWorld('setpartner');
  gam = await addExchange('set-gam', { needsNetworkId: true });
  yl = await addExchange('set-yieldlab', { needsSeatId: true });
});
afterAll(async () => {
  await dropWorld(w);
  await prisma.$disconnect();
});

async function details() {
  const res = await getPartnerDetails(adminFor(w), w.partnerId);
  if (!res.ok) throw new Error('details');
  return res.data;
}

function inputOf(
  d: Awaited<ReturnType<typeof details>>,
  over: Partial<UpdatePartnerInput> = {},
): UpdatePartnerInput {
  return {
    name: d.name,
    status: d.status,
    currencyCode: d.currencyCode,
    timeZone: d.timeZone,
    nielsenCountry: d.nielsenCountry,
    includeDataInCmTransfer: d.includeDataInCmTransfer,
    reportCostToCm: d.reportCostToCm,
    autoEnableNewExchanges: d.autoEnableNewExchanges,
    sdfVersion: d.sdfVersion,
    sdfAdminEmail: d.sdfAdminEmail,
    dataProtection: {
      accepted: d.dataTermsAccepted,
      contacts: d.contacts,
      contactPerson: d.contactPerson,
    },
    ...over,
  };
}

describe('partner details', () => {
  it('reads the details with write rights for an Admin and the Limited Access chip for read only', async () => {
    const d = await details();
    expect(d).toMatchObject({
      currencyCode: 'INR',
      canWrite: true,
      limitedAccess: false,
      sdfVersion: '11',
      enabledExchangeCount: 1,
    });
    const ro = await getPartnerDetails(userFor(w, 'READ_ONLY'), w.partnerId);
    expect(ro.ok && ro.data).toMatchObject({ canWrite: false, limitedAccess: true });
  });

  it('a STANDARD student cannot update the partner (RC-047) and nothing changes', async () => {
    const d = await details();
    const res = await updatePartner(userFor(w), w.partnerId, inputOf(d, { name: 'Forged' }));
    expect(res).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect((await details()).name).toBe(d.name);
    expect(await groupsOf(w.partnerId)).toHaveLength(0);
  });

  it('saves a rename and logs "Partner name" old to new with the note (AC-02-9, AC-02-27)', async () => {
    const d = await details();
    const res = await updatePartner(
      adminFor(w),
      w.partnerId,
      inputOf(d, { name: 'Renamed partner' }),
      { expectedVersion: d.version, note: 'Because' },
    );
    expect(res.ok).toBe(true);
    const groups = await groupsOf(w.partnerId);
    const g = groups[groups.length - 1];
    expect(g).toMatchObject({
      entityType: 'PARTNER',
      source: 'UI',
      note: 'Because',
      summary: '1 change to partner',
    });
    expect(g?.entries[0]).toMatchObject({
      label: 'Partner name',
      oldValue: d.name,
      newValue: 'Renamed partner',
    });
  });

  it('fans the change out to the advertiser history (PARTNER_SETTING_UPDATER)', async () => {
    const fan = await prisma.changeGroup.findMany({
      where: { advertiserId: w.advertiserId, source: 'PARTNER_FANOUT' },
    });
    expect(fan.length).toBeGreaterThan(0);
    expect(fan[0]?.systemActor).toBe('PARTNER_SETTING_UPDATER');
  });

  it('a stale version returns CONFLICT (AC-02-28)', async () => {
    const d = await details();
    const res = await updatePartner(adminFor(w), w.partnerId, inputOf(d, { name: 'Late' }), {
      expectedVersion: d.version - 1,
    });
    expect(res).toMatchObject({ ok: false, code: 'CONFLICT' });
  });

  it('rejects SDF 12, a bad admin email and a changed currency; unchecking accepted terms (AC-02-10, AC-02-7)', async () => {
    let d = await details();
    expect(
      await updatePartner(adminFor(w), w.partnerId, inputOf(d, { sdfVersion: '12' })),
    ).toMatchObject({ ok: false, code: 'INVALID' });
    const bad = await updatePartner(
      adminFor(w),
      w.partnerId,
      inputOf(d, { sdfAdminEmail: 'nope', currencyCode: 'USD' }),
    );
    expect(!bad.ok && bad.issues.map((i) => i.code).sort()).toEqual(['PRT-003', 'PRT-005']);
    // accept the terms, then try to take it back
    const ok = await updatePartner(
      adminFor(w),
      w.partnerId,
      inputOf(d, {
        dataProtection: { accepted: true, contacts: d.contacts, contactPerson: d.contactPerson },
      }),
    );
    expect(ok.ok).toBe(true);
    d = await details();
    expect(d.dataTermsAccepted).toBe(true);
    const undo = await updatePartner(
      adminFor(w),
      w.partnerId,
      inputOf(d, {
        dataProtection: { accepted: false, contacts: d.contacts, contactPerson: d.contactPerson },
      }),
    );
    expect(!undo.ok && undo.issues.map((i) => i.code)).toEqual(['PRT-006']);
  });

  it('stores the contacts and the contact person', async () => {
    const d = await details();
    const contacts = {
      ...d.contacts,
      DATA_PROTECTION_OFFICER: { name: 'Dana', email: 'dana@example.test', address: '', phone: '' },
    };
    const res = await updatePartner(
      adminFor(w),
      w.partnerId,
      inputOf(d, {
        dataProtection: { accepted: true, contacts, contactPerson: 'DATA_PROTECTION_OFFICER' },
      }),
    );
    expect(res.ok).toBe(true);
    const after = await details();
    expect(after.contactPerson).toBe('DATA_PROTECTION_OFFICER');
    expect(after.contacts.DATA_PROTECTION_OFFICER.email).toBe('dana@example.test');
  });
});

describe('exchanges', () => {
  it('lists every exchange with the enabled state and the extra id flags', async () => {
    const res = await getExchangesPanel(adminFor(w), w.partnerId);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.find((e) => e.id === gam)).toMatchObject({
      enabled: false,
      needsNetworkId: true,
    });
    expect(res.data.find((e) => e.id === w.exchangeId)?.enabled).toBe(true);
  });

  it('PRT-008: an enabled exchange with extra ids needs them (AC-02-11)', async () => {
    const res = await saveExchanges(adminFor(w), w.partnerId, {
      enabled: [{ exchangeId: w.exchangeId }, { exchangeId: gam }, { exchangeId: yl }],
      autoEnableNew: false,
    });
    expect(!res.ok && res.issues.map((i) => [i.code, i.path, i.message])).toEqual([
      ['PRT-008', 'enabled[1].networkId', 'Enter a value'],
      ['PRT-008', 'enabled[1].agencyId', 'Enter a value'],
      ['PRT-008', 'enabled[2].seatId', 'Enter a value'],
    ]);
  });

  it('writes one entry per added exchange: "1 ad exchange added" (AC-02-13)', async () => {
    const before = (await groupsOf(w.partnerId)).length;
    const res = await saveExchanges(adminFor(w), w.partnerId, {
      enabled: [
        { exchangeId: w.exchangeId },
        { exchangeId: gam, networkId: '123', agencyId: '456' },
      ],
      autoEnableNew: false,
    });
    expect(res).toMatchObject({ ok: true, data: { enabledCount: 2 } });
    const groups = await groupsOf(w.partnerId);
    expect(groups.length).toBe(before + 1);
    const g = groups[groups.length - 1];
    expect(g?.summary).toBe('1 ad exchange added');
    expect(g?.entries.filter((e) => e.kind === 'CREATE')).toHaveLength(1);
  });

  it('disabling an exchange that line items use warns with the count and still saves (AC-02-12)', async () => {
    const res = await saveExchanges(adminFor(w), w.partnerId, {
      enabled: [{ exchangeId: gam, networkId: '123', agencyId: '456' }],
      autoEnableNew: false,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.enabledCount).toBe(1);
    expect(res.data.affectedLineItems).toBeGreaterThanOrEqual(1);
    expect(res.warnings?.[0]).toMatchObject({ code: 'PRT-010' });
    expect(res.warnings?.[0]?.message).toMatch(
      /^\d+ line items target this exchange\. They will stop buying on it\.$/,
    );
    const g = (await groupsOf(w.partnerId)).at(-1);
    expect(g?.summary).toBe('1 ad exchange removed');
    const row = await prisma.partnerExchange.findFirst({
      where: { partnerId: w.partnerId, exchangeId: w.exchangeId },
    });
    expect(row?.enabled).toBe(false);
  });

  it('a STANDARD student cannot change exchanges (PRT-007)', async () => {
    const res = await saveExchanges(userFor(w), w.partnerId, { enabled: [], autoEnableNew: false });
    expect(res).toMatchObject({ ok: false, code: 'FORBIDDEN' });
  });

  it('the page save carries the slide-over draft (draft-bound rule)', async () => {
    const d = await details();
    const res = await updatePartner(
      adminFor(w),
      w.partnerId,
      inputOf(d, {
        exchanges: [{ exchangeId: w.exchangeId }, { exchangeId: yl, seatId: 'seat-1' }],
      }),
    );
    expect(res).toMatchObject({ ok: true, data: { enabledExchangeCount: 2 } });
  });

  it('accepting the app mediation fees is stored once (DELTA-02-7)', async () => {
    expect((await details()).appMediationFeesAccepted).toBe(false);
    expect((await acceptAppMediationFees(adminFor(w), w.partnerId)).ok).toBe(true);
    expect((await details()).appMediationFeesAccepted).toBe(true);
  });
});

describe('advertiser configurations', () => {
  it('returns the module defaults when no rows exist', async () => {
    const res = await getAdvertiserConfigurations(adminFor(w), w.partnerId);
    expect(res.ok && res.data.flags).toMatchObject({
      ENHANCED_AUTOMATION: { enabled: true, scope: 'ALL_ADVERTISERS' },
      YOUTUBE_GUARANTEED_INSTANT_DEALS: { enabled: false },
      GOOGLE_PARTNER_INVENTORY: { enabled: true },
    });
  });

  it('PRT-009: product improvement cannot change while Enhanced automation is on (AC-02-16)', async () => {
    const res = await saveAdvertiserConfigurations(adminFor(w), w.partnerId, {
      flags: {
        PRODUCT_IMPROVEMENT: { enabled: false, scope: 'ALL_ADVERTISERS', advertiserIds: [] },
      },
    });
    expect(!res.ok && res.issues.map((i) => i.code)).toEqual(['PRT-009']);
    const off = await saveAdvertiserConfigurations(adminFor(w), w.partnerId, {
      flags: {
        ENHANCED_AUTOMATION: { enabled: false, scope: 'ALL_ADVERTISERS', advertiserIds: [] },
        PRODUCT_IMPROVEMENT: { enabled: false, scope: 'ALL_ADVERTISERS', advertiserIds: [] },
      },
    });
    expect(off.ok).toBe(true);
  });

  it('PRT-013 instant deals need accepted terms and PRT-014 a selected advertiser', async () => {
    const a = await saveAdvertiserConfigurations(adminFor(w), w.partnerId, {
      flags: {
        YOUTUBE_GUARANTEED_INSTANT_DEALS: {
          enabled: true,
          scope: 'ALL_ADVERTISERS',
          advertiserIds: [],
        },
      },
    });
    expect(!a.ok && a.issues.map((i) => i.code)).toEqual(['PRT-013']);
    const b = await saveAdvertiserConfigurations(adminFor(w), w.partnerId, {
      flags: { AUTO_TAGGING: { enabled: true, scope: 'SELECTED', advertiserIds: [] } },
    });
    expect(!b.ok && b.issues.map((i) => [i.code, i.message])).toEqual([
      ['PRT-014', 'A selection is required'],
    ]);
  });

  it('a selected scope writes the advertiser rows and Google & partner inventory gates the advertisers (AC-02-17)', async () => {
    const other = await addAdvertiser(w, 'Second advertiser');
    await prisma.lineItem.create({
      data: {
        sandboxId: w.sandboxId,
        ioId: w.ioId,
        campaignId: w.campaignId,
        advertiserId: w.advertiserId,
        name: 'YT LI',
        type: 'YT_VIDEO',
        status: 'ACTIVE',
      },
    });
    const res = await saveAdvertiserConfigurations(adminFor(w), w.partnerId, {
      flags: {
        GOOGLE_PARTNER_INVENTORY: { enabled: true, scope: 'SELECTED', advertiserIds: [other.id] },
      },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.warnings?.[0]).toMatchObject({
      code: 'PRT-015',
      message:
        '1 YouTube & partners or Demand Gen line items will stop delivering for these advertisers.',
    });
    const rows = await prisma.advertiser.findMany({
      where: { id: { in: [w.advertiserId, other.id] } },
      select: { id: true, googleInventoryEnabled: true },
    });
    expect(Object.fromEntries(rows.map((r) => [r.id, r.googleInventoryEnabled]))).toEqual({
      [w.advertiserId]: false,
      [other.id]: true,
    });
    const flag = await prisma.partnerFeatureFlag.findFirstOrThrow({
      where: { partnerId: w.partnerId, key: 'GOOGLE_PARTNER_INVENTORY' },
      include: { advertisers: true },
    });
    expect(flag.scope).toBe('SELECTED');
    expect(flag.advertisers.map((a) => a.advertiserId)).toEqual([other.id]);
  });
});
