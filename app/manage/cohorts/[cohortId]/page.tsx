import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { CohortDetail } from '@/components/manage/CohortDetail';
import { AccountError } from '@/lib/accounts/rules';
import { getCohort } from '@/lib/accounts/service';
import { pageActor } from '@/lib/accounts/session-actor';
import { formatDate } from '@/lib/auth/messages';

export const metadata: Metadata = { title: 'Cohort | DV360 Simulator by Adsmetor' };
export const dynamic = 'force-dynamic';

export default async function CohortPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const actor = await pageActor();
  const { cohortId } = await params;
  let cohort;
  try {
    cohort = await getCohort(actor, cohortId);
  } catch (err) {
    if (err instanceof AccountError) notFound();
    throw err;
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 900 }}>
      <Typography variant="body2">
        <Link href="/manage/cohorts">Back to cohorts</Link>
      </Typography>
      <CohortDetail
        id={cohort.id}
        name={cohort.name}
        capacity={cohort.capacity}
        archived={cohort.archivedAt !== null}
        members={cohort.members.map((m) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          status: m.status,
          sandbox: m.sandbox,
          lastLogin: m.lastLoginAt ? formatDate(m.lastLoginAt) : 'Never',
        }))}
      />
    </Box>
  );
}
