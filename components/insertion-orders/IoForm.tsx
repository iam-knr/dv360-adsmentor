'use client';

// Insertion order create and edit (module 07 2.3, 2.5). Same pattern as CampaignForm: the server validates by field
// path and the messages are the catalogue's. The objective gates the KPI and bid strategy lists (matrix entry).
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { DvCheckboxGroup, DvRadioGroup, type DvChoiceOption } from '@/components/dv/DvChoice';
import { DvFormFooter, focusFirstInvalid } from '@/components/dv/DvFormPage';
import { DvSectionCard } from '@/components/dv/DvSectionCard';
import { DvSelect } from '@/components/dv/DvSelect';
import { DvTextField } from '@/components/dv/DvTextField';
import { KPI_LABEL } from '@/lib/campaigns/kpi';
import { isMoneyKpi, type FrequencyCapWire, type WireIssue } from '@/lib/campaigns/wire';
import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard';
import { createIoAction, updateIoAction, validateIoAction } from '@/lib/insertion-orders/actions';
import type { ObjectiveEntry } from '@/lib/insertion-orders/matrix';
import {
  BID_STRATEGY_LABEL,
  IO_TYPE_LABEL,
  emptyFee,
  type FeeWire,
  type IoWire,
  canAutomate,
} from '@/lib/insertion-orders/wire';
import { ioPath } from '@/lib/routes/paths';
import { FEES_MAX_PER_KIND, FEE_TYPES } from '@/lib/validation/constants/fees';
import { FREQ_PERIODS } from '@/lib/validation/constants/frequency';
import { IO_OBJECTIVE_LABEL } from '@/lib/validation/constants/io-matrix';

export interface IoFormProps {
  mode: 'create' | 'edit';
  partnerId: string;
  advertiserId: string;
  campaignId: string;
  ioId?: string;
  version?: number;
  currency: string;
  initial: IoWire;
  matrix: ObjectiveEntry;
  campaignFrequencyCap: FrequencyCapWire;
  readOnly?: boolean;
}

const PACING_TYPES = {
  FLIGHT: [
    { value: 'AHEAD', label: 'Ahead' },
    { value: 'EVEN', label: 'Even' },
  ],
  DAILY: [
    { value: 'EVEN', label: 'Even' },
    { value: 'ASAP', label: 'ASAP' },
  ],
} as const;

