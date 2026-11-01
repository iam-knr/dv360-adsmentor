import type { Metadata } from 'next';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { CaptureLab } from '@/components/manage/CaptureLab';
import { pageActor } from '@/lib/accounts/session-actor';

export const metadata: Metadata = { title: 'Capture lab | DV360 Simulator by Adsmetor' };
export const dynamic = 'force-dynamic';

export default async function CaptureLabPage() {
  await pageActor(); // Super admin only, like the rest of /manage
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Link href="/manage/security" underline="hover" variant="body2">
        Back to Security
      </Link>
      <Typography variant="pageTitle" component="h1">
        Capture lab
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 760 }}>
        Press the screenshot shortcuts you want to test (Print Screen, Win+Shift+S, Ctrl+Shift+S, Cmd+Shift+4, ...)
        and see exactly which events this browser delivers to the page, and whether the screenshot guard would trip.
        Nothing here suspends anyone: it is a log in this page only. Events are not sent to the server or stored,
        and the log is gone when you leave or clear it. Use it to tune the guard for your browsers.
      </Typography>
      <CaptureLab />
    </Box>
  );
}
