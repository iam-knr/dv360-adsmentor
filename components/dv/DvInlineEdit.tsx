'use client';

import { useId, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import OutlinedInput from '@mui/material/OutlinedInput';
import { DvIcon } from '@/components/icons';
import { DvTooltip } from './DvTooltip';

export interface DvInlineEditProps {
  value: string;
  /** Accessible name of the cell ("Budget"). */
  label: string;
  /** Called with the new value once `validate` passes. */
  onCommit: (value: string) => void;
  /** Return the error text to reject the value. It shows as a red border and a tooltip. */
  validate?: (value: string) => string | undefined;
  /** Display of the resting value (currency format and so on). Default: the raw value. */
  display?: ReactNode;
  prefix?: string;
  align?: 'left' | 'right';
}

/**
 * Inline edit for grid cells such as budget segments (design-system 2.4): the cell turns into
 * a 32 px outlined input, Enter commits, Esc cancels, an invalid value shows a red border and a
 * tooltip. Leaving the field without Enter cancels the edit.
 */
export function DvInlineEdit({
  value,
  label,
  onCommit,
  validate,
  display,
  prefix,
  align = 'right',
}: DvInlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | undefined>();
  const errorId = useId();

  const start = () => {
    setDraft(value);
    setError(undefined);
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    setError(undefined);
  };
  const commit = () => {
    const problem = validate?.(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setEditing(false);
    setError(undefined);
    if (draft !== value) onCommit(draft);
  };

  if (!editing) {
    return (
      <ButtonBase
        onClick={start}
        sx={{
          width: '100%',
          justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
          gap: 1,
          typography: 'tableCell',
          '&:hover .dv-inline-edit-icon, &:focus-visible .dv-inline-edit-icon': { opacity: 1 },
        }}
      >
        <Box
          component="span"
          className="dv-inline-edit-icon"
          sx={{ display: 'inline-flex', opacity: 0 }}
        >
          <DvIcon name="edit" size={16} />
        </Box>
        <Box
          component="span"
          sx={{
            position: 'absolute',
            width: 1,
            height: 1,
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            whiteSpace: 'nowrap',
          }}
        >
          {`Edit ${label}: `}
        </Box>
        {display ?? value}
      </ButtonBase>
    );
  }

  return (
    <DvTooltip title={error ?? ''} open={Boolean(error)} placement="top">
      <OutlinedInput
        autoFocus
        value={draft}
        error={Boolean(error)}
        onChange={(e) => {
          setDraft(e.target.value);
          if (error) setError(undefined);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.stopPropagation();
            cancel();
          }
        }}
        onBlur={cancel}
        startAdornment={prefix}
        inputProps={{
          'aria-label': label,
          'aria-invalid': error ? true : undefined,
          'aria-describedby': error ? errorId : undefined,
          style: { textAlign: align, fontVariantNumeric: 'tabular-nums' },
        }}
        sx={{ height: 32, width: '100%' }}
      />
    </DvTooltip>
  );
}
