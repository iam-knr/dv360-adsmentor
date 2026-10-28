import type { Metadata } from 'next';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { ProfileForm } from '@/components/sim/ProfileForm';
import { SimCard } from '@/components/sim/SimCard';
import { requireUserOrRedirect } from '@/lib/auth/session';
import { updateProfileAction } from './actions';

export const metadata: Metadata = { title: 'My account | DV360 Simulator by Adsmetor' };

const ROLE_LABEL = { user: 'User', admin: 'Admin', super_admin: 'Super admin' } as const;

export default async function MePage() {
  const user = await requireUserOrRedirect();
  return (
    <SimCard title="My account">
      <Box
        component="dl"
        sx={{
          m: 0,
          display: 'grid',
          gridTemplateColumns: 'max-content 1fr',
          columnGap: 4,
          rowGap: 2,
        }}
      >
        <Typography component="dt" variant="subtitle1">
          Email
        </Typography>
        <Typography component="dd" sx={{ m: 0 }}>
          {user.email}
        </Typography>
        <Typography component="dt" variant="subtitle1">
          Level
        </Typography>
        <Typography component="dd" sx={{ m: 0 }}>
          {ROLE_LABEL[user.appRole]}
        </Typography>
      </Box>
      <ProfileForm action={updateProfileAction} name={user.name} />
      <Button href="/sim/me/password" variant="outlined" sx={{ alignSelf: 'flex-start' }}>
        Change password
      </Button>
    </SimCard>
  );
}
