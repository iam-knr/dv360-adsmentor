'use client';

// Offline report builder, the classic form (module 16 S4): properties, setup, schedule, delivery, footer buttons.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { DvIcon } from '@/components/icons';
import {
  DvBanner,
  DvModal,
  DvSelect,
  DvTextField,
  DvUnsavedChangesModal,
  useToast,
} from '@/components/dv';
import { FIELD_BY_KEY } from '@/lib/reporting/catalogue';
import { runReportAction, saveReportAction } from '@/lib/reporting/actions';
import { ruleCompatibility } from '@/lib/reporting/engine/rules';
import type { FieldView, PageContext } from '@/lib/reporting/service';
import { OFFLINE_TEMPLATES } from '@/lib/reporting/templates';
import type { OfflineTypeWire, ReportDefinition, ReportDelivery, ReportSchedule } from '@/lib/reporting/types';
import { partnerPath } from '@/lib/routes/paths';
import { scheduleSummary } from '@/lib/reporting/schedule';
import { OFFLINE_ZONES, formatOfflineRange, fromUs, toUs, zoneLabel } from '@/lib/reporting/format';
import { DEFAULT_DELIVERY, REPEATS } from './ScheduleDialog';
import { resolveRange } from './ReportDateRange';
import { addDaysIso } from '@/lib/metrics/date-range';
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
  publicId?: string;
  ownerEmail: string;
}

