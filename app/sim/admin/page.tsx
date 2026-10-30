import type { Metadata } from 'next';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { DvPageHeader } from '@/components/dv/DvPageHeader';
import { DvSectionCard } from '@/components/dv/DvSectionCard';
import { requireUserOrRedirect } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Super admin | DV360 Simulator by Adsmetor' };

const TOOLS = [
  ['/manage/accounts', 'Accounts', 'Every account, cohorts and policy.'],
  ['/sim/admin/classes', 'Classes', 'All classes, owners and seats.'],
  ['/sim/admin/seed', 'Seed', 'Reference data, demo class and template sandboxes.'],
  ['/sim/admin/engine', 'Engine', 'Engine parameter version and values.'],
  ['/sim/admin/audit', 'Audit log', 'Every instructor and admin action.'],
] as const;

export default async function AdminHomePage() {
  const user = await requireUserOrRedirect();
  return (
    <Box>
      <DvPageHeader title="Super admin" />
      <Typography sx={{ mb: 4 }}>Signed in as {user.actor?.name ?? user.name}.</Typography>
      <Box sx={{ display: 'grid', gap: 4, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {TOOLS.map(([href, title, text]) => (
          <DvSectionCard key={href} title={title}>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {text}
            </Typography>
            <Link href={href}>Open</Link>
          </DvSectionCard>
        ))}
      </Box>
    </Box>
  );
}
