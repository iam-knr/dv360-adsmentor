'use client';

// The intercepted Settings or Difference route: a slide-over above the report (module 17 S5), "Open in full page" at the
// top. Closing goes back to the report.
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import { DvSlideOver } from '@/components/dv';
import { abDiffPath, abSettingsPath } from '@/lib/experiments/paths';
import type { AbTestView } from '@/lib/experiments/types';
import { AbSettingsBody } from './AbSettings';

export function AbSlidePanel({
  partnerId,
  advertiserId,
  view,
  tab,
}: {
  partnerId: string;
  advertiserId: string;
  view: AbTestView;
  tab: 'settings' | 'diff';
}) {
  const router = useRouter();
  const full = tab === 'settings' ? abSettingsPath(partnerId, advertiserId, view.publicId) : abDiffPath(partnerId, advertiserId, view.publicId);
  return (
    <DvSlideOver open title={view.name} width="xwide" onCancel={() => router.back()}>
      <Box sx={{ mb: 2 }}>
        {/* a plain anchor: the panel and the page share one URL, so the full page needs a document load */}
        <a href={full} data-testid="open-full-page">
          Open in full page
        </a>
      </Box>
      <AbSettingsBody partnerId={partnerId} advertiserId={advertiserId} view={view} initialTab={tab} />
    </DvSlideOver>
  );
}

