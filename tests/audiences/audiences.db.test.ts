// Audience services against a real database (module 14 6.1 and 6.2: lifecycle, create flows, lock, archive, picker,
// line items, analysis, change log, access).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { advanceAudiences } from '@/lib/audiences/lifecycle';
import {
  addCustomerMatchData,
  analyzeGeoDistribution,
  archiveAudience,
  bulkAudienceAction,
  createAudience,
  estimateAudience,
  getAudience,
  getAudienceInsights,
  getAudienceLookups,
  listAudienceLineItems,
  listAudiences,
  listInsightLineItems,
  searchAudiencePicker,
  updateAudience,
} from '@/lib/audiences/service';
import type { AudienceInput } from '@/lib/audiences/wire';
import { seedAudiences } from '@/lib/audiences/seed';
import { createWorld, dropWorld, type World } from '../db/helpers';
import { userOf } from '../services/campaigns/fixtures';

let w: World;
let aid: string;
let activityId: string;
let plainActivityId: string;
let channelId: string;
const user = () => userOf(w);

beforeAll(async () => {
  w = await createWorld('aud');
  const adv = await prisma.advertiser.findUniqueOrThrow({ where: { id: w.advertiserId } });
  aid = adv.publicId.toString();
  const group = await prisma.floodlightGroup.create({
    data: { sandboxId: w.sandboxId, advertiserId: w.advertiserId, name: 'FL group' },
  });
  const remarketing = await prisma.floodlightActivity.create({
    data: { sandboxId: w.sandboxId, groupId: group.id, name: 'Add to cart', remarketingEnabled: true },
  });
  const plain = await prisma.floodlightActivity.create({
    data: { sandboxId: w.sandboxId, groupId: group.id, name: 'Contact', remarketingEnabled: false },
  });
  activityId = remarketing.publicId.toString();
  plainActivityId = plain.publicId.toString();
  await prisma.floodlightVariable.create({
    data: { sandboxId: w.sandboxId, groupId: group.id, key: 'u1', name: 'Order value', ordinal: 0 },
  });
  const channel = await prisma.linkedAccount.create({
    data: { sandboxId: w.sandboxId, advertiserId: w.advertiserId, type: 'YOUTUBE_CHANNEL', externalId: 'UC1', displayName: 'My channel' },
  });
  channelId = channel.id;
}, 120_000);
afterAll(async () => {
  await dropWorld(w);
  await prisma.$disconnect();
});

const setTick = (hours: number) =>
  prisma.simClock.update({ where: { sandboxId: w.sandboxId }, data: { tickIndex: BigInt(hours) } });

async function make(input: AudienceInput) {
  const r = await createAudience(user(), aid, input);
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.data;
}

const tag = (over: Partial<Extract<AudienceInput, { kind: 'TAG_BASED' }>> = {}): AudienceInput => ({
  kind: 'TAG_BASED',
  name: 'Cart visitors',
  floodlightActivityId: activityId,
  rules: [{ variableKey: 'u1', operator: 'GREATER_THAN', value: '10' }],
  membershipDays: 30,
  ...over,
});

