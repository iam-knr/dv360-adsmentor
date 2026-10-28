// Section 4 state tables as data, plus canTransition (validation.md 4.1 to 4.4). Pure.
import type { EntityStatus, RoleKey } from '../types';

export type StatefulKind = 'advertiser' | 'campaign' | 'insertionOrder' | 'lineItem';

export type AnyStatus = EntityStatus | 'SCHEDULED_FOR_DELETION';

export interface Transition {
  from: AnyStatus | 'CREATE';
  to: AnyStatus;
  /** Roles that may do it. `SYSTEM` is the engine; students are `STANDARD`. */
  roles: readonly RoleKey[];
  /** Needs the parent chain to be un-archived (IO-091, LI-111, unarchive rows). */
  needsLiveParent?: boolean;
}

const WRITERS: readonly RoleKey[] = ['ADMIN', 'STANDARD'];
const ADMIN_ONLY: readonly RoleKey[] = ['ADMIN'];

export const TRANSITIONS: Record<StatefulKind, readonly Transition[]> = {
  // 4.1
  advertiser: [
    { from: 'CREATE', to: 'ACTIVE', roles: WRITERS },
    { from: 'ACTIVE', to: 'PAUSED', roles: WRITERS },
    { from: 'PAUSED', to: 'ACTIVE', roles: WRITERS },
    { from: 'ACTIVE', to: 'SCHEDULED_FOR_DELETION', roles: ADMIN_ONLY },
    { from: 'PAUSED', to: 'SCHEDULED_FOR_DELETION', roles: ADMIN_ONLY },
    { from: 'SCHEDULED_FOR_DELETION', to: 'ACTIVE', roles: ADMIN_ONLY },
    { from: 'SCHEDULED_FOR_DELETION', to: 'PAUSED', roles: ADMIN_ONLY },
  ],
  // 4.2: no Draft
  campaign: [
    { from: 'CREATE', to: 'ACTIVE', roles: WRITERS },
    { from: 'CREATE', to: 'PAUSED', roles: WRITERS },
    { from: 'ACTIVE', to: 'PAUSED', roles: WRITERS },
    { from: 'PAUSED', to: 'ACTIVE', roles: WRITERS },
    { from: 'ACTIVE', to: 'ARCHIVED', roles: WRITERS },
    { from: 'PAUSED', to: 'ARCHIVED', roles: WRITERS },
    { from: 'ARCHIVED', to: 'PAUSED', roles: WRITERS },
  ],
  // 4.3: Draft to Paused is not offered; create accepts Draft or Active only (RC-040)
  insertionOrder: [
    { from: 'CREATE', to: 'DRAFT', roles: WRITERS },
    { from: 'CREATE', to: 'ACTIVE', roles: WRITERS },
    { from: 'DRAFT', to: 'ACTIVE', roles: WRITERS, needsLiveParent: true },
    { from: 'ACTIVE', to: 'PAUSED', roles: WRITERS },
    { from: 'PAUSED', to: 'ACTIVE', roles: WRITERS, needsLiveParent: true },
    { from: 'DRAFT', to: 'ARCHIVED', roles: WRITERS },
    { from: 'ACTIVE', to: 'ARCHIVED', roles: WRITERS },
    { from: 'PAUSED', to: 'ARCHIVED', roles: WRITERS },
    { from: 'ARCHIVED', to: 'PAUSED', roles: WRITERS, needsLiveParent: true },
  ],
  // 4.4: the same table as the IO, with LI-110 and LI-111 as guards
  lineItem: [
    { from: 'CREATE', to: 'DRAFT', roles: WRITERS },
    { from: 'CREATE', to: 'ACTIVE', roles: WRITERS },
    { from: 'DRAFT', to: 'ACTIVE', roles: WRITERS, needsLiveParent: true },
    { from: 'ACTIVE', to: 'PAUSED', roles: WRITERS },
    { from: 'PAUSED', to: 'ACTIVE', roles: WRITERS, needsLiveParent: true },
    { from: 'DRAFT', to: 'ARCHIVED', roles: WRITERS },
    { from: 'ACTIVE', to: 'ARCHIVED', roles: WRITERS },
    { from: 'PAUSED', to: 'ARCHIVED', roles: WRITERS },
    { from: 'ARCHIVED', to: 'PAUSED', roles: WRITERS, needsLiveParent: true },
  ],
};

export type TransitionDenial =
  /** The table has no such row (Draft to Paused, Archived to Active, ...). */
  | 'NOT_OFFERED'
  /** The actor's role may not do it. */
  | 'ROLE'
  /** Limited Access greys every edit item. */
  | 'LIMITED_ACCESS'
  /** A parent (IO, campaign) is archived. IO-091, LI-111. */
  | 'PARENT_ARCHIVED';

export type TransitionResult = { ok: true } | { ok: false; reason: TransitionDenial; ruleId?: string };

export interface TransitionActor {
  role: RoleKey;
  limitedAccess?: boolean;
}

export interface TransitionParents {
  campaignArchived?: boolean;
  ioArchived?: boolean;
}

const PARENT_RULE: Partial<Record<StatefulKind, string>> = {
  insertionOrder: 'IO-091',
  lineItem: 'LI-111',
};

/**
 * Whether `from` to `to` is a legal move for this actor. Rule guards (IO-090..IO-092, LI-110) are validation
 * issues and are run by `validate(..., { targetStatus: 'ACTIVE' })`, not here.
 */
export function canTransition(
  kind: StatefulKind,
  from: AnyStatus | 'CREATE',
  to: AnyStatus,
  actor: TransitionActor,
  parents: TransitionParents = {},
): TransitionResult {
  const row = TRANSITIONS[kind].find((t) => t.from === from && t.to === to);
  if (!row) return { ok: false, reason: 'NOT_OFFERED' };
  if (!row.roles.includes(actor.role)) return { ok: false, reason: 'ROLE' };
  if (actor.limitedAccess && actor.role !== 'SYSTEM') return { ok: false, reason: 'LIMITED_ACCESS' };
  if (row.needsLiveParent && (parents.campaignArchived || parents.ioArchived)) {
    const ruleId = PARENT_RULE[kind];
    return ruleId ? { ok: false, reason: 'PARENT_ARCHIVED', ruleId } : { ok: false, reason: 'PARENT_ARCHIVED' };
  }
  return { ok: true };
}

/** Statuses a user can move to from `from`, for the status chip and row menus. */
export function offeredTransitions(
  kind: StatefulKind,
  from: AnyStatus,
  actor: TransitionActor,
  parents: TransitionParents = {},
): AnyStatus[] {
  return TRANSITIONS[kind]
    .filter((t) => t.from === from)
    .filter((t) => canTransition(kind, from, t.to, actor, parents).ok)
    .map((t) => t.to);
}
