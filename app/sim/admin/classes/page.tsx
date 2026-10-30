import type { Metadata } from 'next';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import { DvGrid, type DvColumn } from '@/components/dv/DvGrid';
import { DvPageHeader } from '@/components/dv/DvPageHeader';
import { pageActor } from '@/lib/accounts/session-actor';
import { listAllClasses } from '@/lib/instructor/admin';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Classes | DV360 Simulator by Adsmetor' };
export const dynamic = 'force-dynamic';

interface Row {
  id: string;
  name: string;
  owner: string;
  seats: string;
  sandboxes: number;
  timeZone: string;
  state: string;
}

export default async function AdminClassesPage() {
  const actor = await pageActor();
  if (actor.role !== 'SUPER_ADMIN') redirect('/sim/forbidden');
  const classes = await listAllClasses(actor);
  const rows: Row[] = classes.map((c) => ({
    id: c.id,
    name: c.name,
    owner: c.ownerAdmin.name,
    seats: `${c._count.users} of ${c.capacity}`,
    sandboxes: c._count.sandboxes,
    timeZone: c.timeZone,
    state: c.archivedAt ? 'Archived' : 'Active',
  }));
  const columns: DvColumn<Row>[] = [
    {
      id: 'name',
      header: 'Class',
      type: 'custom',
      width: 220,
      sticky: true,
      cell: (r) => <Link href={`/sim/instructor/classes/${r.id}`}>{r.name}</Link>,
    },
    { id: 'owner', header: 'Instructor', width: 200 },
    { id: 'seats', header: 'Seats', width: 100 },
    { id: 'sandboxes', header: 'Sandboxes', type: 'number', width: 110 },
    { id: 'timeZone', header: 'Time zone', width: 150 },
    { id: 'state', header: 'State', width: 100 },
  ];
  return (
    <Box>
      <DvPageHeader title="Classes" />
      <DvGrid
        ariaLabel="All classes"
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        isArchived={(r) => r.state === 'Archived'}
        page={1}
        pageSize={Math.max(rows.length, 20)}
        total={rows.length}
        onPageChange={() => undefined}
      />
    </Box>
  );
}
