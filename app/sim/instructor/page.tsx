import type { Metadata } from 'next';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { SimCard } from '@/components/sim/SimCard';
import { requireUserOrRedirect } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Instructor | DV360 Simulator by Adsmetor' };

// Placeholder: the instructor console is built in Phase 5 (P5-01). The route guard is real.
export default async function InstructorHomePage() {
  const user = await requireUserOrRedirect();
  return (
    <SimCard title="Instructor console">
      <Typography>Signed in as {user.name}. The console arrives in a later release.</Typography>
      <Link href="/manage/accounts">Manage accounts</Link>
    </SimCard>
  );
}
