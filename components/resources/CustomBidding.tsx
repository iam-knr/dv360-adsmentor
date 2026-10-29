'use client';

// Custom bidding (module 15 S7): the list page and the three-step wizard (Set up, Test, Save). Rules and
// multipliers only; the Script card stays disabled in v1 (RC-037).
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { Bar, BarChart, Tooltip as ChartTooltip, XAxis } from 'recharts';
import {
  DvBanner,
  DvChartCard,
  DvEmptyState,
  DvFormFooter,
  DvGrid,
  DvKpiTile,
  DvModal,
  DvPageHeader,
  DvRadioGroup,
  DvSectionCard,
  DvSelect,
  DvStepper,
  DvTextField,
  focusFirstInvalid,
  type DvColumn,
} from '@/components/dv';
import { useViewer } from '@/components/shell/ViewerProvider';
import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard';
import { AppLink } from '@/lib/routes/AppLink';
import { advertiserPath, partnerPath } from '@/lib/routes/paths';
import {
  deleteCustomBiddingAction,
  runCustomBiddingTestAction,
  saveCustomBiddingAction,
  saveCustomBiddingDraftAction,
  setCustomBiddingStatusAction,
  validateCustomBiddingAction,
} from '@/lib/resources/actions';
import {
  ACTIVITY_GROUP_KEY,
  ACTIVITY_SIGNAL_PREFIX,
  MAX_MULTIPLIERS,
  MULTIPLIER_DEFS,
  OBJECTIVES,
  RULE_GROUPS,
  multiplierDef,
  signalOf,
  type CbObjectiveKey,
} from '@/lib/engine/bidding/customBidding';
import type {
  CbDraftInput,
  CbRow,
  CbStatusKey,
  CbTestWire,
  CbView,
  OwnerScopeKey,
  WireIssue,
} from '@/lib/resources/wire';

export interface CbScopeProps {
  partnerId: string;
  /** Absent at partner level. */
  advertiserId?: string;
}

const listPathOf = ({ partnerId, advertiserId }: CbScopeProps) =>
  advertiserId
    ? advertiserPath(partnerId, advertiserId, 'custom-bidding')
    : partnerPath(partnerId, 'custom-bidding');

const itemPathOf = (s: CbScopeProps, id: string) =>
  s.advertiserId
    ? advertiserPath(s.partnerId, s.advertiserId, 'custom-bidding', id)
    : partnerPath(s.partnerId, 'custom-bidding', id);

const STATUS_LABEL: Record<CbStatusKey, string> = {
  ACTIVE: 'Active',
  TRAINING: 'Training',
  SUSPENDED: 'Suspended',
};

// ---------------------------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------------------------

