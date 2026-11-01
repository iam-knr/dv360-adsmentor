'use client';

// New campaign and Campaign settings (module 06 2.2, 2.4). One form for both: create sends `createCampaignAction`,
// edit sends `updateCampaignAction` with `expectedVersion`. Validation runs on the server (lib/validation) and the
// issues come back by field path, so the messages are the catalogue's, verbatim.
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { DvBanner } from '@/components/dv/DvBanner';
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
import { realFormIssues } from '@/lib/campaigns/form-issues';
import { KPI_LABEL } from '@/lib/campaigns/kpi';
import {
  addBudgetRows,
  applyCopySource,
  parseKeywords,
  type CampaignWire,
  type WireIssue,
} from '@/lib/campaigns/wire';
import { CopySettingsDialog } from './CopySettingsDialog';
import { StaleSaveDialog } from './StaleSaveDialog';
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
  /** New campaign: show the paused-advertiser banner. */
  advertiserPaused?: boolean;
}

const CREATIVE_TYPES = [
  { value: 'DISPLAY', label: 'Display' },
  { value: 'VIDEO', label: 'Video' },
  { value: 'AUDIO', label: 'Audio' },
];

/** "₹" for INR: the narrow symbol of the currency code. */
function currencySymbol(code: string): string {
  try {
    return (
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: code,
        currencyDisplay: 'narrowSymbol',
      })
        .formatToParts(0)
        .find((p) => p.type === 'currency')?.value ?? code
    );
  } catch {
    return code;
  }
}

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
  advertiserPaused,
}: CampaignFormProps) {
  const router = useRouter();
  const [value, setValue] = useState<CampaignWire>(initial);
  const [saved, setSaved] = useState<CampaignWire>(initial);
  const [issues, setIssues] = useState<WireIssue[]>([]);
  const [note, setNote] = useState('');
  const [busy, startTransition] = useTransition();
  const [copyOpen, setCopyOpen] = useState(false);
  const [stale, setStale] = useState(false);
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

  const kpiOptions = CAMPAIGN_KPI_UNIVERSE.map((k) => ({
    value: k,
    label: `${KPI_LABEL[k]}${value.goal && !RECOMMENDED_KPIS[value.goal].includes(k) ? ' (not recommended)' : ''}`,
  }));
  const symbol = currencySymbol(currency);
  const [keywordsText, setKeywordsText] = useState(initial.keywords.join(', '));

  const submit = (overwrite = false) => {
    if (readOnly) return;
    startTransition(async () => {
      const res =
        mode === 'create'
          ? await createCampaignAction(advertiserId, value, { changeNote: note })
          : await updateCampaignAction(campaignId!, value, {
              changeNote: note,
              ...(version !== undefined && !overwrite ? { expectedVersion: version } : {}),
            });
      if (!res.ok) {
        if (res.code === 'CONFLICT') {
          setStale(true);
          return;
        }
        setIssues(mode === 'create' ? realFormIssues(res.issues, value) : res.issues);
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

  const budgetRows = (
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
              set({ budgets: value.budgets.map((x, j) => (j === i ? { ...x, startDate } : x)) })
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
  );

  const heading = (text: string, optional = false) => (
    <Typography variant="subtitle1" component="h3" sx={{ mb: 1 }}>
      {text}
      {optional ? (
        <Typography variant="caption" component="span" sx={{ ml: 1 }}>
          (Optional)
        </Typography>
      ) : null}
    </Typography>
  );

  const urls = value.landingPageUrls.length ? value.landingPageUrls : [''];

  return (
    <Box component="form" noValidate onSubmit={(e) => e.preventDefault()}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {mode === 'create' && advertiserPaused ? (
          <DvBanner kind="warning" level="inline">
            This advertiser is paused. Campaigns you create here will not serve until the advertiser
            is active again.
          </DvBanner>
        ) : null}
        {mode === 'create' ? (
          <DvBanner kind="info" level="inline">
            Inventory source and Targeting settings are now managed at the line item level. Use
            targeting templates for easy reuse.
          </DvBanner>
        ) : null}

        <DvSectionCard layout="stacked">
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
            <Box sx={{ flex: 1, maxWidth: 480 }}>
              <DvTextField
                label="Campaign name"
                placeholder="Enter name"
                value={value.name}
                readOnly={readOnly}
                error={err('name')}
                onChange={(name) => set({ name })}
                id="name"
              />
            </Box>
            {mode === 'create' ? (
              <Box sx={{ width: 160 }}>
                <DvSelect
                  label="Status"
                  ariaLabel="Status"
                  value={value.status ?? 'ACTIVE'}
                  disabled={readOnly}
                  options={[
                    { value: 'ACTIVE', label: 'Active' },
                    { value: 'PAUSED', label: 'Paused' },
                  ]}
                  error={err('status')}
                  onChange={(status) => set({ status: status as CampaignWire['status'] })}
                  id="status"
                />
              </Box>
            ) : null}
          </Box>
          {mode === 'create' && !readOnly ? (
            <Button sx={{ alignSelf: 'flex-start', mt: 1 }} onClick={() => setCopyOpen(true)}>
              Copy settings from an existing campaign
            </Button>
          ) : null}
        </DvSectionCard>

        <DvSectionCard layout="stacked" gearNote="These settings don't impact serving.">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <Box sx={{ maxWidth: 480 }}>
              <DvSelect
                label="Overall campaign goal"
                help="The main objective of this campaign. It guides the KPI and the optimization suggestions."
                placeholder="Select an option"
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
            </Box>
            <Box sx={{ maxWidth: 480 }}>
              <DvSelect
                label="KPI"
                help="The measure you use to judge whether the campaign reaches its goal."
                placeholder="Select an option"
                value={value.kpi.type ?? ''}
                disabled={readOnly}
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
            </Box>

            <Box>
              <DvCheckboxGroup
                label="Creative type you expect to use"
                values={value.creativeTypes}
                readOnly={readOnly}
                error={err('creativeTypes')}
                options={CREATIVE_TYPES}
                onChange={(v) => set({ creativeTypes: v as CampaignWire['creativeTypes'] })}
              />
            </Box>

            <Box sx={{ maxWidth: 480 }}>
              <DvTextField
                label="Planned spend"
                hint="Optional"
                numeric
                prefix={symbol}
                suffix={currency}
                value={String(value.plannedSpend ?? '')}
                readOnly={readOnly}
                error={err('plannedSpend')}
                onChange={(plannedSpend) => set({ plannedSpend })}
                id="plannedSpend"
              />
            </Box>

            <Box>
              {heading('Planned dates')}
              <Box sx={{ display: 'flex', gap: 3, maxWidth: 480 }}>
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
              </Box>
            </Box>

            <Box>
              {heading('Additional budget details')}
              {budgetRows}
            </Box>

            <Box>
              {heading('Frequency cap')}
              <DvRadioGroup
                value={value.frequencyCap.mode === 'LIMITED' ? 'LIMITED' : 'UNLIMITED'}
                readOnly={readOnly}
                onChange={(m) =>
                  set({
                    frequencyCap: { ...value.frequencyCap, mode: m as 'UNLIMITED' | 'LIMITED' },
                  })
                }
                options={[
                  { value: 'UNLIMITED', label: 'No limit' },
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
                          ariaLabel="Period"
                          value={value.frequencyCap.period ?? 'MONTH'}
                          disabled={!selected}
                          options={FREQ_PERIODS.map((p) => ({
                            value: p,
                            label: p.charAt(0) + p.slice(1).toLowerCase(),
                          }))}
                          onChange={(p) =>
                            set({
                              frequencyCap: {
                                ...value.frequencyCap,
                                period: p as NonNullable<CampaignWire['frequencyCap']['period']>,
                              },
                            })
                          }
                        />
                      </Box>
                    ),
                  },
                ]}
              />
              <Typography variant="caption" component="p" sx={{ mt: 1 }}>
                You can also set specific frequency caps on each insertion order and line item in
                this campaign.
              </Typography>
            </Box>

            <Box>
              {heading('Additional details')}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 480 }}>
                <Box>
                  <Typography variant="body2" component="p" sx={{ fontWeight: 500, mb: 1 }}>
                    Landing page URLs{' '}
                    <Typography variant="caption" component="span">
                      (Optional)
                    </Typography>
                  </Typography>
                  {urls.map((u, i) => (
                    <Box key={i} sx={{ mb: 1 }}>
                      <DvTextField
                        ariaLabel={`Landing page URL ${i + 1}`}
                        placeholder="https://"
                        value={u}
                        readOnly={readOnly}
                        error={err(`landingPageUrls.${i}`)}
                        onChange={(next) =>
                          set({ landingPageUrls: urls.map((x, j) => (j === i ? next : x)) })
                        }
                      />
                    </Box>
                  ))}
                  {!readOnly ? (
                    <Button
                      sx={{ alignSelf: 'flex-start' }}
                      onClick={() => set({ landingPageUrls: [...urls, ''] })}
                    >
                      Add another url
                    </Button>
                  ) : null}
                </Box>
                <DvTextField
                  label="Keywords"
                  placeholder="Add keywords separated by a comma"
                  hint="Enter up to 5 keywords to help improve recommendations."
                  value={keywordsText}
                  readOnly={readOnly}
                  error={err('keywords')}
                  onChange={(text) => {
                    setKeywordsText(text);
                    set({ keywords: parseKeywords(text) });
                  }}
                  id="keywords"
                />
              </Box>
            </Box>
          </Box>
        </DvSectionCard>

        {mode === 'create' && !readOnly ? (
          <Box sx={{ display: 'flex', gap: 2, pb: 4 }}>
            <Button variant="contained" disabled={busy} onClick={() => submit()}>
              {busy ? 'Saving…' : 'Create'}
            </Button>
            <Button variant="outlined" onClick={() => router.back()}>
              Cancel
            </Button>
          </Box>
        ) : null}
      </Box>
      {mode === 'edit' && !readOnly ? (
        <DvFormFooter
          mode={mode}
          dirty={dirty}
          primaryLabel={busy ? 'Saving…' : undefined}
          onPrimary={() => submit()}
          onSecondary={() => router.back()}
          onReset={() => {
            setValue(saved);
            setIssues([]);
          }}
          {...(mode === 'edit' ? { note, onNoteChange: setNote } : {})}
        />
      ) : null}
      {mode === 'create' ? (
        <CopySettingsDialog
          open={copyOpen}
          advertiserId={advertiserId}
          onCancel={() => setCopyOpen(false)}
          onCopy={(source, settings) => {
            setValue((v) => applyCopySource(v, source, settings));
            setCopyOpen(false);
          }}
        />
      ) : null}
      <StaleSaveDialog
        open={stale}
        onReload={() => {
          setStale(false);
          window.location.reload();
        }}
        onKeep={() => {
          setStale(false);
          submit(true);
        }}
      />
    </Box>
  );
}
