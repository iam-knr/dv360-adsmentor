import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  let db = false;
  try {
    await prisma.$queryRaw`select 1`;
    await prisma.appMeta.findFirst();
    db = true;
  } catch {
    db = false;
  }
  return NextResponse.json({
    ok: true,
    db,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev',
  });
}