export function CustomBiddingListPage({ rows, ...scope }: CbScopeProps & { rows: CbRow[] }) {
  const { viewer } = useViewer();
  const router = useRouter();
  const [promo, setPromo] = useState(true);
  const [page, setPage] = useState({ page: 1, size: 20 });
  const [toast, setToast] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<CbRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const newPath = itemPathOf(scope, 'new');
  const rowPath = (id: string) => itemPathOf(scope, id);

  const counts = useMemo(() => {
    const by = { ACTIVE: 0, TRAINING: 0, SUSPENDED: 0 };
    for (const r of rows) by[r.status] += 1;
    return by;
  }, [rows]);
  const withErrors = rows.filter((r) => r.errorPct > 1).length;

  const toggle = (r: CbRow) =>
    start(async () => {
      const res = await setCustomBiddingStatusAction(
        r.id,
        r.status === 'SUSPENDED' ? 'ACTIVATE' : 'SUSPEND',
      );
      if (!res.ok) return setError(res.issues[0]?.message ?? 'Could not change the status.');
      setToast(res.warnings?.[0]?.message ?? null);
      router.refresh();
    });
  const remove = (r: CbRow) =>
    start(async () => {
      const res = await deleteCustomBiddingAction(r.id);
      if (!res.ok) return setError(res.issues[0]?.message ?? 'Could not delete.');
      if (!res.data.deleted) {
        setError(res.warnings?.[0]?.message ?? 'This algorithm is in use.');
      }
      setConfirm(null);
      router.refresh();
    });

  const columns: DvColumn<CbRow>[] = [
    {
      id: 'name',
      header: 'Name',
      sticky: true,
      cell: (r) => <AppLink href={rowPath(r.id)}>{r.name}</AppLink>,
    },
    { id: 'id', header: 'Id', accessor: (r) => r.id },
    {
      id: 'source',
      header: 'Source',
      accessor: (r) =>
        r.source === 'RULES' ? 'Rule based' : r.source === 'SCRIPT' ? 'Script' : 'Goal',
    },
    {
      id: 'owner',
      header: 'Owner',
      accessor: (r) => (r.ownerScope === 'PARTNER' ? 'Partner' : 'Advertiser'),
    },
    { id: 'status', header: 'Status', accessor: (r) => STATUS_LABEL[r.status] },
    {
      id: 'readiness',
      header: 'Model Readiness',
      type: 'percent',
      align: 'right',
      accessor: (r) => r.readinessPct,
    },
    {
      id: 'updated',
      header: 'Updated',
      accessor: (r) => r.updatedAt.slice(0, 10),
    },
    {
      id: 'activeLis',
      header: '# of line items active',
      type: 'number',
      align: 'right',
      accessor: (r) => r.activeLineItems,
    },
    {
      id: 'errors',
      header: '% of errors encountered',
      align: 'right',
      accessor: (r) => `${r.errorPct}%`,
    },
    {
      id: 'actions',
      header: '',
      cell: (r) =>
        viewer.readOnly ? null : (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" href={rowPath(r.id)}>
              Edit
            </Button>
            <Button size="small" onClick={() => toggle(r)}>
              {r.status === 'SUSPENDED' ? 'Activate' : 'Suspend'}
            </Button>
            <Button size="small" color="error" onClick={() => setConfirm(r)}>
              Delete
            </Button>
          </Box>
        ),
    },
  ];

  return (
    <>
      <DvPageHeader
        title="Custom bidding"
        limitedAccess={viewer.limitedAccess}
        actions={
          <Button variant="contained" disabled={viewer.readOnly} href={newPath}>
            New algorithm
          </Button>
        }
      />
      {promo ? (
        <DvBanner kind="info" level="inline" onDismiss={() => setPromo(false)}>
          Custom bidding scores every impression with your own rules and multipliers. Build an
          algorithm, test it on a sample of your supply, then attach it to a line item.
        </DvBanner>
      ) : null}
      {error ? (
        <DvBanner kind="error" level="inline" onDismiss={() => setError(null)}>
          {error}
        </DvBanner>
      ) : null}
      {toast ? (
        <DvBanner kind="warning" level="inline" onDismiss={() => setToast(null)}>
          {toast}
        </DvBanner>
      ) : null}
      <Typography variant="h6" component="h2" sx={{ mt: 4, mb: 2 }}>
        Summary
      </Typography>
      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 4 }}>
        <DvKpiTile label="Active algorithms" value={counts.ACTIVE} />
        <DvKpiTile label="Training algorithms" value={counts.TRAINING} accent="warning" />
        <DvKpiTile label="Suspended algorithms" value={counts.SUSPENDED} />
        <DvKpiTile label="Algorithms with errors" value={withErrors} accent="error" />
      </Box>
      <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
        Execution
      </Typography>
      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 4 }}>
        <DvKpiTile
          label="Line items using an algorithm"
          value={rows.reduce((n, r) => n + r.activeLineItems, 0)}
        />
        <DvKpiTile
          label="Ready to bid (readiness 100%)"
          value={rows.filter((r) => r.readinessPct >= 100).length}
        />
      </Box>
      <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
        My algorithms
      </Typography>
      <DvGrid
        ariaLabel="Custom bidding algorithms"
        rows={rows.slice((page.page - 1) * page.size, page.page * page.size)}
        columns={columns}
        getRowId={(r) => r.id}
        page={page.page}
        pageSize={page.size}
        total={rows.length}
        onPageChange={(p, size) => setPage({ page: p, size })}
        emptyState={<DvEmptyState message="No custom bidding algorithms yet" />}
      />
      <DvModal
        open={confirm !== null}
        title="Delete algorithm"
        primary={{ label: 'Delete', tone: 'danger', onClick: () => confirm && remove(confirm) }}
        secondary={{ label: 'Cancel', onClick: () => setConfirm(null) }}
        onClose={() => setConfirm(null)}
      >
        Delete {confirm?.name}? An algorithm that line items use cannot be deleted.
      </DvModal>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Wizard
