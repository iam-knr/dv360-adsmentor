'use client';

// YouTube assets (module 15 S4, read only in v1) and the creator partnerships placeholders (S5).
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import {
  DvBanner,
  DvEmptyState,
  DvGrid,
  DvPageHeader,
  DvTabs,
  type DvColumn,
} from '@/components/dv';
import { useViewer } from '@/components/shell/ViewerProvider';
import type { YoutubeAssetRow } from '@/lib/resources/wire';

const TAB_LABEL = {
  location: 'Location',
  affiliate: 'Affiliate location',
  sitelink: 'Sitelink',
} as const;

function csv(rows: YoutubeAssetRow[]): string {
  const head = ['Name', 'Filters', 'Status', 'Clicks', 'Impressions', 'CTR', 'Avg. CPC'];
  const body = rows.map((r) =>
    [r.name, r.filters, r.status, r.clicks, r.impressions, r.ctr ?? '', r.avgCpc ?? '']
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(','),
  );
  return [head.join(','), ...body].join('\n');
}

export function YoutubeAssets({
  basePath,
  tab,
  rows,
  advertiserName,
  currency,
}: {
  basePath: string;
  tab: keyof typeof TAB_LABEL;
  rows: YoutubeAssetRow[];
  advertiserName: string;
  currency: string;
}) {
  const router = useRouter();
  const { viewer } = useViewer();
  const [expanded, setExpanded] = useState(true);
  const [page, setPage] = useState({ page: 1, size: 20 });
  const children = rows.filter(
    (r) => r.parentId !== null || !rows.some((o) => o.parentId === r.id),
  );
  const shown = expanded ? rows : [];
  const columns: DvColumn<YoutubeAssetRow>[] = useMemo(
    () => [
      { id: 'name', header: 'Name', sticky: true },
      { id: 'filters', header: 'Filters' },
      { id: 'status', header: 'Status', accessor: (r) => r.status.toLowerCase() },
      { id: 'clicks', header: 'Clicks', type: 'number', align: 'right' },
      { id: 'impressions', header: 'Impressions', type: 'number', align: 'right' },
      { id: 'ctr', header: 'CTR', type: 'percent', align: 'right', accessor: (r) => r.ctr },
      {
        id: 'avgCpc',
        header: 'Avg. CPC',
        type: 'currency',
        align: 'right',
        currencySymbol: currency,
        accessor: (r) => r.avgCpc,
      },
    ],
    [currency],
  );
  const download = () => {
    const url = URL.createObjectURL(new Blob([csv(rows)], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `youtube-assets-${tab}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <DvPageHeader title="YouTube assets" limitedAccess={viewer.limitedAccess}>
        <DvTabs
          tabs={Object.entries(TAB_LABEL).map(([id, label]) => ({ id, label }))}
          value={tab}
          onChange={(id) => router.push(`${basePath}?tab=${id}`)}
          ariaLabel="YouTube assets"
        />
      </DvPageHeader>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 2 }}>
        <Button variant="outlined" disabled>
          Apply campaign filter
        </Button>
        <Typography variant="body2">Data for all time</Typography>
        <Box sx={{ flex: 1 }} />
        <Button variant="text" aria-label="Download CSV" onClick={download}>
          Download CSV
        </Button>
      </Box>
      <Box sx={{ mb: 2 }}>
        <Button variant="text" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
          Advertiser level setting (All listings from {advertiserName})
        </Button>
      </Box>
      <DvGrid
        ariaLabel="YouTube assets"
        rows={shown.slice((page.page - 1) * page.size, page.page * page.size)}
        columns={columns}
        getRowId={(r) => r.id}
        page={page.page}
        pageSize={page.size}
        total={shown.length}
        onPageChange={(p, size) => setPage({ page: p, size })}
        emptyState={<DvEmptyState message="No assets yet" />}
      />
    </>
  );
}

const CREATOR_TABS: { id: string; label: string; text: string }[] = [
  {
    id: 'overview',
    label: 'Overview',
    text: 'See how creator partnerships fit into a YouTube plan.',
  },
  { id: 'search', label: 'Creator search', text: 'Find creators by topic and audience.' },
  { id: 'content', label: 'Content discovery', text: 'Browse videos that match your brand.' },
  { id: 'management', label: 'Management', text: 'Track agreements and deliverables.' },
  { id: 'analytics', label: 'Analytics', text: 'Measure the results of partnerships.' },
];

export function CreatorPartnerships() {
  const { viewer } = useViewer();
  const [tab, setTab] = useState('overview');
  const current = CREATOR_TABS.find((t) => t.id === tab)!;
  return (
    <>
      <DvBanner kind="info" level="page">
        BETA: YouTube creator partnerships
      </DvBanner>
      <DvPageHeader title="Creator partnerships" limitedAccess={viewer.limitedAccess}>
        <DvTabs
          tabs={CREATOR_TABS.map(({ id, label }) => ({ id, label }))}
          value={tab}
          onChange={setTab}
          ariaLabel="Creator partnerships"
        />
      </DvPageHeader>
      <DvEmptyState
        variant="illustrated"
        title="This area is not available in the classroom"
        message={`${current.text} In the real product this tab connects you with creators. The simulator keeps it as a placeholder.`}
      />
    </>
  );
}
