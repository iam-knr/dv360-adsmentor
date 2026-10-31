import type { Metadata } from 'next';
import Typography from '@mui/material/Typography';
import { SimCard } from '@/components/sim/SimCard';
import { ACC_SUSPENDED } from '@/lib/auth/messages';

export const metadata: Metadata = { title: 'Access suspended | DV360 Simulator by Adsmetor' };

// Public on purpose: a suspended person has no valid session, and this page shows nothing about the account.
export default function SuspendedPage() {
  return (
    <SimCard title="Access suspended">
      <Typography role="alert">{ACC_SUSPENDED}</Typography>
    </SimCard>
  );
}
