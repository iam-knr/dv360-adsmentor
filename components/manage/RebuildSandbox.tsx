'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { DvModal } from '@/components/dv/DvModal';
import type { ProvisionViewJson } from '@/components/sim/useProvisionDriver';
import { rebuildSandboxAction } from '@/lib/actions/accounts';

export interface RebuildSandboxProps {
  id: string;
  studentName: string;
  onView?: (view: ProvisionViewJson) => void;
}

/** "Rebuild sandbox" for a READY sandbox, behind a confirmation that says the student's work is deleted. */
export function RebuildSandbox({ id, studentName, onView }: RebuildSandboxProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const close = () => {
    setOpen(false);
    setError(undefined);
  };
  return (
    <Box sx={{ mt: 2 }}>
      <Button variant="outlined" color="error" onClick={() => setOpen(true)}>
        Rebuild sandbox
      </Button>
      <DvModal
        open={open}
        title="Rebuild this sandbox?"
        primary={{
          label: 'Rebuild sandbox',
          tone: 'danger',
          loading: pending,
          onClick: () =>
            start(async () => {
              setError(undefined);
              const r = await rebuildSandboxAction(id);
              if (!r.ok) {
                setError(r.error);
                return;
              }
              onView?.(r.data);
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
          This deletes everything {studentName} has built in the sandbox (campaigns, line items,
          reports and settings) and builds a fresh one from the template. It takes a few minutes and
          cannot be undone. The rebuild is recorded in the audit log.
        </Typography>
      </DvModal>
    </Box>
  );
}
