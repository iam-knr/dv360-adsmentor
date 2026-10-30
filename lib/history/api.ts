import 'server-only';
// Shared plumbing of the History routes (routes.md 8.17): query parsing and the ServiceFailure to HTTP mapping.
import { NextResponse, type NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { ServiceFailure } from '@/lib/campaigns/service-kit';
import type { SessionUser } from '@/lib/auth/types';
import { HISTORY_ENTITY_TYPES, type HistoryEntityType, type HistoryQuery } from './types';

export function parseHistoryQuery(req: NextRequest): HistoryQuery | null {
  const p = req.nextUrl.searchParams;
  const entityType = p.get('entityType') as HistoryEntityType | null;
  const entityId = p.get('entityId');
  if (!entityType || !entityId || !HISTORY_ENTITY_TYPES.includes(entityType)) return null;
  return {
    entityType,
    entityId,
    d: p.get('d'),
    includeSystem: p.get('s') === '1',
    tz: p.get('tz') === 'local' ? 'local' : 'advertiser',
    zone: p.get('zone'),
    cursor: p.get('cursor'),
  };
}

export async function withUser(
  fn: (user: SessionUser) => Promise<NextResponse>,
): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  try {
    return await fn(user);
  } catch (e) {
    if (e instanceof ServiceFailure) {
      const status = e.code === 'FORBIDDEN' ? 403 : e.code === 'NOT_FOUND' ? 404 : 400;
      return NextResponse.json({ error: e.code, issues: e.issues }, { status });
    }
    throw e;
  }
}
