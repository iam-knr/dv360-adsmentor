import { notFound } from 'next/navigation';
import { DvPageHeader } from '@/components/dv';
import { EmailPreferencesForm } from '@/components/settings/EmailPreferencesForm';
import { requireView } from '@/lib/scope/guard';
import { getEmailPreferences } from '@/lib/settings/users';

export const metadata = { title: 'Email preferences' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await requireView('ANY');
  const res = await getEmailPreferences(user);
  if (!res.ok) notFound();
  return (
    <>
      <DvPageHeader title="Email preferences" />
      <EmailPreferencesForm
        initial={res.data}
        canWrite={!user.viewAs || Boolean(user.viewAs.actAs)}
      />
    </>
  );
}
