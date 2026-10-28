'use client';

import { useId, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import Typography from '@mui/material/Typography';
import { DvIcon } from '@/components/icons';
import { sizes } from '@/lib/theme/tokens';

export interface PickerItem {
  id: string;
  label: string;
  secondLine?: string;
}

export interface DvPickerDialogProps {
  open: boolean;
  title: string;
  items: PickerItem[];
  /** Selected ids when the dialog opens. */
  value: string[];
  onApply: (ids: string[]) => void;
  onCancel: () => void;
  /** Single choice: picking an item replaces the selection. */
  single?: boolean;
  applyLabel?: string;
  searchPlaceholder?: string;
}

/** Two-pane picker: searchable list at the left, "None selected" / "{n} selected" at the right (design-system 2.20). */
export function DvPickerDialog({
  open,
  title,
  items,
  value,
  onApply,
  onCancel,
  single,
  applyLabel = 'Apply',
  searchPlaceholder = 'Search',
}: DvPickerDialogProps) {
  const [picked, setPicked] = useState<string[]>(value);
  const [query, setQuery] = useState('');
  const titleId = useId();
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? items.filter(
          (i) => i.label.toLowerCase().includes(q) || i.secondLine?.toLowerCase().includes(q),
        )
      : items;
  }, [items, query]);
  const toggle = (id: string) =>
    setPicked((cur) =>
      single ? [id] : cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  const selectedItems = picked
    .map((id) => items.find((i) => i.id === id))
    .filter((i): i is PickerItem => Boolean(i));

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby={titleId}
      maxWidth={false}
      TransitionProps={{
        onEnter: () => {
          setPicked(value);
          setQuery('');
        },
      }}
      slotProps={{ paper: { sx: { width: sizes.dialog.lg, maxWidth: '95vw' } } }}
    >
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent
        sx={{
          display: 'flex',
          gap: 4,
          minHeight: 320,
          p: 0,
          borderTop: '1px solid',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box
          sx={{
            flex: 1,
            borderRight: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <InputBase
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            inputProps={{ 'aria-label': searchPlaceholder }}
            startAdornment={<DvIcon name="search" size={20} sx={{ mr: 2 }} />}
            sx={{ px: 4, height: 48, borderBottom: '1px solid', borderColor: 'divider' }}
          />
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, overflowY: 'auto', flex: 1 }}>
            {visible.map((i) => (
              <Box component="li" key={i.id}>
                <Box
                  component="label"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 2,
                    py: 1,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'surface.sunken' },
                  }}
                >
                  <Checkbox
                    size="small"
                    checked={picked.includes(i.id)}
                    onChange={() => toggle(i.id)}
                  />
                  <Box>
                    <Typography variant="body1" component="div">
                      {i.label}
                    </Typography>
                    {i.secondLine ? (
                      <Typography variant="caption">{i.secondLine}</Typography>
                    ) : null}
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 4,
              height: 48,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="subtitle1">
              {picked.length ? `${picked.length} selected` : 'None selected'}
            </Typography>
            {picked.length ? (
              <Button size="small" onClick={() => setPicked([])}>
                Clear all
              </Button>
            ) : null}
          </Box>
          <Box
            component="ul"
            aria-label="Selected"
            sx={{ listStyle: 'none', m: 0, p: 0, overflowY: 'auto' }}
          >
            {selectedItems.map((i) => (
              <Box
                component="li"
                key={i.id}
                sx={{ display: 'flex', alignItems: 'center', px: 4, py: 1 }}
              >
                <Typography variant="body1" sx={{ flex: 1 }}>
                  {i.label}
                </Typography>
                <IconButton
                  size="small"
                  aria-label={`Remove ${i.label}`}
                  onClick={() => setPicked((cur) => cur.filter((x) => x !== i.id))}
                >
                  <DvIcon name="cancel" size={20} />
                </IconButton>
              </Box>
            ))}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" disabled={picked.length === 0} onClick={() => onApply(picked)}>
          {applyLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
