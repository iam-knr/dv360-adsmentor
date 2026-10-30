import type { Metadata } from 'next';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { ClassControls } from '@/components/instructor/ClassControls';
import { ClassPicker } from '@/components/instructor/ClassPicker';
import { DvBanner } from '@/components/dv/DvBanner';
import { DvPageHeader } from '@/components/dv/DvPageHeader';
import { DvSectionCard } from '@/components/dv/DvSectionCard';
import { pageActor } from '@/lib/accounts/session-actor';
import { getDashboard } from '@/lib/instructor/dashboard';
import { formatInZone } from '@/lib/instructor/format';
import { orNotFound } from '@/lib/instructor/page';

export const metadata: Metadata = { title: 'Instructor | DV360 Simulator by Adsmetor' };

export default async function InstructorHomePage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const actor = await pageActor();
  const sp = await searchParams;
  const d = await orNotFound(() => getDashboard(actor, sp.class));
  if (!d.selected) {
    return (
      <Box>
        <DvPageHeader title="Instructor console" />
        <Typography>
          You do not teach a class yet. <Link href="/manage/cohorts/new">Create a cohort</Link> to get started.
        </Typography>
      </Box>
    );
  }
  const tz = d.selected.timeZone;
  const open = d.access?.open ?? false;
  return (
    <Box>
      <DvPageHeader title="Instructor console" actions={<ClassPicker classes={d.classes} value={d.selected.id} />} />
      <Box sx={{ display: 'grid', gap: 4, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <DvSectionCard title="Class status">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography data-testid="class-status" variant="cardTitle">
              {d.selected.name}: {open ? 'Open' : 'Closed'}
            </Typography>
            <Typography variant="body2">
              {open && d.access?.closesAt
                ? `Closes ${formatInZone(d.access.closesAt, tz)}`
                : d.access?.nextWindow
                  ? `Next: ${d.access.nextWindow.label}, ${formatInZone(d.access.nextWindow.opensAt, tz)}`
                  : 'No upcoming window.'}
            </Typography>
            <ClassControls classId={d.selected.id} open={open} />
            <Link href={`/sim/instructor/classes/${d.selected.id}/access`}>Access windows</Link>
          </Box>
        </DvSectionCard>
        <DvSectionCard title="Students">
          <Typography>{d.students.active} active</Typography>
          <Typography>{d.students.online} online in the last 5 minutes</Typography>
          <Link href={`/sim/instructor/classes/${d.selected.id}`}>Roster</Link>
        </DvSectionCard>
        <DvSectionCard title="Sim clock">
          {Object.keys(d.clock.states).length === 0 ? (
            <Typography>No sandboxes yet.</Typography>
          ) : (
            <>
              <Typography>
                {Object.entries(d.clock.states)
                  .map(([s, n]) => `${n} ${s.toLowerCase()}`)
                  .join(', ')}
              </Typography>
              {d.clock.simNow ? <Typography variant="body2">Latest sim date {d.clock.simNow.toISOString().slice(0, 16).replace('T', ' ')} UTC</Typography> : null}
            </>
          )}
        </DvSectionCard>
        <DvSectionCard title="Alerts">
          {d.alerts.length === 0 ? (
            <Typography>Nothing needs attention.</Typography>
          ) : (
            d.alerts.map((a) => (
              <DvBanner key={a} kind="warning" level="inline">
                {a}
              </DvBanner>
            ))
          )}
          <Typography variant="body2" sx={{ mt: 2 }}>
            Sandboxes: {d.sandboxes.ready} ready of {d.sandboxes.total}
            {d.sandboxes.notCreated ? `, ${d.sandboxes.notCreated} not created` : ''}.
          </Typography>
        </DvSectionCard>
      </Box>
      <Box sx={{ mt: 4 }}>
        <DvSectionCard title="Recent activity">
          <Typography variant="body2" sx={{ mb: 2 }}>
            {d.studentEdits24h} student edit{d.studentEdits24h === 1 ? '' : 's'} in the last 24 hours.
          </Typography>
          {d.recent.length === 0 ? (
            <Typography>No instructor or scenario changes yet.</Typography>
          ) : (
            <Box component="ul" sx={{ m: 0, pl: 5 }}>
              {d.recent.map((r) => (
                <li key={r.id}>
                  {formatInZone(r.occurredAt, tz)}: {r.summary}
                  {r.entityName ? ` (${r.entityName})` : ''}
                </li>
              ))}
            </Box>
          )}
        </DvSectionCard>
      </Box>
    </Box>
  );
}
