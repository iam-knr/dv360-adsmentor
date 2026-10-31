'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Typography from '@mui/material/Typography';
import { useProvisionDriver, type ProvisionViewJson } from '@/components/sim/useProvisionDriver';
import { SandboxRecovery } from './SandboxRecovery';

export interface SandboxSectionProps {
  id: string;
  initial: ProvisionViewJson;
  /** The Super admin may edit this account (and it is not archived): the recovery button shows. */
  canRecover: boolean;
}

/**
 * The Sandbox section of the account page. While the sandbox is QUEUED or BUILDING it drives the build itself, one step
 * at a time through POST /api/manage/accounts/:id/provision, and shows the state and percentage as they move; at READY or
 * FAILED it stops and refreshes the page.
 */
export function SandboxSection({ id, initial, canRecover }: SandboxSectionProps) {
  const router = useRouter();
  const { view, setView, busy } = useProvisionDriver(
    `/api/manage/accounts/${id}/provision`,
    initial,
  );
  const finished = view.state === 'READY' || view.state === 'FAILED';
  useEffect(() => {
    if (finished && initial.state !== view.state) router.refresh();
  }, [finished, initial.state, view.state, router]);

  const action =
    view.state === 'NOT_CREATED'
      ? ('create' as const)
      : view.state === 'FAILED'
        ? ('retry' as const)
        : view.state === 'QUEUED' || view.state === 'BUILDING'
          ? ('restart' as const)
          : undefined;
  return (
    <>
      <Typography>
        State: {view.state === 'NOT_CREATED' ? 'NOT CREATED' : view.state}
        {view.state === 'BUILDING' ? ` (${view.percent}%)` : ''}
      </Typography>
      {view.state === 'BUILDING' && view.message ? (
        <Typography variant="body2" color="text.secondary">
          {view.message}
          {view.simDate ? ` (${view.simDate})` : ''}
        </Typography>
      ) : null}
      {view.error ? (
        <Typography role="alert" color="error">
          Error: {view.error}
        </Typography>
      ) : null}
      {action && canRecover ? (
        <SandboxRecovery id={id} action={action} busy={busy} onView={setView} />
      ) : null}
    </>
  );
}
