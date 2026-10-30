'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { DvBanner } from '@/components/dv/DvBanner';
import { retrySandboxAction } from '@/lib/actions/accounts';

export interface SandboxRecoveryProps {
  id: string;
  /** Create / Retry / Restart sandbox: for a student whose sandbox is missing, FAILED or not ready yet. */
  action: 'create' | 'retry' | 'restart';
}

const LABEL = {
  create: 'Create sandbox',
  retry: 'Retry provisioning',
  restart: 'Restart provisioning',
} as const;

/** The button of the Sandbox section on the account page. */
export function SandboxRecovery({ id, action }: SandboxRecoveryProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | undefined>();
  return (
    <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
      {error ? <DvBanner kind="error">{error}</DvBanner> : null}
      <Button
        variant="outlined"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(undefined);
            const r = await retrySandboxAction(id);
            if (!r.ok) setError(r.error);
            else router.refresh();
          })
        }
      >
        {LABEL[action]}
      </Button>
    </Box>
  );
}
