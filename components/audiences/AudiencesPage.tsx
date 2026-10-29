'use client';

// All audiences (module 14 S1 to S4): four tabs with the AUD_DELAY banner, filter bar, grid and the create buttons.
// Create buttons are disabled, not hidden, for read-only viewers (AUD-091).
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import {
  DvBanner,
  DvEmptyState,
  DvFilterBar,
  DvGrid,
  DvPageHeader,
  DvTabs,
  type DvColumn,
  type FilterValue,
  NAME_ID_FIELD,
} from '@/components/dv';
import { useViewer } from '@/components/shell/ViewerProvider';
import { AppLink } from '@/lib/routes/AppLink';
import { advertiserPath } from '@/lib/routes/paths';
import { bulkAudienceActionAction, listAudiencesAction } from '@/lib/audiences/actions';
import { MSG } from '@/lib/validation/messages';
import type { AudienceRow, AudienceTab } from '@/lib/audiences/wire';
import { AudienceStatus, SizeBar, detailsPath } from './shared';

const TAB_PATH: Record<AudienceTab, string> = {
  FIRST_PARTY: 'first-party-audiences',
  CUSTOM: 'custom-lists',
  COMBINED: 'combined-audiences',
  PARTNER: 'partner-audiences',
};

const TYPE_OPTIONS: Record<AudienceTab, { value: string; label: string }[]> = {
  FIRST_PARTY: [
    { value: 'TAG_BASED', label: 'Tag-based' },
    { value: 'CUSTOMER_MATCH', label: 'Customer match' },
    { value: 'YOUTUBE_USERS', label: 'YouTube users' },
    { value: 'LOOKALIKE', label: 'Lookalike' },
  ],
  CUSTOM: [
    { value: 'CUSTOM_AFFINITY', label: 'Custom affinity' },
    { value: 'CUSTOM_INTENT_DISPLAY_VIDEO', label: 'Custom intent (Display, Video)' },
    { value: 'CUSTOM_INTENT_YOUTUBE', label: 'Custom intent (YouTube)' },
  ],
  COMBINED: [],
  PARTNER: [{ value: 'PARTNER', label: 'Type: Commerce' }],
};

const STATUS_FIELD = {
  id: 'status',
  label: 'Status',
  type: 'single' as const,
  options: [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'ARCHIVED', label: 'Archived' },
  ],
};

export interface AudiencesPageProps {
  partnerId: string;
  advertiserId: string;
  tab: AudienceTab;
  rows: AudienceRow[];
  total: number;
}

