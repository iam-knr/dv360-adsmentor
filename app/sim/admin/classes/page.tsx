import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Box from '@mui/material/Box';
import { DvPageHeader } from '@/components/dv/DvPageHeader';
import { ClassesTable, type ClassRow } from '@/components/instructor/ClassesTable';
import { pageActor } from '@/lib/accounts/session-actor';
import { listAllClasses } from '@/lib/instructor/admin';

export const metadata: Metadata = { title: 'Classes | DV360 Simulator by Adsmetor' };
export const dynamic = 'force-dynamic';

export default async function AdminClassesPage() {
  const actor = await pageActor();
  if (actor.role !== 'SUPER_ADMIN') redirect('/sim/forbidden');
  const classes = await listAllClasses(actor);
  const rows: ClassRow[] = classes.map((c) => ({
    id: c.id,
    name: c.name,
    owner: c.ownerAdmin.name,
    seats: `${c._count.users} of ${c.capacity}`,
    sandboxes: c._count.sandboxes,
    timeZone: c.timeZone,
    state: c.archivedAt ? 'Archived' : 'Active',
  }));
  return (
    <Box>
      <DvPageHeader title="Classes" />
      <ClassesTable rows={rows} />
    </Box>
  );
}
