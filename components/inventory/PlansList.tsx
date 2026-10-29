'use client';

// Plans list (module 13 S8): list only. The plan page and editor belong to the planning module (P4-08), so New plan
// opens the plan page route as it stands (a stub) and a row opens its plan.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import {
  DvEmptyState,
  DvFilterBar,
  DvGrid,
  DvPageHeader,
  type DvColumn,
  type FilterField,
  type FilterValue,
} from '@/components/dv';
import { useViewer } from '@/components/shell/ViewerProvider';
import type { Scope } from '@/lib/inventory/paths';
import type { PlanRow } from '@/lib/inventory/types';
import { AppLink } from '@/lib/routes/AppLink';
import { advertiserPath } from '@/lib/routes/paths';

const FIELDS: FilterField[] = [
  {
    id: 'status',
    label: 'Status',
    type: 'multi',
    options: [
      { value: 'PLANNED', label: 'Planned' },
      { value: 'TRAFFICKED', label: 'Trafficked' },
    ],
  },
];

const planHref = (s: Scope, id: string) =>
  advertiserPath(s.partnerId, s.advertiserId, 'pr', id, 'marketplace', 'plan');
const date = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC' });

export function PlansList({
  scope,
  rows,
  canWrite,
}: {
  scope: Scope;
  rows: PlanRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const { viewer } = useViewer();
  const writable = canWrite && !viewer.readOnly;
  const [filters, setFilters] = useState<FilterValue[]>([
    { fieldId: 'status', values: ['PLANNED', 'TRAFFICKED'] },
  ]);
  const [text, setText] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(50);
  const statuses = filters.find((f) => f.fieldId === 'status')?.values ?? [];
  const shown = rows.filter(
    (r) =>
      (!statuses.length || statuses.includes(r.status)) &&
      (!text.trim() || `${r.name} ${r.publicId}`.toLowerCase().includes(text.trim().toLowerCase())),
  );
  const columns: DvColumn<PlanRow>[] = [
    {
      id: 'name',
      header: 'Plan',
      type: 'custom',
      sticky: true,
      width: 300,
      cell: (r) => (
        <Box>
          <AppLink href={planHref(scope, r.publicId)}>{r.name}</AppLink>
          <Box sx={{ typography: 'caption', color: 'text.secondary' }}>{r.publicId}</Box>
        </Box>
      ),
    },
    {
      id: 'budget',
      header: 'Total Budget',
      group: 'details',
      align: 'right',
      accessor: (r) =>
        r.totalBudget === null
          ? ''
          : `${r.currencyCode === 'INR' ? '₹' : `${r.currencyCode} `}${r.totalBudget.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    },
    { id: 'start', header: 'Start date', group: 'details', accessor: (r) => date(r.startDate) },
    { id: 'end', header: 'End date', group: 'details', accessor: (r) => date(r.endDate) },
    {
      id: 'channels',
      header: 'Channels',
      group: 'details',
      accessor: (r) => r.channels.join(', '),
    },
  ];
  return (
    <>
      <DvPageHeader
        title="Plans"
        limitedAccess={viewer.limitedAccess}
        actions={
          <Button
            variant="contained"
            disabled={!writable}
            onClick={() => router.push(planHref(scope, 'new'))}
          >
            New plan
          </Button>
        }
      />
      <Box sx={{ px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <DvFilterBar
          fields={FIELDS}
          value={filters}
          text={text}
          placeholder="Search by name or ID"
          onChange={(f, t) => {
            setFilters(f);
            setText(t);
          }}
        />
        <DvGrid<PlanRow>
          ariaLabel="Plans"
          rows={shown.slice((page - 1) * size, page * size)}
          columns={columns}
          groups={[{ id: 'details', label: 'Details' }]}
          getRowId={(r) => r.id}
          page={page}
          pageSize={size}
          total={shown.length}
          onPageChange={(p, s) => {
            setPage(p);
            setSize(s);
          }}
          emptyState={
            <DvEmptyState
              variant="illustrated"
              title="No plans yet"
              message="Create a plan to forecast reach and budget."
            />
          }
        />
      </Box>
    </>
  );
}