export function AudiencesPage({ partnerId, advertiserId, tab, rows: initial, total: initialTotal }: AudiencesPageProps) {
  const router = useRouter();
  const { viewer } = useViewer();
  const [rows, setRows] = useState(initial);
  const [total, setTotal] = useState(initialTotal);
  const [filters, setFilters] = useState<FilterValue[]>([{ fieldId: 'status', values: ['ACTIVE'] }]);
  const [text, setText] = useState('');
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [page, setPage] = useState({ page: 1, size: 20 });
  const [, start] = useTransition();
  const first = useRef(true);

  const typeField = TYPE_OPTIONS[tab].length
    ? { id: 'type', label: 'Type', type: 'multi' as const, options: TYPE_OPTIONS[tab] }
    : null;
  const fields = typeField ? [typeField, STATUS_FIELD] : [STATUS_FIELD];

  const nameId = filters.find((f) => f.fieldId === NAME_ID_FIELD)?.values[0] ?? text;
  const statusFilter = filters.find((f) => f.fieldId === 'status')?.values[0] ?? 'ACTIVE';
  const typeFilter = filters.find((f) => f.fieldId === 'type')?.values ?? [];

  const reload = () =>
    start(async () => {
      const res = await listAudiencesAction(advertiserId, {
        tab,
        q: nameId,
        type: typeFilter,
        status: statusFilter === 'ARCHIVED' ? ['ARCHIVED'] : ['PROCESSING', 'ACTIVE', 'INACTIVE'],
      });
      setRows(res.rows);
      setTotal(res.total);
      setPage((p) => ({ ...p, page: 1 }));
    });

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    reload();
    // the filter state is the only trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameId, statusFilter, typeFilter.join(',')]);

  const base = (...seg: string[]) => advertiserPath(partnerId, advertiserId, ...seg);
  const sizeCol = (id: 'display' | 'youtube' | 'mobileApp' | 'ctv', header: string, group?: string): DvColumn<AudienceRow> => ({
    id,
    header,
    ...(group ? { group } : {}),
    width: 130,
    type: 'custom',
    cell: (r) => <SizeBar cell={r[id]} label={header} />,
  });
  const nameCol: DvColumn<AudienceRow> = {
    id: 'name',
    header: 'Audience name',
    sticky: true,
    width: 260,
    group: 'lists',
    cell: (r) => (
      <>
        <AppLink href={detailsPath(partnerId, advertiserId, r)} data-testid="audience-link">
          {r.name}
        </AppLink>
        {r.status === 'PROCESSING' ? (
          <Box component="span" sx={{ ml: 1 }}>
            <AudienceStatus status={r.status} availableInHours={r.availableInHours} />
          </Box>
        ) : null}
      </>
    ),
  };
  const idCol: DvColumn<AudienceRow> = { id: 'id', header: 'ID', width: 110, group: 'lists' };
  const typeCol: DvColumn<AudienceRow> = { id: 'typeLabel', header: 'Type', width: 140, group: 'details' };
  const statusCol: DvColumn<AudienceRow> = {
    id: 'status',
    header: 'Status',
    width: 190,
    type: 'custom',
    cell: (r) => <AudienceStatus status={r.status} availableInHours={r.availableInHours} />,
  };
  const liCol = (header: string, group?: string): DvColumn<AudienceRow> => ({
    id: 'lineItems',
    header,
    ...(group ? { group } : {}),
    width: 120,
    align: 'right',
    type: 'custom',
    cell: (r) =>
      r.lineItems > 0 ? (
        <AppLink href={base('audience', r.id, 'explorerlis')}>{r.lineItems}</AppLink>
      ) : (
        <span>0</span>
      ),
  });

  const columns: DvColumn<AudienceRow>[] =
    tab === 'FIRST_PARTY'
      ? [
          nameCol,
          idCol,
          typeCol,
          { id: 'source', header: 'Source', width: 160, group: 'details' },
          sizeCol('display', 'Display size', 'delivery'),
          sizeCol('youtube', 'YouTube users', 'delivery'),
          sizeCol('mobileApp', 'Mobile app', 'delivery'),
          sizeCol('ctv', 'CTV devices', 'delivery'),
          liCol('Display line items', 'delivery'),
        ]
      : tab === 'CUSTOM'
        ? [
            { ...nameCol, group: undefined },
            { ...idCol, group: undefined },
            { ...typeCol, group: undefined },
            sizeCol('display', 'Display size'),
            sizeCol('youtube', 'YouTube size'),
            statusCol,
            liCol('Line items'),
          ]
        : tab === 'COMBINED'
          ? [
              { ...nameCol, group: undefined },
              { ...idCol, group: undefined },
              sizeCol('display', 'Display size'),
              {
                id: 'activeDisplay',
                header: 'Active Display size',
                width: 140,
                type: 'custom',
                cell: (r) => (r.activeDisplay ? <SizeBar cell={r.activeDisplay} /> : null),
              },
              {
                id: 'youtube',
                header: 'YouTube size',
                width: 130,
                type: 'custom',
                cell: (r) => (r.youtubeUnavailable ? <span>Unavailable</span> : <SizeBar cell={r.youtube} />),
              },
            ]
          : [
              { ...nameCol, group: undefined },
              { ...idCol, group: undefined },
              { ...typeCol, group: undefined },
              { id: 'source', header: 'Source', width: 160 },
              sizeCol('display', 'Display size'),
              sizeCol('youtube', 'YouTube users'),
              liCol('Line items'),
            ];

  const groups =
    tab === 'FIRST_PARTY'
      ? [
          { id: 'lists', label: 'Audience Lists' },
          { id: 'details', label: 'Details' },
          { id: 'delivery', label: 'Delivery' },
        ]
      : undefined;

  const newButtons =
    tab === 'FIRST_PARTY' ? (
      <Button variant="contained" disabled={viewer.readOnly} onClick={() => router.push(base('audience', 'new'))}>
        New Audience
      </Button>
    ) : tab === 'CUSTOM' ? (
      <>
        <Button variant="contained" disabled={viewer.readOnly} onClick={(e) => setMenu(e.currentTarget)}>
          New Custom List
        </Button>
        <Menu anchorEl={menu} open={menu !== null} onClose={() => setMenu(null)}>
          <MenuItem onClick={() => router.push(base('customaudience', 'affinity', 'new'))}>Custom affinity</MenuItem>
          <MenuItem onClick={() => router.push(`${base('customaudience', 'intent', 'new')}?surface=display`)}>
            Custom Intent (Display, Video)
          </MenuItem>
          <MenuItem onClick={() => router.push(`${base('customaudience', 'intent', 'new')}?surface=youtube`)}>
            Custom Intent (YouTube)
          </MenuItem>
        </Menu>
      </>
    ) : tab === 'COMBINED' ? (
      <Button variant="contained" disabled={viewer.readOnly} onClick={() => router.push(base('combinedaudience', 'new'))}>
        New Combined Audience
      </Button>
    ) : null;

  const bulk = (action: 'ARCHIVE' | 'UNARCHIVE') =>
    start(async () => {
      await bulkAudienceActionAction({ ids: [...selection], action });
      setSelection(new Set());
      reload();
      router.refresh();
    });

  return (
    <>
      <DvPageHeader title="All audiences" limitedAccess={viewer.limitedAccess} actions={newButtons}>
        <DvTabs
          ariaLabel="Audience lists"
          value={tab}
          tabs={[
            { id: 'FIRST_PARTY', label: 'First-party' },
            { id: 'CUSTOM', label: 'Custom lists' },
            { id: 'COMBINED', label: 'Combined' },
            { id: 'PARTNER', label: 'Partner' },
          ]}
          onChange={(id) => router.push(base(TAB_PATH[id as AudienceTab]))}
        />
      </DvPageHeader>
      <DvBanner kind="info" level="page">
        {MSG.AUD_DELAY}
      </DvBanner>
      <Box sx={{ my: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
        <Box sx={{ flex: 1 }}>
          <DvFilterBar
            ariaLabel="Audience filters"
            fields={fields}
            value={filters}
            text={text}
            onChange={(v, t) => {
              setFilters(v);
              setText(t);
            }}
          />
        </Box>
        {selection.size > 0 && !viewer.readOnly ? (
          statusFilter === 'ARCHIVED' ? (
            <Button onClick={() => bulk('UNARCHIVE')}>Unarchive {selection.size}</Button>
          ) : (
            <Button onClick={() => bulk('ARCHIVE')}>Archive {selection.size}</Button>
          )
        ) : null}
      </Box>
      <DvGrid
        ariaLabel={`${tab === 'FIRST_PARTY' ? 'First-party' : tab === 'CUSTOM' ? 'Custom' : tab === 'COMBINED' ? 'Combined' : 'Partner'} audiences`}
        rows={rows.slice((page.page - 1) * page.size, page.page * page.size)}
        columns={columns}
        {...(groups ? { groups } : {})}
        getRowId={(r) => r.id}
        {...(tab === 'PARTNER' ? {} : { selection, onSelectionChange: setSelection })}
        page={page.page}
        pageSize={page.size}
        total={total}
        onPageChange={(p, size) => setPage({ page: p, size })}
        isArchived={(r) => r.status === 'ARCHIVED'}
        emptyState={
          nameId || typeFilter.length ? (
            <DvEmptyState message="No results." />
          ) : (
            <DvEmptyState
              message="No audiences yet"
              action={
                viewer.readOnly || tab === 'PARTNER'
                  ? undefined
                  : {
                      label: tab === 'COMBINED' ? 'New Combined Audience' : tab === 'CUSTOM' ? 'New Custom List' : 'New Audience',
                      onClick: () =>
                        router.push(
                          tab === 'COMBINED'
                            ? base('combinedaudience', 'new')
                            : tab === 'CUSTOM'
                              ? base('customaudience', 'affinity', 'new')
                              : base('audience', 'new'),
                        ),
                    }
              }
            />
          )
        }
      />
    </>
  );
}
