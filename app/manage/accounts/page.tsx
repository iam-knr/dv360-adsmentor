import type { Metadata } from 'next';
import { AccountsList, type AccountListRow } from '@/components/manage/AccountsList';
import { pageActor } from '@/lib/accounts/session-actor';
import { listAccounts } from '@/lib/accounts/service';
import { formatDate } from '@/lib/auth/messages';

export const metadata: Metadata = { title: 'Accounts | DV360 Simulator by Adsmetor' };

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; pageSize?: string; archived?: string }>;
}) {
  const actor = await pageActor();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = [20, 50, 100].includes(Number(sp.pageSize)) ? Number(sp.pageSize) : 20;
  const showArchived = sp.archived === '1';
  const { rows, total } = await listAccounts(actor, {
    search: sp.search,
    page,
    pageSize,
    status: showArchived ? ['ACTIVE', 'DISABLED', 'LOCKED', 'ARCHIVED'] : undefined,
  });
  const view: AccountListRow[] = rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    appRole: r.appRole,
    status: r.status,
    cohortName: r.cohortName,
    ownerAdminName: r.ownerAdminName,
    period:
      r.appRole === 'USER' && (r.accessStartsAt || r.accessEndsAt)
        ? `${r.accessStartsAt ? formatDate(r.accessStartsAt) : '…'} to ${r.accessEndsAt ? formatDate(r.accessEndsAt) : '…'}`
        : 'No limit',
    lastLogin: r.lastLoginAt ? formatDate(r.lastLoginAt) : 'Never',
    sandbox: r.sandbox,
    isSelf: r.id === actor.id,
  }));
  return (
    <AccountsList
      rows={view}
      total={total}
      page={page}
      pageSize={pageSize}
      search={sp.search ?? ''}
      showArchived={showArchived}
      isSuper={actor.role === 'SUPER_ADMIN'}
    />
  );
}
