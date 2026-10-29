// Fixtures of the creative db tests: a world with a second exchange that supports video, users of every role,
// a clock helper, and an active line item to assign to.
import { prisma } from '@/lib/db';
import type { SessionUser } from '@/lib/auth/types';
import type { CreativeInput } from '@/lib/validation/types';
import { createWorld, type World } from '../db/helpers';
import { TAG } from './fixtures';

export type { World };

export function userFor(w: World, dvRole: SessionUser['dvRole'] = 'STANDARD'): SessionUser {
  return {
    id: w.userId,
    email: `${w.tag}-user@example.test`,
    name: `User ${w.tag}`,
    appRole: 'user',
    classroomId: w.classroomId,
    sandboxId: w.sandboxId,
    partnerId: w.partnerId,
    dvRole,
  };
}

/** A world with two display and video exchanges enabled. */
export async function createCreativeWorld(tag: string): Promise<World & { exchange2: string }> {
  const w = await createWorld(tag);
  const second = await prisma.exchange.upsert({
    where: { code: 'test-exchange-2' },
    create: {
      code: 'test-exchange-2',
      name: 'Another Exchange',
      supportsVideo: true,
      supportsDisplay: true,
    },
    update: {},
  });
  await prisma.partnerExchange.create({
    data: { sandboxId: w.sandboxId, partnerId: w.partnerId, exchangeId: second.id },
  });
  return { ...w, exchange2: second.id };
}

/** Move the sim clock to `hours` after its start (2026-01-01T00:00Z). */
export async function setSimHours(w: World, hours: number): Promise<void> {
  await prisma.simClock.update({
    where: { sandboxId: w.sandboxId },
    data: { tickIndex: BigInt(hours) },
  });
}

export const tpDisplay = (name: string, over: Partial<CreativeInput> = {}): CreativeInput => ({
  kind: 'THIRD_PARTY_DISPLAY',
  name,
  landingPageUrl: 'https://example.com/landing',
  width: 300,
  height: 250,
  thirdPartyTag: TAG,
  ...over,
});
