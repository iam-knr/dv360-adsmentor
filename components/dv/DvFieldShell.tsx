'use client';

import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { DvBanner } from './DvBanner';
import { DvHelp } from './DvTooltip';

export interface FieldMessages {
  error?: string;
  warning?: string;
  hint?: string;
}

export interface DvFieldShellProps extends FieldMessages {
  id: string;
  label?: string;
  required?: boolean;
  /** Shows "Required" in the label row. */
  showRequiredHint?: boolean;
  help?: string;
  /** Right-aligned counter below the control, for example "0 / 240". */
  counter?: string;
  children: ReactNode;
}

export const errorId = (id: string) => `${id}-error`;
export const hintId = (id: string) => `${id}-hint`;
export const warningId = (id: string) => `${id}-warning`;

/** aria-describedby value for a field with the given messages. */
export function describedBy(id: string, m: FieldMessages): string | undefined {
  const ids = [m.error && errorId(id), m.warning && warningId(id), m.hint && hintId(id)].filter(
    Boolean,
  );
  return ids.length ? ids.join(' ') : undefined;
}

/** Label above the control, then messages (error, warning banner, hint) and counter (design-system 2.8.1). */
export function DvFieldShell({
  id,
  label,
  required,
  showRequiredHint,
  help,
  counter,
  error,
  warning,
  hint,
  children,
}: DvFieldShellProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
      {label ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography component="label" htmlFor={id} id={`${id}-label`} variant="subtitle1">
            {label}
            {required ? (
              <Box component="span" aria-hidden="true" sx={{ color: 'statusText.error', ml: 0.5 }}>
                *
              </Box>
            ) : null}
          </Typography>
          {help ? <DvHelp label={`Help: ${label}`}>{help}</DvHelp> : null}
          {showRequiredHint ? (
            <Typography variant="caption" sx={{ ml: 'auto' }}>
              Required
            </Typography>
          ) : null}
        </Box>
      ) : null}
      {children}
      {error ? (
        <Typography id={errorId(id)} variant="caption" sx={{ color: 'statusText.error' }}>
          {error}
        </Typography>
      ) : null}
      {warning ? (
        <Box id={warningId(id)}>
          <DvBanner kind="warning">{warning}</DvBanner>
        </Box>
      ) : null}
      {hint || counter ? (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
          {hint ? (
            <Typography id={hintId(id)} variant="caption">
              {hint}
            </Typography>
          ) : (
            <span />
          )}
          {counter ? (
            <Typography variant="caption" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {counter}
            </Typography>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}
