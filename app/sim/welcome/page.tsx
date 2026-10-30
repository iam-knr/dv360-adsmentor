import type { Metadata } from 'next';
import Typography from '@mui/material/Typography';
import { ProvisionProgress } from '@/components/sim/ProvisionProgress';
import { SimCard } from '@/components/sim/SimCard';
import { requireOpenClass } from '@/lib/access/guard';
import { requireUserOrRedirect } from '@/lib/auth/session';
import { getProvisionView } from '@/lib/sandbox/provision';
import { partnerIdOf } from '@/lib/seed/sandbox';

export const metadata: Metadata = { title: 'Welcome | DV360 Simulator by Adsmetor' };
export const maxDuration = 60;

// Landing page for Users. While the sandbox is built (module 18 4.4, M18-05) it shows the progress and drives the job.
export default async function WelcomePage() {
  const user = await requireUserOrRedirect();
  await requireOpenClass(user);
  const view =
    user.appRole === 'user' && user.classroomId
      ? await getProvisionView(user.id, user.classroomId)
      : null;
  return (
    <SimCard title={`Welcome, ${user.name}`}>
      {view ? (
        <ProvisionProgress
          initial={{
            ...view,
            ...(view.state === 'READY' && view.sandboxId
              ? { overview: `/p/${partnerIdOf(view.sandboxId)}/home_v3` }
              : {}),
          }}
        />
      ) : (
        <Typography>Your class is open.</Typography>
      )}
    </SimCard>
  );
}
