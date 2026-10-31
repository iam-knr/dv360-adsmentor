'use client';

// Marketplace, Discover (module 13 S7): keyword search and canned "AI" search (RC-054, phrases map to filters shown
// as chips), Filter By panel, results grid, and the item slide-over (`?sim_panel=item:{id}`) with Scale and Google
// audiences tabs and Assign.
import { useCallback, useEffect, useState, useTransition } from 'react';
import { formatMoney } from '@/lib/money';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import {
  DvBanner,
  DvCheckboxGroup,
  DvDonut,
  DvEmptyState,
  DvGrid,
  DvSectionCard,
  DvSlideOver,
  DvStatusChip,
  DvTextField,
  type DvColumn,
} from '@/components/dv';
import { useViewer } from '@/components/shell/ViewerProvider';
import { discoverAction, marketplaceItemAction } from '@/lib/inventory/actions';
import { FORMAT_LABEL } from '@/lib/inventory/format-compat';
import type { Scope } from '@/lib/inventory/paths';
import type { DiscoverResult, DiscoverRow, MarketplaceItem } from '@/lib/inventory/types';
import { MarketplaceAssignDialog } from './MarketplaceAssignDialog';
import { MarketplaceHeader } from './MarketplaceTabs';
import { useParam } from './useParam';

const compact = (n: number) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(n);
const money = (n: number, code: string) => formatMoney(n, code);

const FILTER_LABEL: Record<string, string> = {
  inventoryType: 'Inventory type',
  deviceType: 'Device type',
  format: 'Format',
  country: 'Country',
  category: 'Categories',
  genre: 'Genre',
  exchange: 'Exchange',
};

function Donut({ title, data }: { title: string; data: Record<string, number> }) {
  return (
    <Box>
      <Typography variant="subtitle2">{title}</Typography>
      <DvDonut
        label={`${title} split`}
        slices={Object.entries(data).map(([name, value]) => ({ name, value }))}
      />
    </Box>
  );
}

function ItemPanel({
  advertiserId,
  id,
  canAssign,
  onClose,
}: {
  advertiserId: string;
  id: string;
  canAssign: boolean;
  onClose: () => void;
}) {
  const [item, setItem] = useState<MarketplaceItem | null>(null);
  const [tab, setTab] = useState('scale');
  const [assign, setAssign] = useState(false);
  useEffect(() => {
    void marketplaceItemAction(advertiserId, id).then(setItem);
  }, [advertiserId, id]);
  if (!item) return null;
  const date = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('en-GB', { timeZone: 'UTC' }) : '-';
  return (
    <>
      <DvSlideOver
        open
        title={item.name}
        width="wide"
        tabs={[
          { id: 'scale', label: 'Scale' },
          { id: 'audiences', label: 'Google audiences' },
        ]}
        activeTab={tab}
        onTabChange={setTab}
        onCancel={onClose}
        applyLabel="Close"
        onApply={onClose}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }} data-testid="item-panel">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <DvStatusChip kind="new" label={item.typeLabel} />
            <Box sx={{ flex: 1 }} />
            {canAssign ? (
              <Button variant="contained" onClick={() => setAssign(true)}>
                Assign
              </Button>
            ) : null}
          </Box>
          <Box
            component="dl"
            sx={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 1, m: 0 }}
          >
            {(
              [
                ['Type', item.typeLabel],
                ['Exchange', item.exchangeName],
                ['ID', item.id.slice(-10)],
                ['Floor Price', money(item.floorPrice, item.currencyCode)],
                ['Start date', date(item.startAt)],
                ['End date', date(item.endAt)],
              ] as const
            ).map(([k, v]) => (
              <Box key={k} sx={{ display: 'contents' }}>
                <Typography component="dt" variant="body2" color="text.secondary">
                  {k}
                </Typography>
                <Typography component="dd" variant="body2" sx={{ m: 0 }}>
                  {v}
                </Typography>
              </Box>
            ))}
          </Box>
          <Typography variant="body2">
            Available capabilities:{' '}
            {item.capabilities.length ? item.capabilities.join(', ') : 'None'}
          </Typography>
          {tab === 'scale' ? (
            <Box>
              <Typography variant="caption" color="text.secondary">
                7-day impressions
              </Typography>
              <Typography variant="h4" data-testid="item-impressions">
                {compact(item.scale.sevenDayImpressions)}
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, mt: 2 }}>
                <Donut title="Gender" data={item.scale.gender} />
                <Donut title="User geo" data={item.scale.geo} />
                <Donut title="Device" data={item.scale.device} />
                <Donut title="Format" data={item.scale.formatMix} />
              </Box>
              <Typography variant="caption" color="text.secondary">
                Data provided by DV360
              </Typography>
            </Box>
          ) : (
            <Box component="ul" aria-label="Google audiences" sx={{ m: 0, pl: 3 }}>
              {item.audiences.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </Box>
          )}
          <Box>
            <Typography variant="subtitle2">About {item.name}</Typography>
            <Typography variant="body2">{item.about}</Typography>
          </Box>
        </Box>
      </DvSlideOver>
      {assign ? (
        <MarketplaceAssignDialog
          advertiserId={advertiserId}
          productIds={[item.id]}
          title={`Assign ${item.name}`}
          onClose={() => setAssign(false)}
        />
      ) : null}
    </>
  );
}

