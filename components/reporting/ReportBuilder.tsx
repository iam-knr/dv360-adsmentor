'use client';

// Instant report builder (module 16 S2): toolbar, filter bar, canvas, right panel with visualisation, drop zones and
// the field picker. State is one `Model`; undo and redo keep a stack of earlier models.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { resolveField, unknownFieldMessage } from '@/lib/reporting/field-match';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Link from '@mui/material/Link';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { colors } from '@/lib/theme/tokens';
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
import { incompatibleWith } from '@/lib/reporting/engine/compat';
import { ruleCompatibility, ruleName, ruleViz } from '@/lib/reporting/engine/rules';
import {
  generateReportAction,
  queryReportAction,
  runReportAction,
  saveReportAction,
  saveReportAsAction,
} from '@/lib/reporting/actions';
import type { FieldView, PageContext } from '@/lib/reporting/service';
import { DEFAULT_DELIVERY, ScheduleDialog } from './ScheduleDialog';
import type {
  QueryResult,
  ReportDefinition,
  ReportDelivery,
  ReportFilter,
  ReportSchedule,
  RuleIssue,
  VizType,
} from '@/lib/reporting/types';
import { partnerPath } from '@/lib/routes/paths';
import { DRAG_TYPE, FieldPicker } from './FieldPicker';
import { ReportCanvas } from './ReportCanvas';
import { ReportDateRange } from './ReportDateRange';
import { EmptyIllustration } from './EmptyIllustration';
import { ShareDialog } from './ShareDialog';

type Model = Pick<
  ReportDefinition,
  'name' | 'timeZone' | 'dateRange' | 'filters' | 'dimensions' | 'metrics' | 'viz'
>;

export interface ReportBuilderProps {
  partnerId: string;
  partnerName: string;
  fields: FieldView[];
  initial: ReportDefinition;
  reportId?: string;
  version?: number;
  /** Open for reading only: the viewer cannot change this report. */
  readOnly: boolean;
  ctx: Pick<PageContext, 'today' | 'entityOptions' | 'hourlyDays'>;
  skipped?: number;
}

const VIZ: { value: VizType; label: string }[] = [
  { value: 'TABLE', label: 'Flat table' },
  { value: 'PIVOT_TABLE', label: 'Pivot table' },
  { value: 'COLUMN', label: 'Column chart' },
  { value: 'TIME_SERIES', label: 'Time series chart' },
  { value: 'PIE', label: 'Pie chart' },
  { value: 'SCATTER', label: 'Scatter chart' },
];

const TOUR = [
  'Pick the metrics and dimensions you need from the list on the right. Drag them into the zones or press +.',
  'Choose the date range and time zone, and add filters if you want fewer rows.',
  'Press Run report to see a preview. Switch on Auto-run to refresh it after every change.',
  'Download gives you the full file as CSV or Excel. Save keeps the report so you can schedule it.',
];

const toModel = (d: ReportDefinition): Model => ({
  name: d.name,
  timeZone: d.timeZone,
  dateRange: d.dateRange,
  filters: d.filters,
  dimensions: d.dimensions,
  metrics: d.metrics,
  viz: d.viz,
});

