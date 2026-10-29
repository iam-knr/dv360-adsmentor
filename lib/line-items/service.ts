import 'server-only';
// Line item service (module 08 4.1, T08-03). Wrapper of every write: assertAccess, validate with the full context,
// optimistic version check, withChangeLog (child rows logged per element), Result<T>. Reads run in the viewer's
// sandbox; a foreign or missing id reads as NOT_FOUND.
import type { Prisma } from '@prisma/client';
import { prisma, withSandbox, type Tx } from '@/lib/db';
import { withChangeLog, type ChangeCtx } from '@/lib/changelog';
import { can } from '@/lib/rbac/can';
import type { SessionUser } from '@/lib/auth/types';
import { getGridMetrics } from '@/lib/metrics/grid-metrics';
import { persistTargeting } from '@/lib/targeting';
import { validate } from '@/lib/validation/engine';
import { canTransition } from '@/lib/validation/state/transitions';
import { creativeFormatAllowed } from '@/lib/validation/constants/creatives';
import { MSG, format } from '@/lib/validation/messages';
import type { Issue, LiType } from '@/lib/validation/types';
import { findApp } from './apps';
import {
  applyIoLocks,
  copySettingsOf,
  defaultLineItemForm,
  lockedPaths,
  numOrNull,
  toValidationInput,
  type LiFormValue,
} from './form';
import {
  buildLiContext,
  creativeFormatOf,
  creativeLookups,
  dateOf,
  exchangeIdsFor,
  hasStarted,
  LI_INCLUDE,
  loadIo,
  rowToForm,
  simNow,
  type LoadedIo,
  type StoredLi,
} from './load';
import { isFormType, LI_TYPE_LABEL, liTypeOptions, TYPE_CONFIG } from './type-config';
import type {
  ConversionPickerRow,
  CopyCandidate,
  CreativePickerRow,
  IoChoice,
  LiCopySource,
  LiListQuery,
  LiListResult,
  LiListScope,
  LineItemDetail,
  LineItemDraftInit,
  LineItemRow,
  LiStatus,
  LiTypeOption,
  Result,
} from './types';

// ---------------------------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------------------------

const forbidden = (): Result<never> => ({
  ok: false,
  code: 'FORBIDDEN',
  issues: [issue('FORBIDDEN', '', "You don't have permission to make this change.")],
});
const notFound = (): Result<never> => ({
  ok: false,
  code: 'NOT_FOUND',
  issues: [issue('NOT_FOUND', '', "This line item doesn't exist.")],
});
const conflict = (): Result<never> => ({
  ok: false,
  code: 'CONFLICT',
  issues: [
    issue(
      'CONFLICT',
      '',
      'This line item was changed by someone else. Reload the page to see the latest version.',
    ),
  ],
});

function issue(ruleId: string, path: string, message: string): Issue {
  return { ruleId, severity: 'error', path, message, blocking: true };
}

export function canWrite(user: SessionUser): boolean {
  return !!user.sandboxId && can(user, 'write', { sandboxId: user.sandboxId });
}

function canRead(user: SessionUser): boolean {
  return !!user.sandboxId && can(user, 'view', { sandboxId: user.sandboxId });
}

async function inSandbox<T>(user: SessionUser, fn: (tx: Tx) => Promise<T>): Promise<T | null> {
  if (!canRead(user) || !user.sandboxId) return null;
  return withSandbox(user.sandboxId, fn);
}

async function changeCtx(user: SessionUser, tx: Tx, note?: string): Promise<ChangeCtx> {
  const sandboxId = user.sandboxId!;
  const classroomId =
    user.classroomId ??
    (await prisma.sandbox.findUnique({ where: { id: sandboxId }, select: { classroomId: true } }))
      ?.classroomId ??
    '';
  const actor = user.actor ?? user;
  return {
    sandboxId,
    classroomId,
    actor: { type: 'USER', userId: actor.id, label: actor.name },
    tx,
    ...(note?.trim() ? { note: note.trim() } : {}),
  };
}

// ---------------------------------------------------------------------------------------------
// Form value to columns and child rows
// ---------------------------------------------------------------------------------------------

const EU_DB = {
  YES: 'CONTAINS_EU_POLITICAL_ADS',
  NO: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADS',
} as const;

const money = (v: unknown): string | null => {
  const n = numOrNull(v as string);
  return n === null ? null : String(n);
};

