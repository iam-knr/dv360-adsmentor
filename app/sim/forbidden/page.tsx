import type { Metadata } from 'next';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { SimCard } from '@/components/sim/SimCard';
import { landingFor } from '@/lib/auth/roles';
import { requireUserOrRedirect } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Not allowed | DV360 Simulator by Adsmetor' };

export default async function ForbiddenPage() {
  const user = await requireUserOrRedirect();
  return (
    <SimCard title="You do not have access to this page">
      <Typography>
        Your account cannot open this page. If you think this is a mistake, ask your admin.
      </Typography>
      <Button href={landingFor(user.actor?.appRole ?? user.appRole)} variant="contained">
        Go to my home page
      </Button>
    </SimCard>
  );
}
