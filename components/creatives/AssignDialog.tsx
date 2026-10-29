'use client';

// "Assign to line items…" of the library Action menu (module 12 section 1): pick line items, the line item module's
// rules (LI-060 to LI-064) decide, and the dialog lists each line item it could not change.
import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import { DvModal } from '@/components/dv/DvModal';
import { assignCreativesAction, lineItemChoicesAction } from '@/lib/creatives/actions';
import type { LineItemChoice } from '@/lib/creatives/service';
import { LI_TYPE_LABEL, type LiType } from '@/lib/validation/constants/li-compat';

export function AssignDialog({
  open,
  advertiserId,
  creativeIds,
  onClose,
  onDone,
}: {
  open: boolean;
  advertiserId: string;
  creativeIds: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [choices, setChoices] = useState<LineItemChoice[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [failures, setFailures] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setPicked(new Set());
    setError(undefined);
    setFailures([]);
    void lineItemChoicesAction(advertiserId).then(setChoices);
  }, [open, advertiserId]);

  const toggle = (id: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async () => {
    if (picked.size === 0) {
      setError('Select at least one line item.');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const res = await assignCreativesAction(advertiserId, {
        creativeIds,
        lineItemIds: [...picked],
        mode: 'ADD',
      });
      if (!res.ok) {
        setError(res.issues[0]?.message ?? "Couldn't assign the creatives.");
        return;
      }
      if (res.data.failed > 0) {
        setFailures(res.data.errors.map((e) => e.message));
        return;
      }
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <DvModal
      open={open}
      title="Assign to line items"
      size="md"
      primary={{
        label: failures.length ? 'Close' : 'Assign',
        onClick: failures.length ? onDone : () => void submit(),
        loading: busy,
      }}
      secondary={failures.length ? undefined : { label: 'Cancel', onClick: onClose }}
      onClose={onClose}
      {...(error ? { error } : {})}
    >
      {failures.length ? (
        <Box role="status">
          <Typography sx={{ mb: 1 }}>Some line items could not be changed:</Typography>
          <Box component="ul" sx={{ m: 0, pl: 3 }}>
            {failures.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </Box>
        </Box>
      ) : choices === null ? (
        <Typography role="status">Loading line items…</Typography>
      ) : choices.length === 0 ? (
        <Typography>No line items yet.</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', maxHeight: 360, overflow: 'auto' }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
            {creativeIds.length} {creativeIds.length === 1 ? 'creative' : 'creatives'} selected
          </Typography>
          {choices.map((c) => (
            <FormControlLabel
              key={c.id}
              control={<Checkbox checked={picked.has(c.id)} onChange={() => toggle(c.id)} />}
              label={`${c.name} (${LI_TYPE_LABEL[c.type as LiType] ?? c.type}, ${c.publicId})`}
            />
          ))}
        </Box>
      )}
    </DvModal>
  );
}