function columnsOf(v: LiFormValue, io: LoadedIo) {
  const value = applyIoLocks(v, io.form);
  const type = value.type as LiType;
  const config = TYPE_CONFIG[type];
  const fixed = value.bid.mode === 'FIXED';
  const markup = value.revenueModel?.type !== 'CPM_VALUE';
  return {
    name: value.name.trim(),
    inventoryQuality: value.inventory.quality ?? 'AUTHORIZED_DIRECT_SELLERS_AND_RESELLERS',
    targetCuratedCtv: config.curatedCtv && !!value.inventory.targetCuratedCtv,
    optimizedTargeting: config.optimizedTargeting && value.optimizedTargeting,
    targetingTemplateId: value.targeting.templateId ?? null,
    flightMode: value.flight.mode === 'CUSTOM' ? ('CUSTOM' as const) : ('INHERIT_IO' as const),
    flightStart: value.flight.mode === 'CUSTOM' ? dateOf(value.flight.startDate) : null,
    flightEnd: value.flight.mode === 'CUSTOM' ? dateOf(value.flight.endDate) : null,
    budgetMode:
      value.budget.mode === 'AMOUNT' ? ('FIXED' as const) : ('UNLIMITED_UP_TO_IO' as const),
    budgetAmount: value.budget.mode === 'AMOUNT' ? money(value.budget.amount) : null,
    pacingPeriod: value.pacing.period ?? 'FLIGHT',
    pacingType: value.pacing.type ?? 'EVEN',
    dailyMaxAmount: value.pacing.period === 'DAILY' ? money(value.pacing.dailyAmount) : null,
    bidKind: fixed ? ('FIXED' as const) : ('AUTOMATED' as const),
    bidGoal:
      fixed || value.bid.optimizedTowards === 'FIXED_BID'
        ? null
        : (value.bid.optimizedTowards ?? null),
    bidPriority:
      value.bid.priority === 'TARGET' ? ('TARGET_VALUE' as const) : ('SPEND_FULL_BUDGET' as const),
    bidTargetValue: fixed ? null : money(value.bid.targetValue),
    fixedBidCpm: fixed ? money(value.bid.fixedCpm) : null,
    customBiddingAlgorithmId: fixed ? null : (value.bid.customBiddingAlgorithmId ?? null),
    creativeOptimization: value.creativeOptimization,
    freqMode: config.frequency
      ? value.frequencyCap.mode === 'LIMITED'
        ? ('LIMITED' as const)
        : ('INHERIT' as const)
      : ('INHERIT' as const),
    freqMaxExposures:
      value.frequencyCap.mode === 'LIMITED' ? numOrNull(value.frequencyCap.maxImpressions) : null,
    freqUnit: value.frequencyCap.mode === 'LIMITED' ? (value.frequencyCap.period ?? 'MONTH') : null,
    freqUnitCount:
      value.frequencyCap.mode === 'LIMITED'
        ? (numOrNull(value.frequencyCap.periodCount) ?? 1)
        : null,
    conversionCounting: value.conversions.countingMode ?? 'ALL',
    conversionCountingPct:
      value.conversions.countingMode === 'PERCENTAGE'
        ? numOrNull(value.conversions.postViewPct)
        : null,
    attributionModelId: value.conversions.attributionModelId || null,
    euPoliticalAds: value.euPoliticalAds ? EU_DB[value.euPoliticalAds] : null,
    revenueModelType: markup ? ('TOTAL_MEDIA_COST_MARKUP' as const) : ('CPM_VALUE' as const),
    revenueMarkupPct: markup ? money(value.revenueModel?.value) : null,
    revenueCpm: markup ? null : money(value.revenueModel?.value),
    integrationCode: value.integrationCode?.trim() || null,
    integrationDetail: value.integrationDetail?.trim() || null,
  };
}

