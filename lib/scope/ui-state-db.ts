import 'server-only';
// UserPreference and RecentlyViewed are created by P3-05c (prisma/schema/72-*). Until that schema is merged the Prisma
// client has no delegates for them, so the shell reaches them through this narrow, optional view: the code compiles
// either way, and the writes start working as soon as the tables exist. Shapes follow P3-05c and DELTA-01-4/5.
import type { Tx } from '@/lib/db';

type Json = unknown;

export interface UserPreferenceDelegate {
  findMany(args: {
    where: { userId: string };
    select: { key: true; value: true };
  }): Promise<{ key: string; value: Json }[]>;
  upsert(args: {
    where: { userId_sandboxId_key: { userId: string; sandboxId: string; key: string } };
    create: { userId: string; sandboxId: string; key: string; value: Json };
    update: { value: Json };
  }): Promise<unknown>;
}

export interface RecentlyViewedDelegate {
  upsert(args: {
    where: {
      sandboxId_userId_entityType_entityId: {
        sandboxId: string;
        userId: string;
        entityType: string;
        entityId: string;
      };
    };
    create: {
      sandboxId: string;
      userId: string;
      partnerId: string;
      entityType: string;
      entityId: string;
      viewedAt: Date;
    };
    update: { viewedAt: Date; partnerId: string };
  }): Promise<unknown>;
  findMany(args: {
    where: { sandboxId: string; userId: string; entityType: string };
    orderBy: { viewedAt: 'desc' };
    skip: number;
    select: { id: true };
  }): Promise<{ id: string }[]>;
  deleteMany(args: { where: { id: { in: string[] } } }): Promise<unknown>;
}

export function userPreferences(tx: Tx): UserPreferenceDelegate | null {
  return (tx as unknown as { userPreference?: UserPreferenceDelegate }).userPreference ?? null;
}

export function recentlyViewed(tx: Tx): RecentlyViewedDelegate | null {
  return (tx as unknown as { recentlyViewed?: RecentlyViewedDelegate }).recentlyViewed ?? null;
}
