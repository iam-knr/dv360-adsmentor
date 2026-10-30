import type { Metadata } from 'next';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { DvPageHeader } from '@/components/dv/DvPageHeader';
import { DvSectionCard } from '@/components/dv/DvSectionCard';
import { pageActor } from '@/lib/accounts/session-actor';
import { formatWhen } from '@/lib/instructor/format';
import { orNotFound } from '@/lib/instructor/page';
import { getStudentDetail } from '@/lib/instructor/student';

export const metadata: Metadata = { title: 'Student | DV360 Simulator by Adsmetor' };
export const dynamic = 'force-dynamic';

export default async function StudentPage({
  params,
}: {
  params: Promise<{ classId: string; userId: string }>;
}) {
  const actor = await pageActor();
  const { classId, userId } = await params;
  const d = await orNotFound(() => getStudentDetail(actor, classId, userId));
  return (
    <Box>
      <DvPageHeader
        title={d.student.name}
        actions={
          <>
            {d.viewAsHref ? (
              <Button variant="contained" href={d.viewAsHref}>
                View as student
              </Button>
            ) : null}
            <Button variant="outlined" href={`/sim/instructor/sandboxes?class=${classId}`}>
              Reset sandbox
            </Button>
          </>
        }
      />
      <Typography variant="body2" sx={{ mb: 4 }}>
        {d.student.email} · {d.className} · last sign in {formatWhen(d.student.lastLoginAt)} ·{' '}
        <Link href={`/manage/accounts/${d.student.id}`}>Account</Link>
      </Typography>
      <Box sx={{ display: 'grid', gap: 4, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <DvSectionCard title="Sandbox">
          {d.sandbox ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography data-testid="sandbox-state">{d.sandbox.label}</Typography>
              <Typography variant="body2">Seed template {d.sandbox.template}</Typography>
              <Typography variant="body2">
                Reset {d.sandbox.resetCount} time{d.sandbox.resetCount === 1 ? '' : 's'}
                {d.sandbox.lastResetAt ? `, last ${formatWhen(d.sandbox.lastResetAt)}` : ''}
              </Typography>
              {d.sandbox.simNow ? (
                <Typography variant="body2">
                  Sim time {d.sandbox.simNow.toISOString().slice(0, 16).replace('T', ' ')} UTC ({d.sandbox.clockState?.toLowerCase()})
                </Typography>
              ) : null}
              {d.sandbox.error ? <Typography color="error">{d.sandbox.error}</Typography> : null}
            </Box>
          ) : (
            <Typography>No sandbox yet. Create it from the roster.</Typography>
          )}
        </DvSectionCard>
        <DvSectionCard title="Last 50 changes">
          {d.changes.length === 0 ? (
            <Typography>No changes yet.</Typography>
          ) : (
            <Box component="ul" sx={{ m: 0, pl: 5 }}>
              {d.changes.map((c) => (
                <li key={c.id}>
                  {formatWhen(c.occurredAt)}: {c.summary}
                  {c.entityName ? ` (${c.entityName})` : ''}
                </li>
              ))}
            </Box>
          )}
        </DvSectionCard>
      </Box>
    </Box>
  );
}
