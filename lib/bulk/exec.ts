import 'server-only';
// One item of a bulk job (module 11 4.1 K2..K8): the same service the form calls, one entity at a time, so the
// validation, the state machine and `withChangeLog` are the single code path. Returns an outcome, never throws for
// a rule failure; infrastructure errors propagate to the worker, which records the item as failed.
import type { SessionUser } from '@/lib/auth/types';
import { withChangeLog } from '@/lib/changelog';
import { ambientChange } from '@/lib/changelog/ambient';
import { withSandbox } from '@/lib/db';
import { archiveCampaigns, setCampaignStatus } from '@/lib/campaigns/service';
import { changeCtx, serviceCtx, ServiceFailure } from '@/lib/campaigns/service-kit';
import {
  getInsertionOrder,
  archiveInsertionOrders,
  setIoStatus,
  updateInsertionOrder,
} from '@/lib/insertion-orders/service';
import {
  assignCreatives,
  getLineItemDetail,
  setLineItemStatus,
  updateLineItem,
} from '@/lib/line-items/service';
import { YOUTUBE_LI_TYPES, type LiType } from '@/lib/validation/constants/li-compat';
import { applyTemplateToTargeting, loadTemplateState } from '@/lib/targeting';
import { parseIdRef, whereId } from '@/lib/routes/params';
import { duplicateEntity, DuplicateFailure } from './duplicate';
import { BLK_012, NOT_ELIGIBLE, NOT_FOUND } from './messages';
import { isEligibleFor } from './capabilities';
import { applyTargetingEdit, type TargetingEditValue } from './targeting-edit';
import type { BulkEntityKey } from './entities';
import type {
  BulkItemOutcome,
  BulkParams,
  BulkTargetingDimension,
  IoSettingsPatch,
  LiSettingsPatch,
} from './types';

export interface RowInfo {
  id: string;
  publicId: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  type?: LiType;
  name: string;
  advertiserId: string;
  /** Public id of the parent (advertiser, campaign, insertion order), for the Duplicating description. */
  parentPublicId: string;
}

const norm = <T extends { status: string }>(s: T['status']) =>
  (s === 'SCHEDULED_FOR_DELETION' ? 'ARCHIVED' : s) as RowInfo['status'];

/** Rows in selection order; `null` for ids that do not exist in the sandbox. */
export async function loadRows(
  user: SessionUser,
  entity: BulkEntityKey,
  ids: readonly string[],
): Promise<(RowInfo | null)[]> {
  const ctx = await serviceCtx(user);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const out: (RowInfo | null)[] = [];
    for (const raw of ids) {
      const ref = parseIdRef(raw);
      if (!ref) {
        out.push(null);
        continue;
      }
      if (entity === 'campaign') {
        const r = await tx.campaign.findFirst({
          where: whereId(ref),
          include: { advertiser: { select: { publicId: true } } },
        });
        out.push(
          r && {
            id: r.id,
            publicId: r.publicId.toString(),
            status: norm(r.status),
            name: r.name,
            advertiserId: r.advertiserId,
            parentPublicId: r.advertiser.publicId.toString(),
          },
        );
      } else if (entity === 'insertionOrder') {
        const r = await tx.insertionOrder.findFirst({
          where: whereId(ref),
          include: { campaign: { select: { publicId: true } } },
        });
        out.push(
          r && {
            id: r.id,
            publicId: r.publicId.toString(),
            status: norm(r.status),
            name: r.name,
            advertiserId: r.advertiserId,
            parentPublicId: r.campaign.publicId.toString(),
          },
        );
      } else {
        const r = await tx.lineItem.findFirst({
          where: whereId(ref),
          include: { io: { select: { publicId: true } } },
        });
        out.push(
          r && {
            id: r.id,
            publicId: r.publicId.toString(),
            status: norm(r.status),
            type: r.type,
            name: r.name,
            advertiserId: r.advertiserId,
            parentPublicId: r.io.publicId.toString(),
          },
        );
      }
    }
    return out;
  });
}

type Loose = {
  ok: boolean;
  issues?: { message: string; code?: string; ruleId?: string }[];
  code?: string;
};

function outcome(index: number, row: RowInfo, res: Loose, resultEntityId?: string): BulkItemOutcome {
  if (res.ok)
    return {
      index,
      entityId: row.publicId,
      status: 'OK',
      ...(resultEntityId ? { resultEntityId } : {}),
    };
  const first = res.issues?.[0];
  return {
    index,
    entityId: row.publicId,
    status: 'FAILED',
    message: first?.message ?? (res.code === 'FORBIDDEN' ? "You don't have permission to edit." : 'The change was not saved.'),
    ruleId: first?.ruleId ?? first?.code ?? res.code ?? 'BLK-005',
  };
}

