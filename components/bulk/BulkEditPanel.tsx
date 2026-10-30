'use client';

// Bulk edit panels (module 11 2.4): Settings, Creative assignment, Inventory and targeting dimensions, in one
// slide-over. Each setting sits behind an "Edit this setting" checkbox; list dimensions take Add / Replace / Remove.
import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Typography from '@mui/material/Typography';
import { DvSelect, DvSlideOver, DvTextField } from '@/components/dv';
import type { BulkEntityKey } from '@/lib/bulk/entities';
import type { BulkParams, BulkTargetingDimension, EditMode, IoSettingsPatch, LiSettingsPatch } from '@/lib/bulk/types';
import { nounFor } from '@/lib/bulk/entities';
import {
  BROWSERS, CARRIER_ISP_EXAMPLES, CATEGORY_OPTIONS, CONNECTION_SPEEDS, DEVICE_TYPES, ENVIRONMENTS, GENDERS,
  HOUSEHOLD_INCOMES, LANGUAGES, OPERATING_SYSTEMS, PARENTAL_STATUSES, POSITION_IN_CONTENT, POSITION_NATIVE,
  POSITION_ON_SCREEN, VIEWABILITY_STEPS, viewabilityLabel, type OptionDef,
} from '@/lib/targeting/options';
import { fetchOptions, type PickItem } from './client';

export type PanelKind = 'settings' | 'creative' | 'targeting';

export interface BulkEditPanelProps {
  open: boolean;
  kind: PanelKind;
  entity: BulkEntityKey;
  count: number;
  advertiserId: string;
  dimension?: BulkTargetingDimension;
  title: string;
  onCancel: () => void;
  /** Returns an error text, or null when the job started. */
  onApply: (params: BulkParams) => Promise<string | null>;
}

function Checklist({ options, value, onChange, label, max = 300 }: { options: readonly { id: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; label: string; max?: number }) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())).slice(0, max), [options, q, max]);
  return (
    <Box role="group" aria-label={label} sx={{ mt: 2 }}>
      <DvTextField label={`Search ${label.toLowerCase()}`} value={q} onChange={setQ} />
      <Box sx={{ maxHeight: 260, overflow: 'auto', mt: 1 }}>
        {shown.map((o) => (
          <FormControlLabel
            key={o.id}
            sx={{ display: 'flex' }}
            control={<Checkbox size="small" checked={value.includes(o.id)} onChange={(e) => onChange(e.target.checked ? [...value, o.id] : value.filter((v) => v !== o.id))} />}
            label={o.label}
          />
        ))}
        {shown.length === 0 ? <Typography variant="caption">No matches</Typography> : null}
      </Box>
    </Box>
  );
}

const asOptions = (list: readonly OptionDef[]) => list.map((o) => ({ id: o.code, label: o.label }));
const sels = (ids: string[]) => ids.map((id) => ({ id, mode: 'INCLUDE' as const }));

function ModeRadio({ mode, onChange, replaceLabel = 'Replace existing' }: { mode: EditMode; onChange: (m: EditMode) => void; replaceLabel?: string }) {
  return (
    <RadioGroup row aria-label="Edit mode" value={mode} onChange={(e) => onChange(e.target.value as EditMode)}>
      <FormControlLabel value="ADD" control={<Radio size="small" />} label="Add to existing" />
      <FormControlLabel value="REPLACE" control={<Radio size="small" />} label={replaceLabel} />
      <FormControlLabel value="REMOVE" control={<Radio size="small" />} label="Remove" />
    </RadioGroup>
  );
}

const PACING_PERIODS = [{ value: 'FLIGHT', label: 'Flight' }, { value: 'DAILY', label: 'Daily' }];
const PACING_TYPES = [{ value: 'EVEN', label: 'Even' }, { value: 'AHEAD', label: 'Ahead' }, { value: 'ASAP', label: 'ASAP' }];
const FREQ_PERIODS = ['MINUTE', 'HOUR', 'DAY', 'WEEK', 'MONTH'].map((p) => ({ value: p, label: p[0] + p.slice(1).toLowerCase() }));
const QUALITY = [
  { value: 'AUTHORIZED_DIRECT_SELLERS', label: 'Authorized direct sellers' },
  { value: 'AUTHORIZED_DIRECT_SELLERS_AND_RESELLERS', label: 'Authorized direct sellers and resellers' },
  { value: 'AUTHORIZED_AND_NON_PARTICIPATING', label: 'Authorized and non-participating publishers' },
];

