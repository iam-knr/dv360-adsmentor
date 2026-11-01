import Image from 'next/image';
import Box from '@mui/material/Box';

/** Natural size of public/brand/dv360-logo.png (the owner's image cropped to its visible area; original in docs/brand). */
const LOGO_W = 352;
const LOGO_H = 111;

export interface BrandLogoProps {
  /** Height of the DV360 mark in px; the word and the small line scale with it. */
  height?: number;
  /** Alt text of the mark; pass '' when the surrounding link already has an aria-label. */
  alt?: string;
}

/**
 * The product lockup: the DV360 logo, the word "Simulator" next to it and a small "by Adsmetor" below
 * (owner decision 31 Oct: the DV360 mark replaces the Adsmetor logo in the header; Adsmetor stays as the byline).
 */
export function BrandLogo({ height = 32, alt = 'DV360 Simulator by Adsmetor' }: BrandLogoProps) {
  const width = Math.round((height * LOGO_W) / LOGO_H);
  return (
    <Box
      component="span"
      data-testid="brand-logo"
      sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}
    >
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
        <Image
          src="/brand/dv360-logo.png"
          alt={alt}
          width={width}
          height={height}
          priority
          unoptimized
          style={{ height, width: 'auto', display: 'block' }}
        />
        <Box
          component="span"
          aria-hidden="true"
          sx={{
            width: '1px',
            height: Math.round(height * 0.65),
            bgcolor: 'divider',
            mx: `${Math.round(height * 0.3)}px`,
          }}
        />
        <Box
          component="span"
          sx={{
            fontSize: Math.round(height * 0.5),
            fontWeight: 500,
            color: 'text.secondary',
            whiteSpace: 'nowrap',
          }}
        >
          Simulator
        </Box>
      </Box>
      <Box
        component="span"
        sx={{
          fontSize: Math.max(8, Math.round(height * 0.27)),
          color: 'text.secondary',
          letterSpacing: 0.3,
          mt: `${Math.max(2, Math.round(height * 0.09))}px`,
          whiteSpace: 'nowrap',
        }}
      >
        by Adsmetor
      </Box>
    </Box>
  );
}
