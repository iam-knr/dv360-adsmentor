'use client';

// Creatives library (module 12 S1): list and grid views, filter bar, 16 columns, refresh, bulk Action bar and the
// New ▾ menu. Rows come from the server; filters, paging and sorting call `listCreativesAction`.
import { useCallback, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import {
  DvBulkBar,
  DvEmptyState,
  DvFilterBar,
  DvGrid,
  DvHoverDetail,
  DvModal,
  DvPageHeader,
  DvStatusChip,
  DvStatusDot,
  DvTooltip,
  type DvColumn,
  type FilterField,
  type FilterValue,
} from '@/components/dv';
import { DvIcon } from '@/components/icons';
import { useViewer } from '@/components/shell/ViewerProvider';
import {
  activeLineItemUseAction,
  bulkCreativeStatusAction,
  listCreativesAction,
} from '@/lib/creatives/actions';
import { toCsv, type BulkCreativeKind } from '@/lib/creatives/bulk-csv';
import { KIND_META } from '@/lib/creatives/kinds';
import type {
  CreativeListQuery,
  CreativeListResult,
  CreativeRow,
  CreativeStatus,
  Dv360Status,
} from '@/lib/creatives/types';
import { AppLink } from '@/lib/routes/AppLink';
import { advertiserPath } from '@/lib/routes/paths';
import { AssignDialog } from './AssignDialog';
import { BulkAddDialog } from './BulkAddDialog';
import { NewCreativeMenu } from './NewCreativeMenu';
import { PreviewDialog } from './PreviewDialog';

export const DEFAULT_FILTERS: FilterValue[] = [{ fieldId: 'status', values: ['ACTIVE'] }];

const FORMAT_OPTIONS = [
  ...new Set(Object.values(KIND_META).map((m) => m.format)),
  'Optimized',
].sort();

export const FILTER_FIELDS: FilterField[] = [
  {
    id: 'status',
    label: 'Status',
    type: 'multi',
    options: [
      { value: 'ACTIVE', label: 'Active' },
      { value: 'PAUSED', label: 'Paused' },
      { value: 'ARCHIVED', label: 'Archived' },
    ],
  },
  {
    id: 'type',
    label: 'Type',
    type: 'single',
    options: [
      { value: 'Standard', label: 'Standard' },
      { value: 'Third party', label: 'Third party' },
    ],
  },
  {
    id: 'format',
    label: 'Format',
    type: 'single',
    options: FORMAT_OPTIONS.map((f) => ({ value: f, label: f })),
  },
  {
    id: 'dv360Status',
    label: 'DV360 status',
    type: 'single',
    options: [
      { value: 'SERVABLE', label: 'Servable' },
      { value: 'NOT_SERVABLE', label: 'Not servable' },
      { value: 'PENDING', label: 'Pending' },
    ],
  },
  {
    id: 'exchangeStatus',
    label: 'Exchange status',
    type: 'single',
    options: [
      { value: 'SERVABLE', label: 'Servable' },
      { value: 'NOT_SERVABLE', label: 'Not servable' },
    ],
  },
  {
    id: 'source',
    label: 'Source',
    type: 'single',
    options: [
      { value: 'DV360', label: 'Display & Video 360' },
      { value: 'CM360', label: 'Campaign Manager 360' },
      { value: 'THIRD_PARTY', label: 'Third party' },
    ],
  },
  {
    id: 'aiLabel',
    label: 'AI label',
    type: 'single',
    options: [
      { value: 'AI_GENERATED', label: 'Labeled' },
      { value: 'NOT_AI_GENERATED', label: 'Not labeled' },
      { value: 'UNSET', label: 'Not set' },
    ],
  },
];

export function toQuery(
  filters: FilterValue[],
  text: string,
  extra: Partial<CreativeListQuery>,
): CreativeListQuery {
  const q: CreativeListQuery = { ...extra };
  const one = (id: string) => filters.find((f) => f.fieldId === id)?.values[0];
  const status = filters.find((f) => f.fieldId === 'status')?.values;
  // no status chip: every status, like removing the default chip in DV360
  q.status = (status?.length ? status : ['ACTIVE', 'PAUSED', 'ARCHIVED']) as CreativeStatus[];
  const type = one('type');
  if (type) q.type = type;
  const format = one('format');
  if (format) q.format = format;
  const dv = one('dv360Status');
  if (dv) q.dv360Status = dv as Dv360Status;
  const ex = one('exchangeStatus');
  if (ex) q.exchangeStatus = ex as 'SERVABLE' | 'NOT_SERVABLE';
  const source = one('source');
  if (source) q.source = source;
  const ai = one('aiLabel');
  if (ai) q.aiLabel = ai;
  const name = text.trim() || filters.find((f) => f.fieldId === '__nameId')?.values[0];
  if (name) q.q = name;
  return q;
}

const dateText = (iso: string) => new Date(iso).toLocaleDateString('en-GB');

function Dv360Chip({ status }: { status: Dv360Status }) {
  if (status === 'SERVABLE') return <DvStatusChip kind="servable" />;
  if (status === 'NOT_SERVABLE') return <DvStatusChip kind="disapproved" label="Not servable" />;
  return <DvStatusChip kind="pending" />;
}

const STATUS_DOT = { ACTIVE: 'active', PAUSED: 'paused', ARCHIVED: 'archived' } as const;
const STATUS_LABEL = { ACTIVE: 'Active', PAUSED: 'Paused', ARCHIVED: 'Archived' } as const;

function CreativeCard({
  row,
  href,
  selected,
  onToggle,
  canSelect,
}: {
  row: CreativeRow;
  href: string;
  selected: boolean;
  onToggle: () => void;
  canSelect: boolean;
}) {
  const size = row.dimensions ?? row.duration ?? '-';
  return (
    <Box
      data-testid="creative-card"
      sx={{
        width: 220,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
        position: 'relative',
        bgcolor: 'background.paper',
        '&:hover .select': { opacity: 1 },
      }}
    >
      {canSelect ? (
        <Checkbox
          className="select"
          checked={selected}
          onChange={onToggle}
          sx={{
            position: 'absolute',
            top: 4,
            left: 4,
            opacity: selected ? 1 : 0,
            bgcolor: 'background.paper',
            borderRadius: 1,
            '&:focus-within': { opacity: 1 },
          }}
          slotProps={{ input: { 'aria-label': `Select ${row.name}` } }}
        />
      ) : null}
      <AppLink href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
        <Box
          sx={{
            height: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'surface.sunken',
            color: 'text.secondary',
          }}
        >
          <DvIcon
            name={
              KIND_META[row.kind].media === 'audio'
                ? 'headphones'
                : KIND_META[row.kind].media === 'video'
                  ? 'videocam'
                  : 'web'
            }
            size={40}
          />
        </Box>
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography noWrap fontWeight={500} title={row.name}>
            {row.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {size}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DvStatusDot status={STATUS_DOT[row.status]} />
            <Dv360Chip status={row.dv360Status} />
          </Box>
          <Typography variant="caption">{row.exchangeStatus.text}</Typography>
        </Box>
      </AppLink>
    </Box>
  );
}

export function CreativesLibrary({
  partnerId,
  advertiserId,
  initial,
}: {
  partnerId: string;
  advertiserId: string;
  initial: CreativeListResult;
}) {
  const { viewer } = useViewer();
  const router = useRouter();
  const [result, setResult] = useState(initial);
  const [filters, setFilters] = useState<FilterValue[]>(DEFAULT_FILTERS);
  const [text, setText] = useState('');
  const [sort, setSort] = useState<{ id: string; dir: 'asc' | 'desc' }>({
    id: 'createdAt',
    dir: 'desc',
  });
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [loading, startLoad] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [bulkKind, setBulkKind] = useState<BulkCreativeKind | 'templates' | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [confirm, setConfirm] = useState<{
    action: 'PAUSE' | 'ARCHIVE';
    ids: string[];
    n: number;
  } | null>(null);
  const [preview, setPreview] = useState<CreativeRow | null>(null);

  const readOnly = viewer.readOnly;
  const base = (...sub: string[]) => advertiserPath(partnerId, advertiserId, ...sub);
  const creativeHref = (r: CreativeRow) => base('creatives', r.publicId);

  const load = useCallback(
    (nextFilters: FilterValue[], nextText: string, page: number, size: number, nextSort = sort) => {
      startLoad(async () => {
        const res = await listCreativesAction(
          advertiserId,
          toQuery(nextFilters, nextText, {
            page,
            pageSize: size,
            sort: { field: nextSort.id as 'name', dir: nextSort.dir },
          }),
        );
        if (!res) {
          setError("Couldn't load creatives");
          return;
        }
        setError(null);
        setResult(res);
        setSelection(new Set());
      });
    },
    [advertiserId, sort],
  );

  const rowsById = useMemo(() => new Map(result.rows.map((r) => [r.id, r])), [result.rows]);
  const selectedRows = [...selection].flatMap((id) =>
    rowsById.get(id) ? [rowsById.get(id)!] : [],
  );

  const runStatus = async (
    action: 'ACTIVATE' | 'PAUSE' | 'ARCHIVE' | 'UNARCHIVE',
    ids: string[],
  ) => {
    const res = await bulkCreativeStatusAction(advertiserId, { ids, action });
    if (!res.ok) {
      setError(res.issues[0]?.message ?? "Couldn't change the status.");
      return;
    }
    setError(null);
    setMessage(`Status edited on ${ids.length} ${ids.length === 1 ? 'creative' : 'creatives'}`);
    load(filters, text, result.page, result.pageSize);
  };

  const onBulk = async (id: string) => {
    const ids = [...selection];
    if (id === 'assign') return setAssignOpen(true);
    if (id === 'download') {
      const csv = toCsv([
        [
          'Name',
          'ID',
          'Status',
          'Type',
          'Format',
          'DV360 status',
          'Exchange status',
          'Dimensions',
          'Duration',
          'Source',
          'Created',
          'Line items',
        ],
        ...selectedRows.map((r) => [
          r.name,
          r.publicId,
          STATUS_LABEL[r.status],
          r.type,
          r.format,
          r.dv360Status,
          r.exchangeStatus.text,
          r.dimensions,
          r.duration,
          r.source,
          r.createdAt,
          r.lineItems,
        ]),
      ]);
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'creatives.csv';
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const action = id.toUpperCase() as 'ACTIVATE' | 'PAUSE' | 'ARCHIVE' | 'UNARCHIVE';
    if (action === 'PAUSE' || action === 'ARCHIVE') {
      // CRE-070: warn when active line items use these creatives
      const n = await activeLineItemUseAction(advertiserId, ids);
      if (n > 0) return setConfirm({ action, ids, n });
    }
    await runStatus(action, ids);
  };

  const columns: DvColumn<CreativeRow>[] = [
    {
      id: 'name',
      header: 'Name',
      sticky: true,
      width: 240,
      sortable: true,
      cell: (r) => (
        <AppLink href={creativeHref(r)} aria-label={r.name}>
          {r.name}
        </AppLink>
      ),
    },
    { id: 'publicId', header: 'ID', sortable: true, accessor: (r) => r.publicId },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      cell: (r) => (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
          <DvStatusDot status={STATUS_DOT[r.status]} />
          {STATUS_LABEL[r.status]}
        </Box>
      ),
    },
    { id: 'type', header: 'Type' },
    { id: 'format', header: 'Format' },
    { id: 'aiLabel', header: 'AI label' },
    {
      id: 'dv360Status',
      header: 'DV360 status',
      cell: (r) => <Dv360Chip status={r.dv360Status} />,
    },
    {
      id: 'exchangeStatus',
      header: 'Exchange status',
      width: 170,
      cell: (r) =>
        r.exchangeStatus.total === 0 ? (
          '-'
        ) : (
          <DvHoverDetail
            detail={
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                {r.exchangeStatus.exchanges.map((e) => (
                  <li key={e.name}>
                    {e.name}:{' '}
                    {e.status === 'APPROVED'
                      ? 'Approved'
                      : e.status === 'PENDING'
                        ? 'Pending'
                        : 'Disapproved'}
                  </li>
                ))}
              </Box>
            }
          >
            {r.exchangeStatus.text}
          </DvHoverDetail>
        ),
    },
    { id: 'companions', header: 'Companions', type: 'number', align: 'right' },
    { id: 'dimensions', header: 'Dimensions' },
    { id: 'duration', header: 'Duration' },
    { id: 'source', header: 'Source' },
    { id: 'createdAt', header: 'Created', sortable: true, accessor: (r) => dateText(r.createdAt) },
    { id: 'modifiedAt', header: 'Modified', accessor: (r) => dateText(r.modifiedAt) },
    { id: 'tagWrapping', header: 'Tag wrapping' },
    {
      id: 'lineItems',
      header: 'Line Items',
      cell: (r) =>
        r.lineItems > 0 ? (
          <AppLink href={`${base('explorerlis')}?f.creative=${r.publicId}`}>
            {r.lineItems} line {r.lineItems === 1 ? 'item' : 'items'}
          </AppLink>
        ) : (
          '0 line items'
        ),
    },
  ];

  const unarchiveOk = selectedRows.length > 0 && selectedRows.every((r) => r.status === 'ARCHIVED');
  const bulkGroups = [
    {
      label: 'Action',
      items: [
        { id: 'activate', label: 'Activate', disabled: readOnly },
        { id: 'pause', label: 'Pause', disabled: readOnly },
        { id: 'archive', label: 'Archive', disabled: readOnly },
        { id: 'unarchive', label: 'Unarchive', disabled: readOnly || !unarchiveOk },
        { id: 'assign', label: 'Assign to line items…', disabled: readOnly },
        { id: 'download', label: 'Download' },
      ],
    },
  ];

  const empty = filters.length === 1 && filters[0]?.fieldId === 'status' && !text;
  const noCreatives = result.total === 0 && empty && filters[0]?.values.join() === 'ACTIVE';

  return (
    <>
      <DvPageHeader
        title="Creatives"
        limitedAccess={viewer.limitedAccess}
        actions={
          readOnly ? undefined : (
            <NewCreativeMenu
              onKind={(kind) => router.push(`${base('creatives', 'new')}?kind=${kind}`)}
              onBulk={setBulkKind}
              onHref={(href) =>
                href === 'templates' ? setBulkKind('templates') : router.push(base(href))
              }
            />
          )
        }
      />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <DvFilterBar
            fields={FILTER_FIELDS}
            value={filters}
            text={text}
            onChange={(v, t) => {
              setFilters(v);
              setText(t);
              load(v, t, 1, result.pageSize);
            }}
          />
        </Box>
        <DvTooltip title="Refresh">
          <IconButton
            aria-label="Refresh"
            onClick={() => load(filters, text, result.page, result.pageSize)}
          >
            <DvIcon name="refresh" size={20} />
          </IconButton>
        </DvTooltip>
        <DvTooltip title={view === 'list' ? 'Grid view' : 'List view'}>
          <IconButton
            aria-label={view === 'list' ? 'Grid view' : 'List view'}
            onClick={() => setView(view === 'list' ? 'grid' : 'list')}
          >
            <DvIcon name={view === 'list' ? 'view_module' : 'view_list'} size={20} />
          </IconButton>
        </DvTooltip>
      </Box>
      {message ? (
        <Typography role="status" sx={{ mb: 1 }}>
          {message}
        </Typography>
      ) : null}
      {selection.size > 0 ? (
        <DvBulkBar
          count={selection.size}
          groups={bulkGroups}
          onAction={(id) => void onBulk(id)}
          onClear={() => setSelection(new Set())}
        />
      ) : null}
      {error ? (
        <Box
          role="alert"
          sx={{ display: 'flex', alignItems: 'center', gap: 2, color: 'error.main', mb: 2 }}
        >
          {error}
          <Button size="small" onClick={() => load(filters, text, result.page, result.pageSize)}>
            Retry
          </Button>
        </Box>
      ) : null}
      {view === 'list' ? (
        <DvGrid
          ariaLabel="Creatives"
          rows={result.rows}
          columns={columns}
          getRowId={(r) => r.id}
          selection={readOnly ? undefined : selection}
          onSelectionChange={readOnly ? undefined : setSelection}
          sort={sort}
          onSortChange={(s) => {
            if (!s) return;
            setSort(s);
            load(filters, text, 1, result.pageSize, s);
          }}
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          onPageChange={(p, size) => load(filters, text, p, size)}
          loading={loading}
          getAlert={(r) => (r.alert ? 'warning' : null)}
          rowActions={(r) => (
            <>
              <DvTooltip title="Preview">
                <IconButton
                  size="small"
                  aria-label={`Preview ${r.name}`}
                  onClick={() => setPreview(r)}
                >
                  <DvIcon name="play_circle" size={18} />
                </IconButton>
              </DvTooltip>
              {readOnly ? null : (
                <DvTooltip title="Edit">
                  <IconButton
                    size="small"
                    aria-label={`Edit ${r.name}`}
                    onClick={() => router.push(creativeHref(r))}
                  >
                    <DvIcon name="edit" size={18} />
                  </IconButton>
                </DvTooltip>
              )}
            </>
          )}
          emptyState={
            noCreatives ? (
              <DvEmptyState
                title="No creatives yet"
                message="Creatives you upload or add as tags will show up here."
                {...(readOnly
                  ? {}
                  : {
                      action: {
                        label: 'New',
                        onClick: () =>
                          router.push(`${base('creatives', 'new')}?kind=third-party-display`),
                        primary: true,
                      },
                    })}
              />
            ) : (
              <Typography sx={{ p: 4 }}>No results.</Typography>
            )
          }
          isArchived={(r) => r.status === 'ARCHIVED'}
        />
      ) : result.rows.length === 0 ? (
        <Typography sx={{ p: 4 }}>{noCreatives ? 'No creatives yet' : 'No results.'}</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {result.rows.map((r) => (
            <CreativeCard
              key={r.id}
              row={r}
              href={creativeHref(r)}
              selected={selection.has(r.id)}
              canSelect={!readOnly}
              onToggle={() =>
                setSelection((cur) => {
                  const next = new Set(cur);
                  if (next.has(r.id)) next.delete(r.id);
                  else next.add(r.id);
                  return next;
                })
              }
            />
          ))}
        </Box>
      )}

      <BulkAddDialog
        kind={bulkKind}
        advertiserId={advertiserId}
        bulkStatusHref="/bulk-status"
        onClose={() => setBulkKind(null)}
        onDone={() => {
          setBulkKind(null);
          load(filters, text, 1, result.pageSize);
        }}
      />
      <AssignDialog
        open={assignOpen}
        advertiserId={advertiserId}
        creativeIds={[...selection]}
        onClose={() => setAssignOpen(false)}
        onDone={() => {
          setAssignOpen(false);
          load(filters, text, result.page, result.pageSize);
        }}
      />
      <PreviewDialog
        open={preview !== null}
        advertiserId={advertiserId}
        {...(preview ? { creativeId: preview.id } : {})}
        title={preview ? `Preview: ${preview.name}` : 'Preview'}
        onClose={() => setPreview(null)}
      />
      <DvModal
        open={confirm !== null}
        title={confirm?.action === 'ARCHIVE' ? 'Archive creatives' : 'Pause creatives'}
        primary={{
          label: confirm?.action === 'ARCHIVE' ? 'Archive' : 'Pause',
          onClick: () => {
            const c = confirm!;
            setConfirm(null);
            void runStatus(c.action, c.ids);
          },
        }}
        secondary={{ label: 'Cancel', onClick: () => setConfirm(null) }}
        onClose={() => setConfirm(null)}
      >
        {confirm ? (
          <Typography>This creative is assigned to {confirm.n} active line items.</Typography>
        ) : null}
      </DvModal>
    </>
  );
}
