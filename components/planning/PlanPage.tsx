'use client';

// Plan page, "Adjust your plan and view forecast" (module 04 S2): header, settings strip, forecast, line item table.
// The page keeps a draft of the header and rows; Save sends the draft and receives the stored plan with a fresh forecast.
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import {
  DvBanner,
  DvEmptyState,
  DvModal,
  DvRadioGroup,
  DvSelect,
  DvSlideOver,
  DvStatusChip,
  DvTextField,
  useToast,
} from '@/components/dv';
import { DvIcon } from '@/components/icons';
import { useViewer } from '@/components/shell/ViewerProvider';
import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard';
import { AppLink } from '@/lib/routes/AppLink';
import { campaignPath } from '@/lib/routes/paths';
import {
  archivePlanAction,
  convertPlanAction,
  copyPlanAction,
  downloadPlanCsvAction,
  listPlanCampaignsAction,
  previewPlanForecastAction,
  removePlanAction,
  savePlanColumnsAction,
  updatePlanAction,
} from '@/lib/planning/actions';
import {
  AGE_BRACKETS,
  PLAN_COUNTRIES,
  demographicsLabel,
  planCountry,
  type Gender,
  type PlanDemographics,
} from '@/lib/planning/countries';
import { planPagePath, plansListPath } from '@/lib/planning/paths';
import { PLN_MSG } from '@/lib/planning/rules';
import type { PlanCampaignChoice } from '@/lib/planning/service';
import {
  INVENTORY_QUALITY_LABEL,
  LOCKED_CPM_METHODS,
  VIEWABILITY_LABEL,
  type InventoryQuality,
  type PlanAdditional,
  type PlanDto,
  type PlanForecast,
  type PlanRowDto,
  type PlanRowInput,
} from '@/lib/planning/types';
import { PlanDateRange } from './PlanDateRange';
import {
  AdFormatsDialog,
  ConvertPlanDialog,
  CopyPlanDialog,
  ModifyColumnsDialog,
  RemovePlanDialog,
} from './PlanDialogs';
import { PlanForecastTabs, PlanSummary } from './PlanForecastCard';
import { PlanRowSlideOver } from './PlanRowSlideOver';
import { PlanTable } from './PlanTable';

interface Draft {
  name: string;
  location: string;
  start: string;
  end: string;
  demographics: PlanDemographics;
  additional: PlanAdditional;
  rows: PlanRowDto[];
}

const draftOf = (p: PlanDto): Draft => ({
  name: p.header.name,
  location: p.header.location,
  start: p.header.dates.start,
  end: p.header.dates.end,
  demographics: p.header.demographics,
  additional: p.header.additional,
  rows: p.rows,
});

const addDays = (iso: string, n: number): string =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string): number =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

const BRACKET_LOW: Record<string, number> = {
  '18-24': 18,
  '25-34': 25,
  '35-44': 35,
  '45-54': 45,
  '55-64': 55,
  '65+': 65,
};
const BRACKET_HIGH: Record<string, number> = {
  '18-24': 24,
  '25-34': 34,
  '35-44': 44,
  '45-54': 54,
  '55-64': 64,
  '65+': 120,
};
const bracketsOf = (d: PlanDemographics): string[] =>
  AGE_BRACKETS.filter(
    (b) => d.ageMin <= (BRACKET_HIGH[b] as number) && d.ageMax >= (BRACKET_LOW[b] as number),
  );

const savedLabel = (plan: PlanDto): string => {
  if (!plan.savedAt) return 'Not saved yet';
  const n = daysBetween(plan.savedAt.slice(0, 10), plan.simToday);
  return n <= 0 ? 'Saved just now' : `Saved ${n} day${n === 1 ? '' : 's'} ago`;
};

let tmp = 0;

