'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import { DvCheckboxGroup, DvRadioGroup } from '@/components/dv/DvChoice';
import { DvSelect } from '@/components/dv/DvSelect';
import { DvTextField } from '@/components/dv/DvTextField';
import type { MatrixDimension } from '@/lib/validation/constants/targeting-availability';
import {
  AGE_STOPS,
  BROWSERS,
  CARRIER_ISP_EXAMPLES,
  CATEGORIES_TOP,
  CONNECTION_SPEEDS,
  DAYS,
  DAY_LABEL,
  DAY_PRESETS,
  DEVICE_TYPES,
  ENVIRONMENTS,
  ENVIRONMENT_HINT,
  GENDERS,
  HOUSEHOLD_INCOMES,
  LANGUAGES,
  OPEN_MEASUREMENT_TEXT,
  PARENTAL_STATUSES,
  POSITION_IN_CONTENT,
  POSITION_NATIVE,
  POSITION_ON_SCREEN,
  POSITION_VIDEO,
  TIME_ZONES,
  VIEWABILITY_STEPS,
  viewabilityLabel,
} from '@/lib/targeting/options';
import { isTargeted, mergeSegments, parseKeywords, presetSegments } from '@/lib/targeting/merge';
import type { DaySegment, TargetingCriteria } from '@/lib/targeting/types';
import { availability, toLiType } from '@/lib/targeting/dimensions';
import { ListEditor } from './ListEditor';

export interface EditorProps {
  criteria: TargetingCriteria;
  onChange: (patch: Partial<TargetingCriteria>) => void;
  lineItemType: string;
  readOnly?: boolean;
}

export const MAX_KEYWORDS = 5000;

/** Error text of the draft in an open editor, or null. Apply is blocked while it is set (TGT-033, 111, 130). */
export function editorError(dim: MatrixDimension, c: TargetingCriteria): string | null {
  switch (dim) {
    case 'KEYWORDS':
    case 'KEYWORD_EXCLUSIONS':
      return c.keywords && c.keywords.include.length + c.keywords.exclude.length > MAX_KEYWORDS
        ? 'Use 5,000 keywords or fewer.'
        : null;
    case 'DEMOGRAPHICS': {
      const d = c.demographics;
      if (!d) return null;
      return d.gender.length === 0 || d.parental.length === 0 || d.income.length === 0
        ? 'Select at least one option.'
        : null;
    }
    case 'DEVICE':
      return c.device &&
        c.device.types.length > 0 &&
        c.device.types.every((t) => t.mode === 'EXCLUDE') &&
        c.device.types.length === DEVICE_TYPES.length
        ? 'Select at least one option.'
        : null;
    case 'ENVIRONMENT':
      return c.environment && !c.environment.web && !c.environment.app
        ? 'Select at least one option.'
        : null;
    default:
      return null;
  }
}

function Err({ text }: { text: string | null }) {
  return text ? (
    <Typography role="alert" variant="body2" color="error">
      {text}
    </Typography>
  ) : null;
}

function EnvironmentEditor({ criteria, onChange, readOnly }: EditorProps) {
  const env = criteria.environment ?? { web: false, app: false };
  return (
    <>
      <DvCheckboxGroup
        label="Environment"
        readOnly={readOnly}
        values={[...(env.web ? ['WEB'] : []), ...(env.app ? ['APP'] : [])]}
        onChange={(v) =>
          onChange({ environment: { web: v.includes('WEB'), app: v.includes('APP') } })
        }
        options={ENVIRONMENTS.map((o) => ({
          value: o.code,
          label: o.label,
          description: ENVIRONMENT_HINT[o.code],
        }))}
      />
      <Err text={editorError('ENVIRONMENT', criteria)} />
    </>
  );
}

