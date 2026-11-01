'use client';

// Insertion orders grid (module 07 2.2, fidelity audit CAM-063..067): the Insertion orders tab of the list and the
// campaign tab. The campaign tab has New Insertion Order; the advertiser tab does not (AC-07-01). Toolbar: date range,
// Performance, Segment by, download, fullscreen and the ⋮ SDF menu; chip filter bar; column groups Settings, Goal,
// Delivery, Interactions, Conversions and Custom Bidding. Inline Activate / Pause and inline Budget edit.
import { useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import {
  DvFilterBar,
  DvGrid,
  DvInlineEdit,
  DvPageHeader,
  DvTooltip,
  formatCurrency,
  type DvColumn,
  type EntityStatus,
  type FilterField,
} from '@/components/dv';
import { DvDatePresetRange } from '@/components/dv/DvDatePresetRange';
import { DvIcon } from '@/components/icons';
import { BulkActionBar } from '@/components/bulk/BulkActionBar';
import { SdfMenu } from '@/components/bulk/SdfDialogs';
import { ListSubTabs, useDateParam } from '@/components/campaigns/ListChrome';
import { useViewer } from '@/components/shell/ViewerProvider';
import { toCsv } from '@/lib/campaigns/csv';
import {
  STATUS_OPTIONS,
  filterByChips,
  initialChips,
  type ChipValue,
} from '@/lib/campaigns/list-filter';
import { patchIoBudgetAction, setIoStatusAction } from '@/lib/insertion-orders/actions';
import { IO_TYPE_LABEL, type IoRow } from '@/lib/insertion-orders/wire';
import { AppLink } from '@/lib/routes/AppLink';
import { campaignPath, ioPath } from '@/lib/routes/paths';

const DOT: Record<IoRow['status'], EntityStatus> = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  ARCHIVED: 'archived',
};

const FIELDS: FilterField[] = [
  { id: 'status', label: 'Status', type: 'multi', options: STATUS_OPTIONS },
  {
    id: 'type',
    label: 'Type',
    type: 'multi',
    options: Object.entries(IO_TYPE_LABEL).map(([value, label]) => ({ value, label })),
  },
];

type Segment = 'none' | 'status' | 'type';
const SEGMENTS: { id: Segment; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'status', label: 'Status' },
  { id: 'type', label: 'Type' },
];
const STATUS_LABEL: Record<IoRow['status'], string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  ARCHIVED: 'Archived',
};

const num = (n: number) => n.toLocaleString('en-US');