const failed = (index: number, row: RowInfo, message: string, ruleId: string): BulkItemOutcome => ({
  index,
  entityId: row.publicId,
  status: 'FAILED',
  message,
  ruleId,
});

// ---------------------------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------------------------

async function editIoSettings(user: SessionUser, row: RowInfo, patch: IoSettingsPatch) {
  const detail = await getInsertionOrder(user, row.id);
  const value = structuredClone(detail.value);
  if (patch.pacing)
    value.pacing = { ...value.pacing, ...patch.pacing, dailyAmount: patch.pacing.dailyAmount ?? '' };
  if (patch.frequencyCap) value.frequencyCap = { ...value.frequencyCap, ...patch.frequencyCap };
  if (patch.autoBudgetAllocation !== undefined)
    value.optimization = { ...value.optimization, autoBudgetAllocation: patch.autoBudgetAllocation };
  if (patch.integrationCode !== undefined) value.integrationCode = patch.integrationCode;
  return updateInsertionOrder(user, row.id, value, { expectedVersion: detail.version });
}

async function editLiSettings(user: SessionUser, row: RowInfo, patch: LiSettingsPatch) {
  const detail = await getLineItemDetail(user, row.id);
  if (!detail) throw new ServiceFailure('NOT_FOUND');
  const value = structuredClone(detail.value);
  if (patch.pacing)
    value.pacing = { ...value.pacing, ...patch.pacing, dailyAmount: patch.pacing.dailyAmount ?? null };
  if (patch.frequencyCap)
    value.frequencyCap = {
      ...value.frequencyCap,
      ...patch.frequencyCap,
      maxImpressions: patch.frequencyCap.maxImpressions === '' ? null : (patch.frequencyCap.maxImpressions ?? value.frequencyCap.maxImpressions),
      periodCount: patch.frequencyCap.periodCount === '' ? null : (patch.frequencyCap.periodCount ?? value.frequencyCap.periodCount),
      period: patch.frequencyCap.period ?? value.frequencyCap.period,
    };
  if (patch.fixedBid !== undefined) {
    if (value.bid.mode !== 'FIXED')
      return { ok: false as const, issues: [{ message: 'Fixed bid applies to line items on a fixed bid strategy.', ruleId: 'LI-040' }] };
    value.bid = { ...value.bid, fixedCpm: patch.fixedBid };
  }
  if (patch.inventoryQuality !== undefined)
    value.inventory = { ...value.inventory, quality: patch.inventoryQuality as typeof value.inventory.quality };
  if (patch.integrationCode !== undefined) value.integrationCode = patch.integrationCode;
  if (patch.creativeOptimization !== undefined) value.creativeOptimization = patch.creativeOptimization;
  if (patch.optimizedTargeting !== undefined) value.optimizedTargeting = patch.optimizedTargeting;
  return updateLineItem(user, row.id, value, { expectedVersion: detail.version });
}

// ---------------------------------------------------------------------------------------------
// Targeting, inventory, template
// ---------------------------------------------------------------------------------------------

async function editInventory(
  user: SessionUser,
  row: RowInfo,
  dimension: 'DEALS' | 'DEAL_GROUPS',
  mode: 'ADD' | 'REPLACE' | 'REMOVE',
  ids: string[],
) {
  const ctx = await serviceCtx(user);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const li = await tx.lineItem.findUnique({ where: { id: row.id } });
    if (!li) return { ok: false as const, issues: [{ message: NOT_FOUND('lineItem') }] };
    const kinds = dimension === 'DEALS' ? (['DEAL', 'PACKAGE'] as const) : (['GROUP'] as const);
    await withChangeLog(
      { ...changeCtx(ctx, tx), tx },
      {
        type: 'LINE_ITEM',
        id: li.id,
        chain: { advertiserId: li.advertiserId, campaignId: li.campaignId, ioId: li.ioId, lineItemId: li.id },
      },
      async (t) => {
        const own = await t.lineItemInventory.findMany({
          where: { lineItemId: li.id, kind: { in: [...kinds] } },
        });
        const kindOf = () => (dimension === 'DEAL_GROUPS' ? 'GROUP' : 'DEAL');
        if (mode === 'REMOVE' || mode === 'REPLACE') {
          const drop = mode === 'REPLACE' ? own : own.filter((r) => ids.includes(r.refId));
          if (drop.length)
            await t.lineItemInventory.deleteMany({ where: { id: { in: drop.map((r) => r.id) } } });
        }
        if (mode === 'ADD' || mode === 'REPLACE') {
          const have = new Set(own.map((r) => r.refId));
          const add = mode === 'REPLACE' ? ids : ids.filter((id) => !have.has(id));
          for (const refId of add)
            await t.lineItemInventory.upsert({
              where: { lineItemId_kind_refId: { lineItemId: li.id, kind: kindOf(), refId } },
              create: { sandboxId: ctx.sandboxId, lineItemId: li.id, kind: kindOf(), refId },
              update: {},
            });
        }
        return { id: li.id };
      },
    );
    return { ok: true as const };
  });
}

