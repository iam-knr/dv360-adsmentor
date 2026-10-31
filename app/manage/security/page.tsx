import type { Metadata } from 'next';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { MarkSecuritySeen } from '@/components/manage/SecurityWatch';
import { listSecurityEvents, SECURITY_PAGE_SIZE } from '@/lib/accounts/screenshot-guard';
import { pageActor } from '@/lib/accounts/session-actor';
import { formatDateTime } from '@/lib/auth/messages';
import { markSecuritySeenAction } from '@/lib/actions/security';

export const metadata: Metadata = { title: 'Security | DV360 Simulator by Adsmetor' };
export const dynamic = 'force-dynamic';

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const actor = await pageActor();
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const { rows, total } = await listSecurityEvents(actor, page);
  const pages = Math.max(1, Math.ceil(total / SECURITY_PAGE_SIZE));
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <MarkSecuritySeen markSeen={markSecuritySeenAction} />
      <Typography variant="pageTitle" component="h1">
        Security
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720 }}>
        Screenshot attempts by students whose screenshots are not allowed. The student is signed out
        and suspended at once; open the account to restore access or to allow screenshots. A browser
        cannot see a phone camera or a screen recorder, so this is a deterrent, not a guarantee.
        Only the recognised event is stored (method, page, time); nothing typed is recorded. There
        is no email service yet: this page, the banner and the audit log are the notification.
      </Typography>
      <Table size="small" aria-label="Security events">
        <TableHead>
          <TableRow>
            <TableCell>When</TableCell>
            <TableCell>Who</TableCell>
            <TableCell>Method</TableCell>
            <TableCell>Page</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Restored by</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6}>No security events yet.</TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.id} data-testid="security-event" data-status={r.status}>
                <TableCell>
                  {formatDateTime(r.occurredAt)}{' '}
                  {r.unread ? <Chip size="small" color="error" label="New" /> : null}
                </TableCell>
                <TableCell>
                  <Link href={`/manage/accounts/${r.userId}`} underline="hover">
                    {r.userName}
                  </Link>
                  <Typography variant="caption" display="block" color="text.secondary">
                    {r.userEmail}
                  </Typography>
                </TableCell>
                <TableCell>{r.methodLabel}</TableCell>
                <TableCell>{r.path}</TableCell>
                <TableCell>
                  {r.status === 'OPEN' ? (
                    <Chip size="small" color="error" label="Open" />
                  ) : (
                    <Chip size="small" label={`Restored ${formatDateTime(r.restoredAt as Date)}`} />
                  )}
                </TableCell>
                <TableCell>{r.restoredByName ?? '-'}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {pages > 1 ? (
        <Typography variant="body2">
          Page {page} of {pages}
          {page > 1 ? (
            <>
              {' '}
              <Link href={`/manage/security?page=${page - 1}`}>Previous</Link>
            </>
          ) : null}
          {page < pages ? (
            <>
              {' '}
              <Link href={`/manage/security?page=${page + 1}`}>Next</Link>
            </>
          ) : null}
        </Typography>
      ) : null}
    </Box>
  );
}
