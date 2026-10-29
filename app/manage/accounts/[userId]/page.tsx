import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { AccountActions } from '@/components/manage/AccountActions';
import { DvSectionCard } from '@/components/dv/DvSectionCard';
import { can, type Target } from '@/lib/accounts/permissions';
import { AccountError } from '@/lib/accounts/rules';
import { getAccount } from '@/lib/accounts/service';
import { pageActor } from '@/lib/accounts/session-actor';
import { formatDateTime } from '@/lib/auth/messages';

export const metadata: Metadata = { title: 'Account | DV360 Simulator by Adsmetor' };

const when = (d: Date | null | undefined) => (d ? formatDateTime(d) : 'Never');

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const actor = await pageActor();
  const { userId } = await params;
  let data;
  try {
    data = await getAccount(actor, userId);
  } catch (err) {
    if (err instanceof AccountError) notFound(); // same answer for missing and out of scope (ACC-022)
    throw err;
  }
  const a = data.account;
  const target: Target = { id: a.id, role: a.appRole, ownerAdminId: null, cohortOwnerId: null };
  // Scope was checked by getAccount; for the buttons treat an in-scope User as own.
  const own: Target = a.appRole === 'USER' ? { ...target, ownerAdminId: actor.id } : target;
  const perm = (action: Parameters<typeof can>[1]) =>
    can(actor, action, actor.role === 'SUPER_ADMIN' ? target : own);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 800 }}>
      <Typography variant="pageTitle" component="h1">
        {a.name}
      </Typography>
      <AccountActions
        id={a.id}
        email={a.email}
        status={a.status}
        can={{
          disable: perm('account.disable'),
          reset: perm('account.resetPassword'),
          unlock: perm('account.unlock'),
          revoke: perm('account.revokeSessions'),
          remove: perm('account.delete'),
          restore: perm('account.restore'),
        }}
      />
      <DvSectionCard title="Profile">
        <Typography>Email: {a.email}</Typography>
        {a.notes ? <Typography>Notes: {a.notes}</Typography> : null}
      </DvSectionCard>
      <DvSectionCard title="Access">
        <Typography>Role: {a.appRole}</Typography>
        <Typography>Status: {a.status}</Typography>
        <Typography>Cohort: {a.cohort?.name ?? '-'}</Typography>
        <Typography>Owner admin: {a.ownerAdmin?.name ?? '-'}</Typography>
        <Typography>
          Ask for a new password at next sign in: {a.mustChangePassword ? 'Yes' : 'No'}
        </Typography>
        <Typography>
          Created by {a.createdBy?.name ?? '-'} on {when(a.createdAt)}
        </Typography>
      </DvSectionCard>
      <DvSectionCard title="Security">
        <Typography>Last sign in: {when(a.lastLoginAt)}</Typography>
        <Typography>Failed attempts since last success: {a.failedLoginCount}</Typography>
        <Typography>Locked until: {a.lockedUntil ? when(a.lockedUntil) : '-'}</Typography>
        <Typography>Password changed: {when(a.passwordChangedAt)}</Typography>
      </DvSectionCard>
      {a.appRole === 'USER' ? (
        <DvSectionCard title="Sandbox">
          <Typography>NOT CREATED until the provisioning job (module 18) is merged.</Typography>
        </DvSectionCard>
      ) : null}
      <DvSectionCard title="Activity">
        {data.activity.length ? (
          data.activity.map((r) => (
            <Typography key={r.id} variant="body2">
              {when(r.createdAt)}: {r.action} ({r.result})
            </Typography>
          ))
        ) : (
          <Typography variant="body2">No activity yet.</Typography>
        )}
      </DvSectionCard>
    </Box>
  );
}