export function PlanPage({
  partnerId,
  advertiserId,
  initial,
  columns: initialColumns,
}: {
  partnerId: string;
  advertiserId: string;
  initial: PlanDto;
  columns: string[];
}) {
  const router = useRouter();
  const toast = useToast();
  const { viewer } = useViewer();
  const [plan, setPlan] = useState(initial);
  const [draft, setDraft] = useState<Draft>(() => draftOf(initial));
  const [columns, setColumns] = useState(initialColumns);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pageError, setPageError] = useState<string | undefined>();
  const [busy, start] = useTransition();
  const [forecasting, setForecasting] = useState(false);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [dialog, setDialog] = useState<
    null | 'columns' | 'copy' | 'convert' | 'remove' | 'demographics' | 'additional' | 'formats'
  >(null);
  const [preview, setPreview] = useState<PlanForecast | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [editRow, setEditRow] = useState<PlanRowDto | null>(null);
  const [campaigns, setCampaigns] = useState<PlanCampaignChoice[]>([]);

  const archived = plan.status === 'ARCHIVED';
  const locked = plan.locked || plan.status !== 'PLANNED';
  const editable = !locked && plan.canWrite && !viewer.readOnly;
  const dirty = useMemo(
    () => JSON.stringify(draftOf(plan)) !== JSON.stringify(draft),
    [plan, draft],
  );
  useUnsavedGuard(dirty);
  const stale = editable && (dirty || plan.stale) && draft.rows.length > 0;
  const cur = plan.header.currencyCode;
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  // Fee is the plan default for new rows; existing rows keep theirs.
  const defaultFee = plan.rows[0]?.feePct ?? 0.1;

  const rowInputs = (keepTmpIds: boolean): PlanRowInput[] =>
    draft.rows.map((r) => ({
      ...(r.id.startsWith('tmp-') && !keepTmpIds ? {} : { id: r.id }),
      name: r.name,
      buyingMethod: r.buyingMethod,
      dealId: r.dealId,
      locations: r.locations,
      startDate: r.startDate,
      endDate: r.endDate,
      targeting: r.targeting,
      audienceRefs: r.audienceRefs,
      budgetNet: r.budgetNet,
      maxCpm: r.maxCpm,
    }));

  // Live forecast of the unsaved draft (gap p4-08 #10): debounced, never written. The server drops half-filled rows.
  const draftKey = JSON.stringify(draft);
  useEffect(() => {
    if (!editable || !dirty) {
      setPreview(null);
      return;
    }
    let live = true;
    setPreviewing(true);
    const timer = setTimeout(() => {
      void previewPlanForecastAction(advertiserId, {
        id: plan.id,
        location: draft.location,
        dates: { start: draft.start, end: draft.end },
        demographics: draft.demographics,
        additional: draft.additional,
        rows: rowInputs(true),
      }).then((res) => {
        if (!live) return;
        setPreviewing(false);
        setPreview(res.ok ? res.data.forecast : null);
      });
    }, 500);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, editable, dirty]);

  const save = () =>
    start(async () => {
      setErrors({});
      setPageError(undefined);
      setForecasting(true);
      const rows: PlanRowInput[] = draft.rows.map((r) => ({
        ...(r.id.startsWith('tmp-') ? {} : { id: r.id }),
        name: r.name,
        buyingMethod: r.buyingMethod,
        dealId: r.dealId,
        locations: r.locations,
        startDate: r.startDate,
        endDate: r.endDate,
        targeting: r.targeting,
        audienceRefs: r.audienceRefs,
        budgetNet: r.budgetNet,
        maxCpm: r.maxCpm,
      }));
      const res = await updatePlanAction(advertiserId, {
        id: plan.id,
        expectedVersion: plan.version,
        name: draft.name,
        location: draft.location,
        dates: { start: draft.start, end: draft.end },
        demographics: draft.demographics,
        additional: draft.additional,
        rows,
      });
      setForecasting(false);
      if (!res.ok) {
        setErrors(Object.fromEntries(res.issues.map((i) => [i.path, i.message])));
        setPageError(res.issues.find((i) => i.path === '*')?.message ?? res.issues[0]?.message);
        return;
      }
      setPlan(res.data.plan);
      setDraft(draftOf(res.data.plan));
      setPreview(null);
      toast.show({ message: 'Plan saved' });
    });

  const download = async () => {
    setMenu(null);
    const f = await downloadPlanCsvAction(advertiserId, plan.id);
    if (!f) return toast.show({ message: "Couldn't download the plan." });
    const url = URL.createObjectURL(new Blob([f.body], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = f.fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openCopy = () => {
    setPageError(undefined);
    setDialog('copy');
  };
  const copy = (v: { name: string; start: string; end: string }) =>
    start(async () => {
      const res = await copyPlanAction(advertiserId, {
        id: plan.id,
        name: v.name,
        startDate: v.start,
        endDate: v.end,
      });
      if (!res.ok) return setPageError(res.issues[0]?.message);
      setDialog(null);
      router.push(planPagePath(partnerId, advertiserId, res.data.publicId));
    });

  const openConvert = async () => {
    setPageError(undefined);
    setCampaigns(await listPlanCampaignsAction(advertiserId));
    setDialog('convert');
  };
  const convert = (v: { target: 'CAMPAIGN' | 'IO'; campaignId?: string }) =>
    start(async () => {
      const res = await convertPlanAction(advertiserId, { id: plan.id, ...v });
      if (!res.ok) return setPageError(res.issues[0]?.message);
      setDialog(null);
      setPageError(undefined);
      setPlan((p) => ({
        ...p,
        status: 'TRAFFICKED',
        convertedCampaignPublicId: res.data.campaignPublicId,
      }));
      toast.show({
        message: 'Plan trafficked.',
        action: {
          label: 'Open campaign',
          onClick: () =>
            router.push(campaignPath(partnerId, advertiserId, res.data.campaignPublicId)),
        },
      });
    });

  const remove = () =>
    start(async () => {
      const res = await removePlanAction(advertiserId, plan.id);
      if (!res.ok) return setPageError(res.issues[0]?.message);
      setDialog(null);
      setDraft(draftOf(plan));
      router.push(plansListPath(partnerId, advertiserId));
    });

  const archive = (value: boolean) =>
    start(async () => {
      setMenu(null);
      const res = await archivePlanAction(advertiserId, plan.id, value);
      if (!res.ok) return setPageError(res.issues[0]?.message);
      setPlan((p) => ({ ...p, status: res.data.status }));
      toast.show({ message: value ? 'Plan archived' : 'Plan restored' });
    });

  const saveColumns = async (order: string[]) => {
    setDialog(null);
    setColumns(order);
    const res = await savePlanColumnsAction(advertiserId, order);
    if (res.ok) setColumns(res.data.order);
  };

  const addRow = () => {
    const r: PlanRowDto = {
      id: `tmp-${++tmp}`,
      ordinal: draft.rows.length,
      name: '',
      buyingMethod: 'OPEN_AUCTION',
      dealId: null,
      locations: [draft.location],
      startDate: draft.start,
      endDate: draft.end,
      targeting: {},
      audienceRefs: [],
      budgetNet: 0,
      budgetTotal: 0,
      feePct: defaultFee,
      maxCpm: null,
      isCpmLocked: false,
      pricing: 'Auction',
    };
    setEditRow(r);
  };
  const applyRow = (r: PlanRowDto) => {
    setDraft((d) => {
      const exists = d.rows.some((x) => x.id === r.id);
      return {
        ...d,
        rows: exists
          ? d.rows.map((x) => (x.id === r.id ? r : x))
          : [...d.rows, { ...r, ordinal: d.rows.length }],
      };
    });
    setEditRow(null);
  };
  const duplicateRow = (r: PlanRowDto) => {
    setDraft((d) => ({
      ...d,
      rows: [...d.rows, { ...r, id: `tmp-${++tmp}`, ordinal: d.rows.length }],
    }));
    setEditRow(null);
  };
  const addFormats = (added: PlanRowDto[]) => {
    setDraft((d) => ({
      ...d,
      rows: [
        ...d.rows,
        ...added.map((r, i) => ({ ...r, id: `tmp-${++tmp}`, ordinal: d.rows.length + i })),
      ],
    }));
    setDialog(null);
  };
  const deleteRow = () => {
    if (editRow) set({ rows: draft.rows.filter((x) => x.id !== editRow.id) });
    setEditRow(null);
  };

  const tableRows = draft.rows.map((r) => ({
    ...r,
    isCpmLocked: LOCKED_CPM_METHODS.includes(r.buyingMethod),
  }));
  // The table reads forecast values of saved rows; the plan the table sees carries the draft header.
  const tablePlan: PlanDto = {
    ...plan,
    header: { ...plan.header, demographics: draft.demographics, currencyCode: cur },
  };

  const lockedEmpty = (
    <DvEmptyState
      icon="refresh"
      variant="icon"
      title="Your start date has passed"
      message="Make a copy of this plan with new dates to work on it again."
      action={{ label: 'Make a copy', onClick: openCopy }}
    />
  );
  const detailEmpty = locked ? (
    lockedEmpty
  ) : draft.rows.length === 0 ? (
    <DvEmptyState variant="inline" message="Add a plan line item to see a forecast" />
  ) : null;

  const copyDefaults = {
    name: `Copy of ${plan.header.name}`,
    start: addDays(plan.simToday, 1),
    end: addDays(
      addDays(plan.simToday, 1),
      daysBetween(plan.header.dates.start, plan.header.dates.end),
    ),
  };

  const country = planCountry(draft.location);
  const showDemo = demographicsLabel(draft.demographics);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }} data-testid="plan-page">
      {pageError && dialog === null ? (
        <DvBanner kind="error" level="inline">
          {pageError}
        </DvBanner>
      ) : null}
      {archived ? (
        <DvBanner kind="info" level="inline">
          This plan is archived and read-only. Restore it from the more actions menu to work on it
          again.
        </DvBanner>
      ) : null}
      {plan.status === 'TRAFFICKED' ? (
        <DvBanner kind="info" level="inline">
          This plan is trafficked.{' '}
          {plan.convertedCampaignPublicId ? (
            <AppLink href={campaignPath(partnerId, advertiserId, plan.convertedCampaignPublicId)}>
              Open campaign
            </AppLink>
          ) : null}
        </DvBanner>
      ) : null}

      {/* Header row */}
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 280, maxWidth: 520 }}>
          <DvTextField
            label="Plan name"
            value={draft.name}
            maxLength={100}
            disabled={!editable}
            error={errors.name}
            onChange={(name) => set({ name })}
          />
        </Box>
        {viewer.limitedAccess ? <DvStatusChip kind="new" label="Limited Access" /> : null}
        {plan.status === 'TRAFFICKED' ? <DvStatusChip kind="new" label="Trafficked" /> : null}
        {archived ? <DvStatusChip kind="new" label="Archived" /> : null}
        <Typography variant="caption" data-testid="saved-label" color="text.secondary">
          {savedLabel(plan)}
        </Typography>
        <Button variant="contained" disabled={!editable || !dirty || busy} onClick={save}>
          Save
        </Button>
        <Button
          variant="outlined"
          disabled={!plan.canWrite || viewer.readOnly || busy}
          onClick={openCopy}
        >
          Copy
        </Button>
        <Button
          variant="outlined"
          disabled={!editable || busy || dirty}
          title={dirty ? 'Save your changes first.' : undefined}
          onClick={() => void openConvert()}
        >
          Create campaign
        </Button>
        <IconButton
          aria-label="More actions"
          aria-haspopup="menu"
          onClick={(e) => setMenu(e.currentTarget)}
        >
          <DvIcon name="more_vert" size={24} />
        </IconButton>
        <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)}>
          <MenuItem onClick={() => void download()}>Download (.csv)</MenuItem>
          <MenuItem
            disabled={!plan.canWrite || viewer.readOnly || dirty}
            title={dirty ? 'Save your changes first.' : undefined}
            onClick={() => archive(!archived)}
          >
            {archived ? 'Restore plan' : 'Archive plan'}
          </MenuItem>
          <MenuItem
            disabled={!plan.canWrite || viewer.readOnly}
            onClick={() => {
              setMenu(null);
              setDialog('remove');
            }}
          >
            Remove plan
          </MenuItem>
        </Menu>
      </Box>

      {/* Settings strip */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          p: 3,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '8px',
          bgcolor: 'background.paper',
        }}
        role="group"
        aria-label="Plan settings"
      >
        <Box sx={{ minWidth: 220 }}>
          <DvSelect
            label="Location"
            value={draft.location}
            disabled={!editable}
            error={errors.location}
            searchable
            options={PLAN_COUNTRIES.map((c) => ({
              value: c.code,
              label: c.name,
              secondLine: c.currency,
            }))}
            onChange={(location) => set({ location })}
          />
        </Box>
        <PlanDateRange
          label="Dates"
          start={draft.start}
          end={draft.end}
          today={plan.simToday}
          disabled={!editable}
          error={errors['dates.start'] ?? errors['dates.end']}
          onChange={(start, end) => set({ start, end })}
        />
        <Box>
          <Typography variant="caption" color="text.secondary" component="div">
            On-target demographics
          </Typography>
          <Button
            variant="outlined"
            disabled={!editable}
            onClick={() => setDialog('demographics')}
            aria-label={`On-target demographics: ${showDemo}`}
            sx={{ height: 40 }}
          >
            {showDemo}
          </Button>
          {errors.demographics ? (
            <Typography role="alert" variant="caption" color="error" component="div">
              {errors.demographics}
            </Typography>
          ) : null}
        </Box>
        <IconButton
          aria-label="Additional Settings"
          disabled={!editable}
          onClick={() => setDialog('additional')}
        >
          <DvIcon name="tune" size={24} />
        </IconButton>
        {country ? (
          <Typography variant="caption" color="text.secondary">
            Currency: {plan.header.currencyCode}
          </Typography>
        ) : null}
      </Box>

      {preview ? (
        <DvBanner kind="info" level="inline">
          Preview of your unsaved changes. Save to keep this forecast.
        </DvBanner>
      ) : null}
      <PlanSummary
        forecast={preview ?? plan.forecast}
        demographics={draft.demographics}
        currency={cur}
        forecasting={forecasting || previewing}
        hasRows={plan.rows.length > 0}
      />
      <PlanForecastTabs
        forecast={preview ?? plan.forecast}
        stale={stale}
        emptyState={detailEmpty}
      />

      {/* Line items */}
      <Box component="section" aria-label="Plan line items">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <Typography variant="h6" component="h2" sx={{ flex: 1 }}>
            Plan line items
          </Typography>
          {editable ? (
            <>
              <Button
                variant="outlined"
                startIcon={<DvIcon name="add" size={18} />}
                onClick={() => setDialog('formats')}
              >
                Add ad formats
              </Button>
              <Button
                variant="outlined"
                startIcon={<DvIcon name="add" size={18} />}
                onClick={addRow}
              >
                Add plan line item
              </Button>
            </>
          ) : null}
          <Button
            variant="outlined"
            startIcon={<DvIcon name="view_column" size={18} />}
            onClick={() => setDialog('columns')}
          >
            Columns
          </Button>
        </Box>
        {errors.rows ? (
          <Typography role="alert" variant="caption" color="error">
            {errors.rows}
          </Typography>
        ) : null}
        <PlanTable
          plan={tablePlan}
          rows={tableRows}
          columns={columns}
          onOpen={setEditRow}
          emptyMessage="Add a plan line item to see a forecast"
        />
      </Box>

      <PlanRowSlideOver
        advertiserId={advertiserId}
        advertiserRowId={plan.advertiserRowId}
        partnerId={partnerId}
        today={plan.simToday}
        onDuplicate={duplicateRow}
        row={editRow}
        planStart={draft.start}
        planEnd={draft.end}
        fee={defaultFee}
        readOnly={!editable}
        onApply={applyRow}
        onCancel={() => setEditRow(null)}
        onDelete={deleteRow}
      />
      {dialog === 'formats' ? (
        <AdFormatsDialog
          open
          currency={cur}
          planStart={draft.start}
          planEnd={draft.end}
          location={draft.location}
          fee={defaultFee}
          onApply={addFormats}
          onCancel={() => setDialog(null)}
        />
      ) : null}
      {dialog === 'columns' ? (
        <ModifyColumnsDialog
          open
          value={columns}
          onApply={(o) => void saveColumns(o)}
          onCancel={() => setDialog(null)}
        />
      ) : null}
      {dialog === 'copy' ? (
        <CopyPlanDialog
          open
          today={plan.simToday}
          defaults={copyDefaults}
          busy={busy}
          error={pageError}
          onCopy={copy}
          onCancel={() => setDialog(null)}
        />
      ) : null}
      {dialog === 'convert' ? (
        <ConvertPlanDialog
          open
          planName={plan.header.name}
          rowCount={plan.rows.length}
          campaigns={campaigns}
          busy={busy}
          error={pageError}
          onCreate={convert}
          onCancel={() => setDialog(null)}
        />
      ) : null}
      <RemovePlanDialog
        open={dialog === 'remove'}
        name={plan.header.name}
        busy={busy}
        onRemove={remove}
        onCancel={() => setDialog(null)}
      />
      {dialog === 'demographics' ? (
        <DemographicsDialog
          value={draft.demographics}
          onApply={(demographics) => {
            set({ demographics });
            setDialog(null);
          }}
          onCancel={() => setDialog(null)}
        />
      ) : null}
      <DvSlideOver
        open={dialog === 'additional'}
        title="Additional Settings"
        onApply={() => setDialog(null)}
        applyLabel="Done"
        onCancel={() => setDialog(null)}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, p: 4 }}>
          <DvBanner kind="info" level="inline">
            Note that any changes you make to the plan settings will not affect your campaign.
          </DvBanner>
          <DvTextField
            label="Frequency goal"
            numeric
            value={String(draft.additional.frequencyGoal)}
            hint="Between 1 and 20 exposures per person."
            error={errors['additional.frequencyGoal']}
            onChange={(v) =>
              set({ additional: { ...draft.additional, frequencyGoal: Number(v) || 0 } })
            }
          />
          <DvRadioGroup
            label="Reach basis"
            value={draft.additional.reachBasis}
            onChange={(v) =>
              set({ additional: { ...draft.additional, reachBasis: v as 'CENSUS' | 'DIGITAL' } })
            }
            options={[
              { value: 'CENSUS', label: 'Census population' },
              { value: 'DIGITAL', label: 'Digital population' },
            ]}
          />
          <DvSelect
            label="Inventory source quality"
            value={draft.additional.inventoryQuality ?? 'AUTHORIZED_AND_NON_PARTICIPATING'}
            options={(Object.keys(INVENTORY_QUALITY_LABEL) as InventoryQuality[]).map((v) => ({
              value: v,
              label: INVENTORY_QUALITY_LABEL[v],
            }))}
            onChange={(v) =>
              set({ additional: { ...draft.additional, inventoryQuality: v as InventoryQuality } })
            }
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={draft.additional.publicInventory ?? true}
                onChange={(e) =>
                  set({ additional: { ...draft.additional, publicInventory: e.target.checked } })
                }
              />
            }
            label="Public inventory"
          />
          <DvSelect
            label="Viewability"
            value={draft.additional.viewability ?? 'NONE'}
            options={(Object.keys(VIEWABILITY_LABEL) as (keyof typeof VIEWABILITY_LABEL)[]).map(
              (v) => ({ value: v, label: VIEWABILITY_LABEL[v] }),
            )}
            onChange={(v) =>
              set({
                additional: {
                  ...draft.additional,
                  viewability: v as NonNullable<PlanAdditional['viewability']>,
                },
              })
            }
          />
          <DvSelect
            label="Brand suitability"
            value={draft.additional.brandSuitability ?? 'NO_RESTRICTIONS'}
            options={[
              { value: 'NO_RESTRICTIONS', label: 'No restrictions' },
              { value: 'EXCLUDE_SENSITIVE', label: 'Exclude sensitive content' },
            ]}
            onChange={(v) =>
              set({
                additional: {
                  ...draft.additional,
                  brandSuitability: v as NonNullable<PlanAdditional['brandSuitability']>,
                },
              })
            }
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={draft.additional.includeYoutube}
                onChange={(e) =>
                  set({ additional: { ...draft.additional, includeYoutube: e.target.checked } })
                }
              />
            }
            label="Include YouTube"
          />
        </Box>
      </DvSlideOver>
    </Box>
  );
}