export function OfflineBuilder(props: OfflineBuilderProps) {
  const { partnerId, partnerName, offlineType, fields, ctx, publicId, ownerEmail } = props;
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
    props.initial.schedule ?? {
      active: false,
      timeZone: 'America/Los_Angeles',
      repeats: 'DAILY',
      every: 1,
      starts: ctx.today,
      expires: addDaysIso(ctx.today, 90),
    },
  );
  const [startsText, setStartsText] = useState(toUs(schedule.starts));
  const [expiresText, setExpiresText] = useState(schedule.expires ? toUs(schedule.expires) : '');
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
  const [advMenu, setAdvMenu] = useState<HTMLElement | null>(null);
  const rangeOptions = RANGES.map(([value, l]) => {
    const r = resolveRange(value, ctx.today);
    return { value, label: r ? formatOfflineRange(l, r.from, r.to) : l };
  });
  const pill = (text: string, kind: 'green' | 'blue', extra?: { onDelete?: () => void }) => (
    <Chip
      key={text}
      size="small"
      label={text}
      sx={{
        borderRadius: '14px',
        color: '#fff',
        bgcolor: kind === 'green' ? '#188038' : '#1a73e8',
        '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.8)' },
      }}
      {...(extra?.onDelete ? { onDelete: extra.onDelete } : {})}
    />
  );
  const section = (title: string, children: React.ReactNode) => (
    <Box sx={{ display: 'flex', gap: 4, py: 2, flexWrap: 'wrap' }}>
      <Typography variant="body2" sx={{ width: 150, fontWeight: 500, color: 'text.secondary' }}>
        {title}
      </Typography>
      <Box sx={{ flex: 1, minWidth: 280 }}>{children}</Box>
    </Box>
  );

  return (
    <Box
      sx={{ bgcolor: '#f1f3f4', mx: -4, mt: -4, mb: -4, px: 4, py: 3, minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}
      data-testid="offline-page"
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
        <Link
          component="button"
          underline="hover"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}
          onClick={() => (dirty ? setLeave(true) : router.push(`${base}?tab=offline`))}
        >
          <DvIcon name="arrow_back" size={16} /> Return to Offline Report List
        </Link>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ textAlign: 'right' }} data-testid="offline-ids">
          <Typography variant="body2">ID: {publicId ?? '-'}</Typography>
          <Typography variant="body2">Report type: {TYPE_LABEL[offlineType]}</Typography>
        </Box>
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

      <Box sx={{ bgcolor: '#fff', border: '1px solid', borderColor: 'divider', px: 3, py: 1 }}>
        {section(
          'Date range',
          <Box sx={{ maxWidth: 420 }}>
            <DvSelect
              ariaLabel="Date range"
              value={RANGES.some(([v]) => v === dateRange) ? dateRange : 'LAST_7_DAYS'}
              disabled={readOnly}
              onChange={touch(setDateRange)}
              options={rangeOptions}
            />
          </Box>,
        )}
        {section(
          'Language formatting',
          <Box sx={{ maxWidth: 420 }}>
            <DvSelect
              ariaLabel="Language formatting"
              value="en-raw"
              disabled={readOnly}
              onChange={() => undefined}
              options={[{ value: 'en-raw', label: 'English (raw)' }]}
            />
            <Typography variant="caption" color="text.secondary">
              Numbers are displayed without commas or currency symbols.
            </Typography>
          </Box>,
        )}
      </Box>

      <Box sx={{ bgcolor: '#fff', border: '1px solid', borderColor: 'divider', px: 3, py: 1 }}>
        {section(
          'Report template',
          <Box sx={{ maxWidth: 420 }}>
            <DvSelect
              label="Report template"
              value={template}
              disabled={readOnly}
              placeholder="Choose a template"
              onChange={loadTemplate}
              options={templates.map((t) => ({ value: t.key, label: t.title }))}
              hint="Choose a template to load reports with commonly prefilled settings"
            />
          </Box>,
        )}
        {section(
          'Filters',
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }} data-testid="offline-filters">
            {pill(`Partner: ${partnerName} (${partnerId})`, 'green')}
            {advertisers.length === 0 ? pill('Advertiser', 'green') : null}
            {advertisers.map((a) =>
              pill(`Advertiser: ${advOptions.find((o) => o.value === a)?.label ?? a}`, 'green', {
                ...(readOnly ? {} : { onDelete: () => touch(setAdvertisers)(advertisers.filter((x) => x !== a)) }),
              }),
            )}
            <Button size="small" disabled={readOnly} onClick={(e) => setAdvMenu(e.currentTarget)}>
              + add filter
            </Button>
            <Menu anchorEl={advMenu} open={!!advMenu} onClose={() => setAdvMenu(null)}>
              {advOptions.map((o) => (
                <MenuItem
                  key={o.value}
                  disabled={advertisers.includes(o.value)}
                  onClick={() => {
                    setAdvMenu(null);
                    touch(setAdvertisers)([...advertisers, o.value]);
                  }}
                >
                  Advertiser: {o.label}
                </MenuItem>
              ))}
            </Menu>
          </Box>,
        )}
        {section(
          'Dimensions',
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }} data-testid="offline-dimensions">
            {dimensions.map((k) => pill(label(k), 'green'))}
            <Button size="small" disabled={readOnly} onClick={() => setChooser('dimensions')}>
              + add / remove
            </Button>
          </Box>,
        )}
        {section(
          'Metrics',
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }} data-testid="offline-metrics">
            {metrics.map((k) => pill(label(k), 'blue'))}
            <Button size="small" disabled={readOnly} onClick={() => setChooser('metrics')}>
              + add / remove
            </Button>
          </Box>,
        )}
      </Box>

      <Box sx={{ bgcolor: '#fff', border: '1px solid', borderColor: 'divider', px: 3, py: 1 }}>
        {section(
          'Schedule',
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 420 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={schedule.active}
                  disabled={readOnly}
                  onChange={(e) => touch(setSchedule)({ ...schedule, active: e.target.checked })}
                />
              }
              label="Active"
            />
            <DvSelect
              label="Time zone"
              value={schedule.timeZone}
              disabled={readOnly || !schedule.active}
              onChange={(v) => touch(setSchedule)({ ...schedule, timeZone: v })}
              options={
                OFFLINE_ZONES.some((z) => z.value === schedule.timeZone)
                  ? OFFLINE_ZONES
                  : [...OFFLINE_ZONES, { value: schedule.timeZone, label: schedule.timeZone }]
              }
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <DvSelect
                label="Repeats"
                value={schedule.repeats}
                disabled={readOnly || !schedule.active}
                onChange={(v) => touch(setSchedule)({ ...schedule, repeats: v as ReportSchedule['repeats'] })}
                options={REPEATS}
              />
              <DvTextField
                label="Every"
                type="number"
                value={String(schedule.every)}
                disabled={readOnly || !schedule.active}
                onChange={(v) => touch(setSchedule)({ ...schedule, every: Math.max(0, Number(v) || 0) })}
                {...(errors['schedule.every'] ? { error: errors['schedule.every'] } : {})}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <DvTextField
                label="Starts"
                placeholder="MM/DD/YYYY"
                value={startsText}
                disabled={readOnly || !schedule.active}
                onChange={(v) => {
                  setStartsText(v);
                  touch(setSchedule)({ ...schedule, starts: fromUs(v) });
                }}
              />
              <DvTextField
                label="Expires"
                placeholder="MM/DD/YYYY"
                value={expiresText}
                disabled={readOnly || !schedule.active}
                onChange={(v) => {
                  setExpiresText(v);
                  const { expires: _drop, ...rest } = schedule;
                  void _drop;
                  touch(setSchedule)(v ? { ...rest, expires: fromUs(v) } : rest);
                }}
                {...(errors['schedule.expires'] ? { error: errors['schedule.expires'] } : {})}
              />
            </Box>
            <Typography variant="body2" data-testid="schedule-summary">
              {scheduleSummary(schedule, { tzLabel: zoneLabel(schedule.timeZone), date: toUs })}
            </Typography>
          </Box>,
        )}
        {section(
          'Delivery',
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 420 }}>
            <DvSelect
              label="Format"
              value={delivery.format}
              disabled={readOnly}
              onChange={(v) => touch(setDelivery)({ ...delivery, format: v as ReportDelivery['format'] })}
              options={[
                { value: 'CSV', label: 'CSV' },
                { value: 'XLSX', label: 'Excel' },
              ]}
            />
            <DvTextField
              label="File name"
              value={delivery.fileName}
              readOnly={readOnly}
              onChange={(v) => touch(setDelivery)({ ...delivery, fileName: v })}
              hint="The date and time are added to the name."
              {...(errors['delivery.fileName'] ? { error: errors['delivery.fileName'] } : {})}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={delivery.emailOwner}
                  disabled={readOnly}
                  onChange={(e) => touch(setDelivery)({ ...delivery, emailOwner: e.target.checked })}
                />
              }
              label={`Email owner (${ownerEmail})`}
            />
            {delivery.emailOwner ? (
              <DvSelect
                label="Attachment"
                value={delivery.attachment === false ? 'link' : 'file'}
                disabled={readOnly}
                onChange={(v) => touch(setDelivery)({ ...delivery, attachment: v === 'file' })}
                options={[
                  { value: 'file', label: 'Attach file' },
                  { value: 'link', label: 'Link only' },
                ]}
              />
            ) : null}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2">Share with:</Typography>
              <Button
                size="small"
                disabled={readOnly || !id}
                title={id ? undefined : 'Save the report first'}
                onClick={() => setShare(true)}
              >
                + add people
              </Button>
            </Box>
          </Box>,
        )}
      </Box>

      <DvBanner kind="info" action={{ label: 'OPEN IN INSTANT REPORTING', onClick: openInInstant }}>
        You can also access this report as an Instant Report.
      </DvBanner>

      <Box sx={{ display: 'flex', gap: 3, pb: 2 }}>
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
