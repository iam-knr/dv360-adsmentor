'use client';

// Line items grid at IO, campaign and advertiser level (module 08 2.6): status dot with hover Activate / Pause,
// alert bell, performance columns and a totals row. The IO tab has New line item.
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
import { orderBy, useColumnView } from '@/components/views/useColumnView';
import { useViewer } from '@/components/shell/ViewerProvider';
import { setLineItemStatusAction } from '@/lib/line-items/actions';
import { LI_TYPE_LABEL } from '@/lib/line-items/type-config';
import type { LineItemRow, LiListResult, LiStatus } from '@/lib/line-items/types';
import { AppLink } from '@/lib/routes/AppLink';
import { ioPath } from '@/lib/routes/paths';

const DOT: Record<LiStatus, EntityStatus> = {
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

export function LiGrid({
  partnerId,
  advertiserId,
  newLink,
  result,
  embedded = false,
  archived = false,
}: {
  partnerId: string;
  advertiserId: string;
  /** Present on the IO tab: href of New line item. */
  newLink?: string;
  result: LiListResult;
  embedded?: boolean;
  /** Archived list (`f.status=ARCHIVED`, module 08 AC-08-26): only archived rows, row action Unarchive. */
  archived?: boolean;
}) {
  const { viewer } = useViewer();
  const router = useRouter();
  const [filter, setFilter] = useState(archived ? 'ARCHIVED' : 'ACTIVE');
  const [page, setPage] = useState({ page: 1, size: 50 });
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const view = useColumnView('LI', advertiserId);
  const [, startTransition] = useTransition();
  const { currency } = result;
  const shown = useMemo(
    () => (filter === '*' ? result.rows : result.rows.filter((r) => r.status === filter)),
    [result.rows, filter],
  );
  const start = (page.page - 1) * page.size;
  const sum = (key: 'impressions' | 'revenue' | 'clicks' | 'conversions') =>
    shown.reduce((acc, r) => acc + r[key], 0);

  const unarchive = (r: LineItemRow) =>
    startTransition(async () => {
      const res = await setLineItemStatusAction(r.id, 'PAUSED');
      if (!res.ok) setError(res.issues[0]?.message ?? 'Could not unarchive this line item.');
      else {
        setError(null);
        router.refresh();
      }
    });

  const columns: DvColumn<LineItemRow>[] = [
    {
      id: 'name',
      header: 'Line item',
      group: 'li',
      sticky: true,
      cell: (r) => (
        <AppLink
          href={ioPath(
            partnerId,
            advertiserId,
            r.campaignPublicId,
            r.ioPublicId,
            'li',
            r.publicId,
            'details',
          )}
        >
          {r.name}
        </AppLink>
      ),
    },
    { id: 'id', header: 'ID', group: 'li', accessor: (r) => r.publicId },
    { id: 'type', header: 'Type', group: 'li', accessor: (r) => LI_TYPE_LABEL[r.type] },
    {
      id: 'budget',
      header: 'Budget',
      group: 'delivery',
      align: 'right',
      cell: (r) => (r.budget === null ? 'Unlimited' : formatCurrency(r.budget, currency)),
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
      id: 'clicks',
      header: 'Clicks',
      group: 'delivery',
      type: 'number',
      align: 'right',
      accessor: (r) => r.clicks,
      total: () => sum('clicks').toLocaleString('en-US'),
    },
    ...(shown.some((r) => r.trueViewViews !== undefined)
      ? [
          {
            id: 'trueViewViews',
            header: 'TrueView: Views',
            group: 'delivery',
            type: 'number',
            align: 'right',
            accessor: (r: LineItemRow) => r.trueViewViews ?? null,
            total: () =>
              shown.reduce((acc, r) => acc + (r.trueViewViews ?? 0), 0).toLocaleString('en-US'),
          } satisfies DvColumn<LineItemRow>,
        ]
      : []),
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
    ...(archived
      ? [
          {
            id: 'actions',
            header: 'Actions',
            group: 'li',
            cell: (r: LineItemRow) => (
              <Button
                variant="text"
                size="small"
                disabled={viewer.readOnly}
                onClick={() => unarchive(r)}
              >
                Unarchive
              </Button>
            ),
          } satisfies DvColumn<LineItemRow>,
        ]
      : []),
  ];

  return (
    <>
      {embedded ? (
        newLink ? (
          <Box sx={{ mb: 2 }}>
            <Button variant="contained" disabled={viewer.readOnly} href={newLink}>
              New line item
            </Button>
          </Box>
        ) : null
      ) : (
        <DvPageHeader
          title={archived ? 'Archived line items' : 'Line items'}
          limitedAccess={viewer.limitedAccess}
          actions={
            archived ? undefined : (
              <>
                {view.menu}
                <SdfMenu advertiserId={advertiserId} />
                {newLink ? (
                  <Button variant="contained" disabled={viewer.readOnly} href={newLink}>
                    New line item
                  </Button>
                ) : null}
              </>
            )
          }
        />
      )}
      {archived ? null : (
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
      )}
      {error ? (
        <Typography role="alert" color="error">
          {error}
        </Typography>
      ) : null}
      <BulkActionBar
        entity="lineItem"
        selection={selection}
        rows={result.rows.map((r) => ({ id: r.publicId, status: r.status, type: r.type }))}
        advertiserId={advertiserId}
        onClear={() => setSelection(new Set())}
        bulkStatusHref="/bulk-status"
      />
      <DvGrid
        ariaLabel="Line items"
        rows={shown.slice(start, start + page.size)}
        columns={orderBy(columns, view.visible)}
        groups={[
          { id: 'li', label: 'Line item' },
          { id: 'delivery', label: 'Delivery', collapsible: true },
        ]}
        getRowId={(r) => r.publicId}
        selection={selection}
        onSelectionChange={setSelection}
        page={page.page}
        pageSize={page.size}
        total={shown.length}
        onPageChange={(p, size) => setPage({ page: p, size })}
        totalRow
        totalLabel="Total"
        getStatus={(r) => DOT[r.status]}
        isArchived={(r) => r.status === 'ARCHIVED'}
        getAlert={(r) => (r.alertCount > 0 ? 'warning' : null)}
        onStatusChange={
          viewer.readOnly || archived
            ? undefined
            : (r, next) =>
                startTransition(async () => {
                  const res = await setLineItemStatusAction(
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
        emptyState={
          <Typography sx={{ p: 4 }}>
            {archived ? 'No archived line items' : 'No line items'}
          </Typography>
        }
      />
    </>
  );
}