// ---------------------------------------------------------------------------------------------

interface RuleDraft {
  groupKey: string;
  signalKey: string;
  value: 'true' | 'false';
  score: string;
}

interface MultiplierDraft {
  kind: string;
  values: Record<string, string>;
}

type StepId = 'setup' | 'test' | 'save';
const STEPS: { id: StepId; label: string }[] = [
  { id: 'setup', label: 'Set up' },
  { id: 'test', label: 'Test' },
  { id: 'save', label: 'Save' },
];

function groupOfSignal(objective: CbObjectiveKey, signalKey: string): string {
  if (signalKey.startsWith(ACTIVITY_SIGNAL_PREFIX)) return ACTIVITY_GROUP_KEY;
  return (
    RULE_GROUPS[objective].find((g) => g.signals.some((s) => s.key === signalKey))?.groupKey ?? ''
  );
}

function blankMultiplier(kind: string): MultiplierDraft {
  const def = MULTIPLIER_DEFS.find((d) => d.kind === kind);
  return { kind, values: Object.fromEntries((def?.options ?? []).map((o) => [o.key, '1'])) };
}

function initialMultipliers(view: CbView | null): MultiplierDraft[] {
  return (view?.multipliers ?? []).map((m) => {
    const base = blankMultiplier(m.kind);
    for (const v of m.values) base.values[v.valueKey] = String(v.multiplier);
    return base;
  });
}

