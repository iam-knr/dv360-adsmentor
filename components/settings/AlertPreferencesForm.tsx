'use client';

// Alert preferences (module 03 2.6, S7): the ten alert toggles, the Underpacing and spend thresholds, Save disabled until
// a change. Dependent toggles follow Underpacing (ADV-019); the server validates again (ADV-015, ADV-016).
import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Link from '@mui/material/Link';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { DvBanner, DvTextField } from '@/components/dv';
import { saveAlertPreferencesAction } from '@/lib/settings/actions';
import { ALERT_ROWS, NEEDS_UNDERPACING, type AlertKey } from '@/lib/settings/constants';
import type { AlertPrefs } from '@/lib/settings/alert-prefs';

type Draft = Record<AlertKey, { enabled: boolean; thresholdPct: string; thresholdAmount: string }>;

const toDraft = (p: AlertPrefs['prefs']): Draft =>
  Object.fromEntries(
    ALERT_ROWS.map((r) => [
      r.type,
      {
        enabled: p[r.type].enabled,
        thresholdPct: p[r.type].thresholdPct === null ? '' : String(p[r.type].thresholdPct),
        thresholdAmount:
          p[r.type].thresholdAmount === null ? '' : String(p[r.type].thresholdAmount),
      },
    ]),
  ) as Draft;

export function AlertPreferencesForm({
  advertiserId,
  initial,
  currencyCode,
  version,
  canWrite,
  emailHref,
}: {
  advertiserId: string;
  initial: AlertPrefs['prefs'];
  currencyCode: string;
  version: number;
  canWrite: boolean;
  emailHref: string;
}) {
  const [saved, setSaved] = useState<Draft>(() => toDraft(initial));
  const [draft, setDraft] = useState<Draft>(saved);
  const [ver, setVer] = useState(version);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);
  const groups = [...new Set(ALERT_ROWS.map((r) => r.group))];

  const set = (k: AlertKey, patch: Partial<Draft[AlertKey]>) => {
    setStatus('idle');
    setDraft((d) => {
      const next = { ...d, [k]: { ...d[k], ...patch } };
      return next;
    });
  };

  const save = async () => {
    setStatus('saving');
    const prefs = Object.fromEntries(
      ALERT_ROWS.map((r) => [
        r.type,
        {
          enabled: draft[r.type].enabled,
          thresholdPct:
            r.type === 'UNDERPACING' && draft[r.type].thresholdPct !== ''
              ? draft[r.type].thresholdPct
              : null,
          thresholdAmount:
            r.type === 'EXCEEDED_SPEND_THRESHOLD' && draft[r.type].thresholdAmount !== ''
              ? draft[r.type].thresholdAmount
              : null,
        },
      ]),
    );
    const res = await saveAlertPreferencesAction(advertiserId, prefs as never, {
      expectedVersion: ver,
    });
    if (res.ok) {
      setSaved(draft);
      setVer((v) => v + 1);
      setErrors({});
      setStatus('saved');
      return;
    }
    setErrors(Object.fromEntries(res.issues.map((i) => [i.path, i.message])));
    setStatus('error');
  };

  const underpacingOn = draft.UNDERPACING.enabled;
  return (
    <Box sx={{ p: 4, maxWidth: 960, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Typography variant="body1">
        Select which alerts appear in the Alerts tab and Intelligence panel. Changes apply at the
        next simulated hour.
      </Typography>
      {status === 'saved' ? (
        <DvBanner kind="success">Alert preferences saved.</DvBanner>
      ) : status === 'error' && Object.keys(errors).length === 0 ? (
        <DvBanner kind="error">The preferences were not saved.</DvBanner>
      ) : null}
      {groups.map((g) => (
        <Box
          key={g}
          component="section"
          aria-label={g}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '8px',
            p: 4,
            bgcolor: 'background.paper',
          }}
        >
          <Typography variant="cardTitle" component="h3" sx={{ mb: 2 }}>
            {g}
          </Typography>
          {ALERT_ROWS.filter((r) => r.group === g).map((r) => {
            const dependent = NEEDS_UNDERPACING.includes(r.type);
            const blocked = dependent && !underpacingOn;
            return (
              <Box key={r.type} sx={{ py: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={draft[r.type].enabled && !blocked}
                      disabled={!canWrite || blocked}
                      onChange={(e) => set(r.type, { enabled: e.target.checked })}
                      slotProps={{ input: { 'data-testid': `alert-${r.type}` } as never }}
                    />
                  }
                  label={r.label}
                />
                {errors[r.type] ? (
                  <Typography variant="caption" color="error" role="alert" sx={{ ml: 2 }}>
                    {errors[r.type]}
                  </Typography>
                ) : null}
                {r.type === 'UNDERPACING' ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, ml: 12, mt: 1 }}>
                    <Typography variant="body2">
                      Alert if it&apos;s estimated that less than
                    </Typography>
                    <Box sx={{ width: 96 }}>
                      <DvTextField
                        ariaLabel="Underpacing threshold"
                        value={draft.UNDERPACING.thresholdPct}
                        suffix="%"
                        numeric
                        disabled={!canWrite || !draft.UNDERPACING.enabled}
                        error={errors['UNDERPACING.thresholdPct'] ?? ''}
                        onChange={(v) => set('UNDERPACING', { thresholdPct: v })}
                      />
                    </Box>
                    <Typography variant="body2">
                      of the current budget segment will be spent by its end date.
                    </Typography>
                  </Box>
                ) : null}
                {r.type === 'EXCEEDED_SPEND_THRESHOLD' ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, ml: 12, mt: 1 }}>
                    <Typography variant="body2">
                      Alert if the advertiser spends more than
                    </Typography>
                    <Box sx={{ width: 160 }}>
                      <DvTextField
                        ariaLabel="Spend threshold"
                        value={draft.EXCEEDED_SPEND_THRESHOLD.thresholdAmount}
                        prefix={currencyCode}
                        numeric
                        disabled={!canWrite || !draft.EXCEEDED_SPEND_THRESHOLD.enabled}
                        error={errors['EXCEEDED_SPEND_THRESHOLD.thresholdAmount'] ?? ''}
                        onChange={(v) => set('EXCEEDED_SPEND_THRESHOLD', { thresholdAmount: v })}
                      />
                    </Box>
                    <Typography variant="body2">in a day.</Typography>
                  </Box>
                ) : null}
              </Box>
            );
          })}
        </Box>
      ))}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Button
          variant="contained"
          disabled={!canWrite || !dirty || status === 'saving'}
          onClick={() => void save()}
        >
          Save
        </Button>
        <Link href={emailHref}>Manage Global Email Configuration</Link>
      </Box>
    </Box>
  );
}
