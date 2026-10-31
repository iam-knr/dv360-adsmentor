import 'server-only';
// Result to HTTP for the search routes (routes.md 8.0): 200 with the data, 400 INVALID, 403, 404.
import { NextResponse } from 'next/server';
import type { Result } from '@/lib/campaigns/service-kit';

export function searchHttp<T>(result: Result<T>): NextResponse {
  const headers = { 'Cache-Control': 'no-store' };
  if (result.ok) return NextResponse.json(result.data, { headers });
  const status = result.code === 'FORBIDDEN' ? 403 : result.code === 'NOT_FOUND' ? 404 : 400;
  return NextResponse.json({ error: result.code, issues: result.issues }, { status, headers });
}
