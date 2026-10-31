import type { Metadata } from 'next';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { DvPageHeader } from '@/components/dv/DvPageHeader';
import { listAudit, type AuditEntry } from '@/lib/accounts/service';
import { pageActor } from '@/lib/accounts/session-actor';
import { isPlaceholderEmail } from '@/lib/accounts/audit-labels';
import { formatDateTime } from '@/lib/auth/messages';

export const metadata: Metadata = { title: 'Audit log | DV360 Simulator by Adsmetor' };
export const dynamic = 'force-dynamic';

interface Sp {
  q?: string;
  action?: string;
  page?: string;
}

function who(p: { name: string; email: string } | null) {
  return p ? (
    <>
      {p.name}
      {isPlaceholderEmail(p.email) ? null : (
        <>
          <br />
          <Typography component="span" variant="caption" color="text.secondary">
            {p.email}
          </Typography>
        </>
      )}
    </>
  ) : (
    <Typography component="span" color="text.secondary">
      System
    </Typography>
  );
}

function targetCell(t: AuditEntry['targetRef']) {
  if (!t)
    return (
      <Typography component="span" color="text.secondary">
        -
      </Typography>
    );
  const href =
    t.id === null
      ? null
      : t.kind === 'cohort'
        ? `/manage/cohorts/${t.id}`
        : `/manage/accounts/${t.id}`;
  const label = (
    <>
      {t.kind === 'cohort' ? 'Cohort: ' : null}
      {t.label}
    </>
  );
  return (
    <>
      {href ? (
        <Link href={href} underline="hover">
          {label}
        </Link>
      ) : (
        <Typography component="span" color="text.secondary">
          {label}
        </Typography>
      )}
      {t.sub ? (
        <>
          <br />
          <Typography component="span" variant="caption" color="text.secondary">
            {t.sub}
          </Typography>
        </>
      ) : null}
    </>
  );
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<Sp> }) {
  const actor = await pageActor();
  const sp = await searchParams;
  const { rows, total, page, pages, actions } = await listAudit(actor, {
    q: sp.q,
    action: sp.action || undefined,
    page: Number(sp.page) || 1,
  });
  const qs = (p: number) => {
    const q = new URLSearchParams();
    if (sp.q) q.set('q', sp.q);
    if (sp.action) q.set('action', sp.action);
    q.set('page', String(p));
    return `?${q.toString()}`;
  };
  return (
    <Box>
      <DvPageHeader title="Audit log" />
      <Box
        component="form"
        method="get"
        sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'flex-end', mb: 3 }}
      >
        <label>
          Person <br />
          <input
            name="q"
            defaultValue={sp.q ?? ''}
            placeholder="Name or email"
            aria-label="Search by person"
          />
        </label>
        <label>
          Action <br />
          <select name="action" defaultValue={sp.action ?? ''} aria-label="Action">
            <option value="">All</option>
            {actions.map((a) => (
              <option key={a.code} value={a.code}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outlined">
          Filter
        </Button>
        <Button href={`/api/manage/audit.csv${qs(1)}`} variant="text">
          Export CSV
        </Button>
      </Box>
      <Typography variant="body2" sx={{ mb: 2 }}>
        {total} entries
      </Typography>
      <Box
        component="table"
        aria-label="Audit log"
        sx={{
          borderCollapse: 'collapse',
          width: '100%',
          '& td, & th': {
            textAlign: 'left',
            verticalAlign: 'top',
            p: 2,
            borderBottom: 1,
            borderColor: 'divider',
            overflowWrap: 'anywhere',
          },
        }}
      >
        <thead>
          <tr>
            <th>When</th>
            <th>Who did it</th>
            <th>What happened</th>
            <th>Target</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{formatDateTime(r.createdAt)}</td>
              <td>{who(r.actor)}</td>
              <td>
                {r.summary}
                {r.result === 'DENIED' ? ' (denied)' : ''}
              </td>
              <td>{targetCell(r.targetRef)}</td>
            </tr>
          ))}
        </tbody>
      </Box>
      <Box sx={{ display: 'flex', gap: 2, mt: 3, alignItems: 'center' }}>
        {page > 1 ? <Button href={qs(page - 1)}>Previous</Button> : null}
        <Typography variant="body2">
          Page {page} of {pages}
        </Typography>
        {page < pages ? <Button href={qs(page + 1)}>Next</Button> : null}
      </Box>
    </Box>
  );
}
