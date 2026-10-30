'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { DvBanner } from '@/components/dv/DvBanner';
import { DvEmptyState } from '@/components/dv/DvEmptyState';
import { DvGrid, type DvColumn } from '@/components/dv/DvGrid';
import { DvModal } from '@/components/dv/DvModal';
import { DvTextField } from '@/components/dv/DvTextField';
import {
  createWindowAction,
  deleteWindowAction,
  updateWindowAction,
} from '@/lib/instructor/actions';
import { formatInZone } from '@/lib/instructor/format';

export interface WindowItem {
  id: string;
  label: string;
  opensAt: string;
  closesAt: string;
  status: 'SCHEDULED' | 'OPEN' | 'CLOSED' | 'CANCELLED';
  seriesId: string | null;
  note: string | null;
  live: boolean;
  /** Local date and times in the class zone, for the edit form. */
  date: string;
  startTime: string;
  endTime: string;
}

const DAYS = [
  ['MO', 'Mon'],
  ['TU', 'Tue'],
  ['WE', 'Wed'],
  ['TH', 'Thu'],
  ['FR', 'Fri'],
  ['SA', 'Sat'],
  ['SU', 'Sun'],
] as const;

type Day = (typeof DAYS)[number][0];
type Dialog = null | 'new' | 'edit' | 'delete';

const field = { size: 'small' as const, slotProps: { inputLabel: { shrink: true } } };

