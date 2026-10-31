import { notFound } from 'next/navigation';
import { UserForm } from '@/components/settings/UserForm';
import { requireView } from '@/lib/scope/guard';
import { listUsers } from '@/lib/settings/users';

export const metadata = { title: 'New user' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await requireView('ADM');
  const res = await listUsers(user);
  if (!res.ok) notFound();
  const { rows: _rows, profile: _profile, ...page } = res.data;
  void _rows;
  void _profile;
  return <UserForm page={page} />;
}
