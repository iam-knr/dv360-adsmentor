// Q5: the audience picker catalogue must list the audiences of the requested advertiser only, never another
// advertiser's (cross-advertiser leak seen on production: Nimbus Labs line item listed Fable Outfitters lists).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { readAudiences } from '@/app/api/dv/audiences/estimate/load';
import { createWorld, dropWorld, type World } from '../db/helpers';

let w: World;
let otherAdvertiserId: string;

beforeAll(async () => {
  w = await createWorld('q5');
  const other = await prisma.advertiser.create({
    data: {
      sandboxId: w.sandboxId,
      partnerId: w.partnerId,
      name: 'Other Advertiser',
      websiteUrl: 'https://other.example.test',
      currencyCode: 'SGD',
      timeZone: 'Asia/Singapore',
    },
  });
  otherAdvertiserId = other.id;
  await prisma.audience.create({
    data: { sandboxId: w.sandboxId, advertiserId: other.id, name: 'Other advertiser list', type: 'LOOKALIKE' },
  });
}, 120_000);
afterAll(async () => {
  await dropWorld(w);
  await prisma.$disconnect();
});

describe('readAudiences scoping (Q5)', () => {
  it('returns only the audiences of the requested advertiser', async () => {
    const mine = await readAudiences(w.sandboxId, w.advertiserId);
    expect(mine?.advertiserId).toBe(w.advertiserId);
    expect(mine!.rows.length).toBeGreaterThan(0);
    expect(mine!.rows.every((r) => r.advertiserId === w.advertiserId)).toBe(true);
    expect(mine!.rows.map((r) => r.name)).not.toContain('Other advertiser list');

    const theirs = await readAudiences(w.sandboxId, otherAdvertiserId);
    expect(theirs!.rows.map((r) => r.name)).toEqual(['Other advertiser list']);
  });

  it('returns nothing for an advertiser id of another sandbox or an unknown id', async () => {
    expect(await readAudiences(w.sandboxId, 'does-not-exist')).toBeNull();
  });
});
