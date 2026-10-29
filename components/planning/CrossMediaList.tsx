'use client';

// Cross-media reach reports list (module 04 S7, S7p): Welcome empty state, then a grid.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { DvEmptyState, DvGrid, DvPageHeader, type DvColumn } from '@/components/dv';
import { useViewer } from '@/components/shell/ViewerProvider';
import { AppLink } from '@/lib/routes/AppLink';
import type { CrossMediaRow } from '@/lib/planning/cross-media-service';
import { crossMediaPath, type PlanScope } from '@/lib/planning/paths';

const STATUS = { PROCESSING: 'Processing', DONE: 'Done', FAILED: 'Failed' } as const;
const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

export function CrossMediaList({
  scope,
  rows,
  canWrite,
  partner,
}: {
  scope: PlanScope;
  rows: CrossMediaRow[];
  canWrite: boolean;
  partner: boolean;
}) {
  const router = useRouter();
  const { viewer } = useViewer();
  const writable = canWrite && !viewer.readOnly;
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const create = () => router.push(crossMediaPath(scope, 'new'));

  const columns: DvColumn<CrossMediaRow>[] = [
    {
      id: 'name',
      header: 'Name',
      type: 'custom',
      sticky: true,
      width: 300,
      cell: (r) => (
        <AppLink href={crossMediaPath(scope, r.publicId)} data-testid="cross-media-link">
          {r.name}
        </AppLink>
      ),
    },
    ...(partner
      ? [
          {
            id: 'advertiser',
            header: 'Advertiser',
            accessor: (r: CrossMediaRow) => r.advertiserName ?? '-',
          },
        ]
      : []),
    { id: 'country', header: 'Country', accessor: (r) => r.country },
    {
      id: 'scope',
      header: 'Scope',
      accessor: (r) => (r.scope === 'NATIONAL' ? 'National' : 'Sub-location'),
    },
    { id: 'status', header: 'Status', accessor: (r) => STATUS[r.status] },
    { id: 'created', header: 'Created', accessor: (r) => fmt(r.createdAt) },
    { id: 'by', header: 'Created by', accessor: (r) => r.createdBy },
  ];

  return (
    <>
      <DvPageHeader
        title="Cross-media reach Reports"
        limitedAccess={viewer.limitedAccess}
        actions={
          <Button variant="contained" disabled={!writable} onClick={create}>
            New report
          </Button>
        }
      />
      <Box sx={{ px: 4, py: 3 }}>
        {rows.length === 0 ? (
          <DvEmptyState
            variant="illustrated"
            title="Welcome to Cross-media reach!"
            message="These reports deliver cross-media insights for digital, TV, and the intersection between the two."
            secondary={{ label: 'Learn more', href: '#learn-more' }}
            {...(writable
              ? { action: { label: 'New report', onClick: create, primary: true } }
              : {})}
          />
        ) : (
          <DvGrid<CrossMediaRow>
            ariaLabel="Cross-media reach reports"
            rows={rows.slice((page - 1) * size, page * size)}
            columns={columns}
            getRowId={(r) => r.id}
            page={page}
            pageSize={size}
            total={rows.length}
            onPageChange={(p, s) => {
              setPage(p);
              setSize(s);
            }}
          />
        )}
      </Box>
    </>
  );
}
