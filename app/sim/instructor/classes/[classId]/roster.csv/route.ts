import { NextResponse } from 'next/server';
import { toCsv } from '@/lib/accounts/csv';
import { actorOrResponse } from '@/lib/accounts/http';
import { InstructorError } from '@/lib/instructor/rules';
import { getRoster } from '@/lib/instructor/roster';

export const dynamic = 'force-dynamic';

// GET roster as CSV: names, emails and states only. No passwords and no hashes exist here to leak. Cells are formula safe.
export async function GET(_req: Request, { params }: { params: Promise<{ classId: string }> }) {
  const a = await actorOrResponse();
  if (a instanceof NextResponse) return a;
  const { classId } = await params;
  try {
    const roster = await getRoster(a, classId);
    const body = toCsv(
      ['name', 'email', 'account', 'sandbox', 'last_sign_in'],
      roster.rows.map((r) => [r.name, r.email, r.status, r.sandbox, r.lastLoginAt?.toISOString() ?? '']),
    );
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="roster.csv"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    if (err instanceof InstructorError && err.code === 'SIM-020') {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }
    throw err;
  }
}
