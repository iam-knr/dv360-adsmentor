'use client';

// DLG-11 "This item changed" (validation.md 5.1): shown when a save hits a version mismatch. Reload drops the draft
// and reads the latest version; Keep my changes saves the draft again over it (a new ChangeLog row).
import { DvModal } from '@/components/dv';
import { DIALOGS } from '@/lib/validation/dialogs';

export function StaleSaveDialog({
  open,
  onReload,
  onKeep,
}: {
  open: boolean;
  onReload: () => void;
  onKeep: () => void;
}) {
  const d = DIALOGS['DLG-11'];
  return (
    <DvModal
      open={open}
      title={d.title ?? 'This item changed'}
      primary={{ label: 'Reload', onClick: onReload }}
      secondary={{ label: 'Keep my changes', onClick: onKeep }}
    >
      {d.body}
    </DvModal>
  );
}
