// A GET list of the bell's announcements for the viewer (routes.md 8.1). The bell polls this every 30 seconds.
import { NextResponse } from 'next/server';
import { listNotifications } from '@/lib/history/notifications';
import { withUser } from '@/lib/history/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  return withUser(async (user) =>
    NextResponse.json(await listNotifications(user), { headers: { 'Cache-Control': 'no-store' } }),
  );
}
