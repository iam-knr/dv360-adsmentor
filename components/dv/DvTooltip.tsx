'use client';

import { useId, useState, type ReactElement, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Popover from '@mui/material/Popover';
import Tooltip, { type TooltipProps } from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { DvIcon } from '@/components/icons';

export interface DvTooltipProps extends Omit<TooltipProps, 'children' | 'arrow'> {
  children: ReactElement;
}

/** Dark tooltip, 500 ms hover delay, shows on keyboard focus, Esc hides (design-system 2.19). */
export function DvTooltip({ children, ...rest }: DvTooltipProps) {
  return (
    <Tooltip {...rest} arrow={false}>
      {children}
    </Tooltip>
  );
}

export interface DvHoverDetailProps {
  detail: ReactNode;
  children: ReactNode;
}

/** Dotted-underline text whose extra detail appears in a tooltip (for example "Servable (1 of 2)"). */
export function DvHoverDetail({ detail, children }: DvHoverDetailProps) {
  return (
    <DvTooltip title={detail}>
      <Box
        component="span"
        tabIndex={0}
        sx={{
          borderBottomWidth: '1px',
          borderBottomStyle: 'dotted',
          borderBottomColor: 'text.secondary',
          cursor: 'help',
        }}
      >
        {children}
      </Box>
    </DvTooltip>
  );
}

export interface DvHelpProps {
  /** One to three short lines. */
  children: ReactNode;
  learnMoreHref?: string;
  label?: string;
}

/** `help` icon that opens a small card with a Learn more link. Focus returns to the icon on close. */
export function DvHelp({ children, learnMoreHref, label = 'Help' }: DvHelpProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const id = useId();
  return (
    <>
      <IconButton
        size="small"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={anchor ? true : undefined}
        aria-controls={anchor ? id : undefined}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ p: 0.5 }}
      >
        <DvIcon name="help" size={18} />
      </IconButton>
      <Popover
        id={id}
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { maxWidth: 320, p: 3 } } }}
      >
        <Typography variant="body1" component="div">
          {children}
        </Typography>
        {learnMoreHref ? (
          <Link
            href={learnMoreHref}
            target="_blank"
            rel="noreferrer"
            sx={{ mt: 2, display: 'inline-flex', gap: 1, alignItems: 'center' }}
          >
            Learn more
            <DvIcon name="open_in_new" size={16} />
          </Link>
        ) : null}
      </Popover>
    </>
  );
}
