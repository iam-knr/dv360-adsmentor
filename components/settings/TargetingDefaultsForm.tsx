'use client';

// Partner targeting defaults (module 02 2.5, S5): Inventory source summaries and four targeting rows, each with a
// pencil that opens the shared editor (module 07). Save persists the rows as ownerType PARTNER.
import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { DvBanner, DvFormFooter, DvSectionCard, DvSlideOver, useToast } from '@/components/dv';
import { DvIcon } from '@/components/icons';
import { EditorBody, editorError } from '@/components/targeting/editors/editors';
import { advancedEditorError, ADVANCED_WIDTH } from '@/components/targeting/editors/registry';
import { useTargetingEditorContext } from '@/components/targeting/editors/apps-urls/context';
import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard';
import { saveTargetingDefaultsAction } from '@/lib/settings/actions';
import type { TargetingDefaults } from '@/lib/settings/targeting-defaults';
import { CRITERIA_OF, defaultCriteria, summarizeTargeting } from '@/lib/targeting';
import type { TargetingCriteria } from '@/lib/targeting/types';
import type { MatrixDimension } from '@/lib/validation/constants/targeting-availability';
import { CheckRow, errorMap, SettingsPage } from './shared';

const LI_TYPE = 'DISPLAY';

const ROWS: { dim: MatrixDimension; label: string; empty: string }[] = [
  { dim: 'GEOGRAPHY', label: 'Geography', empty: 'All locations' },
  { dim: 'ENVIRONMENT', label: 'Environment', empty: 'No restrictions for environment' },
  { dim: 'POSITION', label: 'Position', empty: 'All positions selected' },
  { dim: 'APPS_URLS', label: 'Apps & URLs', empty: 'No restrictions' },
];

export function TargetingDefaultsForm({
  partnerId,
  initial,
}: {
  partnerId: string;
  initial: TargetingDefaults;
}) {
  const toast = useToast();
  const [saved, setSaved] = useState({
    criteria: initial.state.criteria,
    auto: initial.autoEnableNewExchanges,
  });
  const [criteria, setCriteria] = useState<TargetingCriteria>(saved.criteria);
  const [auto, setAuto] = useState(saved.auto);
  const [ver, setVer] = useState(initial.version);
  const [note, setNote] = useState('');
  const [open, setOpen] = useState<MatrixDimension | null>(null);
  const [draft, setDraft] = useState<TargetingCriteria>({});
  const [message, setMessage] = useState<{ kind: 'error'; text: string } | null>(null);
  const dirty = useMemo(
    () => JSON.stringify({ criteria, auto }) !== JSON.stringify(saved),
    [criteria, auto, saved],
  );
  useUnsavedGuard(dirty);
  const ro = !initial.canWrite;

  const openEditor = (dim: MatrixDimension) => {
    const key = CRITERIA_OF[dim]!;
    setDraft(
      criteria[key] === undefined
        ? { ...criteria, ...defaultCriteria(dim, LI_TYPE) }
        : structuredClone(criteria),
    );
    setOpen(dim);
  };
  const editorContext = useTargetingEditorContext();
  const err = open
    ? (editorError(open, draft) ?? advancedEditorError(open, draft, editorContext))
    : null;
  const summary = (dim: MatrixDimension, empty: string) =>
    summarizeTargeting(dim, criteria) ?? empty;

  const save = async () => {
    setMessage(null);
    const res = await saveTargetingDefaultsAction(
      partnerId,
      { criteria, autoEnableNewExchanges: auto },
      { expectedVersion: ver, ...(note.trim() ? { note: note.trim() } : {}) },
    );
    if (res.ok) {
      setSaved({ criteria, auto });
      setVer(res.data.version);
      setNote('');
      toast.show({ kind: 'neutral', message: 'Saved' });
      return;
    }
    const issues = errorMap(res.issues);
    setMessage({
      kind: 'error',
      text:
        res.code === 'CONFLICT'
          ? 'This partner was changed in another tab or window. Reload the page to see the latest values.'
          : (Object.values(issues)[0] ?? 'The defaults were not saved.'),
    });
  };

  return (
    <>
      <SettingsPage title="Targeting" limited={initial.limitedAccess}>
        {message ? (
          <DvBanner kind={message.kind} level="inline">
            {message.text}
          </DvBanner>
        ) : null}
        <DvSectionCard
          title="Inventory source"
          gearNote="Changes here are defaults for new insertion orders and line items. They don't affect existing ones."
        >
          <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 3 }}>
            <Box component="li">
              <Typography variant="subtitle2">Public Inventory</Typography>
              <Typography variant="body2" data-testid="public-inventory">
                {initial.enabledExchangeCount} Exchanges and 0 Subexchanges are selected
              </Typography>
              <CheckRow
                label="Targeting new exchanges"
                checked={auto}
                disabled={ro}
                onChange={setAuto}
              />
            </Box>
            <Box component="li">
              <Typography variant="subtitle2">Deals and Packages</Typography>
              <Typography variant="body2">0 deals and packages selected</Typography>
            </Box>
            <Box component="li">
              <Typography variant="subtitle2">Deal groups and preferred deal groups</Typography>
              <Typography variant="body2">No inventory groups selected</Typography>
            </Box>
          </Box>
        </DvSectionCard>
        <DvSectionCard
          title="Targeting"
          gearNote="Apps & URLs changes apply to existing and new line items. The other rows are defaults for new line items only."
        >
          <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
            {ROWS.map((r) => (
              <Box
                component="li"
                key={r.dim}
                data-testid={`default-${r.dim}`}
                sx={{ display: 'flex', alignItems: 'center', py: 1, gap: 2 }}
              >
                <Typography sx={{ width: 180 }} variant="subtitle2">
                  {r.label}
                </Typography>
                <Typography sx={{ flex: 1 }} variant="body2">
                  {summary(r.dim, r.empty)}
                </Typography>
                <IconButton
                  aria-label={`${ro ? 'View' : 'Edit'} ${r.label}`}
                  onClick={() => openEditor(r.dim)}
                >
                  <DvIcon name="edit" size={20} />
                </IconButton>
              </Box>
            ))}
          </Box>
        </DvSectionCard>
      </SettingsPage>
      {ro ? null : (
        <DvFormFooter
          mode="edit"
          dirty={dirty}
          onPrimary={() => void save()}
          onSecondary={() => undefined}
          onReset={() => {
            setCriteria(saved.criteria);
            setAuto(saved.auto);
          }}
          note={note}
          onNoteChange={setNote}
        />
      )}
      {open ? (
        <DvSlideOver
          open
          title={ROWS.find((r) => r.dim === open)?.label ?? open}
          width={ADVANCED_WIDTH[open] ?? 'default'}
          dirty={JSON.stringify(draft) !== JSON.stringify(criteria)}
          onCancel={() => setOpen(null)}
          onApply={
            ro || err
              ? undefined
              : () => {
                  setCriteria(draft);
                  setOpen(null);
                }
          }
          onDelete={
            ro
              ? undefined
              : () => {
                  const next = { ...criteria };
                  delete next[CRITERIA_OF[open]!];
                  setCriteria(next);
                  setOpen(null);
                }
          }
        >
          <EditorBody
            dim={open}
            criteria={draft}
            lineItemType={LI_TYPE}
            readOnly={ro}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          />
        </DvSlideOver>
      ) : null}
    </>
  );
}
