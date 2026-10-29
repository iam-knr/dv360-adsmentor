'use client';

// Report runs, "Files → View" (module 16 S3).
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { DvIcon } from '@/components/icons';
import { DvBanner, DvEmptyState } from '@/components/dv';
import { useViewer } from '@/components/shell/ViewerProvider';
import { runReportAction } from '@/lib/reporting/actions';
import type { RunRow } from '@/lib/reporting/types';
import { partnerPath } from '@/lib/routes/paths';

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
      })
    : '';

export function ReportRuns({
  partnerId,
  kind,
  report,
  runs,
  canRun,
}: {
  partnerId: string;
  kind: 'instant' | 'offline';
  report: { id: string; publicId: string; name: string };
  runs: RunRow[];
  canRun: boolean;
}) {
  const router = useRouter();
  const { viewer } = useViewer();
  const [, start] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const base = partnerPath(partnerId, 'reporting');
  const editHref = `${base}/${kind}/${report.id}`;

  const runNow = async () => {
    setBusy(true);
    const res = await runReportAction(partnerId, { reportId: report.id });
    setBusy(false);
    if (!res.ok) setError(res.issues[0]?.message ?? 'The report could not be run.');
    else start(() => router.refresh());
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <Link component="button" underline="hover" onClick={() => router.push(editHref)} sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
          <DvIcon name="arrow_back" size={16} /> {report.name}
        </Link>
        <Link component="button" underline="hover" onClick={() => router.push(editHref)}>
          Edit report settings
        </Link>
        <Box sx={{ flex: 1 }} />
        <Typography variant="body2" color="text.secondary">
          Report ID: {report.publicId}
        </Typography>
        {canRun && !viewer.readOnly ? (
          <Button variant="outlined" disabled={busy} onClick={() => void runNow()}>
            Run now
          </Button>
        ) : null}
      </Box>
      {error ? (
        <DvBanner kind="error" onDismiss={() => setError(undefined)}>
          {error}
        </DvBanner>
      ) : null}
      {runs.length === 0 ? (
        <DvEmptyState variant="icon" icon="bar_chart" message="No files yet. Run the report to create one." />
      ) : (
        <Table size="small" aria-label="Report files">
          <TableHead>
            <TableRow>
              <TableCell>File ID</TableCell>
              <TableCell>Date range</TableCell>
              <TableCell>Created by</TableCell>
              <TableCell>Completion time</TableCell>
              <TableCell>Save to drive</TableCell>
              <TableCell>File</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {runs.map((r) => (
              <TableRow key={r.id} data-testid="run-row">
                <TableCell>{r.fileId}</TableCell>
                <TableCell>
                  {r.status === 'DONE' ? `${r.dateRange.from} - ${r.dateRange.to}` : ''}
                </TableCell>
                <TableCell>{r.createdBy}</TableCell>
                <TableCell>{fmt(r.completedAt)}</TableCell>
                <TableCell>
                  <IconButton disabled aria-label="Save to drive (not available)">
                    <DvIcon name="share" />
                  </IconButton>
                </TableCell>
                <TableCell>
                  {r.status === 'DONE' ? (
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <Link href={`/api/dv/report-runs/${r.id}/download?format=csv`} download>
                        CSV
                      </Link>
                      <Link href={`/api/dv/report-runs/${r.id}/download?format=xlsx`} download>
                        Excel
                      </Link>
                      <DvIcon name="download" size={16} />
                      {r.warnings.includes('TRUNCATED') ? <Chip size="small" label="Truncated" /> : null}
                    </Box>
                  ) : (
                    <Box>
                      <Chip size="small" color={r.status === 'FAILED' ? 'error' : 'default'} label={r.status} />
                      {r.error ? (
                        <Typography variant="caption" display="block">
                          {r.error}
                        </Typography>
                      ) : null}
                    </Box>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}
