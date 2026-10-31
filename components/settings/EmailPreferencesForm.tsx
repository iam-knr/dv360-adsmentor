'use client';

// Email preferences (module 02 2.10, S11): two toggles. No email is ever sent; the toggles only control the in-app inbox.
import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { DvBanner, DvSectionCard } from '@/components/dv';
import { saveEmailPreferencesAction } from '@/lib/settings/actions';

export function EmailPreferencesForm({
  initial,
  canWrite,
}: {
  initial: { alerts: boolean; news: boolean };
  canWrite: boolean;
}) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const dirty = saved.alerts !== draft.alerts || saved.news !== draft.news;
  const set = (p: Partial<typeof draft>) => {
    setStatus('idle');
    setDraft({ ...draft, ...p });
  };
  const save = async () => {
    const res = await saveEmailPreferencesAction(draft);
    if (res.ok) {
      setSaved(draft);
      setStatus('saved');
    } else setStatus('error');
  };
  return (
    <Box sx={{ p: 4, maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Typography variant="body1">
        Choose which emails you want. Adsmetor never sends real email: these settings control what
        appears in your in-app notifications.
      </Typography>
      {status === 'saved' ? <DvBanner kind="success">Email preferences saved.</DvBanner> : null}
      {status === 'error' ? (
        <DvBanner kind="error">The email preferences were not saved.</DvBanner>
      ) : null}
      <DvSectionCard title="Alerts" description="Alerts about your advertisers and campaigns.">
        <FormControlLabel
          control={
            <Switch
              checked={draft.alerts}
              disabled={!canWrite}
              onChange={(e) => set({ alerts: e.target.checked })}
              slotProps={{ input: { 'data-testid': 'email-alerts' } as never }}
            />
          }
          label="Alerts"
        />
      </DvSectionCard>
      <DvSectionCard title="News, announcements, and offers">
        <FormControlLabel
          control={
            <Switch
              checked={draft.news}
              disabled={!canWrite}
              onChange={(e) => set({ news: e.target.checked })}
              slotProps={{ input: { 'data-testid': 'email-news' } as never }}
            />
          }
          label="News, announcements, and offers"
        />
      </DvSectionCard>
      <Box>
        <Button variant="contained" disabled={!canWrite || !dirty} onClick={() => void save()}>
          Save
        </Button>
      </Box>
    </Box>
  );
}
