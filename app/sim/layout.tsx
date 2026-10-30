import type { ReactNode } from 'react';
import { Suspense } from 'react';
import Box from '@mui/material/Box';
import { SimHeader } from '@/components/sim/SimHeader';
import { ViewAsBanner } from '@/components/sim/ViewAsBanner';
import { getSessionUser } from '@/lib/auth/session';

export default async function SimLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <SimHeader
        user={
          user
            ? { name: user.actor?.name ?? user.name, appRole: user.actor?.appRole ?? user.appRole }
            : null
        }
      />
      {user?.viewAs ? (
        <Suspense fallback={null}>
          <ViewAsBanner name={user.name} actAs={user.viewAs.actAs} />
        </Suspense>
      ) : null}
      <Box component="main">{children}</Box>
    </Box>
  );
}
