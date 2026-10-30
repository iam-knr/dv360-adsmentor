'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { DvBanner } from '@/components/dv/DvBanner';
import { DvTextField } from '@/components/dv/DvTextField';
import { archiveCohortAction, updateCohortAction } from '@/lib/actions/accounts';

export interface CohortMember {
  id: string;
  name: string;
  email: string;
  status: string;
  sandbox: string;
  lastLogin: string;
}

export interface CohortDetailProps {
  id: string;
  name: string;
  capacity: number;
  archived: boolean;
  members: CohortMember[];
}

/** One cohort: rename it, change its seat limit, archive it, and see its students (each links to the account page). */
export function CohortDetail({ id, name, capacity, archived, members }: CohortDetailProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [nameValue, setNameValue] = useState(name);
  const [capacityValue, setCapacityValue] = useState(String(capacity));
  const [error, setError] = useState<string | undefined>();

  const save = () =>
    start(async () => {
      setError(undefined);
      const r = await updateCohortAction(id, { name: nameValue, capacity: Number(capacityValue) });
      if (!r.ok) setError(r.error);
      else {
        setEditing(false);
        router.refresh();
      }
    });

  const archive = () => {
    const note = members.length
      ? ` Its ${members.length} students keep their accounts and sandboxes and move out of any cohort.`
      : '';
    if (!window.confirm(`Archive the cohort "${name}"?${note}`)) return;
    start(async () => {
      setError(undefined);
      const r = await archiveCohortAction(id);
      if (!r.ok) setError(r.error);
      else {
        router.push('/manage/cohorts');
        router.refresh();
      }
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="pageTitle" component="h1">
        {name}
      </Typography>
      {error ? (
        <div role="alert">
          <DvBanner kind="error">{error}</DvBanner>
        </div>
      ) : null}
      {editing ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 420 }}>
          <DvTextField label="Name" required value={nameValue} onChange={setNameValue} />
          <DvTextField
            label="Capacity"
            type="number"
            value={capacityValue}
            onChange={setCapacityValue}
            hint="1 to 60 students."
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button onClick={() => setEditing(false)}>Cancel</Button>
            <Button variant="contained" disabled={pending} onClick={save}>
              Save
            </Button>
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography>
            {members.length} of {capacity} seats used
          </Typography>
          {archived ? (
            <Typography color="text.secondary">Archived</Typography>
          ) : (
            <>
              <Button variant="outlined" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button variant="outlined" color="error" disabled={pending} onClick={archive}>
                Archive
              </Button>
              <Button variant="contained" href="/manage/accounts/new">
                Add student
              </Button>
            </>
          )}
        </Box>
      )}
      <Typography variant="h6" component="h2">
        Students
      </Typography>
      {members.length === 0 ? (
        <Typography color="text.secondary">No students in this cohort yet.</Typography>
      ) : (
        <Box
          component="table"
          aria-label="Cohort students"
          sx={{
            borderCollapse: 'collapse',
            width: '100%',
            '& td, & th': { textAlign: 'left', p: 2, borderBottom: 1, borderColor: 'divider' },
          }}
        >
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Sandbox</th>
              <th>Last sign in</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>
                  <Link href={`/manage/accounts/${m.id}`} underline="hover">
                    {m.name}
                  </Link>
                </td>
                <td>{m.email}</td>
                <td>{m.status.charAt(0) + m.status.slice(1).toLowerCase()}</td>
                <td>{m.sandbox}</td>
                <td>{m.lastLogin}</td>
              </tr>
            ))}
          </tbody>
        </Box>
      )}
    </Box>
  );
}