export function DiscoverPage({
  scope,
  initial,
  canWrite,
}: {
  scope: Scope;
  initial: DiscoverResult;
  canWrite: boolean;
}) {
  const { viewer } = useViewer();
  const writable = canWrite && !viewer.readOnly;
  const [panel, setPanel] = useParam('sim_panel');
  const [result, setResult] = useState(initial);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'AI' | 'KEYWORD'>('KEYWORD');
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, start] = useTransition();
  const itemId = panel?.startsWith('item:') ? panel.slice('item:'.length) : null;

  const run = useCallback(
    (q: string, m: 'AI' | 'KEYWORD', f: Record<string, string[]>, p = 1, size = pageSize) => {
      start(async () => {
        const res = await discoverAction(scope.advertiserId, {
          mode: m,
          query: q,
          filters: f,
          page: p,
          pageSize: size,
        });
        if (res) {
          setResult(res);
          setPage(p);
          setSelection(new Set());
        }
      });
    },
    [scope.advertiserId, pageSize],
  );

  const columns: DvColumn<DiscoverRow>[] = [
    {
      id: 'name',
      header: 'Name',
      type: 'custom',
      sticky: true,
      width: 280,
      cell: (r) => (
        <Button
          variant="text"
          sx={{ textTransform: 'none', p: 0, textAlign: 'left' }}
          onClick={() => setPanel(`item:${r.id}`)}
          data-testid="discover-name"
        >
          {r.name}
        </Button>
      ),
    },
    { id: 'type', header: 'Type', cell: (r) => <Chip size="small" label={r.typeLabel} /> },
    {
      id: 'exchange',
      header: 'Exchange',
      accessor: (r) => `${r.exchangeName} (${r.exchangeSharePct}%)`,
    },
    { id: 'format', header: 'Format', accessor: (r) => FORMAT_LABEL[r.format] },
    {
      id: 'impr',
      header: '7-day impressions',
      align: 'right',
      accessor: (r) => compact(r.sevenDayImpressions),
    },
    { id: 'aud', header: 'Google audiences', accessor: (r) => `${r.googleAudiences} available` },
    { id: 'cat', header: 'Categories', accessor: (r) => `${r.categories.length} available` },
  ];

  return (
    <>
      <MarketplaceHeader scope={scope} active="discover">
        {writable && selection.size > 0 ? (
          <Button variant="contained" onClick={() => setBulk(true)}>
            Bulk assign ({selection.size})
          </Button>
        ) : null}
      </MarketplaceHeader>
      <Box sx={{ px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
          <Box sx={{ flex: 1 }}>
            <DvTextField
              label="Describe inventory or use keywords"
              ariaLabel="Search inventory"
              value={query}
              onChange={setQuery}
            />
          </Box>
          <Button
            variant="contained"
            onClick={() => {
              setMode('AI');
              run(query, 'AI', filters);
            }}
          >
            Discover inventory
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              setMode('KEYWORD');
              run(query, 'KEYWORD', filters);
            }}
          >
            Keyword search
          </Button>
        </Box>
        <Typography variant="caption" color="text.secondary">
          Search for inventory by audience, content, media type, device and geo-targeting. Discover
          inventory is a canned helper in this simulator and is still learning.
        </Typography>
        {result.chips.length ? (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }} aria-label="Interpreted filters">
            {result.chips.map((c) => (
              <Chip key={c} label={c} size="small" />
            ))}
          </Box>
        ) : null}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '240px 1fr' }, gap: 3 }}>
          <Box component="aside" aria-label="Filter By">
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Filter By
            </Typography>
            {Object.entries(FILTER_LABEL).map(([key, label]) => {
              const options = result.facets[key] ?? [];
              if (!options.length) return null;
              return (
                <DvSectionCard
                  key={key}
                  title={label}
                  collapsible
                  defaultOpen={key === 'format' || key === 'inventoryType'}
                >
                  <DvCheckboxGroup
                    values={filters[key] ?? []}
                    options={options}
                    onChange={(values) => {
                      const next = { ...filters, [key]: values };
                      setFilters(next);
                      run(query, mode, next);
                    }}
                  />
                </DvSectionCard>
              );
            })}
          </Box>
          <DvGrid<DiscoverRow>
            ariaLabel="Discover results"
            rows={result.rows}
            columns={columns}
            getRowId={(r) => r.id}
            selection={writable ? selection : undefined}
            onSelectionChange={writable ? setSelection : undefined}
            page={page}
            pageSize={pageSize}
            total={result.total}
            loading={loading}
            onPageChange={(p, s) => {
              setPageSize(s);
              run(query, mode, filters, p, s);
            }}
            emptyState={
              <DvEmptyState
                variant="illustrated"
                title="No inventory matches your search"
                message="Try fewer keywords or clear a filter."
              />
            }
          />
        </Box>
        {scope.campaignId ? (
          <DvBanner kind="info" level="inline">
            Assignments go to line items; pick any line item of this advertiser.
          </DvBanner>
        ) : null}
      </Box>
      {itemId ? (
        <ItemPanel
          key={itemId}
          advertiserId={scope.advertiserId}
          id={itemId}
          canAssign={writable}
          onClose={() => setPanel(null)}
        />
      ) : null}
      {bulk ? (
        <MarketplaceAssignDialog
          advertiserId={scope.advertiserId}
          productIds={[...selection]}
          title={`Bulk assign (${selection.size})`}
          onClose={() => setBulk(false)}
        />
      ) : null}
    </>
  );
}
