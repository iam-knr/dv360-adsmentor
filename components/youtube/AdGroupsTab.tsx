'use client';

// Ad groups tab of a YouTube line item (module 09 2.3): the grid with performance columns, New ad group, bulk
// Activate and Pause, and the ad group and ad slide-overs (`?sim_panel=adgroup:{id}`, `ad:{id}&adgroup={id}`).
import { useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import {
  DvBulkBar,
  DvEmptyState,
  DvGrid,
  DvPageHeader,
  DvSelect,
  formatCurrency,
  formatNumber,
  formatPercent,
  type DvColumn,
  type EntityStatus,
} from '@/components/dv';
import { useViewer } from '@/components/shell/ViewerProvider';
import { bulkAdGroupStatusAction, setAdGroupStatusAction } from '@/lib/youtube/actions';
import type { AdGroupList, AdGroupRow } from '@/lib/youtube/types';
import { AdGroupPanel } from './AdGroupPanel';
import { AdPanel } from './AdPanel';

const DOT: Record<AdGroupRow['status'], EntityStatus> = { ACTIVE: 'active', PAUSED: 'paused' };
const FILTERS = [
  { value: 'ACTIVE', label: 'Status: Active' },
  { value: 'PAUSED', label: 'Status: Paused' },
  { value: '*', label: 'Status: All' },
];
const BULK = [
  {
    label: 'Action',
    items: [
      { id: 'ACTIVATE', label: 'Activate' },
      { id: 'PAUSE', label: 'Pause' },
    ],
  },
];

function useParam(name: string) {
  const router = useRouter();
  const path = usePathname();
  const search = useSearchParams();
  const get = (): string | null => search?.get(name) ?? null;
  const replace = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(search?.toString() ?? '');
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    router.replace(qs ? `${path}?${qs}` : path);
  };
  return { get, replace, name };
}

