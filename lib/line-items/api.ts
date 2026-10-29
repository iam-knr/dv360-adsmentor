// Plumbing of the line item route handlers (routes.md 8.6): query parsing and the Result to HTTP mapping.
// Pure, so tests/unit can cover it without a server.
import { z } from 'zod';
import { LI_TYPES } from '@/lib/validation/constants/li-compat';
import type { LiType } from '@/lib/validation/types';
import type { LiListQuery, LiListScope, LiStatus, Result } from './types';

const STATUSES: readonly LiStatus[] = ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'];
const SORT_FIELDS = ['name', 'publicId', 'status', 'type'] as const;
const SCOPES = ['io', 'campaign', 'advertiser', 'audience'] as const;
const MAX_PAGE_SIZE = 200;

const csv = (params: URLSearchParams, ...keys: string[]): string[] =>
  keys
    .flatMap((k) => params.getAll(k))
    .flatMap((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );

export type ParsedList =
  | { ok: true; scope: LiListScope; query: LiListQuery; range?: { from: string; to: string } }
  | { ok: false; message: string };

/** `?scope=io&id=…&q=&status=ACTIVE,PAUSED&type=DISPLAY&sort=name:asc&page=1&pageSize=50` (RC-052: archived is `status=ARCHIVED`). */
export function parseListParams(params: URLSearchParams): ParsedList {
  const scope = params.get('scope') ?? '';
  const id = params.get('id') ?? '';
  if (!(SCOPES as readonly string[]).includes(scope) || !id)
    return {
      ok: false,
      message: 'scope (io, campaign, advertiser or audience) and id are required.',
    };
  const status = csv(params, 'status', 'f.status');
  if (status.some((s) => !(STATUSES as readonly string[]).includes(s)))
    return { ok: false, message: 'Unknown status.' };
  const type = csv(params, 'type', 'f.type');
  if (type.some((t) => !(LI_TYPES as readonly string[]).includes(t)))
    return { ok: false, message: 'Unknown line item type.' };
  const query: LiListQuery = {};
  const q = params.get('q');
  if (q) query.q = q;
  if (status.length) query.status = status as LiStatus[];
  if (type.length) query.type = type as LiType[];
  const page = Number(params.get('page'));
  if (Number.isInteger(page) && page >= 1) query.page = page;
  const size = Number(params.get('pageSize'));
  if (Number.isInteger(size) && size >= 1) query.pageSize = Math.min(size, MAX_PAGE_SIZE);
  const sort = params.get('sort');
  if (sort) {
    const [field, dir = 'asc'] = sort.split(':');
    if (
      !(SORT_FIELDS as readonly string[]).includes(field ?? '') ||
      (dir !== 'asc' && dir !== 'desc')
    )
      return { ok: false, message: 'Unknown sort.' };
    query.sort = { field: field as (typeof SORT_FIELDS)[number], dir };
  }
  const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
  const from = day.safeParse(params.get('from'));
  const to = day.safeParse(params.get('to'));
  return {
    ok: true,
    scope: { kind: scope as LiListScope['kind'], id },
    query,
    ...(from.success && to.success ? { range: { from: from.data, to: to.data } } : {}),
  };
}

const writeBody = z.object({
  ioId: z.string().min(1).optional(),
  value: z.record(z.string(), z.unknown()),
  note: z.string().max(500).optional(),
  expectedVersion: z.number().int().optional(),
});
export type WriteBody = z.infer<typeof writeBody>;

export function parseWriteBody(raw: unknown): { ok: true; body: WriteBody } | { ok: false } {
  const r = writeBody.safeParse(raw);
  return r.success ? { ok: true, body: r.data } : { ok: false };
}

export const HTTP_STATUS = { FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409 } as const;

/** Body and status of a service `Result`: 200 with `data` and `warnings`, 403/404/409 by code, 422 for rule issues. */
export function resultToHttp<T>(res: Result<T>, okStatus = 200): { status: number; body: unknown } {
  if (res.ok) return { status: okStatus, body: { data: res.data, warnings: res.warnings ?? [] } };
  return {
    status: res.code ? HTTP_STATUS[res.code] : 422,
    body: { error: res.code ?? 'VALIDATION', issues: res.issues },
  };
}

export const NO_STORE = { 'Cache-Control': 'no-store' };
export const unauthenticated = () =>
  Response.json({ error: 'UNAUTHENTICATED' }, { status: 401, headers: NO_STORE });
export const badRequest = (message: string) =>
  Response.json({ error: 'BAD_REQUEST', message }, { status: 400, headers: NO_STORE });
export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: NO_STORE });
