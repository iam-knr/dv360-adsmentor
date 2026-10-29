import type { Metadata } from 'next';
import { AddAccountForm } from '@/components/manage/AddAccountForm';
import { pageActor } from '@/lib/accounts/session-actor';
import { listCohorts } from '@/lib/accounts/service';

export const metadata: Metadata = { title: 'Add account | DV360 Simulator by Adsmetor' };

export default async function NewAccountPage() {
  const actor = await pageActor();
  const cohorts = await listCohorts(actor);
  return (
    <AddAccountForm
      isSuper={actor.role === 'SUPER_ADMIN'}
      cohorts={cohorts.map((c) => ({ id: c.id, name: c.name, used: c.used, capacity: c.capacity }))}
      signInUrl={`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/sim/login`}
    />
  );
}
