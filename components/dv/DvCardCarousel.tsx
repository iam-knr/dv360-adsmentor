'use client';

import { useRef } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { DvIcon } from '@/components/icons';

export type CarouselFamily = 'basic' | 'reach' | 'video';

export interface CarouselCard {
  id: string;
  name: string;
  /** Colours the 4 px top border: BASIC blue, REACH green, VIDEO purple. */
  family?: CarouselFamily;
  /** "Last modified: Oct 12, 2026". */
  meta?: string;
  description?: string;
}

export interface DvCardCarouselProps {
  cards: CarouselCard[];
  onApply?: (id: string) => void;
  onView?: (id: string) => void;
  ariaLabel: string;
}

/** Scrolling row of template cards with a coloured top border (design-system 2.20). */
export function DvCardCarousel({ cards, onApply, onView, ariaLabel }: DvCardCarouselProps) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * 280, behavior: 'smooth' });
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <IconButton aria-label="Previous cards" onClick={() => scroll(-1)}>
        <DvIcon name="chevron_left" size={24} />
      </IconButton>
      <Box
        ref={ref}
        role="list"
        aria-label={ariaLabel}
        sx={{ display: 'flex', gap: 4, overflowX: 'auto', flex: 1, py: 1 }}
      >
        {cards.map((c) => (
          <Box
            role="listitem"
            key={c.id}
            sx={(t) => ({
              width: 256,
              flexShrink: 0,
              p: 4,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              borderTop: `4px solid ${c.family ? t.palette.chart[{ basic: 0, reach: 1, video: 4 }[c.family]] : t.palette.primary.main}`,
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            })}
          >
            <Typography variant="subtitle1" component="h3">
              {c.name}
            </Typography>
            {c.meta ? <Typography variant="caption">{c.meta}</Typography> : null}
            {c.description ? <Typography variant="body2">{c.description}</Typography> : null}
            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <Button size="small" variant="outlined" onClick={() => onApply?.(c.id)}>
                Apply template
              </Button>
              <Button size="small" onClick={() => onView?.(c.id)}>
                View
              </Button>
            </Box>
          </Box>
        ))}
      </Box>
      <IconButton aria-label="Next cards" onClick={() => scroll(1)}>
        <DvIcon name="chevron_right" size={24} />
      </IconButton>
    </Box>
  );
}
