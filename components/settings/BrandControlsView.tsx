'use client';

// Partner Brand controls (module 02 2.7, S7): Display and video | YouTube tabs, one row per advertiser, four coverage
// bars. Read only for everyone.
import { useState } from 'react';
import Typography from '@mui/material/Typography';
import { DvCoverageBar, DvGrid, DvTabs, type DvColumn } from '@/components/dv';
import { AppLink } from '@/lib/routes/AppLink';
import { advertiserPath } from '@/lib/routes/paths';
import { COVERAGE_KEYS, COVERAGE_LABEL } from '@/lib/settings/constants';
import type { BrandControlRow, BrandTab } from '@/lib/settings/brand-controls';
import { SettingsPage } from './shared';

export function BrandControlsView({
  partnerId,
  limited,
  tabs,
}: {
  partnerId: string;
  limited: boolean;
  tabs: Record<BrandTab, BrandControlRow[]>;
}) {
  const [tab, setTab] = useState<BrandTab>('DISPLAY_VIDEO');
  const [page, setPage] = useState({ page: 1, size: 20 });
  const rows = tabs[tab];
  const columns: DvColumn<BrandControlRow>[] = [
    {
      id: 'name',
      header: 'Advertiser',
      sticky: true,
      cell: (r) => (
        <span>
          <AppLink href={advertiserPath(partnerId, r.publicId, 'cs')}>{r.name}</AppLink>
          <Typography variant="caption" component="div">
            {r.publicId}
          </Typography>
        </span>
      ),
    },
    {
      id: 'active',
      header: 'Active line items',
      type: 'number',
      accessor: (r) => r.activeLineItems,
    },
    ...COVERAGE_KEYS.map((k): DvColumn<BrandControlRow> => ({
      id: k,
      header: COVERAGE_LABEL[k],
      width: 240,
      cell: (r) => (
        <DvCoverageBar done={r.coverage[k].covered} total={r.coverage[k].total} noun="Line items" />
      ),
    })),
  ];
  const start = (page.page - 1) * page.size;
  return (
    <SettingsPage title="Brand controls" limited={limited}>
      <DvTabs
        ariaLabel="Brand controls"
        value={tab}
        onChange={(t) => {
          setTab(t as BrandTab);
          setPage({ page: 1, size: page.size });
        }}
        tabs={[
          { id: 'DISPLAY_VIDEO', label: 'Display and video' },
          { id: 'YOUTUBE', label: 'YouTube' },
        ]}
      />
      <DvGrid
        rows={rows.slice(start, start + page.size)}
        columns={columns}
        ariaLabel="Brand controls"
        getRowId={(r) => r.advertiserId}
        page={page.page}
        pageSize={page.size}
        total={rows.length}
        onPageChange={(p, size) => setPage({ page: p, size })}
        emptyState={<Typography sx={{ p: 4 }}>No advertisers</Typography>}
      />
    </SettingsPage>
  );
}
