// Resource services against a real database (module 15 6.1 items 4 to 11 and 18, build-plan "tests to write").
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { seedReferenceData } from '@/lib/seed/reference-db';
import { getBrandControls } from '@/lib/resources/brand-service';
import {
  archiveFloodlightConversion,
  createFloodlightConversion,
  getFloodlightGroup,
  listFloodlightConversions,
  updateFloodlightConversion,
  updateFloodlightGroup,
} from '@/lib/resources/floodlight';
import {
  createChannel,
  createLocationList,
  createNegativeKeywordList,
  deleteChannel,
  deleteNegativeKeywordList,
  getChannel,
  getNegativeKeywordList,
  listChannels,
  listNegativeKeywordLists,
  updateChannel,
  updateLocationList,
  type ResourceScope,
} from '@/lib/resources/lists';
import { newConversionValue, type FloodlightGroupInput } from '@/lib/resources/wire';
import { createWorld, dropWorld, type World } from '../db/helpers';
import { userOf } from '../services/campaigns/fixtures';

let w: World;
let scope: ResourceScope;
let aid: string;

beforeAll(async () => {
  await seedReferenceData(prisma);
  w = await createWorld('res');
  const adv = await prisma.advertiser.findUniqueOrThrow({ where: { id: w.advertiserId } });
  aid = adv.publicId.toString();
  scope = { level: 'advertiser', id: aid };
  await prisma.appCatalog.upsert({
    where: { platform_appId: { platform: 'ANDROID', appId: 'com.example.lumen.pay' } },
    create: { platform: 'ANDROID', appId: 'com.example.lumen.pay', name: 'Lumen Pay' },
    update: {},
  });
}, 120_000);
afterAll(async () => {
  await dropWorld(w);
  await prisma.$disconnect();
});

const groupsOf = (entityId: string) =>
  prisma.changeGroup.findMany({
    where: { sandboxId: w.sandboxId, entityId },
    include: { entries: true },
    orderBy: { occurredAt: 'asc' },
  });

function use(
  refType: 'CHANNEL' | 'KEYWORD_LIST',
  refId: string,
  mode: 'INCLUDE' | 'EXCLUDE' = 'EXCLUDE',
) {
  return prisma.targetingAssignment.create({
    data: {
      sandboxId: w.sandboxId,
      ownerType: 'LINE_ITEM',
      lineItemId: w.lineItemId,
      dimension: refType === 'CHANNEL' ? 'APPS_AND_URLS' : 'NEGATIVE_KEYWORD_LIST',
      mode,
      refType,
      refId,
    },
  });
}