export function IoList({
  partnerId,
  advertiserId,
  campaignId,
  currency,
  rows,
  title = 'Insertion orders',
  embedded = false,
  initialStatus,
  filterChips,
  d,
  today,
}: {
  partnerId: string;
  advertiserId: string;
  /** Present on the campaign tab: shows New insertion order. */
  campaignId?: string;
  currency: string;
  rows: IoRow[];
  title?: string;
  embedded?: boolean;
  /** `f.status` of the URL (Search links): the Status chip starts there. */
  initialStatus?: string | null;
  /** Chips of the other `f.*` filters (lib/search/list-filters.ts). */
  filterChips?: ReactNode;
  /** `d` param the rows were measured for. */
  d: string;
  /** Sim date (YYYY-MM-DD) in the advertiser time zone: "Today" of the date range dropdown. */
  today: string;
}) {
  const { viewer } = useViewer();
  const router = useRouter();
  const setDate = useDateParam();
  const [chips, setChips] = useState<ChipValue[]>(() => initialChips(initialStatus));
  const [text, setText] = useState('');
  const [segment, setSegment] = useState<Segment>('none');
  const [perfAnchor, setPerfAnchor] = useState<HTMLElement | null>(null);
  const [segAnchor, setSegAnchor] = useState<HTMLElement | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [page, setPage] = useState({ page: 1, size: 20 });
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const tableRef = useRef<HTMLDivElement>(null);

  const shown = useMemo(
    () =>
      filterByChips(rows, chips, text, (r, c) => {
        const types = c.find((x) => x.fieldId === 'type')?.values ?? [];
        return types.length === 0 || types.includes(r.type);
      }),
    [rows, chips, text],
  );
  const start = (page.page - 1) * page.size;
  const pageRows = shown.slice(start, start + page.size);
  const sections = useMemo(() => {
    if (segment === 'none') return undefined;
    const keyOf = (r: IoRow) =>
      segment === 'status' ? STATUS_LABEL[r.status] : IO_TYPE_LABEL[r.type];
    const by = new Map<string, string[]>();
    for (const r of pageRows) by.set(keyOf(r), [...(by.get(keyOf(r)) ?? []), r.publicId]);
    return [...by.entries()].map(([label, rowIds]) => ({ id: label, label, rowIds }));
  }, [segment, pageRows]);

  const columns: DvColumn<IoRow>[] = [
    {
      id: 'name',
      header: 'Insertion order',
      group: 'settings',
      sticky: true,
      width: 240,
      cell: (r) => (
        <AppLink
          href={ioPath(partnerId, advertiserId, r.campaignPublicId, r.publicId, 'explorerlis')}
        >
          {r.name}
        </AppLink>
      ),
    },
    { id: 'id', header: 'Id', group: 'settings', accessor: (r) => r.publicId },
    { id: 'type', header: 'Type', group: 'settings', accessor: (r) => IO_TYPE_LABEL[r.type] },
    {
      id: 'budget',
      header: 'Budget',
      group: 'settings',
      align: 'right',
      cell: (r) => {
        const shownBudget =
          r.budget === null
            ? 'Unknown'
            : r.budgetUnit === 'CURRENCY'
              ? formatCurrency(r.budget, currency)
              : r.budget.toLocaleString('en-US');
        if (!r.editableSegment || viewer.readOnly) return shownBudget;
        return (
          <DvInlineEdit
            label={`Budget of ${r.name}`}
            value={String(r.editableSegment.amount)}
            display={shownBudget}
            validate={validateBudget}
            onCommit={(v) => saveBudget(r, v)}
          />
        );
      },
    },
    { id: 'goal', header: 'Goal', group: 'goal', accessor: (r) => r.goal },
    {
      id: 'impressions',
      header: 'Impr.',
      group: 'delivery',
      type: 'number',
      align: 'right',
      accessor: (r) => r.impressions,
    },
    {
      id: 'revenue',
      header: 'Revenue',
      group: 'delivery',
      type: 'currency',
      align: 'right',
      currencySymbol: currency,
      accessor: (r) => r.revenue,
    },
    {
      id: 'interactions',
      header: 'Interactions',
      group: 'interactions',
      type: 'number',
      align: 'right',
      accessor: (r) => r.interactions,
    },
    {
      id: 'conversions',
      header: 'Conv.',
      group: 'conversions',
      type: 'number',
      align: 'right',
      accessor: (r) => r.conversions,
    },
    {
      id: 'cpa',
      header: 'CPA',
      group: 'conversions',
      align: 'right',
      cell: (r) => (r.cpa === null ? '-' : formatCurrency(r.cpa, currency)),
    },
    {
      id: 'customImpressionValueCost',
      header: 'Custom Impr. value / cost',
      group: 'customBidding',
      align: 'right',
      width: 180,
      cell: (r) =>
        r.customImpressionValueCost === null ? '-' : num(r.customImpressionValueCost),
    },
  ];

  /** IO-021 and IO-022 on the typed value; IO-023 to IO-026 come back from the service. */
  const validateBudget = (raw: string) => {
    if (raw.trim() === '') return 'Enter a value';
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return 'Enter a number greater than 0';
    return undefined;
  };
  const saveBudget = (r: IoRow, raw: string) =>
    startTransition(async () => {
      const res = await patchIoBudgetAction(r.id, r.editableSegment!.id, Number(raw));
      if (!res.ok) setError(res.issues[0]?.message ?? 'Could not save the budget.');
      else {
        setError(null);
        router.refresh();
      }
    });

  const download = () => {
    const csv = toCsv(
      columns.map((c) => c.header),
      shown.map((r) => [
        r.name,
        r.publicId,
        IO_TYPE_LABEL[r.type],
        r.budget,
        r.goal,
        r.impressions,
        r.revenue,
        r.interactions,
        r.conversions,
        r.cpa,
        r.customImpressionValueCost,
      ]),
    );
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'insertion-orders.csv';
    a.click();
    URL.revokeObjectURL(url);
  };
  const fullscreen = () => {
    const el = tableRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };

  const tools = (
    <>
      {campaignId ? (
        <Button
          variant="contained"
          disabled={viewer.readOnly}
          href={campaignPath(partnerId, advertiserId, campaignId, 'ios', 'new')}
        >
          New Insertion Order
        </Button>
      ) : null}
      <DvDatePresetRange d={d} today={today} onChange={(next) => setDate(next)} />
      {embedded ? (
        <>
          <Button
            variant="text"
            aria-haspopup="menu"
            endIcon={<DvIcon name="arrow_drop_down" size={20} />}
            onClick={(e) => setPerfAnchor(e.currentTarget)}
          >
            Performance
          </Button>
          <Menu anchorEl={perfAnchor} open={!!perfAnchor} onClose={() => setPerfAnchor(null)}>
            <MenuItem selected onClick={() => setPerfAnchor(null)}>
              Performance
            </MenuItem>
          </Menu>
          <Button
            variant="text"
            aria-haspopup="menu"
            endIcon={<DvIcon name="arrow_drop_down" size={20} />}
            onClick={(e) => setSegAnchor(e.currentTarget)}
          >
            Segment by
          </Button>
          <Menu anchorEl={segAnchor} open={!!segAnchor} onClose={() => setSegAnchor(null)}>
            {SEGMENTS.map((x) => (
              <MenuItem
                key={x.id}
                selected={segment === x.id}
                onClick={() => {
                  setSegment(x.id);
                  setSegAnchor(null);
                }}
              >
                {x.label}
              </MenuItem>
            ))}
          </Menu>
        </>
      ) : null}
      <Box sx={{ flex: 1 }} />
      {!embedded ? (
        <DvTooltip title={showFilters ? 'Hide filters' : 'Show filters'}>
          <IconButton
            aria-label={showFilters ? 'Hide filters' : 'Show filters'}
            aria-pressed={showFilters}
            onClick={() => setShowFilters((v) => !v)}
          >
            <DvIcon name="filter_alt" size={20} />
          </IconButton>
        </DvTooltip>
      ) : null}
      {embedded ? (
        <>
          <DvTooltip title="Download">
            <IconButton aria-label="Download table" onClick={download}>
              <DvIcon name="download" size={20} />
            </IconButton>
          </DvTooltip>
          <DvTooltip title="Fullscreen">
            <IconButton aria-label="Fullscreen" onClick={fullscreen}>
              <DvIcon name="fullscreen" size={20} />
            </IconButton>
          </DvTooltip>
        </>
      ) : null}
      <SdfMenu advertiserId={advertiserId} kebab />
    </>
  );

  return (
    <Box ref={tableRef} sx={{ bgcolor: 'background.default' }}>
      {embedded ? null : (
        <DvPageHeader title={title} limitedAccess={viewer.limitedAccess}>
          <ListSubTabs partnerId={partnerId} advertiserId={advertiserId} active="ios" />
        </DvPageHeader>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        {tools}
      </Box>
      {showFilters ? (
        <Box sx={{ mb: 2 }}>
          <DvFilterBar
            ariaLabel="Insertion order filters"
            fieldMenu
            fields={FIELDS}
            value={chips}
            text={text}
            onChange={(v, t) => {
              setChips(v);
              setText(t);
              setPage((p) => ({ page: 1, size: p.size }));
            }}
          />
        </Box>
      ) : null}
      {filterChips}
      {error ? (
        <Typography role="alert" color="error">
          {error}
        </Typography>
      ) : null}
      <BulkActionBar
        entity="insertionOrder"
        selection={selection}
        rows={rows.map((r) => ({ id: r.publicId, status: r.status }))}
        advertiserId={advertiserId}
        onClear={() => setSelection(new Set())}
        bulkStatusHref="/bulk-status"
      />
      <DvGrid
        ariaLabel="Insertion orders"
        rows={pageRows}
        columns={columns}
        groups={[
          { id: 'settings', label: 'Settings' },
          { id: 'goal', label: 'Goal' },
          { id: 'delivery', label: 'Delivery' },
          { id: 'interactions', label: 'Interactions' },
          { id: 'conversions', label: 'Conversions' },
          { id: 'customBidding', label: 'Custom Bidding' },
        ]}
        {...(sections ? { sections } : {})}
        getRowId={(r) => r.publicId}
        selection={selection}
        onSelectionChange={setSelection}
        page={page.page}
        pageSize={page.size}
        total={shown.length}
        onPageChange={(p, size) => setPage({ page: p, size })}
        getStatus={(r) => DOT[r.status]}
        isArchived={(r) => r.status === 'ARCHIVED'}
        onStatusChange={
          viewer.readOnly
            ? undefined
            : (r, next) =>
                startTransition(async () => {
                  const res = await setIoStatusAction(
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
        emptyState={<Typography sx={{ p: 4 }}>No insertion orders</Typography>}
      />
    </Box>
  );
}