describe('tag-based lifecycle (E2E-AUD-02)', () => {
  it('saves as PROCESSING with availableAt four sim hours ahead, then becomes ACTIVE with sizes', async () => {
    await setTick(0);
    const made = await make(tag());
    expect(made.status).toBe('PROCESSING');
    expect(new Date(made.availableAt!).getTime()).toBe(new Date('2026-01-01T04:00:00Z').getTime());
    const before = await getAudience(user(), made.id);
    expect(before.status).toBe('PROCESSING');
    expect(before.availableInHours).toBe(4);
    expect(before.sizes[0]!.cell.bucket).toBe('< 1K');
    expect(before.floodlight?.rules).toHaveLength(1);

    await setTick(3);
    expect((await getAudience(user(), made.id)).status).toBe('PROCESSING');
    await setTick(4);
    const after = await getAudience(user(), made.id);
    expect(after.status).toBe('ACTIVE');
    expect(after.sizes[0]!.cell.exact).toBeGreaterThanOrEqual(3000);
    expect(after.sizes[0]!.cell.bucket).not.toBe('< 1K');
  });

  it('the engine step flips due lists without a page read', async () => {
    await setTick(0);
    const made = await make(tag({ name: 'Engine flip' }));
    const row = await prisma.audience.findFirstOrThrow({ where: { publicId: BigInt(made.id) } });
    expect(await advanceAudiences(prisma, w.sandboxId, w.advertiserId, row.availableAt!.getTime() - 1)).toBe(0);
    expect(await advanceAudiences(prisma, w.sandboxId, w.advertiserId, row.availableAt!.getTime())).toBeGreaterThanOrEqual(1);
    const flipped = await prisma.audience.findUniqueOrThrow({ where: { id: row.id } });
    expect(flipped.status).toBe('ACTIVE');
    expect(Number(flipped.sizeDisplay)).toBeGreaterThanOrEqual(3000);
  });

  it('AUD-010, AUD-011 and AUD-012 block the save', async () => {
    const none = await createAudience(user(), aid, tag({ floodlightActivityId: null }));
    expect(none.ok ? [] : none.issues.map((i) => i.code)).toContain('AUD-010');
    const empty = await createAudience(user(), aid, tag({ rules: [{ variableKey: 'u1', operator: 'EQUALS', value: '' }] }));
    expect(empty.ok ? [] : empty.issues.map((i) => i.code)).toContain('AUD-011');
    const plain = await createAudience(user(), aid, tag({ floodlightActivityId: plainActivityId }));
    expect(plain.ok ? [] : plain.issues.map((i) => i.code)).toContain('AUD-012');
    const noName = await createAudience(user(), aid, tag({ name: '' }));
    expect(noName.ok ? [] : noName.issues.map((i) => i.code)).toContain('AUD-001');
  });

  it('writes a CREATE history entry per field and an update entry per field (AC 17)', async () => {
    await setTick(0);
    const made = await make(tag({ name: 'History list' }));
    const row = await prisma.audience.findFirstOrThrow({ where: { publicId: BigInt(made.id) } });
    const groups = await prisma.changeGroup.findMany({
      where: { sandboxId: w.sandboxId, entityId: row.id },
      include: { entries: true },
    });
    expect(groups).toHaveLength(1);
    expect(groups[0]!.entityType).toBe('AUDIENCE');
    const labels = groups[0]!.entries.map((e) => e.label);
    expect(labels).toEqual(expect.arrayContaining(['Audience name', 'Audience type', 'Membership duration (days)']));
    const up = await updateAudience(user(), made.id, { name: 'History list 2' });
    expect(up.ok).toBe(true);
    const after = await prisma.changeGroup.findMany({ where: { sandboxId: w.sandboxId, entityId: row.id }, include: { entries: true } });
    expect(after).toHaveLength(2);
  });
});

