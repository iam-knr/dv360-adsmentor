'use client';

import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import OutlinedInput from '@mui/material/OutlinedInput';
import Typography from '@mui/material/Typography';
import { DvIcon } from '@/components/icons';
import { footerShadow, sizes } from '@/lib/theme/tokens';
import { DvTooltip } from './DvTooltip';

/**
 * Focus and scroll to the first invalid field. Call after a failed Create or Save; the page
 * never navigates on error (design-system 2.8.5). Returns the element that got focus.
 */
export function focusFirstInvalid(root: ParentNode = document): HTMLElement | null {
  const el = root.querySelector<HTMLElement>('[aria-invalid="true"]');
  if (!el) return null;
  el.scrollIntoView?.({ block: 'center' });
  el.focus();
  return el;
}

export interface DvFormPageProps {
  title: string;
  /** Header close (X). Parents show the Unsaved Changes modal when the form is dirty. */
  onClose: () => void;
  children: ReactNode;
  /** Usually a `DvFormFooter`. */
  footer?: ReactNode;
  /** Banner slot under the header (advertiser paused and so on). */
  banner?: ReactNode;
  /** Polite live-region text such as "3 errors. Fix them to continue." */
  announce?: string;
  /** Render without page landmarks (header, main). For previews inside another page, such as the gallery. */
  embedded?: boolean;
}

/** Full-screen form shell: 56 px header, scrolling canvas of cards (max 960), sticky footer (design-system 2.8). */
export function DvFormPage({
  title,
  onClose,
  children,
  footer,
  banner,
  announce,
  embedded,
}: DvFormPageProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        bgcolor: 'background.default',
      }}
    >
      <Box
        component={embedded ? 'div' : 'header'}
        sx={{
          height: sizes.appBarHeight,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          px: 4,
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <DvTooltip title="Close">
          <IconButton aria-label="Close" onClick={onClose}>
            <DvIcon name="close" size={24} />
          </IconButton>
        </DvTooltip>
        <Typography variant="h5" component="h1">
          {title}
        </Typography>
      </Box>
      {banner}
      <Box component={embedded ? 'div' : 'main'} sx={{ flex: 1, p: 6, pb: 8 }}>
        <Box
          sx={{
            maxWidth: 960,
            mx: { xl: 'auto' },
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {children}
        </Box>
      </Box>
      <Box
        role="status"
        aria-live="polite"
        sx={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
        }}
      >
        {announce}
      </Box>
      {footer}
    </Box>
  );
}

export interface DvFormFooterProps {
  mode: 'create' | 'edit' | 'panel';
  dirty: boolean;
  onPrimary: () => void;
  /** Cancel (create and panel modes). */
  onSecondary: () => void;
  /** Reset (edit mode). */
  onReset?: () => void;
  note?: string;
  onNoteChange?: (v: string) => void;
  primaryLabel?: string;
  extraRight?: ReactNode;
  /** Render without the contentinfo landmark (previews). */
  embedded?: boolean;
}

/** Sticky 64 px footer: Create/Cancel, Save/Reset or Apply/Cancel, plus the change note (design-system 2.8.6). */
export function DvFormFooter({
  mode,
  dirty,
  onPrimary,
  onSecondary,
  onReset,
  note,
  onNoteChange,
  primaryLabel,
  extraRight,
  embedded,
}: DvFormFooterProps) {
  const label = primaryLabel ?? (mode === 'create' ? 'Create' : mode === 'edit' ? 'Save' : 'Apply');
  return (
    <Box
      component={embedded ? 'div' : 'footer'}
      sx={{
        position: 'sticky',
        bottom: 0,
        height: sizes.footerHeight,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 6,
        bgcolor: 'background.paper',
        borderTop: '1px solid',
        borderColor: 'divider',
        boxShadow: footerShadow,
        zIndex: (t) => t.zIndex.stickyFooter,
      }}
    >
      <Button variant="contained" onClick={onPrimary} disabled={mode === 'edit' && !dirty}>
        {label}
      </Button>
      {mode === 'edit' ? (
        <Button variant="outlined" onClick={onReset} disabled={!dirty}>
          Reset
        </Button>
      ) : (
        <Button variant="outlined" onClick={onSecondary}>
          Cancel
        </Button>
      )}
      {mode !== 'panel' && onNoteChange ? (
        <OutlinedInput
          value={note ?? ''}
          placeholder="Optional: Enter a note about this change"
          onChange={(e) => onNoteChange(e.target.value)}
          inputProps={{ 'aria-label': 'Change note' }}
          sx={{ width: 320, ml: 2 }}
        />
      ) : null}
      <Box sx={{ flex: 1 }} />
      {extraRight}
    </Box>
  );
}
