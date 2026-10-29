'use client';

// Minimal Partner Overview and Advertisers pages (P3-03 item 8). The full Overview (workspaces, pacing cards,
// pinned and recent) is module 01 Phase 4; the full Advertisers list is module 02.
import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import {
  DvGrid,
  DvPageHeader,
  DvStatusDot,
  type DvColumn,
  type EntityStatus,
} from '@/components/dv';
import { AppLink } from '@/lib/routes/AppLink';
import { advertiserPath, partnerPath } from '@/lib/routes/paths';
import type { AdvertiserListRow } from '@/lib/scope/advertisers';
import { useViewer } from './ViewerProvider';

const STATUS_LABEL: Record<AdvertiserListRow['status'], string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  ARCHIVED: 'Archived',
  SCHEDULED_FOR_DELETION: 'Scheduled for deletion',
};

const DOT: Record<AdvertiserListRow['status'], EntityStatus> = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  ARCHIVED: 'archived',
  SCHEDULED_FOR_DELETION: 'scheduledForDeletion',
};

export function PartnerOverview({
  partnerId,
  partnerName,
  advertiserCount,
}: {
  partnerId: string;
  partnerName: string;
  advertiserCount: number;
}) {
  const { viewer } = useViewer();
  return (
    <>
      <DvPageHeader title="Overview" limitedAccess={viewer.limitedAccess} />
      <Box
        data-testid="welcome-card"
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          bgcolor: 'background.paper',
          p: 6,
          maxWidth: 640,
        }}
      >
        <Typography variant="h5" component="h2">{`Welcome, ${viewer.name}`}</Typography>
        <Typography variant="body1" sx={{ mt: 2 }}>
          {`You are working in partner ${partnerName}. It has ${advertiserCount} ${advertiserCount === 1 ? 'advertiser' : 'advertisers'}.`}
        </Typography>
        <Box sx={{ mt: 4 }}>
          <AppLink href={partnerPath(partnerId, 'advertisers')}>View advertisers</AppLink>
        </Box>
      </Box>
    </>
  );
}

export function AdvertisersList({
  partnerId,
  rows,
}: {
  partnerId: string;
  rows: AdvertiserListRow[];
}) {
  const { viewer } = useViewer();
  const [page, setPage] = useState({ page: 1, size: 20 });
  const columns: DvColumn<AdvertiserListRow>[] = [
    {
      id: 'name',
      header: 'Advertiser',
      cell: (r) => <AppLink href={advertiserPath(partnerId, r.publicId, 'cs')}>{r.name}</AppLink>,
    },
    { id: 'id', header: 'ID', accessor: (r) => r.publicId },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          <DvStatusDot status={DOT[r.status]} />
          {STATUS_LABEL[r.status]}
        </Box>
      ),
    },
    { id: 'currency', header: 'Currency', accessor: (r) => r.currencyCode },
    {
      id: 'campaigns',
      header: 'Campaigns',
      cell: (r) => (
        <AppLink href={advertiserPath(partnerId, r.publicId, 'cs')}>View campaigns</AppLink>
      ),
    },
  ];
  const start = (page.page - 1) * page.size;
  return (
    <>
      <DvPageHeader title="Advertisers" limitedAccess={viewer.limitedAccess} />
      <DvGrid
        rows={rows.slice(start, start + page.size)}
        columns={columns}
        ariaLabel="Advertisers"
        getRowId={(r) => r.publicId}
        page={page.page}
        pageSize={page.size}
        total={rows.length}
        onPageChange={(p, size) => setPage({ page: p, size })}
        emptyState={<Typography sx={{ p: 4 }}>No advertisers</Typography>}
      />
    </>
  );
}