function PositionEditor({ criteria, onChange, lineItemType, readOnly }: EditorProps) {
  const p = criteria.position ?? { onScreen: [], inContent: [], native: [] };
  const t = toLiType(lineItemType);
  const video = t === 'VIDEO' || t === 'CTV';
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <DvCheckboxGroup
        label="On the screen"
        readOnly={readOnly}
        values={p.onScreen}
        onChange={(onScreen) => onChange({ position: { ...p, onScreen } })}
        options={POSITION_ON_SCREEN.map((o) => ({ value: o.code, label: o.label }))}
      />
      <DvCheckboxGroup
        label="In the content"
        readOnly={readOnly}
        values={p.inContent}
        onChange={(inContent) => onChange({ position: { ...p, inContent } })}
        options={(video ? POSITION_VIDEO : POSITION_IN_CONTENT).map((o) => ({
          value: o.code,
          label: o.label,
        }))}
      />
      {!video ? (
        <DvCheckboxGroup
          label="Native"
          readOnly={readOnly}
          values={p.native}
          onChange={(native) => onChange({ position: { ...p, native } })}
          options={POSITION_NATIVE.map((o) => ({ value: o.code, label: o.label }))}
        />
      ) : null}
    </Box>
  );
}

function ViewabilityEditor({ criteria, onChange, readOnly }: EditorProps) {
  const v = criteria.viewability ?? { openMeasurement: false, predictedPct: null };
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {v.openMeasurement ? (
        <Typography variant="body2">
          <strong>Open Measurement enabled</strong> (locked). {OPEN_MEASUREMENT_TEXT}
        </Typography>
      ) : null}
      <DvSelect
        label="Predicted viewability"
        value={v.predictedPct === null ? 'ALL' : String(v.predictedPct)}
        disabled={readOnly}
        onChange={(x) =>
          onChange({ viewability: { ...v, predictedPct: x === 'ALL' ? null : Number(x) } })
        }
        options={[
          { value: 'ALL', label: viewabilityLabel(null) },
          ...VIEWABILITY_STEPS.map((n) => ({ value: String(n), label: viewabilityLabel(n) })),
        ]}
      />
    </Box>
  );
}

function ageText(range: [number, number]): string {
  return `${range[0]} - ${range[1] >= 65 ? '65+' : range[1]}`;
}

function DemographicsEditor({ criteria, onChange, readOnly }: EditorProps) {
  const d = criteria.demographics!;
  const set = (patch: Partial<typeof d>) => onChange({ demographics: { ...d, ...patch } });
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <DvCheckboxGroup
        label="Gender"
        readOnly={readOnly}
        values={d.gender}
        onChange={(gender) => set({ gender })}
        options={GENDERS.map((o) => ({ value: o.code, label: o.label }))}
      />
      <Box>
        <Typography variant="subtitle2" id="age-label">
          Age: {ageText(d.ageRange)}
          {d.ageUnknown ? ', Unknown' : ''}
        </Typography>
        <Slider
          aria-labelledby="age-label"
          disabled={readOnly}
          min={AGE_STOPS[0]}
          max={AGE_STOPS[AGE_STOPS.length - 1]}
          step={null}
          marks={AGE_STOPS.map((value) => ({ value, label: value === 65 ? '65+' : String(value) }))}
          value={d.ageRange}
          onChange={(_e, v) => {
            const [a, b] = v;
            set({ ageRange: [a!, b!] });
          }}
        />
        <DvCheckboxGroup
          readOnly={readOnly}
          values={d.ageUnknown ? ['UNKNOWN'] : []}
          onChange={(v) => set({ ageUnknown: v.includes('UNKNOWN') })}
          options={[{ value: 'UNKNOWN', label: 'Unknown' }]}
        />
      </Box>
      <DvCheckboxGroup
        label="Parental status"
        readOnly={readOnly}
        values={d.parental}
        onChange={(parental) => set({ parental })}
        options={PARENTAL_STATUSES.map((o) => ({ value: o.code, label: o.label }))}
      />
      <DvCheckboxGroup
        label="Household income"
        readOnly={readOnly}
        values={d.income}
        onChange={(income) => set({ income })}
        options={HOUSEHOLD_INCOMES.map((o) => ({ value: o.code, label: o.label }))}
      />
      <Err text={editorError('DEMOGRAPHICS', criteria)} />
    </Box>
  );
}

