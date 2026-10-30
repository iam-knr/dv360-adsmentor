import 'server-only';
// Duplication (module 11 4.2, `DuplicationPlan`): campaign, insertion order and line item, with the children
// that are copied. Statuses of the copies follow Q-11-04. Each created row gets its own ChangeGroup (source
// DUPLICATION through the ambient bulk context); copies are written one tree per transaction, so a failed tree
// leaves nothing behind.
import type { Prisma } from '@prisma/client';
import type { SessionUser } from '@/lib/auth/types';
import { withChangeLog } from '@/lib/changelog';
import { withSandbox, type Tx } from '@/lib/db';
import {
  assertWrite,
  changeCtx,
  serviceCtx,
  ServiceFailure,
  type ServiceCtx,
} from '@/lib/campaigns/service-kit';
import { parseIdRef, whereId } from '@/lib/routes/params';
import {
  liTypeAllowedByIoType,
  liTypeAllowedByObjective,
  LI_TYPE_LABEL,
} from '@/lib/validation/constants/li-compat';
import { BLK_013 } from './messages';
import type { BulkEntityKey } from './entities';

export interface DuplicateOptions {
  targetParentId?: string;
  copies: number;
}

export interface DuplicateResult {
  /** Public ids of the new top-level entities, in order. */
  created: string[];
  /** Number of rows created per entity type, children included. */
  counts: {
    campaigns: number;
    insertionOrders: number;
    lineItems: number;
    adGroups: number;
    ads: number;
  };
}

/** Rule ids carried in the failure so the Bulk status item shows them. */
export class DuplicateFailure extends Error {
  constructor(
    readonly ruleId: string,
    message: string,
  ) {
    super(message);
  }
}

const NAME_MAX = 240;

/** `Copy of {name}`, then `Copy of {name} (2)` for the next copies of the same source. */
export function copyName(name: string, index: number): string {
  const suffix = index === 0 ? '' : ` (${index + 1})`;
  const base = `Copy of ${name}`;
  return base.slice(0, NAME_MAX - suffix.length) + suffix;
}

/** A row without identity columns, for `create`. Keeps relations as scalar foreign keys. */
function clone<T extends Record<string, unknown>>(
  row: T,
  drop: string[] = [],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const skip = new Set(['id', 'publicId', 'createdAt', 'updatedAt', 'version', ...drop]);
  for (const [k, v] of Object.entries(row)) if (!skip.has(k)) out[k] = v;
  return out;
}

type Counts = DuplicateResult['counts'];
const emptyCounts = (): Counts => ({
  campaigns: 0,
  insertionOrders: 0,
  lineItems: 0,
  adGroups: 0,
  ads: 0,
});

interface Env {
  tx: Tx;
  ctx: ServiceCtx;
  counts: Counts;
}

const cctx = (env: Env) => ({ ...changeCtx(env.ctx, env.tx), tx: env.tx });

