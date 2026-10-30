import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import { SimHeader } from '@/components/sim/SimHeader';
import { requireUserOrRedirect } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const LINKS = [
  { href: '/manage/accounts', label: 'Accounts' },
  { href: '/manage/cohorts', label: 'Cohorts' },
  { href: '/manage/audit', label: 'Audit log' },
  { href: '/manage/seed', label: 'Seed' },
  { href: '/manage/engine', label: 'Engine' },
];

export default async function ManageLayout({ children }: { children: ReactNode }) {
  const user = await requireUserOrRedirect();
  const who = user.actor ?? user;
  // The route guard in middleware.ts already sends students away; this is the authoritative check (module 19 4.6).
  if (who.appRole !== 'super_admin') notFound();
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <SimHeader user={{ name: who.name, appRole: who.appRole }} />
      <Box sx={{ display: 'flex' }}>
        <Box
          component="nav"
          aria-label="Account management"
          sx={{
            width: 200,
            p: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            borderRight: 1,
            borderColor: 'divider',
            minHeight: 'calc(100vh - 64px)',
            flexShrink: 0,
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
