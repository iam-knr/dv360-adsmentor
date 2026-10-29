'use client';

// My inventory, Orders and deals (module 13 S1): Action required / Everything else sections, order → deal hierarchy,
// header groups, status chip filter, status menu, bulk status and expand / collapse all.
import { useCallback, useMemo, useRef, useState, useTransition } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import {
  DvBanner,
  DvBulkBar,
  DvEmptyState,
  DvFilterBar,
  DvGrid,
  DvTooltip,
  useToast,
  type DvColumn,
  type DvStatus,
  type FilterField,
  type FilterValue,
} from '@/components/dv';
import { DvIcon } from '@/components/icons';
import { useViewer } from '@/components/shell/ViewerProvider';
import { bulkDealStatusAction, listOrdersDealsAction, updateDealAction } from '@/lib/inventory/actions';
import { dealPath, instantDealPath, type Scope } from '@/lib/inventory/paths';
import { DEAL_STATUS_LABEL, DEFAULT_DEAL_STATUSES, type DealAction, type DealStatusKey } from '@/lib/inventory/transitions';
import type { DealRow, OrderRow, OrdersDeals } from '@/lib/inventory/types';
import { AppLink } from '@/lib/routes/AppLink';
import { InventoryHeader } from './InventoryHeader';

type GridRow = OrderRow | DealRow;

const STATUS_OPTIONS = (['ACTIVE', 'ARCHIVED', 'PAUSED', 'DRAFT', 'COMPLETED', 'NOT_SERVABLE'] as DealStatusKey[]).map((v) => ({
  value: v,
  label: DEAL_STATUS_LABEL[v],
}));

export const FILTER_FIELDS: FilterField[] = [
  { id: 'status', label: 'Status', type: 'multi', options: STATUS_OPTIONS },
  {
    id: 'commitment',
    label: 'Commitment',
    type: 'single',
    options: [
      { value: 'GUARANTEED', label: 'Guaranteed' },
      { value: 'NON_GUARANTEED', label: 'Non-guaranteed' },
    ],
  },
  {
    id: 'format',
    label: 'Format',
    type: 'single',
    options: [
      { value: 'DISPLAY', label: 'Display' },
      { value: 'VIDEO', label: 'Video' },
      { value: 'AUDIO', label: 'Audio' },
    ],
  },
];

export const DEFAULT_FILTERS: FilterValue[] = [{ fieldId: 'status', values: [...DEFAULT_DEAL_STATUSES] }];

const GROUPS = [
  { id: 'source', label: 'Inventory source', collapsible: true },
  { id: 'details', label: 'Details', collapsible: true },
  { id: 'rate', label: 'Rate & Vol.', collapsible: true },
  { id: 'delivery', label: 'Delivery', collapsible: true },
  { id: 'creative', label: 'Creative reqs.', collapsible: true },
  { id: 'dates', label: 'Dates', collapsible: true },
];

const GRID_STATUS: Record<DealStatusKey, DvStatus> = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  DRAFT: 'draft',
  ARCHIVED: 'archived',
  COMPLETED: 'completed',
  NOT_SERVABLE: 'notServable',
};

const date = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { timeZone: 'UTC' });

function toQuery(filters: FilterValue[], text: string, campaignId?: string) {
  const one = (id: string) => filters.find((f) => f.fieldId === id)?.values[0];
  const status = filters.find((f) => f.fieldId === 'status')?.values;
  const commitment = one('commitment');
  const format = one('format');
  return {
    status: (status?.length ? status : ['ACTIVE', 'ARCHIVED', 'PAUSED', 'DRAFT', 'COMPLETED', 'NOT_SERVABLE']) as DealStatusKey[],
    ...(commitment ? { commitment: [commitment as 'GUARANTEED'] } : {}),
    ...(format ? { format: [format as 'VIDEO'] } : {}),
    ...(text.trim() ? { q: text.trim() } : {}),
    ...(campaignId ? { campaignId } : {}),
  };
}

