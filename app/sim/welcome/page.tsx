import type { Metadata } from 'next';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { SimCard } from '@/components/sim/SimCard';
import { requireOpenClass } from '@/lib/access/guard';
import { requireUserOrRedirect } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Welcome | DV360 Simulator by Adsmetor' };

// Landing page for Users until P3-05b/P3-03 provide the sandbox and the Overview page.
export default async function WelcomePage() {
  const user = await requireUserOrRedirect();
  await requireOpenClass(user);
  const overview = user.partnerId ? `/p/${user.partnerId}/home_v3` : null;
  return (
    <SimCard title={`Welcome, ${user.name}`}>
      <Typography>
        Your class is open.{' '}
        {user.sandboxId
          ? 'Your practice account is ready.'
          : 'Your practice account is being prepared.'}
      </Typography>
      {overview ? (
        <Button href={overview} variant="contained">
          Open Overview
        </Button>
      ) : null}
    </SimCard>
  );
}
