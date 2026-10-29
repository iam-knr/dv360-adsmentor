'use client';

// Offline report builder, the classic form (module 16 S4): properties, setup, schedule, delivery, footer buttons.
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { DvIcon } from '@/components/icons';
import {
  DvBanner,
  DvModal,
  DvSectionCard,
  DvSelect,
  DvTextField,
  DvUnsavedChangesModal,
  useToast,
} from '@/components/dv';
import { parseDateRangeParam } from '@/lib/metrics/date-range';
import { FIELD_BY_KEY } from '@/lib/reporting/catalogue';
import { runReportAction, saveReportAction } from '@/lib/reporting/actions';
import { ruleCompatibility } from '@/lib/reporting/engine/rules';
import type { FieldView, PageContext } from '@/lib/reporting/service';
import { OFFLINE_TEMPLATES } from '@/lib/reporting/templates';
import type { OfflineTypeWire, ReportDefinition, ReportDelivery, ReportSchedule } from '@/lib/reporting/types';
import { partnerPath } from '@/lib/routes/paths';
import { DEFAULT_DELIVERY, DEFAULT_SCHEDULE, ScheduleFields } from './ScheduleDialog';
import { ShareDialog } from './ShareDialog';

const RANGES = [
  ['YESTERDAY', 'Yesterday'],
  ['LAST_7_DAYS', 'Last 7 days'],
  ['LAST_14_DAYS', 'Last 14 days'],
  ['LAST_30_DAYS', 'Last 30 days'],
  ['MONTH_TO_DATE', 'Month to date'],
  ['LAST_MONTH', 'Last month'],
] as const;

const TYPE_LABEL: Record<OfflineTypeWire, string> = {
  FLOODLIGHT: 'Floodlight',
  INVENTORY_AVAILABILITY: 'Inventory Availability',
};

