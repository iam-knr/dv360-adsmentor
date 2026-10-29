// Audience lifecycle (module 14 4.3, Δ14-13 `advanceAudiences`): a list created PROCESSING becomes ACTIVE when its
// `availableAt` passes and its sizes are written. The target sizes are decided at creation (deterministic, stored in
// `config.targetSizes`), so the engine tick only flips the state and copies them. Called from the engine persist step
// and lazily from the audience services, so a list is never stuck when nobody runs a tick.
import type { Prisma } from '@prisma/client';
import type { Tx } from '@/lib/db';
import type { SizeMap } from './sizes';

export interface AudienceConfig {
  targetSizes?: SizeMap;
  /** YouTube users */
  linkedAccountId?: string;
  action?: string;
  videoIds?: string[];
  /** Engine: delivery restricted (seeded story) */
  restricted?: boolean;
  /** Combined: members for recomputation */
  contactType?: string;
  [k: string]: unknown;
}

export function configOf(value: Prisma.JsonValue | null | undefined): AudienceConfig {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as AudienceConfig) : {};
}

/** Flip due lists to ACTIVE and write their sizes. Returns how many rows changed. */
export async function advanceAudiences(
  tx: Tx,
  sandboxId: string,
  advertiserId: string | null,
  atMs: number,
): Promise<number> {
  const due = await tx.audience.findMany({
    where: {
      sandboxId,
      ...(advertiserId ? { advertiserId } : {}),
      status: 'PROCESSING',
      availableAt: { lte: new Date(atMs) },
    },
    select: { id: true, config: true },
  });
  for (const a of due) {
    const t = configOf(a.config).targetSizes;
    await tx.audience.update({
      where: { id: a.id },
      data: {
        status: 'ACTIVE',
        ...(t
          ? {
              sizeDisplay: BigInt(t.display),
              sizeYoutube: BigInt(t.youtube),
              sizeMobileApp: BigInt(t.mobileApp),
              sizeCtv: BigInt(t.ctv),
            }
          : {}),
      },
    });
  }
  return due.length;
}
