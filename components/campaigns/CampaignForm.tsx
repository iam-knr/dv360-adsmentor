'use client';

// New campaign and Campaign settings (module 06 2.2, 2.4). One form for both: create sends `createCampaignAction`,
// edit sends `updateCampaignAction` with `expectedVersion`. Validation runs on the server (lib/validation) and the
// issues come back by field path, so the messages are the catalogue's, verbatim.
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { DvCheckboxGroup, DvRadioGroup } from '@/components/dv/DvChoice';
import { DvFormFooter, focusFirstInvalid } from '@/components/dv/DvFormPage';
import { DvSectionCard } from '@/components/dv/DvSectionCard';
import { DvSelect } from '@/components/dv/DvSelect';
import { DvTextField } from '@/components/dv/DvTextField';
import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard';
import { campaignPath } from '@/lib/routes/paths';
import {
  createCampaignAction,
  updateCampaignAction,
  validateCampaignAction,
} from '@/lib/campaigns/actions';
import { KPI_LABEL } from '@/lib/campaigns/kpi';
import { addBudgetRows, isMoneyKpi, type CampaignWire, type WireIssue } from '@/lib/campaigns/wire';
import {
  CAMPAIGN_GOALS,
  CAMPAIGN_GOAL_LABEL,
  CAMPAIGN_KPI_UNIVERSE,
  RECOMMENDED_KPIS,
} from '@/lib/validation/constants/goals-kpis';
import { FREQ_PERIODS } from '@/lib/validation/constants/frequency';

export interface CampaignFormProps {
  mode: 'create' | 'edit';
  partnerId: string;
  advertiserId: string;
  currency: string;
  initial: CampaignWire;
  campaignId?: string;
  version?: number;
  startLocked?: boolean;
  readOnly?: boolean;
}

const CREATIVE_TYPES = [
  { value: 'DISPLAY', label: 'Display' },
  { value: 'VIDEO', label: 'Video' },
  { value: 'AUDIO', label: 'Audio' },
];

const issuesAt = (issues: WireIssue[], path: string, severity?: WireIssue['severity']) =>
  issues.find((i) => i.path === path && (!severity || i.severity === severity));

