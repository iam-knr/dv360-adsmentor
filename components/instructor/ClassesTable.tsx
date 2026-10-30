'use client';

import Link from '@mui/material/Link';
import { DvGrid, type DvColumn } from '@/components/dv/DvGrid';

export interface ClassRow {
  id: string;
  name: string;
  owner: string;
  seats: string;
  sandboxes: number;
  timeZone: string;
  state: string;
}

/** All classes for the Super admin (module 18 A3). A client component because the grid takes render functions. */
export function ClassesTable({ rows }: { rows: ClassRow[] }) {
  const columns: DvColumn<ClassRow>[] = [
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
  );
}
