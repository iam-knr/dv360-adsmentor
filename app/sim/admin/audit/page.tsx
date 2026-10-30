import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { DvPageHeader } from '@/components/dv/DvPageHeader';
import { pageActor } from '@/lib/accounts/session-actor';
import { AUDIT_PAGE, queryAudit } from '@/lib/instructor/admin';
import { formatWhen } from '@/lib/instructor/format';

export const metadata: Metadata = { title: 'Audit log | DV360 Simulator by Adsmetor' };
export const dynamic = 'force-dynamic';

interface Sp {
  actor?: string;
  class?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: string;
}

const day = (v?: string) => {
  const d = v ? new Date(`${v}T00:00:00Z`) : undefined;
  return d && !Number.isNaN(d.getTime()) ? d : undefined;
};

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<Sp> }) {
  const actor = await pageActor();
  if (actor.role !== 'SUPER_ADMIN') redirect('/sim/forbidden');
  const sp = await searchParams;
  const to = day(sp.to);
  const { rows, total, actions, page } = await queryAudit(actor, {
    actorUserId: sp.actor || undefined,
    classroomId: sp.class || undefined,
    action: sp.action || undefined,
    from: day(sp.from),
    to: to ? new Date(to.getTime() + 86_400_000) : undefined,
    page: Number(sp.page) || 1,
  });
  const pages = Math.max(1, Math.ceil(total / AUDIT_PAGE));
  const qs = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v && k !== 'page') q.set(k, v);
    q.set('page', String(p));
    return `?${q.toString()}`;
  };
  return (
    <Box>
      <DvPageHeader title="Audit log" />
      <Box
        component="form"
        method="get"
        sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'flex-end', mb: 4 }}
      >
        <label>
          Action <br />
          <select name="action" defaultValue={sp.action ?? ''}>
            <option value="">All</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label>
          Actor id <br />
          <input name="actor" defaultValue={sp.actor ?? ''} />
        </label>
        <label>
          Class id <br />
          <input name="class" defaultValue={sp.class ?? ''} />
        </label>
        <label>
          From <br />
          <input name="from" type="date" defaultValue={sp.from ?? ''} />
        </label>
        <label>
          To <br />
          <input name="to" type="date" defaultValue={sp.to ?? ''} />
        </label>
        <Button type="submit" variant="outlined">
          Filter
        </Button>
      </Box>
      <Typography variant="body2" sx={{ mb: 2 }}>
        {total} entries
      </Typography>
      <Box component="table" aria-label="Audit log" sx={{ borderCollapse: 'collapse', width: '100%', '& td, & th': { textAlign: 'left', p: 1.5, borderBottom: 1, borderColor: 'divider' } }}>
        <thead>
          <tr>
            <th>When</th>
            <th>Action</th>
            <th>Result</th>
            <th>Actor</th>
            <th>Class</th>
            <th>Target</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{formatWhen(r.createdAt)}</td>
              <td>{r.action}</td>
              <td>{r.result}</td>
              <td>{r.actorUserId ?? ''}</td>
              <td>{r.classroomId ?? ''}</td>
              <td>
                {r.targetType}
                {r.targetId ? ` ${r.targetId}` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </Box>
      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        {page > 1 ? <Button href={qs(page - 1)}>Previous</Button> : null}
        <Typography variant="body2" sx={{ alignSelf: 'center' }}>
          Page {page} of {pages}
        </Typography>
        {page < pages ? <Button href={qs(page + 1)}>Next</Button> : null}
      </Box>
    </Box>
  );
}