export function OrdersDealsGrid({ scope, initial }: { scope: Scope; initial: OrdersDeals }) {
  const { viewer } = useViewer();
  const toast = useToast();
  const [data, setData] = useState(initial);
  const [filters, setFilters] = useState<FilterValue[]>(DEFAULT_FILTERS);
  const [text, setText] = useState('');
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [gridKey, setGridKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  const writable = data.canWrite && !viewer.readOnly;

  const reload = useCallback(
    (f: FilterValue[], t: string) => {
      startLoad(async () => {
        const res = await listOrdersDealsAction(scope.advertiserId, toQuery(f, t, scope.campaignId));
        if (!res) return setError("Couldn't load orders and deals");
        setError(null);
        setData(res);
        setSelection(new Set());
        setPage(1);
      });
    },
    [scope.advertiserId, scope.campaignId],
  );

  const rows: GridRow[] = useMemo(() => [...data.actionRequired, ...data.rest], [data]);
  const start = (page - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);
  const pageIds = new Set(pageRows.map((r) => r.id));
  const sections = [
    { id: 'action', label: 'Action required', rowIds: data.actionRequired.filter((r) => pageIds.has(r.id)).map((r) => r.id) },
    { id: 'rest', label: 'Everything else', rowIds: data.rest.filter((r) => pageIds.has(r.id)).map((r) => r.id) },
  ];
  const dealsById = useMemo(() => {
    const m = new Map<string, DealRow>();
    for (const r of rows) {
      if (r.kind === 'DEAL') m.set(r.id, r);
      else for (const c of r.children) m.set(c.id, c);
    }
    return m;
  }, [rows]);

  const changeStatus = async (row: DealRow, next: 'active' | 'paused') => {
    const res = await updateDealAction(scope.advertiserId, row.id, { status: next === 'active' ? 'ACTIVE' : 'PAUSED' });
    if (!res.ok) return toast.show({ kind: 'error', message: res.issues[0]?.message ?? "Couldn't change the status." });
    toast.show({ message: `${row.name} is now ${next === 'active' ? 'active' : 'paused'}` });
    reload(filters, text);
  };

  const bulk = async (id: string) => {
    const ids = [...selection].filter((s) => dealsById.has(s));
    if (!ids.length) return;
    const action = id.toUpperCase() as DealAction;
    const res = await bulkDealStatusAction(scope.advertiserId, { ids, action });
    if (!res.ok) return toast.show({ kind: 'error', message: res.issues[0]?.message ?? "Couldn't change the status." });
    const { done, failed, errors } = res.data;
    toast.show({
      kind: failed ? 'warning' : 'neutral',
      message: failed ? `Status edited on ${done} deals. ${failed} failed: ${errors[0]?.message ?? ''}` : `Status edited on ${done} ${done === 1 ? 'deal' : 'deals'}`,
    });
    reload(filters, text);
  };

  const toggleAll = (expand: boolean) => {
    if (!expand) return setGridKey((k) => k + 1);
    box.current?.querySelectorAll<HTMLButtonElement>('button[aria-label="Expand row"]').forEach((b) => b.click());
  };

  const columns: DvColumn<GridRow>[] = [
    {
      id: 'name',
      header: 'Name',
      type: 'link',
      sticky: true,
      width: 280,
      cell: (r) =>
        r.kind === 'ORDER' ? (
          <span data-testid="order-name">{r.name}</span>
        ) : (
          <DvTooltip title={r.actionReason ?? ''}>
            <span>
              <AppLink href={dealPath(scope, r.publicId)} data-testid="deal-link">
                {r.name}
              </AppLink>
              {r.notUsedInCampaign ? (
                <Box component="span" sx={{ ml: 1, color: 'text.disabled', typography: 'caption' }}>
                  Not used in this campaign
                </Box>
              ) : null}
            </span>
          </DvTooltip>
        ),
    },
    { id: 'id', header: 'ID', group: 'source', accessor: (r) => (r.kind === 'ORDER' ? r.externalCode : r.dealId) },
    { id: 'exchange', header: 'Exchange', group: 'source', accessor: (r) => r.exchangeName },
    { id: 'delivery', header: 'Delivery method', group: 'details', accessor: (r) => (r.kind === 'DEAL' ? r.deliveryMethod : '') },
    { id: 'commitment', header: 'Commitment', group: 'details', accessor: (r) => (r.kind === 'DEAL' ? r.commitmentLabel : '') },
    {
      id: 'central',
      header: 'Central partner deal',
      group: 'details',
      tooltip: 'A deal negotiated centrally by the partner and shared with advertisers.',
      accessor: (r) => (r.kind === 'DEAL' ? (r.centralPartnerDeal ? 'Yes' : 'No') : ''),
    },
    { id: 'rate', header: 'Rate (CPM)', group: 'rate', type: 'currency', currencySymbol: data.currencyCode === 'INR' ? '₹' : data.currencyCode, accessor: (r) => (r.kind === 'DEAL' ? r.rate : null) },
    { id: 'bidRatio', header: 'Bid ratio', group: 'rate', type: 'percent', accessor: (r) => (r.kind === 'DEAL' ? r.bidRatioPct : null) },
    { id: 'quantity', header: 'Quantity', group: 'rate', type: 'number', accessor: (r) => (r.kind === 'DEAL' ? r.quantity : null) },
    { id: 'impressions', header: 'Impressions', group: 'delivery', type: 'number', accessor: (r) => (r.kind === 'DEAL' ? r.impressions : null) },
    { id: 'spend', header: 'Spend', group: 'delivery', type: 'currency', currencySymbol: data.currencyCode === 'INR' ? '₹' : data.currencyCode, accessor: (r) => (r.kind === 'DEAL' ? r.spend : null) },
    { id: 'winRate', header: 'Win rate', group: 'delivery', type: 'percent', accessor: (r) => (r.kind === 'DEAL' ? r.winRate : null) },
    { id: 'sizes', header: 'Sizes', group: 'creative', accessor: (r) => (r.kind === 'DEAL' ? r.sizes.join(', ') : '') },
    { id: 'start', header: 'Start date', group: 'dates', accessor: (r) => (r.kind === 'DEAL' ? date(r.startAt) : '') },
    { id: 'end', header: 'End date', group: 'dates', accessor: (r) => (r.kind === 'DEAL' ? date(r.endAt) : '') },
  ];

  return (
    <>
      <InventoryHeader scope={scope} active="orders" canWrite={data.canWrite} />
      <Box sx={{ px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 2 }} ref={box}>
        {scope.campaignId ? (
          <DvBanner kind="info" level="inline">
            Showing inventory for this campaign. Items no line item of the campaign uses are muted.
          </DvBanner>
        ) : null}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Box sx={{ flex: 1 }}>
            <DvFilterBar
              fields={FILTER_FIELDS}
              value={filters}
              text={text}
              placeholder="Search by name or ID"
              onChange={(f, t) => {
                setFilters(f);
                setText(t);
                reload(f, t);
              }}
            />
          </Box>
          <Button aria-label="Expand all" onClick={() => toggleAll(true)} startIcon={<DvIcon name="unfold_more" size={18} />}>
            Expand all
          </Button>
          <Button aria-label="Collapse all" onClick={() => toggleAll(false)} startIcon={<DvIcon name="unfold_less" size={18} />}>
            Collapse all
          </Button>
        </Box>
        {selection.size > 0 && writable ? (
          <DvBulkBar
            count={selection.size}
            groups={[
              {
                label: 'Status',
                items: [
                  { id: 'activate', label: 'Activate' },
                  { id: 'pause', label: 'Pause' },
                  { id: 'archive', label: 'Archive' },
                  { id: 'unarchive', label: 'Unarchive' },
                ],
              },
            ]}
            onAction={bulk}
            onClear={() => setSelection(new Set())}
          />
        ) : null}
        <DvGrid<GridRow>
          key={gridKey}
          ariaLabel="Orders and deals"
          rows={pageRows}
          columns={columns}
          groups={GROUPS}
          getRowId={(r) => r.id}
          getChildren={(r) => (r.kind === 'ORDER' ? r.children : [])}
          sections={sections}
          page={page}
          pageSize={pageSize}
          total={rows.length}
          onPageChange={(p, s) => {
            setPage(p);
            setPageSize(s);
          }}
          selection={writable ? selection : undefined}
          onSelectionChange={writable ? setSelection : undefined}
          loading={loading}
          error={error}
          getAlert={(r) => (r.kind === 'DEAL' && r.actionRequired ? 'critical' : null)}
          onAlertClick={(r) => r.kind === 'DEAL' && r.actionReason && toast.show({ kind: 'warning', message: r.actionReason })}
          getStatus={(r) => (r.kind === 'DEAL' ? GRID_STATUS[r.status] : 'active')}
          onStatusChange={writable ? (r, next) => r.kind === 'DEAL' && void changeStatus(r, next) : undefined}
          isArchived={(r) => (r.kind === 'DEAL' ? r.status === 'ARCHIVED' : r.status === 'ARCHIVED')}
          emptyState={
            <DvEmptyState
              variant="illustrated"
              title="No orders or deals yet"
              message="Create an instant deal or browse the Marketplace to get inventory."
              action={
                writable
                  ? { label: 'Instant deal', primary: true, onClick: () => (window.location.href = instantDealPath(scope.partnerId, scope.advertiserId)) }
                  : undefined
              }
            />
          }
        />
      </Box>
    </>
  );
}
