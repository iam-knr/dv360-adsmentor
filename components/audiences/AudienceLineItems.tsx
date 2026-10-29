'use client';

// Audience "Line items" tab (module 14 S15): the line items with an AUDIENCE targeting row for this list.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DvEmptyState, DvEntityHeader, DvGrid, DvTabs, type DvColumn } from '@/components/dv';
import { AppLink } from '@/lib/routes/AppLink';
import { advertiserPath, liPath } from '@/lib/routes/paths';
import type { AudienceStatusKey, AudienceTypeKey, LinkedLineItem } from '@/lib/audiences/wire';
import { AudienceStatus, detailsPath } from './shared';

export function AudienceLineItems({
  partnerId,
  advertiserId,
  audience,
  items,
  externalSource,
}: {
  partnerId: string;
  advertiserId: string;
  audience: { id: string; name: string; status: AudienceStatusKey; type: AudienceTypeKey };
  items: LinkedLineItem[];
  externalSource: boolean;
}) {
  const router = useRouter();
  const [page, setPage] = useState({ page: 1, size: 20 });
  const base = (...seg: string[]) => advertiserPath(partnerId, advertiserId, ...seg);
  const columns: DvColumn<LinkedLineItem>[] = [
    {
      id: 'name',
      header: 'Line item',
      sticky: true,
      width: 300,
      cell: (r) => <AppLink href={liPath(partnerId, advertiserId, r.campaignId, r.ioId, r.id)}>{r.name}</AppLink>,
    },
    { id: 'id', header: 'ID', width: 110 },
    { id: 'type', header: 'Type', width: 160 },
    { id: 'status', header: 'Status', width: 120 },
    { id: 'mode', header: 'Targeting', width: 120 },
  ];
  return (
    <>
      <DvEntityHeader
        crumbs={[{ label: 'All audiences', href: base('first-party-audiences') }]}
        title={`${audience.name} (${audience.id})`}
        status={<AudienceStatus status={audience.status} />}
      >
        <DvTabs
          ariaLabel="Audience"
          value="lis"
          tabs={[
            { id: 'details', label: 'Audience details', disabled: externalSource },
            { id: 'lis', label: 'Line items' },
          ]}
          onChange={(id) => {
            if (id === 'details') router.push(detailsPath(partnerId, advertiserId, audience));
          }}
        />
      </DvEntityHeader>
      <DvGrid
        ariaLabel="Line items"
        rows={items.slice((page.page - 1) * page.size, page.page * page.size)}
        columns={columns}
        getRowId={(r) => r.id}
        page={page.page}
        pageSize={page.size}
        total={items.length}
        onPageChange={(p, size) => setPage({ page: p, size })}
        emptyState={<DvEmptyState message="No results." />}
      />
    </>
  );
}