async function editTargeting(user: SessionUser, row: RowInfo, params: Extract<BulkParams, { op: 'EDIT_TARGETING' }>) {
  const { dimension, mode, value } = params.edit;
  if (dimension === 'DEALS' || dimension === 'DEAL_GROUPS')
    return editInventory(user, row, dimension, mode, (value as { ids?: string[] })?.ids ?? []);
  const detail = await getLineItemDetail(user, row.id);
  if (!detail) throw new ServiceFailure('NOT_FOUND');
  const next = structuredClone(detail.value);
  if (dimension === 'INVENTORY_QUALITY') {
    next.inventory = { ...next.inventory, quality: (value as { quality: string }).quality as typeof next.inventory.quality };
  } else if (dimension === 'EXCHANGES') {
    return { ok: false as const, issues: [{ message: 'Exchanges are set for the whole partner in this simulator.', ruleId: 'BLK-011' }] };
  } else {
    next.targetingState = applyTargetingEdit(next.targetingState, dimension, mode, value as TargetingEditValue);
  }
  return updateLineItem(user, row.id, next, { expectedVersion: detail.version });
}

async function applyTemplate(user: SessionUser, row: RowInfo, templateId: string) {
  const ctx = await serviceCtx(user);
  const tpl = await withSandbox(ctx.sandboxId, (tx) => loadTemplateState(tx, templateId));
  if (!tpl) return { ok: false as const, issues: [{ message: 'The template was not found.', ruleId: 'TPL-007' }] };
  if (row.type !== tpl.lineItemType)
    return { ok: false as const, issues: [{ message: BLK_012(1, tpl.lineItemType), ruleId: 'BLK-012' }] };
  const detail = await getLineItemDetail(user, row.id);
  if (!detail) throw new ServiceFailure('NOT_FOUND');
  const next = structuredClone(detail.value);
  const applied = applyTemplateToTargeting(next.targetingState, { id: templateId, criteria: tpl.state.criteria });
  next.targetingState = applied.state;
  next.targeting = { ...next.targeting, templateId };
  next.optimizedTargeting = tpl.optimizedTargeting;
  return updateLineItem(user, row.id, next, { expectedVersion: detail.version });
}

async function editCreativeAssignment(
  user: SessionUser,
  index: number,
  row: RowInfo,
  entity: BulkEntityKey,
  change: { add?: string[]; remove?: string[] },
): Promise<BulkItemOutcome> {
  if (entity === 'lineItem') {
    if (row.type && YOUTUBE_LI_TYPES.includes(row.type))
      return failed(index, row, NOT_ELIGIBLE, 'BLK-010');
    return outcome(index, row, await assignCreatives(user, row.id, change));
  }
  // an insertion order edits the assignments of its line items
  const ctx = await serviceCtx(user);
  const lis = await withSandbox(ctx.sandboxId, (tx) =>
    tx.lineItem.findMany({
      where: { ioId: row.id, status: { not: 'ARCHIVED' } },
      select: { id: true, type: true },
    }),
  );
  let firstError: BulkItemOutcome | null = null;
  for (const li of lis) {
    if (li.type === 'YT_VIDEO' || li.type === 'YT_AUDIO' || li.type === 'DEMAND_GEN') continue;
    const res = await assignCreatives(user, li.id, change);
    if (!res.ok && !firstError) firstError = outcome(index, row, res);
  }
  return firstError ?? { index, entityId: row.publicId, status: 'OK' };
}

// ---------------------------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------------------------

const INVENTORY_DIMENSIONS: readonly BulkTargetingDimension[] = [
  'DEALS',
  'DEAL_GROUPS',
  'INVENTORY_QUALITY',
  'EXCHANGES',
];

