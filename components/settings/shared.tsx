'use client';

// Small pieces shared by the module 02 settings forms: issue mapping, a labelled checkbox and the page frame.
import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import { DvPageHeader } from '@/components/dv';

export interface Issue {
  path: string;
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
}

/** `path -> message` of the blocking issues of a failed save. */
export const errorMap = (issues: readonly Issue[]): Record<string, string> =>
  Object.fromEntries(issues.filter((i) => i.severity === 'error').map((i) => [i.path, i.message]));

export function CheckRow({
  label,
  checked,
  onChange,
  disabled,
  testId,
  helper,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  testId?: string;
  helper?: ReactNode;
}) {
  return (
    <Box>
      <FormControlLabel
        control={
          <Checkbox
            checked={checked}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
            slotProps={{ input: { 'data-testid': testId } as never }}
          />
        }
        label={label}
      />
      {helper ? (
        <Typography variant="caption" component="div" sx={{ ml: 4 }}>
          {helper}
        </Typography>
      ) : null}
    </Box>
  );
}

/** Page title with the Limited Access chip, then the body (max width 960). */
export function SettingsPage({
  title,
  limited,
  children,
}: {
  title: string;
  limited?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <DvPageHeader title={title} limitedAccess={limited ?? false} />
      <Box sx={{ p: 4, maxWidth: 960, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {children}
      </Box>
    </>
  );
}

export const NIELSEN_COUNTRIES = [
  { value: '', label: 'Not set' },
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'IN', label: 'India' },
  { value: 'DE', label: 'Germany' },
  { value: 'SG', label: 'Singapore' },
  { value: 'AU', label: 'Australia' },
  { value: 'JP', label: 'Japan' },
] as const;
