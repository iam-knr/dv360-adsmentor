import { notFound } from 'next/navigation';
import { UserForm } from '@/components/settings/UserForm';
import { requireView } from '@/lib/scope/guard';
import { getUser } from '@/lib/settings/users';

export const metadata = { title: 'Edit user' };
export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ userId: string }> }) {
  const user = await requireView('ADM');
  const { userId } = await params;
  const res = await getUser(user, decodeURIComponent(userId));
  if (!res.ok) notFound();
  return <UserForm key={res.data.user.id} page={res.data.page} user={res.data.user} />;
}
