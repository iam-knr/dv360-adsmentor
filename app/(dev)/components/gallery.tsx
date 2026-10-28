'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { DvToastProvider } from '@/components/dv';
import { GALLERY_ENTRIES, GalleryEntryFrame } from './entries';

/** Every shared component with the variants its spec lists (build-plan 4.2, item 6). */
export function Gallery() {
  return (
    <DvToastProvider>
      <Box component="main" sx={{ p: 6, maxWidth: 1280, mx: 'auto' }}>
        <Typography variant="pageTitle" component="h1" sx={{ mb: 2 }}>
          Component gallery
        </Typography>
        <Typography variant="body2" sx={{ mb: 6 }}>
          DV360 Simulator by Adsmetor shared UI kit. Preview and development only.
        </Typography>
        <Box
          component="nav"
          aria-label="Gallery sections"
          sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 6 }}
        >
          {GALLERY_ENTRIES.map((e) => (
            <a key={e.id} href={`#${e.id}`}>
              {e.title}
            </a>
          ))}
        </Box>
        {GALLERY_ENTRIES.map(({ id, title, Demo }) => (
          <GalleryEntryFrame key={id} id={id} title={title}>
            <Demo />
          </GalleryEntryFrame>
        ))}
      </Box>
    </DvToastProvider>
  );
}