function DemographicsDialog({
  value,
  onApply,
  onCancel,
}: {
  value: PlanDemographics;
  onApply: (d: PlanDemographics) => void;
  onCancel: () => void;
}) {
  const [genders, setGenders] = useState<Gender[]>(value.genders);
  const [ages, setAges] = useState<string[]>(bracketsOf(value));
  const [error, setError] = useState<string | undefined>();
  const toggleG = (g: Gender) =>
    setGenders((s) => (s.includes(g) ? s.filter((x) => x !== g) : [...s, g]));
  const toggleA = (a: string) =>
    setAges((s) => (s.includes(a) ? s.filter((x) => x !== a) : [...s, a]));
  const apply = () => {
    if (!genders.length || !ages.length) return setError(PLN_MSG.BAD_AGE);
    const lows = ages.map((a) => BRACKET_LOW[a] as number);
    const highs = ages.map((a) => BRACKET_HIGH[a] as number);
    onApply({ genders, ageMin: Math.min(...lows), ageMax: Math.max(...highs) });
  };
  return (
    <DvModal
      open
      title="On-target demographics"
      size="md"
      onClose={onCancel}
      {...(error ? { error } : {})}
      primary={{ label: 'Apply', onClick: apply }}
      secondary={{ label: 'Cancel', onClick: onCancel }}
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        <Box role="group" aria-label="Gender">
          <Typography variant="subtitle2">Gender</Typography>
          {(['MALE', 'FEMALE', 'UNKNOWN'] as const).map((g) => (
            <FormControlLabel
              key={g}
              sx={{ display: 'flex' }}
              control={<Checkbox checked={genders.includes(g)} onChange={() => toggleG(g)} />}
              label={g === 'MALE' ? 'Male' : g === 'FEMALE' ? 'Female' : 'Unknown'}
            />
          ))}
        </Box>
        <Box role="group" aria-label="Age">
          <Typography variant="subtitle2">Age</Typography>
          {AGE_BRACKETS.map((a) => (
            <FormControlLabel
              key={a}
              sx={{ display: 'flex' }}
              control={<Checkbox checked={ages.includes(a)} onChange={() => toggleA(a)} />}
              label={a}
            />
          ))}
        </Box>
      </Box>
    </DvModal>
  );
}
