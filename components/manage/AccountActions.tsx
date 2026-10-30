'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { DvBanner } from '@/components/dv/DvBanner';
import {
  deleteAccountAction,
  restoreAccountAction,
  retrySandboxAction,
  resetPasswordAction,
  revokeSessionsAction,
  setAccountStatusAction,
  unlockAccountAction,
} from '@/lib/actions/accounts';
import { OneTimeSecret } from './OneTimeSecret';

export interface AccountActionsProps {
  id: string;
  email: string;
  status: 'ACTIVE' | 'DISABLED' | 'LOCKED' | 'ARCHIVED';
  can: {
    disable: boolean;
    reset: boolean;
    unlock: boolean;
    revoke: boolean;
    remove: boolean;
    restore: boolean;
    /** Create sandbox / Retry provisioning: only for a User whose sandbox is missing or FAILED. */
    sandbox?: 'create' | 'retry';
  };
}

export function AccountActions({ id, email, status, can }: AccountActionsProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [secret, setSecret] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(undefined);
      const r = await fn();
      if (!r.ok) setError(r.error);
      else router.refresh();
    });

  return (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
      {error ? <DvBanner kind="error">{error}</DvBanner> : null}
      {can.sandbox && status !== 'ARCHIVED' ? (
        <Button
          variant="outlined"
          disabled={pending}
          onClick={() => run(() => retrySandboxAction(id))}
        >
          {can.sandbox === 'create' ? 'Create sandbox' : 'Retry provisioning'}
        </Button>
      ) : null}
      {can.reset && status !== 'ARCHIVED' ? (
        <Button
          variant="outlined"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(undefined);
              const r = await resetPasswordAction(id, {
                password: { mode: 'GENERATE' },
                mustChangePassword: true,
              });
              if (!r.ok) setError(r.error);
              else setSecret(r.data.newPassword ?? null);
            })
          }
        >
          Reset password
        </Button>
      ) : null}
      {can.disable && status === 'DISABLED' ? (
        <Button
          variant="outlined"
          disabled={pending}
          onClick={() => run(() => setAccountStatusAction(id, 'enable'))}
        >
          Enable
        </Button>
      ) : null}
      {can.disable && (status === 'ACTIVE' || status === 'LOCKED') ? (
        <Button
          variant="outlined"
          disabled={pending}
          onClick={() => run(() => setAccountStatusAction(id, 'disable'))}
        >
          Disable
        </Button>
      ) : null}
      {can.unlock && status === 'LOCKED' ? (
        <Button
          variant="outlined"
          disabled={pending}
          onClick={() => run(() => unlockAccountAction(id))}
        >
          Unlock
        </Button>
      ) : null}
      {can.revoke && status !== 'ARCHIVED' ? (
        <Button
          variant="outlined"
          disabled={pending}
          onClick={() => run(() => revokeSessionsAction(id))}
        >
          Sign out everywhere
        </Button>
      ) : null}
      {can.restore && status === 'ARCHIVED' ? (
        <Button
          variant="outlined"
          disabled={pending}
          onClick={() => run(() => restoreAccountAction(id))}
        >
          Restore
        </Button>
      ) : null}
      {can.remove && status !== 'ARCHIVED' ? (
        <Button
          color="error"
          variant="outlined"
          disabled={pending}
          onClick={() => {
            if (window.prompt('Type DELETE to archive this account.') === 'DELETE')
              run(() => deleteAccountAction(id, { confirm: 'DELETE' }));
          }}
        >
          Delete
        </Button>
      ) : null}
      {secret ? (
        <OneTimeSecret
          title="Password reset"
          rows={[{ email, password: secret }]}
          onDone={() => setSecret(null)}
        />
      ) : null}
    </Box>
  );
}
