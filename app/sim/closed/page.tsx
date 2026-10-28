import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Typography from '@mui/material/Typography';
import { SimCard } from '@/components/sim/SimCard';
import { getClassInstructor } from '@/lib/access/class-context';
import { getClassAccessState } from '@/lib/access/windows';
import { formatDateTime } from '@/lib/auth/messages';
import { landingFor } from '@/lib/auth/roles';
import { requireUserOrRedirect } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Class is closed | DV360 Simulator by Adsmetor' };

export default async function ClosedPage() {
  const user = await requireUserOrRedirect();
  const role = user.actor?.appRole ?? user.appRole;
  if (role !== 'user') redirect(landingFor(role));

  const state = user.classroomId ? await getClassAccessState(user.classroomId) : null;
  if (state?.open) redirect(landingFor(role));

  const instructor = user.classroomId ? await getClassInstructor(user.classroomId) : null;

  return (
    <SimCard title="Class is not open right now">
      {state?.nextWindow ? (
        <Typography>
          Your next class opens on {formatDateTime(state.nextWindow.opensAt, state.timeZone)} (
          {state.timeZone}).
        </Typography>
      ) : (
        <Typography>No class time is scheduled yet.</Typography>
      )}
      {instructor ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Ask your instructor if you think this is a mistake: {instructor.name} ({instructor.email}
          ).
        </Typography>
      ) : (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Ask your instructor if you think this is a mistake.
        </Typography>
      )}
    </SimCard>
  );
}
