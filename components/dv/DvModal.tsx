'use client';

import { useId, type ReactNode } from 'react';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import { sizes } from '@/lib/theme/tokens';

export interface DvModalProps {
  open: boolean;
  title: string;
  size?: 'sm' | 'md' | 'lg';
  primary: {
    label: string;
    onClick: () => void;
    loading?: boolean;
    disabled?: boolean;
    tone?: 'default' | 'danger';
  };
  secondary?: { label: string; onClick: () => void };
  children: ReactNode;
  initialFocus?: 'primary' | 'secondary';
  /** Called on Esc and scrim click. Omit for a blocking dialog. */
  onClose?: () => void;
  /** Error text shown inside the body. */
  error?: string;
}

/** Centred dialog, width 400 / 560 / 720, secondary then primary action (design-system 2.11). */
export function DvModal({
  open,
  title,
  size = 'sm',
  primary,
  secondary,
  children,
  initialFocus = 'primary',
  onClose,
  error,
}: DvModalProps) {
  const titleId = useId();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      disableEscapeKeyDown={!onClose}
      aria-labelledby={titleId}
      maxWidth={false}
      slotProps={{ paper: { sx: { width: sizes.dialog[size], maxWidth: '90vw' } } }}
    >
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent sx={{ typography: 'body1', color: 'text.primary' }}>
        {children}
        {error ? (
          <Typography
            role="alert"
            variant="caption"
            sx={{ display: 'block', mt: 2, color: 'statusText.error' }}
          >
            {error}
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ gap: 2 }}>
        {secondary ? (
          <Button onClick={secondary.onClick} autoFocus={initialFocus === 'secondary'}>
            {secondary.label}
          </Button>
        ) : null}
        <Button
          variant="contained"
          color={primary.tone === 'danger' ? 'error' : 'primary'}
          disabled={primary.loading || primary.disabled}
          onClick={primary.onClick}
          autoFocus={initialFocus === 'primary'}
          startIcon={
            primary.loading ? (
              <CircularProgress size={16} thickness={4} color="inherit" />
            ) : undefined
          }
        >
          {primary.label}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Texts of validation.md 5.1 and DLG-02. Exact. */
export const UNSAVED_CHANGES = {
  title: 'Unsaved Changes',
  body: 'You have made changes that have not been saved and will be lost.',
  channelBody:
    'You have made changes to this channel that have not yet been saved and will be lost.',
  discard: 'Discard changes',
  continueEditing: 'Continue editing',
} as const;

export interface DvUnsavedChangesModalProps {
  open: boolean;
  onDiscard: () => void;
  onContinue: () => void;
  /** Use the channel editor wording of DLG-02. */
  variant?: 'default' | 'channel';
}

/**
 * Unsaved Changes preset. Initial focus is Continue editing (the safe action); Esc and
 * scrim click act as Continue editing.
 */
export function DvUnsavedChangesModal({
  open,
  onDiscard,
  onContinue,
  variant = 'default',
}: DvUnsavedChangesModalProps) {
  return (
    <DvModal
      open={open}
      title={UNSAVED_CHANGES.title}
      primary={{ label: UNSAVED_CHANGES.discard, onClick: onDiscard }}
      secondary={{ label: UNSAVED_CHANGES.continueEditing, onClick: onContinue }}
      initialFocus="secondary"
      onClose={onContinue}
    >
      {variant === 'channel' ? UNSAVED_CHANGES.channelBody : UNSAVED_CHANGES.body}
    </DvModal>
  );
}
