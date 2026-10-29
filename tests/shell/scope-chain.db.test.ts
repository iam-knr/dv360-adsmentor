// Scope resolvers with the entity chain check (routes.md R10, 5.1, 6.5): ids of another sandbox and ids under the
// wrong parent are "not found", the same as missing ids. Also the shell's UI state tables (01-T5, 01-T6).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@/lib/auth/types';
import { prisma } from '@/lib/db';
import { createWorld, dropWorld, type World } from '../db/helpers';

const session = vi.hoisted(() => ({ user: null as SessionUser | null }));
vi.mock('@/lib/auth/session', () => ({ getSessionUser: () => Promise.resolve(session.user) }));

const {
  resolveAdvertiser,
  resolveAudienceKind,
  resolveCampaign,
  resolveIo,
  resolveLi,
  resolvePartner,
} = await import('@/lib/scope/resolve');
const { getPrefs, savePrefs } = await import('@/lib/scope/prefs');
const { logRecentlyOpened, RECENT_KEEP } = await import('@/lib/scope/recent');

interface Pub {
  p: string;
  a: string;
  c: string;
  io: string;
  li: string;
}

async function publicIds(w: World): Promise<Pub> {
  const s = (v: { publicId: bigint } | null) => v?.publicId.toString() ?? '';
  return {
    p: s(await prisma.partner.findUnique({ where: { id: w.partnerId } })),
    a: s(await prisma.advertiser.findUnique({ where: { id: w.advertiserId } })),
    c: s(await prisma.campaign.findUnique({ where: { id: w.campaignId } })),
    io: s(await prisma.insertionOrder.findUnique({ where: { id: w.ioId } })),
    li: s(await prisma.lineItem.findUnique({ where: { id: w.lineItemId } })),
  };
}

const userOf = (w: World): SessionUser => ({
  id: w.userId,
  email: 'student@example.test',
  name: 'Sam Student',
  appRole: 'user',
  sandboxId: w.sandboxId,
  partnerId: w.partnerId,
  dvRole: 'STANDARD',
});