/** Replace the child rows that the form owns. The change log diffs them per element. */
async function writeChildren(
  tx: Tx,
  sandboxId: string,
  lineItemId: string,
  value: LiFormValue,
  userId: string,
): Promise<void> {
  const type = value.type as LiType;
  const config = TYPE_CONFIG[type];
  const existing = await tx.creativeAssignment.findMany({
    where: { lineItemId },
    select: { creativeId: true },
  });
  const want = config.creatives ? [...new Set(value.creatives)] : [];
  const have = existing.map((e) => e.creativeId);
  const remove = have.filter((id) => !want.includes(id));
  if (remove.length)
    await tx.creativeAssignment.deleteMany({ where: { lineItemId, creativeId: { in: remove } } });
  const add = want.filter((id) => !have.includes(id));
  if (add.length)
    await tx.creativeAssignment.createMany({
      data: add.map((creativeId) => ({ sandboxId, lineItemId, creativeId, assignedById: userId })),
    });

  await tx.partnerCost.deleteMany({ where: { lineItemId } });
  const fees: Prisma.PartnerCostCreateManyInput[] = [
    ...value.partnerCosts.cpmFees.map((f, slot) => ({
      sandboxId,
      lineItemId,
      kind: 'CPM_FEE' as const,
      slot,
      feeType: (f.type || 'DEFAULT') as Prisma.PartnerCostCreateManyInput['feeType'],
      amount: money(f.amount),
    })),
    ...value.partnerCosts.mediaFees.map((f, slot) => ({
      sandboxId,
      lineItemId,
      kind: 'MEDIA_FEE' as const,
      slot,
      feeType: (f.system
        ? 'DV360_FEE'
        : f.type || 'DEFAULT') as Prisma.PartnerCostCreateManyInput['feeType'],
      percentage: money(f.amount),
      invoiced: !!f.system,
      isSystem: !!f.system,
    })),
  ];
  if (fees.length) await tx.partnerCost.createMany({ data: fees });

  await tx.lineItemFloodlightActivity.deleteMany({ where: { lineItemId } });
  const activities = config.conversions ? [...new Set(value.conversions.activities)] : [];
  if (activities.length)
    await tx.lineItemFloodlightActivity.createMany({
      data: activities.map((activityId) => ({ sandboxId, lineItemId, activityId })),
    });

  await tx.lineItemInventory.deleteMany({ where: { lineItemId } });
  const inventory = config.deals
    ? [
        ...value.inventory.deals.map((refId) => ({ kind: 'DEAL' as const, refId })),
        ...value.inventory.dealGroups.map((refId) => ({ kind: 'GROUP' as const, refId })),
      ]
    : [];
  if (inventory.length)
    await tx.lineItemInventory.createMany({
      data: inventory.map((r) => ({ sandboxId, lineItemId, ...r })),
    });

  await persistTargeting(tx, lineItemId, value.targetingState);
}

// ---------------------------------------------------------------------------------------------
// Picker and draft (L2, create form defaults)
// ---------------------------------------------------------------------------------------------

/** `GET line-item-types` (L2). */
export async function getTypeOptions(
  user: SessionUser,
  ioId: string,
): Promise<LiTypeOption[] | null> {
  return inSandbox(user, async (tx) => {
    const io = await loadIo(tx, ioId);
    return io ? liTypeOptions(io.form, io.row.advertiser) : null;
  });
}

/** Insertion orders of the advertiser for the picker's IO switcher (module 08 2.2). */
export async function getIoChoices(user: SessionUser, advertiserId: string): Promise<IoChoice[]> {
  const rows = await inSandbox(user, (tx) =>
    tx.insertionOrder.findMany({
      where: { advertiserId, status: { in: ['DRAFT', 'ACTIVE', 'PAUSED'] } },
      include: { campaign: { select: { publicId: true, name: true } } },
      orderBy: { name: 'asc' },
    }),
  );
  return (rows ?? []).map((r) => ({
    id: r.id,
    publicId: r.publicId.toString(),
    campaignPublicId: r.campaign.publicId.toString(),
    name: r.name,
    campaignName: r.campaign.name,
  }));
}

export interface DraftOptions {
  platform?: 'ALL' | 'IOS' | 'ANDROID' | null;
  appId?: string | null;
  adType?: 'DISPLAY' | 'VIDEO' | null;
  name?: string | null;
}

