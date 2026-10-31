import { notFound } from 'next/navigation';
import { UsersView } from '@/components/settings/UsersView';
import { requireView } from '@/lib/scope/guard';
import { listUsers } from '@/lib/settings/users';

export const metadata = { title: 'Users' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await requireView('RO');
  const res = await listUsers(user);
  if (!res.ok) notFound();
  return <UsersView data={res.data} />;
}
