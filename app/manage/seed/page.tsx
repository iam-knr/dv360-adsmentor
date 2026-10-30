import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Typography from '@mui/material/Typography';
import { SimCard } from '@/components/sim/SimCard';
import { SeedForm } from '@/components/sim/SeedForm';
import { toDbRole } from '@/lib/auth/roles';
import { requireUserOrRedirect } from '@/lib/auth/session';
import { seedDemoAction } from './actions';

export const metadata: Metadata = { title: 'Seed | DV360 Simulator by Adsmetor' };
// Building three sandboxes takes about 15 seconds; leave room on a cold database.
export const maxDuration = 60;

export default async function SeedPage() {
  const user = await requireUserOrRedirect();
  if (toDbRole((user.actor ?? user).appRole) !== 'SUPER_ADMIN') notFound();
  return (
    <SimCard title="Seed the demo class" width={560}>
      <Typography>
        Creates the reference data, the Demo class cohort (three students, one sandbox each) and the
        three template sandboxes. Safe to run again: it never changes an existing password and skips
        sandboxes that are already up to date.
      </Typography>
      <SeedForm action={seedDemoAction} />
    </SimCard>
  );
}
