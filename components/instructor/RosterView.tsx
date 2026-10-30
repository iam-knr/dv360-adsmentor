'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { DvBanner } from '@/components/dv/DvBanner';
import { DvEmptyState } from '@/components/dv/DvEmptyState';
import { DvGrid, type DvColumn } from '@/components/dv/DvGrid';
import { DvModal } from '@/components/dv/DvModal';
import { DvTextField } from '@/components/dv/DvTextField';
import { OneTimeSecret, type SecretRow } from '@/components/manage/OneTimeSecret';
import {
  addStudentsAction,
  createSandboxAction,
  deactivateStudentAction,
  importRosterAction,
  removeStudentAction,
  resetStudentPasswordAction,
} from '@/lib/instructor/actions';
import { formatWhen } from '@/lib/instructor/format';
import type { RosterRow } from '@/lib/instructor/roster';

type Dialog = null | 'add' | 'reset' | 'deactivate' | 'remove';

export function RosterView({
  classId,
  className,
  rows,
  capacity,
  signInUrl,
}: {
  classId: string;
  className: string;
  rows: RosterRow[];
  capacity: number;
  signInUrl: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [secrets, setSecrets] = useState<SecretRow[] | null>(null);
  const [skipped, setSkipped] = useState<{ email: string; reason: string }[]>([]);
  const [pasted, setPasted] = useState('');
  const [typed, setTyped] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = rows.filter((r) => selection.has(r.id));
  const one = selected.length === 1 ? selected[0]! : null;
  const close = () => {
    setDialog(null);
    setError(undefined);
    setPasted('');
    setTyped('');
  };

  const columns: DvColumn<RosterRow>[] = [
    { id: 'name', header: 'Name', width: 200, sticky: true },
    { id: 'email', header: 'Email', width: 260 },
    { id: 'sandbox', header: 'Sandbox', width: 130 },
    { id: 'status', header: 'Account', width: 100 },
    { id: 'lastLoginAt', header: 'Last sign in', width: 190, accessor: (r) => formatWhen(r.lastLoginAt) },
    {
      id: 'actions',
      header: 'Student',
      type: 'custom',
      width: 130,
      cell: (r) => (
        <a href={`/sim/instructor/classes/${classId}/students/${r.id}`}>Open</a>
      ),
    },
  ];

  // "name,email" per line, or the same with a header row. A CSV file is read in the browser and posted as text.
  const parseLines = (text: string) =>
    text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [name = '', email = ''] = l.split(',').map((c) => c.trim());
        return { name, email };
      });

  const add = () =>
    start(async () => {
      setError(undefined);
      const students = parseLines(pasted).filter((s) => s.email.toLowerCase() !== 'email');
      if (students.length === 0) return setError('Enter at least one student as name,email.');
      const r = await addStudentsAction(classId, students);
      if (!r.ok) return setError(r.error);
      finishAdd(r.data.created, r.data.skipped);
    });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    start(async () => {
      setError(undefined);
      const r = await importRosterAction(classId, text);
      if (!r.ok) {
        const first = r.rows?.[0];
        return setError(first ? `Row ${first.row}: ${first.message}` : r.error);
      }
      finishAdd(r.data.created, [
        ...r.data.errors.map((e) => ({ email: `row ${e.row}`, reason: e.message })),
        ...r.data.skipped,
      ]);
    });
  };

  const finishAdd = (
    created: { email: string; password: string }[],
    skip: { email: string; reason: string }[],
  ) => {
    close();
    setSkipped(skip);
    if (created.length) setSecrets(created.map((c) => ({ email: c.email, password: c.password })));
    router.refresh();
  };

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, done?: string) =>
    start(async () => {
      setError(undefined);
      const r = await fn();
      if (!r.ok) return setError(r.error);
      close();
      setSelection(new Set());
      if (done) setNotice(done);
      router.refresh();
    });

  const resetPw = () =>
    start(async () => {
      if (!one) return;
      const r = await resetStudentPasswordAction(one.id);
      if (!r.ok) return setError(r.error);
      close();
      if (r.data.tempPassword) setSecrets([{ email: one.email, password: r.data.tempPassword }]);
      router.refresh();
    });

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button variant="contained" onClick={() => setDialog('add')}>
          Add students
        </Button>
        <Button variant="outlined" onClick={() => fileRef.current?.click()} disabled={pending}>
          Import CSV
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          aria-label="Roster CSV file"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <Button variant="outlined" href={`/sim/instructor/classes/${classId}/roster.csv`}>
          Download roster CSV
        </Button>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {rows.length} of {capacity} seats used
        </Typography>
      </Box>
      {notice ? <DvBanner kind="success" onDismiss={() => setNotice(undefined)}>{notice}</DvBanner> : null}
      {error && dialog === null ? <DvBanner kind="error" onDismiss={() => setError(undefined)}>{error}</DvBanner> : null}
      {skipped.length ? (
        <DvBanner kind="warning" onDismiss={() => setSkipped([])}>
          {skipped.length} not added:
          <ul>
            {skipped.map((s, i) => (
              <li key={`${s.email}-${i}`}>
                {s.email}: {s.reason}
              </li>
            ))}
          </ul>
        </DvBanner>
      ) : null}
      {selected.length > 0 ? (
        <Box
          role="toolbar"
          aria-label="Student actions"
          sx={{ display: 'flex', gap: 2, alignItems: 'center', my: 3, p: 2, bgcolor: 'action.selected', borderRadius: 1 }}
        >
          <Typography variant="body2">{selected.length} selected</Typography>
          <Button size="small" disabled={!one} onClick={() => setDialog('reset')}>
            Reset password
          </Button>
          <Button
            size="small"
            disabled={!one || pending || (one.sandbox !== 'NOT CREATED' && one.sandbox !== 'FAILED')}
            onClick={() => one && act(() => createSandboxAction(classId, one.id), 'Sandbox built.')}
          >
            {one?.sandbox === 'FAILED' ? 'Retry sandbox' : 'Create sandbox'}
          </Button>
          <Button size="small" disabled={!one?.viewAsHref} href={one?.viewAsHref ?? undefined}>
            View as
          </Button>
          <Button size="small" disabled={!one} onClick={() => setDialog('deactivate')}>
            Deactivate
          </Button>
          <Button size="small" color="error" disabled={!one} onClick={() => setDialog('remove')}>
            Remove
          </Button>
          <Button size="small" onClick={() => setSelection(new Set())}>
            Clear
          </Button>
        </Box>
      ) : null}
      <DvGrid
        ariaLabel={`Students in ${className}`}
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        selection={selection}
        onSelectionChange={setSelection}
        page={1}
        pageSize={Math.max(rows.length, 20)}
        total={rows.length}
        onPageChange={() => undefined}
        emptyState={
          <DvEmptyState
            variant="inline"
            message="No students yet."
            action={{ label: 'Add students', onClick: () => setDialog('add'), primary: true }}
          />
        }
      />

      <DvModal
        open={dialog === 'add'}
        title="Add students"
        size="md"
        onClose={close}
        error={error}
        primary={{ label: 'Add students', onClick: add, loading: pending }}
        secondary={{ label: 'Cancel', onClick: close }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            One student per line as name,email. Each gets a generated password, shown once. Adsmetor
            does not send email: give the email and password to the student yourself.
          </Typography>
          <DvTextField
            label="Students, one per line as name,email"
            multiline
            rows={6}
            value={pasted}
            onChange={setPasted}
            placeholder="Asha Rao,asha@example.com"
          />
        </Box>
      </DvModal>

      <DvModal
        open={dialog === 'reset'}
        title="Reset password?"
        onClose={close}
        error={error}
        primary={{ label: 'Reset password', onClick: resetPw, loading: pending }}
        secondary={{ label: 'Cancel', onClick: close }}
      >
        {one?.name} gets a new generated password and is signed out everywhere. They must change it at the next sign in.
      </DvModal>

      <DvModal
        open={dialog === 'deactivate'}
        title="Deactivate student?"
        onClose={close}
        error={error}
        primary={{
          label: 'Deactivate',
          loading: pending,
          onClick: () => one && act(() => deactivateStudentAction(one.id), `${one.name} was deactivated.`),
        }}
        secondary={{ label: 'Cancel', onClick: close }}
      >
        {one?.name} cannot sign in and the sandbox is frozen. You can enable the account again from Accounts.
      </DvModal>

      <DvModal
        open={dialog === 'remove'}
        title="Remove student?"
        onClose={close}
        error={error}
        primary={{
          label: 'Remove',
          tone: 'danger',
          loading: pending,
          disabled: typed !== 'REMOVE',
          onClick: () => one && act(() => removeStudentAction(classId, one.id), `${one.name} was removed.`),
        }}
        secondary={{ label: 'Cancel', onClick: close }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
          <Typography>
            {one?.name} is archived and the sandbox is closed. Type REMOVE to confirm.
          </Typography>
          <DvTextField ariaLabel="Type REMOVE to confirm" value={typed} onChange={setTyped} />
        </Box>
      </DvModal>

      {secrets ? (
        <OneTimeSecret
          title={secrets.length === 1 ? 'Password' : `${secrets.length} new passwords`}
          rows={secrets}
          signInUrl={signInUrl}
          onDone={() => setSecrets(null)}
        />
      ) : null}
    </Box>
  );
}
