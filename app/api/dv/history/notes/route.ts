// A GET list of the notes of one day and entity (routes.md 8.17). Adding and deleting are server actions.
import { NextResponse, type NextRequest } from 'next/server';
import { listHistoryNotes } from '@/lib/history/notes';
import { HISTORY_ENTITY_TYPES, type HistoryEntityType } from '@/lib/history/types';
import { withUser } from '@/lib/history/api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const entityType = p.get('entityType') as HistoryEntityType | null;
  const entityId = p.get('entityId');
  const date = p.get('date');
  if (!entityType || !entityId || !date || !HISTORY_ENTITY_TYPES.includes(entityType)) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }
  return withUser(async (user) =>
    NextResponse.json(await listHistoryNotes(user, { entityType, entityId, date }), {
      headers: { 'Cache-Control': 'no-store' },
    }),
  );
}