export function IoForm({
  mode,
  partnerId,
  advertiserId,
  campaignId,
  ioId,
  version,
  currency,
  initial,
  matrix,
  campaignFrequencyCap,
  readOnly,
}: IoFormProps) {
  const router = useRouter();
  const [value, setValue] = useState<IoWire>(initial);
  const [saved, setSaved] = useState<IoWire>(initial);
  const [issues, setIssues] = useState<WireIssue[]>([]);
  const [note, setNote] = useState('');
  const [busy, startTransition] = useTransition();
  const dirty = useMemo(() => JSON.stringify(value) !== JSON.stringify(saved), [value, saved]);
  useUnsavedGuard(dirty);

  const set = (patch: Partial<IoWire>) => setValue((v) => ({ ...v, ...patch }));
  const err = (path: string) =>
    issues.find((i) => i.path === path && i.severity === 'error')?.message;
  const known = new Set<string>();
  const e = (path: string) => {
    known.add(path);
    return err(path);
  };
  const impressionsBudget = value.budget.type === 'IMPRESSIONS';
  const sym = impressionsBudget ? undefined : currency;
  const automate = canAutomate(value.type!, value.objective!);

  const setSegment = (i: number, patch: Partial<IoWire['budget']['segments'][number]>) =>
    set({
      budget: {
        ...value.budget,
        segments: value.budget.segments.map((s, j) => (j === i ? { ...s, ...patch } : s)),
      },
    });
  const setFees = (kind: 'cpmFees' | 'mediaFees', fees: FeeWire[]) =>
    set({ partnerCosts: { ...value.partnerCosts, [kind]: fees } });

  const submit = () => {
    if (readOnly) return;
    startTransition(async () => {
      const res =
        mode === 'create'
          ? await createIoAction(campaignId, value, { changeNote: note })
          : await updateIoAction(ioId!, value, {
              changeNote: note,
              ...(version !== undefined ? { expectedVersion: version } : {}),
            });
      if (!res.ok) {
        setIssues(res.issues);
        setTimeout(() => focusFirstInvalid(), 0);
        return;
      }
      setIssues(res.warnings ?? []);
      setSaved(value);
      setNote('');
      if (mode === 'create')
        router.push(
          ioPath(
            partnerId,
            advertiserId,
            campaignId,
            (res.data as { publicId: string }).publicId,
            'explorerlis',
          ),
        );
      else router.refresh();
    });
  };

  const revalidate = (next: IoWire) =>
    void validateIoAction(campaignId, next, ioId).then((all) =>
      setIssues((cur) => [
        ...cur.filter((i) => i.severity === 'error'),
        ...all.filter((i) => i.severity !== 'error'),
      ]),
    );

  const feeRows = (kind: 'cpmFees' | 'mediaFees', label: string) => {
    const fees = value.partnerCosts[kind];
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="subtitle2">{label}</Typography>
        {fees.map((f, i) => (
          <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 1 }}>
            <DvSelect
              ariaLabel={`${label} ${i + 1} type`}
              value={f.type ?? 'Default'}
              disabled={readOnly || f.system}
              options={(f.system ? [f.type ?? ''] : [...FEE_TYPES]).map((t) => ({
                value: t,
                label: t,
              }))}
              onChange={(type) =>
                setFees(
                  kind,
                  fees.map((x, j) => (j === i ? { ...x, type } : x)),
                )
              }
            />
            <DvTextField
              ariaLabel={`${label} ${i + 1} amount`}
              numeric
              locked={f.system}
              prefix={kind === 'cpmFees' ? currency : undefined}
              suffix={kind === 'mediaFees' ? '%' : undefined}
              value={f.system ? '' : String(f.amount ?? '')}
              readOnly={readOnly}
              error={e(`partnerCosts.${kind}.${i}.amount`)}
              onChange={(amount) =>
                setFees(
                  kind,
                  fees.map((x, j) => (j === i ? { ...x, amount } : x)),
                )
              }
            />
            <DvCheckboxGroup
              readOnly={readOnly || f.system}
              values={f.invoiced ? ['INV'] : []}
              onChange={(v) =>
                setFees(
                  kind,
                  fees.map((x, j) => (j === i ? { ...x, invoiced: v.includes('INV') } : x)),
                )
              }
              options={[{ value: 'INV', label: 'Invoiced' }]}
            />
          </Box>
        ))}
        {!readOnly && fees.length < FEES_MAX_PER_KIND ? (
          <Button
            sx={{ alignSelf: 'flex-start' }}
            onClick={() => setFees(kind, [...fees, emptyFee()])}
          >
            {kind === 'cpmFees' ? 'Add CPM fee' : 'Add media fee'}
          </Button>
        ) : null}
      </Box>
    );
  };

  const cap = value.frequencyCap;
  const inheritNote =
    campaignFrequencyCap.mode === 'LIMITED'
      ? `The campaign's frequency cap is set to ${campaignFrequencyCap.maxImpressions} exposures per ${String(campaignFrequencyCap.period ?? '').toLowerCase()}`
      : undefined;
  const capOptions: DvChoiceOption[] = [
    { value: 'INHERIT', label: 'Unlimited', ...(inheritNote ? { description: inheritNote } : {}) },
    {
      value: 'LIMITED',
      label: 'Limit frequency to',
      inline: (selected) => (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <DvTextField
            ariaLabel="Exposures"
            numeric
            disabled={!selected}
            value={String(cap.maxImpressions ?? '')}
            error={e('frequencyCap.maxImpressions')}
            onChange={(maxImpressions) => set({ frequencyCap: { ...cap, maxImpressions } })}
          />
          <span>exposures per</span>
          <DvSelect
            value={cap.period ?? 'MONTH'}
            disabled={!selected}
            options={FREQ_PERIODS.map((p) => ({ value: p, label: p.toLowerCase() }))}
            onChange={(p) => set({ frequencyCap: { ...cap, period: p as 'MONTH' } })}
          />
        </Box>
      ),
    },
  ];
  known.add('frequencyCap.maxImpressions');
  const unmatched = issues.filter((i) => i.severity === 'error');

  return (
    <Box component="form" noValidate onSubmit={(ev) => ev.preventDefault()}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Typography variant="body2">
          {IO_TYPE_LABEL[value.type!]} · {IO_OBJECTIVE_LABEL[value.objective!]}
        </Typography>

        <DvSectionCard title="Basic details" layout="settings">
          <DvTextField
            label="Insertion order name"
            required
            id="name"
            value={value.name}
            readOnly={readOnly}
            error={e('name')}
            onChange={(name) => set({ name })}
          />
          <DvSelect
            label="Status"
            value={value.status ?? 'DRAFT'}
            disabled={readOnly}
            options={[
              { value: 'DRAFT', label: 'Draft' },
              { value: 'ACTIVE', label: 'Active' },
            ]}
            onChange={(status) => set({ status: status as IoWire['status'] })}
          />
        </DvSectionCard>

        <DvSectionCard title="Budget" layout="stacked">
          <DvRadioGroup
            label="Budget type"
            value={value.budget.type ?? 'CURRENCY'}
            readOnly={readOnly || mode === 'edit'}
            onChange={(type) =>
              set({ budget: { ...value.budget, type: type as 'CURRENCY' | 'IMPRESSIONS' } })
            }
            options={[
              { value: 'CURRENCY', label: 'Amount' },
              { value: 'IMPRESSIONS', label: 'Impressions' },
            ]}
          />
          {value.budget.segments.map((s, i) => (
            <Box
              key={i}
              sx={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: 1, mt: 1 }}
            >
              <DvTextField
                ariaLabel={`Segment ${i + 1} budget`}
                placeholder="Budget"
                numeric
                prefix={sym}
                value={String(s.amount ?? '')}
                readOnly={readOnly}
                error={e(`budget.segments.${i}.amount`)}
                onChange={(amount) => setSegment(i, { amount })}
              />
              <DvTextField
                ariaLabel={`Segment ${i + 1} description`}
                placeholder="Description"
                value={s.description ?? ''}
                readOnly={readOnly}
                onChange={(description) => setSegment(i, { description })}
              />
              <DvTextField
                ariaLabel={`Segment ${i + 1} start`}
                placeholder="YYYY-MM-DD"
                value={s.startDate ?? ''}
                readOnly={readOnly}
                error={e(`budget.segments.${i}.startDate`)}
                onChange={(startDate) => setSegment(i, { startDate })}
              />
              <DvTextField
                ariaLabel={`Segment ${i + 1} end`}
                placeholder="YYYY-MM-DD"
                value={s.endDate ?? ''}
                readOnly={readOnly}
                error={e(`budget.segments.${i}.endDate`)}
                onChange={(endDate) => setSegment(i, { endDate })}
              />
            </Box>
          ))}
          {!readOnly ? (
            <Button
              sx={{ alignSelf: 'flex-start', mt: 1 }}
              onClick={() =>
                set({
                  budget: {
                    ...value.budget,
                    segments: [
                      ...value.budget.segments,
                      { amount: '', description: '', startDate: '', endDate: '' },
                    ],
                  },
                })
              }
            >
              Add budget segment
            </Button>
          ) : null}
        </DvSectionCard>

        <DvSectionCard title="Pacing" layout="settings">
          <DvSelect
            label="Pacing period"
            value={value.pacing.period ?? 'FLIGHT'}
            disabled={readOnly}
            options={[
              { value: 'FLIGHT', label: 'Flight' },
              { value: 'DAILY', label: 'Daily' },
            ]}
            onChange={(period) =>
              set({
                pacing: {
                  ...value.pacing,
                  period: period as 'FLIGHT' | 'DAILY',
                  type: period === 'DAILY' ? 'EVEN' : 'AHEAD',
                },
              })
            }
          />
          <DvSelect
            label="Pacing type"
            value={value.pacing.type ?? 'EVEN'}
            disabled={readOnly}
            options={[...PACING_TYPES[value.pacing.period === 'DAILY' ? 'DAILY' : 'FLIGHT']]}
            onChange={(type) => set({ pacing: { ...value.pacing, type: type as 'EVEN' } })}
          />
          {value.pacing.period === 'DAILY' ? (
            <DvTextField
              label="Daily amount"
              numeric
              prefix={sym}
              value={String(value.pacing.dailyAmount ?? '')}
              readOnly={readOnly}
              error={e('pacing.dailyAmount')}
              onChange={(dailyAmount) => set({ pacing: { ...value.pacing, dailyAmount } })}
            />
          ) : null}
        </DvSectionCard>

        {value.type !== 'DOOH' ? (
          <DvSectionCard title="Performance goal" layout="settings">
            <DvSelect
              label="KPI"
              value={value.kpi?.type ?? ''}
              disabled={readOnly}
              error={e('kpi.type')}
              options={matrix.kpis.map((k) => ({ value: k, label: KPI_LABEL[k] }))}
              onChange={(type) =>
                set({ kpi: { ...(value.kpi ?? {}), type: type as never, value: '' } })
              }
            />
            <DvTextField
              label="KPI value"
              numeric
              prefix={value.kpi?.type && !isMoneyKpi(value.kpi.type) ? undefined : currency}
              suffix={value.kpi?.type && !isMoneyKpi(value.kpi.type) ? '%' : undefined}
              value={String(value.kpi?.value ?? '')}
              readOnly={readOnly}
              error={e('kpi.value')}
              onChange={(v) => set({ kpi: { type: value.kpi?.type ?? null, value: v } })}
            />
          </DvSectionCard>
        ) : null}

        <DvSectionCard title="Optimization" layout="settings">
          <DvRadioGroup
            value={value.optimization.mode ?? 'LI_CONTROLLED'}
            readOnly={readOnly}
            error={e('optimization.mode')}
            onChange={(mode2) => {
              const next = {
                ...value,
                optimization: { ...value.optimization, mode: mode2 as 'IO_AUTOMATED' },
              };
              setValue(next);
              revalidate(next);
            }}
            options={[
              {
                value: 'IO_AUTOMATED',
                label: 'Automate bidding and budget at the insertion order level',
                disabled: !automate,
              },
              {
                value: 'LI_CONTROLLED',
                label: 'Control bidding and budget at the line item level',
              },
            ]}
          />
          {value.optimization.mode === 'IO_AUTOMATED' ? (
            <DvSelect
              label="Optimized towards"
              value={value.optimization.optimizedTowards ?? ''}
              disabled={readOnly}
              options={matrix.bidStrategies.map((b) => ({
                value: b,
                label: BID_STRATEGY_LABEL[b],
              }))}
              onChange={(b) =>
                set({ optimization: { ...value.optimization, optimizedTowards: b as never } })
              }
            />
          ) : null}
        </DvSectionCard>

        <DvSectionCard title="Frequency cap" layout="settings">
          <DvRadioGroup
            value={cap.mode}
            readOnly={readOnly}
            onChange={(m) => set({ frequencyCap: { ...cap, mode: m as FrequencyCapWire['mode'] } })}
            options={capOptions}
          />
        </DvSectionCard>

        <DvSectionCard title="Partner costs" layout="stacked">
          {value.type !== 'DOOH' ? feeRows('cpmFees', 'CPM fees') : null}
          {feeRows('mediaFees', 'Media fees')}
        </DvSectionCard>

        <DvSectionCard title="Integration details" layout="settings">
          <DvTextField
            label="Integration code"
            value={value.integrationCode ?? ''}
            readOnly={readOnly}
            error={e('integrationCode')}
            onChange={(integrationCode) => set({ integrationCode })}
          />
        </DvSectionCard>

        {unmatched.filter((i) => !known.has(i.path)).length > 0 ? (
          <Box role="alert">
            {unmatched
              .filter((i) => !known.has(i.path))
              .map((i, k) => (
                <Typography key={k} color="error" variant="body2">
                  {i.message}
                </Typography>
              ))}
          </Box>
        ) : null}
      </Box>
      {!readOnly ? (
        <DvFormFooter
          mode={mode}
          dirty={dirty || mode === 'create'}
          primaryLabel={busy ? 'Saving…' : undefined}
          onPrimary={submit}
          onSecondary={() => router.back()}
          onReset={() => {
            setValue(saved);
            setIssues([]);
          }}
          {...(mode === 'edit' ? { note, onNoteChange: setNote } : {})}
        />
      ) : null}
    </Box>
  );
}
