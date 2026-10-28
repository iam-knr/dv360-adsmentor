import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { getSessionUser } from '@/lib/auth/session';
import { homeFor } from '@/lib/scope/home';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { icons: { icon: '/brand/adsmentor-icon.png' } };

// "/" (routes.md 3.1): a signed in person goes to their home (student: sandbox Overview). Signed out, the page stays
// public and offers the sign in.
export default async function HomePage() {
  const user = await getSessionUser();
  if (user) redirect(await homeFor(user));
  return (
    <Box
      component="main"
      sx={{ p: 8, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
      <img
        src="/brand/adsmentor-logo-horizontal.png"
        alt="AdsMentor"
        style={{ height: 48, width: 'auto' }}
      />
      <Typography variant="h4" component="h1">
        DV360 Simulator by Adsmetor
      </Typography>
      <Typography color="text.secondary">
        Practice Display &amp; Video 360 in a safe classroom sandbox.
      </Typography>
      <Button variant="contained" href="/sim/login">
        Sign in
      </Button>
    </Box>
  );
}
