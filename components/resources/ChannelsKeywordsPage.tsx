'use client';

// "Channels & keywords" (module 15 S2): tabs Channels and Negative keyword lists. The channel editor opens from
// `?sim_panel=channel:{id}`, the keyword list editor inline from `?list={id}`.
import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { DvEmptyState, DvGrid, DvPageHeader, DvTabs, type DvColumn } from '@/components/dv';
import { useViewer } from '@/components/shell/ViewerProvider';
import { advertiserPath, partnerPath } from '@/lib/routes/paths';
import type { ChannelRow, KeywordListRow } from '@/lib/resources/wire';
import { ChannelEditor } from './ChannelEditor';
import { KeywordListEditor } from './KeywordListEditor';

export interface ChannelsKeywordsPageProps {
  partnerId: string;
  /** Absent at partner level (the partner page has channels only). */
  advertiserId?: string;
  tab: 'channels' | 'keywords';
  channels: ChannelRow[];
  keywordLists: KeywordListRow[];
}

function useParam(name: string): [string | null, (v: string | null) => void] {
  const router = useRouter();
  const path = usePathname();
  const search = useSearchParams();
  const value = search?.get(name) ?? null;
  const set = (v: string | null) => {
    const next = new URLSearchParams(search?.toString() ?? '');
    if (v === null) next.delete(name);
    else next.set(name, v);
    const qs = next.toString();
    router.replace(qs ? `${path}?${qs}` : path);
  };
  return [value, set];
}

export function ChannelsKeywordsPage({
  partnerId,
  advertiserId,
  tab,
  channels,
  keywordLists,
}: ChannelsKeywordsPageProps) {
  const { viewer } = useViewer();
  const router = useRouter();
  const [panel, setPanel] = useParam('sim_panel');
  const [listParam, setListParam] = useParam('list');
  const [page, setPage] = useState({ page: 1, size: 20 });
  const channelId = panel?.startsWith('channel:') ? panel.slice('channel:'.length) : null;
  const scope = advertiserId
    ? ({ level: 'advertiser', id: advertiserId } as const)
    : ({ level: 'partner', id: partnerId } as const);
  const base = (seg: string) =>
    advertiserId ? advertiserPath(partnerId, advertiserId, seg) : partnerPath(partnerId, seg);

  const channelColumns: DvColumn<ChannelRow>[] = [
    {
      id: 'name',
      header: 'Channel',
      sticky: true,
      cell: (r) => (
        <Button variant="text" onClick={() => setPanel(`channel:${r.id}`)}>
          {r.name}
        </Button>
      ),
    },
    { id: 'apps', header: 'Mobile & CTV Apps', type: 'number', align: 'right' },
    { id: 'urls', header: 'URLs', type: 'number', align: 'right' },
    { id: 'includedByLis', header: 'Included by line items', type: 'number', align: 'right' },
    { id: 'excludedByLis', header: 'Excluded by line items', type: 'number', align: 'right' },
  ];
  const keywordColumns: DvColumn<KeywordListRow>[] = [
    {
      id: 'name',
      header: 'Keyword list',
      sticky: true,
      cell: (r) => (
        <Button variant="text" onClick={() => setListParam(r.id)}>
          {r.name}
        </Button>
      ),
    },
    { id: 'keywords', header: 'Keywords', type: 'number', align: 'right' },
    { id: 'lineItems', header: 'Line items', type: 'number', align: 'right' },
  ];

  const newButton =
    tab === 'channels' ? (
      <Button
        variant="contained"
        disabled={viewer.readOnly}
        onClick={() => setPanel('channel:new')}
      >
        New channel
      </Button>
    ) : advertiserId ? (
      <Button variant="contained" disabled={viewer.readOnly} onClick={() => setListParam('new')}>
        New List
      </Button>
    ) : null;

  return (
    <>
      <DvPageHeader
        title="Channels & keywords"
        limitedAccess={viewer.limitedAccess}
        actions={newButton}
      >
        {advertiserId ? (
          <DvTabs
            tabs={[
              { id: 'channels', label: 'Channels' },
              { id: 'keywords', label: 'Negative keyword lists' },
            ]}
            value={tab}
            onChange={(id) =>
              router.push(base(id === 'channels' ? 'channels' : 'negative-keywords'))
            }
            ariaLabel="Channels and keywords"
          />
        ) : null}
      </DvPageHeader>
      {tab === 'channels' ? (
        <DvGrid
          ariaLabel="Channels"
          rows={channels.slice((page.page - 1) * page.size, page.page * page.size)}
          columns={channelColumns}
          getRowId={(r) => r.id}
          page={page.page}
          pageSize={page.size}
          total={channels.length}
          onPageChange={(p, size) => setPage({ page: p, size })}
          emptyState={
            <DvEmptyState
              message="No channels yet"
              action={
                viewer.readOnly
                  ? undefined
                  : { label: 'New channel', onClick: () => setPanel('channel:new') }
              }
            />
          }
        />
      ) : (
        <>
          {listParam && advertiserId ? (
            <Box sx={{ mb: 4 }}>
              <KeywordListEditor
                key={listParam}
                listId={listParam}
                advertiserId={advertiserId}
                readOnly={viewer.readOnly}
                onClose={() => setListParam(null)}
              />
            </Box>
          ) : null}
          <DvGrid
            ariaLabel="Negative keyword lists"
            rows={keywordLists.slice((page.page - 1) * page.size, page.page * page.size)}
            columns={keywordColumns}
            getRowId={(r) => r.id}
            page={page.page}
            pageSize={page.size}
            total={keywordLists.length}
            onPageChange={(p, size) => setPage({ page: p, size })}
            emptyState={<DvEmptyState message="No negative keyword lists yet" />}
          />
        </>
      )}
      {channelId ? (
        <ChannelEditor
          key={channelId}
          channelId={channelId}
          scope={scope}
          readOnly={viewer.readOnly}
          onClose={() => setPanel(null)}
        />
      ) : null}
    </>
  );
}