describe('customer match (E2E-AUD-03)', () => {
  const csv = (n: number) => `email\n${Array.from({ length: n }, (_, i) => `hash${i}`).join('\n')}\n`;
  const upload = (over: Record<string, unknown> = {}): AudienceInput =>
    ({
      kind: 'CUSTOMER_MATCH',
      name: 'CRM list',
      source: 'UPLOAD',
      contactType: 'EMAIL',
      fileName: 'crm.csv',
      fileText: csv(2000),
      membershipDays: 30,
      consentAck: true,
      ...over,
    });

  it('an upload shows rows, matched and match rate and sets the list size', async () => {
    await setTick(0);
    const r = await createAudience(user(), aid, upload());
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    expect(r.data.match!.rows).toBe(2000);
    expect(Math.abs((r.data.match!.matched / 2000) * 100 - r.data.match!.matchRatePct)).toBeLessThan(0.1);
    expect(r.data.match!.matchRatePct).toBeGreaterThanOrEqual(38);
    expect(r.data.match!.matchRatePct).toBeLessThanOrEqual(72);
    // same file, same name: the same result
    const again = await createAudience(user(), aid, upload());
    expect(again.ok && again.data.match).toEqual(r.data.match);
    const v = await getAudience(user(), r.data.id);
    expect(v.customerMatch?.uploads[0]).toMatchObject({ fileName: 'crm.csv', rows: 2000 });
    await setTick(4);
    const done = await getAudience(user(), r.data.id);
    expect(done.status).toBe('ACTIVE');
    expect(done.sizes[0]!.cell.exact).toBe(r.data.match!.matched);
  });

  it('AUD-021 file without an identifier column, AUD-023 consent, AUD-020 data source, AUD-025 row cap', async () => {
    const codes = async (input: AudienceInput) => {
      const r = await createAudience(user(), aid, input);
      return r.ok ? [] : r.issues.map((i) => i.code);
    };
    expect(await codes(upload({ fileText: 'colour\nred\n' }))).toContain('AUD-021');
    expect(await codes(upload({ consentAck: false }))).toContain('AUD-023');
    expect(await codes(upload({ source: null }))).toContain('AUD-020');
    expect(await codes(upload({ fileText: csv(100_001) }))).toContain('AUD-025');
    expect(await codes(upload({ membershipDays: 600 }))).toContain('AUD-024');
  });

  it('a connected product creates rows, and "later" creates an INACTIVE empty list that accepts data afterwards', async () => {
    await setTick(0);
    const connected = await make({ kind: 'CUSTOMER_MATCH', name: 'Connected', source: 'CONNECT', connectedProductKey: 'sample-crm', membershipDays: 30, consentAck: false });
    expect((await getAudience(user(), connected.id)).customerMatch?.uploads).toHaveLength(1);

    const later = await make({ kind: 'CUSTOMER_MATCH', name: 'Later', source: 'LATER', membershipDays: 30, consentAck: false });
    expect(later.status).toBe('INACTIVE');
    expect(later.availableAt).toBeNull();
    const empty = await getAudience(user(), later.id);
    expect(empty.sizes[0]!.cell.exact).toBe(0);
    const added = await addCustomerMatchData(user(), later.id, { fileName: 'late.csv', fileText: csv(1500), contactType: 'EMAIL', consentAck: true });
    expect(added.ok).toBe(true);
    const after = await getAudience(user(), later.id);
    expect(after.status).toBe('PROCESSING');
    expect(after.customerMatch?.uploads).toHaveLength(1);
  });
});

describe('combined (E2E-AUD-04)', () => {
  it('is available at once with computed sizes, expression and members', async () => {
    await setTick(0);
    const a = await make(tag({ name: 'Seed A' }));
    const b = await make(tag({ name: 'Seed B' }));
    await setTick(4);
    const c = await make({
      kind: 'COMBINED',
      name: 'A or B',
      draft: {
        include: [[{ kind: 'AUDIENCE', id: a.id }, { kind: 'AUDIENCE', id: b.id }]],
        exclude: [],
      },
    });
    expect(c.status).toBe('ACTIVE');
    const v = await getAudience(user(), c.id);
    expect(v.sizes[0]!.cell.exact).toBeGreaterThan(0);
    expect(v.combined?.expression).toBe('(Seed A or Seed B)');
    const aView = await getAudience(user(), a.id);
    const bView = await getAudience(user(), b.id);
    expect(v.sizes[0]!.cell.exact).toBeGreaterThan(Math.max(aView.sizes[0]!.cell.exact, bView.sizes[0]!.cell.exact));
    const est = await estimateAudience(user(), aid, { kind: 'COMBINED', draft: { include: [[{ kind: 'AUDIENCE', id: a.id }]], exclude: [{ kind: 'AUDIENCE', id: b.id }] } });
    expect('sizes' in est && est.expression).toBe('(Seed A), excluding Seed B');
  });

  it('AUD-030 and AUD-031', async () => {
    const empty = await createAudience(user(), aid, { kind: 'COMBINED', name: 'x', draft: { include: [[]], exclude: [] } });
    expect(empty.ok ? [] : empty.issues.map((i) => i.code)).toContain('AUD-030');
    const a = await make(tag({ name: 'Both sides' }));
    const same = await createAudience(user(), aid, {
      kind: 'COMBINED',
      name: 'x',
      draft: { include: [[{ kind: 'AUDIENCE', id: a.id }]], exclude: [{ kind: 'AUDIENCE', id: a.id }] },
    });
    expect(same.ok ? [] : same.issues.map((i) => i.code)).toContain('AUD-031');
  });

  it('Google audiences can be members', async () => {
    const c = await make({
      kind: 'COMBINED',
      name: 'Google only',
      draft: { include: [[{ kind: 'GOOGLE_AUDIENCE', id: '7000037' }]], exclude: [] },
    });
    expect((await getAudience(user(), c.id)).combined?.include[0]?.[0]?.name).toBe('Basketball Fans');
  });
});

