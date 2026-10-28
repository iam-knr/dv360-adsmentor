import type { Metadata } from 'next';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { SimCard } from '@/components/sim/SimCard';
import { sessionEndMessage } from '@/lib/auth/messages';

export const metadata: Metadata = { title: 'Session ended | DV360 Simulator by Adsmetor' };

export default async function SessionExpiredPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  return (
    <SimCard title="Session ended">
      <Typography>{sessionEndMessage(reason)}</Typography>
      <Button href="/sim/login" variant="contained">
        Sign in
      </Button>
    </SimCard>
  );
}