function KeywordsEditor({ criteria, onChange, lineItemType, readOnly }: EditorProps) {
  const k = criteria.keywords ?? { include: [], exclude: [] };
  const excludeOnly = availability(lineItemType, 'KEYWORDS') === 'N';
  const [mode, setMode] = useState<'include' | 'exclude'>(excludeOnly ? 'exclude' : 'include');
  const [text, setText] = useState('');
  const total = k.include.length + k.exclude.length;
  const add = () => {
    const { keywords } = parseKeywords(text);
    if (keywords.length === 0) return;
    onChange({ keywords: { ...k, [mode]: [...new Set([...k[mode], ...keywords])] } });
    setText('');
  };
  const remove = (w: string) =>
    onChange({ keywords: { ...k, [mode]: k[mode].filter((x) => x !== w) } });
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {!excludeOnly ? (
        <DvRadioGroup
          label="Mode"
          value={mode}
          readOnly={readOnly}
          onChange={(v) => setMode(v as 'include' | 'exclude')}
          options={[
            { value: 'include', label: `Include (${k.include.length})` },
            { value: 'exclude', label: `Exclude (${k.exclude.length})` },
          ]}
        />
      ) : null}
      <DvTextField
        label="Enter keywords separated by commas or new lines"
        multiline
        rows={4}
        value={text}
        readOnly={readOnly}
        onChange={setText}
        onBlur={add}
        hint={`${total.toLocaleString('en-US')} / ${MAX_KEYWORDS.toLocaleString('en-US')} keywords`}
      />
      <Box component="ul" aria-label="Keywords" sx={{ m: 0, p: 0, listStyle: 'none' }}>
        {k[mode].map((w) => (
          <Box
            component="li"
            key={w}
            sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}
          >
            <span>{w}</span>
            {!readOnly ? (
              <button type="button" aria-label={`Remove ${w}`} onClick={() => remove(w)}>
                ×
              </button>
            ) : null}
          </Box>
        ))}
      </Box>
      <Err text={editorError('KEYWORDS', criteria)} />
    </Box>
  );
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);