export function ReportBuilder(props: ReportBuilderProps) {
  const { partnerId, partnerName, fields, ctx } = props;
  const router = useRouter();
  const toast = useToast();
  const readOnly = props.readOnly;
  const base = partnerPath(partnerId, 'reporting');

  const [model, setModel] = useState<Model>(toModel(props.initial));
  const [saved, setSaved] = useState<Model>(toModel(props.initial));
  const past = useRef<Model[]>([]);
  const future = useRef<Model[]>([]);
  const [, bump] = useState(0);
  const [id, setId] = useState(props.reportId);
  const [version, setVersion] = useState(props.version);
  const [schedule, setSchedule] = useState<ReportSchedule | undefined>(props.initial.schedule);
  const [delivery, setDelivery] = useState<ReportDelivery | undefined>(props.initial.delivery);
  const [autoRun, setAutoRun] = useState(!!props.initial.autoRun);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [issues, setIssues] = useState<RuleIssue[]>([]);
  const [filterBar, setFilterBar] = useState(true);
  const [showDownloadOnly, setShowDownloadOnly] = useState(false);
  const [dialog, setDialog] = useState<null | 'schedule' | 'share' | 'bulk' | 'saveAs' | 'tour' | 'leave' | 'addFilter' | 'custom'>(null);
  const [download, setDownload] = useState<HTMLElement | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [genText, setGenText] = useState('');
  const [genOpen, setGenOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | undefined>();
  const runToken = useRef(0);

  const dirty = JSON.stringify(model) !== JSON.stringify(saved);
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  // A definition handed over by the hub's Generate report card.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('generated') !== '1') return;
    try {
      const raw = sessionStorage.getItem('dv.report.generated');
      if (raw) {
        sessionStorage.removeItem('dv.report.generated');
        apply(toModel(JSON.parse(raw) as ReportDefinition));
      }
      const notice = sessionStorage.getItem('dv.report.notice');
      if (notice) {
        sessionStorage.removeItem('dv.report.notice');
        setNotice(notice);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = useCallback((next: Model) => {
    setModel((cur) => {
      past.current.push(cur);
      if (past.current.length > 50) past.current.shift();
      future.current = [];
      return next;
    });
    bump((n) => n + 1);
  }, []);
  const patch = (p: Partial<Model>) => apply({ ...model, ...p });
  const undo = () => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(model);
    setModel(prev);
    bump((n) => n + 1);
  };
  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(model);
    setModel(next);
    bump((n) => n + 1);
  };

  const selected = useMemo(() => [...model.dimensions, ...model.metrics], [model.dimensions, model.metrics]);
  const incompatible = useMemo(() => incompatibleWith(selected), [selected]);
  const byKey = useMemo(() => new Map(fields.map((f) => [f.key, f])), [fields]);

  const definition = useCallback(
    (): ReportDefinition => ({
      ...(id ? { id } : {}),
      kind: 'INSTANT',
      ...model,
      autoRun,
      ...(props.initial.template ? { template: props.initial.template } : {}),
      ...(schedule ? { schedule } : {}),
      ...(delivery ? { delivery } : {}),
    }),
    [id, model, autoRun, props.initial.template, schedule, delivery],
  );

  const localIssues = useMemo(
    () => [...ruleName(model.name), ...ruleCompatibility(model.dimensions, model.metrics), ...ruleViz({ ...definition() })],
    [model, definition],
  );
  const nameError = localIssues.find((i) => i.path === 'name')?.message;
  const canRun = model.metrics.length > 0 && localIssues.every((i) => i.severity !== 'error');

  const addField = (key: string) => {
    if (readOnly || selected.includes(key)) return;
    const f = FIELD_BY_KEY.get(key);
    if (!f) return;
    const reason = incompatible[key];
    if (reason) {
      setError(reason);
      return;
    }
    patch(f.kind === 'DIMENSION' ? { dimensions: [...model.dimensions, key] } : { metrics: [...model.metrics, key] });
  };
  const removeField = (key: string) => {
    const opts = model.viz.options?.columns === key ? { options: undefined } : {};
    const viz = { ...model.viz, ...opts };
    if (opts.options === undefined && model.viz.options?.columns === key) delete viz.options;
    patch({
      dimensions: model.dimensions.filter((k) => k !== key),
      metrics: model.metrics.filter((k) => k !== key),
      viz,
    });
  };
  const moveField = (zone: 'dimensions' | 'metrics', from: number, to: number) => {
    const list = [...model[zone]];
    const [x] = list.splice(from, 1);
    if (x === undefined) return;
    list.splice(to, 0, x);
    patch({ [zone]: list });
  };

  const preview = useCallback(async (def: ReportDefinition): Promise<boolean> => {
    const token = ++runToken.current;
    setRunning(true);
    setError(undefined);
    setIssues([]);
    const res = await queryReportAction(partnerId, def);
    if (token !== runToken.current) return false;
    setRunning(false);
    if (!res.ok) {
      setError(res.issues[0]?.message ?? 'The report could not be run.');
      setResult(null);
      return false;
    }
    setResult(res.data);
    return true;
  }, [partnerId]);

  const runReport = async () => {
    if (!canRun || readOnly) return;
    const def = definition();
    const ok = await preview(def);
    if (!ok) return;
    const res = await runReportAction(partnerId, { ...(id ? { reportId: id } : {}), definition: def });
    if (!res.ok) {
      setError(res.issues[0]?.message ?? 'The file could not be created.');
      return;
    }
    if (!id) {
      setId(res.data.reportId);
      setSaved(model);
    }
    toast.show({ kind: 'neutral', message: 'Report ready. Open Files to download it.' });
  };

  // Auto-run: refresh the preview shortly after the last change.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!autoRun || !canRun) return;
    const t = setTimeout(() => void preview(definition()), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, autoRun]);

  const save = async () => {
    const errs = [...ruleName(model.name)];
    if (errs.length) {
      setIssues(errs);
      return;
    }
    setBusy(true);
    const res = await saveReportAction(partnerId, definition(), version !== undefined ? { expectedVersion: version } : {});
    setBusy(false);
    if (!res.ok) {
      setError(res.issues[0]?.message ?? 'The report could not be saved.');
      return;
    }
    setSaved(model);
    setVersion(res.data.version);
    if (!id) {
      setId(res.data.id);
      router.replace(`${base}/instant/${res.data.id}`);
    }
    toast.show({ kind: 'neutral', message: 'Report saved' });
  };

  const [copyName, setCopyName] = useState('');
  const saveAs = async () => {
    if (!id) {
      // an unsaved report: saving under a new name is a normal save
      const res = await saveReportAction(partnerId, { ...definition(), name: copyName });
      if (res.ok) router.push(`${base}/instant/${res.data.id}`);
      else setError(res.issues[0]?.message ?? 'The report could not be saved.');
      setDialog(null);
      return;
    }
    const res = await saveReportAsAction(partnerId, id, copyName);
    setDialog(null);
    if (!res.ok) setError(res.issues[0]?.message ?? 'The report could not be copied.');
    else router.push(`${base}/instant/${res.data.id}`);
  };

  const downloadFile = async (format: 'CSV' | 'XLSX') => {
    setDownload(null);
    const res = await fetch('/api/dv/reports/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partner: partnerId, definition: definition(), format }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { issues?: { message: string }[] } | null;
      setError(body?.issues?.[0]?.message ?? 'The file could not be created.');
      return;
    }
    const blob = await res.blob();
    const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'report';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const reset = () => {
    apply(props.initial.id ? saved : { ...toModel(props.initial), dimensions: [], metrics: [] });
    setResult(null);
  };

  // ---- bulk edit ------------------------------------------------------------------------------------------------
  const [bulkDims, setBulkDims] = useState('');
  const [bulkMets, setBulkMets] = useState('');
  const [bulkErr, setBulkErr] = useState<string | undefined>();
  const openBulk = () => {
    setBulkDims(model.dimensions.map((k) => byKey.get(k)?.label ?? k).join('\n'));
    setBulkMets(model.metrics.map((k) => byKey.get(k)?.label ?? k).join('\n'));
    setBulkErr(undefined);
    setDialog('bulk');
  };
  const parseBulk = (text: string, kind: 'DIMENSION' | 'METRIC'): { keys: string[]; bad: string[] } => {
    const keys: string[] = [];
    const bad: string[] = [];
    for (const line of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
      const f = resolveField(line, fields, kind);
      if (f) {
        if (!keys.includes(f.key)) keys.push(f.key);
      } else bad.push(line);
    }
    return { keys, bad };
  };
  const applyBulk = () => {
    const d = parseBulk(bulkDims, 'DIMENSION');
    const m = parseBulk(bulkMets, 'METRIC');
    if (d.bad.length || m.bad.length) {
      setBulkErr(
        [
          d.bad.length ? unknownFieldMessage(d.bad, fields, 'DIMENSION') : '',
          m.bad.length ? unknownFieldMessage(m.bad, fields, 'METRIC') : '',
        ]
          .filter(Boolean)
          .join(' '),
      );
      return;
    }
    const blocked = ruleCompatibility(d.keys, m.keys);
    if (blocked.length) {
      setBulkErr(blocked[0]?.message);
      return;
    }
    patch({ dimensions: d.keys, metrics: m.keys });
    setDialog(null);
  };

  // ---- filters --------------------------------------------------------------------------------------------------
  const [fField, setFField] = useState('advertiser');
  const [fOp, setFOp] = useState<ReportFilter['op']>('IN');
  const [fValues, setFValues] = useState<string[]>([]);
  const [fText, setFText] = useState('');
  const filterable = fields.filter(
    (f) => f.kind === 'DIMENSION' && !f.downloadOnly && f.key !== 'partner' && f.dataType !== 'DATE',
  );
  const addFilter = () => {
    const values = ctx.entityOptions[fField] ? fValues : fText.split(',').map((s) => s.trim()).filter(Boolean);
    if (!values.length) return;
    patch({ filters: [...model.filters, { field: fField, op: fOp, values }] });
    setFValues([]);
    setFText('');
    setDialog(null);
  };
  const filterChip = (f: ReportFilter) => {
    const label = byKey.get(f.field)?.label ?? f.field;
    if (f.field === 'partner') return `${label} includes ${partnerName} (${f.values[0] ?? ''})`;
    const names = f.values.map((v) => ctx.entityOptions[f.field]?.find((o) => o.value === v)?.label ?? v);
    return `${label} ${f.op === 'NOT_IN' ? 'excludes' : 'includes'} ${names.join(', ')}`;
  };

  const dimOptions = model.dimensions.map((k) => ({ value: k, label: byKey.get(k)?.label ?? k }));
  const pivotKey = model.viz.options?.columns ?? '';

  const zone = (kind: 'dimensions' | 'metrics') => {
    const list = model[kind];
    const title = kind === 'dimensions' ? 'DIMENSIONS (ROW)' : 'METRICS (COLUMN)';
    return (
      <Box
        data-testid={`zone-${kind}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const key = e.dataTransfer.getData(DRAG_TYPE);
          if (!key) return;
          const f = FIELD_BY_KEY.get(key);
          if (f && (f.kind === 'DIMENSION') === (kind === 'dimensions')) addField(key);
          else if (f) setError(`${f.label} belongs in the ${f.kind === 'DIMENSION' ? 'dimensions' : 'metrics'} zone.`);
        }}
        sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: '8px', p: 2, minHeight: 64 }}
      >
        <Typography variant="panelOverline" component="div">
          {title}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
          {list.map((k, i) => (
            <Chip
              key={k}
              size="small"
              data-testid={`zone-chip-${k}`}
              draggable={!readOnly}
              onDragStart={(e) => e.dataTransfer.setData('text/plain', `${kind}:${i}`)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const [z, from] = e.dataTransfer.getData('text/plain').split(':');
                if (z === kind && from !== undefined) {
                  e.stopPropagation();
                  moveField(kind, Number(from), i);
                }
              }}
              label={byKey.get(k)?.label ?? k}
              {...(readOnly ? {} : { onDelete: () => removeField(k) })}
            />
          ))}
          {list.length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              Drag fields here or press + in the list.
            </Typography>
          ) : null}
        </Box>
      </Box>
    );
  };

  const leave = () => {
    if (dirty) setDialog('leave');
    else router.push(base);
  };

  const [panelOpen, setPanelOpen] = useState(true);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <Box
        sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap', bgcolor: colors.surface.sunken, px: 3, py: 1, mx: -4, mt: -4 }}
        data-testid="builder-header"
      >
        <Link component="button" underline="hover" onClick={leave} sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
          <DvIcon name="arrow_back" size={16} /> Return to Instant Report List
        </Link>
        <Box sx={{ flex: 1 }} />
        <Button variant="text" size="small" onClick={() => setDialog('tour')}>
          Guided tour
        </Button>
      </Box>

      <Box
        sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
        role="toolbar"
        aria-label="Report actions"
      >
        {editingName && !readOnly ? (
          <Box
            sx={{ width: 320 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLElement).blur();
            }}
          >
            <DvTextField
              ariaLabel="Report name"
              value={model.name}
              onChange={(v) => patch({ name: v })}
              onBlur={() => {
                setEditingName(false);
                setIssues(ruleName(model.name));
              }}
              {...(nameError ? { error: nameError } : {})}
            />
          </Box>
        ) : (
          <>
            <Typography variant="cardTitle" component="h1" data-testid="report-title">
              {model.name || 'Untitled Report'}
            </Typography>
            {!readOnly ? (
              <IconButton aria-label="Rename report" size="small" onClick={() => setEditingName(true)}>
                <DvIcon name="edit" size={18} />
              </IconButton>
            ) : null}
          </>
        )}
        {readOnly ? <Chip size="small" label="Read only" /> : null}
        <Box sx={{ flex: 1 }} />
        <IconButton
          aria-label="Schedule"
          disabled={readOnly || !id}
          onClick={() => setDialog('schedule')}
          title={id ? 'Schedule' : 'Save the report first'}
        >
          <DvIcon name="schedule" />
        </IconButton>
        <IconButton aria-label="Bulk edit" title="Bulk edit" disabled={readOnly} onClick={openBulk}>
          <DvIcon name="checklist" />
        </IconButton>
        <Button size="small" disabled={readOnly} onClick={reset}>
          Reset
        </Button>
        <Button size="small" disabled={readOnly || busy} variant="outlined" onClick={() => void save()}>
          Save
        </Button>
        <Button
          size="small"
          disabled={readOnly}
          onClick={() => {
            setCopyName(`${model.name} (copy)`);
            setDialog('saveAs');
          }}
        >
          Save as
        </Button>
        {id && !readOnly ? (
          <Button size="small" onClick={() => setDialog('share')}>
            Share
          </Button>
        ) : null}
        <FormControlLabel
          control={<Switch size="small" checked={autoRun} disabled={readOnly} onChange={(e) => setAutoRun(e.target.checked)} />}
          label="Auto-run"
        />
        <Button
          variant="contained"
          size="small"
          disabled={readOnly || !canRun || running}
          onClick={() => void runReport()}
          startIcon={<DvIcon name="refresh" />}
        >
          Run report
        </Button>
        <Button size="small" onClick={(e) => setDownload(e.currentTarget)} startIcon={<DvIcon name="download" />} disabled={!canRun}>
          Download
        </Button>
        <Menu anchorEl={download} open={!!download} onClose={() => setDownload(null)}>
          <MenuItem onClick={() => void downloadFile('CSV')}>CSV</MenuItem>
          <MenuItem onClick={() => void downloadFile('XLSX')}>Excel</MenuItem>
        </Menu>
      </Box>
      {nameError && !editingName && issues.length ? (
        <Typography variant="caption" color="error">
          {nameError}
        </Typography>
      ) : null}
      {running ? <LinearProgress aria-label="Running" /> : null}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', py: 1 }}>
        <IconButton aria-label="Undo" disabled={readOnly || past.current.length === 0} onClick={undo}>
          <DvIcon name="undo" />
        </IconButton>
        <IconButton aria-label="Redo" disabled={readOnly || future.current.length === 0} onClick={redo}>
          <DvIcon name="redo" />
        </IconButton>
        <Box sx={{ width: 210 }}>
          <DvSelect
            ariaLabel="Time zone"
            value={model.timeZone}
            disabled={readOnly}
            onChange={(v) => patch({ timeZone: v as Model['timeZone'] })}
            options={[
              { value: 'ADVERTISER', label: 'Time zone: Advertiser' },
              { value: 'UTC', label: 'Time zone: UTC' },
            ]}
          />
        </Box>
        <ReportDateRange value={model.dateRange} today={ctx.today} disabled={readOnly} onChange={(v) => patch({ dateRange: v })} />
        <IconButton aria-label="Filter" aria-pressed={filterBar} disabled={readOnly} onClick={() => setFilterBar((o) => !o)}>
          <DvIcon name="filter_alt" />
        </IconButton>
        <Box sx={{ flex: 1 }} />
        <IconButton
          aria-label={panelOpen ? 'Collapse panel' : 'Expand panel'}
          onClick={() => setPanelOpen((o) => !o)}
        >
          <DvIcon name={panelOpen ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left'} />
        </IconButton>
      </Box>

      {filterBar ? (
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', pb: 1 }} data-testid="filter-bar">
          {model.filters.map((f, i) => (
            <Chip
              key={i}
              size="small"
              label={filterChip(f)}
              {...(f.field === 'partner' || readOnly
                ? {}
                : { onDelete: () => patch({ filters: model.filters.filter((_, j) => j !== i) }) })}
            />
          ))}
          <Button size="small" disabled={readOnly} onClick={() => setDialog('addFilter')}>
            Add
          </Button>
          {model.filters.length > 1 && !readOnly ? (
            <Button size="small" onClick={() => patch({ filters: model.filters.filter((f) => f.field === 'partner') })}>
              Delete all
            </Button>
          ) : null}
        </Box>
      ) : null}

      {notice ? (
        <DvBanner kind="warning" onDismiss={() => setNotice(undefined)}>
          {notice}
        </DvBanner>
      ) : null}
      {error ? (
        <DvBanner
          kind="error"
          onDismiss={() => setError(undefined)}
          {...(canRun ? { action: { label: 'Retry', onClick: () => void preview(definition()) } } : {})}
        >
          {error}
        </DvBanner>
      ) : null}
      {localIssues
        .filter((i) => i.ruleId === 'RPT-011' || i.ruleId === 'RPT-015')
        .map((i) => (
          <DvBanner key={`${i.ruleId}-${i.path}`} kind="warning">
            {i.message}
          </DvBanner>
        ))}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: panelOpen ? 'minmax(0, 1fr) 340px' : 'minmax(0, 1fr)' },
          gap: 4,
          mt: 2,
        }}
      >
        <Box sx={{ minHeight: 320, border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 4 }}>
          {result ? (
            <ReportCanvas result={result} viz={model.viz.type} pivotKey={pivotKey} />
          ) : (
            <Box data-testid="canvas-empty" sx={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Box sx={{ flex: 1, minWidth: 260 }}>
                <Typography variant="cardTitle" component="h2">
                  Build an instant report
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  To build a report, select filters, metrics, dimensions, and a date range.
                </Typography>
                <Box component="ul" sx={{ mt: 2, pl: 5, color: 'text.secondary' }}>
                  <li>
                    <b>Run report:</b> Press Run report to see a preview.
                  </li>
                  <li>
                    <b>Auto-run:</b> Switch on Auto-run to refresh the preview after every change.
                  </li>
                  <li>
                    <b>Direct download:</b> Use Download to get the full file directly.
                  </li>
                </Box>
              </Box>
              <EmptyIllustration />
            </Box>
          )}
        </Box>

        {panelOpen ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }} data-testid="builder-panel">
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', px: 2, py: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Button
                  variant="text"
                  size="small"
                  aria-expanded={genOpen}
                  onClick={() => setGenOpen((o) => !o)}
                  endIcon={<DvIcon name={genOpen ? 'expand_less' : 'expand_more'} size={18} />}
                >
                  Generate report
                </Button>
                <Chip size="small" label="BETA" />
              </Box>
              {genOpen ? (
                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <DvTextField
                    ariaLabel="Describe the report you want"
                    placeholder="Describe the report you want"
                    value={genText}
                    onChange={setGenText}
                  />
                  <Box>
                    <Button
                      variant="outlined"
                      disabled={readOnly || !genText.trim()}
                      onClick={() =>
                        void generateReportAction(partnerId, genText).then((g) => {
                          if (g) apply({ ...toModel(g.definition), name: model.name });
                        })
                      }
                    >
                      Generate
                    </Button>
                  </Box>
                </Box>
              ) : null}
            </Box>
            <DvSelect
              ariaLabel="Visualization"
              value={model.viz.type}
              disabled={readOnly}
              onChange={(v) => patch({ viz: { type: v as VizType, ...(v === 'PIVOT_TABLE' && model.viz.options ? { options: model.viz.options } : {}) } })}
              options={VIZ}
            />
            {zone('dimensions')}
            {model.viz.type === 'PIVOT_TABLE' ? (
              <DvSelect
                label="Columns"
                value={pivotKey}
                disabled={readOnly}
                placeholder="Choose a dimension"
                onChange={(v) => patch({ viz: { type: 'PIVOT_TABLE', options: { columns: v } } })}
                options={dimOptions}
              />
            ) : null}
            {zone('metrics')}
            <FieldPicker
              fields={fields}
              selected={selected}
              incompatible={incompatible}
              disabled={readOnly}
              showDownloadOnly={showDownloadOnly}
              onToggleDownloadOnly={() => setShowDownloadOnly((o) => !o)}
              onAdd={addField}
              onCustomData={() => setDialog('custom')}
            />
          </Box>
        ) : null}
      </Box>

      <DvModal
        open={dialog === 'bulk'}
        title="Bulk edit"
        size="md"
        onClose={() => setDialog(null)}
        primary={{ label: 'Apply', onClick: applyBulk }}
        secondary={{ label: 'Cancel', onClick: () => setDialog(null) }}
        {...(bulkErr ? { error: bulkErr } : {})}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <DvTextField label="Dimensions (one per line)" multiline value={bulkDims} onChange={setBulkDims} />
          <DvTextField label="Metrics (one per line)" multiline value={bulkMets} onChange={setBulkMets} />
        </Box>
      </DvModal>

      <DvModal
        open={dialog === 'saveAs'}
        title="Save as"
        onClose={() => setDialog(null)}
        primary={{ label: 'Save', onClick: () => void saveAs() }}
        secondary={{ label: 'Cancel', onClick: () => setDialog(null) }}
      >
        <DvTextField
          label="Report name"
          value={copyName}
          onChange={setCopyName}
          {...(ruleName(copyName)[0] ? { error: ruleName(copyName)[0]?.message } : {})}
        />
      </DvModal>

      <DvModal
        open={dialog === 'addFilter'}
        title="Add filter"
        onClose={() => setDialog(null)}
        primary={{ label: 'Add', onClick: addFilter }}
        secondary={{ label: 'Cancel', onClick: () => setDialog(null) }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <DvSelect
            label="Field"
            searchable
            value={fField}
            onChange={(v) => {
              setFField(v);
              setFValues([]);
            }}
            options={filterable.map((f) => ({ value: f.key, label: f.label, group: f.category }))}
          />
          <DvSelect
            label="Operator"
            value={fOp}
            onChange={(v) => setFOp(v as ReportFilter['op'])}
            options={[
              { value: 'IN', label: 'is in' },
              { value: 'NOT_IN', label: 'is not in' },
              { value: 'EQ', label: 'equals' },
            ]}
          />
          {ctx.entityOptions[fField] ? (
            <Box sx={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {ctx.entityOptions[fField]?.map((o) => (
                <FormControlLabel
                  key={o.value}
                  label={o.label}
                  control={
                    <input
                      type="checkbox"
                      checked={fValues.includes(o.value)}
                      onChange={(e) =>
                        setFValues((cur) => (e.target.checked ? [...cur, o.value] : cur.filter((x) => x !== o.value)))
                      }
                      style={{ marginRight: 8 }}
                    />
                  }
                />
              ))}
            </Box>
          ) : (
            <DvTextField label="Values (comma separated)" value={fText} onChange={setFText} />
          )}
        </Box>
      </DvModal>

      <DvModal
        open={dialog === 'custom'}
        title="Custom data"
        onClose={() => setDialog(null)}
        primary={{ label: 'Close', onClick: () => setDialog(null) }}
      >
        <Typography variant="body2">
          Custom metrics and dimensions are not available in the simulator. Pick fields from the lists on the right.
        </Typography>
      </DvModal>

      <DvModal
        open={dialog === 'tour'}
        title="Guided tour"
        onClose={() => setDialog(null)}
        primary={{ label: 'Got it', onClick: () => setDialog(null) }}
      >
        <Box component="ol" sx={{ pl: 4, m: 0 }}>
          {TOUR.map((t) => (
            <li key={t}>
              <Typography variant="body2">{t}</Typography>
            </li>
          ))}
        </Box>
      </DvModal>

      <DvUnsavedChangesModal open={dialog === 'leave'} onContinue={() => setDialog(null)} onDiscard={() => router.push(base)} />

      {id ? (
        <>
          <ScheduleDialog
            key={dialog === 'schedule' ? 'open' : 'closed'}
            open={dialog === 'schedule'}
            reportId={id}
            reportName={model.name}
            today={ctx.today}
            {...(schedule ? { initialSchedule: schedule } : {})}
            initialDelivery={delivery ?? DEFAULT_DELIVERY(model.name)}
            onClose={() => setDialog(null)}
            onSaved={(s, d) => {
              setSchedule(s);
              setDelivery(d);
            }}
          />
          {dialog === 'share' ? (
            <ShareDialog open reportId={id} reportName={model.name} onClose={() => setDialog(null)} />
          ) : null}
        </>
      ) : null}
      {props.skipped ? (
        <Typography variant="caption" color="text.secondary">
          {props.skipped} runs skipped while the clock was fast-forwarded.
        </Typography>
      ) : null}
    </Box>
  );
}
