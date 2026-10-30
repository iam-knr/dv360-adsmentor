import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from '@mui/material/Link';
import Box from '@mui/material/Box';
import { DvPageHeader } from '@/components/dv/DvPageHeader';
import { RosterView } from '@/components/instructor/RosterView';
import { pageActor } from '@/lib/accounts/session-actor';
import { orNotFound } from '@/lib/instructor/page';
import { getRoster } from '@/lib/instructor/roster';

export const metadata: Metadata = { title: 'Roster | DV360 Simulator by Adsmetor' };
export const dynamic = 'force-dynamic';
// Creating a sandbox runs the seed pipeline inside the request.
export const maxDuration = 300;

export default async function RosterPage({ params }: { params: Promise<{ classId: string }> }) {
  const actor = await pageActor();
  const { classId } = await params;
  const roster = await orNotFound(() => getRoster(actor, classId));
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  return (
    <Box>
      <DvPageHeader
        title={roster.className}
        actions={<Link href={`/sim/instructor/classes/${classId}/access`}>Access windows</Link>}
      />
      <RosterView
        classId={classId}
        className={roster.className}
        rows={roster.rows}
        capacity={roster.capacity}
        signInUrl={host ? `${proto}://${host}/sim/login` : '/sim/login'}
      />
    </Box>
  );
}