export function BulkEditPanel(props: BulkEditPanelProps) {
  const { open, kind, entity, count, advertiserId, dimension, title, onCancel, onApply } = props;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<EditMode>('ADD');
  // settings
  const [on, setOn] = useState<Record<string, boolean>>({});
  const [pacing, setPacing] = useState({ period: 'DAILY', type: 'EVEN', amount: '' });
  const [freq, setFreq] = useState({ mode: 'LIMITED', max: '', count: '1', period: 'MONTH' });
  const [bid, setBid] = useState('');
  const [quality, setQuality] = useState('AUTHORIZED_DIRECT_SELLERS_AND_RESELLERS');
  const [code, setCode] = useState('');
  const [flag, setFlag] = useState({ auto: true, creativeOpt: true, optimized: true });
  // pickers and values
  const [items, setItems] = useState<PickItem[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [env, setEnv] = useState({ web: true, app: true });
  const [position, setPosition] = useState({ onScreen: [] as string[], inContent: [] as string[], native: [] as string[] });
  const [view, setView] = useState('');
  const [speed, setSpeed] = useState('ALL');
  const [demo, setDemo] = useState({ gender: [] as string[], parental: [] as string[], income: [] as string[] });
  const [day, setDay] = useState({ preset: 'WEEKDAYS', from: '09:00', to: '17:00' });

  useEffect(() => {
    if (!open) return;
    setError(null);
    const source = kind === 'creative' ? 'creatives' : dimension === 'DEALS' ? 'deals' : dimension === 'DEAL_GROUPS' ? 'dealGroups' : null;
    if (source) void fetchOptions(advertiserId, source).then(setItems);
  }, [open, kind, dimension, advertiserId]);

  const toggle = (k: string) => (
    <FormControlLabel control={<Checkbox size="small" checked={!!on[k]} onChange={(e) => setOn({ ...on, [k]: e.target.checked })} />} label="Edit this setting" />
  );

  const build = (): BulkParams | string => {
    if (kind === 'settings') {
      const patch: IoSettingsPatch & LiSettingsPatch = {};
      if (on.pacing) patch.pacing = { period: pacing.period as 'FLIGHT' | 'DAILY', type: pacing.type as 'EVEN', dailyAmount: pacing.amount === '' ? '' : Number(pacing.amount) };
      if (on.freq)
        patch.frequencyCap = freq.mode === 'LIMITED'
          ? { mode: 'LIMITED', maxImpressions: Number(freq.max), periodCount: Number(freq.count), period: freq.period as 'MONTH' }
          : { mode: freq.mode as 'INHERIT' | 'UNLIMITED' };
      if (on.bid) patch.fixedBid = Number(bid);
      if (on.quality) patch.inventoryQuality = quality;
      if (on.code) patch.integrationCode = code;
      if (on.auto) patch.autoBudgetAllocation = flag.auto;
      if (on.creativeOpt) patch.creativeOptimization = flag.creativeOpt;
      if (on.optimized) patch.optimizedTargeting = flag.optimized;
      if (Object.keys(patch).length === 0) return 'Select a setting to edit.';
      return { op: 'EDIT_SETTINGS', patch };
    }
    if (kind === 'creative') {
      if (picked.length === 0) return 'Select at least one creative.';
      return { op: 'EDIT_CREATIVE_ASSIGNMENT', ...(mode === 'REMOVE' ? { remove: picked } : { add: picked }) };
    }
    const d = dimension!;
    const group = d === 'DEALS' || d === 'DEAL_GROUPS' || d === 'INVENTORY_QUALITY' ? 'INVENTORY' : (['GEOGRAPHY', 'AUDIENCE_LISTS', 'DAY_TIME', 'DEMOGRAPHICS'] as string[]).includes(d) ? 'AUDIENCE' : (['BROWSER', 'DEVICE', 'CONNECTION_SPEED', 'CARRIER_ISP'] as string[]).includes(d) ? 'TECHNOLOGY' : 'CONTENT';
    let value: unknown;
    switch (d) {
      case 'INVENTORY_QUALITY': value = { quality }; break;
      case 'DEALS': case 'DEAL_GROUPS': value = { ids: picked }; break;
      case 'LANGUAGE': case 'CATEGORIES': case 'BROWSER': case 'CARRIER_ISP': case 'GEOGRAPHY': value = { sels: sels(picked) }; break;
      case 'DEVICE': value = { device: { types: sels(picked.filter((p) => DEVICE_TYPES.some((t) => t.code === p))), os: sels(picked.filter((p) => OPERATING_SYSTEMS.some((t) => t.code === p))) } }; break;
      case 'KEYWORDS': value = { keywords: { include: text.split(/[,\n]/).map((k) => k.trim().toLowerCase()).filter(Boolean) } }; break;
      case 'APPS_URLS': value = { appsAndUrls: { urls: sels(text.split(/[,\n]/).map((k) => k.trim()).filter(Boolean)) } }; break;
      case 'AUDIENCE_LISTS': value = { audience: { google: text.split(/[,\n]/).map((k) => k.trim()).filter(Boolean) } }; break;
      case 'ENVIRONMENT': value = { environment: env }; break;
      case 'POSITION': value = { position }; break;
      case 'VIEWABILITY': value = { viewability: { openMeasurement: true, predictedPct: view === '' ? null : Number(view) } }; break;
      case 'CONNECTION_SPEED': value = { connectionSpeed: speed }; break;
      case 'DEMOGRAPHICS': value = { demographics: demo }; break;
      case 'DAY_TIME': {
        const days = day.preset === 'WEEKENDS' ? ['SAT', 'SUN'] : day.preset === 'ALL_DAYS' ? ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] : ['MON', 'TUE', 'WED', 'THU', 'FRI'];
        value = { daySegments: days.map((dd) => ({ day: dd, from: day.from, to: day.to })) };
        break;
      }
    }
    const emptyList = (['LANGUAGE', 'CATEGORIES', 'BROWSER', 'CARRIER_ISP', 'GEOGRAPHY', 'DEVICE', 'DEALS', 'DEAL_GROUPS'] as string[]).includes(d) && picked.length === 0;
    const emptyText = (['KEYWORDS', 'APPS_URLS', 'AUDIENCE_LISTS'] as string[]).includes(d) && text.trim() === '';
    if ((emptyList || emptyText) && mode !== 'REPLACE') return 'Select at least one option.';
    return { op: 'EDIT_TARGETING', edit: { group, dimension: d, mode, value } };
  };

  const apply = async () => {
    const built = build();
    if (typeof built === 'string') return setError(built);
    setBusy(true);
    const err = await onApply(built);
    setBusy(false);
    if (err) setError(err);
  };

  const listDims: Partial<Record<BulkTargetingDimension, readonly { id: string; label: string }[]>> = {
    LANGUAGE: asOptions(LANGUAGES),
    CATEGORIES: asOptions(CATEGORY_OPTIONS),
    BROWSER: asOptions(BROWSERS),
    CARRIER_ISP: CARRIER_ISP_EXAMPLES.map((o) => ({ id: o.code, label: o.label })),
    DEVICE: [...asOptions(DEVICE_TYPES), ...asOptions(OPERATING_SYSTEMS).slice(0, 30)],
    GEOGRAPHY: [],
  };

  const single = dimension && ['ENVIRONMENT', 'POSITION', 'VIEWABILITY', 'CONNECTION_SPEED', 'INVENTORY_QUALITY'].includes(dimension);
  const body = (() => {
    if (kind === 'settings')
      return (
        <Box sx={{ display: 'grid', gap: 3 }}>
          <Box><Typography variant="subtitle2">Pacing</Typography>{toggle('pacing')}
            {on.pacing ? <Box sx={{ display: 'grid', gap: 2 }}>
              <DvSelect label="Pacing period" value={pacing.period} onChange={(v) => setPacing({ ...pacing, period: v })} options={PACING_PERIODS} />
              <DvSelect label="Pacing type" value={pacing.type} onChange={(v) => setPacing({ ...pacing, type: v })} options={PACING_TYPES} />
              <DvTextField label="Daily amount" type="number" value={pacing.amount} onChange={(v) => setPacing({ ...pacing, amount: v })} />
            </Box> : null}</Box>
          <Box><Typography variant="subtitle2">Frequency cap</Typography>{toggle('freq')}
            {on.freq ? <Box sx={{ display: 'grid', gap: 2 }}>
              <DvSelect label="Frequency mode" value={freq.mode} onChange={(v) => setFreq({ ...freq, mode: v })} options={[{ value: 'LIMITED', label: 'Limit exposures' }, { value: 'INHERIT', label: 'Use higher level cap' }, { value: 'UNLIMITED', label: 'No limit' }]} />
              {freq.mode === 'LIMITED' ? <>
                <DvTextField label="Exposures" type="number" value={freq.max} onChange={(v) => setFreq({ ...freq, max: v })} />
                <DvTextField label="Every" type="number" value={freq.count} onChange={(v) => setFreq({ ...freq, count: v })} />
                <DvSelect label="Period" value={freq.period} onChange={(v) => setFreq({ ...freq, period: v })} options={FREQ_PERIODS} />
              </> : null}
            </Box> : null}</Box>
          {entity === 'insertionOrder' ? (
            <Box><Typography variant="subtitle2">Automatic budget allocation</Typography>{toggle('auto')}
              {on.auto ? <FormControlLabel control={<Checkbox size="small" checked={flag.auto} onChange={(e) => setFlag({ ...flag, auto: e.target.checked })} />} label="Allocate budget automatically" /> : null}</Box>
          ) : (
            <>
              <Box><Typography variant="subtitle2">Fixed bid</Typography>{toggle('bid')}
                {on.bid ? <DvTextField label="Fixed bid CPM" type="number" value={bid} onChange={setBid} /> : null}</Box>
              <Box><Typography variant="subtitle2">Inventory quality</Typography>{toggle('quality')}
                {on.quality ? <DvSelect label="Inventory quality" value={quality} onChange={setQuality} options={QUALITY} /> : null}</Box>
              <Box><Typography variant="subtitle2">Creative optimization</Typography>{toggle('creativeOpt')}
                {on.creativeOpt ? <FormControlLabel control={<Checkbox size="small" checked={flag.creativeOpt} onChange={(e) => setFlag({ ...flag, creativeOpt: e.target.checked })} />} label="Optimize creatives" /> : null}</Box>
              <Box><Typography variant="subtitle2">Optimized targeting</Typography>{toggle('optimized')}
                {on.optimized ? <FormControlLabel control={<Checkbox size="small" checked={flag.optimized} onChange={(e) => setFlag({ ...flag, optimized: e.target.checked })} />} label="Use optimized targeting" /> : null}</Box>
            </>
          )}
          <Box><Typography variant="subtitle2">Integration code</Typography>{toggle('code')}
            {on.code ? <DvTextField label="Integration code" value={code} onChange={setCode} /> : null}</Box>
        </Box>
      );
    if (kind === 'creative')
      return (
        <>
          <RadioGroup row aria-label="Edit mode" value={mode === 'REMOVE' ? 'REMOVE' : 'ADD'} onChange={(e) => setMode(e.target.value as EditMode)}>
            <FormControlLabel value="ADD" control={<Radio size="small" />} label="Add to line items" />
            <FormControlLabel value="REMOVE" control={<Radio size="small" />} label="Remove from line items" />
          </RadioGroup>
          <Checklist options={items} value={picked} onChange={setPicked} label="Creatives" />
        </>
      );
    if (single)
      return (
        <Box sx={{ display: 'grid', gap: 2 }}>
          {dimension !== 'INVENTORY_QUALITY' ? <RadioGroup row aria-label="Edit mode" value={mode === 'REMOVE' ? 'REMOVE' : 'REPLACE'} onChange={(e) => setMode(e.target.value as EditMode)}>
            <FormControlLabel value="REPLACE" control={<Radio size="small" />} label="Set value" />
            <FormControlLabel value="REMOVE" control={<Radio size="small" />} label="Remove" />
          </RadioGroup> : null}
          {dimension === 'INVENTORY_QUALITY' ? <DvSelect label="Inventory quality" value={quality} onChange={setQuality} options={QUALITY} /> : null}
          {dimension === 'ENVIRONMENT' && mode !== 'REMOVE' ? ENVIRONMENTS.map((e) => (
            <FormControlLabel key={e.code} control={<Checkbox size="small" checked={e.code === 'WEB' ? env.web : env.app} onChange={(ev) => setEnv({ ...env, [e.code === 'WEB' ? 'web' : 'app']: ev.target.checked })} />} label={e.label} />
          )) : null}
          {dimension === 'POSITION' && mode !== 'REMOVE' ? (['onScreen', 'inContent', 'native'] as const).map((k) => (
            <Checklist key={k} label={k === 'onScreen' ? 'On screen' : k === 'inContent' ? 'In content' : 'Native'} options={asOptions(k === 'onScreen' ? POSITION_ON_SCREEN : k === 'inContent' ? POSITION_IN_CONTENT : POSITION_NATIVE)} value={position[k]} onChange={(v) => setPosition({ ...position, [k]: v })} />
          )) : null}
          {dimension === 'VIEWABILITY' && mode !== 'REMOVE' ? <DvSelect label="Predicted viewability" value={view} onChange={setView} options={[{ value: '', label: viewabilityLabel(null) }, ...VIEWABILITY_STEPS.map((s) => ({ value: String(s), label: viewabilityLabel(s) }))]} /> : null}
          {dimension === 'CONNECTION_SPEED' && mode !== 'REMOVE' ? <DvSelect label="Connection speed" value={speed} onChange={setSpeed} options={CONNECTION_SPEEDS.map((o) => ({ value: o.code, label: o.label }))} /> : null}
        </Box>
      );
    // list dimensions
    return (
      <>
        <ModeRadio mode={mode} onChange={setMode} />
        {dimension === 'DEALS' || dimension === 'DEAL_GROUPS' ? <Checklist options={items} value={picked} onChange={setPicked} label={dimension === 'DEALS' ? 'Deals and packages' : 'Deal groups'} /> : null}
        {dimension && listDims[dimension]?.length ? <Checklist options={listDims[dimension]} value={picked} onChange={setPicked} label={title} /> : null}
        {dimension === 'GEOGRAPHY' ? <DvTextField label="Region codes (comma separated)" value={text} onChange={(v) => { setText(v); setPicked(v.split(',').map((x) => x.trim()).filter(Boolean)); }} /> : null}
        {dimension && ['KEYWORDS', 'APPS_URLS', 'AUDIENCE_LISTS'].includes(dimension) ? (
          <DvTextField label={dimension === 'KEYWORDS' ? 'Keywords (comma or new line)' : dimension === 'APPS_URLS' ? 'URLs (comma or new line)' : 'Google audience IDs (comma separated)'} value={text} onChange={setText} multiline />
        ) : null}
        {dimension === 'DEMOGRAPHICS' ? (
          <>
            <Checklist label="Gender" options={asOptions(GENDERS)} value={demo.gender} onChange={(v) => setDemo({ ...demo, gender: v })} />
            <Checklist label="Parental status" options={asOptions(PARENTAL_STATUSES)} value={demo.parental} onChange={(v) => setDemo({ ...demo, parental: v })} />
            <Checklist label="Household income" options={asOptions(HOUSEHOLD_INCOMES)} value={demo.income} onChange={(v) => setDemo({ ...demo, income: v })} />
          </>
        ) : null}
        {dimension === 'DAY_TIME' ? (
          <Box sx={{ display: 'grid', gap: 2, mt: 2 }}>
            <DvSelect label="Days" value={day.preset} onChange={(v) => setDay({ ...day, preset: v })} options={[{ value: 'ALL_DAYS', label: 'All days' }, { value: 'WEEKDAYS', label: 'Mondays-Fridays' }, { value: 'WEEKENDS', label: 'Saturdays-Sundays' }]} />
            <DvTextField label="From (HH:MM)" value={day.from} onChange={(v) => setDay({ ...day, from: v })} />
            <DvTextField label="To (HH:MM)" value={day.to} onChange={(v) => setDay({ ...day, to: v })} />
          </Box>
        ) : null}
      </>
    );
  })();

  return (
    <DvSlideOver
      open={open}
      title={`Edit ${count} ${nounFor(entity, count)}`}
      onCancel={onCancel}
      onApply={() => void apply()}
      applyLabel={busy ? 'Applying…' : 'Apply'}
      applyDisabled={busy}
    >
      <Typography variant="subtitle1" sx={{ mb: 2 }}>{title}</Typography>
      {body}
      {error ? <Typography role="alert" color="error" sx={{ mt: 2 }}>{error}</Typography> : null}
    </DvSlideOver>
  );
}
