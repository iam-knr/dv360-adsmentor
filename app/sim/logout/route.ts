import { NextResponse, type NextRequest } from 'next/server';
import { signOut } from '@/lib/auth';

async function signOutAndGoToLogin(req: NextRequest) {
  await signOut({ redirect: false });
  return NextResponse.redirect(new URL('/sim/login', req.nextUrl.origin), 303);
}

// The header button posts here.
export const POST = signOutAndGoToLogin;

// A typed or bookmarked address works too, but another site cannot sign a person out with a link or an image:
// browsers say where a request comes from, and a cross-site GET only goes to the login page.
export async function GET(req: NextRequest) {
  const site = req.headers.get('sec-fetch-site');
  if (site === 'cross-site' || site === 'same-site') {
    return NextResponse.redirect(new URL('/sim/login', req.nextUrl.origin), 303);
  }
  return signOutAndGoToLogin(req);
}
