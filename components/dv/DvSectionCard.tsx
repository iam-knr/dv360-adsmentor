'use client';

import { useId, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import { DvIcon } from '@/components/icons';
import { DvHelp } from './DvTooltip';

export interface DvSectionCardProps {
  title?: string;
  description?: string;
  help?: string;
  /** Line at the top of the card with a gear icon: "These settings don't impact serving." */
  gearNote?: string;
  /** `settings`: label column (240) beside the controls (max 640). `stacked`: title above controls. */
  layout?: 'stacked' | 'settings';
  /** Header row with a caret toggles the body. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** White card with 1 px border, radius 8, padding 24 (design-system 2.8.4). */
export function DvSectionCard({
  title,
  description,
  help,
  gearNote,
  layout = 'stacked',
  collapsible,
  defaultOpen = true,
  children,
}: DvSectionCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  const settings = layout === 'settings';
  const heading = (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {title ? (
          <Typography variant="cardTitle" component="h2">
            {title}
          </Typography>
        ) : null}
        {help ? <DvHelp label={`Help: ${title ?? 'section'}`}>{help}</DvHelp> : null}
      </Box>
      {description ? <Typography variant="body2">{description}</Typography> : null}
    </>
  );
  return (
    <Box
      component="section"
      aria-label={title}
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '8px',
        p: 6,
      }}
    >
      {gearNote ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
          <DvIcon name="settings" size={16} color="text.secondary" />
          <Typography variant="caption">{gearNote}</Typography>
        </Box>
      ) : null}
      {collapsible ? (
        <ButtonBase
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={bodyId}
          sx={{
            width: '100%',
            justifyContent: 'space-between',
            textAlign: 'left',
            mb: open ? 4 : 0,
          }}
        >
          <Typography variant="cardTitle" component="h2">
            {title}
          </Typography>
          <DvIcon name={open ? 'expand_less' : 'expand_more'} size={24} />
        </ButtonBase>
      ) : null}
      <Box
        id={bodyId}
        hidden={collapsible && !open}
        sx={
          settings
            ? { display: 'grid', gridTemplateColumns: '240px minmax(0, 640px)', gap: 6 }
            : undefined
        }
      >
        {settings ? (
          <>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {collapsible ? null : heading}
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</Box>
          </>
        ) : (
          <>
            {collapsible ? null : <Box sx={{ mb: 4 }}>{heading}</Box>}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</Box>
          </>
        )}
      </Box>
    </Box>
  );
}
