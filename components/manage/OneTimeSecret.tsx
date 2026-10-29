'use client';

import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import { DvModal } from '@/components/dv/DvModal';
import { csvCell } from '@/lib/accounts/csv';

export interface SecretRow {
  email: string;
  password?: string;
}

export interface OneTimeSecretProps {
  title: string;
  rows: SecretRow[];
  /** Sign in address for "Copy sign-in details". */
  signInUrl?: string;
  /** Called once when the person confirms. The plaintext is dropped by the parent at that point. */
  onDone: () => void;
}

/**
 * The one-time reveal (module 19 4.4). The plaintext stays in props and React state only: never in a URL, storage or
 * the DOM of another page. It clears on pagehide and when the component unmounts (route change), and the modal cannot
 * be reopened.
 */
export function OneTimeSecret({ title, rows, signInUrl, onDone }: OneTimeSecretProps) {
  const [shown, setShown] = useState(false);
  const [saved, setSaved] = useState(false);
  const [local, setLocal] = useState<SecretRow[] | null>(rows);

  useEffect(() => {
    const wipe = () => setLocal(null);
    window.addEventListener('pagehide', wipe);
    return () => {
      window.removeEventListener('pagehide', wipe);
      setLocal(null);
    };
  }, []);

  if (!local) return null;
  const withPw = local.filter((r) => r.password);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard may be blocked; the value is still on screen */
    }
  };
  const details = (r: SecretRow) =>
    `${signInUrl ? `Sign in: ${signInUrl}\n` : ''}Email: ${r.email}${r.password ? `\nPassword: ${r.password}` : ''}`;

  const download = () => {
    const stamp = new Date()
      .toISOString()
      .slice(0, 16)
      .replace(/[-:T]/g, (c) => (c === 'T' ? '-' : ''));
    const body = [
      'email,password',
      ...withPw.map((r) => `${csvCell(r.email)},${csvCell(r.password)}`),
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([body], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `accounts-${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DvModal
      open
      title={title}
      size="md"
      primary={{
        label: 'Done',
        onClick: () => {
          if (withPw.length > 0 && !saved) return; // enabled only after the box is ticked
          setLocal(null);
          onDone();
        },
      }}
      secondary={undefined}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {withPw.length === 0 ? (
          <Typography>Account created for {local.map((r) => r.email).join(', ')}.</Typography>
        ) : (
          <>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Adsmetor does not send email. Share the email and password with the person yourself.
              This is the only time the password is shown.
            </Typography>
            {local.map((r) => (
              <Box
                key={r.email}
                sx={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}
              >
                <Typography component="span" sx={{ minWidth: 200 }}>
                  {r.email}
                </Typography>
                {r.password ? (
                  <Typography
                    component="code"
                    data-testid="secret-value"
                    sx={{ fontFamily: 'monospace' }}
                  >
                    {shown ? r.password : '•'.repeat(16)}
                  </Typography>
                ) : null}
                {local.length === 1 ? (
                  <Button size="small" onClick={() => void copy(details(r))}>
                    Copy sign-in details
                  </Button>
                ) : null}
              </Box>
            ))}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button size="small" variant="outlined" onClick={() => setShown((s) => !s)}>
                {shown ? 'Hide' : 'Show'}
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => void copy(local.map(details).join('\n\n'))}
              >
                {local.length === 1 ? 'Copy' : 'Copy all'}
              </Button>
              {local.length > 1 ? (
                <Button size="small" variant="outlined" onClick={download}>
                  Download CSV
                </Button>
              ) : null}
            </Box>
            <FormControlLabel
              control={<Checkbox checked={saved} onChange={(e) => setSaved(e.target.checked)} />}
              label="I have saved the password"
            />
          </>
        )}
      </Box>
    </DvModal>
  );
}
