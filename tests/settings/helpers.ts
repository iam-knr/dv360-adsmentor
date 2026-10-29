// Fixtures of the settings tests: users of each DV360 role in a world, plus a second advertiser and an exchange.
import type { SessionUser } from '@/lib/auth/types';
import { prisma } from '@/lib/db';
import { createWorld, type World } from '../db/helpers';

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

export const adminFor = (w: World) => userFor(w, 'ADMIN');

export async function settingsWorld(tag: string): Promise<World> {
  return createWorld(tag);
}

export async function addExchange(
  code: string,
  over: {
    needsNetworkId?: boolean;
    needsSeatId?: boolean;
    kind?: 'EXCHANGE' | 'APP_MEDIATION_PARTNER';
  } = {},
): Promise<string> {
  const row = await prisma.exchange.upsert({
    where: { code },
    create: { code, name: `Exchange ${code}`, ...over },
    update: {},
  });
  return row.id;
}

export async function addAdvertiser(
  w: World,
  name: string,
  over: { status?: 'ACTIVE' | 'PAUSED'; currencyCode?: string } = {},
) {
  return prisma.advertiser.create({
    data: {
      sandboxId: w.sandboxId,
      partnerId: w.partnerId,
      name,
      websiteUrl: 'https://example.test',
      currencyCode: over.currencyCode ?? 'INR',
      timeZone: 'Asia/Calcutta',
      ...(over.status ? { status: over.status } : {}),
    },
  });
}

/** The groups a person made on an entity, oldest first (the world fixture's own group and fan-out copies are left out). */
export const groupsOf = (entityId: string) =>
  prisma.changeGroup.findMany({
    where: { entityId, source: 'UI', userId: { not: null } },
    orderBy: { occurredAt: 'asc' },
    include: { entries: true },
  });
