'use client';

// Campaigns list (module 06 2.1, fidelity audit CAM-003..012, 036, 037, 052, 054, 056): sub-tabs, toolbar with New
// campaign and the date range dropdown, filter bar with chips, fixed column set (Name with the ID beside it, then
// Delivery: Budget, Spent, KPI Goal, KPI Actual, KPI Actual TrueView). Numbers arrive in the rows
// (getGridMetrics on the server, for the range in `d`); "-" when there is no data.
import { useMemo, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import {
  DvFilterBar,
  DvGrid,
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
import { useViewer } from '@/components/shell/ViewerProvider';
import { setCampaignStatusAction } from '@/lib/campaigns/actions';
import {
  BUDGET_OPTIONS,
  STATUS_OPTIONS,
  filterCampaignRows,
  initialChips,
  type ChipValue,
} from '@/lib/campaigns/list-filter';
import type { CampaignRow, EntityStatusKey } from '@/lib/campaigns/wire';
import { AppLink } from '@/lib/routes/AppLink';
import { advertiserPath, campaignPath } from '@/lib/routes/paths';
import { CAMPAIGN_GOALS, CAMPAIGN_GOAL_LABEL } from '@/lib/validation/constants/goals-kpis';
import { ListSubTabs, useDateParam } from './ListChrome';

const DOT: Record<EntityStatusKey, EntityStatus> = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  ARCHIVED: 'archived',
};

const FIELDS: FilterField[] = [
  { id: 'status', label: 'Status', type: 'multi', options: STATUS_OPTIONS },
  {
    id: 'goal',
    label: 'Goal',
    type: 'multi',
    options: CAMPAIGN_GOALS.map((g) => ({ value: g, label: CAMPAIGN_GOAL_LABEL[g] })),
  },
  { id: 'budget', label: 'Budget', type: 'multi', options: BUDGET_OPTIONS },
];

export function CampaignsList({
  partnerId,
  advertiserId,
  currency,
  rows,
  initialStatus,
  d,
  today,
  filterChips,
}: {
  partnerId: string;
  advertiserId: string;
  currency: string;
  rows: CampaignRow[];
  /** `f.status` of the URL (Search links): the Status chip starts there. */
  initialStatus?: string | null;
  /** `d` param the rows were measured for. */
  d: string;
  /** Sim date (YYYY-MM-DD) in the advertiser time zone: "Today" of the date range dropdown. */
  today: string;
  /** Chips of the other `f.*` filters (lib/search/list-filters.ts). */
  filterChips?: ReactNode;
}) {
  const { viewer } = useViewer();
  const router = useRouter();
  const setDate = useDateParam();
  const [chips, setChips] = useState<ChipValue[]>(() => initialChips(initialStatus));
  const [text, setText] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [page, setPage] = useState({ page: 1, size: 20 });
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());

  const shown = useMemo(() => filterCampaignRows(rows, chips, text), [rows, chips, text]);
  const start = (page.page - 1) * page.size;

  const columns: DvColumn<CampaignRow>[] = [
    {
      id: 'name',
      header: 'Name',
      group: 'campaign',
      sticky: true,
      width: 280,
      cell: (r) => (
        <>
          <AppLink href={campaignPath(partnerId, advertiserId, r.publicId)}>{r.name}</AppLink>
          <Box
            component="span"
            data-testid="campaign-id"
            sx={{ ml: 1, color: 'text.secondary', fontSize: 12 }}
          >
            {r.publicId}
          </Box>
        </>
      ),
    },
    {
      id: 'budget',
      header: 'Budget',
      group: 'delivery',
      align: 'right',
      cell: (r) => (r.budget === null ? 'Unknown' : formatCurrency(r.budget, currency)),
    },
    {
      id: 'spent',
      header: 'Spent',
      group: 'delivery',
      align: 'right',
      cell: (r) => (r.spent === 0 ? '-' : formatCurrency(r.spent, currency)),
    },
    {
      id: 'kpiGoal',
      header: 'KPI Goal',
      group: 'delivery',
      align: 'right',
      accessor: (r) => r.kpiGoal,
    },
    {
      id: 'kpiActual',
      header: 'KPI Actual',
      group: 'delivery',
      align: 'right',
      accessor: (r) => r.kpiActual,
    },
    {
      id: 'kpiActualTrueView',
      header: 'KPI Actual TrueView',
      group: 'delivery',
      align: 'right',
      width: 160,
      accessor: (r) => r.kpiActualTrueView,
    },
  ];

  return (
    <>
      <DvPageHeader title="Campaigns" limitedAccess={viewer.limitedAccess}>
        <ListSubTabs partnerId={partnerId} advertiserId={advertiserId} active="campaigns" />
      </DvPageHeader>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          disabled={viewer.readOnly}
          href={advertiserPath(partnerId, advertiserId, 'cs', 'new')}
        >
          New campaign
        </Button>
        <DvDatePresetRange d={d} today={today} onChange={(next) => setDate(next)} />
        <Box sx={{ flex: 1 }} />
        <DvTooltip title={showFilters ? 'Hide filters' : 'Show filters'}>
          <IconButton
            aria-label={showFilters ? 'Hide filters' : 'Show filters'}
            aria-pressed={showFilters}
            onClick={() => setShowFilters((v) => !v)}
          >
            <DvIcon name="filter_alt" size={20} />
          </IconButton>
        </DvTooltip>
        <SdfMenu advertiserId={advertiserId} kebab />
      </Box>
      {showFilters ? (
        <Box sx={{ mb: 2 }}>
          <DvFilterBar
            ariaLabel="Campaign filters"
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
        entity="campaign"
        selection={selection}
        rows={rows.map((r) => ({ id: r.publicId, status: r.status }))}
        advertiserId={advertiserId}
        onClear={() => setSelection(new Set())}
        bulkStatusHref="/bulk-status"
      />
      <DvGrid
        ariaLabel="Campaigns"
        rows={shown.slice(start, start + page.size)}
        columns={columns}
        groups={[
          { id: 'campaign', label: 'Campaign' },
          { id: 'delivery', label: 'Delivery' },
        ]}
        getRowId={(r) => r.publicId}
        selection={selection}
        onSelectionChange={setSelection}
        page={page.page}
        pageSize={page.size}
        total={shown.length}
        onPageChange={(p, size) => setPage({ page: p, size })}
        getStatus={(r) => DOT[r.status]}
        isArchived={(r) => r.status === 'ARCHIVED'}
        getAlert={(r) => r.alertSeverity}
        onStatusChange={
          viewer.readOnly
            ? undefined
            : (r, next) =>
                startTransition(async () => {
                  const res = await setCampaignStatusAction(
                    r.publicId,
                    next === 'active' ? 'ACTIVE' : 'PAUSED',
                  );
                  if (!res.ok) setError(res.issues[0]?.message ?? 'Could not change the status.');
                  else {
                    setError(null);
                    router.refresh();
                  }
                })
        }
        emptyState={<Typography sx={{ p: 4 }}>No campaigns</Typography>}
      />
    </>
  );
}
