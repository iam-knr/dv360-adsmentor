import 'server-only';

// buildContext(loader, kind, ids, actor) to ValidationContext (validation.md 6.2, 6.6).
// The database is reached through a ContextLoader, so the Prisma-backed one lives with the services of
// P3-06b and P3-06c (the tables arrive with P3-05a). A rule never reads the database.
import type {
  AdvertiserSnapshot,
  CampaignSnapshot,
  IoSnapshot,
  PartnerSnapshot,
  RoleKey,
  ValidationContext,
} from '../types';

export type ContextKind = 'campaign' | 'insertionOrder' | 'lineItem';

export interface ContextIds {
  /** Set when editing; absent when creating. */
  id?: string;
  advertiserId: string;
  campaignId?: string;
  ioId?: string;
}

export interface ContextActor {
  userId: string;
  role: RoleKey;
  limitedAccess?: boolean;
}

/** Everything buildContext needs from storage. Methods return plain DTOs. */
export interface ContextLoader {
  now(): Date;
  partner(ids: ContextIds): Promise<PartnerSnapshot>;
  advertiser(ids: ContextIds): Promise<AdvertiserSnapshot>;
  campaign(ids: ContextIds): Promise<CampaignSnapshot | undefined>;
  io(ids: ContextIds): Promise<IoSnapshot | undefined>;
  /** The stored entity, for lock rules. Only called in edit mode. */
  original(kind: ContextKind, ids: ContextIds): Promise<unknown>;
  children(kind: ContextKind, ids: ContextIds): Promise<ValidationContext['children'] | undefined>;
  lookups(kind: ContextKind, ids: ContextIds): Promise<ValidationContext['lookups']>;
}

export interface BuildContextOptions {
  source?: ValidationContext['source'];
  disabledRules?: readonly string[];
}

/** Loads the parents, children and lookups a kind needs and assembles the context. */
export async function buildContext(
  loader: ContextLoader,
  kind: ContextKind,
  ids: ContextIds,
  actor: ContextActor,
  options: BuildContextOptions = {},
): Promise<ValidationContext> {
  const mode: ValidationContext['mode'] = ids.id ? 'edit' : 'create';
  const needsCampaign = kind !== 'lineItem' || ids.campaignId !== undefined;
  const needsIo = kind === 'lineItem';
  const [partner, advertiser, campaign, io, original, children, lookups] = await Promise.all([
    loader.partner(ids),
    loader.advertiser(ids),
    needsCampaign ? loader.campaign(ids) : Promise.resolve(undefined),
    needsIo ? loader.io(ids) : Promise.resolve(undefined),
    mode === 'edit' ? loader.original(kind, ids) : Promise.resolve(undefined),
    kind === 'insertionOrder' ? loader.children(kind, ids) : Promise.resolve(undefined),
    loader.lookups(kind, ids),
  ]);
  return {
    mode,
    now: loader.now(),
    actor: { userId: actor.userId, role: actor.role, limitedAccess: actor.limitedAccess ?? false },
    ...(options.source ? { source: options.source } : {}),
    ...(original !== undefined ? { original } : {}),
    partner,
    advertiser,
    ...(campaign ? { campaign } : {}),
    ...(io ? { io } : {}),
    ...(children ? { children } : {}),
    ...(options.disabledRules ? { disabledRules: options.disabledRules } : {}),
    lookups,
  };
}
