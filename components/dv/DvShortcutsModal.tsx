'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { DvKbd } from './DvKbd';
import { DvModal } from './DvModal';

/** Shortcuts of design-system 5.4. `mod` is Ctrl on Windows and Linux, ⌘ on Mac. */
export const SHORTCUTS = [
  { action: 'Keyboard shortcuts', keys: ['?'] },
  { action: 'Search', keys: ['/'] },
  { action: 'New (entity for current page)', keys: ['Shift', 'N'] },
  { action: 'New insertion order', keys: ['Shift', 'I'] },
  { action: 'New line item', keys: ['Shift', 'L'] },
  { action: 'Download SDF', keys: ['mod', 'Shift', 'K'] },
  { action: 'Download CSV of view', keys: ['mod', 'Shift', 'L'] },
  { action: 'Duplicate', keys: ['mod', 'D'] },
] as const;

export interface DvShortcutsModalProps {
  open: boolean;
  onClose: () => void;
  /** Show ⌘ instead of Ctrl. */
  mac?: boolean;
}

/** Two-column Action | Keys table with keycap pills (design-system 2.11). */
export function DvShortcutsModal({ open, onClose, mac }: DvShortcutsModalProps) {
  const key = (k: string) => (k === 'mod' ? (mac ? '⌘' : 'Ctrl') : k);
  return (
    <DvModal
      open={open}
      title="Keyboard shortcuts"
      size="md"
      primary={{ label: 'Close', onClick: onClose }}
      onClose={onClose}
    >
      <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <Box
              component="th"
              scope="col"
              sx={{ textAlign: 'left', py: 2, typography: 'tableHeader' }}
            >
              Action
            </Box>
            <Box
              component="th"
              scope="col"
              sx={{ textAlign: 'left', py: 2, typography: 'tableHeader' }}
            >
              Keys
            </Box>
          </tr>
        </thead>
        <tbody>
          {SHORTCUTS.map((s) => (
            <Box
              component="tr"
              key={s.action}
              sx={{ borderTop: '1px solid', borderColor: 'divider' }}
            >
              <Box component="td" sx={{ py: 2 }}>
                {s.action}
              </Box>
              <Box component="td" sx={{ py: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
                {s.keys.map((k, i) => (
                  <Box
                    component="span"
                    key={i}
                    sx={{ display: 'inline-flex', gap: 1, alignItems: 'center' }}
                  >
                    {i > 0 ? '+' : null}
                    <DvKbd>{key(k)}</DvKbd>
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
          <Box component="tr" sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
            <Box component="td" sx={{ py: 2 }}>
              <Typography variant="body1" component="span">
                Close the top popover, menu, slide-over or dialog
              </Typography>
              <Typography variant="caption" component="div">
                Simulator
              </Typography>
            </Box>
            <Box component="td" sx={{ py: 2 }}>
              <DvKbd>Esc</DvKbd>
            </Box>
          </Box>
        </tbody>
      </Box>
    </DvModal>
  );
}
