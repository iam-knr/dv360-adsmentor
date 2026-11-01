'use client';

import { useState, type ReactElement } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  DvAppBar,
  DvBanner,
  DvBreadcrumbs,
  DvBulkBar,
  DvCardCarousel,
  DvChartCard,
  DvChartStrip,
  DvCheckboxGroup,
  DvCoverageBar,
  DvDateRange,
  DvDonut,
  DvEmptyState,
  DvEntityHeader,
  DvFilterBar,
  DvFormFooter,
  DvFormPage,
  DvGoalProgress,
  DvGrid,
  DvHealthList,
  DvHelp,
  DvHoverDetail,
  DvInlineEdit,
  DvKbd,
  DvKpiTile,
  DvModal,
  DvNameCell,
  DvNav,
  DvPageHeader,
  DvPanel,
  DvPickerDialog,
  DvRadioGroup,
  DvRightRail,
  DvSectionCard,
  DvShortcutsModal,
  DvSelect,
  DvSkeleton,
  DvSlideOver,
  DvSparkBars,
  DvSpinner,
  DvStatusChip,
  DvStatusDot,
  DvStatusSelect,
  DvStepper,
  DvTabs,
  DvTextField,
  DvTooltip,
  DvUnsavedChangesModal,
  useToast,
  type BulkMenuGroup,
  type DateRangeValue,
  type DvColumn,
  type EntityStatus,
  type FilterField,
  type FilterValue,
  type NavItem,
  type RailPanelId,
} from '@/components/dv';
import { DvIcon } from '@/components/icons';

/** Fixed simulator clock for the gallery so labels are stable. */
export const GALLERY_TODAY = new Date(2026, 9, 28);

