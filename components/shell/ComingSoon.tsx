'use client';

// Stub page body (routes.md 9 step 5): the page title (with the Limited Access chip for read-only roles) and a
// "Not built yet" card naming the module that owns the page. The module owner replaces the page file.
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { DvPageHeader } from '@/components/dv';
import { useViewer } from './ViewerProvider';

export interface ComingSoonProps {
  /** Module number, "06" for docs/specs/modules/06-campaigns.md. */
  module: string;
  title?: string;
  /** False inside frames that already show the title (IO and LI tabs, form frames). */
  header?: boolean;
}

export function ComingSoon({ module, title, header = true }: ComingSoonProps) {
  const { viewer } = useViewer();
  return (
    <Box data-testid="coming-soon" data-module={module}>
      {header && title ? <DvPageHeader title={title} limitedAccess={viewer.limitedAccess} /> : null}
      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          bgcolor: 'background.paper',
          p: 6,
          maxWidth: 640,
        }}
      >
        <Typography variant="h5" component="h2">
          Not built yet
        </Typography>
        <Typography variant="body1" sx={{ mt: 2 }}>
          {`This page belongs to module ${module}. It is built in a later session.`}
        </Typography>
      </Box>
    </Box>
  );
}
