'use client';

import { useActionState, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { DvBanner } from '@/components/dv/DvBanner';
import { DvTextField } from '@/components/dv/DvTextField';
import { passwordStrength } from '@/lib/auth/password-policy';

export interface PasswordFormState {
  error?: string;
}

export interface PasswordFormProps {
  action: (state: PasswordFormState, formData: FormData) => Promise<PasswordFormState>;
  email: string;
  /** True when the sign in forced the change: the current password is not asked for. */
  forced: boolean;
  next?: string;
}

const STRENGTH_LABEL = { weak: 'Weak', fair: 'Fair', strong: 'Strong' } as const;

export function PasswordForm({ action, email, forced, next }: PasswordFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const [fresh, setFresh] = useState('');
  const strength = passwordStrength(fresh, { email });
  return (
    <Box
      component="form"
      action={formAction}
      noValidate
      sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}
    >
      {forced ? (
        <DvBanner kind="info">You need to choose a new password before you continue.</DvBanner>
      ) : null}
      {state.error ? (
        <div role="alert">
          <DvBanner kind="error">{state.error}</DvBanner>
        </div>
      ) : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {forced ? null : (
        <DvTextField label="Current password" name="current" type="password" required />
      )}
      <DvTextField
        label="New password"
        name="next_password"
        type="password"
        required
        value={fresh}
        onChange={setFresh}
        hint="At least 10 characters, with 3 of: lowercase, uppercase, number, symbol."
      />
      {fresh ? (
        <Typography variant="caption" aria-live="polite" sx={{ color: 'text.secondary' }}>
          Strength: {STRENGTH_LABEL[strength]}
        </Typography>
      ) : null}
      <DvTextField label="Confirm new password" name="confirm" type="password" required />
      <Button type="submit" variant="contained" disabled={pending}>
        Change password
      </Button>
    </Box>
  );
}
