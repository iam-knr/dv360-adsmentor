// Bulk menu capabilities (module 11 K1, validation.md 4.10). Pure and client safe: the grid computes the menu from
// the rows it already holds, and `GET .../bulk-capabilities` runs the same function on the server.
import {
  applicability,
  type BulkAction as StateAction,
  type BulkRow,
} from '@/lib/validation/state/bulk';
import { MATRIX_TO_DM } from '@/lib/validation/constants/targeting-availability';
import type { EntityStatus, LiType, RoleKey } from '@/lib/validation/types';
import type { BulkEntityKey } from './entities';
import type { BulkCapabilities, BulkCapability, BulkOp, BulkTargetingDimension } from './types';

export interface CapRow {
  id: string;
  status: EntityStatus;
  type?: LiType;
}

/** Targeting dimensions of the three submenus (2.2), keyed by MX-10 label. */
export const TARGETING_MENU: Record<'CONTENT' | 'AUDIENCE' | 'TECHNOLOGY', { dimension: BulkTargetingDimension; label: string }[]> = {
  CONTENT: [
    { dimension: 'APPS_URLS', label: 'Apps & URLs' },
    { dimension: 'KEYWORDS', label: 'Keywords' },
    { dimension: 'CATEGORIES', label: 'Categories' },
    { dimension: 'ENVIRONMENT', label: 'Environment' },
    { dimension: 'POSITION', label: 'Position' },
    { dimension: 'VIEWABILITY', label: 'Viewability' },
    { dimension: 'LANGUAGE', label: 'Language' },
  ],
  AUDIENCE: [
    { dimension: 'AUDIENCE_LISTS', label: 'Audience lists' },
    { dimension: 'GEOGRAPHY', label: 'Geography' },
    { dimension: 'DAY_TIME', label: 'Day & time' },
    { dimension: 'DEMOGRAPHICS', label: 'Demographics' },
  ],
  TECHNOLOGY: [
    { dimension: 'BROWSER', label: 'Browser' },
    { dimension: 'DEVICE', label: 'Device' },
    { dimension: 'CONNECTION_SPEED', label: 'Connection speed' },
    { dimension: 'CARRIER_ISP', label: 'Carrier & ISP' },
  ],
};

export const INVENTORY_MENU: { dimension: BulkTargetingDimension; label: string; disabled?: string }[] = [
  {
    dimension: 'EXCHANGES',
    label: 'Public inventory',
    disabled: 'Exchanges are set for the whole partner in this simulator.',
  },
  { dimension: 'DEALS', label: 'Deals and packages' },
  { dimension: 'DEAL_GROUPS', label: 'Deal groups' },
  { dimension: 'INVENTORY_QUALITY', label: 'Inventory quality' },
];

const STATE_ACTION: Partial<Record<BulkOp, StateAction>> = {
  ACTIVATE: 'ACTIVATE',
  PAUSE: 'PAUSE',
  ARCHIVE: 'ARCHIVE',
  DUPLICATE: 'DUPLICATE',
  APPLY_TARGETING_TEMPLATE: 'APPLY_TEMPLATE',
  EDIT_SETTINGS: 'EDIT_SETTINGS',
  EDIT_TARGETING: 'EDIT_TARGETING',
  EDIT_CREATIVE_ASSIGNMENT: 'EDIT_CREATIVE_ASSIGNMENT',
};

const toRow = (r: CapRow): BulkRow => ({ status: r.status, ...(r.type ? { type: r.type } : {}) });

/** Which operations each grid offers (2.2 table). */
export const OFFERED: Record<BulkEntityKey, readonly BulkOp[]> = {
  campaign: ['ACTIVATE', 'PAUSE', 'ARCHIVE', 'UNARCHIVE', 'DUPLICATE'],
  insertionOrder: [
    'ACTIVATE',
    'PAUSE',
    'ARCHIVE',
    'UNARCHIVE',
    'DUPLICATE',
    'APPLY_TARGETING_TEMPLATE',
    'EDIT_SETTINGS',
    'EDIT_CREATIVE_ASSIGNMENT',
  ],
  lineItem: [
    'ACTIVATE',
    'PAUSE',
    'ARCHIVE',
    'UNARCHIVE',
    'DUPLICATE',
    'APPLY_TARGETING_TEMPLATE',
    'EDIT_SETTINGS',
    'EDIT_CREATIVE_ASSIGNMENT',
  ],
};

/** Whether one row can take the operation. UNARCHIVE is not in the shared table: only archived rows. */
export function isEligibleFor(
  op: BulkOp,
  entity: BulkEntityKey,
  row: CapRow,
  opts: { templateType?: LiType; dimension?: BulkTargetingDimension } = {},
): boolean {
  if (op === 'UNARCHIVE') return row.status === 'ARCHIVED';
  // an insertion order passes a template on to its line items of the template's type
  if (op === 'APPLY_TARGETING_TEMPLATE' && entity === 'insertionOrder')
    return row.status !== 'ARCHIVED';
  const action = STATE_ACTION[op];
  if (!action) return false;
  return applicability(
    action,
    [toRow(row)],
    { role: 'STANDARD' },
    {
      entity,
      ...(opts.templateType ? { templateType: opts.templateType } : {}),
      ...(opts.dimension && opts.dimension in MATRIX_TO_DM
        ? { dimension: opts.dimension as never }
        : {}),
    },
  ).applicable;
}

const REASON: Partial<Record<BulkOp, string>> = {
  ACTIVATE: 'Every selected item is already active.',
  PAUSE: 'None of the selected items is active.',
  UNARCHIVE: 'None of the selected items is archived.',
};

/** K1. Enabled iff at least one selected row is eligible and the person may write (Q2). */
export function computeCapabilities(
  entity: BulkEntityKey,
  rows: readonly CapRow[],
  actor: { role: RoleKey; limitedAccess?: boolean },
): BulkCapabilities {
  const writer = (actor.role === 'ADMIN' || actor.role === 'STANDARD') && !actor.limitedAccess;
  const actions: Record<string, BulkCapability> = {};
  const put = (key: string, eligible: number, reason?: string) => {
    const enabled = writer && eligible > 0;
    actions[key] = {
      enabled,
      eligible: writer ? eligible : 0,
      ...(!enabled ? { reason: !writer ? "You don't have permission to edit." : reason } : {}),
    };
  };
  for (const op of OFFERED[entity]) {
    const eligible = rows.filter((r) => isEligibleFor(op, entity, r)).length;
    put(op, eligible, REASON[op]);
  }
  if (entity === 'lineItem') {
    const all = [...TARGETING_MENU.CONTENT, ...TARGETING_MENU.AUDIENCE, ...TARGETING_MENU.TECHNOLOGY];
    for (const { dimension } of all) {
      const eligible = rows.filter((r) => isEligibleFor('EDIT_TARGETING', entity, r, { dimension })).length;
      put(`EDIT_TARGETING:${dimension}`, eligible, 'This setting is not available for the selected line item types.');
    }
    const open = rows.filter((r) => r.status !== 'ARCHIVED').length;
    for (const { dimension, disabled } of INVENTORY_MENU)
      put(`EDIT_TARGETING:${dimension}`, disabled ? 0 : open, disabled);
  }
  // SDF download stays enabled for read-only roles (4.10)
  actions.SDF_DOWNLOAD = { enabled: true, eligible: rows.length };
  actions.SDF_UPLOAD = { enabled: writer, eligible: writer ? rows.length : 0 };
  return { ids: rows.map((r) => r.id), actions };
}