export function WindowsView({
  classId,
  timeZone,
  windows,
  today,
}: {
  classId: string;
  timeZone: string;
  windows: WindowItem[];
  today: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState<string | undefined>();
  const [warn, setWarn] = useState<string[]>([]);
  const [label, setLabel] = useState('Class');
  const [date, setDate] = useState(today);
  const [start_, setStart] = useState('10:00');
  const [end, setEnd] = useState('12:00');
  const [note, setNote] = useState('');
  const [repeat, setRepeat] = useState(false);
  const [days, setDays] = useState<Day[]>([]);
  const [until, setUntil] = useState(today);
  const [scope, setScope] = useState<'THIS' | 'SERIES'>('THIS');

  const row = windows.find((w) => selected.has(w.id)) ?? null;
  const close = () => {
    setDialog(null);
    setError(undefined);
  };

  const openEdit = () => {
    if (!row) return;
    setLabel(row.label);
    setDate(row.date);
    setStart(row.startTime);
    setEnd(row.endTime);
    setNote(row.note ?? '');
    setScope('THIS');
    setDialog('edit');
  };

  const submit = () =>
    start(async () => {
      setError(undefined);
      const r =
        dialog === 'new'
          ? await createWindowAction({
              classId,
              label,
              date,
              startTime: start_,
              endTime: end,
              note,
              ...(repeat ? { repeat: { byDay: days, until } } : {}),
            })
          : dialog === 'edit' && row
            ? await updateWindowAction(
                row.id,
                { label, startTime: start_, endTime: end, note, ...(scope === 'THIS' ? { date } : {}) },
                scope,
              )
            : dialog === 'delete' && row
              ? await deleteWindowAction(row.id, scope)
              : null;
      if (!r) return;
      if (!r.ok) return setError(r.error);
      setWarn('warnings' in r.data ? r.data.warnings : []);
      close();
      setSelected(new Set());
      router.refresh();
    });

  const columns: DvColumn<WindowItem>[] = [
    { id: 'label', header: 'Label', width: 180 },
    { id: 'opensAt', header: 'Opens', width: 200, accessor: (w) => formatInZone(w.opensAt, timeZone) },
    { id: 'closesAt', header: 'Closes', width: 200, accessor: (w) => formatInZone(w.closesAt, timeZone) },
    { id: 'status', header: 'Status', width: 110, accessor: (w) => (w.live ? 'OPEN' : w.status) },
    { id: 'series', header: 'Repeat', width: 90, accessor: (w) => (w.seriesId ? 'Weekly' : '') },
    { id: 'note', header: 'Note', width: 200 },
  ];

  const toggleDay = (d: Day) =>
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          onClick={() => {
            setLabel('Class');
            setNote('');
            setRepeat(false);
            setDays([]);
            setDialog('new');
          }}
        >
          New window
        </Button>
        <Button variant="outlined" disabled={!row || row.status !== 'SCHEDULED'} onClick={openEdit}>
          Edit
        </Button>
        <Button
          variant="outlined"
          color="error"
          disabled={!row || row.status !== 'SCHEDULED'}
          onClick={() => {
            setScope('THIS');
            setDialog('delete');
          }}
        >
          Delete
        </Button>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Times are in {timeZone}. An open window cannot be edited or deleted: close the class first.
        </Typography>
      </Box>
      {warn.length ? (
        <DvBanner kind="warning" onDismiss={() => setWarn([])}>
          {warn.join(' ')}
        </DvBanner>
      ) : null}
      {error && dialog === null ? <DvBanner kind="error">{error}</DvBanner> : null}
      <DvGrid
        ariaLabel="Access windows"
        rows={windows}
        columns={columns}
        getRowId={(w) => w.id}
        selection={selected}
        onSelectionChange={(s) => setSelected(new Set([...s].slice(-1)))}
        isArchived={(w) => w.status === 'CANCELLED' || w.status === 'CLOSED'}
        page={1}
        pageSize={Math.max(windows.length, 20)}
        total={windows.length}
        onPageChange={() => undefined}
        emptyState={<DvEmptyState variant="inline" message="No access windows yet. The class stays closed until you add one." />}
      />

      <DvModal
        open={dialog === 'new' || dialog === 'edit'}
        title={dialog === 'new' ? 'New access window' : 'Edit access window'}
        size="md"
        onClose={close}
        error={error}
        primary={{ label: 'Save', onClick: submit, loading: pending }}
        secondary={{ label: 'Cancel', onClick: close }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
          <DvTextField label="Label" value={label} onChange={setLabel} maxLength={100} />
          {dialog === 'edit' && scope === 'SERIES' ? null : (
            <TextField {...field} label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          )}
          <Box sx={{ display: 'flex', gap: 3 }}>
            <TextField {...field} label="Start" type="time" value={start_} onChange={(e) => setStart(e.target.value)} />
            <TextField {...field} label="End" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Box>
          <DvTextField label="Note" value={note} onChange={setNote} maxLength={500} />
          {dialog === 'new' ? (
            <>
              <FormControlLabel
                control={<Checkbox checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />}
                label="Repeat weekly"
              />
              {repeat ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {DAYS.map(([d, name]) => (
                      <FormControlLabel
                        key={d}
                        control={<Checkbox checked={days.includes(d)} onChange={() => toggleDay(d)} />}
                        label={name}
                      />
                    ))}
                  </Box>
                  <TextField {...field} label="Repeat until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
                </Box>
              ) : null}
            </>
          ) : row?.seriesId ? (
            <TextField {...field} select label="Apply to" value={scope} onChange={(e) => setScope(e.target.value as 'THIS' | 'SERIES')}>
              <MenuItem value="THIS">This window</MenuItem>
              <MenuItem value="SERIES">This and later windows of the series</MenuItem>
            </TextField>
          ) : null}
        </Box>
      </DvModal>

      <DvModal
        open={dialog === 'delete'}
        title="Delete window?"
        onClose={close}
        error={error}
        primary={{ label: 'Delete', tone: 'danger', onClick: submit, loading: pending }}
        secondary={{ label: 'Cancel', onClick: close }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
          <Typography>{row?.label} will no longer open the class.</Typography>
          {row?.seriesId ? (
            <TextField {...field} select label="Delete" value={scope} onChange={(e) => setScope(e.target.value as 'THIS' | 'SERIES')}>
              <MenuItem value="THIS">This window</MenuItem>
              <MenuItem value="SERIES">This and later windows of the series</MenuItem>
            </TextField>
          ) : null}
        </Box>
      </DvModal>
    </Box>
  );
}
