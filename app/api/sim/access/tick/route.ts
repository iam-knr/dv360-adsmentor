// Moves window statuses and freezes or unfreezes student sandboxes. Called by the same timer as the engine tick
// (Authorization: Bearer CRON_SECRET); the state route also calls it lazily.
import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { tickAccessWindows } from '@/lib/access/windows';

export const dynamic = 'force-dynamic';

function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
  const given = Buffer.from(header.startsWith('Bearer ') ? header.slice(7) : '');
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  const result = await tickAccessWindows(new Date());
  return NextResponse.json({ ok: true, ...result });
}
