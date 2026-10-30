import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import { SimHeader } from '@/components/sim/SimHeader';
import { requireUserOrRedirect } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const LINKS = [
  { href: '/sim/instructor', label: 'Dashboard' },
  { href: '/sim/instructor/classes', label: 'My classes' },
  { href: '/sim/instructor/sandboxes', label: 'Sandboxes' },
  { href: '/sim/instructor/announcements', label: 'Announcements' },
  { href: '/sim/instructor/requests', label: 'Requests' },
  { href: '/manage/accounts', label: 'Accounts' },
];

export default async function InstructorLayout({ children }: { children: ReactNode }) {
  const user = await requireUserOrRedirect();
  const who = user.actor ?? user;
  // middleware.ts already sends Users away; this is the authoritative check (module 18 4.11).
  if (who.appRole === 'user') redirect('/sim/forbidden');
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <SimHeader user={{ name: who.name, appRole: who.appRole }} />
      <Box sx={{ display: 'flex' }}>
        <Box
          component="nav"
          aria-label="Instructor console"
          sx={{
            width: 200,
            p: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            borderRight: 1,
            borderColor: 'divider',
            minHeight: 'calc(100vh - 64px)',
          }}
        >
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} underline="hover" color="inherit">
              {l.label}
            </Link>
          ))}
        </Box>
        <Box component="main" sx={{ flex: 1, p: 6, minWidth: 0 }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
