import type { Metadata } from 'next';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { DvEmptyState } from '@/components/dv/DvEmptyState';
import { DvPageHeader } from '@/components/dv/DvPageHeader';
import { listCohorts } from '@/lib/accounts/service';
import { pageActor } from '@/lib/accounts/session-actor';

export const metadata: Metadata = { title: 'Cohorts | DV360 Simulator by Adsmetor' };

export default async function CohortsPage() {
  const actor = await pageActor();
  const cohorts = await listCohorts(actor);
  return (
    <Box>
      <DvPageHeader
        title="Cohorts"
        actions={
          <Button variant="contained" href="/manage/cohorts/new">
            New cohort
          </Button>
        }
      />
      {cohorts.length === 0 ? (
        <DvEmptyState variant="inline" message="No cohorts yet." />
      ) : (
        <Box
          component="table"
          sx={{
            borderCollapse: 'collapse',
            width: '100%',
            '& td, & th': { textAlign: 'left', p: 2, borderBottom: 1, borderColor: 'divider' },
          }}
        >
          <thead>
            <tr>
              <th>Name</th>
              <th>Owner admin</th>
              <th>Users</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {cohorts.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.ownerAdmin.name}</td>
                <td>
                  <Typography component="span">
                    {c.used} of {c.capacity}
                  </Typography>
                </td>
                <td>{c.createdAt.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </Box>
      )}
    </Box>
  );
}