describe('lookalike (E2E-AUD-05)', () => {
  it('a seed under 1,000 users fails AUD-041, eleven seeds fail AUD-040, a valid seed saves with the expansion size', async () => {
    const tiny = await prisma.audience.create({
      data: { sandboxId: w.sandboxId, advertiserId: w.advertiserId, name: 'Tiny', type: 'CUSTOMER_MATCH', status: 'ACTIVE', sizeDisplay: 800n },
    });
    const big = await prisma.audience.create({
      data: { sandboxId: w.sandboxId, advertiserId: w.advertiserId, name: 'Big', type: 'CUSTOMER_MATCH', status: 'ACTIVE', sizeDisplay: 20_000n },
    });
    const pid = async (id: string) => (await prisma.audience.findUniqueOrThrow({ where: { id } })).publicId.toString();
    const bad = await createAudience(user(), aid, { kind: 'LOOKALIKE', name: 'L', seedIds: [await pid(tiny.id)], reachPct: 5, countries: ['IN'] });
    expect(bad.ok ? [] : bad.issues.map((i) => i.code)).toContain('AUD-041');
    const many = await createAudience(user(), aid, { kind: 'LOOKALIKE', name: 'L', seedIds: Array.from({ length: 11 }, () => '999'), reachPct: 5, countries: ['IN'] });
    expect(many.ok ? [] : many.issues.map((i) => i.code)).toContain('AUD-040');
    const geo = await createAudience(user(), aid, { kind: 'LOOKALIKE', name: 'L', seedIds: [await pid(big.id)], reachPct: 5, countries: [] });
    expect(geo.ok ? [] : geo.issues.map((i) => i.code)).toContain('AUD-043');
    const reach = await createAudience(user(), aid, { kind: 'LOOKALIKE', name: 'L', seedIds: [await pid(big.id)], reachPct: 12, countries: ['IN'] });
    expect(reach.ok ? [] : reach.issues.map((i) => i.code)).toContain('AUD-042');

    await setTick(0);
    const ok = await make({ kind: 'LOOKALIKE', name: 'L ok', seedIds: [await pid(big.id)], reachPct: 5, countries: ['IN'] });
    await setTick(4);
    const v = await getAudience(user(), ok.id);
    expect(v.sizes[0]!.cell.exact).toBe(80_000);
    expect(v.lookalike?.seeds[0]?.name).toBe('Big');
    const row = await prisma.audience.findFirstOrThrow({ where: { publicId: BigInt(ok.id) } });
    expect(Number(row.reachExpansion)).toBe(4);
  });
});

