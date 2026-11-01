// Search service (module 01 4.6): name/ID hits inside one advertiser, the 1 to 200 character rule (GEN-004), the
// partner scope and sandbox isolation (a foreign advertiser looks like a missing one).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SessionUser } from '@/lib/auth/types';
import { prisma } from '@/lib/db';
import { getSearchSuggestions, searchAdvertiser, searchPartner } from '@/lib/search/service';
import { createWorld, dropWorld, type World } from '../db/helpers';

let a: World;
let b: World;
let ua: SessionUser;
const userFor = (w: World): SessionUser => ({
  id: w.userId,
  email: `${w.tag}-user@example.test`,
  name: `User ${w.tag}`,
  appRole: 'user',
  classroomId: w.classroomId,
  sandboxId: w.sandboxId,
  partnerId: w.partnerId,
  dvRole: 'STANDARD',
});

beforeAll(async () => {
  a = await createWorld('srcha');
  b = await createWorld('srchb');
  ua = userFor(a);
});
afterAll(async () => {
  await dropWorld(a);
  await dropWorld(b);
  await prisma.$disconnect();
});

const pub = async (kind: 'advertiser' | 'partner', id: string) =>
  String(
    kind === 'advertiser'
      ? (await prisma.advertiser.findUniqueOrThrow({ where: { id } })).publicId
      : (await prisma.partner.findUniqueOrThrow({ where: { id } })).publicId,
  );

describe('searchAdvertiser', () => {
  it('finds entities by name inside the advertiser, with links, and resolves the phrase', async () => {
    const aid = await pub('advertiser', a.advertiserId);
    const res = await searchAdvertiser(ua, aid, { query: 'srcha' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const kinds = res.data.results.map((r) => r.kind);
    expect(kinds).toContain('campaign');
    expect(kinds).toContain('insertionOrder');
    expect(res.data.results.length).toBeLessThanOrEqual(10);
    for (const r of res.data.results) expect(r.href).toMatch(/^\/p\/\d+\/a\/\d+\//);
    expect(res.data.target).toBeNull();
    const phrase = await searchAdvertiser(ua, aid, { query: 'paused line items' });
    expect(phrase.ok && phrase.data.target?.route).toBe('explorerlis');
  });

  it('finds an entity by numeric ID', async () => {
    const aid = await pub('advertiser', a.advertiserId);
    const c = await prisma.creative.findUniqueOrThrow({ where: { id: a.creativeId } });
    const res = await searchAdvertiser(ua, aid, { query: c.publicId.toString() });
    expect(res.ok && res.data.results.map((r) => r.kind)).toContain('creative');
  });

  it('rejects an empty query and one over 200 characters (GEN-004)', async () => {
    const aid = await pub('advertiser', a.advertiserId);
    const empty = await searchAdvertiser(ua, aid, { query: '  ' });
    expect(empty).toMatchObject({ ok: false, code: 'INVALID' });
    const long = await searchAdvertiser(ua, aid, { query: 'x'.repeat(201) });
    expect(long).toMatchObject({ ok: false, code: 'INVALID' });
    if (!long.ok) expect(long.issues[0]?.code).toBe('GEN-004');
    expect((await searchAdvertiser(ua, aid, { query: 'x'.repeat(200) })).ok).toBe(true);
  });

  it('does not see another sandbox', async () => {
    const foreign = await pub('advertiser', b.advertiserId);
    expect(await searchAdvertiser(ua, foreign, { query: 'srchb' })).toMatchObject({
      ok: false,
      code: 'NOT_FOUND',
    });
    const mine = await pub('advertiser', a.advertiserId);
    const res = await searchAdvertiser(ua, mine, { query: 'srchb' });
    expect(res.ok && res.data.results).toEqual([]);
  });

  it('needs a sandbox', async () => {
    const aid = await pub('advertiser', a.advertiserId);
    const { sandboxId: _unused, ...bare } = ua;
    expect(await searchAdvertiser(bare, aid, { query: 'x' })).toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });
  });
});

describe('searchPartner and suggestions', () => {
  it('lists advertisers by name or ID only', async () => {
    const pid = await pub('partner', a.partnerId);
    const res = await searchPartner(ua, pid, { query: 'Advertiser srcha' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.results.map((r) => r.kind)).toEqual(['advertiser']);
    expect(res.data.scope).toBe('partner');
  });
  it('returns the 7 chips', async () => {
    const aid = await pub('advertiser', a.advertiserId);
    const res = await getSearchSuggestions(ua, aid);
    expect(res.ok && res.data).toHaveLength(7);
  });
});