export function CustomBiddingWizard({
  initial,
  initialStep,
  activities,
  ...scope
}: CbScopeProps & {
  initial: CbView | null;
  initialStep: StepId;
  activities: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { viewer } = useViewer();
  const listPath = listPathOf(scope);
  const resourceScope = scope.advertiserId
    ? ({ level: 'advertiser', id: scope.advertiserId } as const)
    : ({ level: 'partner', id: scope.partnerId } as const);

  const [name, setName] = useState(initial?.name ?? '');
  const [objective, setObjective] = useState<CbObjectiveKey | ''>(initial?.objective ?? '');
  const [rules, setRules] = useState<RuleDraft[]>(
    (initial?.rules ?? []).map((r) => ({
      groupKey: r.groupKey,
      signalKey: r.signalKey,
      value: r.value ? 'true' : 'false',
      score: String(r.score),
    })),
  );
  const [multipliers, setMultipliers] = useState<MultiplierDraft[]>(initialMultipliers(initial));
  const [id, setId] = useState<string | null>(initial?.id ?? null);
  const [version, setVersion] = useState(initial?.version ?? 0);
  const [isDraft, setIsDraft] = useState(initial?.isDraft ?? true);
  const [test, setTest] = useState<CbTestWire | null>(initial?.lastTest ?? null);
  const [owner, setOwner] = useState<OwnerScopeKey>(initial?.ownerScope ?? 'ADVERTISER');
  const [issues, setIssues] = useState<WireIssue[]>([]);
  const [stepIdx, setStepIdx] = useState(() => {
    const want = STEPS.findIndex((s) => s.id === initialStep);
    if (!initial || want <= 0) return 0;
    return want === 2 && !initial.lastTest ? 1 : want;
  });
  const [saved, setSaved] = useState(false);
  const [resetNote, setResetNote] = useState(false);
  const [busy, start] = useTransition();

  const dirty = !saved && (id === null ? name !== '' || rules.length > 0 : false);
  useUnsavedGuard(dirty);

  const objectiveKey = objective || null;
  const err = (p: string) => issues.find((i) => i.severity === 'error' && i.path === p)?.message;

  const signalOptions = useMemo(() => {
    if (!objectiveKey) return [];
    const base = RULE_GROUPS[objectiveKey].flatMap((g) =>
      g.signals.map((s) => ({ value: s.key, label: `${g.groupKey}: ${s.label}` })),
    );
    const withActivities =
      objectiveKey === 'CONVERSIONS' || objectiveKey === 'CUSTOM'
        ? activities.map((a) => ({
            value: `${ACTIVITY_SIGNAL_PREFIX}${a.id}`,
            label: `Conversion rules: Floodlight activity ${a.name}`,
          }))
        : [];
    return [...base, ...withActivities];
  }, [objectiveKey, activities]);

  const toInput = (): CbDraftInput => ({
    ...(id ? { id } : {}),
    name,
    objective: objectiveKey,
    rules: rules.map((r) => ({
      groupKey: r.groupKey,
      signalKey: r.signalKey,
      value: r.value === 'true',
      score: r.score as unknown as number,
    })),
    multipliers: multipliers.map((m) => ({
      kind: m.kind,
      values: Object.entries(m.values).map(([valueKey, multiplier]) => ({
        valueKey,
        multiplier: multiplier as unknown as number,
      })),
    })),
  });

  const changeObjective = (next: string) => {
    setObjective(next as CbObjectiveKey);
    // Rules from another objective's groups no longer apply.
    setRules((prev) =>
      prev.filter(
        (r) => signalOf(r.signalKey) !== null && signalAllows(next as CbObjectiveKey, r.signalKey),
      ),
    );
  };

  const addRule = () => {
    if (!objectiveKey) {
      setIssues([
        {
          path: 'objective',
          severity: 'error',
          code: 'CB-002',
          message: 'A selection is required',
        },
      ]);
      return;
    }
    const first = signalOptions[0]?.value;
    if (!first) return;
    setRules((prev) => [
      ...prev,
      { groupKey: groupOfSignal(objectiveKey, first), signalKey: first, value: 'true', score: '1' },
    ]);
  };

  /** Keep `?step=` in the address so a refresh lands on the same step (module 15 S7). */
  const goStep = (idx: number, algorithmId: string | null = id) => {
    setStepIdx(idx);
    if (algorithmId) {
      router.replace(`${itemPathOf(scope, algorithmId)}?step=${STEPS[idx]!.id}`, { scroll: false });
    }
  };

  const next = () =>
    start(async () => {
      if (stepIdx === 0) {
        const res = await saveCustomBiddingDraftAction(
          resourceScope,
          toInput(),
          id ? { expectedVersion: version } : undefined,
        );
        if (!res.ok) {
          setIssues(res.issues);
          setTimeout(() => focusFirstInvalid(), 0);
          return;
        }
        setIssues([]);
        setId(res.data.id);
        setVersion(res.data.version);
        if (res.data.reset) setResetNote(true);
        // Any edit that changed the definition cleared the test (CB-008).
        if (res.data.changed) setTest(null);
        goStep(1, res.data.id);
        return;
      }
      if (stepIdx === 1) goStep(2);
    });

  const runTest = () =>
    start(async () => {
      if (!id) return;
      const res = await runCustomBiddingTestAction(id);
      if (!res.ok) return setIssues(res.issues);
      setIssues([]);
      setTest(res.data);
    });

  const save = (activate: boolean) =>
    start(async () => {
      if (!id) return;
      const res = await saveCustomBiddingAction(
        id,
        { ownerScope: scope.advertiserId ? owner : 'PARTNER', activate },
        { expectedVersion: version },
      );
      if (!res.ok) return setIssues(res.issues);
      setSaved(true);
      setIsDraft(false);
      router.push(listPath);
      router.refresh();
    });

  const blurName = () =>
    start(async () => {
      const all = await validateCustomBiddingAction(resourceScope, toInput());
      setIssues(all.filter((i) => i.path === 'name'));
    });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <DvStepper steps={STEPS.map((s) => ({ id: s.id, label: s.label }))} current={stepIdx} />
      {initial && !initial.isDraft && initial.status === 'ACTIVE' && stepIdx === 0 ? (
        <DvBanner kind="warning" level="inline">
          Editing the rules of an active algorithm resets it to Training and you need to test it
          again.
        </DvBanner>
      ) : null}
      {resetNote && stepIdx === 1 ? (
        <DvBanner kind="info" level="inline">
          The algorithm was reset to Training because its rules changed.
        </DvBanner>
      ) : null}

      {stepIdx === 0 ? (
        <Box
          component="form"
          noValidate
          onSubmit={(e) => e.preventDefault()}
          sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}
        >
          <DvSectionCard title="Set up" layout="settings">
            <Typography variant="body2">
              Score impressions with signals such as Active View, time on screen and player size.
            </Typography>
            <DvTextField
              label="Name"
              required
              id="custom-bidding-name"
              value={name}
              readOnly={viewer.readOnly}
              error={err('name')}
              onChange={setName}
              onBlur={blurName}
            />
            <DvRadioGroup
              label="Select an objective"
              variant="cards"
              value={objective}
              error={err('objective')}
              disabled={viewer.readOnly}
              onChange={changeObjective}
              options={[
                ...OBJECTIVES.map((o) => ({
                  value: o.key,
                  label: o.label,
                  description: o.description,
                })),
              ]}
            />
            <Box
              sx={{
                border: '1px dashed',
                borderColor: 'divider',
                borderRadius: 1,
                p: 3,
                opacity: 0.7,
              }}
            >
              <Typography variant="body2">
                <strong>Script</strong>: Scripts are not available in the classroom.
              </Typography>
            </Box>
          </DvSectionCard>

          <DvSectionCard title="Rules" layout="settings">
            <Typography variant="body2">Match ANY of the following</Typography>
            {rules.map((r, i) => (
              <Box
                key={i}
                sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', flexWrap: 'wrap' }}
              >
                <Box sx={{ minWidth: 300 }}>
                  <DvSelect
                    ariaLabel={`Rule ${i + 1} signal`}
                    value={r.signalKey}
                    options={signalOptions}
                    disabled={viewer.readOnly}
                    onChange={(v) =>
                      setRules((prev) =>
                        prev.map((x, j) =>
                          j === i && objectiveKey
                            ? { ...x, signalKey: v, groupKey: groupOfSignal(objectiveKey, v) }
                            : x,
                        ),
                      )
                    }
                  />
                </Box>
                <Box sx={{ width: 120 }}>
                  <DvSelect
                    ariaLabel={`Rule ${i + 1} value`}
                    value={r.value}
                    options={[
                      { value: 'true', label: 'True' },
                      { value: 'false', label: 'False' },
                    ]}
                    disabled={viewer.readOnly}
                    onChange={(v) =>
                      setRules((prev) =>
                        prev.map((x, j) => (j === i ? { ...x, value: v as 'true' | 'false' } : x)),
                      )
                    }
                  />
                </Box>
                <Box sx={{ width: 100 }}>
                  <DvTextField
                    ariaLabel={`Rule ${i + 1} score`}
                    numeric
                    value={r.score}
                    readOnly={viewer.readOnly}
                    error={err(`rules[${i}].score`)}
                    onChange={(v) =>
                      setRules((prev) => prev.map((x, j) => (j === i ? { ...x, score: v } : x)))
                    }
                  />
                </Box>
                {viewer.readOnly ? null : (
                  <Button
                    aria-label={`Remove rule ${i + 1}`}
                    onClick={() => setRules((prev) => prev.filter((_, j) => j !== i))}
                  >
                    Remove
                  </Button>
                )}
              </Box>
            ))}
            {err('rules') ? (
              <Typography role="alert" color="error" variant="body2">
                {err('rules')}
              </Typography>
            ) : null}
            {viewer.readOnly ? null : (
              <Button sx={{ alignSelf: 'flex-start' }} onClick={addRule}>
                Add rule
              </Button>
            )}
          </DvSectionCard>

          <DvSectionCard title="Multipliers" layout="settings">
            <Typography variant="body2">
              Multipliers scale the score of impressions that share an attribute. Add up to{' '}
              {MAX_MULTIPLIERS}.
            </Typography>
            {multipliers.map((m, i) => {
              const def = multiplierDef(
                (MULTIPLIER_DEFS.some((d) => d.kind === m.kind) ? m.kind : 'AD_POSITION') as never,
              );
              return (
                <Box
                  key={i}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
                    <Box sx={{ minWidth: 260 }}>
                      <DvSelect
                        ariaLabel={`Multiplier ${i + 1} type`}
                        value={m.kind}
                        error={err(`multipliers[${i}].kind`)}
                        disabled={viewer.readOnly}
                        options={MULTIPLIER_DEFS.map((d) => ({ value: d.kind, label: d.label }))}
                        onChange={(kind) =>
                          setMultipliers((prev) =>
                            prev.map((x, j) => (j === i ? blankMultiplier(kind) : x)),
                          )
                        }
                      />
                    </Box>
                    {viewer.readOnly ? null : (
                      <Button
                        aria-label={`Remove multiplier ${i + 1}`}
                        onClick={() => setMultipliers((prev) => prev.filter((_, j) => j !== i))}
                      >
                        Remove
                      </Button>
                    )}
                  </Box>
                  <Box
                    component="table"
                    aria-label={`${def.label} factors`}
                    sx={{ borderCollapse: 'collapse', maxWidth: 480 }}
                  >
                    <tbody>
                      {def.options.map((o, j) => (
                        <tr key={o.key}>
                          <td>{o.label}</td>
                          <td style={{ width: 110 }}>
                            <DvTextField
                              ariaLabel={`${def.label} ${o.label} factor`}
                              numeric
                              value={m.values[o.key] ?? '1'}
                              readOnly={viewer.readOnly}
                              error={err(`multipliers[${i}].values[${j}].multiplier`)}
                              onChange={(v) =>
                                setMultipliers((prev) =>
                                  prev.map((x, k) =>
                                    k === i ? { ...x, values: { ...x.values, [o.key]: v } } : x,
                                  ),
                                )
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Box>
                </Box>
              );
            })}
            {err('multipliers') ? (
              <Typography role="alert" color="error" variant="body2">
                {err('multipliers')}
              </Typography>
            ) : null}
            {viewer.readOnly ? null : (
              <Button
                sx={{ alignSelf: 'flex-start' }}
                onClick={() => {
                  const used = new Set(multipliers.map((m) => m.kind));
                  const kind =
                    MULTIPLIER_DEFS.find((d) => !used.has(d.kind))?.kind ?? 'AD_POSITION';
                  setMultipliers((prev) => [...prev, blankMultiplier(kind)]);
                }}
              >
                Add multiplier
              </Button>
            )}
          </DvSectionCard>
        </Box>
      ) : null}

      {stepIdx === 1 ? (
        <DvSectionCard title="Test" layout="settings">
          <Typography variant="body2">
            The test scores a sample of impressions drawn from your line items and shows how many
            your rules match.
          </Typography>
          {viewer.readOnly ? null : (
            <Button
              variant="contained"
              sx={{ alignSelf: 'flex-start' }}
              disabled={busy}
              onClick={runTest}
            >
              {test ? 'Run test again' : 'Run test'}
            </Button>
          )}
          {err('test') ? (
            <Typography role="alert" color="error" variant="body2">
              {err('test')}
            </Typography>
          ) : null}
          {test ? <TestResult test={test} /> : null}
        </DvSectionCard>
      ) : null}

      {stepIdx === 2 ? (
        <DvSectionCard title="Save" layout="settings">
          <Typography variant="body2">
            <strong>{name}</strong> · {OBJECTIVES.find((o) => o.key === objective)?.label} ·{' '}
            {rules.length} {rules.length === 1 ? 'rule' : 'rules'} · {multipliers.length}{' '}
            {multipliers.length === 1 ? 'multiplier' : 'multipliers'}
          </Typography>
          {isDraft && scope.advertiserId ? (
            <DvRadioGroup
              label="Owner"
              value={owner}
              onChange={(v) => setOwner(v as OwnerScopeKey)}
              options={[
                { value: 'ADVERTISER', label: 'Advertiser' },
                { value: 'PARTNER', label: 'Partner' },
              ]}
            />
          ) : (
            <Typography variant="body2">
              Owner:{' '}
              {initial?.ownerScope === 'PARTNER' || !scope.advertiserId ? 'Partner' : 'Advertiser'}
            </Typography>
          )}
          <Typography variant="body2">
            The algorithm starts in Training and becomes Active when its model readiness reaches
            100%.
          </Typography>
          {err('test') ? (
            <Typography role="alert" color="error" variant="body2">
              {err('test')}
            </Typography>
          ) : null}
        </DvSectionCard>
      ) : null}

      {viewer.readOnly ? (
        <Typography variant="body2">You have view-only access to this algorithm.</Typography>
      ) : stepIdx === 2 ? (
        <DvFormFooter
          mode="create"
          dirty
          primaryLabel="Save"
          onPrimary={() => save(false)}
          onSecondary={() => router.push(listPath)}
          extraRight={
            <Button disabled={busy} onClick={() => save(true)}>
              Save and activate
            </Button>
          }
        />
      ) : (
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          {stepIdx > 0 ? (
            <Button onClick={() => goStep(stepIdx - 1)}>Back</Button>
          ) : (
            <Button onClick={() => router.push(listPath)}>Cancel</Button>
          )}
          <Button variant="contained" disabled={busy || (stepIdx === 1 && !test)} onClick={next}>
            Next
          </Button>
        </Box>
      )}
    </Box>
  );
}

function signalAllows(objective: CbObjectiveKey, signalKey: string): boolean {
  if (signalKey.startsWith(ACTIVITY_SIGNAL_PREFIX)) {
    return objective === 'CONVERSIONS' || objective === 'CUSTOM';
  }
  return RULE_GROUPS[objective].some((g) => g.signals.some((s) => s.key === signalKey));
}

function TestResult({ test }: { test: CbTestWire }) {
  const data = test.histogram.map((count, i) => ({ bin: String(i + 1), count }));
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography role="status" variant="subtitle1">
        {test.passed ? 'Passed ✓' : 'Needs review'}
      </Typography>
      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        <DvKpiTile label="Sample size" value={test.sampleSize.toLocaleString('en-US')} />
        <DvKpiTile label="Matched by a rule" value={`${test.matchedPct}%`} />
        <DvKpiTile label="Mean score" value={test.meanScore} />
        <DvKpiTile label="90th percentile score" value={test.p90Score} />
      </Box>
      <DvChartCard
        title="Score histogram"
        empty={test.histogram.length === 0 ? 'No scored impressions' : undefined}
      >
        <BarChart width={264} height={120} data={data}>
          <XAxis dataKey="bin" hide />
          <ChartTooltip />
          <Bar dataKey="count" fill="#1a73e8" isAnimationActive={false} />
        </BarChart>
      </DvChartCard>
      {test.warnings.length > 0 ? (
        <Box component="ul" aria-label="Test warnings" sx={{ m: 0, pl: 4 }}>
          {test.warnings.map((w, i) => (
            <li key={i}>
              <Typography variant="body2" color={w.kind === 'HARD' ? 'error' : 'text.secondary'}>
                {w.message}
              </Typography>
            </li>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
