'use client';

// DLG-07 "End {name}?" (module 17 S12): ending stops the test or study and cannot be undone.
import { DvModal } from '@/components/dv';

export function EndDialog({
  open,
  name,
  noun,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  name: string;
  noun: 'test' | 'study';
  busy?: boolean;
  error?: string | undefined;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <DvModal
      open={open}
      title={`End ${name}?`}
      primary={{ label: 'End', onClick: onConfirm, loading: !!busy, tone: 'danger' }}
      secondary={{ label: 'Cancel', onClick: onCancel }}
      onClose={onCancel}
      {...(error ? { error } : {})}
    >
      {`Ending stops the ${noun}. This can't be undone.`}
    </DvModal>
  );
}
