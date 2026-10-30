'use client';

// A/B test form (module 17 S3 and the Settings tab of S5): Test details, Test duration, Test arms, Measure, Lift study
// setup and the Lift eligibility rail. Once a test has started only name, hypothesis and end date change.
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Radio from '@mui/material/Radio';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import {
  DvBanner,
  DvRadioGroup,
  DvSectionCard,
  DvSelect,
  DvTextField,
  focusFirstInvalid,
  useToast,
} from '@/components/dv';
import { DvIcon } from '@/components/icons';
import { candidatesAction, createAbTestAction, updateAbTestAction } from '@/lib/experiments/actions';
import {
  AB_ARM_NAME_MAX,
  AB_GOALS_BY_SCOPE,
  AB_HYPOTHESIS_MAX,
  AB_MAX_ARMS,
  AB_NAME_MAX,
  GOAL_LABEL,
} from '@/lib/experiments/constants';
import { abReportPath, experimentsPath } from '@/lib/experiments/paths';
import { abIssues, scopeOf, type AbEntityInfo } from '@/lib/experiments/rules';
import type { AbTestInput, AbTestView, BrandLiftInput, CandidateRow } from '@/lib/experiments/types';
import { confirmLeave, useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard';
import { MSG } from '@/lib/validation/messages';
import { ArmPicker } from './ArmPicker';
import { BrandLiftFields, emptyBrandLift } from './BrandLiftFields';
import { DateInput } from './DateInput';

interface ArmState {
  id?: string;
  name: string;
  split: string;
  isControl: boolean;
  entityIds: string[];
}

const defaultArms = (): ArmState[] => [
  { name: 'Arm 1', split: '50', isControl: true, entityIds: [] },
  { name: 'Arm 2', split: '50', isControl: false, entityIds: [] },
];

export function AbForm({
  partnerId,
  advertiserId,
  mode,
  today,
  initial,
  onSaved,
  embedded,
}: {
  partnerId: string;
  advertiserId: string;
  mode: 'create' | 'edit';
  today: string;
  initial?: AbTestView;
  onSaved?: (v: AbTestView) => void;
  embedded?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const started = mode === 'edit' && !!initial && initial.status !== 'SCHEDULED';
  const ended = mode === 'edit' && initial?.status === 'COMPLETED';
  const readOnly = ended || (mode === 'edit' && initial?.canEdit === false);

  const [name, setName] = useState(initial?.name ?? '');
  const [hypothesis, setHypothesis] = useState(initial?.hypothesis ?? '');
  const [startDate, setStartDate] = useState(initial?.startDate ?? today);
  const [endDate, setEndDate] = useState(initial?.endDate ?? '');
  const [target, setTarget] = useState<'INSERTION_ORDER' | 'LINE_ITEM'>(initial?.target ?? 'INSERTION_ORDER');
  const [arms, setArms] = useState<ArmState[]>(
    initial
      ? initial.arms.map((a) => ({ id: a.id, name: a.name, split: String(a.splitPct), isControl: a.isControl, entityIds: a.entities.map((e) => e.id) }))
      : defaultArms(),
  );
  const [goal, setGoal] = useState(initial?.goal ?? 'CONVERSIONS');
  const [confidence, setConfidence] = useState(initial?.confidence ?? 'P90');
  const [exclude, setExclude] = useState(initial?.excludeUnidentifiedUsers ?? false);
  const [liftEnabled, setLiftEnabled] = useState(!!initial?.liftStudyId);
  const [brandLift, setBrandLift] = useState<BrandLiftInput>(initial?.brandLift ?? emptyBrandLift());
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [picker, setPicker] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | undefined>();
  const [dirty, setDirty] = useState(false);
  const [busy, start] = useTransition();
  useUnsavedGuard(dirty);
  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    setDirty(true);
    set(v);
  };

  useEffect(() => {
    let live = true;
    void candidatesAction(advertiserId, {
      compare: target === 'LINE_ITEM' ? 'LINE_ITEMS' : 'INSERTION_ORDERS',
      ...(initial ? { exceptTestId: initial.id } : {}),
    }).then((rows) => live && setCandidates(rows));
    return () => {
      live = false;
    };
  }, [advertiserId, target, initial]);

  const byId = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);
  const nameOf = (id: string): string => byId.get(id)?.name ?? initial?.arms.flatMap((a) => a.entities).find((e) => e.id === id)?.name ?? id;
  const scopes = arms.flatMap((a) => a.entityIds).map((id) => byId.get(id)?.scope ?? 'CROSS_EXCHANGE');
  const crossExchange = scopes.includes('CROSS_EXCHANGE');
  const scope = scopeOf(scopes);
  const goals = AB_GOALS_BY_SCOPE[scope];
  const liftBlocked = target === 'LINE_ITEM' || crossExchange;
  const showExclude = target === 'INSERTION_ORDER' && crossExchange;

  const input = (): AbTestInput => ({
    name,
    hypothesis,
    startDate,
    endDate: endDate || null,
    target,
    arms: arms.map((a) => ({
      ...(a.id ? { id: a.id } : {}),
      name: a.name,
      splitPct: a.split === '' ? null : a.split,
      isControl: a.isControl,
      entityIds: a.entityIds,
    })),
    goal: goals.includes(goal) ? goal : (goals[0] ?? 'CLICKS'),
    confidence,
    excludeUnidentifiedUsers: exclude && showExclude,
    liftEnabled: liftEnabled && !liftBlocked,
    brandLift: liftEnabled && !liftBlocked ? brandLift : null,
    ...(initial ? { version: initial.version } : {}),
  });

  const clientIssues = () => {
    const entities = new Map<string, AbEntityInfo>();
    for (const c of candidates)
      entities.set(c.id, {
        kind: target === 'LINE_ITEM' ? 'LI' : 'IO',
        name: c.name,
        scope: c.scope,
        budgetWarning: !!c.warning,
        inactive: !!c.inactive,
        liftable: c.scope !== 'CROSS_EXCHANGE',
      });
    const used = new Map(candidates.filter((c) => c.inOtherTest).map((c) => [c.id, c.inOtherTest as string]));
    return abIssues(input(), {
      mode,
      today,
      started,
      ...(initial
        ? { original: { startDate: initial.startDate, endDate: initial.endDate, arms: initial.arms.map((a) => ({ id: a.id, splitPct: a.splitPct, isControl: a.isControl, entityIds: a.entities.map((e) => e.id) })) } }
        : {}),
      entities,
      usedElsewhere: used,
    });
  };

  const apply = (issues: { path: string; severity: string; message: string }[]) => {
    const errs: Record<string, string> = {};
    for (const i of issues.filter((x) => x.severity === 'error')) if (!errs[i.path]) errs[i.path] = i.message;
    setErrors(errs);
    setWarnings([...new Set(issues.filter((x) => x.severity === 'warning').map((x) => x.message))]);
    return Object.keys(errs).length === 0;
  };

  const save = () =>
    start(async () => {
      setFormError(undefined);
      const local = clientIssues().map((i) => ({ path: i.path, severity: i.severity, message: i.message }));
      if (!apply(local)) {
        setTimeout(() => focusFirstInvalid(), 0);
        return;
      }
      if (mode === 'create') {
        const res = await createAbTestAction(advertiserId, input());
        if (!res.ok) {
          apply(res.issues);
          setFormError(res.issues[0]?.message);
          return;
        }
        setDirty(false);
        router.push(abReportPath(partnerId, advertiserId, res.data.publicId));
        return;
      }
      const res = await updateAbTestAction(advertiserId, initial?.publicId ?? '', input());
      if (!res.ok) {
        apply(res.issues);
        setFormError(res.issues[0]?.message);
        return;
      }
      setDirty(false);
      toast.show({ message: 'Changes saved.' });
      onSaved?.(res.data.view);
      router.refresh();
    });

  const cancel = () => confirmLeave(() => router.push(experimentsPath(partnerId, advertiserId)));
  const setArm = (i: number, p: Partial<ArmState>) => {
    setDirty(true);
    setArms((a) => a.map((x, j) => (j === i ? { ...x, ...p } : x)));
  };
  const lockArms = started || readOnly;
  const lockAll = readOnly;
  const armError = errors.arms;
  const kindWord = target === 'LINE_ITEM' ? 'line items' : 'insertion orders';
  const taken = (i: number) => new Set(arms.flatMap((a, j) => (j === i ? [] : a.entityIds)));
  const dateErr = errors.endDate;

  const form = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }} data-testid="ab-form">
      {formError ? (
        <DvBanner kind="error" level="inline">
          {formError}
        </DvBanner>
      ) : null}
      {readOnly ? (
        <DvBanner kind="info" level="inline">
          {ended ? 'This test has ended. Its settings can no longer be changed.' : 'You have read-only access to this test.'}
        </DvBanner>
      ) : null}
      <DvSectionCard title="Test details" layout="stacked">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 560 }}>
          <DvTextField
            label="Name"
            required
            value={name}
            maxLength={AB_NAME_MAX}
            disabled={lockAll}
            onChange={touch(setName)}
            {...(errors.name ? { error: errors.name } : {})}
          />
          <DvTextField
            label="Enter your test hypothesis statement (optional)"
            value={hypothesis}
            multiline
            rows={3}
            maxLength={AB_HYPOTHESIS_MAX}
            placeholder="Example: Automated bidding will increase conversions compared to fixed bidding."
            disabled={lockAll}
            onChange={touch(setHypothesis)}
            {...(errors.hypothesis ? { error: errors.hypothesis } : {})}
          />
        </Box>
      </DvSectionCard>

      <DvSectionCard title="Test duration" layout="stacked">
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <DateInput
            label="Start date"
            value={startDate}
            disabled={lockArms}
            onChange={touch(setStartDate)}
            error={errors.startDate}
            hint={started ? 'Dates are locked once the test has started.' : undefined}
          />
          <DateInput
            label="End date (optional)"
            value={endDate}
            disabled={lockAll}
            onChange={touch(setEndDate)}
            error={dateErr}
          />
        </Box>
      </DvSectionCard>

      <DvSectionCard title="Test arms" layout="stacked">
        <DvRadioGroup
          label="What are you comparing?"
          value={target}
          disabled={lockArms}
          onChange={(v) => {
            setDirty(true);
            setTarget(v as 'INSERTION_ORDER' | 'LINE_ITEM');
            setArms((a) => a.map((x) => ({ ...x, entityIds: [] })));
          }}
          options={[
            { value: 'INSERTION_ORDER', label: 'Insertion orders' },
            { value: 'LINE_ITEM', label: 'Line items' },
          ]}
        />
        {armError ? (
          <Typography role="alert" color="error" variant="body2" sx={{ mt: 1 }} data-testid="arms-error">
            {armError}
          </Typography>
        ) : null}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
          {arms.map((a, i) => (
            <Box
              key={a.id ?? i}
              data-testid={`arm-${i + 1}`}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}
            >
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <Box sx={{ flex: 1, minWidth: 220 }}>
                  <DvTextField
                    label="Arm name"
                    required
                    value={a.name}
                    maxLength={AB_ARM_NAME_MAX}
                    disabled={lockArms}
                    onChange={(v) => setArm(i, { name: v })}
                    {...(errors[`arms.${i}.name`] ? { error: errors[`arms.${i}.name`] } : {})}
                  />
                </Box>
                <Box sx={{ width: 160 }}>
                  <DvTextField
                    label="Audience split"
                    required
                    type="number"
                    numeric
                    suffix="%"
                    value={a.split}
                    disabled={lockArms}
                    onChange={(v) => setArm(i, { split: v })}
                    {...(errors[`arms.${i}.splitPct`] ? { error: errors[`arms.${i}.splitPct`] } : {})}
                  />
                </Box>
                <FormControlLabel
                  sx={{ mt: 3 }}
                  control={
                    <Radio
                      checked={a.isControl}
                      disabled={lockArms}
                      onChange={() => {
                        setDirty(true);
                        setArms((all) => all.map((x, j) => ({ ...x, isControl: j === i })));
                      }}
                      inputProps={{ 'aria-label': `Control ${a.name}` }}
                    />
                  }
                  label="Control"
                />
                {arms.length > 2 && !lockArms ? (
                  <IconButton aria-label={`Delete ${a.name}`} sx={{ mt: 2.5 }} onClick={() => { setDirty(true); setArms((all) => { const next = all.filter((_, j) => j !== i); if (!next.some((x) => x.isControl) && next[0]) next[0] = { ...next[0], isControl: true }; return next; }); }}>
                    <DvIcon name="delete" size={20} />
                  </IconButton>
                ) : null}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Button variant="outlined" disabled={lockArms} onClick={() => setPicker(i)}>
                  {`Select ${kindWord}`}
                </Button>
                {a.entityIds.map((id) => (
                  <Chip key={id} size="small" label={nameOf(id)} />
                ))}
                {a.entityIds.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    None selected
                  </Typography>
                ) : null}
              </Box>
              {errors[`arms.${i}.entityIds`] ? (
                <Typography role="alert" variant="caption" color="error">
                  {errors[`arms.${i}.entityIds`]}
                </Typography>
              ) : null}
            </Box>
          ))}
        </Box>
        {!lockArms ? (
          <Button
            startIcon={<DvIcon name="add" size={18} />}
            sx={{ mt: 2 }}
            disabled={arms.length >= AB_MAX_ARMS}
            onClick={() => {
              setDirty(true);
              setArms((a) => [...a, { name: `Arm ${a.length + 1}`, split: '0', isControl: false, entityIds: [] }]);
            }}
          >
            Add arm
          </Button>
        ) : null}
        {warnings.map((w) => (
          <Box key={w} sx={{ mt: 1 }}>
            <DvBanner kind="warning" level="inline">
              {w}
            </DvBanner>
          </Box>
        ))}
      </DvSectionCard>

      <DvSectionCard title="Measure" layout="stacked">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 420 }}>
          <DvSelect
            label="Measurement goal"
            required
            value={goals.includes(goal) ? goal : (goals[0] ?? '')}
            disabled={lockArms}
            onChange={(v) => touch(setGoal)(v as typeof goal)}
            options={goals.map((g) => ({
              value: g,
              label: GOAL_LABEL[g],
              group: ['CLICKS', 'CONVERSIONS', 'REACH'].includes(g) ? 'Standard metrics' : 'Channel-specific',
            }))}
            {...(errors.goal ? { error: errors.goal } : {})}
          />
          <DvSelect
            label="Confidence level"
            required
            value={confidence}
            disabled={lockArms}
            onChange={(v) => touch(setConfidence)(v as 'P90' | 'P95')}
            options={[
              { value: 'P90', label: '90%' },
              { value: 'P95', label: '95%' },
            ]}
          />
        </Box>
        {showExclude ? (
          <Box sx={{ mt: 2 }} data-testid="participation">
            <Typography variant="subtitle2">Participation</Typography>
            <Typography variant="body2" color="text.secondary">
              By default users are identified and diverted at random. Excluding traffic without third-party IDs keeps arms from overlapping.
            </Typography>
            <FormControlLabel
              control={<Switch checked={exclude} disabled={lockArms} onChange={(_e, v) => touch(setExclude)(v)} />}
              label="Exclude unidentified users"
            />
            {exclude ? (
              <DvBanner kind="warning" level="inline">
                Excluding traffic without third-party IDs can make results less representative.
              </DvBanner>
            ) : null}
          </Box>
        ) : null}
      </DvSectionCard>

      <DvSectionCard title="Lift study setup" layout="stacked">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Lift studies are only applicable for insertion orders containing YouTube &amp; partners or Demand Gen line items.
        </Typography>
        {liftBlocked ? (
          <DvBanner kind="info" level="inline">
            {MSG.LIFT_NA_FOR_LI}
          </DvBanner>
        ) : null}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 120px', alignItems: 'center', mt: 1 }}>
          <Typography variant="subtitle2">Lift types</Typography>
          <Typography variant="subtitle2">Pacing</Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={liftEnabled && !liftBlocked}
                disabled={liftBlocked || started || readOnly}
                onChange={(_e, v) => touch(setLiftEnabled)(v)}
              />
            }
            label="Brand lift"
          />
          <Typography variant="body2">ASAP</Typography>
        </Box>
        {errors.lift ? (
          <Typography role="alert" color="error" variant="caption">
            {errors.lift}
          </Typography>
        ) : null}
        {liftEnabled && !liftBlocked ? (
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <BrandLiftFields value={brandLift} onChange={touch(setBrandLift)} errors={errors} disabled={started || readOnly} withCards={false} />
          </Box>
        ) : null}
      </DvSectionCard>

      {!readOnly ? (
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="contained" onClick={save} disabled={busy}>
            {mode === 'edit' ? 'Save changes' : 'Save'}
          </Button>
          <Button onClick={cancel} disabled={busy}>
            Cancel
          </Button>
        </Box>
      ) : null}
    </Box>
  );

  const rail = (
    <Box
      component="aside"
      aria-label="Lift eligibility"
      sx={{ width: 280, flexShrink: 0, border: 1, borderColor: 'divider', borderRadius: 1, p: 2, alignSelf: 'flex-start', display: { xs: 'none', lg: 'block' } }}
      data-testid="lift-rail"
    >
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Lift eligibility
      </Typography>
      <Rail ok={arms.some((a) => a.entityIds.length > 0)} text="At least one insertion order" />
      <Rail ok={liftEnabled && !liftBlocked} text="One or more lift types" />
      {liftEnabled && !liftBlocked
        ? arms.map((a) => (
            <Box key={a.id ?? a.name} sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">{`Brand lift: ${a.name}`}</Typography>
              <Rail ok={a.entityIds.length > 0 && a.entityIds.every((id) => (byId.get(id)?.scope ?? 'CROSS_EXCHANGE') !== 'CROSS_EXCHANGE')} text="IOs that contain YouTube or Demand Gen LIs, excluding PG YouTube LIs" />
              <Rail ok={brandLift.metrics.length > 0} text="Brand lift metrics" />
            </Box>
          ))
        : null}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
      {form}
      {embedded ? null : rail}
      {picker !== null ? (
        <ArmPicker
          open
          kind={target}
          rows={candidates}
          value={arms[picker]?.entityIds ?? []}
          taken={taken(picker)}
          onCancel={() => setPicker(null)}
          onDone={(ids) => {
            setArm(picker, { entityIds: ids });
            setPicker(null);
          }}
        />
      ) : null}
    </Box>
  );
}

function Rail({ ok, text }: { ok: boolean; text: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.5 }}>
      <DvIcon name={ok ? 'check' : 'info'} size={16} color={ok ? 'success.main' : 'text.secondary'} />
      <Typography variant="body2">{text}</Typography>
    </Box>
  );
}