export function AdGroupsTab({ list }: { list: AdGroupList }) {
  const { viewer } = useViewer();
  const router = useRouter();
  const url = useParam('sim_panel');
  const panel = url.get();
  const parentParam = useSearchParams()?.get('adgroup') ?? null;
  const [filter, setFilter] = useState('ACTIVE');
  const [page, setPage] = useState({ page: 1, size: 100 });
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const { currency } = list;

  const shown = useMemo(
    () => (filter === '*' ? list.rows : list.rows.filter((r) => r.status === filter)),
    [list.rows, filter],
  );
  const start0 = (page.page - 1) * page.size;
  const sum = (k: 'impressions' | 'coViewedImpressions' | 'revenue' | 'views' | 'conversions') =>
    shown.reduce((acc, r) => acc + r[k], 0);
  const imps = sum('impressions');
  const views = sum('views');
  const revenue = sum('revenue');
  const conversions = sum('conversions');

  const adGroupId = panel?.startsWith('adgroup:')
    ? panel.slice('adgroup:'.length)
    : panel?.startsWith('ad:')
      ? parentParam
      : null;
  const adId = panel?.startsWith('ad:') ? panel.slice('ad:'.length) : null;
  const closeAll = () => url.replace({ sim_panel: null, adgroup: null });

  const columns: DvColumn<AdGroupRow>[] = [
    {
      id: 'name',
      header: list.rows[0]?.adFormatLabel ?? 'Responsive',
      group: 'adGroup',
      sticky: true,
      width: 240,
      cell: (r) => (
        <Button variant="text" onClick={() => url.replace({ sim_panel: `adgroup:${r.id}` })}>
          {r.name}
        </Button>
      ),
    },
    { id: 'id', header: 'ID', group: 'adGroup', accessor: (r) => r.publicId },
    { id: 'adSource', header: 'Ad source', group: 'adGroup', accessor: (r) => r.adSource },
    { id: 'cm360', header: 'CM360 ID', group: 'adGroup', accessor: (r) => r.cm360Id ?? '-' },
    {
      id: 'impressions',
      header: 'Impressions',
      group: 'delivery',
      type: 'number',
      align: 'right',
      accessor: (r) => r.impressions,
      total: () => formatNumber(imps),
    },
    {
      id: 'coViewed',
      header: 'Impr. (Co-viewed)',
      group: 'delivery',
      type: 'number',
      align: 'right',
      accessor: (r) => r.coViewedImpressions,
      total: () => formatNumber(sum('coViewedImpressions')),
    },
    {
      id: 'revenue',
      header: 'Revenue',
      group: 'delivery',
      type: 'currency',
      align: 'right',
      currencySymbol: currency,
      accessor: (r) => r.revenue,
      total: () => formatCurrency(revenue, currency),
    },
    {
      id: 'avgCpm',
      header: 'Avg. CPM',
      group: 'delivery',
      type: 'currency',
      align: 'right',
      currencySymbol: currency,
      accessor: (r) => r.avgCpm,
      total: () => (imps > 0 ? formatCurrency((revenue / imps) * 1000, currency) : '-'),
    },
    {
      id: 'views',
      header: 'TrueView: Views',
      group: 'interactions',
      type: 'number',
      align: 'right',
      accessor: (r) => r.views,
      total: () => formatNumber(views),
    },
    {
      id: 'viewRate',
      header: 'TrueView: View Rate',
      group: 'interactions',
      type: 'percent',
      align: 'right',
      accessor: (r) => r.viewRate,
      total: () => (imps > 0 ? formatPercent((views / imps) * 100) : '-'),
    },
    {
      id: 'avgCpv',
      header: 'TrueView: Avg. CPV',
      group: 'interactions',
      type: 'currency',
      align: 'right',
      currencySymbol: currency,
      accessor: (r) => r.avgCpv,
      total: () => (views > 0 ? formatCurrency(revenue / views, currency) : '-'),
    },
    {
      id: 'conversions',
      header: 'Conversions (YouTube)',
      group: 'conversions',
      type: 'number',
      align: 'right',
      accessor: (r) => r.conversions,
      total: () => formatNumber(conversions),
    },
    {
      id: 'avgCpa',
      header: 'Avg. CPA',
      group: 'conversions',
      type: 'currency',
      align: 'right',
      currencySymbol: currency,
      accessor: (r) => r.avgCpa,
      total: () => (conversions > 0 ? formatCurrency(revenue / conversions, currency) : '-'),
    },
  ];

  const changeStatus = (r: AdGroupRow, next: 'active' | 'paused') =>
    start(async () => {
      const res = await setAdGroupStatusAction(r.id, next === 'active' ? 'ACTIVE' : 'PAUSED');
      if (!res.ok) setError(res.issues[0]?.message ?? 'Could not change the status.');
      else {
        setError(null);
        router.refresh();
      }
    });

  const bulk = (id: string) =>
    start(async () => {
      const res = await bulkAdGroupStatusAction(
        [...selection],
        id === 'ACTIVATE' ? 'ACTIVE' : 'PAUSED',
      );
      if (!res.ok) setError(res.issues[0]?.message ?? 'Could not change the status.');
      else {
        setError(null);
        setSelection(new Set());
        router.refresh();
      }
    });

  const newButton = (
    <Button
      variant="contained"
      disabled={viewer.readOnly}
      onClick={() => url.replace({ sim_panel: 'adgroup:new' })}
    >
      New ad group
    </Button>
  );

  return (
    <>
      <DvPageHeader title="Ad groups" limitedAccess={viewer.limitedAccess} actions={newButton} />
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
      {selection.size > 0 ? (
        <DvBulkBar
          count={selection.size}
          groups={BULK}
          onAction={bulk}
          onClear={() => setSelection(new Set())}
        />
      ) : null}
      {error ? (
        <Typography role="alert" color="error">
          {error}
        </Typography>
      ) : null}
      <DvGrid
        ariaLabel="Ad groups"
        rows={shown.slice(start0, start0 + page.size)}
        columns={columns}
        groups={[
          { id: 'adGroup', label: 'Ad group' },
          { id: 'delivery', label: 'Delivery', collapsible: true },
          { id: 'interactions', label: 'Interactions', collapsible: true },
          { id: 'conversions', label: 'Conversions', collapsible: true },
        ]}
        getRowId={(r) => r.id}
        selection={selection}
        onSelectionChange={viewer.readOnly ? undefined : setSelection}
        page={page.page}
        pageSize={page.size}
        total={shown.length}
        pageSizes={[100, 200]}
        onPageChange={(p, size) => setPage({ page: p, size })}
        totalRow
        totalLabel="Total"
        getStatus={(r) => DOT[r.status]}
        getAlert={(r) => (r.alertCount > 0 ? 'warning' : null)}
        onStatusChange={viewer.readOnly ? undefined : changeStatus}
        emptyState={
          <DvEmptyState
            message="No ad groups"
            action={
              viewer.readOnly
                ? undefined
                : {
                    label: 'New ad group',
                    onClick: () => url.replace({ sim_panel: 'adgroup:new' }),
                    primary: true,
                  }
            }
          />
        }
      />
      {adGroupId ? (
        <AdGroupPanel
          key={adGroupId}
          adGroupId={adGroupId}
          lineItemId={list.lineItem.id}
          readOnly={viewer.readOnly}
          onClose={closeAll}
          onOpenAd={(id) => url.replace({ sim_panel: `ad:${id}`, adgroup: adGroupId })}
        />
      ) : null}
      {adId && adGroupId ? (
        <AdPanel
          key={adId}
          adId={adId}
          adGroupId={adGroupId}
          readOnly={viewer.readOnly}
          onClose={() => url.replace({ sim_panel: `adgroup:${adGroupId}`, adgroup: null })}
        />
      ) : null}
    </>
  );
}
