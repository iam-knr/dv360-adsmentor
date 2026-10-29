'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { DvEmptyState } from '@/components/dv';
import type { FloodlightHistoryRow } from '@/lib/resources/history';
import { FloodlightShell } from './FloodlightConversions';

export function FloodlightHistory({
  partnerId,
  advertiserId,
  rows,
}: {
  partnerId: string;
  advertiserId: string;
  rows: FloodlightHistoryRow[];
}) {
  return (
    <FloodlightShell partnerId={partnerId} advertiserId={advertiserId} tab="history">
      {rows.length === 0 ? (
        <DvEmptyState message="No changes yet" />
      ) : (
        <Box
          component="table"
          aria-label="Floodlight history"
          sx={{ width: '100%', borderCollapse: 'collapse' }}
        >
          <thead>
            <tr>
              <th align="left">Date</th>
              <th align="left">Changed by</th>
              <th align="left">Item</th>
              <th align="left">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.when.slice(0, 16).replace('T', ' ')}</td>
                <td>{r.who}</td>
                <td>
                  {r.entity}: {r.name}
                </td>
                <td>
                  <Typography variant="body2">{r.summary}</Typography>
                  {r.entries.map((e, i) => (
                    <Typography key={i} variant="caption" component="div">
                      {e.label}: {e.oldValue ?? '-'} to {e.newValue ?? '-'}
                    </Typography>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </Box>
      )}
    </FloodlightShell>
  );
}
