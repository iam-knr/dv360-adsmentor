// Bulk-action applicability (validation.md 4.10). One function drives the bulk bar, row menus and the server action.
import { isDimensionAvailable, type MatrixDimension } from '../constants/targeting-availability';
import type { LiType } from '../constants/li-compat';
import { YOUTUBE_LI_TYPES } from '../constants/li-compat';
import type { EntityStatus, RoleKey } from '../types';

export type BulkAction =
  | 'ACTIVATE'
  | 'PAUSE'
  | 'ARCHIVE'
  | 'DUPLICATE'
  | 'APPLY_TEMPLATE'
  | 'EDIT_SETTINGS'
  | 'EDIT_TARGETING'
  | 'EDIT_CREATIVE_ASSIGNMENT'
  | 'SDF_DOWNLOAD'
  | 'SDF_UPLOAD';

export type BulkEntity = 'campaign' | 'insertionOrder' | 'lineItem';

export interface BulkRow {
  status: EntityStatus;
  type?: LiType;
}

export interface BulkActor {
  role: RoleKey;
  limitedAccess?: boolean;
}

export interface BulkOptions {
  entity?: BulkEntity;
  /** For EDIT_TARGETING: the dimension being edited. */
  dimension?: MatrixDimension;
  /** For APPLY_TEMPLATE: the type of the template. */
  templateType?: LiType;
}

export interface Applicability {
  applicable: boolean;
  eligible: number;
  skipped: number;
}

/** Which grids offer which action (4.10 table). */
const ENTITY_ACTIONS: Record<BulkEntity, readonly BulkAction[]> = {
  campaign: ['ACTIVATE', 'PAUSE', 'ARCHIVE', 'DUPLICATE', 'SDF_DOWNLOAD', 'SDF_UPLOAD'],
  insertionOrder: [
    'ACTIVATE',
    'PAUSE',
    'ARCHIVE',
    'DUPLICATE',
    'APPLY_TEMPLATE',
    'EDIT_SETTINGS',
    'EDIT_CREATIVE_ASSIGNMENT',
    'SDF_DOWNLOAD',
    'SDF_UPLOAD',
  ],
  lineItem: [
    'ACTIVATE',
    'PAUSE',
    'ARCHIVE',
    'DUPLICATE',
    'APPLY_TEMPLATE',
    'EDIT_SETTINGS',
    'EDIT_TARGETING',
    'EDIT_CREATIVE_ASSIGNMENT',
    'SDF_DOWNLOAD',
    'SDF_UPLOAD',
  ],
};

const WRITE_ROLES: readonly RoleKey[] = ['ADMIN', 'STANDARD'];

/** Actions that stay enabled for read-only roles and under Limited Access. */
const ALWAYS_ALLOWED: readonly BulkAction[] = ['SDF_DOWNLOAD'];

function isEligible(action: BulkAction, row: BulkRow, opts: BulkOptions): boolean {
  switch (action) {
    case 'ACTIVATE':
      return row.status === 'PAUSED' || row.status === 'DRAFT';
    case 'PAUSE':
      return row.status === 'ACTIVE';
    case 'ARCHIVE':
      return row.status !== 'ARCHIVED';
    case 'DUPLICATE':
    case 'SDF_DOWNLOAD':
    case 'SDF_UPLOAD':
      return true;
    case 'EDIT_SETTINGS':
      return row.status !== 'ARCHIVED';
    case 'APPLY_TEMPLATE':
      return row.status !== 'ARCHIVED' && !!row.type && row.type === opts.templateType;
    case 'EDIT_TARGETING':
      return (
        row.status !== 'ARCHIVED' &&
        !!row.type &&
        (!opts.dimension || isDimensionAvailable(row.type, opts.dimension))
      );
    case 'EDIT_CREATIVE_ASSIGNMENT':
      return (
        row.status !== 'ARCHIVED' &&
        // rows without a type are IOs, whose line items decide later
        (!row.type || (!YOUTUBE_LI_TYPES.includes(row.type) && row.type !== 'DEMAND_GEN'))
      );
  }
}

/**
 * Enabled when at least one selected row is eligible and the actor has write access (Q2). The job runs on
 * the eligible rows and skips the rest; BLK-010 reports how many.
 */
export function applicability(
  action: BulkAction,
  rows: readonly BulkRow[],
  actor: BulkActor = { role: 'STANDARD' },
  opts: BulkOptions = {},
): Applicability {
  const none: Applicability = { applicable: false, eligible: 0, skipped: rows.length };
  if (opts.entity && !ENTITY_ACTIONS[opts.entity].includes(action)) return none;
  if (!ALWAYS_ALLOWED.includes(action)) {
    if (!WRITE_ROLES.includes(actor.role) && actor.role !== 'SYSTEM') return none;
    if (actor.limitedAccess && actor.role !== 'SYSTEM') return none;
  }
  const eligible = rows.filter((row) => isEligible(action, row, opts)).length;
  return { applicable: eligible > 0, eligible, skipped: rows.length - eligible };
}

export function isApplicable(
  action: BulkAction,
  rows: readonly BulkRow[],
  actor?: BulkActor,
  opts?: BulkOptions,
): boolean {
  return applicability(action, rows, actor, opts).applicable;
}
