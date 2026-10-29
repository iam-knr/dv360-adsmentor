'use client';

// Static mock player of the ad preview (module 09 2.6, Δ-09-4): thumbnail, play bar, skip button, ad badge, text per
// format, companion banner slot, Shorts vertical frame and TV frame. No video plays.
import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { DvIcon } from '@/components/icons';
import type { PreviewModel } from '@/lib/youtube/preview';
import type { PreviewDevice } from '@/lib/validation/constants/youtube';

const FRAME_WIDTH: Record<PreviewDevice, number> = { PHONE: 260, COMPUTER: 420, TV: 460 };

export function DvVideoMock({ model }: { model: PreviewModel }) {
  const { frame, selected } = model;
  const format = selected.format;
  const vertical = format === 'SHORTS' || frame.orientation === 'VERTICAL';
  const width = vertical ? 200 : FRAME_WIDTH[selected.device];
  const text = format === 'IN_FEED' ? (frame.longHeadline ?? frame.headline) : frame.headline;
  return (
    <Box
      data-testid="video-mock"
      aria-label="Ad preview"
      sx={{
        width,
        maxWidth: '100%',
        borderRadius: selected.device === 'TV' ? 1 : 3,
        border: selected.device === 'TV' ? '8px solid' : '1px solid',
        borderColor: selected.device === 'TV' ? 'text.primary' : 'divider',
        overflow: 'hidden',
        bgcolor: 'background.paper',
      }}
    >
      <Box
        sx={{
          position: 'relative',
          aspectRatio: vertical ? '9 / 16' : '16 / 9',
          bgcolor: 'action.disabledBackground',
          backgroundImage: `url(${frame.thumbnailUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          <DvIcon name="play_circle" size={40} />
        </Box>
        <Typography
          variant="caption"
          sx={{
            position: 'absolute',
            left: 8,
            top: 8,
            bgcolor: (t) => alpha(t.palette.common.black, 0.6),
            color: 'common.white',
            px: 1,
            borderRadius: 1,
          }}
        >
          Ad{frame.businessName ? ` · ${frame.businessName}` : ''}
        </Typography>
        {frame.skippableAfterSec ? (
          <Typography
            variant="caption"
            data-testid="mock-skip"
            sx={{
              position: 'absolute',
              right: 8,
              bottom: 16,
              bgcolor: (t) => alpha(t.palette.common.black, 0.7),
              color: 'common.white',
              px: 1,
            }}
          >
            Skip ad in {frame.skippableAfterSec}
          </Typography>
        ) : null}
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 4,
            bgcolor: (t) => alpha(t.palette.common.black, 0.3),
          }}
        >
          <Box sx={{ width: '30%', height: '100%', bgcolor: 'error.main' }} />
        </Box>
      </Box>
      <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        {frame.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={frame.logoUrl} alt="" width={32} height={32} style={{ borderRadius: '50%' }} />
        ) : null}
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap>
            {text || 'Headline'}
          </Typography>
          {frame.description && format === 'IN_FEED' ? (
            <Typography variant="body2" color="text.secondary">
              {frame.description}
            </Typography>
          ) : null}
          {frame.displayUrl ? (
            <Typography variant="caption" color="text.secondary">
              {frame.displayUrl}
            </Typography>
          ) : null}
        </Box>
        {frame.cta ? (
          <Typography
            variant="caption"
            sx={{ ml: 'auto', border: 1, borderColor: 'divider', px: 1, borderRadius: 1 }}
          >
            {frame.cta}
          </Typography>
        ) : null}
      </Box>
      {frame.companionBannerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          data-testid="mock-companion"
          src={frame.companionBannerUrl}
          alt="Companion banner"
          style={{ width: '100%' }}
        />
      ) : null}
      {selected.device === 'TV' ? (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', px: 2, pb: 1 }}
        >
          Use your remote to skip or open the ad
        </Typography>
      ) : null}
    </Box>
  );
}