async function copyLineItem(
  env: Env,
  liId: string,
  target: { ioId: string; campaignId: string; advertiserId: string },
  name: string,
): Promise<string> {
  const { tx, ctx } = env;
  const src = await tx.lineItem.findUniqueOrThrow({
    where: { id: liId },
    include: {
      fees: true,
      lineItemInventories: true,
      lineItemFloodlightActivities: true,
      assignments: true,
      adGroups: { include: { ads: true } },
    },
  });
  const created = await withChangeLog(
    cctx(env),
    {
      type: 'LINE_ITEM',
      chain: {
        advertiserId: target.advertiserId,
        campaignId: target.campaignId,
        ioId: target.ioId,
      },
    },
    async (t) => {
      const row = await t.lineItem.create({
        data: {
          ...(clone(src as unknown as Record<string, unknown>, [
            'fees',
            'lineItemInventories',
            'lineItemFloodlightActivities',
            'assignments',
            'adGroups',
          ]) as Prisma.LineItemUncheckedCreateInput),
          name,
          status: 'DRAFT',
          ioId: target.ioId,
          campaignId: target.campaignId,
          advertiserId: target.advertiserId,
          copiedFromId: src.id,
        },
        select: { id: true, publicId: true },
      });
      if (src.fees.length)
        await t.partnerCost.createMany({
          data: src.fees.map((f) => ({
            ...(clone(f as unknown as Record<string, unknown>, [
              'ioId',
            ]) as Prisma.PartnerCostCreateManyInput),
            lineItemId: row.id,
          })),
        });
      if (src.lineItemInventories.length)
        await t.lineItemInventory.createMany({
          data: src.lineItemInventories.map((r) => ({
            ...(clone(
              r as unknown as Record<string, unknown>,
            ) as Prisma.LineItemInventoryCreateManyInput),
            lineItemId: row.id,
          })),
        });
      if (src.lineItemFloodlightActivities.length)
        await t.lineItemFloodlightActivity.createMany({
          data: src.lineItemFloodlightActivities.map((r) => ({
            ...(clone(
              r as unknown as Record<string, unknown>,
            ) as Prisma.LineItemFloodlightActivityCreateManyInput),
            lineItemId: row.id,
          })),
        });
      if (src.assignments.length)
        await t.creativeAssignment.createMany({
          data: src.assignments.map((a) => ({
            sandboxId: a.sandboxId,
            lineItemId: row.id,
            creativeId: a.creativeId,
            assignedById: ctx.user.actor?.id ?? ctx.user.id,
          })),
        });
      // targeting: the line item's own rows only; locked advertiser rows are read again from the advertiser
      const rows = await t.targetingAssignment.findMany({
        where: { lineItemId: src.id, ownerType: 'LINE_ITEM', isLocked: false },
      });
      if (rows.length)
        await t.targetingAssignment.createMany({
          data: rows.map((r) => ({
            ...(clone(
              r as unknown as Record<string, unknown>,
            ) as Prisma.TargetingAssignmentCreateManyInput),
            lineItemId: row.id,
          })),
        });
      return row;
    },
  );
  env.counts.lineItems += 1;
  for (const ag of src.adGroups) {
    if (ag.status === 'ARCHIVED') continue;
    const newGroup = await tx.adGroup.create({
      data: {
        ...(clone(ag as unknown as Record<string, unknown>, [
          'ads',
        ]) as Prisma.AdGroupUncheckedCreateInput),
        lineItemId: created.id,
        status: 'PAUSED',
      },
      select: { id: true },
    });
    env.counts.adGroups += 1;
    const groupTargeting = await tx.targetingAssignment.findMany({
      where: { adGroupId: ag.id, ownerType: 'AD_GROUP' },
    });
    if (groupTargeting.length)
      await tx.targetingAssignment.createMany({
        data: groupTargeting.map((r) => ({
          ...(clone(
            r as unknown as Record<string, unknown>,
          ) as Prisma.TargetingAssignmentCreateManyInput),
          adGroupId: newGroup.id,
        })),
      });
    for (const ad of ag.ads) {
      if (ad.status === 'ARCHIVED') continue;
      await tx.ad.create({
        data: {
          ...(clone(ad as unknown as Record<string, unknown>) as Prisma.AdUncheckedCreateInput),
          adGroupId: newGroup.id,
          status: 'PAUSED',
          reviewStatus: 'PENDING',
          reviewDecideAt: null,
          plannedVerdict: null,
        },
      });
      env.counts.ads += 1;
    }
  }
  return created.id;
}

async function copyInsertionOrder(
  env: Env,
  ioId: string,
  target: { campaignId: string; advertiserId: string },
  name: string,
  withChildren = true,
): Promise<string> {
  const { tx } = env;
  const src = await tx.insertionOrder.findUniqueOrThrow({
    where: { id: ioId },
    include: { segments: true, fees: true, lineItems: { orderBy: { publicId: 'asc' } } },
  });
  const created = await withChangeLog(
    cctx(env),
    {
      type: 'INSERTION_ORDER',
      chain: { advertiserId: target.advertiserId, campaignId: target.campaignId },
    },
    async (t) => {
      const row = await t.insertionOrder.create({
        data: {
          ...(clone(src as unknown as Record<string, unknown>, [
            'segments',
            'fees',
            'lineItems',
          ]) as Prisma.InsertionOrderUncheckedCreateInput),
          name,
          status: 'DRAFT',
          campaignId: target.campaignId,
          advertiserId: target.advertiserId,
        },
        select: { id: true },
      });
      if (src.segments.length)
        await t.budgetSegment.createMany({
          data: src.segments.map((s) => ({
            ...(clone(
              s as unknown as Record<string, unknown>,
            ) as Prisma.BudgetSegmentCreateManyInput),
            ioId: row.id,
          })),
        });
      if (src.fees.length)
        await t.partnerCost.createMany({
          data: src.fees.map((f) => ({
            ...(clone(f as unknown as Record<string, unknown>, [
              'lineItemId',
            ]) as Prisma.PartnerCostCreateManyInput),
            ioId: row.id,
          })),
        });
      return row;
    },
  );
  env.counts.insertionOrders += 1;
  if (withChildren)
    for (const li of src.lineItems) {
      if (li.status === 'ARCHIVED') continue;
      await copyLineItem(
        env,
        li.id,
        { ioId: created.id, campaignId: target.campaignId, advertiserId: target.advertiserId },
        li.name,
      );
    }
  return created.id;
}

async function copyCampaign(env: Env, cid: string, name: string): Promise<string> {
  const { tx } = env;
  const src = await tx.campaign.findUniqueOrThrow({
    where: { id: cid },
    include: { budgets: true, insertionOrders: { orderBy: { publicId: 'asc' } } },
  });
  const created = await withChangeLog(
    cctx(env),
    { type: 'CAMPAIGN', chain: { advertiserId: src.advertiserId } },
    async (t) => {
      const row = await t.campaign.create({
        data: {
          ...(clone(src as unknown as Record<string, unknown>, [
            'budgets',
            'insertionOrders',
          ]) as Prisma.CampaignUncheckedCreateInput),
          name,
          status: 'PAUSED',
          copiedFromId: src.id,
        },
        select: { id: true },
      });
      if (src.budgets.length)
        await t.campaignBudget.createMany({
          data: src.budgets.map((b) => ({
            ...(clone(
              b as unknown as Record<string, unknown>,
            ) as Prisma.CampaignBudgetCreateManyInput),
            campaignId: row.id,
          })),
        });
      return row;
    },
  );
  env.counts.campaigns += 1;
  for (const io of src.insertionOrders) {
    if (io.status === 'ARCHIVED') continue;
    await copyInsertionOrder(
      env,
      io.id,
      { campaignId: created.id, advertiserId: src.advertiserId },
      io.name,
    );
  }
  return created.id;
}

