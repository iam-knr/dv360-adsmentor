'use client';

// Campaigns list (module 06 2.1): Campaign and Delivery column groups, `Status: Active` default filter, row hover
// Activate / Pause. Numbers arrive in the rows (getGridMetrics on the server); "-" when there is no data.
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import {
  DvGrid,
  DvPageHeader,
  DvSelect,
  formatCurrency,
  type DvColumn,
  type EntityStatus,
} from '@/components/dv';
import { BulkActionBar } from '@/components/bulk/BulkActionBar';
import { SdfMenu } from '@/components/bulk/SdfDialogs';
import { useViewer } from '@/components/shell/ViewerProvider';
import { setCampaignStatusAction } from '@/lib/campaigns/actions';
import type { CampaignRow, EntityStatusKey } from '@/lib/campaigns/wire';
import { AppLink } from '@/lib/routes/AppLink';
import { advertiserPath, campaignPath } from '@/lib/routes/paths';

const DOT: Record<EntityStatusKey, EntityStatus> = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  ARCHIVED: 'archived',
};

const FILTERS = [
  { value: 'ACTIVE', label: 'Status: Active' },
  { value: 'PAUSED', label: 'Status: Paused' },
  { value: 'DRAFT', label: 'Status: Draft' },
  { value: 'ARCHIVED', label: 'Status: Archived' },
  { value: '*', label: 'Status: All' },
];

export function CampaignsList({
  partnerId,
  advertiserId,
  currency,
  rows,
}: {
  partnerId: string;
  advertiserId: string;
  currency: string;
  rows: CampaignRow[];
}) {
  const { viewer } = useViewer();
  const router = useRouter();
  const [filter, setFilter] = useState('ACTIVE');
  const [page, setPage] = useState({ page: 1, size: 20 });
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());

  const shown = useMemo(
    () => (filter === '*' ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );
  const start = (page.page - 1) * page.size;
  const sumSpent = () => shown.reduce((acc, r) => acc + r.spent, 0);

  const columns: DvColumn<CampaignRow>[] = [
    {
      id: 'name',
      header: 'Campaign',
      group: 'campaign',
      sticky: true,
      cell: (r) => (
        <AppLink href={campaignPath(partnerId, advertiserId, r.publicId)}>{r.name}</AppLink>
      ),
    },
    { id: 'id', header: 'ID', group: 'campaign', accessor: (r) => r.publicId },
    {
      id: 'budget',
      header: 'Budget',
      group: 'delivery',
      align: 'right',
      cell: (r) => (r.budget === null ? 'Unknown' : formatCurrency(r.budget, currency)),
    },
    {
      id: 'spent',
      header: 'Spent',
      group: 'delivery',
      type: 'currency',
      align: 'right',
      currencySymbol: currency,
      accessor: (r) => r.spent,
      total: () => formatCurrency(sumSpent(), currency),
    },
    { id: 'kpiGoal', header: 'Goal', group: 'delivery', accessor: (r) => r.kpiGoal },
    { id: 'kpiActual', header: 'KPI actual', group: 'delivery', accessor: (r) => r.kpiActual },
  ];

  return (
    <>
      <DvPageHeader
        title="Campaigns"
        limitedAccess={viewer.limitedAccess}
        actions={
          <>
            <SdfMenu advertiserId={advertiserId} campaignsList />
            <Button
              variant="contained"
              disabled={viewer.readOnly}
              href={advertiserPath(partnerId, advertiserId, 'cs', 'new')}
            >
              New campaign
            </Button>
          </>
        }
      />
      <Box sx={{ mb: 2, maxWidth: 240 }}>
        <DvSelect
          ariaLabel="Status filter"
          value={filter}
          options={FILTERS}
          onChange={(v) => {
            setFilter(v);
            setPage({ page: 1, size: page.size });
          }}
        />
      </Box>
      {error ? (
        <Typography role="alert" color="error">
          {error}
        </Typography>
      ) : null}
      <BulkActionBar
        entity="campaign"
        selection={selection}
        rows={rows.map((r) => ({ id: r.publicId, status: r.status }))}
        advertiserId={advertiserId}
        onClear={() => setSelection(new Set())}
        bulkStatusHref="/bulk-status"
      />
      <DvGrid
        ariaLabel="Campaigns"
        rows={shown.slice(start, start + page.size)}
        columns={columns}
        groups={[
          { id: 'campaign', label: 'Campaign' },
          { id: 'delivery', label: 'Delivery', collapsible: true },
        ]}
        getRowId={(r) => r.publicId}
        selection={selection}
        onSelectionChange={setSelection}
        page={page.page}
        pageSize={page.size}
        total={shown.length}
        totalRow
        onPageChange={(p, size) => setPage({ page: p, size })}
        getStatus={(r) => DOT[r.status]}
        isArchived={(r) => r.status === 'ARCHIVED'}
        getAlert={(r) => r.alertSeverity}
        onStatusChange={
          viewer.readOnly
            ? undefined
            : (r, next) =>
                startTransition(async () => {
                  const res = await setCampaignStatusAction(
                    r.publicId,
                    next === 'active' ? 'ACTIVE' : 'PAUSED',
                  );
                  if (!res.ok) setError(res.issues[0]?.message ?? 'Could not change the status.');
                  else {
                    setError(null);
                    router.refresh();
                  }
                })
        }
        emptyState={<Typography sx={{ p: 4 }}>No campaigns</Typography>}
      />
    </>
  );
}