describe('scope chain check', () => {
  let a: World;
  let b: World;
  let pa: Pub;
  let pb: Pub;
  let otherCampaign: string;

  beforeAll(async () => {
    a = await createWorld('scope-a');
    b = await createWorld('scope-b');
    pa = await publicIds(a);
    pb = await publicIds(b);
    // A second campaign in sandbox A, for "IO under the wrong campaign".
    const c2 = await prisma.campaign.create({
      data: {
        sandboxId: a.sandboxId,
        advertiserId: a.advertiserId,
        name: 'Second campaign',
        plannedStart: new Date('2026-01-01T00:00:00Z'),
      },
    });
    otherCampaign = c2.publicId.toString();
  });

  afterAll(async () => {
    await dropWorld(a);
    await dropWorld(b);
  });

  beforeEach(() => {
    session.user = userOf(a);
  });

  it('resolves the whole chain of the viewer sandbox, by public id and by row id', async () => {
    const li = await resolveLi(pa.p, pa.a, pa.c, pa.io, pa.li);
    expect(li?.partner.id).toBe(a.partnerId);
    expect(li?.advertiser).toMatchObject({
      id: a.advertiserId,
      currencyCode: 'INR',
      paused: false,
    });
    expect(li?.campaign.id).toBe(a.campaignId);
    expect(li?.io.id).toBe(a.ioId);
    expect(li?.li).toMatchObject({ id: a.lineItemId, publicId: pa.li, type: 'DISPLAY' });
    expect((await resolvePartner(a.partnerId))?.publicId).toBe(pa.p);
  });

  it('returns not found for ids of another sandbox at every level', async () => {
    expect(await resolvePartner(pb.p)).toBeNull();
    expect(await resolveAdvertiser(pa.p, pb.a)).toBeNull();
    expect(await resolveAdvertiser(pb.p, pb.a)).toBeNull();
    expect(await resolveCampaign(pa.p, pa.a, pb.c)).toBeNull();
    expect(await resolveIo(pa.p, pa.a, pa.c, pb.io)).toBeNull();
    expect(await resolveLi(pa.p, pa.a, pa.c, pa.io, pb.li)).toBeNull();
    expect(await resolvePartner(b.partnerId)).toBeNull();
  });

  it('the other sandbox owner sees their own chain and not ours', async () => {
    session.user = userOf(b);
    expect(await resolveLi(pb.p, pb.a, pb.c, pb.io, pb.li)).not.toBeNull();
    expect(await resolveAdvertiser(pa.p, pa.a)).toBeNull();
  });

  it('returns not found for mismatched parents', async () => {
    // IO of campaign 1 under campaign 2 of the same advertiser
    expect(await resolveIo(pa.p, pa.a, otherCampaign, pa.io)).toBeNull();
    // a campaign id used as the advertiser segment
    expect(await resolveCampaign(pa.p, pa.c, pa.c)).toBeNull();
    // the right LI under someone else's IO
    expect(await resolveLi(pa.p, pa.a, pa.c, pb.io, pa.li)).toBeNull();
    // our advertiser under their partner
    expect(await resolveAdvertiser(pb.p, pa.a)).toBeNull();
  });

  it('returns not found for missing and malformed ids without a lookup', async () => {
    expect(await resolvePartner('999999999999')).toBeNull();
    expect(await resolveAdvertiser(pa.p, 'abc')).toBeNull();
    expect(await resolveCampaign(pa.p, pa.a, '0')).toBeNull();
    expect(await resolveIo(pa.p, pa.a, pa.c, '../1')).toBeNull();
  });

  it('returns nothing without a sandbox or without a session', async () => {
    session.user = { ...userOf(a), sandboxId: undefined };
    expect(await resolvePartner(pa.p)).toBeNull();
    session.user = null;
    expect(await resolvePartner(pa.p)).toBeNull();
  });

  it('flags a paused advertiser for the banner (AC-01-24)', async () => {
    await prisma.advertiser.update({ where: { id: a.advertiserId }, data: { status: 'PAUSED' } });
    try {
      expect((await resolveAdvertiser(pa.p, pa.a))?.advertiser.paused).toBe(true);
    } finally {
      await prisma.advertiser.update({ where: { id: a.advertiserId }, data: { status: 'ACTIVE' } });
    }
  });

  it('resolves the kind segment of an audience link in the same advertiser only (routes.md 6.3)', async () => {
    const aud = await prisma.audience.findFirstOrThrow({ where: { sandboxId: a.sandboxId } });
    expect(await resolveAudienceKind(a.advertiserId, aud.publicId.toString())).toBe('lookalike');
    const foreign = await prisma.audience.findFirstOrThrow({ where: { sandboxId: b.sandboxId } });
    expect(await resolveAudienceKind(a.advertiserId, foreign.publicId.toString())).toBeNull();
  });

  describe('preferences (01-T5)', () => {
    it('saves, reads back and drops unknown keys', async () => {
      const user = userOf(a);
      const res = await savePrefs(user, {
        pinnedCampaignTab: 'lis',
        navOpen: { advertiser: true },
        bogus: 1,
      });
      expect(res).toEqual({
        ok: true,
        prefs: { pinnedCampaignTab: 'lis', navOpen: { advertiser: true } },
      });
      expect(await getPrefs(user)).toMatchObject({ pinnedCampaignTab: 'lis' });
      await savePrefs(user, { pinnedCampaignTab: 'combined', railLastPanel: null });
      expect(await getPrefs(user)).toMatchObject({
        pinnedCampaignTab: 'combined',
        railLastPanel: null,
      });
      // per sandbox: the other sandbox has none
      expect(await getPrefs({ id: a.userId, sandboxId: b.sandboxId })).toEqual({});
    });

    it('refuses a value over 4 KB with SHL-010 and a bad shape', async () => {
      const res = await savePrefs(userOf(a), {
        dateDefaults: { grid: 'x'.repeat(40) },
        navOpen: Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`k${i}`, true])),
        pinnedCampaignTab: 'nope',
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.issues.map((i) => i.code).sort()).toEqual(['INVALID', 'SHL-010']);
      }
    });

    it('view-as never writes the student settings', async () => {
      const user = { ...userOf(a), viewAs: { userId: a.userId, actAs: true } };
      await savePrefs(user, { pinnedCampaignTab: 'ios' });
      expect((await getPrefs(user)).pinnedCampaignTab).toBe('combined');
    });
  });

  describe('recently opened (01-T6)', () => {
    it('upserts one row per entity and keeps the newest 20 per type', async () => {
      const user = userOf(a);
      const base = Date.parse('2026-03-01T00:00:00Z');
      for (let i = 0; i < RECENT_KEEP + 3; i += 1) {
        await logRecentlyOpened(
          user,
          { entityType: 'CAMPAIGN', entityId: `cmp-${i}`, partnerId: a.partnerId },
          new Date(base + i * 1000),
        );
      }
      await logRecentlyOpened(
        user,
        { entityType: 'CAMPAIGN', entityId: 'cmp-22', partnerId: a.partnerId },
        new Date(base + 99_000),
      );
      await logRecentlyOpened(
        user,
        { entityType: 'ADVERTISER', entityId: a.advertiserId, partnerId: a.partnerId },
        new Date(base),
      );
      const rows = await prisma.recentlyViewed.findMany({
        where: { sandboxId: a.sandboxId, userId: a.userId, entityType: 'CAMPAIGN' },
        orderBy: { viewedAt: 'desc' },
      });
      expect(rows).toHaveLength(RECENT_KEEP);
      expect(rows[0]?.entityId).toBe('cmp-22');
      expect(rows.map((r) => r.entityId)).not.toContain('cmp-0');
      expect(
        await prisma.recentlyViewed.count({
          where: { sandboxId: a.sandboxId, entityType: 'ADVERTISER' },
        }),
      ).toBe(1);
    });

    it('does not log while viewing as the student', async () => {
      await logRecentlyOpened(
        { ...userOf(a), viewAs: { userId: a.userId, actAs: false } },
        { entityType: 'LINE_ITEM', entityId: a.lineItemId, partnerId: a.partnerId },
      );
      expect(
        await prisma.recentlyViewed.count({
          where: { sandboxId: a.sandboxId, entityType: 'LINE_ITEM' },
        }),
      ).toBe(0);
    });
  });
});
