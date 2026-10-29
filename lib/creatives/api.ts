import 'server-only';
// Plumbing of the creative route handlers (routes.md 8.9): Result and ServiceFailure to HTTP.
import { ServiceFailure, type Result } from '@/lib/campaigns/service-kit';
import { json } from '@/lib/line-items/api';
import type { CreativeListQuery, CreativeStatus } from './types';

export { badRequest, json, unauthenticated } from '@/lib/line-items/api';

const STATUS = { FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409, INVALID: 422 } as const;

export function resultToHttp<T>(res: Result<T>, okStatus = 200): Response {
  if (res.ok) return json({ data: res.data, warnings: res.warnings ?? [] }, okStatus);
  return json({ error: res.code, issues: res.issues }, STATUS[res.code]);
}

/** Run a read; a `ServiceFailure` (foreign id, no view access) becomes its status. */
export async function readResponse<T>(fn: () => Promise<T>): Promise<Response> {
  try {
    return json(await fn());
  } catch (e) {
    if (e instanceof ServiceFailure)
      return json({ error: e.code, issues: e.issues }, STATUS[e.code]);
    throw e;
  }
}

const STATUSES: readonly CreativeStatus[] = ['ACTIVE', 'PAUSED', 'ARCHIVED'];
const SORTS = ['name', 'publicId', 'status', 'createdAt', 'updatedAt'] as const;

/** `?q=&status=ACTIVE,PAUSED&type=&format=&dv360Status=&page=&pageSize=&sort=createdAt:desc` (RC-052: `f.` prefix accepted). Null when invalid. */
export function parseListQuery(params: URLSearchParams): CreativeListQuery | null {
  const q: CreativeListQuery = {};
  const text = params.get('q');
  if (text) q.q = text;
  const status = (params.get('status') ?? params.get('f.status') ?? '').split(',').filter(Boolean);
  if (status.some((s) => !(STATUSES as readonly string[]).includes(s))) return null;
  if (status.length) q.status = status as CreativeStatus[];
  for (const key of ['type', 'format', 'source', 'lineItem', 'aiLabel'] as const) {
    const v = params.get(key) ?? params.get(`f.${key}`);
    if (v) q[key] = v;
  }
  const dv = params.get('dv360Status') ?? params.get('f.dv360Status');
  if (dv === 'PENDING' || dv === 'SERVABLE' || dv === 'NOT_SERVABLE') q.dv360Status = dv;
  const page = Number(params.get('page'));
  if (Number.isInteger(page) && page >= 1) q.page = page;
  const size = Number(params.get('pageSize'));
  if (Number.isInteger(size) && size >= 1) q.pageSize = Math.min(size, 200);
  const sort = params.get('sort');
  if (sort) {
    const [field, dir = 'asc'] = sort.split(':');
    if (!(SORTS as readonly string[]).includes(field ?? '') || (dir !== 'asc' && dir !== 'desc'))
      return null;
    q.sort = { field: field as (typeof SORTS)[number], dir };
  }
  return q;
}
