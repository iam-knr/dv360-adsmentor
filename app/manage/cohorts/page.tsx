import type { Metadata } from 'next';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
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
      <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
        A cohort is an optional group of students. Students do not need one.
      </Typography>
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
              <th>Students</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {cohorts.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/manage/cohorts/${c.id}`} underline="hover">
                    {c.name}
                  </Link>
                </td>
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
