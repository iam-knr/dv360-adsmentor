import Image from 'next/image';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import type { AppRole } from '@/lib/auth/types';

export interface SimHeaderProps {
  user: { name: string; appRole: AppRole } | null;
}

const ROLE_LABEL: Record<AppRole, string> = {
  user: 'Student',
  super_admin: 'Super admin',
};

/** Plain Adsmetor header for /sim and /manage pages: logo, product name, who is signed in, Sign out. */
export function SimHeader({ user }: SimHeaderProps) {
  return (
    <Box
      component="header"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        px: 6,
        height: 64,
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Image
        src="/brand/adsmentor-logo-horizontal.png"
        alt="AdsMentor"
        width={130}
        height={40}
        priority
        unoptimized
      />
      <Typography variant="cardTitle" component="span" sx={{ color: 'text.secondary' }}>
        DV360 Simulator
      </Typography>
      <Box sx={{ flex: 1 }} />
      {user ? (
        <>
          <Typography variant="body2" component="span">
            {user.name}
            <Typography component="span" variant="caption" sx={{ ml: 2, color: 'text.secondary' }}>
              {ROLE_LABEL[user.appRole]}
            </Typography>
          </Typography>
          <Button href="/sim/me" variant="text" size="small">
            My account
          </Button>
          <Box component="form" method="post" action="/sim/logout">
            <Button type="submit" variant="outlined" size="small">
              Sign out
            </Button>
          </Box>
        </>
      ) : null}
    </Box>
  );
}