function DayTimeEditor({ criteria, onChange, readOnly }: EditorProps) {
  const d = criteria.dayAndTime ?? { segments: [], tz: 'ADVERTISER' as const };
  const [note, setNote] = useState<string | null>(null);
  const [preset, setPreset] = useState('CUSTOM');
  const setSegments = (segments: DaySegment[]) => {
    const m = mergeSegments(segments);
    setNote(m.merged ? 'Overlapping times were merged.' : null);
    onChange({ dayAndTime: { ...d, segments: m.segments } });
  };
  const toggleHour = (day: DaySegment['day'], h: number) => {
    if (readOnly) return;
    if (isTargeted(d.segments, day, h)) {
      const out: DaySegment[] = [];
      for (const s of d.segments) {
        const a = Number(s.from.split(':')[0]) * 60 + Number(s.from.split(':')[1]);
        const b = Number(s.to.split(':')[0]) * 60 + Number(s.to.split(':')[1]);
        if (s.day !== day || h * 60 < a || (h + 1) * 60 > b) {
          out.push(s);
          continue;
        }
        const f = (m: number) =>
          `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        if (a < h * 60) out.push({ day, from: s.from, to: f(h * 60) });
        if (b > (h + 1) * 60) out.push({ day, from: f((h + 1) * 60), to: s.to });
      }
      setSegments(out);
    } else {
      setSegments([
        ...d.segments,
        {
          day,
          from: `${String(h).padStart(2, '0')}:00`,
          to: `${String(h + 1).padStart(2, '0')}:00`,
        },
      ]);
    }
  };
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <DvSelect
        label="Schedule"
        value={preset}
        disabled={readOnly}
        onChange={(v) => {
          setPreset(v);
          if (v !== 'CUSTOM')
            setSegments(presetSegments(v as 'ALL_DAYS' | 'WEEKDAYS' | 'WEEKENDS'));
        }}
        options={DAY_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
      />
      <DvSelect
        label="Time zone"
        value={d.tz}
        disabled={readOnly}
        onChange={(tz) => onChange({ dayAndTime: { ...d, tz: tz as 'LOCAL' | 'ADVERTISER' } })}
        options={TIME_ZONES.map((t) => ({ value: t.id, label: t.label }))}
      />
      <Box role="grid" aria-label="Day and time grid" sx={{ overflowX: 'auto' }}>
        {DAYS.map((day) => (
          <Box role="row" key={day} sx={{ display: 'flex', alignItems: 'center' }}>
            <Box role="rowheader" sx={{ width: 40, fontSize: 12 }}>
              {DAY_LABEL[day].slice(0, 3)}
            </Box>
            {HOURS.map((h) => {
              const on = isTargeted(d.segments, day, h);
              return (
                <Box
                  role="gridcell"
                  key={h}
                  tabIndex={readOnly ? -1 : 0}
                  aria-selected={on}
                  aria-label={`${DAY_LABEL[day]} ${h}:00`}
                  data-on={on ? '1' : '0'}
                  onClick={() => toggleHour(day, h)}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      toggleHour(day, h);
                    }
                  }}
                  sx={{
                    width: 14,
                    height: 20,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: on ? 'primary.main' : 'transparent',
                    cursor: readOnly ? 'default' : 'pointer',
                  }}
                />
              );
            })}
          </Box>
        ))}
      </Box>
      {note ? (
        <Typography role="status" variant="body2">
          {note}
        </Typography>
      ) : null}
    </Box>
  );
}

function ConnectionSpeedEditor({ criteria, onChange, readOnly }: EditorProps) {
  const value = criteria.connectionSpeed ?? 'ALL';
  return (
    <DvRadioGroup
      label="Connection speed"
      value={value}
      readOnly={readOnly}
      onChange={(v) => onChange({ connectionSpeed: v })}
      options={CONNECTION_SPEEDS.map((o) => ({ value: o.code, label: o.label }))}
    />
  );
}

function DeviceEditor({ criteria, onChange, readOnly }: EditorProps) {
  const d = criteria.device ?? { types: [], os: [], makeModel: [] };
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="subtitle2">Device type</Typography>
      <ListEditor
        options={DEVICE_TYPES}
        value={d.types}
        readOnly={readOnly}
        searchLabel="Search device types"
        onChange={(types) => onChange({ device: { ...d, types } })}
        error={editorError('DEVICE', criteria) ?? undefined}
      />
    </Box>
  );
}

export function EditorBody(props: EditorProps & { dim: MatrixDimension }) {
  const { dim, criteria, onChange, readOnly } = props;
  switch (dim) {
    case 'ENVIRONMENT':
      return <EnvironmentEditor {...props} />;
    case 'POSITION':
      return <PositionEditor {...props} />;
    case 'VIEWABILITY':
      return <ViewabilityEditor {...props} />;
    case 'DEMOGRAPHICS':
      return <DemographicsEditor {...props} />;
    case 'KEYWORDS':
    case 'KEYWORD_EXCLUSIONS':
      return <KeywordsEditor {...props} />;
    case 'DAY_TIME':
      return <DayTimeEditor {...props} />;
    case 'CONNECTION_SPEED':
      return <ConnectionSpeedEditor {...props} />;
    case 'DEVICE':
      return <DeviceEditor {...props} />;
    case 'CATEGORIES':
      return (
        <ListEditor
          options={CATEGORIES_TOP}
          value={criteria.categories ?? []}
          readOnly={readOnly}
          searchLabel="Search categories"
          onChange={(categories) => onChange({ categories })}
        />
      );
    case 'LANGUAGE':
      return (
        <ListEditor
          options={LANGUAGES}
          value={criteria.language ?? []}
          readOnly={readOnly}
          searchLabel="Search languages"
          onChange={(language) => onChange({ language })}
        />
      );
    case 'BROWSER':
      return (
        <ListEditor
          options={BROWSERS}
          value={criteria.browser ?? []}
          readOnly={readOnly}
          searchLabel="Search browsers"
          onChange={(browser) => onChange({ browser })}
        />
      );
    case 'CARRIER_ISP':
      return (
        <ListEditor
          options={CARRIER_ISP_EXAMPLES.map((o) => ({
            code: o.code,
            label: `${o.label} (${o.type})`,
          }))}
          value={criteria.carrierIsp ?? []}
          readOnly={readOnly}
          searchLabel="Search carriers and ISPs"
          onChange={(carrierIsp) => onChange({ carrierIsp })}
        />
      );
    default:
      return (
        <Typography variant="body2" color="text.secondary">
          This editor arrives with the advanced targeting session.
        </Typography>
      );
  }
}