describe('custom lists, YouTube users', () => {
  it('affinity needs an entry (AUD-050); intent needs a keyword or URL (AUD-080)', async () => {
    const none = await createAudience(user(), aid, { kind: 'CUSTOM_AFFINITY', name: 'A', interests: [], urls: [], apps: [], keywords: [] });
    expect(none.ok ? [] : none.issues.map((i) => i.code)).toContain('AUD-050');
    for (const kind of ['CUSTOM_INTENT_DISPLAY_VIDEO', 'CUSTOM_INTENT_YOUTUBE'] as const) {
      const r = await createAudience(user(), aid, { kind, name: 'I', interests: [], urls: [], apps: [], keywords: [] });
      expect(r.ok ? [] : r.issues.map((i) => i.code)).toContain('AUD-080');
    }
    const url = await createAudience(user(), aid, { kind: 'CUSTOM_AFFINITY', name: 'A', interests: ['x'], urls: ['not a url'], apps: [], keywords: [] });
    expect(url.ok ? [] : url.issues.map((i) => i.code)).toContain('AUD-052');
  });

  it('a valid affinity list keeps its entries', async () => {
    const made = await make({ kind: 'CUSTOM_AFFINITY', name: 'Gadget fans', interests: ['gadgets', 'phones'], urls: ['gsmarena.com'], apps: [], keywords: [] });
    const v = await getAudience(user(), made.id);
    expect(v.entries.map((e) => e.value)).toEqual(['gadgets', 'phones', 'gsmarena.com']);
  });

  it('estimator: unavailable without entries, deterministic with them', async () => {
    expect(await estimateAudience(user(), aid, { kind: 'CUSTOM', interests: [], urls: [], apps: [], keywords: [] })).toEqual({ unavailable: true });
    const a = await estimateAudience(user(), aid, { kind: 'CUSTOM', interests: ['x'], urls: [], apps: [], keywords: [] });
    expect(a).toEqual(await estimateAudience(user(), aid, { kind: 'CUSTOM', interests: ['x'], urls: [], apps: [], keywords: [] }));
    expect('sizes' in a).toBe(true);
  });

  it('YouTube users need a linked channel (AUD-090)', async () => {
    const yt = (linked: string | null): AudienceInput => ({ kind: 'YOUTUBE_USERS', name: 'Viewers', linkedAccountId: linked, action: 'VIEWED_ANY_VIDEO', videoIds: [], membershipDays: 30 });
    const bad = await createAudience(user(), aid, yt(null));
    expect(bad.ok ? [] : bad.issues.map((i) => i.code)).toContain('AUD-090');
    const ok = await make(yt(channelId));
    const v = await getAudience(user(), ok.id);
    expect(v.youtube?.channel).toBe('My channel');
    const lookups = await getAudienceLookups(user(), aid);
    expect(lookups.linkedChannels.map((c) => c.id)).toContain(channelId);
    expect(lookups.activities.find((a) => a.id === plainActivityId)?.remarketing).toBe(false);
  });
});

describe('details edit, lock and archive (E2E-AUD-06)', () => {
  it('name, description and duration can be saved; locked fields cannot (AUD-110)', async () => {
    const made = await make(tag({ name: 'Editable' }));
    const ok = await updateAudience(user(), made.id, { name: 'Editable 2', description: 'd', membershipDays: 60 });
    expect(ok.ok).toBe(true);
    const v = await getAudience(user(), made.id);
    expect(v).toMatchObject({ name: 'Editable 2', description: 'd', membershipDays: 60, version: 2 });
    for (const locked of [{ type: 'LOOKALIKE' }, { floodlightActivityId: 'other' }, { reachPct: 7.5 }, { countries: ['US'] }, { contactType: 'PHONE' }]) {
      const bad = await updateAudience(user(), made.id, { locked });
      expect(bad.ok ? [] : bad.issues.map((i) => i.code), JSON.stringify(locked)).toContain('AUD-110');
    }
    const days = await updateAudience(user(), made.id, { membershipDays: 541 });
    expect(days.ok ? [] : days.issues.map((i) => i.code)).toContain('AUD-024');
  });

  it('an old version loses to a newer save', async () => {
    const made = await make(tag({ name: 'Versioned' }));
    await updateAudience(user(), made.id, { name: 'Versioned 2' }, { expectedVersion: 1 });
    const stale = await updateAudience(user(), made.id, { name: 'Versioned 3' }, { expectedVersion: 1 });
    expect(stale.ok ? '' : stale.code).toBe('CONFLICT');
  });

  it('lookalike lists have no editable duration', async () => {
    const big = await prisma.audience.create({
      data: { sandboxId: w.sandboxId, advertiserId: w.advertiserId, name: 'Seed for lock', type: 'TAG_BASED', status: 'ACTIVE', sizeDisplay: 20_000n },
    });
    const seedPid = big.publicId.toString();
    const l = await make({ kind: 'LOOKALIKE', name: 'No duration', seedIds: [seedPid], reachPct: 5, countries: ['IN'] });
    const r = await updateAudience(user(), l.id, { membershipDays: 30 });
    expect(r.ok ? [] : r.issues.map((i) => i.code)).toContain('AUD-110');
  });

  it('archiving a targeted list warns with the line item count, then archives and flags the engine', async () => {
    const made = await make(tag({ name: 'Targeted' }));
    const row = await prisma.audience.findFirstOrThrow({ where: { publicId: BigInt(made.id) } });
    await prisma.lineItem.update({ where: { id: w.lineItemId }, data: { status: 'ACTIVE' } });
    await prisma.targetingAssignment.create({
      data: { sandboxId: w.sandboxId, ownerType: 'LINE_ITEM', lineItemId: w.lineItemId, dimension: 'AUDIENCE_LIST', mode: 'INCLUDE', refType: 'AUDIENCE', refId: row.id, audienceSection: 'FIRST_PARTY_AND_PARTNER' },
    });
    const first = await archiveAudience(user(), made.id, false);
    expect(first.ok && first.data).toEqual({ archived: false, lineItems: 1 });
    expect(first.ok && first.warnings?.[0]?.message).toBe('1 active line items target this audience.');
    expect((await prisma.audience.findUniqueOrThrow({ where: { id: row.id } })).status).not.toBe('ARCHIVED');
    const done = await archiveAudience(user(), made.id, true);
    expect(done.ok && done.data.archived).toBe(true);
    const stored = await prisma.audience.findUniqueOrThrow({ where: { id: row.id } });
    expect(stored.status).toBe('ARCHIVED');
    expect((stored.config as { restricted?: boolean }).restricted).toBe(true);
    // the line item keeps its reference
    expect(await prisma.targetingAssignment.count({ where: { refId: row.id } })).toBe(1);

    const un = await bulkAudienceAction(user(), { ids: [made.id], action: 'UNARCHIVE' });
    expect(un.ok && un.data.done).toBe(1);
    expect((await prisma.audience.findUniqueOrThrow({ where: { id: row.id } })).status).not.toBe('ARCHIVED');
    await prisma.lineItem.update({ where: { id: w.lineItemId }, data: { status: 'DRAFT' } });
  });

  it('an unused list archives at once and bulk archive covers several', async () => {
    const a = await make(tag({ name: 'Bulk A' }));
    const b = await make(tag({ name: 'Bulk B' }));
    const one = await archiveAudience(user(), a.id, false);
    expect(one.ok && one.data).toEqual({ archived: true, lineItems: 0 });
    const bulk = await bulkAudienceAction(user(), { ids: [b.id, '999999999'], action: 'ARCHIVE' });
    expect(bulk.ok && bulk.data).toEqual({ done: 1, failed: 1 });
  });
});