describe('channels', () => {
  it('creates a channel, resolves app names, removes duplicates and logs the create', async () => {
    const r = await createChannel(userOf(w), scope, {
      name: 'Trusted',
      sites: 'news.example.com\nhttps://News.example.com/\ncom.example.lumen.pay\n',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.stats).toEqual({ urls: 1, apps: 1, duplicates: 1, invalid: 0 });
    const view = await getChannel(userOf(w), r.data.id);
    expect(view.siteCount).toBe(2);
    expect(view.sites).toContain('Lumen Pay - Android (com.example.lumen.pay)');
    const row = await prisma.channel.findFirstOrThrow({ where: { publicId: BigInt(r.data.id) } });
    const groups = await groupsOf(row.id);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ entityType: 'CHANNEL', entityName: 'Trusted' });
  });

  it('CH-001 and CH-003: an empty name and an invalid line are rejected with the line', async () => {
    const r = await createChannel(userOf(w), scope, {
      name: '',
      sites: 'ok.example.com\nnot a url',
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe('INVALID');
    expect(r.issues.map((i) => i.code).sort()).toEqual(['CH-001', 'CH-003']);
    expect(r.issues.find((i) => i.code === 'CH-003')?.path).toBe('sites[1]');
  });

  it('CH-004: 10,001 entries fail and 10,000 are accepted', async () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => `s${i}.example.com`).join('\n');
    const bad = await createChannel(userOf(w), scope, { name: 'Too many', sites: many(10_001) });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.issues.map((i) => i.code)).toContain('CH-004');
    const ok = await createChannel(userOf(w), scope, {
      name: 'Exactly 10000',
      sites: many(10_000),
    });
    expect(ok.ok).toBe(true);
  }, 120_000);

  it('updates entries, bumps the version and refuses a stale save', async () => {
    const created = await createChannel(userOf(w), scope, {
      name: 'Edit me',
      sites: 'a.example.com',
    });
    if (!created.ok) throw new Error('create failed');
    const first = await updateChannel(
      userOf(w),
      created.data.id,
      { sites: 'a.example.com\nb.example.com' },
      { expectedVersion: 1 },
    );
    expect(first.ok).toBe(true);
    const stale = await updateChannel(
      userOf(w),
      created.data.id,
      { name: 'Late' },
      { expectedVersion: 1 },
    );
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.code).toBe('CONFLICT');
    const row = await prisma.channel.findFirstOrThrow({
      where: { publicId: BigInt(created.data.id) },
    });
    const groups = await groupsOf(row.id);
    expect(groups.at(-1)?.entries.map((e) => [e.label, e.oldValue, e.newValue])).toContainEqual([
      'Number of sites',
      '1',
      '2',
    ]);
  });

  it('lists included and excluded counts from the targeting rows (AC 5)', async () => {
    const created = await createChannel(userOf(w), scope, {
      name: 'Counted',
      sites: 'c.example.com',
    });
    if (!created.ok) throw new Error('create failed');
    const row = await prisma.channel.findFirstOrThrow({
      where: { publicId: BigInt(created.data.id) },
    });
    const before = (await listChannels(userOf(w), scope)).find((c) => c.name === 'Counted')!;
    expect(before).toMatchObject({ includedByLis: 0, excludedByLis: 0, urls: 1, apps: 0 });
    await use('CHANNEL', row.id, 'EXCLUDE');
    const after = (await listChannels(userOf(w), scope)).find((c) => c.name === 'Counted')!;
    expect(after).toMatchObject({ includedByLis: 0, excludedByLis: 1 });
  });

  it('delete warns with the line item count, then removes the targeting rows and leaves History on the line item (AC 8)', async () => {
    const created = await createChannel(userOf(w), scope, {
      name: 'To delete',
      sites: 'd.example.com',
    });
    if (!created.ok) throw new Error('create failed');
    const row = await prisma.channel.findFirstOrThrow({
      where: { publicId: BigInt(created.data.id) },
    });
    await use('CHANNEL', row.id);
    const warned = await deleteChannel(userOf(w), created.data.id);
    expect(warned.ok && warned.data).toEqual({ deleted: false, usedBy: 1 });
    expect(warned.ok && warned.warnings?.[0]?.message).toBe('1 line items use this channel.');
    expect(await prisma.channel.count({ where: { id: row.id } })).toBe(1);
    const done = await deleteChannel(userOf(w), created.data.id, true);
    expect(done.ok && done.data).toEqual({ deleted: true, usedBy: 1 });
    expect(await prisma.channel.count({ where: { id: row.id } })).toBe(0);
    expect(
      await prisma.targetingAssignment.count({ where: { refType: 'CHANNEL', refId: row.id } }),
    ).toBe(0);
    const history = await prisma.changeGroup.findMany({
      where: { sandboxId: w.sandboxId, entityType: 'LINE_ITEM', entityId: w.lineItemId },
    });
    expect(history.some((g) => g.summary === 'Removed channel "To delete" from targeting')).toBe(
      true,
    );
  });

  it('a read-only person cannot write and REPORTING_ONLY gets not found', async () => {
    const ro = await createChannel(userOf(w, 'READ_ONLY'), scope, {
      name: 'No',
      sites: 'x.example.com',
    });
    expect(ro.ok).toBe(false);
    if (!ro.ok) expect(ro.code).toBe('FORBIDDEN');
    await expect(listChannels(userOf(w, 'REPORTING_ONLY'), scope)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(listChannels(userOf(w, 'READ_ONLY'), scope)).resolves.toBeInstanceOf(Array);
  });
});

