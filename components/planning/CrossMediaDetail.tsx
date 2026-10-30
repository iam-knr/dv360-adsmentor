'use client';

// Cross-media report detail (module 04 S9): header, Digital / TV / Combined cards, a table by medium, actions.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { DvBanner, DvInlineEdit, DvModal, DvStatusChip, useToast } from '@/components/dv';
import { deleteCrossMediaReportAction, renameCrossMediaReportAction } from '@/lib/planning/actions';
import type { CrossMediaDetail as Detail } from '@/lib/planning/cross-media-service';
import { crossMediaPath, type PlanScope } from '@/lib/planning/paths';
import { fmtCompact, fmtDate, fmtPct } from '@/lib/planning/table';

function Card({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <Box
      component="section"
      aria-label={title}
      sx={{
        flex: 1,
        minWidth: 260,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '8px',
        p: 3,
        bgcolor: 'background.paper',
      }}
    >
      <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
        {title}
      </Typography>
      {rows.map(([k, v]) => (
        <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            {k}
          </Typography>
          <Typography variant="body2" fontWeight={500} data-testid={`cm-${title}-${k}`}>
            {v}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export function CrossMediaDetail({ scope, report }: { scope: PlanScope; report: Detail }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(report.name);
  const [confirm, setConfirm] = useState(false);
  const [busy, start] = useTransition();
  const r = report.result;
  const sym = report.currency.code;

  const rename = (v: string) =>
    start(async () => {
      const res = await renameCrossMediaReportAction(scope, report.id, v);
      if (res.ok) setName(v.trim());
      else toast.show({ message: res.issues[0]?.message ?? "Couldn't rename the report." });
    });
  const remove = () =>
    start(async () => {
      const res = await deleteCrossMediaReportAction(scope, report.id);
      if (!res.ok) {
        toast.show({ message: res.issues[0]?.message ?? "Couldn't delete the report." });
        return;
      }
      router.push(crossMediaPath(scope));
    });

  const csv = () => {
    if (!r) return;
    const lines = [
      ['Report', name],
      ['Country', report.country],
      ['Scope', report.scope === 'NATIONAL' ? 'National' : 'Sub-location'],
      ['Currency', sym],
      [],
      [
        'Medium',
        'Reach %',
        'Reach (people)',
        'Impressions',
        'Avg. frequency',
        'Overlap with the other medium',
      ],
      [
        'Digital',
        r.digital.reachPct,
        r.digital.reach,
        r.digital.impressions,
        r.digital.avgFrequency,
        r.combined.overlapPct,
      ],
      ['TV', r.tv.reachPct, r.tv.reach, r.tv.impressions, r.tv.avgFrequency, r.combined.overlapPct],
      [
        'Combined',
        r.combined.uniqueReachPct,
        r.combined.uniqueReach,
        r.digital.impressions + r.tv.impressions,
        '',
        '',
      ],
    ].map((l) => l.join(','));
    const url = URL.createObjectURL(
      new Blob([`${lines.join('\r\n')}\r\n`], { type: 'text/csv;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `cross-media-reach-${report.publicId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }} data-testid="cross-media-detail">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ minWidth: 280 }}>
          {report.canWrite ? (
            <DvInlineEdit
              label="Report name"
              value={name}
              onCommit={rename}
              validate={(v) => (v.trim() ? undefined : 'Enter a value')}
            />
          ) : (
            <Typography variant="h5" component="h2">
              {name}
            </Typography>
          )}
        </Box>
        <DvStatusChip kind="new" label={report.currency.code} />
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          {report.country} -{' '}
          {report.scope === 'NATIONAL'
            ? 'National'
            : `Sub-location (${report.subLocations.join(', ')})`}
          {' - '}
          {fmtDate(report.window.from)} to {fmtDate(report.window.to)}
        </Typography>
        <Button variant="outlined" disabled={!r} onClick={csv}>
          Download CSV
        </Button>
        <Button
          variant="outlined"
          color="error"
          disabled={!report.canWrite || busy}
          onClick={() => setConfirm(true)}
        >
          Delete report
        </Button>
      </Box>

      {report.status === 'PROCESSING' ? (
        <DvBanner kind="info" level="inline">
          Processing your report.
        </DvBanner>
      ) : null}
      {report.status === 'FAILED' || !r ? (
        <DvBanner kind="error" level="inline">
          The report could not be calculated.
        </DvBanner>
      ) : (
        <>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Card
              title="Digital"
              rows={[
                ['Reach', fmtPct(r.digital.reachPct)],
                ['Impressions', fmtCompact(r.digital.impressions)],
                ['Avg. frequency', r.digital.avgFrequency.toFixed(2)],
              ]}
            />
            <Card
              title="TV"
              rows={[
                ['Reach', fmtPct(r.tv.reachPct)],
                ['GRPs', String(r.tv.grps)],
                ['Avg. frequency', r.tv.avgFrequency.toFixed(2)],
              ]}
            />
            <Card
              title="Combined"
              rows={[
                ['Unique reach', fmtPct(r.combined.uniqueReachPct)],
                ['Overlap', fmtPct(r.combined.overlapPct)],
                ['Incremental reach of TV', fmtPct(r.combined.incrementalTvPct)],
                ['Incremental reach of digital', fmtPct(r.combined.incrementalDigitalPct)],
              ]}
            />
          </Box>
          <Table size="small" aria-label="Reach by medium" data-testid="cross-media-table">
            <TableHead>
              <TableRow>
                {[
                  'Medium',
                  'Reach %',
                  'Reach (people)',
                  'Impressions',
                  'Avg. frequency',
                  'Overlap with the other medium',
                ].map((h) => (
                  <TableCell key={h} sx={{ fontWeight: 500 }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {[
                [
                  'Digital',
                  r.digital.reachPct,
                  r.digital.reach,
                  r.digital.impressions,
                  r.digital.avgFrequency,
                ],
                ['TV', r.tv.reachPct, r.tv.reach, r.tv.impressions, r.tv.avgFrequency],
              ].map(([m, pct, people, impr, f]) => (
                <TableRow key={String(m)}>
                  <TableCell>{m}</TableCell>
                  <TableCell>{fmtPct(Number(pct))}</TableCell>
                  <TableCell>{fmtCompact(Number(people))}</TableCell>
                  <TableCell>{fmtCompact(Number(impr))}</TableCell>
                  <TableCell>{Number(f).toFixed(2)}</TableCell>
                  <TableCell>{fmtPct(r.combined.overlapPct)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {report.ioNames.length || report.tvNames.length ? (
            <Typography variant="caption" color="text.secondary">
              Insertion orders: {report.ioNames.join(', ') || 'none'}. TV campaigns:{' '}
              {report.tvNames.join(', ') || 'none'}.
            </Typography>
          ) : null}
        </>
      )}
      <DvModal
        open={confirm}
        title="Delete report?"
        size="sm"
        onClose={() => setConfirm(false)}
        primary={{ label: 'Delete', tone: 'danger', loading: busy, onClick: remove }}
        secondary={{ label: 'Cancel', onClick: () => setConfirm(false) }}
      >
        <Typography>{name} will be deleted. This can&apos;t be undone.</Typography>
      </DvModal>
    </Box>
  );
}