describe('line items tab and external source', () => {
  it('lists exactly the line items with an AUDIENCE targeting row and counts match the grid', async () => {
    const made = await make(tag({ name: 'With LI' }));
    const row = await prisma.audience.findFirstOrThrow({ where: { publicId: BigInt(made.id) } });
    expect(await listAudienceLineItems(user(), made.id)).toEqual([]);
    await prisma.targetingAssignment.create({
      data: { sandboxId: w.sandboxId, ownerType: 'LINE_ITEM', lineItemId: w.lineItemId, dimension: 'AUDIENCE_LIST', mode: 'EXCLUDE', refType: 'AUDIENCE', refId: row.id },
    });
    const items = await listAudienceLineItems(user(), made.id);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ mode: 'Excluded' });
    const list = await listAudiences(user(), aid, { tab: 'FIRST_PARTY', q: 'With LI' });
    expect(list.rows[0]!.lineItems).toBe(1);
  });

  it('a tag-based list from outside Audience Manager is flagged and cannot be edited', async () => {
    const ext = await prisma.audience.create({
      data: { sandboxId: w.sandboxId, advertiserId: w.advertiserId, name: 'From Analytics', type: 'TAG_BASED', status: 'ACTIVE', source: 'GOOGLE_ANALYTICS', sizeDisplay: 5000n },
    });
    const v = await getAudience(user(), ext.publicId.toString());
    expect(v.externalSource).toBe(true);
    const r = await updateAudience(user(), ext.publicId.toString(), { name: 'x' });
    expect(r.ok ? '' : r.code).toBe('FORBIDDEN');
  });
});