export function CampaignForm({
  mode,
  partnerId,
  advertiserId,
  currency,
  initial,
  campaignId,
  version,
  startLocked,
  readOnly,
}: CampaignFormProps) {
  const router = useRouter();
  const [value, setValue] = useState<CampaignWire>(initial);
  const [saved, setSaved] = useState<CampaignWire>(initial);
  const [issues, setIssues] = useState<WireIssue[]>([]);
  const [note, setNote] = useState('');
  const [busy, startTransition] = useTransition();
  const dirty = useMemo(() => JSON.stringify(value) !== JSON.stringify(saved), [value, saved]);
  useUnsavedGuard(dirty);

  const set = (patch: Partial<CampaignWire>) => setValue((v) => ({ ...v, ...patch }));
  const err = (path: string) => issuesAt(issues, path, 'error')?.message;
  const warn = (path: string) => issuesAt(issues, path, 'warning')?.message;
  const refreshWarnings = (next: CampaignWire) => {
    void validateCampaignAction(advertiserId, next, campaignId).then((all) =>
      setIssues((cur) => [
        ...cur.filter((i) => i.severity === 'error'),
        ...all.filter((i) => i.severity !== 'error'),
      ]),
    );
  };

  const kpiOptions = value.goal
    ? CAMPAIGN_KPI_UNIVERSE.map((k) => ({
        value: k,
        label: `${KPI_LABEL[k]}${RECOMMENDED_KPIS[value.goal!].includes(k) ? '' : ' (not recommended)'}`,
      }))
    : [];
  const kpiSuffix = value.kpi.type && !isMoneyKpi(value.kpi.type) ? '%' : undefined;

  const submit = () => {
    if (readOnly) return;
    startTransition(async () => {
      const res =
        mode === 'create'
          ? await createCampaignAction(advertiserId, value, { changeNote: note })
          : await updateCampaignAction(campaignId!, value, {
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
      if (mode === 'create') {
        const created = res.data as { publicId: string };
        router.push(campaignPath(partnerId, advertiserId, created.publicId));
      } else router.refresh();
    });
  };

  const errorCount = issues.filter((i) => i.severity === 'error').length;

  return (
    <Box component="form" noValidate onSubmit={(e) => e.preventDefault()}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {errorCount > 0 ? (
          <Typography role="alert" color="error">
            {errorCount} {errorCount === 1 ? 'error' : 'errors'}. Fix them to continue.
          </Typography>
        ) : null}

        <DvSectionCard title="Campaign name" layout="settings">
          <DvTextField
            label="Campaign name"
            required
            value={value.name}
            readOnly={readOnly}
            error={err('name')}
            onChange={(name) => set({ name })}
            id="name"
          />
        </DvSectionCard>

        <DvSectionCard title="Campaign goal" layout="settings">
          <DvSelect
            label="Campaign goal"
            placeholder="Choose goal"
            value={value.goal ?? ''}
            disabled={readOnly}
            error={err('goal')}
            options={CAMPAIGN_GOALS.map((g) => ({ value: g, label: CAMPAIGN_GOAL_LABEL[g] }))}
            onChange={(goal) => {
              const next = {
                ...value,
                goal: goal as CampaignWire['goal'],
                kpi: { type: null, value: '' as const },
              };
              setValue(next);
              refreshWarnings(next);
            }}
            id="goal"
          />
          <DvSelect
            label="Goal KPI"
            placeholder="Choose KPI"
            value={value.kpi.type ?? ''}
            disabled={readOnly || !value.goal}
            error={err('kpi.type')}
            warning={warn('kpi.type')}
            options={kpiOptions}
            onChange={(type) => {
              const next = {
                ...value,
                kpi: { ...value.kpi, type: type as CampaignWire['kpi']['type'] },
              };
              setValue(next);
              refreshWarnings(next);
            }}
            id="kpi-type"
          />
          <DvTextField
            label="KPI value"
            type="text"
            numeric
            prefix={kpiSuffix ? undefined : currency}
            suffix={kpiSuffix}
            value={String(value.kpi.value ?? '')}
            readOnly={readOnly}
            error={err('kpi.value')}
            onChange={(v) => set({ kpi: { ...value.kpi, value: v } })}
            id="kpi-value"
          />
        </DvSectionCard>

        <DvSectionCard title="Creative types" layout="settings">
          <DvCheckboxGroup
            label="Creative types"
            values={value.creativeTypes}
            readOnly={readOnly}
            error={err('creativeTypes')}
            options={CREATIVE_TYPES}
            onChange={(v) => set({ creativeTypes: v as CampaignWire['creativeTypes'] })}
          />
        </DvSectionCard>

        <DvSectionCard title="Flight dates" layout="settings">
          <DvTextField
            label="Start date"
            placeholder="YYYY-MM-DD"
            value={value.startDate ?? ''}
            locked={startLocked}
            readOnly={readOnly}
            error={err('startDate')}
            onChange={(startDate) => set({ startDate })}
            id="startDate"
          />
          <DvTextField
            label="End date (optional)"
            placeholder="YYYY-MM-DD"
            value={value.endDate ?? ''}
            readOnly={readOnly}
            error={err('endDate')}
            onChange={(endDate) => set({ endDate })}
            id="endDate"
          />
          <DvTextField
            label="Planned spend (optional)"
            numeric
            prefix={currency}
            value={String(value.plannedSpend ?? '')}
            readOnly={readOnly}
            error={err('plannedSpend')}
            onChange={(plannedSpend) => set({ plannedSpend })}
            id="plannedSpend"
          />
        </DvSectionCard>

        <DvSectionCard title="Frequency cap" layout="settings">
          <DvRadioGroup
            value={value.frequencyCap.mode === 'LIMITED' ? 'LIMITED' : 'UNLIMITED'}
            readOnly={readOnly}
            onChange={(m) =>
              set({ frequencyCap: { ...value.frequencyCap, mode: m as 'UNLIMITED' | 'LIMITED' } })
            }
            options={[
              { value: 'UNLIMITED', label: 'Unlimited' },
              {
                value: 'LIMITED',
                label: 'Limit frequency to',
                inline: (selected) => (
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <DvTextField
                      ariaLabel="Exposures"
                      numeric
                      disabled={!selected}
                      value={String(value.frequencyCap.maxImpressions ?? '')}
                      error={err('frequencyCap.maxImpressions')}
                      onChange={(v) =>
                        set({ frequencyCap: { ...value.frequencyCap, maxImpressions: v } })
                      }
                    />
                    <span>exposures per</span>
                    <DvSelect
                      value={value.frequencyCap.period ?? 'MONTH'}
                      disabled={!selected}
                      options={FREQ_PERIODS.map((p) => ({ value: p, label: p.toLowerCase() }))}
                      onChange={(p) =>
                        set({ frequencyCap: { ...value.frequencyCap, period: p as 'MONTH' } })
                      }
                    />
                  </Box>
                ),
              },
            ]}
          />
        </DvSectionCard>

        <DvSectionCard title="Additional budget details" layout="stacked">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {value.budgets.map((b, i) => (
              <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 1 }}>
                <DvTextField
                  ariaLabel={`Budget ${i + 1} name`}
                  placeholder="Name"
                  value={b.name ?? ''}
                  readOnly={readOnly}
                  error={err(`budgets.${i}.name`)}
                  onChange={(name) =>
                    set({ budgets: value.budgets.map((x, j) => (j === i ? { ...x, name } : x)) })
                  }
                />
                <DvTextField
                  ariaLabel={`Budget ${i + 1} amount`}
                  placeholder="Amount"
                  numeric
                  value={String(b.amount ?? '')}
                  readOnly={readOnly}
                  error={err(`budgets.${i}.amount`)}
                  onChange={(amount) =>
                    set({ budgets: value.budgets.map((x, j) => (j === i ? { ...x, amount } : x)) })
                  }
                />
                <DvTextField
                  ariaLabel={`Budget ${i + 1} start`}
                  placeholder="Start"
                  value={b.startDate ?? ''}
                  readOnly={readOnly}
                  error={err(`budgets.${i}.startDate`)}
                  onChange={(startDate) =>
                    set({
                      budgets: value.budgets.map((x, j) => (j === i ? { ...x, startDate } : x)),
                    })
                  }
                />
                <DvTextField
                  ariaLabel={`Budget ${i + 1} end`}
                  placeholder="End"
                  value={b.endDate ?? ''}
                  readOnly={readOnly}
                  error={err(`budgets.${i}.endDate`)}
                  onChange={(endDate) =>
                    set({ budgets: value.budgets.map((x, j) => (j === i ? { ...x, endDate } : x)) })
                  }
                />
              </Box>
            ))}
            {!readOnly ? (
              <Button
                sx={{ alignSelf: 'flex-start' }}
                onClick={() => set({ budgets: addBudgetRows(value.budgets) })}
              >
                Add Budgets
              </Button>
            ) : null}
          </Box>
        </DvSectionCard>
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
