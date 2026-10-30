import { notFound } from 'next/navigation';
import { AlertPreferencesForm } from '@/components/settings/AlertPreferencesForm';
import { requireView } from '@/lib/scope/guard';
import { getAlertPreferences } from '@/lib/settings/alert-prefs';

export const metadata = { title: 'Alert preferences' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
}) {
  const user = await requireView('RO');
  const { advertiserId } = await params;
  const res = await getAlertPreferences(user, advertiserId);
  if (!res.ok) notFound();
  const d = res.data;
  return (
    <AlertPreferencesForm
      advertiserId={advertiserId}
      initial={d.prefs}
      currencyCode={d.currencyCode}
      version={d.version}
      canWrite={d.canWrite}
      emailHref="/email-preferences"
    />
  );
}