describe('negative keyword lists', () => {
  it('splits on comma and newline, lower-cases and de-duplicates (AC 6)', async () => {
    const r = await createNegativeKeywordList(userOf(w), aid, {
      name: 'Safety',
      keywords: 'Free Download,CRACK\ncrack\n torrent ',
    });
    expect(r.ok && r.data.count).toBe(3);
    if (!r.ok) return;
    const view = await getNegativeKeywordList(userOf(w), r.data.id);
    expect(view.keywords.split('\n').sort()).toEqual(['crack', 'free download', 'torrent']);
  });

  it('KW-002: 5,001 keywords fail with the limit text and 5,000 pass', async () => {
    const make = (n: number) => Array.from({ length: n }, (_, i) => `kw${i}`).join(',');
    const bad = await createNegativeKeywordList(userOf(w), aid, {
      name: 'Big',
      keywords: make(5001),
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.issues[0]?.message).toBe('Your list can contain up to 5,000 keywords.');
    expect(
      (await createNegativeKeywordList(userOf(w), aid, { name: 'Big ok', keywords: make(5000) }))
        .ok,
    ).toBe(true);
  });

  it('the editor lists the line items that use it, and delete asks first', async () => {
    const r = await createNegativeKeywordList(userOf(w), aid, { name: 'Used', keywords: 'bad' });
    if (!r.ok) throw new Error('create failed');
    const row = await prisma.keywordList.findFirstOrThrow({
      where: { publicId: BigInt(r.data.id) },
    });
    await use('KEYWORD_LIST', row.id);
    expect((await getNegativeKeywordList(userOf(w), r.data.id)).lineItems).toHaveLength(1);
    expect(
      (await listNegativeKeywordLists(userOf(w), aid)).find((l) => l.name === 'Used')?.lineItems,
    ).toBe(1);
    const warned = await deleteNegativeKeywordList(userOf(w), r.data.id);
    expect(warned.ok && warned.warnings?.[0]?.code).toBe('KW-005');
    expect((await deleteNegativeKeywordList(userOf(w), r.data.id, true)).ok).toBe(true);
    expect(await prisma.keywordList.count({ where: { id: row.id } })).toBe(0);
  });
});

describe('location lists', () => {
  it('LOC-004 fails with the line number; a fixed list saves (AC 7)', async () => {
    const bad = await createLocationList(userOf(w), aid, {
      name: 'Metros',
      type: 'REGIONAL',
      entries: '560001\n!!\n400001\n??',
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      const lines = bad.issues.filter((i) => i.code === 'LOC-004').map((i) => i.message);
      expect(lines).toEqual([
        "Line 2 isn't a valid postal code or DMA region.",
        "Line 4 isn't a valid postal code or DMA region.",
      ]);
    }
    const ok = await createLocationList(userOf(w), aid, {
      name: 'Metros',
      type: 'REGIONAL',
      entries: '560001\n400001',
    });
    expect(ok.ok && ok.data.resolved).toBe(2);
  });

  it('proximity accepts lat,lng;radius and the type is locked on edit (LOC-002)', async () => {
    const r = await createLocationList(userOf(w), aid, {
      name: 'Stores',
      type: 'PROXIMITY',
      entries: '12.9716,77.5946;10\n12 Orchard Lane, Bengaluru',
    });
    if (!r.ok) throw new Error(JSON.stringify(r));
    const row = await prisma.locationList.findFirstOrThrow({
      where: { publicId: BigInt(r.data.id) },
      include: { entries: { orderBy: { id: 'asc' } } },
    });
    expect(row.entries.map((e) => Number(e.radiusKm))).toEqual([10, 5]);
    const flip = await updateLocationList(userOf(w), r.data.id, { type: 'REGIONAL' });
    expect(flip.ok).toBe(false);
    if (!flip.ok) expect(flip.issues.map((i) => i.code)).toContain('LOC-002');
    const renamed = await updateLocationList(userOf(w), r.data.id, { name: 'Stores v2' });
    expect(renamed.ok).toBe(true);
  });

  it('LOC-003: no entries fails', async () => {
    const r = await createLocationList(userOf(w), aid, {
      name: 'Empty',
      type: 'REGIONAL',
      entries: '',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((i) => i.code)).toContain('LOC-003');
  });
});

describe('Floodlight', () => {
  const web = (over: Partial<ReturnType<typeof newConversionValue>> = {}) => ({
    ...newConversionValue('WEB'),
    name: 'Purchase',
    type: 'COUNTER' as const,
    countingMethod: 'STANDARD' as const,
    ...over,
  });
  let conversionId = '';

  it('creates the group on first use and a Web Counter with Standard counting (AC 9)', async () => {
    expect(await getFloodlightGroup(userOf(w), aid)).toBeNull();
    const r = await createFloodlightConversion(userOf(w), aid, web());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    conversionId = r.data.id;
    const group = await getFloodlightGroup(userOf(w), aid);
    expect(group?.clickDays).toBe(30);
    expect(group?.models.some((m) => m.isPrimary)).toBe(true);
    const rows = await listFloodlightConversions(userOf(w), aid);
    expect(rows.map((x) => x.name)).toContain('Purchase');
    expect(rows[0]).toMatchObject({ status: 'ACTIVE', source: 'Google tag', type: 'COUNTER' });
  });

  it('FL-014: Counter + Transactions and Sale + Standard fail', async () => {
    for (const bad of [
      web({ name: 'a', countingMethod: 'TRANSACTIONS' }),
      web({ name: 'b', type: 'SALE', countingMethod: 'STANDARD' }),
    ]) {
      const r = await createFloodlightConversion(userOf(w), aid, bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.issues.map((i) => i.code)).toContain('FL-014');
    }
  });

  it('FL-030 and FL-031 for Mobile app and Connected TV (AC 10)', async () => {
    const app = await createFloodlightConversion(userOf(w), aid, {
      ...newConversionValue('MOBILE_APP'),
      name: 'Install',
      type: 'COUNTER',
      countingMethod: 'STANDARD',
    });
    expect(app.ok).toBe(false);
    if (!app.ok)
      expect(app.issues.map((i) => i.code)).toEqual(expect.arrayContaining(['FL-030', 'FL-031']));
    const ctv = await createFloodlightConversion(userOf(w), aid, {
      ...newConversionValue('CONNECTED_TV'),
      name: 'TV install',
      type: 'COUNTER',
      countingMethod: 'STANDARD',
      ctvAppId: 'ctv.example.harbor',
      conversionEventName: 'first_open',
    });
    expect(ctv.ok).toBe(true);
  });

  it('FL-032: platform, format and type are locked after creation', async () => {
    const r = await updateFloodlightConversion(
      userOf(w),
      conversionId,
      web({ type: 'SALE', countingMethod: 'TRANSACTIONS' }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((i) => i.code)).toContain('FL-032');
    const renamed = await updateFloodlightConversion(
      userOf(w),
      conversionId,
      web({ name: 'Purchase renamed' }),
    );
    expect(renamed.ok).toBe(true);
  });

  it('FL-033: archiving a conversion that a line item counts warns first', async () => {
    const row = await prisma.floodlightActivity.findFirstOrThrow({
      where: { publicId: BigInt(conversionId) },
    });
    await prisma.lineItemFloodlightActivity.create({
      data: { sandboxId: w.sandboxId, lineItemId: w.lineItemId, activityId: row.id },
    });
    const warned = await archiveFloodlightConversion(userOf(w), conversionId);
    expect(warned.ok && warned.data).toEqual({ archived: false, usedBy: 1 });
    expect(warned.ok && warned.warnings?.[0]?.message).toBe('1 line items count this conversion.');
    const done = await archiveFloodlightConversion(userOf(w), conversionId, true);
    expect(done.ok && done.data.archived).toBe(true);
    expect((await listFloodlightConversions(userOf(w), aid)).map((x) => x.name)).not.toContain(
      'Purchase renamed',
    );
    expect((await listFloodlightConversions(userOf(w), aid, { status: ['ARCHIVED'] })).length).toBe(
      1,
    );
  });

  it('Basic details: windows 1 to 90, viewable % and slots are validated; a save writes History (AC 11)', async () => {
    const cases: [FloodlightGroupInput, string][] = [
      [{ clickDays: 91 }, 'FL-020'],
      [{ impressionDays: 0 }, 'FL-020'],
      [{ viewableImpressionPct: 101 }, 'FL-021'],
      [{ customVariables: [{ key: 'u101', name: 'x', dataType: 'STRING' }] }, 'FL-022'],
    ];
    for (const [input, code] of cases) {
      const r = await updateFloodlightGroup(userOf(w), aid, input);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.issues.map((i) => i.code)).toContain(code);
    }
    const ok = await updateFloodlightGroup(userOf(w), aid, { clickDays: 45, impressionDays: 2 });
    expect(ok.ok).toBe(true);
    const group = await getFloodlightGroup(userOf(w), aid);
    expect(group).toMatchObject({ clickDays: 45, impressionDays: 2 });
    const row = await prisma.floodlightGroup.findFirstOrThrow({
      where: { advertiserId: w.advertiserId },
    });
    const groups = await groupsOf(row.id);
    expect(groups.at(-1)?.entries.map((e) => e.label)).toContain('Click conversion window (days)');
  });

  it('a read-only person cannot change the group', async () => {
    const r = await updateFloodlightGroup(userOf(w, 'READ_ONLY'), aid, { clickDays: 10 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('FORBIDDEN');
  });
});

describe('brand controls (AC 1, 2)', () => {
  it('the Verification row changes when a line item gets a verification setting; the YouTube tab ignores display line items', async () => {
    await prisma.lineItem.update({ where: { id: w.lineItemId }, data: { status: 'ACTIVE' } });
    const before = await getBrandControls(
      userOf(w),
      { level: 'advertiser', id: aid },
      'display',
      'active',
    );
    expect(before.rows.find((r) => r.key === 'VERIFICATION')).toMatchObject({
      enabled: 0,
      total: 1,
      pct: 0,
    });
    await prisma.targetingAssignment.create({
      data: {
        sandboxId: w.sandboxId,
        ownerType: 'LINE_ITEM',
        lineItemId: w.lineItemId,
        dimension: 'THIRD_PARTY_VERIFIER',
        mode: 'INCLUDE',
        valueText: 'verifier-a',
      },
    });
    const after = await getBrandControls(
      userOf(w),
      { level: 'advertiser', id: aid },
      'display',
      'active',
    );
    expect(after.rows.find((r) => r.key === 'VERIFICATION')).toMatchObject({
      enabled: 1,
      total: 1,
      pct: 100,
      label: '1/1 Line items',
    });
    const yt = await getBrandControls(
      userOf(w),
      { level: 'advertiser', id: aid },
      'youtube',
      'active',
    );
    expect(yt.totalLineItems).toBe(0);
    expect(yt.ivt).toEqual([]);
  });

  it('the IVT card shows blocked share once the sim has blocked impressions (AC 3)', async () => {
    const day = new Date('2026-01-02T00:00:00Z');
    await prisma.simDailyMetric.create({
      data: {
        sandboxId: w.sandboxId,
        classroomId: w.classroomId,
        lineItemId: w.lineItemId,
        simDate: day,
        impressions: 900,
        blockedImpressions: 100,
      },
    });
    const v = await getBrandControls(
      userOf(w),
      { level: 'advertiser', id: aid },
      'display',
      'active',
    );
    expect(v.ivt.at(-1)).toEqual({ date: '2026-01-02', blockedPct: 10 });
    expect(v.ivt.every((d) => d.blockedPct >= 0)).toBe(true);
  });
});
