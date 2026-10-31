import 'server-only';
// Targeting templates (module 10 2.7, 4.0 G7 to G12): list, read, create, update, archive and unarchive. Applying a
// template to a line item is done by the line item form (copy on apply), so a template change never touches a line item.
import { withChangeLog } from '@/lib/changelog';
import { withSandbox } from '@/lib/db';
import type { SessionUser } from '@/lib/auth/types';
import {
  emptyTargetingState,
  loadTemplateState,
  persistTemplateTargeting,
  type TargetingState,
} from '@/lib/targeting';
import { LIMITS } from '@/lib/validation/constants/limits';
import { LI_TYPE_LABEL, type LiType } from '@/lib/validation/constants/li-compat';
import { TEMPLATE_TYPES } from '@/lib/validation/rules/template';
import { MSG, format } from '@/lib/validation/messages';
import {
  asResult,
  assertCan,
  changeCtx,
  failIf,
  idWhere,
  isLimited,
  loadAdvertiser,
  mayDo,
  notFound,
  serviceCtx,
  type Result,
} from '@/lib/settings/kit';
import type { SettingsIssue } from '@/lib/settings/rules';
import type { InventoryQualityKey } from './constants';

export interface TemplateRow {
  id: string;
  publicId: string;
  name: string;
  type: LiType;
  typeLabel: string;
  description: string;
  status: 'ACTIVE' | 'ARCHIVED';
  lastModified: string;
}

export interface TemplateList {
  rows: TemplateRow[];
  canWrite: boolean;
  limitedAccess: boolean;
}

export interface TemplateInput {
  type: LiType | null;
  name: string;
  description?: string;
  inventoryQuality: InventoryQualityKey;
  optimizedTargeting: boolean;
  state: TargetingState;
}

export interface TemplateDetail extends Omit<TemplateInput, 'type'> {
  id: string;
  publicId: string;
  type: LiType;
  status: 'ACTIVE' | 'ARCHIVED';
  canWrite: boolean;
  limitedAccess: boolean;
}

const issue = (code: string, path: string, message: string): SettingsIssue => ({
  path,
  severity: 'error',
  code,
  message,
});

/** TPL-001, TPL-003 to TPL-005 (TPL-002 is the info line of step 1, TPL-006 and TPL-007 belong to apply). */
export function validateTemplate(input: TemplateInput): SettingsIssue[] {
  const out: SettingsIssue[] = [];
  if (!input.type || !TEMPLATE_TYPES.includes(input.type))
    out.push(issue('TPL-001', 'type', MSG.SELECTION_REQUIRED));
  if (input.name.trim() === '') out.push(issue('TPL-003', 'name', MSG.ENTER_VALUE));
  else if ([...input.name].length > LIMITS.NAME_MAX_240)
    out.push(issue('TPL-004', 'name', format(MSG.MAX_CHARS, { max: LIMITS.NAME_MAX_240 })));
  if ([...(input.description ?? '')].length > LIMITS.TEMPLATE_DESC_MAX)
    out.push(
      issue('TPL-005', 'description', format(MSG.MAX_CHARS, { max: LIMITS.TEMPLATE_DESC_MAX })),
    );
  return out;
}

export async function listTemplates(user: SessionUser, aid: string): Promise<Result<TemplateList>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const a = await loadAdvertiser(tx, aid);
      const rows = await tx.targetingTemplate.findMany({
        where: { advertiserId: a.id },
        orderBy: { updatedAt: 'desc' },
      });
      return {
        data: {
          rows: rows.map((t) => ({
            id: t.id,
            publicId: t.publicId.toString(),
            name: t.name,
            type: t.lineItemType,
            typeLabel: LI_TYPE_LABEL[t.lineItemType],
            description: t.description ?? '',
            status: t.status === 'ARCHIVED' ? ('ARCHIVED' as const) : ('ACTIVE' as const),
            lastModified: t.updatedAt.toISOString(),
          })),
          canWrite: mayDo(ctx, 'entity.write'),
          limitedAccess: isLimited(ctx),
        },
      };
    });
  });
}

/** Blank state of the card for step 2 of New (pre-added rows of the type, module 10 MX-10). */
export const newTemplateState = (type: LiType): TargetingState => emptyTargetingState(type);

