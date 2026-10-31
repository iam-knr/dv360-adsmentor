'use client';

import { useActionState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { DvBanner } from '@/components/dv/DvBanner';
import { DvTextField } from '@/components/dv/DvTextField';

export interface SeedFormState {
  ok?: boolean;
  error?: string;
  lines?: string[];
}

export function SeedForm({
  action,
}: {
  action: (state: SeedFormState, formData: FormData) => Promise<SeedFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <Box
      component="form"
      action={formAction}
      noValidate
      sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}
    >
      {state.error ? (
        <div role="alert">
          <DvBanner kind="error">{state.error}</DvBanner>
        </div>
      ) : null}
      {state.ok ? <DvBanner kind="success">Seeding finished.</DvBanner> : null}
      <DvTextField
        label="Password for new demo accounts"
        name="password"
        type="password"
        required
        hint="At least 10 characters. Used only for accounts that do not exist yet."
      />
      <Button type="submit" variant="contained" disabled={pending}>
        {pending ? 'Seeding (about a minute)…' : 'Seed demo data and templates'}
      </Button>
      {state.lines?.length ? (
        <Typography component="pre" variant="caption" sx={{ m: 0, whiteSpace: 'pre-wrap' }}>
          {state.lines.join('\n')}
        </Typography>
      ) : null}
    </Box>
  );
}
