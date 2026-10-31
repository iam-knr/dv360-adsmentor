// Lift studies and experiments need a YouTube line item on the advertiser the student works in: every advertiser of the
// seeded sandbox has one.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { provisionSandbox } from '@/lib/seed/sandbox';
import { createEnv, dropEnv, TODAY, type Env } from '../engine-io/fixtures';

let env: Env;
let sandboxId: string;

beforeAll(async () => {
  env = await createEnv(1, 'ytseed');
  const r = await provisionSandbox(prisma, {
    classroomId: env.classroomId,
    ownerUserId: null,
    name: 'YT seed lab',
    template: 'troubleshooting-lab',
    kind: 'DEMO',
    seedValue: 9301,
    partnerName: 'Sandbox YT-LAB',
    today: TODAY,
  });
  sandboxId = r.sandboxId;
  env.sandboxIds.push(sandboxId);
}, 600_000);
afterAll(async () => {
  await dropEnv(env);
  await prisma.$disconnect();
});

describe('YouTube seed per advertiser', () => {
  it('gives every advertiser a YouTube line item', async () => {
    const advertisers = await prisma.advertiser.findMany({
      where: { sandboxId },
      orderBy: { name: 'asc' },
    });
    expect(advertisers.length).toBeGreaterThan(1);
    for (const adv of advertisers) {
      const yt = await prisma.lineItem.count({ where: { advertiserId: adv.id, type: 'YT_VIDEO' } });
      expect(yt, adv.name).toBeGreaterThan(0);
    }
  });
});
