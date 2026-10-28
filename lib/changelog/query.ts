// Where-clause for the History readers (data-model 6.4, module 05 4.2 and 4.5).
import type { EntityType, Prisma } from '@prisma/client';

export interface HistoryFilter {
  sandboxId: string;
  /** Exactly one scope: the chain id of the History page, or an entity for creative and deal history. */
  scope:
    | { advertiserId: string }
    | { campaignId: string }
    | { ioId: string }
    | { lineItemId: string }
    | { entityType: EntityType; entityId: string };
  from?: Date;
  to?: Date;
  /** "Include system changes" toggle. Default off: only user changes. */
  includeSystem?: boolean;
  /** Instructor console only: also SIM_SEED groups. */
  includeHidden?: boolean;
}

export function historyWhere(f: HistoryFilter): Prisma.ChangeGroupWhereInput {
  return {
    sandboxId: f.sandboxId,
    ...f.scope,
    ...(f.from || f.to
      ? { occurredAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) } }
      : {}),
    ...(f.includeSystem ? {} : { actorType: 'USER' as const }),
    ...(f.includeHidden ? {} : { isHidden: false }),
  };
}
