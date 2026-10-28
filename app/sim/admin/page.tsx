import type { Metadata } from 'next';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { SimCard } from '@/components/sim/SimCard';
import { requireUserOrRedirect } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Super admin | DV360 Simulator by Adsmetor' };

// Placeholder home for Super admins until /manage ships (P3-02b). The route guard is real.
export default async function AdminHomePage() {
  const user = await requireUserOrRedirect();
  return (
    <SimCard title="Super admin">
      <Typography>Signed in as {user.name}.</Typography>
      <Link href="/manage/accounts">Manage accounts</Link>
    </SimCard>
  );
}
