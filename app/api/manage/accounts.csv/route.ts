import { NextResponse } from 'next/server';
import { actorOrResponse } from '@/lib/accounts/http';
import { toCsv } from '@/lib/accounts/csv';
import { listAccounts } from '@/lib/accounts/service';

export const dynamic = 'force-dynamic';

// GET /api/manage/accounts.csv: no passwords, no hashes. Cells are formula safe.
export async function GET() {
  const a = await actorOrResponse();
  if (a instanceof NextResponse) return a;
  const { rows } = await listAccounts(a, { pageSize: 100 });
  const body = toCsv(
    ['email', 'name', 'role', 'status', 'cohort', 'last_sign_in'],
    rows.map((r) => [
      r.email,
      r.name,
      r.appRole,
      r.status,
      r.cohortName ?? '',
      r.lastLoginAt?.toISOString() ?? '',
    ]),
  );
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="accounts.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
