'use client';

import { useId, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { DvIcon } from '@/components/icons';
import { sizes, zLayers } from '@/lib/theme/tokens';
import { DvTabs } from './DvTabs';
import { DvTooltip } from './DvTooltip';

export interface DvSlideOverProps {
  open: boolean;
  title: string;
  width?: 'default' | 'wide' | 'xwide';
  tabs?: { id: string; label: string }[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  /** When dirty, a scrim click does nothing. Esc and Cancel still close (validation UC-3). */
  dirty?: boolean;
  onApply?: () => void;
  onCancel: () => void;
  applyLabel?: string;
  onDelete?: () => void;
  /** Nesting level: a slide-over opened from a slide-over adds 1 (z-index +10 per level). */
  level?: number;
  /** Shows the `auto_awesome` icon next to the title. */
  aiHelper?: boolean;
  children: ReactNode;
}

/** Right-anchored panel over a scrim: 64 px header, scrolling body, 64 px footer (design-system 2.10). */
export function DvSlideOver({
  open,
  title,
  width = 'default',
  tabs,
  activeTab,
  onTabChange,
  dirty,
  onApply,
  onCancel,
  applyLabel = 'Apply',
  onDelete,
  level = 0,
  aiHelper,
  children,
}: DvSlideOverProps) {
  const titleId = useId();
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={(_e, reason) => {
        if (reason === 'backdropClick' && dirty) return;
        onCancel();
      }}
      transitionDuration={200}
      sx={{ zIndex: zLayers.slideOver + level * 10 }}
      slotProps={{
        paper: {
          sx: {
            width: `min(${sizes.slideOver[width]}px, 100vw - 72px)`,
            display: 'flex',
            flexDirection: 'column',
          },
          role: 'dialog',
          'aria-modal': true,
          'aria-labelledby': titleId,
        },
      }}
    >
      <Box
        component="header"
        sx={{
          height: 64,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          px: 3,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <DvTooltip title="Close">
          <IconButton aria-label="Close" onClick={onCancel}>
            <DvIcon name="close" size={24} />
          </IconButton>
        </DvTooltip>
        <Typography id={titleId} variant="h6" component="h2" sx={{ flex: 1 }}>
          {title}
        </Typography>
        {aiHelper ? <DvIcon name="auto_awesome" size={20} color="primary.main" /> : null}
      </Box>
      {tabs && activeTab && onTabChange ? (
        <DvTabs
          variant="card"
          tabs={tabs}
          value={activeTab}
          onChange={onTabChange}
          ariaLabel={`${title} sections`}
        />
      ) : null}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 6 }}>{children}</Box>
      <Box
        component="footer"
        sx={{
          height: 64,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          px: 6,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        {onApply ? (
          <Button variant="contained" onClick={onApply}>
            {applyLabel}
          </Button>
        ) : null}
        <Button variant={onApply ? 'text' : 'contained'} onClick={onCancel}>
          Cancel
        </Button>
        <Box sx={{ flex: 1 }} />
        {onDelete ? (
          <DvTooltip title="Delete">
            <IconButton aria-label="Delete" onClick={onDelete}>
              <DvIcon name="delete" size={20} />
            </IconButton>
          </DvTooltip>
        ) : null}
      </Box>
    </Drawer>
  );
}
