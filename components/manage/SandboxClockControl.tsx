'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { DvModal } from '@/components/dv/DvModal';
import { setSandboxClockAction } from '@/lib/actions/accounts';

export interface SandboxClockControlProps {
  id: string;
  studentName: string;
  state: 'RUNNING' | 'PAUSED' | 'STEPPING' | 'LOCKED';
  speedX: number;
  minutesPerSimDay: number;
  pausedByAdmin: boolean;
  canEdit: boolean;
}

/** Clock state and speed of a student's sandbox, with Pause / Resume behind a confirmation (audited on the server). */
export function SandboxClockControl({
  id,
  studentName,
  state,
  speedX,
  minutesPerSimDay,
  pausedByAdmin,
  canEdit,
}: SandboxClockControlProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const running = state === 'RUNNING';
  const label = running
    ? `Running at ${speedX}x (1 simulated day per ${minutesPerSimDay} real minutes)`
    : state === 'LOCKED'
      ? 'Locked after repeated errors'
      : pausedByAdmin
        ? 'Paused by a Super admin'
        : 'Paused';
  const close = () => {
    setOpen(false);
    setError(undefined);
  };
  const verb = running ? 'Pause' : 'Resume';
  return (
    <Box sx={{ mt: 1 }}>
      <Typography data-testid="sandbox-clock-state">Clock: {label}</Typography>
      {canEdit && state !== 'LOCKED' ? (
        <Box sx={{ mt: 1 }}>
          <Button variant="outlined" onClick={() => setOpen(true)} data-testid="sandbox-clock-toggle">
            {verb} clock
          </Button>
        </Box>
      ) : null}
      <DvModal
        open={open}
        title={`${verb} this sandbox clock?`}
        primary={{
          label: `${verb} clock`,
          loading: pending,
          onClick: () =>
            start(async () => {
              setError(undefined);
              const r = await setSandboxClockAction(id, !running);
              if (!r.ok) {
                setError(r.error);
                return;
              }
              setOpen(false);
              router.refresh();
            }),
        }}
        secondary={{ label: 'Cancel', onClick: close }}
        onClose={close}
        error={error}
        initialFocus="secondary"
      >
        <Typography>
          {running
            ? `${studentName}'s simulated time stops: nothing they build delivers and reports stay as they are. It stays paused, also after a new deployment, until a Super admin resumes it.`
            : `${studentName}'s simulated time starts running at ${speedX}x. The time it was paused is not simulated afterwards.`}{' '}
          The change is recorded in the audit log.
        </Typography>
      </DvModal>
    </Box>
  );
}