describe('lists, tabs and picker (AC 1, 2, 18)', () => {
  it('each tab holds only its types and the default status hides archived lists', async () => {
    const first = await listAudiences(user(), aid, { tab: 'FIRST_PARTY' });
    expect(first.rows.every((r) => ['TAG_BASED', 'CUSTOMER_MATCH', 'YOUTUBE_USERS', 'LOOKALIKE'].includes(r.type))).toBe(true);
    expect(first.rows.some((r) => r.status === 'ARCHIVED')).toBe(false);
    const custom = await listAudiences(user(), aid, { tab: 'CUSTOM' });
    expect(custom.rows.every((r) => r.type.startsWith('CUSTOM_'))).toBe(true);
    const combined = await listAudiences(user(), aid, { tab: 'COMBINED' });
    expect(combined.rows.every((r) => r.type === 'COMBINED')).toBe(true);
    expect(combined.rows[0]!.activeDisplay).not.toBeNull();
    const archived = await listAudiences(user(), aid, { tab: 'FIRST_PARTY', status: ['ARCHIVED'] });
    expect(archived.rows.length).toBeGreaterThan(0);
    expect(archived.rows.every((r) => r.status === 'ARCHIVED')).toBe(true);
    const byName = await listAudiences(user(), aid, { tab: 'FIRST_PARTY', q: 'cart visitors' });
    expect(byName.rows.every((r) => r.name.toLowerCase().includes('cart visitors'))).toBe(true);
    const partner = await listAudiences(user(), aid, { tab: 'PARTNER' });
    expect(partner.rows).toEqual([]);
  });

  it('picker excludes archived lists, filters by eligibility and hints at lists still processing', async () => {
    await setTick(0);
    const fresh = await make(tag({ name: 'Picker fresh' }));
    const rows = await searchAudiencePicker(user(), aid, { type: 'FIRST_PARTY', q: 'picker fresh' });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.availableInHours).toBe(4);
    const all = await searchAudiencePicker(user(), aid, { type: 'FIRST_PARTY' });
    expect(all.some((r) => r.name === 'Bulk A')).toBe(false); // archived
    await setTick(4);
    const display = await searchAudiencePicker(user(), aid, { type: 'FIRST_PARTY', eligibility: 'DISPLAY' });
    expect(display.filter((r) => r.availableInHours === 0).every((r) => r.eligibility.includes('DISPLAY'))).toBe(true);
    expect(display.some((r) => r.id === fresh.id)).toBe(true);
    const google = await searchAudiencePicker(user(), aid, { type: 'GOOGLE', q: 'basketball' });
    expect(google[0]!.name).toBe('Basketball Fans');
    expect(await searchAudiencePicker(user(), aid, { type: 'PAIR' })).toEqual([]);
  });
});

describe('analysis (E2E-AUD-07)', () => {
  it('geo distribution refuses a seed under 1,000 users (AUD-113) and sums to 100 for a valid one', async () => {
    const tiny = await prisma.audience.create({
      data: { sandboxId: w.sandboxId, advertiserId: w.advertiserId, name: 'Tiny seed', type: 'CUSTOMER_MATCH', status: 'ACTIVE', sizeDisplay: 900n },
    });
    const big = await prisma.audience.create({
      data: { sandboxId: w.sandboxId, advertiserId: w.advertiserId, name: 'Big seed', type: 'CUSTOMER_MATCH', status: 'ACTIVE', sizeDisplay: 50_000n },
    });
    const bad = await analyzeGeoDistribution(user(), aid, tiny.publicId.toString());
    expect(bad.ok ? [] : bad.issues.map((i) => i.code)).toContain('AUD-113');
    const good = await analyzeGeoDistribution(user(), aid, big.publicId.toString());
    if (!good.ok) throw new Error(`expected ok ${JSON.stringify(good)}`);
    expect(Math.round(good.data.regions.reduce((s, r) => s + r.sharePct, 0) * 10) / 10).toBe(100);
    const again = await analyzeGeoDistribution(user(), aid, big.publicId.toString());
    expect(again.ok && again.data.regions).toEqual(good.data.regions);
    const missing = await analyzeGeoDistribution(user(), aid, '999999999');
    expect(missing.ok ? '' : missing.code).toBe('NOT_FOUND');
  });

  it('insights only offer optimized line items and refuse others (AUD-114)', async () => {
    expect(await listInsightLineItems(user(), aid)).toEqual([]);
    const li = await prisma.lineItem.findUniqueOrThrow({ where: { id: w.lineItemId } });
    const bad = await getAudienceInsights(user(), aid, li.publicId.toString());
    expect(bad.ok ? [] : bad.issues.map((i) => i.code)).toContain('AUD-114');
    await prisma.lineItem.update({ where: { id: w.lineItemId }, data: { optimizedTargeting: true } });
    const offered = await listInsightLineItems(user(), aid);
    expect(offered.map((o) => o.id)).toEqual([li.publicId.toString()]);
    const ok = await getAudienceInsights(user(), aid, li.publicId.toString());
    if (!ok.ok) throw new Error('expected ok');
    expect(Object.keys(ok.data).sort()).toEqual(['age', 'device', 'gender', 'interests', 'liId', 'regions', 'sampleSize']);
    const again = await getAudienceInsights(user(), aid, li.publicId.toString());
    expect(again.ok && again.data).toEqual(ok.data);
    await prisma.lineItem.update({ where: { id: w.lineItemId }, data: { optimizedTargeting: false } });
  });
});