const fail = (rule: string, message: string) => new DuplicateFailure(rule, message);

/**
 * K4: duplicate one entity `copies` times. IO copies go to `targetParentId` (a campaign), line item copies to a
 * target insertion order; a campaign always stays in its advertiser. Throws `DuplicateFailure` (BLK-013, BLK-014)
 * or `ServiceFailure`.
 */
export async function duplicateEntity(
  user: SessionUser,
  entity: BulkEntityKey,
  id: string,
  opts: DuplicateOptions,
): Promise<DuplicateResult> {
  if (!Number.isInteger(opts.copies) || opts.copies < 1) throw fail('BLK-013', BLK_013);
  const ctx = await serviceCtx(user);
  assertWrite(ctx);
  const ref = parseIdRef(id);
  if (!ref) throw new ServiceFailure('NOT_FOUND');
  return withSandbox(ctx.sandboxId, async (tx) => {
    const env: Env = { tx, ctx, counts: emptyCounts() };
    const created: string[] = [];
    if (entity === 'campaign') {
      const src = await tx.campaign.findFirst({
        where: whereId(ref),
        select: { id: true, name: true },
      });
      if (!src) throw new ServiceFailure('NOT_FOUND');
      for (let i = 0; i < opts.copies; i++) {
        const newId = await copyCampaign(env, src.id, copyName(src.name, i));
        created.push(
          (
            await tx.campaign.findUniqueOrThrow({
              where: { id: newId },
              select: { publicId: true },
            })
          ).publicId.toString(),
        );
      }
    } else if (entity === 'insertionOrder') {
      const src = await tx.insertionOrder.findFirst({
        where: whereId(ref),
        select: { id: true, name: true, campaignId: true, advertiserId: true },
      });
      if (!src) throw new ServiceFailure('NOT_FOUND');
      const parentRef = opts.targetParentId ? parseIdRef(opts.targetParentId) : null;
      const parent = opts.targetParentId
        ? parentRef
          ? await tx.campaign.findFirst({
              where: whereId(parentRef),
              select: { id: true, status: true, advertiserId: true },
            })
          : null
        : await tx.campaign.findUnique({
            where: { id: src.campaignId },
            select: { id: true, status: true, advertiserId: true },
          });
      if (!parent || parent.status === 'ARCHIVED' || parent.advertiserId !== src.advertiserId)
        throw fail('BLK-014', "The target campaign doesn't exist or is archived.");
      for (let i = 0; i < opts.copies; i++) {
        const newId = await copyInsertionOrder(
          env,
          src.id,
          { campaignId: parent.id, advertiserId: parent.advertiserId },
          copyName(src.name, i),
        );
        created.push(
          (
            await tx.insertionOrder.findUniqueOrThrow({
              where: { id: newId },
              select: { publicId: true },
            })
          ).publicId.toString(),
        );
      }
    } else {
      const src = await tx.lineItem.findFirst({
        where: whereId(ref),
        select: { id: true, name: true, ioId: true, type: true, advertiserId: true },
      });
      if (!src) throw new ServiceFailure('NOT_FOUND');
      const parentRef = opts.targetParentId ? parseIdRef(opts.targetParentId) : null;
      const parent = opts.targetParentId
        ? parentRef
          ? await tx.insertionOrder.findFirst({ where: whereId(parentRef) })
          : null
        : await tx.insertionOrder.findUnique({ where: { id: src.ioId } });
      if (!parent || parent.status === 'ARCHIVED' || parent.advertiserId !== src.advertiserId)
        throw fail('BLK-014', "The target insertion order doesn't exist or is archived.");
      const type = src.type;
      if (
        !liTypeAllowedByObjective(parent.objective, type) ||
        !liTypeAllowedByIoType(parent.type, type)
      )
        throw fail(
          'BLK-014',
          `${LI_TYPE_LABEL[type]} line items aren't compatible with your insertion order's objective setting.`,
        );
      for (let i = 0; i < opts.copies; i++) {
        const newId = await copyLineItem(
          env,
          src.id,
          { ioId: parent.id, campaignId: parent.campaignId, advertiserId: parent.advertiserId },
          copyName(src.name, i),
        );
        created.push(
          (
            await tx.lineItem.findUniqueOrThrow({
              where: { id: newId },
              select: { publicId: true },
            })
          ).publicId.toString(),
        );
      }
    }
    return { created, counts: env.counts };
  });
}
