'use client';

// Bulk status page body (module 11 3.2, AC-11-21): one row per job, newest first, 100 at most.
import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { BLK_015 } from '@/lib/bulk/messages';
import type { BulkJobRow } from '@/lib/bulk/types';

const STATUS_TEXT: Record<string, string> = { QUEUED: 'Queued', RUNNING: 'Running', COMPLETED: 'Completed', FAILED: 'Failed' };

export function BulkStatusTable({ initial, capped }: { initial: BulkJobRow[]; capped: boolean }) {
  const [rows, setRows] = useState(initial);
  const open = rows.some((r) => r.status === 'QUEUED' || r.status === 'RUNNING');

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => {
      void fetch('/api/dv/bulk-jobs')
        .then((res) => res.json() as Promise<{ data?: { rows: BulkJobRow[] } }>)
        .then((json) => json.data && setRows(json.data.rows))
        .catch(() => undefined);
    }, 3000);
    return () => clearInterval(t);
  }, [open]);

  return (
    <Box>
      <Table size="small" aria-label="Bulk actions">
        <TableHead>
          <TableRow>
            {['Requested', 'Partner Id', 'Advertiser Id', 'Description', 'Source', 'User', 'Last Updated', 'Status', ''].map((h) => (
              <TableCell key={h || 'action'}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} data-job={r.publicId}>
              <TableCell>{new Date(r.requestedAt).toLocaleString('en-GB', { timeZone: 'UTC' })}</TableCell>
              <TableCell>{r.partnerId.slice(-6)}</TableCell>
              <TableCell>{r.advertiserId?.slice(-6) ?? ''}</TableCell>
              <TableCell>{r.description}</TableCell>
              <TableCell>{r.sourceLabel}</TableCell>
              <TableCell>{r.user}</TableCell>
              <TableCell>{new Date(r.updatedAt).toLocaleString('en-GB', { timeZone: 'UTC' })}</TableCell>
              <TableCell>
                {STATUS_TEXT[r.status]}
                {r.errorSummary ? <Typography variant="caption" sx={{ display: 'block' }}>{r.errorSummary}</Typography> : null}
              </TableCell>
              <TableCell>
                {r.action === 'RESULTS' ? <Link href={`/api/dv/bulk-jobs/${r.id}/result`} download>Download</Link> : null}
                {r.action === 'VIEW' ? <Link href={`/api/dv/bulk-jobs/${r.id}`}>View</Link> : null}
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 ? (
            <TableRow><TableCell colSpan={9}><Typography sx={{ p: 2 }}>No bulk actions yet</Typography></TableCell></TableRow>
          ) : null}
        </TableBody>
      </Table>
      {capped ? <Typography variant="caption" sx={{ display: 'block', mt: 2 }}>{BLK_015}</Typography> : null}
    </Box>
  );
}
