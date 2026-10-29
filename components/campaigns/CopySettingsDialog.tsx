'use client';

// DLG-10 Copy settings (module 06 2.3, AC-06-13): pick one campaign at the left, tick settings at the right. Copy
// Settings stays disabled until both are chosen (CMP-070). The parent merges the result into its draft only.
import { useEffect, useId, useMemo, useState, useTransition } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputBase from '@mui/material/InputBase';
import Radio from '@mui/material/Radio';
import Typography from '@mui/material/Typography';
import { copyCandidatesAction, copySourceAction } from '@/lib/campaigns/actions';
import type { CampaignCopySource, CopySetting } from '@/lib/campaigns/wire';

const SETTINGS: { id: CopySetting; label: string }[] = [
  { id: 'frequencyCap', label: 'Frequency cap' },
  { id: 'goal', label: 'Campaign goal' },
  { id: 'creativeTypes', label: 'Creative type' },
];

export function CopySettingsDialog({
  open,
  advertiserId,
  excludeCampaignId,
  onCancel,
  onCopy,
}: {
  open: boolean;
  advertiserId: string;
  excludeCampaignId?: string;
  onCancel: () => void;
  onCopy: (source: CampaignCopySource, settings: CopySetting[]) => void;
}) {
  const titleId = useId();
  const [campaigns, setCampaigns] = useState<{ publicId: string; name: string }[]>([]);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [settings, setSettings] = useState<CopySetting[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setPicked(null);
    setSettings([]);
    setQuery('');
    setError(null);
    let live = true;
    void copyCandidatesAction(advertiserId).then((rows) => {
      if (live) setCampaigns(rows.filter((r) => r.publicId !== excludeCampaignId));
    });
    return () => {
      live = false;
    };
  }, [open, advertiserId, excludeCampaignId]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? campaigns.filter((c) => c.name.toLowerCase().includes(q) || c.publicId.includes(q))
      : campaigns;
  }, [campaigns, query]);
  const all = settings.length === SETTINGS.length;
  const toggle = (id: CopySetting) =>
    setSettings((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const copy = () => {
    if (!picked || settings.length === 0) return;
    startTransition(async () => {
      const source = await copySourceAction(picked, settings);
      if (!source) {
        setError('Could not read the settings of that campaign.');
        return;
      }
      onCopy(source, settings);
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth={false}
      aria-labelledby={titleId}
      slotProps={{ paper: { sx: { width: 720, maxWidth: '90vw' } } }}
    >
      <DialogTitle id={titleId}>Copy settings from an existing campaign</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, minHeight: 280 }}>
          <Box role="group" aria-label="Select campaign">
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Select campaign
            </Typography>
            <InputBase
              fullWidth
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              inputProps={{ 'aria-label': 'Search campaigns' }}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 2, mb: 1 }}
            />
            <Box sx={{ maxHeight: 220, overflowY: 'auto' }}>
              {visible.map((c) => (
                <FormControlLabel
                  key={c.publicId}
                  sx={{ display: 'flex', mx: 0 }}
                  control={
                    <Radio
                      size="small"
                      name="copy-from"
                      checked={picked === c.publicId}
                      onChange={() => setPicked(c.publicId)}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2">{c.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        ID: {c.publicId}
                      </Typography>
                    </Box>
                  }
                />
              ))}
              {visible.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                  No campaigns
                </Typography>
              ) : null}
            </Box>
          </Box>
          <Box role="group" aria-label="Settings">
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Settings
            </Typography>
            <FormControlLabel
              sx={{ display: 'flex', mx: 0 }}
              control={
                <Checkbox
                  size="small"
                  checked={all}
                  indeterminate={settings.length > 0 && !all}
                  onChange={() => setSettings(all ? [] : SETTINGS.map((s) => s.id))}
                />
              }
              label="Select all"
            />
            {SETTINGS.map((s) => (
              <FormControlLabel
                key={s.id}
                sx={{ display: 'flex', mx: 0, pl: 3 }}
                control={
                  <Checkbox
                    size="small"
                    checked={settings.includes(s.id)}
                    onChange={() => toggle(s.id)}
                  />
                }
                label={s.label}
              />
            ))}
          </Box>
        </Box>
        {error ? (
          <Typography role="alert" variant="caption" color="error" sx={{ display: 'block', mt: 2 }}>
            {error}
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ gap: 2 }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!picked || settings.length === 0 || busy}
          onClick={copy}
        >
          Copy Settings
        </Button>
      </DialogActions>
    </Dialog>
  );
}
