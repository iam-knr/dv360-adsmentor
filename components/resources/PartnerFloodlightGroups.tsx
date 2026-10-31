'use client';

// Partner level "Floodlight groups" (module 15 S3, partner variant): the groups of the partner's advertisers.
import { useState } from 'react';
import { AppLink } from '@/lib/routes/AppLink';
import { advertiserPath } from '@/lib/routes/paths';
import { DvEmptyState, DvGrid, DvPageHeader, type DvColumn } from '@/components/dv';
import { useViewer } from '@/components/shell/ViewerProvider';

export interface PartnerGroupRow {
  id: string;
  name: string;
  advertiser: string;
  advertiserId: string;
  conversions: number;
}

export function PartnerFloodlightGroups({
  rows,
  partnerId,
}: {
  rows: PartnerGroupRow[];
  partnerId: string;
}) {
  const { viewer } = useViewer();
  const [page, setPage] = useState({ page: 1, size: 20 });
  const columns: DvColumn<PartnerGroupRow>[] = [
    {
      id: 'name',
      header: 'Floodlight group',
      sticky: true,
      cell: (r) => (
        <AppLink href={advertiserPath(partnerId, r.advertiserId, 'fl', 'events')}>{r.name}</AppLink>
      ),
    },
    { id: 'id', header: 'ID' },
    { id: 'advertiser', header: 'Advertiser' },
    { id: 'conversions', header: 'Floodlight conversions', type: 'number', align: 'right' },
  ];
  return (
    <>
      <DvPageHeader title="Floodlight groups" limitedAccess={viewer.limitedAccess} />
      <DvGrid
        ariaLabel="Floodlight groups"
        rows={rows.slice((page.page - 1) * page.size, page.page * page.size)}
        columns={columns}
        getRowId={(r) => r.id}
        page={page.page}
        pageSize={page.size}
        total={rows.length}
        onPageChange={(p, size) => setPage({ page: p, size })}
        emptyState={<DvEmptyState message="No Floodlight groups yet" />}
      />
    </>
  );
}
