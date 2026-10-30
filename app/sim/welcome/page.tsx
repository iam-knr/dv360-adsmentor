import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ProvisionProgress } from '@/components/sim/ProvisionProgress';
import { SimCard } from '@/components/sim/SimCard';
import { requireUserOrRedirect } from '@/lib/auth/session';
import { getProvisionView } from '@/lib/sandbox/provision';
import { homeFor } from '@/lib/scope/home';

export const metadata: Metadata = { title: 'Welcome | DV360 Simulator by Adsmetor' };
export const maxDuration = 60;

// Landing page for students. While the sandbox is built (module 18 4.4, M18-05) it shows the progress and drives the
// job; once it is ready the student goes straight to the sandbox home.
export default async function WelcomePage() {
  const user = await requireUserOrRedirect();
  // A Super admin has no sandbox of their own: the console is their home.
  if (user.appRole !== 'user' && !user.viewAs) redirect('/manage');
  const view = await getProvisionView(user.id);
  if (view.state === 'READY' && user.sandboxId && user.partnerId) redirect(await homeFor(user));
  if (view.state === 'NOT_CREATED' && !user.classroomId) notFound();
  return (
    <SimCard title={`Welcome, ${user.name}`}>
      <ProvisionProgress initial={view} />
    </SimCard>
  );
}