function FieldChooser({
  open,
  title,
  fields,
  selected,
  onClose,
  onApply,
}: {
  open: boolean;
  title: string;
  fields: FieldView[];
  selected: string[];
  onClose: () => void;
  onApply: (keys: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>(selected);
  return (
    <DvModal
      open={open}
      title={title}
      size="md"
      onClose={onClose}
      primary={{ label: 'Apply', onClick: () => onApply(picked) }}
      secondary={{ label: 'Cancel', onClick: onClose }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', maxHeight: 360, overflowY: 'auto' }}>
        {fields.map((f) => (
          <FormControlLabel
            key={f.key}
            label={f.label}
            control={
              <Checkbox
                checked={picked.includes(f.key)}
                onChange={(e) =>
                  setPicked((p) => (e.target.checked ? [...p, f.key] : p.filter((k) => k !== f.key)))
                }
              />
            }
          />
        ))}
      </Box>
    </DvModal>
  );
}

export interface OfflineBuilderProps {
  partnerId: string;
  partnerName: string;
  offlineType: OfflineTypeWire;
  fields: FieldView[];
  initial: ReportDefinition;
  reportId?: string;
  version?: number;
  readOnly: boolean;
  ctx: Pick<PageContext, 'today' | 'entityOptions'>;
}

export function OfflineBuilder(props: OfflineBuilderProps) {
  const { partnerId, partnerName, offlineType, fields, ctx } = props;
  const router = useRouter();
  const toast = useToast();
  const readOnly = props.readOnly;
  const base = partnerPath(partnerId, 'reporting');
  const [id, setId] = useState(props.reportId);
  const [version, setVersion] = useState(props.version);
  const [name, setName] = useState(props.initial.name);
  const [dateRange, setDateRange] = useState(props.initial.dateRange);
  const [template, setTemplate] = useState(props.initial.template ?? '');
  const [advertisers, setAdvertisers] = useState<string[]>(
    props.initial.filters.find((f) => f.field === 'advertiser')?.values ?? [],
  );
  const [dimensions, setDimensions] = useState(props.initial.dimensions);
  const [metrics, setMetrics] = useState(props.initial.metrics);
  const [schedule, setSchedule] = useState<ReportSchedule>(
    props.initial.schedule ?? DEFAULT_SCHEDULE(ctx.today),
  );
  const [delivery, setDelivery] = useState<ReportDelivery>(
    props.initial.delivery ?? DEFAULT_DELIVERY(props.initial.name),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | undefined>();
  const [chooser, setChooser] = useState<null | 'dimensions' | 'metrics'>(null);
  const [leave, setLeave] = useState(false);
  const [share, setShare] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setDirty(true);
  };

  const templates = OFFLINE_TEMPLATES.filter((t) => t.type === offlineType);
  const dims = fields.filter((f) => f.kind === 'DIMENSION' && f.key !== 'partner');
  const mets = fields.filter((f) => f.kind === 'METRIC');
  const label = (k: string) => fields.find((f) => f.key === k)?.label ?? k;
  const summary = useMemo(() => {
    try {
      const r = parseDateRangeParam(dateRange, ctx.today);
      return `${r.from} - ${r.to}`;
    } catch {
      return '';
    }
  }, [dateRange, ctx.today]);

  const loadTemplate = (key: string) => {
    setTemplate(key);
    const t = OFFLINE_TEMPLATES.find((x) => x.key === key);
    if (!t) return;
    setDimensions(t.dimensions);
    setMetrics(t.metrics);
    setDateRange(t.dateRange);
    setDirty(true);
  };

  const definition = (): ReportDefinition => ({
    ...(id ? { id } : {}),
    kind: 'OFFLINE',
    offlineType,
    name,
    timeZone: 'ADVERTISER',
    dateRange,
    filters: [
      { field: 'partner', op: 'IN', values: [partnerId] },
      ...(advertisers.length ? [{ field: 'advertiser', op: 'IN' as const, values: advertisers }] : []),
    ],
    dimensions,
    metrics,
    viz: { type: 'TABLE' },
    ...(template ? { template } : {}),
    schedule,
    delivery,
  });

  const save = async (andRun: boolean) => {
    const bad = ruleCompatibility(dimensions, metrics);
    if (bad.length) {
      setBanner(bad[0]?.message);
      return;
    }
    setBusy(true);
    const res = await saveReportAction(partnerId, definition(), version !== undefined ? { expectedVersion: version } : {});
    if (!res.ok) {
      setBusy(false);
      setErrors(Object.fromEntries(res.issues.map((i) => [i.path, i.message])));
      setBanner(res.issues.length === 1 && res.issues[0]?.path === '*' ? res.issues[0].message : undefined);
      return;
    }
    setErrors({});
    setBanner(undefined);
    setId(res.data.id);
    setVersion(res.data.version);
    setDirty(false);
    if (andRun) {
      const run = await runReportAction(partnerId, { reportId: res.data.id });
      setBusy(false);
      if (!run.ok) {
        setBanner(run.issues[0]?.message ?? 'The report could not be run.');
        return;
      }
      router.push(`${base}/offline/${res.data.id}/runs`);
      return;
    }
    setBusy(false);
    toast.show({ kind: 'neutral', message: 'Report saved' });
    if (!props.reportId) router.replace(`${base}/offline/${res.data.id}`);
  };

  const openInInstant = () => {
    const ok = (k: string) => !FIELD_BY_KEY.get(k)?.offlineOnly;
    const def = definition();
    const kept = { ...def, dimensions: def.dimensions.filter(ok), metrics: def.metrics.filter(ok) };
    const removed = def.dimensions.length + def.metrics.length - kept.dimensions.length - kept.metrics.length;
    try {
      const { id: _id, schedule: _s, delivery: _d, offlineType: _t, ...rest } = kept;
      void _id;
      void _s;
      void _d;
      void _t;
      sessionStorage.setItem('dv.report.generated', JSON.stringify({ ...rest, kind: 'INSTANT' }));
      if (removed > 0)
        sessionStorage.setItem(
          'dv.report.notice',
          "Some fields aren't available in instant reports and were removed.",
        );
    } catch {
      /* ignore */
    }
    router.push(`${base}/instant/new?generated=1`);
  };

  const advOptions = ctx.entityOptions.advertiser ?? [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 960 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <Link
          component="button"
          underline="hover"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}
          onClick={() => (dirty ? setLeave(true) : router.push(`${base}?tab=offline`))}
        >
          <DvIcon name="arrow_back" size={16} /> Return to Offline Report List
        </Link>
        <Box sx={{ flex: 1 }} />
        <Typography variant="body2" color="text.secondary">
          {TYPE_LABEL[offlineType]} report{id ? '' : ''}
        </Typography>
      </Box>
      <Box sx={{ maxWidth: 480 }}>
        <DvTextField
          label="Report name"
          value={name}
          readOnly={readOnly}
          onChange={touch(setName)}
          {...(errors.name ? { error: errors.name } : {})}
        />
      </Box>
      {banner ? (
        <DvBanner kind="error" onDismiss={() => setBanner(undefined)}>
          {banner}
        </DvBanner>
      ) : null}

      <DvSectionCard title="Report properties">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 480 }}>
          <DvSelect
            label="Date range"
            value={RANGES.some(([v]) => v === dateRange) ? dateRange : 'LAST_7_DAYS'}
            disabled={readOnly}
            onChange={touch(setDateRange)}
            options={RANGES.map(([value, l]) => ({ value, label: l }))}
            hint={summary}
          />
          <Typography variant="body2">Language formatting: English (raw). Numbers have no thousand separators or currency symbols.</Typography>
        </Box>
      </DvSectionCard>

      <DvSectionCard title="Report setup">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box sx={{ maxWidth: 480 }}>
            <DvSelect
              label="Report template"
              value={template}
              disabled={readOnly}
              placeholder="Choose a template"
              onChange={loadTemplate}
              options={templates.map((t) => ({ value: t.key, label: t.title }))}
              hint="Choose a template to load reports with commonly prefilled settings"
            />
          </Box>
          <Box>
            <Typography variant="panelOverline">Filters</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
              <Chip color="success" variant="outlined" label={`Partner = ${partnerName} (${partnerId})`} />
              {advertisers.map((a) => (
                <Chip
                  key={a}
                  color="success"
                  variant="outlined"
                  label={`Advertiser = ${advOptions.find((o) => o.value === a)?.label ?? a}`}
                  {...(readOnly ? {} : { onDelete: () => touch(setAdvertisers)(advertisers.filter((x) => x !== a)) })}
                />
              ))}
            </Box>
            <Box sx={{ maxWidth: 360, mt: 2 }}>
              <DvSelect
                ariaLabel="Add advertiser filter"
                value=""
                disabled={readOnly}
                placeholder="+ add filter: advertiser"
                onChange={(v) => v && !advertisers.includes(v) && touch(setAdvertisers)([...advertisers, v])}
                options={advOptions.map((o) => ({ value: o.value, label: o.label }))}
              />
            </Box>
          </Box>
          <Box>
            <Typography variant="panelOverline">Dimensions</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }} data-testid="offline-dimensions">
              {dimensions.map((k) => (
                <Chip key={k} label={label(k)} />
              ))}
              <Button size="small" disabled={readOnly} onClick={() => setChooser('dimensions')}>
                + add / remove
              </Button>
            </Box>
          </Box>
          <Box>
            <Typography variant="panelOverline">Metrics</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }} data-testid="offline-metrics">
              {metrics.map((k) => (
                <Chip key={k} color="primary" variant="outlined" label={label(k)} />
              ))}
              <Button size="small" disabled={readOnly} onClick={() => setChooser('metrics')}>
                + add / remove
              </Button>
            </Box>
          </Box>
        </Box>
      </DvSectionCard>

      <DvSectionCard title="Schedule and delivery">
        <ScheduleFields
          schedule={schedule}
          delivery={delivery}
          onSchedule={touch(setSchedule)}
          onDelivery={touch(setDelivery)}
          errors={errors}
        />
        {id && !readOnly ? (
          <Box sx={{ mt: 3 }}>
            <Button onClick={() => setShare(true)}>Share with +</Button>
          </Box>
        ) : null}
      </DvSectionCard>

      <DvBanner
        kind="info"
        {...(offlineType === 'FLOODLIGHT' ? {} : {})}
        action={{ label: 'OPEN IN INSTANT REPORTING', onClick: openInInstant }}
      >
        You can also access this report as an Instant Report
      </DvBanner>

      <Box sx={{ display: 'flex', gap: 3 }}>
        <Button variant="contained" disabled={readOnly || busy} onClick={() => void save(true)}>
          SAVE AND RUN
        </Button>
        <Button variant="outlined" disabled={readOnly || busy} onClick={() => void save(false)}>
          Save
        </Button>
        <Button onClick={() => (dirty ? setLeave(true) : router.push(`${base}?tab=offline`))}>Cancel</Button>
      </Box>

      {chooser ? (
        <FieldChooser
          open
          title={chooser === 'dimensions' ? 'Dimensions' : 'Metrics'}
          fields={chooser === 'dimensions' ? dims : mets}
          selected={chooser === 'dimensions' ? dimensions : metrics}
          onClose={() => setChooser(null)}
          onApply={(keys) => {
            (chooser === 'dimensions' ? touch(setDimensions) : touch(setMetrics))(keys);
            setChooser(null);
          }}
        />
      ) : null}
      <DvUnsavedChangesModal open={leave} onContinue={() => setLeave(false)} onDiscard={() => router.push(`${base}?tab=offline`)} />
      {share && id ? <ShareDialog open reportId={id} reportName={name} onClose={() => setShare(false)} /> : null}
    </Box>
  );
}