describe('access (E2E-AUD-08, AC 16)', () => {
  it('READ_ONLY and CREATIVE cannot write; REPORTING_ONLY cannot read', async () => {
    for (const role of ['READ_ONLY', 'PARTNER_CLIENT', 'CREATIVE'] as const) {
      const r = await createAudience(userOf(w, role), aid, tag({ name: 'Nope' }));
      expect(r.ok ? '' : r.code, role).toBe('FORBIDDEN');
    }
    const read = await listAudiences(userOf(w, 'READ_ONLY'), aid, { tab: 'FIRST_PARTY' });
    expect(read.rows.length).toBeGreaterThan(0);
    await expect(listAudiences(userOf(w, 'REPORTING_ONLY'), aid, { tab: 'FIRST_PARTY' })).rejects.toThrow();
  });

  it('a list of another advertiser or sandbox is a 404', async () => {
    await expect(getAudience(user(), '999999999')).rejects.toThrow();
    await expect(getAudience(user(), 'not-an-id')).rejects.toThrow();
  });
});

describe('seed (M14-01)', () => {
  it('adds tag rules, combined, partner, YouTube, small and processing lists once per advertiser', async () => {
    const sw = await createWorld('audseed');
    try {
      const mk = (name: string, type: 'TAG_BASED' | 'CUSTOMER_MATCH', size: number) =>
        prisma.audience.create({
          data: { sandboxId: sw.sandboxId, advertiserId: sw.advertiserId, name, type, status: 'ACTIVE', sizeDisplay: BigInt(size) },
        });
      await mk('Visitors', 'TAG_BASED', 40_000);
      await mk('Customers', 'CUSTOMER_MATCH', 52_000);
      const group = await prisma.floodlightGroup.create({ data: { sandboxId: sw.sandboxId, advertiserId: sw.advertiserId, name: 'G' } });
      await prisma.floodlightActivity.create({ data: { sandboxId: sw.sandboxId, groupId: group.id, name: 'Cart', remarketingEnabled: true } });
      const run = () => prisma.$transaction((tx) => seedAudiences(tx, { sandboxId: sw.sandboxId, template: 'starter-agency', seedValue: 1 }));
      expect(await run()).toBe(1);
      const rows = await prisma.audience.findMany({ where: { advertiserId: sw.advertiserId } });
      const count = (t: string) => rows.filter((r) => r.type === t).length;
      expect(count('COMBINED')).toBe(2);
      expect(count('PARTNER')).toBe(2);
      expect(count('YOUTUBE_USERS')).toBe(1);
      expect(rows.filter((r) => r.status === 'PROCESSING' && r.name.endsWith('Wishlist visitors'))).toHaveLength(1);
      expect(rows.some((r) => r.type === 'TAG_BASED' && Number(r.sizeDisplay) < 1000)).toBe(true);
      expect(await prisma.customerMatchUpload.count({ where: { sandboxId: sw.sandboxId } })).toBe(1);
      expect(await prisma.audienceTagRule.count({ where: { sandboxId: sw.sandboxId } })).toBeGreaterThanOrEqual(3);
      expect(await run()).toBe(0);
      expect(await prisma.audience.count({ where: { advertiserId: sw.advertiserId } })).toBe(rows.length);
    } finally {
      await dropWorld(sw);
    }
  });
});
