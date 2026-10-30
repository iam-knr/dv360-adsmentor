'use client';

// Notes slide-over of the History page (module 05 2.3): `?sim_panel=notes:YYYYMMDD`. Title "{Mon D, YYYY} notes", a text
// box with Save and Cancel, and the list of notes of that day. Read-only roles see the list without the text box.
import { useCallback, useEffect, useState, useTransition } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { DvSlideOver, DvTextField } from '@/components/dv';
import { DvIcon } from '@/components/icons';
import {
  addHistoryNoteAction,
  deleteHistoryNoteAction,
  listHistoryNotesAction,
} from '@/lib/history/actions';
import type { HistoryEntityType, HistoryNoteRow } from '@/lib/history/types';
import { longDate } from '@/lib/history/zone';

export interface NotesPanelProps {
  entity: { type: HistoryEntityType; id: string };
  /** YYYY-MM-DD, or null when closed. */
  date: string | null;
  canAdd: boolean;
  onClose: () => void;
  /** Called after a note was added or deleted, with the new count of that day. */
  onCount: (date: string, count: number) => void;
}

export function NotesPanel({ entity, date, canAdd, onClose, onCount }: NotesPanelProps) {
  const [notes, setNotes] = useState<HistoryNoteRow[] | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const load = useCallback(
    async (d: string) => {
      const res = await listHistoryNotesAction({ entityType: entity.type, entityId: entity.id, date: d });
      if (res.ok) {
        setNotes(res.data);
        onCount(d, res.data.length);
      } else setError(res.issues[0]?.message ?? 'Could not load notes.');
    },
    [entity.id, entity.type, onCount],
  );

  useEffect(() => {
    setNotes(null);
    setText('');
    setError(null);
    if (date) void load(date);
    // `load` changes with onCount; reload only when the day changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  if (!date) return null;
  const save = () =>
    start(async () => {
      setError(null);
      const res = await addHistoryNoteAction({
        entityType: entity.type,
        entityId: entity.id,
        date,
        text,
      });
      if (!res.ok) {
        setError(res.issues[0]?.message ?? 'Could not save the note.');
        return;
      }
      setText('');
      await load(date);
    });
  const remove = (id: string) =>
    start(async () => {
      const res = await deleteHistoryNoteAction(id);
      if (!res.ok) {
        setError(res.issues[0]?.message ?? 'Could not delete the note.');
        return;
      }
      await load(date);
    });

  return (
    <DvSlideOver
      open
      title={`${longDate(date)} notes`}
      dirty={text.length > 0}
      onCancel={onClose}
      {...(canAdd ? { onApply: save, applyLabel: 'Save', applyDisabled: pending } : {})}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {canAdd ? (
          <DvTextField
            label="Note"
            multiline
            rows={3}
            value={text}
            placeholder="Add your note here"
            hint="Your note will be seen by anyone who has access to this page"
            {...(error ? { error } : {})}
            onChange={(v) => setText(v)}
          />
        ) : error ? (
          <Typography color="error" role="alert">{error}</Typography>
        ) : null}
        {notes && notes.length === 0 ? (
          <Typography variant="body2">There are currently no notes.</Typography>
        ) : null}
        <Box component="ul" aria-label="Notes" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {(notes ?? []).map((n) => (
            <Box
              component="li"
              key={n.id}
              data-testid="history-note"
              sx={{ py: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 2 }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" component="div">
                  {n.author} · {n.time}
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {n.text}
                </Typography>
              </Box>
              {n.mine && canAdd ? (
                <IconButton size="small" aria-label="Delete note" onClick={() => remove(n.id)}>
                  <DvIcon name="delete" size={18} />
                </IconButton>
              ) : null}
            </Box>
          ))}
        </Box>
      </Box>
    </DvSlideOver>
  );
}
