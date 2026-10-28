'use client';

import { useActionState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { DvBanner } from '@/components/dv/DvBanner';
import { DvTextField } from '@/components/dv/DvTextField';

export interface LoginState {
  error?: string;
}

export interface LoginFormProps {
  action: (state: LoginState, formData: FormData) => Promise<LoginState>;
  next?: string;
}

export function LoginForm({ action, next }: LoginFormProps) {
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
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <DvTextField label="Email" name="email" type="email" required />
      <DvTextField label="Password" name="password" type="password" required />
      <Button type="submit" variant="contained" disabled={pending}>
        Sign in
      </Button>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Forgot your password? Ask your admin.
        <br />
        Admins ask the super admin.
      </Typography>
    </Box>
  );
}
