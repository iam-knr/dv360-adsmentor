'use client';

// Summary strip and tabs of the creative page (module 12 S3 to S5): Creative details · Creative status · History.
// Tabs are path segments (RT R3), so each is its own route and the browser Back button works.
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { DvTabs } from '@/components/dv/DvTabs';
import { confirmLeave } from '@/lib/hooks/useUnsavedGuard';
import { creativePath, type CreativeTab } from '@/lib/creatives/paths';
import type { CreativeRow } from '@/lib/creatives/types';

const TABS = [
  { id: 'details', label: 'Creative details' },
  { id: 'status', label: 'Creative status' },
  { id: 'history', label: 'History' },
];

export function CreativeHeader({
  partnerId,
  advertiserId,
  row,
  active,
}: {
  partnerId: string;
  advertiserId: string;
  row: CreativeRow;
  active: CreativeTab;
}) {
  const router = useRouter();
  const facts: [string, string][] = [
    [
      'Status',
      row.status === 'ACTIVE' ? 'Active' : row.status === 'PAUSED' ? 'Paused' : 'Archived',
    ],
    ['ID', row.publicId],
    ...(row.cm360Id ? ([['CM360 ID', row.cm360Id]] as [string, string][]) : []),
    ['Type', row.type],
    ['Format', row.format],
    ['Dimensions', row.dimensions ?? '-'],
    ['Source', row.source],
  ];
  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 4, mb: 2 }} aria-label="Creative summary">
        {facts.map(([k, v]) => (
          <Box key={k}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {k}
            </Typography>
            <Typography variant="body2">{v}</Typography>
          </Box>
        ))}
      </Box>
      <DvTabs
        tabs={TABS}
        value={active}
        ariaLabel="Creative"
        onChange={(id) =>
          confirmLeave(() =>
            router.push(creativePath(partnerId, advertiserId, row.publicId, id as CreativeTab)),
          )
        }
      />
    </Box>
  );
}