export async function getTemplate(
  user: SessionUser,
  aid: string,
  templateId: string,
): Promise<Result<TemplateDetail>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const a = await loadAdvertiser(tx, aid);
      const t = await tx.targetingTemplate.findFirst({
        where: { advertiserId: a.id, ...idWhere(templateId) },
      });
      if (!t) throw notFound();
      const loaded = await loadTemplateState(tx, t.id);
      const type = t.lineItemType;
      return {
        data: {
          id: t.id,
          publicId: t.publicId.toString(),
          type,
          name: t.name,
          description: t.description ?? '',
          inventoryQuality: t.inventoryQuality,
          optimizedTargeting: t.optimizedTargeting,
          status: t.status === 'ARCHIVED' ? ('ARCHIVED' as const) : ('ACTIVE' as const),
          state: loaded?.state ?? emptyTargetingState(type),
          canWrite: mayDo(ctx, 'entity.write'),
          limitedAccess: isLimited(ctx),
        },
      };
    });
  });
}

/** G9. ChangeLog entityType TARGETING_TEMPLATE CREATE. */
export async function createTemplate(
  user: SessionUser,
  aid: string,
  input: TemplateInput,
): Promise<Result<{ id: string; publicId: string }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertCan(ctx, 'entity.write');
    return withSandbox(ctx.sandboxId, async (tx) => {
      const a = await loadAdvertiser(tx, aid);
      failIf(validateTemplate(input));
      const created = await withChangeLog(
        changeCtx(ctx, tx),
        { type: 'TARGETING_TEMPLATE', chain: { advertiserId: a.id } },
        async (t) => {
          const row = await t.targetingTemplate.create({
            data: {
              sandboxId: ctx.sandboxId,
              advertiserId: a.id,
              name: input.name.trim(),
              description: input.description?.trim() || null,
              lineItemType: input.type!,
              inventoryQuality: input.inventoryQuality,
              optimizedTargeting: input.optimizedTargeting,
              exchangeIds: [],
            },
            select: { id: true, publicId: true },
          });
          await persistTemplateTargeting(t, row.id, input.state);
          return row;
        },
      );
      return { data: { id: created.id, publicId: created.publicId.toString() } };
    });
  });
}

/** G11. Existing line items are unaffected (copy on apply). The type cannot change. */
export async function updateTemplate(
  user: SessionUser,
  aid: string,
  templateId: string,
  input: Omit<TemplateInput, 'type'>,
): Promise<Result<null>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertCan(ctx, 'entity.write');
    return withSandbox(ctx.sandboxId, async (tx) => {
      const a = await loadAdvertiser(tx, aid);
      const t = await tx.targetingTemplate.findFirst({
        where: { advertiserId: a.id, ...idWhere(templateId) },
      });
      if (!t) throw notFound();
      failIf(validateTemplate({ ...input, type: t.lineItemType }));
      await withChangeLog(
        changeCtx(ctx, tx),
        { type: 'TARGETING_TEMPLATE', id: t.id, chain: { advertiserId: a.id } },
        async (x) => {
          await x.targetingTemplate.update({
            where: { id: t.id },
            data: {
              name: input.name.trim(),
              description: input.description?.trim() || null,
              inventoryQuality: input.inventoryQuality,
              optimizedTargeting: input.optimizedTargeting,
            },
          });
          await persistTemplateTargeting(x, t.id, input.state);
        },
      );
      return { data: null };
    });
  });
}

/** G12. Archived templates are not offered in line item carousels. */
export async function setTemplateStatus(
  user: SessionUser,
  aid: string,
  templateId: string,
  status: 'ACTIVE' | 'ARCHIVED',
): Promise<Result<null>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertCan(ctx, 'entity.write');
    return withSandbox(ctx.sandboxId, async (tx) => {
      const a = await loadAdvertiser(tx, aid);
      const t = await tx.targetingTemplate.findFirst({
        where: { advertiserId: a.id, ...idWhere(templateId) },
      });
      if (!t) throw notFound();
      await withChangeLog(
        changeCtx(ctx, tx),
        { type: 'TARGETING_TEMPLATE', id: t.id, chain: { advertiserId: a.id } },
        (x) => x.targetingTemplate.update({ where: { id: t.id }, data: { status } }),
      );
      return { data: null };
    });
  });
}
