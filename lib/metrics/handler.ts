import 'server-only';
// Shared body of the metrics route handlers (routes.md 8.0: session in every handler, the sandbox from the session,
// RLS scopes the rows).
import { NextResponse } from 'next/server';
import { resolveSession } from '@/lib/auth/session';
import { withSandbox, type Tx } from '@/lib/db';
import { can } from '@/lib/rbac/can';
import { resolveRangeForEntity } from './clock';
import { DateRangeParamError } from './date-range';
import { FxRateMissingError } from './fx';
import { parseMetricsQuery, type MetricsQuery } from './request';
import type { DateRange } from './types';

const NO_STORE = { 'Cache-Control': 'no-store' };

export interface ResolvedQuery extends MetricsQuery {
  sandboxId: string;
  range: DateRange;
  today: string;
  partnerCurrency: string | null;
}

export async function handleMetrics(
  request: Request,
  run: (tx: Tx, q: ResolvedQuery) => Promise<unknown>,
): Promise<Response> {
  const session = await resolveSession();
  if (!session.ok) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401, headers: NO_STORE });
  }
  const user = session.user;
  const sandboxId = user.sandboxId;
  if (!sandboxId || !can(user, 'view', { sandboxId })) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403, headers: NO_STORE });
  }
  const parsed = parseMetricsQuery(new URL(request.url).searchParams);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.code, message: parsed.message },
      { status: 400, headers: NO_STORE },
    );
  }
  try {
    const data = await withSandbox(sandboxId, async (tx) => {
      const q = parsed.query;
      const ctx = await resolveRangeForEntity(tx, sandboxId, q.level, q.ids[0], q.d);
      return run(tx, { ...q, sandboxId, ...ctx });
    });
    return NextResponse.json(data, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof DateRangeParamError) {
      return NextResponse.json(
        { error: 'BAD_RANGE', message: e.message },
        { status: 400, headers: NO_STORE },
      );
    }
    if (e instanceof FxRateMissingError) {
      return NextResponse.json(
        { error: 'FX_RATE_MISSING', message: e.message },
        { status: 422, headers: NO_STORE },
      );
    }
    throw e;
  }
}
