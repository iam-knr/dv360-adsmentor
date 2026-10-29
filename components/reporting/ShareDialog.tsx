'use client';

// Share dialog (module 16 S6): people in this sandbox with report access, view or edit.
import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import { DvModal, useToast } from '@/components/dv';
import { listShareTargetsAction, shareReportAction } from '@/lib/reporting/actions';
import type { ShareTarget } from '@/lib/reporting/service';

export function ShareDialog({
  open,
  reportId,
  reportName,
  initial = [],
  onClose,
  onDone,
}: {
  open: boolean;
  reportId: string;
  reportName: string;
  initial?: string[];
  onClose: () => void;
  onDone?: () => void;
}) {
  const toast = useToast();
  const [targets, setTargets] = useState<ShareTarget[] | null>(null);
  const [picked, setPicked] = useState<string[]>(initial);
  const [canEdit, setCanEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    let live = true;
    void listShareTargetsAction().then((t) => live && setTargets(t));
    return () => {
      live = false;
    };
  }, [open]);

  const save = async () => {
    setBusy(true);
    setError(undefined);
    const res = await shareReportAction(reportId, { userIds: picked, canEdit });
    setBusy(false);
    if (!res.ok) {
      setError(res.issues[0]?.message ?? 'Could not share the report.');
      return;
    }
    toast.show({ kind: 'neutral', message: `Shared ${reportName}` });
    onDone?.();
    onClose();
  };

  return (
    <DvModal
      open={open}
      title={`Share "${reportName}"`}
      size="md"
      onClose={onClose}
      primary={{ label: 'Share', onClick: () => void save(), loading: busy }}
      secondary={{ label: 'Cancel', onClick: onClose }}
      {...(error ? { error } : {})}
    >
      {targets === null ? (
        <Typography variant="body2">Loading people…</Typography>
      ) : targets.length === 0 ? (
        <Typography variant="body2">
          No one else has access to this partner yet. Add people on the Users page first.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {targets.map((t) => (
            <FormControlLabel
              key={t.id}
              control={
                <Checkbox
                  checked={picked.includes(t.id)}
                  onChange={(e) =>
                    setPicked((p) => (e.target.checked ? [...p, t.id] : p.filter((x) => x !== t.id)))
                  }
                />
              }
              label={`${t.name} (${t.email})`}
            />
          ))}
          <FormControlLabel
            sx={{ mt: 2 }}
            control={<Checkbox checked={canEdit} onChange={(e) => setCanEdit(e.target.checked)} />}
            label="Can edit and run"
          />
        </Box>
      )}
    </DvModal>
  );
}
