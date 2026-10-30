// Plumbing of the module 11 route handlers: Result to HTTP and body parsing.
import { z } from 'zod';
import type { Result } from '@/lib/campaigns/service-kit';
import { LIMITS } from '@/lib/validation/constants/limits';

export const NO_STORE = { 'Cache-Control': 'no-store' };
const STATUS = { FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409, INVALID: 422 } as const;

export const unauthenticated = () =>
  Response.json({ error: 'UNAUTHENTICATED' }, { status: 401, headers: NO_STORE });
export const badRequest = (message: string) =>
  Response.json({ error: 'BAD_REQUEST', message }, { status: 400, headers: NO_STORE });

export function respond<T>(res: Result<T>, okStatus = 200): Response {
  if (res.ok)
    return Response.json(
      { data: res.data, warnings: res.warnings ?? [] },
      { status: okStatus, headers: NO_STORE },
    );
  return Response.json(
    { error: res.code, issues: res.issues },
    { status: STATUS[res.code], headers: NO_STORE },
  );
}

const idList = z
  .array(z.string().regex(/^\d{1,19}$|^c[a-z0-9]{20,32}$/))
  .min(1)
  .max(LIMITS.BULK_MAX_ROWS);

const settingsPatch = z.record(z.string(), z.unknown());

export const bulkRequestSchema = z.object({
  ids: idList,
  params: z.discriminatedUnion('op', [
    z.object({ op: z.enum(['ACTIVATE', 'PAUSE', 'ARCHIVE', 'UNARCHIVE']) }),
    z.object({
      op: z.literal('DUPLICATE'),
      copies: z.number().int(),
      targetParentId: z.string().optional(),
    }),
    z.object({ op: z.literal('APPLY_TARGETING_TEMPLATE'), templateId: z.string().min(1) }),
    z.object({ op: z.literal('EDIT_SETTINGS'), patch: settingsPatch }),
    z.object({
      op: z.literal('EDIT_TARGETING'),
      edit: z.object({
        group: z.enum(['INVENTORY', 'CONTENT', 'AUDIENCE', 'TECHNOLOGY']),
        dimension: z.string(),
        mode: z.enum(['ADD', 'REPLACE', 'REMOVE']),
        value: z.unknown(),
      }),
    }),
    z.object({
      op: z.literal('EDIT_CREATIVE_ASSIGNMENT'),
      add: z.array(z.string()).optional(),
      remove: z.array(z.string()).optional(),
    }),
  ]),
});

export const sdfDownloadSchema = z.object({
  advertiserId: z.string().min(1),
  include: z.record(z.string(), z.boolean()).default({}),
  kind: z.enum(['DATA', 'QA', 'METADATA']).default('DATA'),
  version: z.enum(['9', '9.1', '9.2', '10', '10.1', '11']).optional(),
  includeArchived: z.boolean().optional(),
  selection: z
    .object({
      entity: z.enum(['campaign', 'insertionOrder', 'lineItem']),
      ids: z.array(z.string()).max(LIMITS.BULK_MAX_ROWS),
    })
    .optional(),
});
