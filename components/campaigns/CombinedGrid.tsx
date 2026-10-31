'use client';

// Campaign "Combined" tab (module 06 Q-06-02): one tree grid, insertion orders as parents and their line items nested
// under them. IO rows and line item rows share the Delivery columns; the type column carries the IO or line item type.
import { useMemo, useState } from 'react';
import {
  DvEmptyState,
  DvGrid,
  formatCurrency,
  type DvColumn,
  type EntityStatus,
} from '@/components/dv';
import { AppLink } from '@/lib/routes/AppLink';
import { ioPath, liPath } from '@/lib/routes/paths';

export interface CombinedRow {
  kind: 'IO' | 'LI';
  /** Public id, prefixed by kind so IO and LI ids never collide in the grid. */
  key: string;
  publicId: string;
  ioPublicId: string;
  name: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  type: string;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  children?: CombinedRow[];
}

const DOT: Record<CombinedRow['status'], EntityStatus> = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  ARCHIVED: 'archived',
};

export function CombinedGrid({
  partnerId,
  advertiserId,
  campaignId,
  currency,
  rows,
}: {
  partnerId: string;
  advertiserId: string;
  campaignId: string;
  currency: string;
  rows: CombinedRow[];
}) {
  const [page, setPage] = useState({ page: 1, size: 50 });
  const sum = (key: 'impressions' | 'clicks' | 'conversions' | 'revenue') =>
    rows.reduce((acc, r) => acc + r[key], 0);
  const columns = useMemo<DvColumn<CombinedRow>[]>(
    () => [
      {
        id: 'name',
        header: 'Insertion order / line item',
        type: 'link',
        sticky: true,
        width: 320,
        cell: (r) => (
          <AppLink
            href={
              r.kind === 'IO'
                ? ioPath(partnerId, advertiserId, campaignId, r.publicId, 'explorerlis')
                : liPath(partnerId, advertiserId, campaignId, r.ioPublicId, r.publicId)
            }
          >
            {r.name}
          </AppLink>
        ),
      },
      { id: 'id', header: 'ID', accessor: (r) => r.publicId },
      {
        id: 'level',
        header: 'Level',
        accessor: (r) => (r.kind === 'IO' ? 'Insertion order' : 'Line item'),
      },
      { id: 'type', header: 'Type' },
      {
        id: 'impressions',
        header: 'Impr.',
        type: 'number',
        align: 'right',
        total: () => sum('impressions').toLocaleString('en-US'),
      },
      {
        id: 'clicks',
        header: 'Clicks',
        type: 'number',
        align: 'right',
        total: () => sum('clicks').toLocaleString('en-US'),
      },
      {
        id: 'conversions',
        header: 'Conversions',
        type: 'number',
        align: 'right',
        total: () => sum('conversions').toLocaleString('en-US'),
      },
      {
        id: 'revenue',
        header: 'Revenue',
        type: 'currency',
        align: 'right',
        currencySymbol: currency,
        total: () => formatCurrency(sum('revenue'), currency),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [partnerId, advertiserId, campaignId, currency, rows],
  );
  return (
    <DvGrid
      ariaLabel="Insertion orders and line items"
      rows={rows.slice((page.page - 1) * page.size, page.page * page.size)}
      columns={columns}
      getRowId={(r) => r.key}
      getChildren={(r) => r.children ?? []}
      getStatus={(r) => DOT[r.status]}
      isArchived={(r) => r.status === 'ARCHIVED'}
      page={page.page}
      pageSize={page.size}
      total={rows.length}
      totalRow
      totalLabel="Total: Insertion orders"
      onPageChange={(p, size) => setPage({ page: p, size })}
      emptyState={<DvEmptyState message="No insertion orders yet" />}
    />
  );
}
