'use client';

// Insertion orders grid (module 07 2.2): campaign tab and advertiser tab. The campaign tab has New insertion order;
// the advertiser tab does not (AC-07-01). Inline Activate / Pause and inline Budget edit.
import { useMemo, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import {
  DvGrid,
  DvInlineEdit,
  DvPageHeader,
  DvSelect,
  formatCurrency,
  type DvColumn,
  type EntityStatus,
} from '@/components/dv';
import { BulkActionBar } from '@/components/bulk/BulkActionBar';
import { SdfMenu } from '@/components/bulk/SdfDialogs';
import { orderBy, useColumnView } from '@/components/views/useColumnView';
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
  initialStatus,
  filterChips,
}: {
  partnerId: string;
  advertiserId: string;
  /** Present on the campaign tab: shows New insertion order. */
  campaignId?: string;
  currency: string;
  rows: IoRow[];
  title?: string;
  embedded?: boolean;
  /** `f.status` of the URL (Search links): the select starts there. */
  initialStatus?: string | null;
  /** Chips of the other `f.*` filters (lib/search/list-filters.ts). */
  filterChips?: ReactNode;
}) {
  const { viewer } = useViewer();
  const router = useRouter();
  const [filter, setFilter] = useState(initialStatus ?? 'ACTIVE');
  const [page, setPage] = useState({ page: 1, size: 20 });
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const view = useColumnView('IO', advertiserId);
  const [, startTransition] = useTransition();
  const shown = useMemo(
    () => (filter === '*' ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );
  const start = (page.page - 1) * page.size;
  const sum = (key: 'impressions' | 'revenue') => shown.reduce((acc, r) => acc + r[key], 0);

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
      cell: (r) => {
        const shownBudget =
          r.budget === null
            ? 'Unknown'
            : r.budgetUnit === 'CURRENCY'
              ? formatCurrency(r.budget, currency)
              : r.budget.toLocaleString('en-US');
        if (!r.editableSegment || viewer.readOnly) return shownBudget;
        return (
          <DvInlineEdit
            label={`Budget of ${r.name}`}
            value={String(r.editableSegment.amount)}
            display={shownBudget}
            validate={validateBudget}
            onCommit={(v) => saveBudget(r, v)}
          />
        );
      },
    },
    { id: 'goal', header: 'Goal', group: 'delivery', accessor: (r) => r.goal },
    {
      id: 'impressions',
      header: 'Impr.',
      group: 'delivery',
      type: 'number',
      align: 'right',
      accessor: (r) => r.impressions,
      total: () => sum('impressions').toLocaleString('en-US'),
    },
    {
      id: 'revenue',
      header: 'Revenue',
      group: 'delivery',
      type: 'currency',
      align: 'right',
      currencySymbol: currency,
      accessor: (r) => r.revenue,
      total: () => formatCurrency(sum('revenue'), currency),
    },
  ];

  /** IO-021 and IO-022 on the typed value; IO-023 to IO-026 come back from the service. */
  const validateBudget = (raw: string) => {
    if (raw.trim() === '') return 'Enter a value';
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return 'Enter a number greater than 0';
    return undefined;
  };
  const saveBudget = (r: IoRow, raw: string) =>
    startTransition(async () => {
      const res = await patchIoBudgetAction(r.id, r.editableSegment!.id, Number(raw));
      if (!res.ok) setError(res.issues[0]?.message ?? 'Could not save the budget.');
      else {
        setError(null);
        router.refresh();
      }
    });

  return (
    <>
      {embedded ? null : <DvPageHeader title={title} limitedAccess={viewer.limitedAccess} />}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Box sx={{ flex: 1, maxWidth: 240 }}>
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
        {filterChips}
        {view.menu}
        {embedded ? null : <SdfMenu advertiserId={advertiserId} />}
        {campaignId ? (
          <Button
            variant="contained"
            disabled={viewer.readOnly}
            href={campaignPath(partnerId, advertiserId, campaignId, 'ios', 'new')}
          >
            New Insertion Order
          </Button>
        ) : null}
      </Box>
      {error ? (
        <Typography role="alert" color="error">
          {error}
        </Typography>
      ) : null}
      <BulkActionBar
        entity="insertionOrder"
        selection={selection}
        rows={rows.map((r) => ({ id: r.publicId, status: r.status }))}
        advertiserId={advertiserId}
        onClear={() => setSelection(new Set())}
        bulkStatusHref="/bulk-status"
      />
      <DvGrid
        ariaLabel="Insertion orders"
        rows={shown.slice(start, start + page.size)}
        columns={orderBy(columns, view.visible)}
        groups={[
          { id: 'io', label: 'Insertion order' },
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
