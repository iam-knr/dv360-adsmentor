// Deal state table (validation.md 4.7) as data. Pure. `COMPLETED` and `NOT_SERVABLE` are derived by the system and
// never stored (the column is an EntityStatus); see `effectiveDealStatus`.
import { INV_MSG } from './messages';

export type DealStatusKey =
  'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'COMPLETED' | 'NOT_SERVABLE';
export type DealAction = 'ACTIVATE' | 'PAUSE' | 'ARCHIVE' | 'UNARCHIVE';
export type DealActor = 'USER' | 'SYSTEM';

export const DEAL_STATUS_LABEL: Record<DealStatusKey, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  ARCHIVED: 'Archived',
  COMPLETED: 'Completed',
  NOT_SERVABLE: 'Not servable',
};

export const DEFAULT_DEAL_STATUSES: DealStatusKey[] = [
  'ACTIVE',
  'PAUSED',
  'DRAFT',
  'COMPLETED',
  'NOT_SERVABLE',
];

interface Row {
  from: DealStatusKey;
  to: DealStatusKey;
  action: DealAction | null;
  actor: DealActor;
}

export const DEAL_TRANSITIONS: readonly Row[] = [
  { from: 'DRAFT', to: 'ACTIVE', action: 'ACTIVATE', actor: 'USER' },
  { from: 'ACTIVE', to: 'PAUSED', action: 'PAUSE', actor: 'USER' },
  { from: 'PAUSED', to: 'ACTIVE', action: 'ACTIVATE', actor: 'USER' },
  { from: 'ACTIVE', to: 'ARCHIVED', action: 'ARCHIVE', actor: 'USER' },
  { from: 'PAUSED', to: 'ARCHIVED', action: 'ARCHIVE', actor: 'USER' },
  { from: 'ARCHIVED', to: 'PAUSED', action: 'UNARCHIVE', actor: 'USER' },
  { from: 'ACTIVE', to: 'COMPLETED', action: null, actor: 'SYSTEM' },
  { from: 'ACTIVE', to: 'NOT_SERVABLE', action: null, actor: 'SYSTEM' },
  { from: 'NOT_SERVABLE', to: 'ACTIVE', action: null, actor: 'SYSTEM' },
];

export type TransitionCheck =
  | { ok: true; to: DealStatusKey }
  | { ok: false; ruleId: 'INV-013' | 'INV-014' | 'INV-010'; message: string };

/** The status a user action leads to, or the rule that refuses it (INV-010, INV-013, INV-014). */
export function checkDealAction(
  from: DealStatusKey,
  action: DealAction,
  ctx: { allowPausing: boolean; canWriteAll: boolean },
): TransitionCheck {
  if (!ctx.canWriteAll) return { ok: false, ruleId: 'INV-010', message: INV_MSG.NOT_WRITER };
  const row = DEAL_TRANSITIONS.find(
    (t) => t.actor === 'USER' && t.from === from && t.action === action,
  );
  if (!row) return { ok: false, ruleId: 'INV-013', message: INV_MSG.STATUS_NOT_ALLOWED };
  if (action === 'PAUSE' && !ctx.allowPausing)
    return { ok: false, ruleId: 'INV-014', message: INV_MSG.NO_PAUSE };
  return { ok: true, to: row.to };
}

/** Actions the status menu offers for a status (the menu hides what the table forbids). */
export function dealActionsFor(from: DealStatusKey): DealAction[] {
  return DEAL_TRANSITIONS.filter((t) => t.actor === 'USER' && t.from === from).map(
    (t) => t.action as DealAction,
  );
}

/**
 * The status the grid and the deal page show. Stored `ACTIVE` becomes `COMPLETED` after the end date (or when a
 * guaranteed deal delivered its quantity) and `NOT_SERVABLE` while the deal's exchange is disabled at the partner.
 */
export function effectiveDealStatus(
  deal: {
    status: string;
    endAt: Date;
    exchangeEnabled: boolean;
    quantityImpressions?: bigint | number | null;
    deliveredImpressions?: bigint | number | null;
    commitment?: 'GUARANTEED' | 'NON_GUARANTEED';
  },
  simNow: Date,
): DealStatusKey {
  if (deal.status !== 'ACTIVE')
    return deal.status === 'SCHEDULED_FOR_DELETION' ? 'ARCHIVED' : (deal.status as DealStatusKey);
  if (deal.endAt.getTime() < simNow.getTime()) return 'COMPLETED';
  if (
    deal.commitment === 'GUARANTEED' &&
    deal.quantityImpressions != null &&
    deal.deliveredImpressions != null &&
    Number(deal.deliveredImpressions) >= Number(deal.quantityImpressions)
  )
    return 'COMPLETED';
  if (!deal.exchangeEnabled) return 'NOT_SERVABLE';
  return 'ACTIVE';
}