/** Row-level eligibility (BLK-010). Template type is judged by `applyTemplate` (BLK-012). */
export function eligibleForItem(entity: BulkEntityKey, row: RowInfo, params: BulkParams): boolean {
  switch (params.op) {
    case 'APPLY_TARGETING_TEMPLATE':
      return row.status !== 'ARCHIVED';
    case 'EDIT_TARGETING': {
      const dimension = params.edit.dimension;
      if (INVENTORY_DIMENSIONS.includes(dimension)) return row.status !== 'ARCHIVED';
      return isEligibleFor('EDIT_TARGETING', entity, row, { dimension });
    }
    default:
      return isEligibleFor(params.op, entity, row);
  }
}

export async function executeItem(
  user: SessionUser,
  entity: BulkEntityKey,
  index: number,
  row: RowInfo | null,
  idForMessage: string,
  params: BulkParams,
): Promise<BulkItemOutcome> {
  if (!row)
    return { index, entityId: idForMessage, status: 'FAILED', message: NOT_FOUND(entity), ruleId: 'BLK-025' };
  if (!eligibleForItem(entity, row, params)) return failed(index, row, NOT_ELIGIBLE, 'BLK-010');

  switch (params.op) {
    case 'ACTIVATE':
    case 'PAUSE': {
      const to = params.op === 'ACTIVATE' ? 'ACTIVE' : 'PAUSED';
      if (entity === 'campaign') return outcome(index, row, await setCampaignStatus(user, row.id, to));
      if (entity === 'insertionOrder') return outcome(index, row, await setIoStatus(user, row.id, to));
      return outcome(index, row, await setLineItemStatus(user, { id: row.id, status: to }));
    }
    case 'UNARCHIVE':
      if (entity === 'campaign') return outcome(index, row, await setCampaignStatus(user, row.id, 'PAUSED'));
      if (entity === 'insertionOrder') return outcome(index, row, await setIoStatus(user, row.id, 'PAUSED'));
      return outcome(index, row, await setLineItemStatus(user, { id: row.id, status: 'PAUSED' }));
    case 'ARCHIVE': {
      // the cascade functions take the bulk job id from the ambient context
      const jobId = ambientChange()?.bulkJobId;
      if (entity === 'campaign') return outcome(index, row, await archiveCampaigns(user, [row.id], jobId ? { jobId } : {}));
      if (entity === 'insertionOrder') return outcome(index, row, await archiveInsertionOrders(user, [row.id], jobId ? { jobId } : {}));
      return outcome(index, row, await setLineItemStatus(user, { id: row.id, status: 'ARCHIVED' }));
    }
    case 'DUPLICATE':
      try {
        const res = await duplicateEntity(user, entity, row.id, {
          copies: params.copies,
          ...(params.targetParentId ? { targetParentId: params.targetParentId } : {}),
        });
        return { index, entityId: row.publicId, status: 'OK', resultEntityId: res.created[0] };
      } catch (e) {
        if (e instanceof DuplicateFailure) return failed(index, row, e.message, e.ruleId);
        throw e;
      }
    case 'APPLY_TARGETING_TEMPLATE': {
      if (entity === 'lineItem') return outcome(index, row, await applyTemplate(user, row, params.templateId));
      // IO: every line item of the template's type
      const ctx = await serviceCtx(user);
      const lis = await withSandbox(ctx.sandboxId, (tx) =>
        tx.lineItem.findMany({ where: { ioId: row.id, status: { not: 'ARCHIVED' } }, select: { id: true, publicId: true, type: true, name: true, status: true, advertiserId: true } }),
      );
      let err: BulkItemOutcome | null = null;
      for (const li of lis) {
        const info: RowInfo = { id: li.id, publicId: li.publicId.toString(), status: 'ACTIVE', type: li.type, name: li.name, advertiserId: li.advertiserId, parentPublicId: row.publicId };
        const res = await applyTemplate(user, info, params.templateId);
        if (!res.ok && !err && res.issues?.[0]?.ruleId !== 'BLK-012') err = outcome(index, row, res);
      }
      return err ?? { index, entityId: row.publicId, status: 'OK' };
    }
    case 'EDIT_SETTINGS':
      return outcome(
        index,
        row,
        entity === 'insertionOrder'
          ? await editIoSettings(user, row, params.patch)
          : await editLiSettings(user, row, params.patch),
      );
    case 'EDIT_TARGETING':
      return outcome(index, row, await editTargeting(user, row, params));
    case 'EDIT_CREATIVE_ASSIGNMENT':
      return editCreativeAssignment(user, index, row, entity, { add: params.add ?? [], remove: params.remove ?? [] });
  }
}
