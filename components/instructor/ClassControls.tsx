'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { DvBanner } from '@/components/dv/DvBanner';
import { closeClassNowAction, openClassNowAction } from '@/lib/instructor/actions';

/** Open now (2 hours) and Close now for one class (module 18 I1, I4). */
export function ClassControls({ classId, open }: { classId: string; open: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(undefined);
      const r = await fn();
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
      <Button
        variant="contained"
        disabled={pending}
        onClick={() => run(() => openClassNowAction(classId))}
      >
        Open now
      </Button>
      <Button
        variant="outlined"
        disabled={pending || !open}
        onClick={() => run(() => closeClassNowAction(classId))}
      >
        Close now
      </Button>
      {error ? <DvBanner kind="error" level="inline">{error}</DvBanner> : null}
    </Box>
  );
}
