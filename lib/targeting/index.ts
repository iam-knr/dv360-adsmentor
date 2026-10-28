import type { Prisma, PrismaClient } from '@prisma/client';

export interface TargetingState {
  version: 1;
  lineItemType: string;
  criteria: Record<string, unknown>;
}

export function emptyTargetingState(type: string): TargetingState {
  return { version: 1, lineItemType: type, criteria: {} };
}

type Db = PrismaClient | Prisma.TransactionClient;

/** Stub (P3-07a replaces it). */
export async function loadTargetingState(_db: Db, _liId: string): Promise<TargetingState> {
  return await Promise.resolve(emptyTargetingState('unknown'));
}

/** Stub (P3-07a replaces it): no-op. */
export async function persistTargeting(
  _tx: Prisma.TransactionClient,
  _liId: string,
  _state: TargetingState,
): Promise<void> {
  await Promise.resolve();
}