/** Defaults of a new line item (AC-08-04 to AC-08-07). Null when the IO is missing or the type has no form here. */
export async function getDraftInit(
  user: SessionUser,
  ioId: string,
  type: string,
  opts: DraftOptions = {},
): Promise<LineItemDraftInit | null> {
  if (!isFormType(type)) return null;
  return inSandbox(user, async (tx) => {
    const io = await loadIo(tx, ioId);
    if (!io) return null;
    const app =
      type === 'MOBILE_APP_INSTALL' && opts.appId
        ? { platform: opts.platform ?? 'ALL', storeId: opts.appId }
        : null;
    const adType = opts.adType ?? 'DISPLAY';
    const value = defaultLineItemForm({
      type,
      io: io.form,
      exchangeIds: await exchangeIdsFor(tx, io.row.advertiser.partnerId, type, adType),
      targetingState: { version: 1, lineItemType: type, criteria: {} },
      app,
      adType,
      ...(opts.name ? { name: opts.name } : {}),
    });
    return {
      value,
      io: io.form,
      currency: io.currency,
      locked: lockedPaths(io.form, 'create'),
      higherCapText: io.higherCapText,
      app: app ? findApp(app.storeId) : null,
      readOnly: !canWrite(user),
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Detail (L3)
// ---------------------------------------------------------------------------------------------

async function loadLi(tx: Tx, liId: string): Promise<StoredLi | null> {
  return tx.lineItem.findUnique({ where: { id: liId }, include: LI_INCLUDE });
}

export async function getLineItemDetail(
  user: SessionUser,
  liId: string,
): Promise<LineItemDetail | null> {
  return inSandbox(user, async (tx) => {
    const li = await loadLi(tx, liId);
    if (!li) return null;
    const io = await loadIo(tx, li.ioId);
    if (!io) return null;
    const value = await rowToForm(tx, li, io.row.advertiser.partnerId);
    const now = await simNow(tx, li.sandboxId);
    const [creatives, conversions, template] = await Promise.all([
      creativeRows(tx, io, value, li.id),
      conversionRows(tx, io.row.advertiserId),
      li.targetingTemplateId
        ? tx.targetingTemplate.findUnique({
            where: { id: li.targetingTemplateId },
            select: { name: true },
          })
        : null,
    ]);
    return {
      id: li.id,
      publicId: li.publicId.toString(),
      version: li.version,
      value,
      io: io.form,
      currency: io.currency,
      locked: lockedPaths(io.form, 'edit', hasStarted(value, io, now)),
      templateName: template?.name ?? null,
      advancedAdServingRate: 0,
      higherCapText: io.higherCapText,
      app: findApp(li.mobileAppId),
      creatives: creatives.filter((c) => value.creatives.includes(c.id)),
      conversions: conversions.filter((c) => value.conversions.activities.includes(c.id)),
      readOnly: !canWrite(user),
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Validate, create, update (L4 to L6)
// ---------------------------------------------------------------------------------------------

/** Blocking issues first. `targetStatus` ACTIVE adds the activation rules. */
function runRules(
  value: LiFormValue,
  io: LoadedIo,
  ctx: Awaited<ReturnType<typeof buildLiContext>>,
): Issue[] {
  const input = toValidationInput(applyIoLocks(value, io.form), io.currency);
  return validate('lineItem', input, ctx, {
    trigger: 'save',
    ...(value.status === 'ACTIVE' ? { targetStatus: 'ACTIVE' as const } : {}),
  });
}

/** `validateLineItem` (L4): the server run of every rule, for the form's Create and Save. */
export async function validateLineItem(
  user: SessionUser,
  ioId: string,
  value: LiFormValue,
  liId?: string,
): Promise<Issue[]> {
  const out = await inSandbox(user, async (tx) => {
    const io = await loadIo(tx, ioId);
    if (!io) return [];
    const stored = liId ? await loadLi(tx, liId) : null;
    const original = stored ? await rowToForm(tx, stored, io.row.advertiser.partnerId) : undefined;
    return runRules(value, io, await buildLiContext(tx, user, io, original));
  });
  return out ?? [];
}

export async function createLineItem(
  user: SessionUser,
  ioId: string,
  value: LiFormValue,
  meta: { note?: string } = {},
): Promise<Result<{ id: string; publicId: string }>> {
  if (!canWrite(user)) return forbidden();
  const out = await withSandbox(user.sandboxId!, async (tx) => {
    const io = await loadIo(tx, ioId);
    if (!io || !value.type || !isFormType(value.type)) return notFound();
    const input: LiFormValue = { ...value, ioId, status: value.status ?? 'DRAFT' };
    const issues = runRules(input, io, await buildLiContext(tx, user, io));
    if (issues.some((i) => i.blocking)) return { ok: false as const, issues };
    const type = input.type as LiType;
    const app = type === 'MOBILE_APP_INSTALL' ? input.app : null;
    const adType =
      type === 'MOBILE_APP_INSTALL' || type === 'ADS_IN_MOBILE_APPS' ? input.adType : null;
    const ctx = await changeCtx(user, tx, meta.note);
    const created = await withChangeLog(
      ctx,
      {
        type: 'LINE_ITEM',
        chain: {
          advertiserId: io.row.advertiserId,
          campaignId: io.row.campaignId,
          ioId: io.row.id,
        },
      },
      async (t) => {
        const row = await t.lineItem.create({
          data: {
            sandboxId: io.row.sandboxId,
            ioId: io.row.id,
            campaignId: io.row.campaignId,
            advertiserId: io.row.advertiserId,
            type,
            status: input.status === 'ACTIVE' ? 'ACTIVE' : 'DRAFT',
            appAdFormat: adType ?? null,
            mobileAppPlatform: app?.platform ?? null,
            mobileAppId: app?.storeId ?? null,
            copiedFromId: null,
            ...columnsOf(input, io),
          },
          select: { id: true, publicId: true },
        });
        await writeChildren(
          t,
          io.row.sandboxId,
          row.id,
          input,
          ctx.actor.type === 'USER' ? ctx.actor.userId : user.id,
        );
        return row;
      },
    );
    return {
      ok: true as const,
      data: { id: created.id, publicId: created.publicId.toString() },
      warnings: issues.filter((i) => !i.blocking),
    };
  });
  return out;
}

export async function updateLineItem(
  user: SessionUser,
  liId: string,
  value: LiFormValue,
  meta: { expectedVersion?: number; note?: string } = {},
): Promise<Result<{ version: number }>> {
  if (!canWrite(user)) return forbidden();
  return withSandbox(user.sandboxId!, async (tx) => {
    const stored = await loadLi(tx, liId);
    if (!stored) return notFound();
    if (meta.expectedVersion !== undefined && meta.expectedVersion !== stored.version)
      return conflict();
    const io = await loadIo(tx, stored.ioId);
    if (!io) return notFound();
    const original = await rowToForm(tx, stored, io.row.advertiser.partnerId);
    const input: LiFormValue = { ...value, ioId: stored.ioId };
    const issues = runRules(input, io, await buildLiContext(tx, user, io, original));
    if (issues.some((i) => i.blocking)) return { ok: false as const, issues };
    const status = input.status ?? original.status;
    if (status !== original.status) {
      const move = canTransition('lineItem', original.status ?? 'DRAFT', status ?? 'DRAFT', {
        role: user.dvRole,
      });
      if (!move.ok)
        return { ok: false as const, issues: [issue('LI-003', 'status', MSG.CHOOSE_STATUS)] };
    }
    const ctx = await changeCtx(user, tx, meta.note);
    const row = await withChangeLog(
      ctx,
      {
        type: 'LINE_ITEM',
        id: stored.id,
        chain: {
          advertiserId: stored.advertiserId,
          campaignId: stored.campaignId,
          ioId: stored.ioId,
          lineItemId: stored.id,
        },
      },
      async (t) => {
        // type, app and ad type never change after create (LI-004, LI-APP-008)
        const updated = await t.lineItem.update({
          where: { id: stored.id },
          data: {
            ...columnsOf({ ...input, type: stored.type as LiType }, io),
            status: status === 'ARCHIVED' ? 'ARCHIVED' : (status ?? stored.status),
            version: { increment: 1 },
          },
          select: { id: true, version: true },
        });
        await writeChildren(
          t,
          stored.sandboxId,
          stored.id,
          { ...input, type: stored.type as LiType },
          user.actor?.id ?? user.id,
        );
        return updated;
      },
    );
    return {
      ok: true as const,
      data: { version: row.version },
      warnings: issues.filter((i) => !i.blocking),
    };
  });
}

/** Inline status (L7, Δ-08-14). Activation runs the activation rules; LI-063 and friends never block. */
export async function setLineItemStatus(
  user: SessionUser,
  input: { id: string; status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED'; expectedVersion?: number },
): Promise<Result<{ status: LiStatus; version: number }>> {
  if (!canWrite(user)) return forbidden();
  return withSandbox(user.sandboxId!, async (tx) => {
    const stored = await loadLi(tx, input.id);
    if (!stored) return notFound();
    if (input.expectedVersion !== undefined && input.expectedVersion !== stored.version)
      return conflict();
    const io = await loadIo(tx, stored.ioId);
    if (!io) return notFound();
    const from = stored.status === 'SCHEDULED_FOR_DELETION' ? 'ARCHIVED' : stored.status;
    const move = canTransition(
      'lineItem',
      from,
      input.status,
      { role: user.dvRole },
      {
        ioArchived: io.row.status === 'ARCHIVED',
        campaignArchived: io.row.campaign.status === 'ARCHIVED',
      },
    );
    if (!move.ok)
      return {
        ok: false as const,
        issues: [
          issue(
            move.ruleId ?? 'LI-110',
            'status',
            move.ruleId === 'LI-111'
              ? 'Unarchive the insertion order before activating this line item.'
              : "This status change isn't available.",
          ),
        ],
      };
    let warnings: Issue[] = [];
    if (input.status === 'ACTIVE') {
      const value = await rowToForm(tx, stored, io.row.advertiser.partnerId);
      const ctx = await buildLiContext(tx, user, io, value);
      const issues = validate('lineItem', toValidationInput(value, io.currency), ctx, {
        trigger: 'save',
        targetStatus: 'ACTIVE',
      });
      if (issues.some((i) => i.blocking)) return { ok: false as const, issues };
      warnings = issues.filter((i) => !i.blocking);
    }
    const ctx = await changeCtx(user, tx);
    const row = await withChangeLog(
      ctx,
      {
        type: 'LINE_ITEM',
        id: stored.id,
        chain: {
          advertiserId: stored.advertiserId,
          campaignId: stored.campaignId,
          ioId: stored.ioId,
          lineItemId: stored.id,
        },
      },
      (t) =>
        t.lineItem.update({
          where: { id: stored.id },
          data: { status: input.status, version: { increment: 1 } },
          select: { id: true, status: true, version: true },
        }),
    );
    return {
      ok: true as const,
      data: { status: row.status as LiStatus, version: row.version },
      warnings,
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Copy settings (L17, LI-120)
// ---------------------------------------------------------------------------------------------

/** Line items of the same advertiser and type for the "Copy settings" dialog. */
export async function getCopyCandidates(
  user: SessionUser,
  advertiserId: string,
  type: LiType,
  excludeId?: string,
): Promise<CopyCandidate[]> {
  const rows = await inSandbox(user, (tx) =>
    tx.lineItem.findMany({
      where: {
        advertiserId,
        type,
        status: { not: 'SCHEDULED_FOR_DELETION' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      include: { io: { select: { name: true } } },
      orderBy: { name: 'asc' },
      take: 200,
    }),
  );
  return (rows ?? []).map((r) => ({
    id: r.id,
    publicId: r.publicId.toString(),
    name: r.name,
    ioName: r.io.name,
  }));
}

export async function getCopySource(
  user: SessionUser,
  liId: string,
): Promise<Result<LiCopySource>> {
  if (!canWrite(user)) return forbidden();
  const out = await inSandbox(user, async (tx) => {
    const li = await loadLi(tx, liId);
    if (!li) return notFound();
    const io = await loadIo(tx, li.ioId);
    if (!io) return notFound();
    const value = await rowToForm(tx, li, io.row.advertiser.partnerId);
    return {
      ok: true as const,
      data: { id: li.id, type: li.type as LiType, settings: copySettingsOf(value) },
    };
  });
  return out ?? notFound();
}

// ---------------------------------------------------------------------------------------------
// Creatives (L13, L14) and conversions (L15)
// ---------------------------------------------------------------------------------------------

const KIND_LABEL: Record<string, { type: string; format: string }> = {
  STANDARD_IMAGE: { type: 'Display', format: 'Image' },
  STANDARD_HTML5: { type: 'Display', format: 'HTML5' },
  THIRD_PARTY_DISPLAY: { type: 'Display', format: 'Third-party display' },
  NATIVE_SITE: { type: 'Native', format: 'Native site' },
  NATIVE_VIDEO: { type: 'Native', format: 'Native video' },
  VIDEO_FILE: { type: 'Video', format: 'Video' },
  YOUTUBE_VIDEO: { type: 'Video', format: 'YouTube video' },
  AUDIO_FILE: { type: 'Audio', format: 'Audio' },
  THIRD_PARTY_VIDEO: { type: 'Video', format: 'Third-party video' },
  THIRD_PARTY_AUDIO: { type: 'Audio', format: 'Third-party audio' },
};
const SOURCE_LABEL: Record<string, string> = {
  DV360: 'Display & Video 360',
  CM360: 'Campaign Manager 360',
  THIRD_PARTY: 'Third party',
};
const REVIEW_LABEL: Record<string, string> = {
  PENDING: 'Pending review',
  SERVABLE: 'Servable',
  NOT_SERVABLE: 'Not servable',
};

/** Rows of the "Select creatives" panel with eligibility per MX-09 and LI-061 (AC-08-11). */
async function creativeRows(
  tx: Tx,
  io: LoadedIo,
  draft: Pick<LiFormValue, 'type' | 'adType'>,
  _liId?: string,
): Promise<CreativePickerRow[]> {
  const { rows } = await creativeLookups(tx, io.row.advertiserId);
  const type = draft.type as LiType;
  return rows
    .filter((c) => c.status !== 'SCHEDULED_FOR_DELETION')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((c) => {
      const formatOk = creativeFormatAllowed(type, creativeFormatOf(c.kind), draft.adType);
      const servable = c.status !== 'ARCHIVED' && c.dv360Review !== 'NOT_SERVABLE';
      const approved = c.reviews.filter((r) => r.status === 'APPROVED').length;
      const kind = KIND_LABEL[c.kind] ?? { type: c.kind, format: c.kind };
      return {
        id: c.id,
        publicId: c.publicId.toString(),
        name: c.name,
        cm360Id: c.cm360Id,
        status: c.status === 'ACTIVE' ? 'Active' : c.status === 'PAUSED' ? 'Paused' : 'Archived',
        type: kind.type,
        format: kind.format,
        aiLabel:
          c.aiLabel === 'AI_GENERATED'
            ? 'Labeled'
            : c.aiLabel === 'NOT_AI_GENERATED'
              ? 'Not labeled'
              : '-',
        dv360Status: REVIEW_LABEL[c.dv360Review] ?? c.dv360Review,
        exchangeStatus: c.reviews.length
          ? `${approved === c.reviews.length ? 'Servable' : approved ? 'Servable' : 'Not servable'} (${approved} of ${c.reviews.length})`
          : '-',
        dimensions: c.width && c.height ? `${c.width}×${c.height}` : null,
        source: SOURCE_LABEL[c.source] ?? c.source,
        created: c.createdAt.toISOString(),
        eligible: formatOk && servable,
        ...(!formatOk
          ? { reason: format(MSG.CREATIVE_NOT_ALLOWED, { Type: LI_TYPE_LABEL[type] }) }
          : !servable
            ? { reason: "This creative can't be assigned because it isn't servable." }
            : {}),
      };
    });
}

/** Creative candidates for a draft in `ioId` (Δ-08-5) or a stored line item. */
export async function getCreativeCandidates(
  user: SessionUser,
  ioId: string,
  draft: { type: LiType; adType?: 'DISPLAY' | 'VIDEO' | null },
): Promise<CreativePickerRow[]> {
  const out = await inSandbox(user, async (tx) => {
    const io = await loadIo(tx, ioId);
    return io ? creativeRows(tx, io, draft) : [];
  });
  return out ?? [];
}

/** `assignCreatives(liId, { add, remove })` (L13). Ineligible creatives are refused with LI-060 / LI-061. */
export async function assignCreatives(
  user: SessionUser,
  liId: string,
  change: { add?: string[]; remove?: string[] },
): Promise<Result<{ assigned: string[] }>> {
  if (!canWrite(user)) return forbidden();
  return withSandbox(user.sandboxId!, async (tx) => {
    const stored = await loadLi(tx, liId);
    if (!stored) return notFound();
    const io = await loadIo(tx, stored.ioId);
    if (!io) return notFound();
    const value = await rowToForm(tx, stored, io.row.advertiser.partnerId);
    const add = change.add ?? [];
    const next = [
      ...value.creatives.filter((id) => !(change.remove ?? []).includes(id)),
      ...add.filter((id) => !value.creatives.includes(id)),
    ];
    const ctx = await buildLiContext(tx, user, io, value);
    const known = ctx.lookups.creatives;
    const unknown = add.filter((id) => !known?.has(id));
    if (unknown.length)
      return {
        ok: false as const,
        issues: [issue('LI-060', 'creatives', "This creative doesn't exist.")],
      };
    const issues = validate(
      'lineItem',
      toValidationInput({ ...value, creatives: next }, io.currency),
      ctx,
      { trigger: 'save' },
    ).filter((i) => i.blocking && i.path.startsWith('creatives'));
    if (issues.length) return { ok: false as const, issues };
    const cctx = await changeCtx(user, tx);
    await withChangeLog(
      cctx,
      {
        type: 'LINE_ITEM',
        id: stored.id,
        chain: {
          advertiserId: stored.advertiserId,
          campaignId: stored.campaignId,
          ioId: stored.ioId,
          lineItemId: stored.id,
        },
      },
      async (t) => {
        const remove = value.creatives.filter((id) => !next.includes(id));
        if (remove.length)
          await t.creativeAssignment.deleteMany({
            where: { lineItemId: stored.id, creativeId: { in: remove } },
          });
        const added = next.filter((id) => !value.creatives.includes(id));
        if (added.length)
          await t.creativeAssignment.createMany({
            data: added.map((creativeId) => ({
              sandboxId: stored.sandboxId,
              lineItemId: stored.id,
              creativeId,
              assignedById: user.actor?.id ?? user.id,
            })),
          });
        return { id: stored.id };
      },
    );
    return { ok: true as const, data: { assigned: next } };
  });
}

async function conversionRows(tx: Tx, advertiserId: string): Promise<ConversionPickerRow[]> {
  const rows = await tx.floodlightActivity.findMany({
    where: { status: 'ACTIVE', group: { advertiserId } },
    orderBy: { name: 'asc' },
  });
  return rows.map((r) => ({
    id: r.id,
    publicId: r.publicId.toString(),
    name: r.name,
    source: 'Google tag',
    type: r.type === 'SALE' ? 'SALE' : 'COUNTER',
    countingMethod: r.countingMethod
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/^./, (c) => c.toUpperCase()),
  }));
}

/** Active Floodlight activities of the advertiser (L15, AC-08-12). */
export async function getConversionCandidates(
  user: SessionUser,
  advertiserId: string,
): Promise<ConversionPickerRow[]> {
  return (await inSandbox(user, (tx) => conversionRows(tx, advertiserId))) ?? [];
}

// ---------------------------------------------------------------------------------------------
// Lists (L1)
// ---------------------------------------------------------------------------------------------

function scopeWhere(scope: LiListScope): Prisma.LineItemWhereInput {
  switch (scope.kind) {
    case 'io':
      return { ioId: scope.id };
    case 'campaign':
      return { campaignId: scope.id };
    case 'advertiser':
      return { advertiserId: scope.id };
    case 'audience':
      return {
        targeting: { some: { dimension: 'AUDIENCE_LIST', refType: 'AUDIENCE', refId: scope.id } },
      };
  }
}

const GOAL_LABEL: Record<string, string> = {
  BRAND_AWARENESS: 'Brand awareness',
  CLICKS: 'Clicks',
  CONVERSIONS: 'Conversions',
  CUSTOM: 'Custom',
  NONE: '-',
};

export async function listLineItems(
  user: SessionUser,
  scope: LiListScope,
  query: LiListQuery = {},
  range: { from: string; to: string } = { from: '2000-01-01', to: '2100-01-01' },
): Promise<LiListResult | null> {
  const pageSize = query.pageSize ?? 50;
  const page = Math.max(1, query.page ?? 1);
  const out = await inSandbox(user, async (tx) => {
    const statuses = query.status?.length ? query.status : (['DRAFT', 'ACTIVE', 'PAUSED'] as const);
    const q = query.q?.trim();
    const idQuery = q && /^\d+$/.test(q) ? BigInt(q) : null;
    const where: Prisma.LineItemWhereInput = {
      ...scopeWhere(scope),
      status: { in: [...statuses] },
      ...(query.type?.length ? { type: { in: query.type } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              ...(idQuery !== null ? [{ publicId: idQuery }] : []),
            ],
          }
        : {}),
    };
    const sort = query.sort ?? { field: 'name' as const, dir: 'asc' as const };
    const [total, rows] = await Promise.all([
      tx.lineItem.count({ where }),
      tx.lineItem.findMany({
        where,
        orderBy: [{ [sort.field]: sort.dir }, { publicId: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          io: { select: { publicId: true, objective: true, kpi: true } },
          campaign: { select: { publicId: true } },
          advertiser: { select: { currencyCode: true } },
        },
      }),
    ]);
    const alerts = rows.length
      ? await tx.alert.groupBy({
          by: ['lineItemId'],
          where: { lineItemId: { in: rows.map((r) => r.id) }, state: 'OPEN' },
          _count: { _all: true },
        })
      : [];
    const currencyRow =
      rows[0]?.advertiser.currencyCode ??
      (scope.kind === 'advertiser'
        ? (
            await tx.advertiser.findUnique({
              where: { id: scope.id },
              select: { currencyCode: true },
            })
          )?.currencyCode
        : null);
    return { total, rows, alerts, currency: currencyRow ?? 'INR' };
  });
  if (!out) return null;
  const metrics = await getGridMetrics({
    level: 'li',
    ids: out.rows.map((r) => r.id),
    range,
    sandboxId: user.sandboxId!,
  });
  const alertCount = new Map(out.alerts.map((a) => [a.lineItemId, a._count._all]));
  const rows: LineItemRow[] = out.rows.map((r) => {
    const m = metrics[r.id];
    const youtube = r.type === 'YT_VIDEO' || r.type === 'YT_AUDIO' || r.type === 'YT_ON_CTV';
    return {
      id: r.id,
      publicId: r.publicId.toString(),
      ioId: r.ioId,
      ioPublicId: r.io.publicId.toString(),
      campaignPublicId: r.campaign.publicId.toString(),
      name: r.name,
      status: (r.status === 'SCHEDULED_FOR_DELETION' ? 'ARCHIVED' : r.status) as LiStatus,
      alertCount: alertCount.get(r.id) ?? 0,
      type: r.type as LiType,
      budget: r.budgetMode === 'FIXED' && r.budgetAmount ? Number(r.budgetAmount) : null,
      goal: r.io.kpi ?? GOAL_LABEL[r.io.objective] ?? '-',
      impressions: m?.impressions ?? 0,
      revenue: m?.revenue ?? 0,
      clicks: m?.clicks ?? 0,
      conversions: m?.conversions ?? 0,
      cpa: m && m.conversions > 0 ? m.cpa : null,
      customValueCost:
        m && m.customImpressionCost > 0 ? m.customImpressionValue / m.customImpressionCost : null,
      ...(youtube ? { trueViewViews: 0 } : {}),
    };
  });
  const sum = (k: 'impressions' | 'revenue' | 'clicks' | 'conversions') =>
    rows.reduce((s, r) => s + r[k], 0);
  return {
    rows,
    total: out.total,
    page,
    pageSize,
    totalsRow: {
      impressions: sum('impressions'),
      revenue: sum('revenue'),
      clicks: sum('clicks'),
      conversions: sum('conversions'),
    },
    currency: out.currency as LiListResult['currency'],
    asOf: new Date().toISOString(),
  };
}