/** Section wrapper used by the gallery page and by the axe tests, so landmarks and heading levels match. */
export function GalleryEntryFrame({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      component="section"
      id={id}
      aria-labelledby={`${id}-title`}
      sx={{ mb: 8, scrollMarginTop: 16 }}
    >
      <Typography id={`${id}-title`} variant="cardTitle" component="h2" sx={{ mb: 3 }}>
        {title}
      </Typography>
      <Box
        sx={{
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '8px',
          p: 6,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export interface GalleryEntry {
  id: string;
  title: string;
  Demo: () => ReactElement;
}

function Variant({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="caption" component="p" sx={{ mb: 2 }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

// ---------- Foundations ----------

function TypographyDemo() {
  const variants = [
    'pageTitle',
    'cardTitle',
    'h6',
    'subtitle1',
    'body1',
    'body2',
    'tableCell',
    'tableHeader',
    'caption',
    'panelOverline',
    'kpiValue',
    'kpiValueSmall',
    'badge',
    'mono',
  ] as const;
  return (
    <Stack gap={2}>
      {variants.map((v) => (
        <Typography key={v} variant={v} component="div">
          {v}: Campaigns and insertion orders 1,234.50
        </Typography>
      ))}
    </Stack>
  );
}

function IconsDemo() {
  const names = [
    'menu',
    'home',
    'search',
    'notifications',
    'filter_alt',
    'edit',
    'delete',
    'lock',
    'push_pin',
    'calendar_today',
    'drag_indicator',
    'cloud_off',
  ] as const;
  return (
    <Stack direction="row" gap={4} flexWrap="wrap">
      {names.map((n) => (
        <Stack key={n} alignItems="center" gap={1}>
          <DvIcon name={n} size={24} />
          <Typography variant="caption">{n}</Typography>
        </Stack>
      ))}
      <Stack alignItems="center" gap={1}>
        <DvIcon name="error" size={24} filled color="status.error" />
        <Typography variant="caption">error (filled)</Typography>
      </Stack>
    </Stack>
  );
}

// ---------- Shell ----------

const NAV_ITEMS: NavItem[] = [
  { id: 'campaigns', label: 'Campaigns', icon: 'navCampaigns' },
  {
    id: 'audiences',
    label: 'Audiences',
    icon: 'navAudiences',
    children: [
      { id: 'all-audiences', label: 'All audiences' },
      { id: 'analysis', label: 'Analysis' },
    ],
  },
  {
    id: 'resources',
    label: 'Resources',
    icon: 'navResources',
    newDot: true,
    dividerAfter: true,
    children: [
      { id: 'brand', label: 'Brand controls' },
      { id: 'floodlight', label: 'Floodlight group', newDot: true },
    ],
  },
  {
    id: 'settings',
    label: 'Advertiser settings',
    icon: 'navSettings',
    children: [{ id: 'data-manager', label: 'Data manager', secondLine: '(Linked accounts)' }],
  },
  { id: 'alerts', label: 'Alerts', icon: 'navCampaignAlerts', badge: 'NEW' },
  { id: 'history', label: 'History', icon: 'navHistory' },
];

function ShellDemo() {
  const [open, setOpen] = useState<string[]>(['audiences']);
  const [active, setActive] = useState('campaigns');
  const toggle = (id: string) =>
    setOpen((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  return (
    <Stack gap={4}>
      <Variant label="App bar, standard (unread badge on the bell)">
        <DvAppBar
          crumbs={[
            { level: 'Partner', name: 'Adsmetor Training Partner', href: '#' },
            {
              level: 'Advertiser',
              name: 'Northwind Outdoor Gear and Equipment Company International',
            },
          ]}
          unreadNotifications={2}
          onToggleNav={() => setOpen([])}
          user={{ name: 'Sample Student', initials: 'SS', role: 'student' }}
          notifications={[
            {
              id: 'n1',
              type: 'Alert',
              age: '9 d',
              title: 'Budget at risk',
              body: 'Insertion order IO-1001 is pacing slowly.',
            },
          ]}
          searchSuggestions={['paused line items', 'underpacing insertion orders']}
        />
      </Variant>
      <Variant label="App bar, back header (Reports and Users pages)">
        <DvAppBar
          crumbs={[]}
          unreadNotifications={0}
          onToggleNav={() => {}}
          user={{ name: 'Sample Instructor', initials: 'SI', role: 'instructor' }}
          mode="backHeader"
          backHeaderTitle="Reports"
          onBack={() => {}}
        />
      </Variant>
      <Variant label="Breadcrumbs, three levels">
        <DvBreadcrumbs
          ariaLabel="Breadcrumb example"
          crumbs={[
            { level: 'Partner', name: 'Adsmetor Training Partner', href: '#' },
            { level: 'Advertiser', name: 'Northwind Outdoor', href: '#' },
            { level: 'Campaign', name: 'Autumn launch' },
          ]}
        />
      </Variant>
      <Variant label="Buttons (fidelity probes: primary, secondary)">
        <Stack direction="row" gap={3} data-testid="fidelity-buttons">
          <Button variant="contained">New campaign</Button>
          <Button variant="outlined">Last 30 days</Button>
        </Stack>
      </Variant>
      <Stack direction="row" gap={6} alignItems="flex-start">
        <Variant label="Nav, expanded">
          <DvNav
            items={NAV_ITEMS}
            mode="expanded"
            activeId={active}
            openGroupIds={open}
            onToggleGroup={toggle}
            onNavigate={(i) => setActive(i.id)}
          />
        </Variant>
        <Variant label="Nav, collapsed rail">
          <DvNav
            ariaLabel="Main (rail)"
            items={NAV_ITEMS}
            mode="rail"
            activeId="all-audiences"
            openGroupIds={[]}
            onToggleGroup={toggle}
          />
        </Variant>
      </Stack>
    </Stack>
  );
}

function RailDemo() {
  const [open, setOpen] = useState<RailPanelId | null>('intelligence');
  return (
    <Stack direction="row" sx={{ border: '1px solid', borderColor: 'divider', minHeight: 360 }}>
      <Box sx={{ flex: 1, p: 4 }}>
        <Typography variant="body2">Page content</Typography>
      </Box>
      {open === 'intelligence' ? (
        <DvPanel
          title="Intelligence"
          subtitle="Northwind Outdoor"
          tone="primary"
          onClose={() => setOpen(null)}
          actions={[{ icon: 'history', label: 'Chat history', onClick: () => {} }]}
        >
          <DvHealthList
            healthTitle="Advertiser health"
            alerts={[
              {
                id: 'a1',
                severity: 'error',
                text: '3 line items have no spend in the last 24 hours.',
                onInvestigate: () => {},
                onHistory: () => {},
              },
              {
                id: 'a2',
                severity: 'warning',
                text: 'Insertion order IO-1001 is underpacing.',
                onInvestigate: () => {},
              },
            ]}
            suggestions={[
              {
                id: 's1',
                severity: 'suggestion',
                text: 'Enable automated bidding at insertion order level.',
                onInvestigate: () => {},
              },
            ]}
          />
        </DvPanel>
      ) : open ? (
        <DvPanel
          title={open === 'advisor' ? 'Ask Advisor' : open === 'help' ? 'Quick help' : 'Exercise'}
          beta={open === 'help'}
          width={open === 'advisor' ? 400 : 360}
          onClose={() => setOpen(null)}
        >
          <Typography variant="body2">Panel body</Typography>
        </DvPanel>
      ) : null}
      <DvRightRail
        available={['advisor', 'help', 'intelligence', 'exercise']}
        open={open}
        onChange={setOpen}
      />
    </Stack>
  );
}

function PanelStatesDemo() {
  return (
    <Stack direction="row" gap={4} flexWrap="wrap">
      <DvPanel title="Loading panel" state="loading" onClose={() => {}}>
        {null}
      </DvPanel>
      <DvPanel title="Failed panel" state="error" onRetry={() => {}} onClose={() => {}}>
        {null}
      </DvPanel>
      <DvPanel title="Empty health" onClose={() => {}}>
        <DvHealthList
          healthTitle="Campaign health"
          alerts={[]}
          suggestions={[]}
          onGoToAlerts={() => {}}
        />
      </DvPanel>
    </Stack>
  );
}

// ---------- Grid ----------

interface Row {
  id: string;
  name: string;
  status: EntityStatus;
  budget: number | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  spend: number | null;
  alert?: 'critical' | 'warning';
  children?: Row[];
}

const GRID_ROWS: Row[] = [
  {
    id: 'c-1001',
    name: 'Autumn launch with a rather long campaign name that wraps onto two lines',
    status: 'active',
    budget: 120000,
    impressions: 1234567,
    clicks: 9876,
    ctr: 0.8,
    spend: 54321.5,
    alert: 'critical',
  },
  {
    id: 'c-1002',
    name: 'Back to school',
    status: 'paused',
    budget: 80000,
    impressions: 456789,
    clicks: 3210,
    ctr: 0.7,
    spend: 20100,
    alert: 'warning',
  },
  {
    id: 'c-1003',
    name: 'Holiday preview',
    status: 'draft',
    budget: null,
    impressions: null,
    clicks: null,
    ctr: null,
    spend: null,
  },
  {
    id: 'c-1004',
    name: 'Winter clearance',
    status: 'archived',
    budget: 40000,
    impressions: 12000,
    clicks: 80,
    ctr: 0.67,
    spend: 900,
  },
];

const GRID_COLUMNS: DvColumn<Row>[] = [
  {
    id: 'name',
    header: 'Name',
    type: 'link',
    sticky: true,
    width: 280,
    sortable: true,
    cell: (r) => <DvNameCell name={r.name} id={r.id.toUpperCase()} href="#" />,
    total: undefined,
  },
  {
    id: 'budget',
    header: 'Budget',
    type: 'currency',
    group: 'Delivery',
    sortable: true,
    tooltip: 'Planned budget for the flight',
    total: (rows) => rows.length,
  },
  { id: 'impressions', header: 'Impressions', type: 'number', group: 'Delivery', sortable: true },
  { id: 'clicks', header: 'Clicks', type: 'number', group: 'Delivery', sortable: true },
  { id: 'ctr', header: 'CTR', type: 'percent', group: 'Delivery', sortable: true },
  { id: 'spend', header: 'Spend', type: 'currency', group: 'Cost', sortable: true },
];

function GridDemo() {
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ id: string; dir: 'asc' | 'desc' } | undefined>(undefined);
  const [page, setPage] = useState({ page: 1, size: 20 });
  const [rows, setRows] = useState(GRID_ROWS);
  return (
    <DvGrid<Row>
      ariaLabel="Campaigns"
      rows={rows}
      columns={GRID_COLUMNS}
      groups={[
        { id: 'Delivery', label: 'Delivery', collapsible: true },
        { id: 'Cost', label: 'Cost', collapsible: true },
      ]}
      getRowId={(r) => r.id}
      selection={selection}
      onSelectionChange={setSelection}
      sort={sort}
      onSortChange={setSort}
      page={page.page}
      pageSize={page.size}
      total={137}
      onPageChange={(p, size) => setPage({ page: p, size })}
      totalRow
      totalLabel="Total: Display"
      getAlert={(r) => r.alert ?? null}
      getStatus={(r) => r.status}
      onStatusChange={(row, next) =>
        setRows((cur) => cur.map((r) => (r.id === row.id ? { ...r, status: next } : r)))
      }
      isArchived={(r) => r.status === 'archived'}
      rowActions={() => (
        <>
          <DvIcon name="info" size={20} label="Details" />
          <DvIcon name="edit" size={20} label="Edit" />
        </>
      )}
    />
  );
}

function GridStatesDemo() {
  const noop = () => {};
  const base = {
    ariaLabel: 'States',
    columns: GRID_COLUMNS,
    getRowId: (r: Row) => r.id,
    pageSize: 20,
    page: 1,
    onPageChange: noop,
  };
  const tree: Row[] = [
    {
      id: 'o-1',
      name: 'Order A',
      status: 'active',
      budget: 10,
      impressions: 5,
      clicks: 1,
      ctr: 20,
      spend: 3,
      children: [
        {
          id: 'd-1',
          name: 'Deal A1',
          status: 'active',
          budget: 5,
          impressions: 2,
          clicks: 1,
          ctr: 50,
          spend: 1,
        },
      ],
    },
  ];
  return (
    <Stack gap={4}>
      <Variant label="Loading (8 skeleton rows)">
        <DvGrid<Row> {...base} rows={[]} total={0} loading />
      </Variant>
      <Variant label="Empty">
        <DvGrid<Row> {...base} rows={[]} total={0} />
      </Variant>
      <Variant label="Error banner above the grid">
        <DvGrid<Row>
          {...base}
          rows={GRID_ROWS.slice(0, 1)}
          total={1}
          error={<DvBanner kind="error">Could not load campaigns.</DvBanner>}
        />
      </Variant>
      <Variant label="Sections">
        <DvGrid<Row>
          {...base}
          rows={GRID_ROWS}
          total={4}
          sections={[
            { id: 'action', label: 'Action required', rowIds: ['c-1001', 'c-1002'] },
            { id: 'rest', label: 'Everything else', rowIds: ['c-1003', 'c-1004'] },
          ]}
        />
      </Variant>
      <Variant label="Tree rows">
        <DvGrid<Row> {...base} rows={tree} total={1} getChildren={(r) => r.children ?? []} />
      </Variant>
    </Stack>
  );
}

const BULK_GROUPS: BulkMenuGroup[] = [
  {
    label: 'Status',
    items: [
      { id: 'activate', label: 'Activate' },
      { id: 'pause', label: 'Pause' },
    ],
  },
  {
    label: 'Bulk apply',
    items: [
      {
        id: 'template',
        label: 'Targeting template',
        disabled: true,
        disabledReason: 'Select line items to apply a template',
      },
    ],
  },
  {
    label: 'Bulk edit',
    items: [
      { id: 'settings', label: 'Settings' },
      {
        id: 'inventory',
        label: 'Inventory',
        children: [{ id: 'inv-sources', label: 'Inventory source' }],
      },
    ],
  },
  {
    label: 'Bulk action',
    items: [
      { id: 'archive', label: 'Archive' },
      { id: 'duplicate', label: 'Duplicate', shortcut: '⌘+D' },
    ],
  },
  {
    label: 'SDF',
    items: [
      { id: 'download', label: 'Download', shortcut: '⌘+Shift+K' },
      { id: 'download-qa', label: 'Download QA' },
    ],
  },
];

function BulkBarDemo() {
  const toast = useToast();
  return (
    <Stack gap={4}>
      <Variant label="1 row selected">
        <DvBulkBar
          count={1}
          groups={BULK_GROUPS}
          onAction={(id) =>
            toast.show({
              message: `Started bulk action ${id}.`,
              action: { label: 'View status', onClick: () => {} },
            })
          }
          onClear={() => {}}
        />
      </Variant>
      <Variant label="3 rows selected">
        <DvBulkBar count={3} groups={BULK_GROUPS} onAction={() => {}} onClear={() => {}} />
      </Variant>
    </Stack>
  );
}

const FILTER_FIELDS: FilterField[] = [
  {
    id: 'status',
    label: 'Status',
    type: 'multi',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'paused', label: 'Paused' },
      { value: 'deleting', label: 'Scheduled for deletion' },
    ],
  },
  {
    id: 'type',
    label: 'Type',
    type: 'single',
    options: [
      { value: 'display', label: 'Display' },
      { value: 'video', label: 'Video' },
    ],
  },
];

function FilterBarDemo() {
  const [value, setValue] = useState<FilterValue[]>([{ fieldId: 'status', values: ['active'] }]);
  const [text, setText] = useState('');
  return (
    <Stack gap={4}>
      <Variant label="No filters">
        <DvFilterBar
          ariaLabel="Filters (empty)"
          fields={FILTER_FIELDS}
          value={[]}
          text=""
          onChange={() => {}}
        />
      </Variant>
      <Variant label="Interactive">
        <DvFilterBar
          ariaLabel="Filters (interactive)"
          fields={FILTER_FIELDS}
          value={value}
          text={text}
          onChange={(v, t) => {
            setValue(v);
            setText(t);
          }}
        />
      </Variant>
      <Variant label="Multi-value chip">
        <DvFilterBar
          ariaLabel="Filters (multi-value)"
          fields={FILTER_FIELDS}
          value={[{ fieldId: 'status', values: ['active', 'paused', 'a', 'b', 'c'] }]}
          text=""
          onChange={() => {}}
        />
      </Variant>
    </Stack>
  );
}

function DateRangeDemo() {
  const yesterday = new Date(2026, 9, 27);
  const [grid, setGrid] = useState<DateRangeValue>({
    start: yesterday,
    end: yesterday,
    preset: 'yesterday',
  });
  const [history, setHistory] = useState<DateRangeValue>({
    start: new Date(2026, 7, 1),
    end: GALLERY_TODAY,
    preset: 'daysToToday',
    days: 90,
  });
  const [custom, setCustom] = useState<DateRangeValue>({
    start: new Date(2026, 9, 21),
    end: new Date(2026, 9, 27),
    preset: 'custom',
  });
  return (
    <Stack direction="row" gap={4} flexWrap="wrap">
      <Variant label="Grid presets, single day">
        <DvDateRange
          value={grid}
          onChange={setGrid}
          presets="grid"
          today={GALLERY_TODAY}
          singleDay
        />
      </Variant>
      <Variant label="History presets">
        <DvDateRange
          value={history}
          onChange={setHistory}
          presets="history"
          today={GALLERY_TODAY}
        />
      </Variant>
      <Variant label="Custom range label">
        <DvDateRange value={custom} onChange={setCustom} presets="grid" today={GALLERY_TODAY} />
      </Variant>
    </Stack>
  );
}

// ---------- Forms ----------

function FormsDemo() {
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [type, setType] = useState('standard');
  const [formats, setFormats] = useState<string[]>([]);
  const [status, setStatus] = useState<EntityStatus>('draft');
  return (
    <Stack gap={4} sx={{ maxWidth: 640 }}>
      <Variant label="Text field: default, counter, required hint, help">
        <DvTextField
          label="Campaign name"
          placeholder="Enter name"
          value={name}
          onChange={setName}
          maxLength={240}
          showRequiredHint
          help="Names can be up to 240 characters."
        />
      </Variant>
      <Variant label="Text field: error">
        <DvTextField
          label="Budget"
          prefix="₹"
          numeric
          value=""
          onChange={() => {}}
          error="Enter a number greater than 0"
        />
      </Variant>
      <Variant label="Text field: warning">
        <DvTextField
          label="Frequency"
          suffix="%"
          value="12"
          onChange={() => {}}
          warning="This KPI is not recommended for the selected campaign goal."
        />
      </Variant>
      <Variant label="Text field: locked and disabled">
        <Stack gap={2}>
          <DvTextField label="Currency" value="INR" locked />
          <DvTextField label="Disabled" value="Cannot edit" disabled />
        </Stack>
      </Variant>
      <Variant label="Select: grouped, placeholder">
        <DvSelect
          label="Goal"
          value={goal}
          onChange={setGoal}
          placeholder="Choose goal"
          options={[
            { value: 'awareness', label: 'Raise brand awareness', group: 'Recommended KPIs' },
            { value: 'sales', label: 'Drive online sales', group: 'Recommended KPIs' },
            { value: 'other', label: 'Other', group: 'Not recommended' },
          ]}
        />
      </Variant>
      <Variant label="Select: disabled until dependency, error, searchable">
        <Stack gap={2}>
          <DvSelect
            label="KPI"
            value=""
            onChange={() => {}}
            options={[]}
            placeholder="Choose KPI"
            disabled
          />
          <DvSelect
            label="Goal"
            value=""
            onChange={() => {}}
            options={[{ value: 'a', label: 'A' }]}
            error="Enter a value"
          />
          <DvSelect
            label="Country"
            value=""
            onChange={() => {}}
            searchable
            options={[
              { value: 'in', label: 'India', secondLine: 'IN' },
              { value: 'sg', label: 'Singapore', secondLine: 'SG' },
            ]}
          />
        </Stack>
      </Variant>
      <Variant label="Radio group with an inline input">
        <DvRadioGroup
          label="Frequency"
          value={type}
          onChange={setType}
          options={[
            { value: 'standard', label: 'No limit', description: 'Show ads as often as needed' },
            {
              value: 'limit',
              label: 'Limit frequency',
              inline: (selected) => (
                <DvTextField
                  ariaLabel="Exposures"
                  value="5"
                  disabled={!selected}
                  suffix="exposures"
                />
              ),
            },
          ]}
        />
      </Variant>
      <Variant label="Radio cards, one disabled">
        <DvRadioGroup
          variant="cards"
          label="Line item type"
          value="display"
          onChange={() => {}}
          options={[
            {
              value: 'display',
              label: 'Display',
              icon: 'liDisplay',
              description: 'Banner and rich media',
            },
            {
              value: 'video',
              label: 'Video',
              icon: 'liVideo',
              description: 'In-stream video',
              disabled: true,
              disabledReason:
                "Video line items aren't compatible with your insertion order's objective setting.",
            },
          ]}
        />
      </Variant>
      <Variant label="Checkbox group with error">
        <DvCheckboxGroup
          label="Creative types"
          values={formats}
          onChange={setFormats}
          error={formats.length ? undefined : 'Please select at least one creative type.'}
          options={[
            { value: 'display', label: 'Display' },
            { value: 'video', label: 'Video' },
          ]}
        />
      </Variant>
      <Variant label="Section cards: stacked with gear note, settings layout, collapsible">
        <Stack gap={4}>
          <DvSectionCard title="Basic details" gearNote="These settings don't impact serving.">
            <DvTextField label="Name" value="Autumn launch" onChange={() => {}} />
          </DvSectionCard>
          <DvSectionCard
            title="Time zone"
            description="Applies to all reporting."
            layout="settings"
          >
            <DvTextField label="Timezone" value="Asia/Kolkata" locked />
          </DvSectionCard>
          <DvSectionCard title="Additional settings" collapsible defaultOpen={false}>
            <DvTextField label="Notes" value="" onChange={() => {}} />
          </DvSectionCard>
        </Stack>
      </Variant>
      <Variant label="Status select: Draft default">
        <DvStatusSelect value={status} options={['draft', 'active']} onChange={setStatus} />
      </Variant>
    </Stack>
  );
}

function FooterDemo() {
  const [note, setNote] = useState('');
  return (
    <Stack gap={4}>
      <Variant label="Create mode">
        <DvFormFooter
          mode="create"
          dirty={false}
          onPrimary={() => {}}
          onSecondary={() => {}}
          note={note}
          onNoteChange={setNote}
        />
      </Variant>
      <Variant label="Edit mode, clean (Save and Reset disabled)">
        <DvFormFooter
          mode="edit"
          dirty={false}
          onPrimary={() => {}}
          onSecondary={() => {}}
          onReset={() => {}}
          note={note}
          onNoteChange={setNote}
        />
      </Variant>
      <Variant label="Edit mode, dirty, with Schedule for deletion">
        <DvFormFooter
          mode="edit"
          dirty
          onPrimary={() => {}}
          onSecondary={() => {}}
          onReset={() => {}}
          note={note}
          onNoteChange={setNote}
          extraRight={<Button color="error">Schedule for deletion</Button>}
        />
      </Variant>
      <Variant label="Panel mode">
        <DvFormFooter mode="panel" dirty onPrimary={() => {}} onSecondary={() => {}} />
      </Variant>
    </Stack>
  );
}

function FormPageDemo() {
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', maxHeight: 420, overflow: 'auto' }}>
      <DvFormPage
        embedded
        title="New campaign"
        onClose={() => {}}
        footer={
          <DvFormFooter
            embedded
            mode="create"
            dirty={false}
            onPrimary={() => {}}
            onSecondary={() => {}}
          />
        }
      >
        <DvSectionCard title="Basic details">
          <DvTextField label="Name" value="" onChange={() => {}} placeholder="Enter name" />
        </DvSectionCard>
      </DvFormPage>
    </Box>
  );
}

// ---------- Status ----------

function StatusDemo() {
  const dots = [
    'active',
    'paused',
    'draft',
    'archived',
    'scheduledForDeletion',
    'completed',
    'notServable',
    'pending',
    'trafficked',
  ] as const;
  const chips = [
    'servable',
    'pending',
    'disapproved',
    'completed',
    'failed',
    'limitedAccess',
    'recommended',
    'beta',
    'new',
    'alpha',
  ] as const;
  return (
    <Stack gap={4}>
      <Variant label="Dots">
        <Stack direction="row" gap={4}>
          {dots.map((d) => (
            <DvStatusDot key={d} status={d} />
          ))}
        </Stack>
      </Variant>
      <Variant label="Chips and tags">
        <Stack direction="row" gap={3} flexWrap="wrap" alignItems="center">
          {chips.map((c) => (
            <DvStatusChip key={c} kind={c} />
          ))}
        </Stack>
      </Variant>
      <Variant label="Hover detail and help">
        <Stack direction="row" gap={4} alignItems="center">
          <DvHoverDetail detail="Servable on 1 of 2 exchanges">Servable (1 of 2)</DvHoverDetail>
          <DvHelp learnMoreHref="#">Help text written for Adsmetor, one to three lines.</DvHelp>
          <DvKbd>⌘</DvKbd>
          <DvKbd>Shift</DvKbd>
          <DvTooltip title="Search (/)">
            <Button variant="outlined" size="small">
              Hover me
            </Button>
          </DvTooltip>
        </Stack>
      </Variant>
    </Stack>
  );
}

// ---------- Overlays ----------

function ModalsDemo() {
  const [which, setWhich] = useState<null | 'unsaved' | 'channel' | 'confirm' | 'danger'>(null);
  return (
    <Stack direction="row" gap={2} flexWrap="wrap">
      <Button variant="outlined" onClick={() => setWhich('unsaved')}>
        Unsaved Changes
      </Button>
      <Button variant="outlined" onClick={() => setWhich('channel')}>
        Unsaved (channel)
      </Button>
      <Button variant="outlined" onClick={() => setWhich('confirm')}>
        Form dialog
      </Button>
      <Button variant="outlined" onClick={() => setWhich('danger')}>
        Delete dialog
      </Button>
      <DvUnsavedChangesModal
        open={which === 'unsaved'}
        onDiscard={() => setWhich(null)}
        onContinue={() => setWhich(null)}
      />
      <DvUnsavedChangesModal
        open={which === 'channel'}
        variant="channel"
        onDiscard={() => setWhich(null)}
        onContinue={() => setWhich(null)}
      />
      <DvModal
        open={which === 'confirm'}
        title="Copy settings"
        size="md"
        primary={{ label: 'Copy Settings', onClick: () => setWhich(null) }}
        secondary={{ label: 'Cancel', onClick: () => setWhich(null) }}
        onClose={() => setWhich(null)}
      >
        Choose a campaign to copy settings from.
      </DvModal>
      <DvModal
        open={which === 'danger'}
        title="Delete channel"
        primary={{ label: 'Delete', tone: 'danger', onClick: () => setWhich(null) }}
        secondary={{ label: 'Cancel', onClick: () => setWhich(null) }}
        onClose={() => setWhich(null)}
        error="Could not delete. Try again."
      >
        This cannot be undone.
      </DvModal>
    </Stack>
  );
}

function SlideOverDemo() {
  const [open, setOpen] = useState<0 | 1 | 2>(0);
  const [tab, setTab] = useState('details');
  return (
    <>
      <Button variant="outlined" onClick={() => setOpen(1)}>
        Open slide-over
      </Button>
      <DvSlideOver
        open={open >= 1}
        title="Create ad group"
        tabs={[
          { id: 'details', label: 'Details' },
          { id: 'ads', label: 'Active Line Items' },
        ]}
        activeTab={tab}
        onTabChange={setTab}
        dirty
        applyLabel="Create ad group"
        onApply={() => setOpen(0)}
        onCancel={() => setOpen(0)}
        onDelete={() => setOpen(0)}
      >
        <Stack gap={4}>
          <DvTextField label="Name" value="" onChange={() => {}} />
          <Button variant="outlined" onClick={() => setOpen(2)}>
            Create ad
          </Button>
        </Stack>
      </DvSlideOver>
      <DvSlideOver
        open={open === 2}
        level={1}
        title="Create ad"
        width="wide"
        onApply={() => setOpen(1)}
        onCancel={() => setOpen(1)}
      >
        Nested slide-over body
      </DvSlideOver>
    </>
  );
}

function InlineEditDemo() {
  const [budget, setBudget] = useState('1200');
  return (
    <Stack gap={4} sx={{ maxWidth: 320 }}>
      <Variant label="Resting cell (hover shows the pencil), Enter commits, Esc cancels, invalid shows a tooltip">
        <DvInlineEdit
          label="Budget"
          prefix="₹"
          value={budget}
          display={`₹${Number(budget).toLocaleString('en-US')}.00`}
          validate={(v) => (Number(v) > 0 ? undefined : 'Enter a number greater than 0')}
          onCommit={setBudget}
        />
      </Variant>
    </Stack>
  );
}

function ShortcutsDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outlined" onClick={() => setOpen(true)}>
        Keyboard shortcuts
      </Button>
      <DvShortcutsModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function FeedbackDemo() {
  const toast = useToast();
  return (
    <Stack gap={4}>
      <Variant label="Banners">
        <Stack gap={2}>
          <DvBanner kind="info" level="page">
            This advertiser is currently paused. None of its campaigns or deals are serving.
          </DvBanner>
          <DvBanner kind="info" links={[{ label: 'Learn more', href: '#' }]}>
            Recently added audiences can take up to 4 hours to appear.
          </DvBanner>
          <DvBanner kind="warning" action={{ label: 'Review fees', onClick: () => {} }}>
            This KPI is not recommended for the selected campaign goal.
          </DvBanner>
          <DvBanner kind="error" onDismiss={() => {}}>
            Failed to load the report.
          </DvBanner>
          <DvBanner kind="success">Settings saved.</DvBanner>
          <DvBanner kind="warning" details="The longer explanation appears here.">
            Third-party tag compliance needs review.
          </DvBanner>
        </Stack>
      </Variant>
      <Variant label="Toasts">
        <Stack direction="row" gap={2}>
          <Button variant="outlined" onClick={() => toast.show({ message: 'Created' })}>
            Neutral
          </Button>
          <Button
            variant="outlined"
            onClick={() =>
              toast.show({
                message: 'Started bulk action.',
                action: { label: 'View status', onClick: () => {} },
              })
            }
          >
            With action
          </Button>
          <Button
            variant="outlined"
            onClick={() =>
              toast.show({ kind: 'error', message: 'Error when retrieving Floodlight.' })
            }
          >
            Error
          </Button>
          <Button
            variant="outlined"
            onClick={() =>
              toast.show({
                kind: 'warning',
                message:
                  'To create Demand Gen line items: enable Floodlight optimization in this advertiser.',
              })
            }
          >
            Warning
          </Button>
        </Stack>
      </Variant>
    </Stack>
  );
}

function EmptyDemo() {
  return (
    <Stack gap={4}>
      <Variant label="Icon">
        <DvEmptyState message="There is no history for this date range." />
      </Variant>
      <Variant label="Icon with action">
        <DvEmptyState
          icon="listEmpty"
          message="No channels found"
          action={{ label: 'New channel', onClick: () => {}, primary: true }}
        />
      </Variant>
      <Variant label="Positive">
        <DvEmptyState
          variant="positive"
          message="There are no rejected creatives (not including YouTube & partners)"
        />
      </Variant>
      <Variant label="Illustrated">
        <DvEmptyState
          variant="illustrated"
          title="Welcome to Cross-media reach!"
          message="Plan reach across channels."
          action={{ label: 'New report', onClick: () => {}, primary: true }}
          secondary={{ label: 'Learn more', href: '#' }}
        />
      </Variant>
      <Variant label="Inline">
        <DvEmptyState variant="inline" message="No performance chart data available" />
      </Variant>
    </Stack>
  );
}

function LoadingDemo() {
  return (
    <Stack direction="row" gap={6} alignItems="center">
      <DvSpinner />
      <Box sx={{ width: 240 }}>
        <DvSkeleton rows={3} />
      </Box>
    </Stack>
  );
}

function NavigationDemo() {
  const [page, setPage] = useState('campaigns');
  const [card, setCard] = useState('details');
  const [seg, setSeg] = useState('include');
  const [chip, setChip] = useState('all');
  const [step, setStep] = useState(1);
  return (
    <Stack gap={4}>
      <Variant label="Page tabs (pinned default, count, NEW)">
        <DvTabs
          ariaLabel="Page"
          value={page}
          onChange={setPage}
          tabs={[
            { id: 'campaigns', label: 'Campaigns', pinned: true },
            { id: 'ios', label: 'Insertion orders', count: 3 },
            { id: 'alerts', label: 'Alerts', badge: 'NEW' },
            { id: 'off', label: 'Disabled', disabled: true },
          ]}
        />
      </Variant>
      <Variant label="Card tabs">
        <DvTabs
          variant="card"
          ariaLabel="Card"
          value={card}
          onChange={setCard}
          tabs={[
            { id: 'details', label: 'Details' },
            { id: 'assigned', label: 'Assigned', count: 3 },
          ]}
        />
      </Variant>
      <Variant label="Segmented">
        <DvTabs
          variant="segmented"
          ariaLabel="Mode"
          value={seg}
          onChange={setSeg}
          tabs={[
            { id: 'include', label: 'Include' },
            { id: 'exclude', label: 'Exclude' },
          ]}
        />
      </Variant>
      <Variant label="Chip tabs">
        <DvTabs
          variant="chips"
          ariaLabel="Alert type"
          value={chip}
          onChange={setChip}
          tabs={[
            { id: 'all', label: 'All' },
            { id: 'budget', label: 'Budget' },
            { id: 'creatives', label: 'Creatives' },
          ]}
        />
      </Variant>
      <Variant label="Stepper (setup, test, save)">
        <Stack gap={2} alignItems="center">
          <DvStepper
            current={step}
            steps={[
              { id: 's1', label: 'Set up' },
              { id: 's2', label: 'Test' },
              { id: 's3', label: 'Save' },
            ]}
          />
          <Stack direction="row" gap={2}>
            <Button onClick={() => setStep((s) => Math.max(0, s - 1))}>Back</Button>
            <Button variant="contained" onClick={() => setStep((s) => Math.min(2, s + 1))}>
              Next
            </Button>
          </Stack>
          <DvStepper
            current={0}
            steps={[
              { id: 's1', label: 'Set up', error: true },
              { id: 's2', label: 'Test' },
            ]}
          />
        </Stack>
      </Variant>
    </Stack>
  );
}

function HeadersDemo() {
  return (
    <Stack gap={4}>
      <Variant label="Page header with Limited Access chip, actions and tabs">
        <DvPageHeader
          title="Campaigns"
          limitedAccess
          actions={<Button variant="contained">New</Button>}
        >
          <DvTabs
            ariaLabel="Header tabs"
            value="a"
            onChange={() => {}}
            tabs={[
              { id: 'a', label: 'Campaigns' },
              { id: 'b', label: 'Insertion orders' },
            ]}
          />
        </DvPageHeader>
      </Variant>
      <Variant label="Entity header">
        <DvEntityHeader
          crumbs={[{ label: 'Overview', href: '#' }]}
          title="Autumn launch"
          status={<DvStatusChip kind="servable" label="Active" />}
          actions={<Button variant="outlined">Edit</Button>}
        />
      </Variant>
    </Stack>
  );
}

// ---------- Tier B ----------

function ChartsDemo() {
  return (
    <Stack gap={4}>
      <DvChartStrip suggestions={['Bubble chart of CPA vs conversions']} onCustomize={() => {}}>
        <DvChartCard
          title="Total cost"
          period="(flight start - Today)"
          help="Spend for the flight so far."
          menu={[{ label: 'Download', onClick: () => {} }]}
          locked
          footer="Today: ₹4.5K (12% of ₹40K)"
        >
          <DvSparkBars
            label="Daily cost"
            todayIndex={6}
            data={['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => ({
              label,
              value: 10 + i * 3,
            }))}
          />
        </DvChartCard>
        <DvChartCard title="Avg. CPM" period="(Last 7 days)">
          <DvGoalProgress value={72} valueText="₹72.00" goal={50} goalText="₹50.00" />
        </DvChartCard>
        <DvChartCard title="Budget health" selected>
          <DvDonut
            label="Budget health"
            slices={[
              { name: 'Likely to spend', value: 6, color: undefined },
              { name: 'At risk', value: 3 },
              { name: 'Spend', value: 1 },
            ]}
          />
        </DvChartCard>
        <DvChartCard title="Brand controls">
          <DvCoverageBar done={46} total={50} noun="Line items" />
        </DvChartCard>
        <DvChartCard
          title="Empty chart"
          empty={<DvEmptyState variant="inline" message="No performance chart data available" />}
        />
      </DvChartStrip>
      <Stack direction="row" gap={4} flexWrap="wrap">
        <DvKpiTile label="Underpacing" value={4} accent="error" />
        <DvKpiTile label="At risk" value={7} accent="warning" />
        <DvKpiTile label="On track" value={19} accent="info" onClick={() => {}} />
      </Stack>
    </Stack>
  );
}

function PickerDemo() {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <Stack gap={4}>
      <Stack direction="row" gap={2} alignItems="center">
        <Button variant="outlined" onClick={() => setOpen(true)}>
          Select campaign
        </Button>
        <Typography variant="body2">
          {picked.length ? `${picked.length} picked` : 'Nothing picked'}
        </Typography>
      </Stack>
      <DvPickerDialog
        open={open}
        title="Select campaign"
        items={[
          { id: 'c1', label: 'Autumn launch', secondLine: 'C-1001' },
          { id: 'c2', label: 'Back to school', secondLine: 'C-1002' },
        ]}
        value={picked}
        onApply={(ids) => {
          setPicked(ids);
          setOpen(false);
        }}
        onCancel={() => setOpen(false)}
      />
      <DvCardCarousel
        ariaLabel="Targeting templates"
        cards={[
          { id: 't1', name: 'Basic display', family: 'basic', meta: 'Last modified: Oct 12, 2026' },
          { id: 't2', name: 'Reach booster', family: 'reach', meta: 'Last modified: Oct 14, 2026' },
          { id: 't3', name: 'Video starter', family: 'video', meta: 'Last modified: Oct 20, 2026' },
        ]}
      />
    </Stack>
  );
}

export const GALLERY_ENTRIES: GalleryEntry[] = [
  { id: 'typography', title: 'Typography', Demo: TypographyDemo },
  { id: 'icons', title: 'Icons (DvIcon)', Demo: IconsDemo },
  { id: 'shell', title: 'App bar, breadcrumbs, nav', Demo: ShellDemo },
  { id: 'rail', title: 'Right rail and panels', Demo: RailDemo },
  { id: 'panel-states', title: 'Panel states, health list', Demo: PanelStatesDemo },
  { id: 'grid', title: 'Grid', Demo: GridDemo },
  { id: 'grid-states', title: 'Grid states', Demo: GridStatesDemo },
  { id: 'inline-edit', title: 'Inline edit cell', Demo: InlineEditDemo },
  { id: 'bulk-bar', title: 'Bulk action bar', Demo: BulkBarDemo },
  { id: 'filter-bar', title: 'Filter bar', Demo: FilterBarDemo },
  { id: 'date-range', title: 'Date range', Demo: DateRangeDemo },
  { id: 'forms', title: 'Form fields and section cards', Demo: FormsDemo },
  { id: 'form-footer', title: 'Form footer', Demo: FooterDemo },
  { id: 'form-page', title: 'Form page', Demo: FormPageDemo },
  { id: 'status', title: 'Status dots, chips, help, tooltips', Demo: StatusDemo },
  { id: 'modals', title: 'Modals', Demo: ModalsDemo },
  { id: 'shortcuts', title: 'Keyboard shortcuts dialog', Demo: ShortcutsDemo },
  { id: 'slide-over', title: 'Slide-over', Demo: SlideOverDemo },
  { id: 'feedback', title: 'Banners and toasts', Demo: FeedbackDemo },
  { id: 'empty', title: 'Empty states', Demo: EmptyDemo },
  { id: 'loading', title: 'Loading', Demo: LoadingDemo },
  { id: 'navigation', title: 'Tabs and stepper', Demo: NavigationDemo },
  { id: 'headers', title: 'Page and entity headers', Demo: HeadersDemo },
  { id: 'charts', title: 'Chart cards and KPI tiles (Tier B)', Demo: ChartsDemo },
  { id: 'pickers', title: 'Picker dialog and card carousel (Tier B)', Demo: PickerDemo },
];
