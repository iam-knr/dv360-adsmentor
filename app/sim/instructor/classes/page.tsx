import type { Metadata } from 'next';
import Link from '@mui/material/Link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { DvEmptyState } from '@/components/dv/DvEmptyState';
import { DvPageHeader } from '@/components/dv/DvPageHeader';
import { DvSectionCard } from '@/components/dv/DvSectionCard';
import { pageActor } from '@/lib/accounts/session-actor';
import { myClasses } from '@/lib/instructor/scope';
import { prisma } from '@/lib/db';

export const metadata: Metadata = { title: 'My classes | DV360 Simulator by Adsmetor' };

export default async function ClassesPage() {
  const actor = await pageActor();
  const classes = await myClasses(prisma, actor);
  return (
    <Box>
      <DvPageHeader title="My classes" />
      {classes.length === 0 ? (
        <DvEmptyState variant="inline" message="You do not teach a class yet." />
      ) : (
        <Box sx={{ display: 'grid', gap: 4, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          {classes.map((c) => (
            <DvSectionCard key={c.id} title={c.name}>
              <Typography variant="body2">
                {c._count.users} of {c.capacity} seats · {c.timeZone}
              </Typography>
              <Box sx={{ display: 'flex', gap: 3, mt: 2 }}>
                <Link href={`/sim/instructor/classes/${c.id}`}>Roster</Link>
                <Link href={`/sim/instructor/classes/${c.id}/access`}>Access windows</Link>
                <Link href={`/sim/instructor/sandboxes?class=${c.id}`}>Sandboxes</Link>
              </Box>
            </DvSectionCard>
          ))}
        </Box>
      )}
    </Box>
  );
}
