'use client';

// Appeal dialog (module 12 S9): the disapproved exchanges (all ticked) or the DV360 review, an optional reason
// (0 / 1000), Submit appeal / Cancel. Rows then appear in Appeal history.
import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import { DvModal } from '@/components/dv/DvModal';
import { useToast } from '@/components/dv/DvToast';
import { DvTextField } from '@/components/dv/DvTextField';
import { appealCreativeAction } from '@/lib/creatives/actions';
import { CREATIVE_LIMITS } from '@/lib/creatives/limits';

export interface AppealTarget {
  /** null: the Display & Video 360 review. */
  exchangeId: string | null;
  name: string;
}

export function AppealDialog({
  open,
  advertiserId,
  creativeId,
  creativeName,
  targets,
  onClose,
  onDone,
}: {
  open: boolean;
  advertiserId: string;
  creativeId: string;
  creativeName: string;
  targets: AppealTarget[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const key = (t: AppealTarget) => t.exchangeId ?? 'dv360';

  useEffect(() => {
    if (open) {
      setTicked(new Set(targets.map(key)));
      setReason('');
      setError(undefined);
    }
  }, [open, targets]);

  const submit = async () => {
    const chosen = targets.filter((t) => ticked.has(key(t)));
    if (chosen.length === 0) {
      setError('Select at least one item to appeal.');
      return;
    }
    setBusy(true);
    setError(undefined);
    const dv360 = chosen.some((c) => c.exchangeId === null);
    const res = await appealCreativeAction(advertiserId, creativeId, {
      ...(dv360 ? {} : { exchangeIds: chosen.map((c) => c.exchangeId!) }),
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.issues[0]?.message ?? "Couldn't submit the appeal.");
      return;
    }
    toast.show({ message: 'Appeal submitted' });
    onDone();
  };

  return (
    <DvModal
      open={open}
      title={`Appeal ${creativeName}`}
      size="md"
      primary={{ label: 'Submit appeal', onClick: () => void submit(), loading: busy }}
      secondary={{ label: 'Cancel', onClick: onClose }}
      onClose={onClose}
      {...(error ? { error } : {})}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Choose what to appeal.
        </Typography>
        {targets.map((t) => (
          <FormControlLabel
            key={key(t)}
            control={
              <Checkbox
                checked={ticked.has(key(t))}
                onChange={(e) =>
                  setTicked((cur) => {
                    const next = new Set(cur);
                    if (e.target.checked) next.add(key(t));
                    else next.delete(key(t));
                    return next;
                  })
                }
              />
            }
            label={t.name}
          />
        ))}
        <DvTextField
          label="Reason (optional)"
          id="appeal-reason"
          multiline
          rows={3}
          maxLength={CREATIVE_LIMITS.APPEAL_REASON_MAX}
          value={reason}
          onChange={setReason}
        />
      </Box>
    </DvModal>
  );
}
