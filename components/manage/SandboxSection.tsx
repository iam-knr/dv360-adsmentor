'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Typography from '@mui/material/Typography';
import { useProvisionDriver, type ProvisionViewJson } from '@/components/sim/useProvisionDriver';
import { FAILED_SANDBOX_MESSAGE, sandboxStateLabel } from '@/lib/sandbox/labels';
import { BuildProgress } from './BuildProgress';
import { RebuildSandbox } from './RebuildSandbox';
import { SandboxClockControl, type SandboxClockControlProps } from './SandboxClockControl';
import { SandboxRecovery } from './SandboxRecovery';

export interface SandboxSectionProps {
  id: string;
  /** Shown in the rebuild confirmation. */
  studentName?: string;
  initial: ProvisionViewJson;
  /** The Super admin may edit this account (and it is not archived): the recovery button shows. */
  canRecover: boolean;
  /** Clock facts of the READY sandbox (Pause / Resume for a Super admin). */
  clock?: Omit<SandboxClockControlProps, 'id' | 'studentName' | 'canEdit'> | null;
}

/**
 * The Sandbox section of the account page. While the sandbox is QUEUED or BUILDING it drives the build itself, one step
 * at a time through POST /api/manage/accounts/:id/provision, and shows the state and percentage as they move; at READY or
 * FAILED it stops and refreshes the page.
 */
export function SandboxSection({
  id,
  studentName = 'the student',
  initial,
  canRecover,
  clock,
}: SandboxSectionProps) {
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
  const inProgress = view.state === 'QUEUED' || view.state === 'BUILDING';
  return (
    <>
      <Typography>State: {sandboxStateLabel(view.state)}</Typography>
      {inProgress ? (
        <BuildProgress percent={view.percent} step={view.message} simDate={view.simDate} />
      ) : null}
      {view.state === 'FAILED' ? (
        <div role="alert">
          <Typography color="error">{FAILED_SANDBOX_MESSAGE}</Typography>
          {view.error ? (
            <details data-testid="sandbox-error-details">
              <summary>Details</summary>
              <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', m: 0 }}>
                {view.error}
              </Typography>
            </details>
          ) : null}
        </div>
      ) : null}
      {view.state === 'READY' && clock ? (
        <SandboxClockControl id={id} studentName={studentName} canEdit={canRecover} {...clock} />
      ) : null}
      {action && canRecover ? (
        <SandboxRecovery id={id} action={action} busy={busy} onView={setView} />
      ) : null}
      {view.state === 'READY' && canRecover ? (
        <RebuildSandbox id={id} studentName={studentName} onView={setView} />
      ) : null}
    </>
  );
}
