'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { DvBanner } from '@/components/dv/DvBanner';
import type { ProvisionViewJson } from '@/components/sim/useProvisionDriver';
import { retrySandboxAction } from '@/lib/actions/accounts';

export interface SandboxRecoveryProps {
  id: string;
  /** Create / Retry / Restart sandbox: for a student whose sandbox is missing, FAILED or not ready yet. */
  action: 'create' | 'retry' | 'restart';
  /** The page is running a build step: wait for it, so that two steps never run from one page. */
  busy?: boolean;
  /** Called with the new state when the action answered, so the page can follow the build. */
  onView?: (view: ProvisionViewJson) => void;
}

const LABEL = {
  create: 'Create sandbox',
  retry: 'Retry provisioning',
  restart: 'Restart provisioning',
} as const;

/** The button of the Sandbox section on the account page. */
export function SandboxRecovery({ id, action, busy, onView }: SandboxRecoveryProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | undefined>();
  return (
    <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
      {error ? <DvBanner kind="error">{error}</DvBanner> : null}
      <Button
        variant="outlined"
        disabled={pending || busy}
        onClick={() =>
          start(async () => {
            setError(undefined);
            const r = await retrySandboxAction(id);
            if (!r.ok) setError(r.error);
            else {
              onView?.(r.data);
              router.refresh();
            }
          })
        }
      >
        {LABEL[action]}
      </Button>
    </Box>
  );
}
