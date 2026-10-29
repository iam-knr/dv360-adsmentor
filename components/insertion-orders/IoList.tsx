'use client';

// Insertion orders grid (module 07 2.2): campaign tab and advertiser tab. The campaign tab has New insertion order;
// the advertiser tab does not (AC-07-01). Inline Activate / Pause and inline Budget edit.
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
import { useViewer } from '@/components/shell/ViewerProvider';
import { patchIoBudgetAction, setIoStatusAction } from '@/lib/insertion-orders/actions';
import { IO_TYPE_LABEL, type IoRow } from '@/lib/insertion-orders/wire';
import { AppLink } from '@/lib/routes/AppLink';
import { campaignPath, ioPath } from '@/lib/routes/paths';

const DOT: Record<IoRow['status'], EntityStatus> = {
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

export function IoList({
  partnerId,
  advertiserId,
  campaignId,
  currency,
  rows,
  title = 'Insertion orders',
  embedded = false,
}: {
  partnerId: string;
  advertiserId: string;
  /** Present on the campaign tab: shows New insertion order. */
  campaignId?: string;
  currency: string;
  rows: IoRow[];
  title?: string;
  embedded?: boolean;
}) {
  const { viewer } = useViewer();
  const router = useRouter();
  const [filter, setFilter] = useState('ACTIVE');
  const [page, setPage] = useState({ page: 1, size: 20 });
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const shown = useMemo(
    () => (filter === '*' ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );
  const start = (page.page - 1) * page.size;

  const columns: DvColumn<IoRow>[] = [
    {
      id: 'name',
      header: 'Insertion order',
      group: 'io',
      sticky: true,
      cell: (r) => (
        <AppLink
          href={ioPath(partnerId, advertiserId, r.campaignPublicId, r.publicId, 'explorerlis')}
        >
          {r.name}
        </AppLink>
      ),
    },
    { id: 'id', header: 'ID', group: 'io', accessor: (r) => r.publicId },
    { id: 'type', header: 'Type', group: 'io', accessor: (r) => IO_TYPE_LABEL[r.type] },
    {
      id: 'budget',
      header: 'Budget',
      group: 'delivery',
      align: 'right',
      cell: (r) =>
        r.budget === null
          ? 'Unknown'
          : r.budgetUnit === 'CURRENCY'
            ? formatCurrency(r.budget, currency)
            : r.budget.toLocaleString('en-US'),
    },
    { id: 'goal', header: 'Goal', group: 'delivery', accessor: (r) => r.goal },
    {
      id: 'impressions',
      header: 'Impr.',
      group: 'delivery',
      type: 'number',
      align: 'right',
      accessor: (r) => r.impressions,
    },
    {
      id: 'revenue',
      header: 'Revenue',
      group: 'delivery',
      type: 'currency',
      align: 'right',
      currencySymbol: currency,
      accessor: (r) => r.revenue,
    },
  ];

  const editBudget = (r: IoRow) => {
    if (!r.editableSegment || viewer.readOnly) return;
    const raw = window.prompt('Budget', String(r.editableSegment.amount));
    if (raw === null) return;
    startTransition(async () => {
      const res = await patchIoBudgetAction(r.id, r.editableSegment!.id, Number(raw));
      if (!res.ok) setError(res.issues[0]?.message ?? 'Could not save the budget.');
      else {
        setError(null);
        router.refresh();
      }
    });
  };

  return (
    <>
      {embedded ? null : (
        <DvPageHeader
          title={title}
          limitedAccess={viewer.limitedAccess}
          actions={
            campaignId ? (
              <Button
                variant="contained"
                disabled={viewer.readOnly}
                href={campaignPath(partnerId, advertiserId, campaignId, 'ios', 'new')}
              >
                New Insertion Order
              </Button>
            ) : undefined
          }
        />
      )}
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
      <DvGrid
        ariaLabel="Insertion orders"
        rows={shown.slice(start, start + page.size)}
        columns={columns}
        groups={[
          { id: 'io', label: 'Insertion order' },
          { id: 'delivery', label: 'Delivery', collapsible: true },
        ]}
        getRowId={(r) => r.publicId}
        page={page.page}
        pageSize={page.size}
        total={shown.length}
        onPageChange={(p, size) => setPage({ page: p, size })}
        getStatus={(r) => DOT[r.status]}
        isArchived={(r) => r.status === 'ARCHIVED'}
        rowActions={(r) =>
          r.editableSegment && !viewer.readOnly ? (
            <Button
              size="small"
              aria-label={`Edit budget of ${r.name}`}
              onClick={() => editBudget(r)}
            >
              Edit budget
            </Button>
          ) : null
        }
        onStatusChange={
          viewer.readOnly
            ? undefined
            : (r, next) =>
                startTransition(async () => {
                  const res = await setIoStatusAction(
                    r.id,
                    next === 'active' ? 'ACTIVE' : 'PAUSED',
                  );
                  if (!res.ok) setError(res.issues[0]?.message ?? 'Could not change the status.');
                  else {
                    setError(null);
                    router.refresh();
                  }
                })
        }
        emptyState={<Typography sx={{ p: 4 }}>No insertion orders</Typography>}
      />
    </>
  );
}
