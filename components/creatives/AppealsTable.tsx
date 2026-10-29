'use client';

// Appeal history (module 12 S7): "Appeal History" table, empty state "No appeals found", 50 per page.
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { DvPageHeader } from '@/components/dv/DvPageHeader';
import { useViewer } from '@/components/shell/ViewerProvider';
import { creativePath } from '@/lib/creatives/paths';
import type { AppealRow } from '@/lib/creatives/types';
import { AppLink } from '@/lib/routes/AppLink';

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB') : '-');

export function AppealsTable({
  rows,
  total,
  partnerId,
  advertiserId,
}: {
  rows: AppealRow[];
  total: number;
  partnerId: string;
  advertiserId: string;
}) {
  const { viewer } = useViewer();
  return (
    <>
      <DvPageHeader title="Appeal history" limitedAccess={viewer.limitedAccess} />
      <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
        Appeal History
      </Typography>
      {rows.length === 0 ? (
        <Typography sx={{ p: 4 }}>No appeals found</Typography>
      ) : (
        <Box
          component="table"
          aria-label="Appeal History"
          sx={{
            width: '100%',
            borderCollapse: 'collapse',
            '& th, & td': {
              textAlign: 'left',
              p: 1.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
            },
          }}
        >
          <thead>
            <tr>
              <th>Ad or creative appealed</th>
              <th>Campaign impact</th>
              <th>Appeal type</th>
              <th>Inventory</th>
              <th>Policy</th>
              <th>Status</th>
              <th>Created</th>
              <th>Completed</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} data-testid="appeal-row">
                <td>
                  {r.creativePublicId ? (
                    <AppLink
                      href={creativePath(partnerId, advertiserId, r.creativePublicId, 'status')}
                    >
                      {r.name}
                    </AppLink>
                  ) : (
                    r.name
                  )}
                </td>
                <td>{r.campaignImpact}</td>
                <td>{r.appealType}</td>
                <td>{r.inventory}</td>
                <td>{r.policy}</td>
                <td>{r.status}</td>
                <td>{date(r.createdAt)}</td>
                <td>{date(r.completedAt)}</td>
                <td>{r.result}</td>
              </tr>
            ))}
          </tbody>
        </Box>
      )}
      <Typography variant="body2" sx={{ mt: 2, textAlign: 'right' }}>
        Items per page: 50 · {total === 0 ? 0 : 1} - {rows.length} of {total}
      </Typography>
    </>
  );
}
