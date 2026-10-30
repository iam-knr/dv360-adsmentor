'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import { DvBanner } from '@/components/dv/DvBanner';
import { DvEmptyState } from '@/components/dv/DvEmptyState';
import { DvGrid, type DvColumn } from '@/components/dv/DvGrid';
import { DvModal } from '@/components/dv/DvModal';
import { DvTextField } from '@/components/dv/DvTextField';
import { resetSandboxesAction } from '@/lib/instructor/actions';
import type { SandboxOutcome } from '@/lib/instructor/sandboxes';

export interface SandboxItem {
  userId: string;
  name: string;
  sandbox: string;
  resetCount: number;
  lastResetAt: string;
}

type Dialog = null | 'selected' | 'class';

export function SandboxesView({
  classId,
  className,
  items,
}: {
  classId: string;
  className: string;
  items: SandboxItem[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<Dialog>(null);
  const [typed, setTyped] = useState('');
  const [newSeed, setNewSeed] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [outcomes, setOutcomes] = useState<SandboxOutcome[] | null>(null);

  const close = () => {
    setDialog(null);
    setTyped('');
    setError(undefined);
  };
  const run = () =>
    start(async () => {
      setError(undefined);
      const r = await resetSandboxesAction(
        dialog === 'class'
          ? { classId, scope: 'CLASS', confirm: typed, newMarketSeed: newSeed }
          : { classId, scope: 'USER', userIds: [...selection], confirm: typed, newMarketSeed: newSeed },
      );
      if (!r.ok) return setError(r.error);
      close();
      setSelection(new Set());
      setOutcomes(r.data.outcomes);
      router.refresh();
    });

  const columns: DvColumn<SandboxItem>[] = [
    { id: 'name', header: 'Student', width: 220, sticky: true },
    { id: 'sandbox', header: 'Sandbox', width: 130 },
    { id: 'resetCount', header: 'Resets', type: 'number', width: 90 },
    { id: 'lastResetAt', header: 'Last reset', width: 190 },
  ];
  const failed = outcomes?.filter((o) => !o.ok) ?? [];

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button variant="outlined" disabled={selection.size === 0} onClick={() => setDialog('selected')}>
          Reset selected
        </Button>
        <Button variant="outlined" color="error" disabled={items.length === 0} onClick={() => setDialog('class')}>
          Reset whole class
        </Button>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          A reset returns the sandbox to its seed state. The student&apos;s work is not recoverable.
        </Typography>
      </Box>
      {outcomes ? (
        <DvBanner kind={failed.length ? 'warning' : 'success'} onDismiss={() => setOutcomes(null)}>
          {outcomes.length - failed.length} sandbox{outcomes.length - failed.length === 1 ? '' : 'es'} reset.
          {failed.length ? (
            <ul>
              {failed.map((o) => (
                <li key={o.userId}>
                  {o.name}: {o.error}
                </li>
              ))}
            </ul>
          ) : null}
        </DvBanner>
      ) : null}
      <DvGrid
        ariaLabel={`Sandboxes in ${className}`}
        rows={items}
        columns={columns}
        getRowId={(r) => r.userId}
        selection={selection}
        onSelectionChange={setSelection}
        page={1}
        pageSize={Math.max(items.length, 20)}
        total={items.length}
        onPageChange={() => undefined}
        emptyState={<DvEmptyState variant="inline" message="No students in this class yet." />}
      />
      <DvModal
        open={dialog !== null}
        title={dialog === 'class' ? `Reset the whole class?` : `Reset ${selection.size} sandbox${selection.size === 1 ? '' : 'es'}?`}
        onClose={close}
        error={error}
        primary={{
          label: pending ? 'Resetting…' : 'Reset',
          tone: 'danger',
          loading: pending,
          disabled: typed.trim() === '',
          onClick: run,
        }}
        secondary={{ label: 'Cancel', onClick: close }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
          <Typography>
            Everything the {dialog === 'class' ? 'students in this class have' : 'selected students have'} built in
            the sandbox is deleted and cannot be restored.{' '}
            {dialog === 'class' ? `Type the class name (${className}) to confirm.` : 'Type RESET to confirm.'}
          </Typography>
          <DvTextField ariaLabel="Confirmation" value={typed} onChange={setTyped} />
          <FormControlLabel
            control={<Checkbox checked={newSeed} onChange={(e) => setNewSeed(e.target.checked)} />}
            label="Build a new market seed"
          />
        </Box>
      </DvModal>
    </Box>
  );
}
