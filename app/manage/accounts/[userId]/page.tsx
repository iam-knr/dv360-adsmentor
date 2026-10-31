import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { AccountActions } from '@/components/manage/AccountActions';
import { ScreenshotSection } from '@/components/manage/ScreenshotSection';
import { SandboxSection } from '@/components/manage/SandboxSection';
import { DvSectionCard } from '@/components/dv/DvSectionCard';
import { can, type Target } from '@/lib/accounts/permissions';
import { AccountError } from '@/lib/accounts/rules';
import { DEFAULT_COHORT_CODE, getAccount } from '@/lib/accounts/service';
import { pageActor } from '@/lib/accounts/session-actor';
import { formatDateTime } from '@/lib/auth/messages';
import { screenshotMethodLabel } from '@/lib/security/screenshot-detect';

export const metadata: Metadata = { title: 'Account | DV360 Simulator by Adsmetor' };
// the Create / Retry sandbox action runs a build step
export const maxDuration = 60;

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
  const target: Target = { id: a.id, role: a.appRole };
  const perm = (action: Parameters<typeof can>[1]) => can(actor, action, target);
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
        <Typography>Level: {a.appRole === 'USER' ? 'Student' : 'Super admin'}</Typography>
        <Typography>Status: {a.status}</Typography>
        {a.appRole === 'USER' ? (
          <Typography>
            Cohort:{' '}
            {a.cohort && a.cohort.code !== DEFAULT_COHORT_CODE ? (
              <Link href={`/manage/cohorts/${a.cohort.id}`}>{a.cohort.name}</Link>
            ) : (
              'None'
            )}
          </Typography>
        ) : null}
        <Typography>
          Ask for a new password at next sign in: {a.mustChangePassword ? 'Yes' : 'No'}
        </Typography>
        <Typography>
          Created by {a.createdBy?.name ?? '-'} on {when(a.createdAt)}
        </Typography>
      </DvSectionCard>
      {a.appRole === 'USER' ? (
        <DvSectionCard title="Screenshots">
          <ScreenshotSection
            id={a.id}
            name={a.name}
            screenshotsAllowed={a.screenshotsAllowed}
            canChange={perm('account.screenshots')}
            suspension={
              a.accessSuspendedAt
                ? {
                    at: formatDateTime(a.accessSuspendedAt),
                    method: screenshotMethodLabel(a.accessSuspendedMethod),
                    path: a.accessSuspendedPath ?? '/',
                  }
                : null
            }
          />
        </DvSectionCard>
      ) : null}
      <DvSectionCard title="Security">
        <Typography>Last sign in: {when(a.lastLoginAt)}</Typography>
        <Typography>Failed attempts since last success: {a.failedLoginCount}</Typography>
        <Typography>Locked until: {a.lockedUntil ? when(a.lockedUntil) : '-'}</Typography>
        <Typography>Password changed: {when(a.passwordChangedAt)}</Typography>
      </DvSectionCard>
      {a.appRole === 'USER' ? (
        <DvSectionCard title="Sandbox">
          <SandboxSection
            id={a.id}
            studentName={a.name}
            initial={data.sandbox ?? { state: 'NOT_CREATED', percent: 0, message: 'Not created' }}
            canRecover={a.status !== 'ARCHIVED' && perm('account.edit')}
          />
        </DvSectionCard>
      ) : null}
      <DvSectionCard title="Activity">
        {data.activity.length ? (
          data.activity.map((r) => (
            <Typography key={r.id} variant="body2">
              {when(r.createdAt)}: {r.summary}
              {r.actorName ? ` (by ${r.actorName})` : ''}
            </Typography>
          ))
        ) : (
          <Typography variant="body2">No activity yet.</Typography>
        )}
      </DvSectionCard>
    </Box>
  );
}
