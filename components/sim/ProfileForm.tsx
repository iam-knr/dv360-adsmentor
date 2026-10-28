'use client';

import { useActionState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { DvBanner } from '@/components/dv/DvBanner';
import { DvTextField } from '@/components/dv/DvTextField';

export interface ProfileFormState {
  error?: string;
  saved?: boolean;
}

export interface ProfileFormProps {
  action: (state: ProfileFormState, formData: FormData) => Promise<ProfileFormState>;
  name: string;
}

export function ProfileForm({ action, name }: ProfileFormProps) {
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
      {state.saved ? (
        <div role="status">
          <DvBanner kind="success">Saved.</DvBanner>
        </div>
      ) : null}
      <DvTextField label="Display name" name="name" defaultValue={name} maxLength={100} required />
      <Button type="submit" variant="contained" disabled={pending} sx={{ alignSelf: 'flex-start' }}>
        Save name
      </Button>
    </Box>
  );
}
