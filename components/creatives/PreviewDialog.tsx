'use client';

// Preview dialog (module 12 S10). The creative renders in an iframe with an empty `sandbox` attribute and a CSP that
// allows no network, so a pasted third-party tag can never run script or reach the parent page.
import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import { DvModal } from '@/components/dv/DvModal';
import { previewAction, testTagAction } from '@/lib/creatives/actions';
import type { CreativePreview } from '@/lib/creatives/service';

export function PreviewFrame({
  srcDoc,
  width,
  height,
  title,
}: {
  srcDoc: string;
  width: number;
  height: number;
  title: string;
}) {
  return (
    <Box
      component="iframe"
      title={title}
      sandbox=""
      srcDoc={srcDoc}
      referrerPolicy="no-referrer"
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        width: Math.min(width, 640),
        height: Math.min(height, 480),
        maxWidth: '100%',
        bgcolor: '#fff',
      }}
    />
  );
}

export function PreviewDialog({
  open,
  advertiserId,
  creativeId,
  tag,
  title,
  onClose,
}: {
  open: boolean;
  advertiserId: string;
  /** A stored creative to preview, or `tag` to test a pasted third-party tag. */
  creativeId?: string;
  tag?: string;
  title: string;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<CreativePreview | null>(null);
  useEffect(() => {
    if (!open) return;
    let live = true;
    setPreview(null);
    void (async () => {
      if (tag !== undefined) {
        const { html } = await testTagAction(tag);
        if (live) setPreview({ kind: 'IFRAME', srcDoc: html, width: 300, height: 250 });
      } else if (creativeId) {
        const p = await previewAction(advertiserId, creativeId);
        if (live) setPreview(p);
      }
    })();
    return () => {
      live = false;
    };
  }, [open, advertiserId, creativeId, tag]);
  return (
    <DvModal
      open={open}
      title={title}
      size="md"
      primary={{ label: 'Close', onClick: onClose }}
      onClose={onClose}
    >
      {preview?.srcDoc ? (
        <PreviewFrame
          srcDoc={preview.srcDoc}
          width={preview.width}
          height={preview.height}
          title={title}
        />
      ) : (
        <Box role="status">Loading preview…</Box>
      )}
    </DvModal>
  );
}
