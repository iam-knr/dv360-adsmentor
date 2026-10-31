'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { DvBanner } from '@/components/dv/DvBanner';
import { DvModal } from '@/components/dv/DvModal';
import { restoreAccessAction, setScreenshotsAllowedAction } from '@/lib/actions/security';

export interface ScreenshotSectionProps {
  id: string;
  name: string;
  screenshotsAllowed: boolean;
  suspension: { at: string; method: string; path: string } | null;
  canChange: boolean;
}

type Confirm = null | 'allow' | 'disallow' | 'restore';

/** The "Screenshots" section of the account page: the Allow / Disallow switch and, while suspended, Restore access. */
export function ScreenshotSection({
  id,
  name,
  screenshotsAllowed,
  suspension,
  canChange,
}: ScreenshotSectionProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [error, setError] = useState<string | undefined>();

  const run = () =>
    start(async () => {
      const res =
        confirm === 'restore'
          ? await restoreAccessAction(id)
          : await setScreenshotsAllowedAction(id, confirm === 'allow');
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setConfirm(null);
      setError(undefined);
      router.refresh();
    });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {suspension ? (
        <DvBanner kind="error">
          <Box data-testid="suspension-banner">
            <strong>Access suspended.</strong> Reason: screenshot attempt. Time: {suspension.at}.
            Method: {suspension.method}. Page: {suspension.path}.
          </Box>
        </DvBanner>
      ) : null}
      <Typography>
        Screenshots are <strong>{screenshotsAllowed ? 'allowed' : 'not allowed'}</strong> for this
        student.
      </Typography>
      <Typography variant="body2" color="text.secondary">
        When not allowed, the page watches for the Print Screen key, the Windows and Mac screenshot
        shortcuts and printing. If one is used the student is signed out and suspended, and you are
        notified. A browser cannot see every kind of screenshot (a phone camera or a screen recorder
        goes unnoticed), so this is a deterrent, not a guarantee. Nothing typed is recorded.
      </Typography>
      {canChange ? (
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {screenshotsAllowed ? (
            <Button variant="outlined" disabled={pending} onClick={() => setConfirm('disallow')}>
              Disallow screenshots
            </Button>
          ) : (
            <Button variant="outlined" disabled={pending} onClick={() => setConfirm('allow')}>
              Allow screenshots
            </Button>
          )}
          {suspension ? (
            <Button variant="contained" disabled={pending} onClick={() => setConfirm('restore')}>
              Restore access
            </Button>
          ) : null}
        </Box>
      ) : null}
      <DvModal
        open={confirm !== null}
        title={
          confirm === 'restore'
            ? 'Restore access?'
            : confirm === 'allow'
              ? 'Allow screenshots?'
              : 'Disallow screenshots?'
        }
        primary={{
          label:
            confirm === 'restore' ? 'Restore access' : confirm === 'allow' ? 'Allow' : 'Disallow',
          onClick: run,
          loading: pending,
        }}
        secondary={{
          label: 'Cancel',
          onClick: () => {
            setConfirm(null);
            setError(undefined);
          },
        }}
        onClose={() => setConfirm(null)}
        error={error}
      >
        <Typography>
          {confirm === 'restore'
            ? `${name} can sign in again. The screenshot setting stays as it is.`
            : confirm === 'allow'
              ? `${name} will not be watched for screenshots or printing.`
              : `${name} will be signed out and suspended if a screenshot attempt is detected.`}
        </Typography>
      </DvModal>
    </Box>
  );
}
