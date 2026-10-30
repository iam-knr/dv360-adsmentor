'use client';

// "Select insertion orders / line items" (module 17 S10): search, select all, rows `name (ID)` with a warning icon for
// insertion orders whose line item budgets exceed the budget (AB-023), "None selected" at the right.
import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputBase from '@mui/material/InputBase';
import Typography from '@mui/material/Typography';
import { DvTooltip } from '@/components/dv';
import { DvIcon } from '@/components/icons';
import type { CandidateRow } from '@/lib/experiments/types';

export function ArmPicker({
  open,
  kind,
  rows,
  value,
  taken,
  onDone,
  onCancel,
}: {
  open: boolean;
  kind: 'INSERTION_ORDER' | 'LINE_ITEM';
  rows: CandidateRow[];
  value: string[];
  /** Ids chosen by the other arms: shown but disabled (AB-015). */
  taken: Set<string>;
  onDone: (ids: string[]) => void;
  onCancel: () => void;
}) {
  const [picked, setPicked] = useState<string[]>(value);
  const [q, setQ] = useState('');
  const noun = kind === 'LINE_ITEM' ? 'line items' : 'insertion orders';
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows.filter((r) => !n || r.name.toLowerCase().includes(n) || r.publicId.includes(n));
  }, [rows, q]);
  const selectable = shown.filter((r) => !taken.has(r.id));
  const allOn = selectable.length > 0 && selectable.every((r) => picked.includes(r.id));
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const names = new Map(rows.map((r) => [r.id, r.name]));

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="md" fullWidth aria-labelledby="arm-picker-title">
      <DialogTitle id="arm-picker-title">{`Select ${noun}`}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, minHeight: 360 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, border: 1, borderColor: 'divider', borderRadius: 1, px: 1.5, mb: 1 }}>
            <DvIcon name="search" size={18} />
            <InputBase fullWidth placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} inputProps={{ 'aria-label': 'Search' }} />
          </Box>
          <FormControlLabel
            control={
              <Checkbox
                checked={allOn}
                onChange={() =>
                  setPicked((p) => (allOn ? p.filter((id) => !selectable.some((r) => r.id === id)) : [...new Set([...p, ...selectable.map((r) => r.id)])]))
                }
              />
            }
            label={`${shown.length} ${noun}`}
          />
          <Box role="group" aria-label={noun} sx={{ maxHeight: 300, overflow: 'auto' }}>
            {shown.map((r) => {
              const isTaken = taken.has(r.id);
              return (
                <Box key={r.id} sx={{ display: 'flex', alignItems: 'center' }}>
                  <FormControlLabel
                    sx={{ flex: 1, mr: 0 }}
                    control={<Checkbox checked={picked.includes(r.id)} disabled={isTaken} onChange={() => toggle(r.id)} />}
                    label={
                      <Box>
                        <Typography variant="body2">{`${r.name} (${r.publicId})`}</Typography>
                        {r.parent ? (
                          <Typography variant="caption" color="text.secondary">
                            {r.parent}
                          </Typography>
                        ) : null}
                        {isTaken ? (
                          <Typography variant="caption" color="text.secondary" display="block">
                            In another arm
                          </Typography>
                        ) : r.inOtherTest ? (
                          <Typography variant="caption" color="error" display="block">
                            {`Already part of ${r.inOtherTest}`}
                          </Typography>
                        ) : null}
                      </Box>
                    }
                  />
                  {r.warning ? (
                    <DvTooltip title={r.warning}>
                      <span data-testid="arm-warning" aria-label={r.warning} role="img">
                        <DvIcon name="warning" size={18} color="warning.main" />
                      </span>
                    </DvTooltip>
                  ) : null}
                </Box>
              );
            })}
            {shown.length === 0 ? <Typography color="text.secondary">No results.</Typography> : null}
          </Box>
        </Box>
        <Box sx={{ borderLeft: 1, borderColor: 'divider', pl: 3 }} data-testid="arm-picker-selected">
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {picked.length ? `${picked.length} selected` : 'None selected'}
          </Typography>
          {picked.map((id) => (
            <Typography key={id} variant="body2">
              {names.get(id) ?? id}
            </Typography>
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={() => onDone(picked)}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}
