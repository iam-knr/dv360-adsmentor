'use client';

// Frame of the audience create forms: cards on top, warnings, and the sticky Save / Cancel footer (design-system 2.8.6).
import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import { DvBanner, DvFormFooter } from '@/components/dv';
import type { WireIssue } from '@/lib/audiences/wire';

export function AudienceFormShell({
  children,
  dirty,
  pending,
  onSave,
  onCancel,
  saveDisabled,
  warnings = [],
  primaryLabel = 'Save',
}: {
  children: ReactNode;
  dirty: boolean;
  pending?: boolean;
  onSave: () => void;
  onCancel: () => void;
  saveDisabled?: boolean;
  warnings?: WireIssue[];
  primaryLabel?: string;
}) {
  return (
    <Box
      component="form"
      noValidate
      onSubmit={(e) => e.preventDefault()}
      sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}
    >
      {children}
      {warnings.map((w) => (
        <DvBanner key={`${w.code}${w.path}`} kind="warning">
          {w.message}
        </DvBanner>
      ))}
      <DvFormFooter
        mode="create"
        dirty={dirty && !saveDisabled && !pending}
        primaryLabel={primaryLabel}
        onPrimary={onSave}
        onSecondary={onCancel}
      />
    </Box>
  );
}
