'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListSubheader from '@mui/material/ListSubheader';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { DvIcon, type DvIconName } from '@/components/icons';
import { DvTooltip } from './DvTooltip';

export interface BulkMenuItem {
  id: string;
  label: string;
  /** Leading icon (a DvIcon name), like the real DV360 status menu. */
  icon?: string;
  /** Icon colour as a theme palette path, for example `status.active`. */
  iconColor?: string;
  /** Bold label (the real DV360 "Activate" item). */
  emphasis?: boolean;
  /** Shortcut hint such as "⌘+D". */
  shortcut?: string;
  disabled?: boolean;
  /** Tooltip explaining why the item does not apply. */
  disabledReason?: string;
  children?: BulkMenuItem[];
}

export interface BulkMenuGroup {
  label: string;
  items: BulkMenuItem[];
}

export interface DvBulkBarProps {
  count: number;
  groups: BulkMenuGroup[];
  onAction: (id: string) => void;
  onClear: () => void;
  /** Optional "Segment by" control placed after Action. */
  segmentBy?: React.ReactNode;
}

export function selectedText(count: number): string {
  return `${count} ${count === 1 ? 'row' : 'rows'} selected`;
}

/** Blue bar that replaces the toolbar while rows are selected (design-system 2.5). */
export function DvBulkBar({ count, groups, onAction, onClear, segmentBy }: DvBulkBarProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [sub, setSub] = useState<{ id: string; anchor: HTMLElement } | null>(null);
  if (count < 1) return null;

  const close = () => {
    setSub(null);
    setAnchor(null);
  };
  const run = (id: string) => {
    close();
    onAction(id);
  };

  const renderItem = (item: BulkMenuItem) => {
    const row = (
      <MenuItem
        key={item.id}
        disabled={item.disabled}
        aria-haspopup={item.children ? 'menu' : undefined}
        onClick={(e) =>
          item.children ? setSub({ id: item.id, anchor: e.currentTarget }) : run(item.id)
        }
        onKeyDown={(e) => {
          if (item.children && e.key === 'ArrowRight')
            setSub({ id: item.id, anchor: e.currentTarget });
        }}
        sx={{ justifyContent: 'space-between', gap: 6 }}
      >
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          {item.icon ? (
            <DvIcon
              name={item.icon as DvIconName}
              size={20}
              color={item.disabled ? undefined : item.iconColor}
            />
          ) : null}
          <span style={item.emphasis ? { fontWeight: 700 } : undefined}>{item.label}</span>
        </Box>
        {item.shortcut ? (
          <Typography variant="caption" component="span">
            {item.shortcut}
          </Typography>
        ) : item.children ? (
          <DvIcon name="chevron_right" size={20} />
        ) : null}
      </MenuItem>
    );
    return item.disabled && item.disabledReason ? (
      <DvTooltip key={item.id} title={item.disabledReason}>
        <span>{row}</span>
      </DvTooltip>
    ) : (
      row
    );
  };

  const subItem = sub ? groups.flatMap((g) => g.items).find((i) => i.id === sub.id) : undefined;

  return (
    <Box
      role="toolbar"
      aria-label="Bulk actions"
      sx={{
        height: 56,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        px: 4,
        bgcolor: 'primary.main',
        color: 'common.white',
        zIndex: (t) => t.zIndex.bulkBar,
        '& :focus-visible': {
          outline: '2px solid',
          outlineColor: 'common.white',
          outlineOffset: 2,
        },
      }}
    >
      <Typography variant="subtitle1" component="span" role="status" sx={{ color: 'inherit' }}>
        {selectedText(count)}
      </Typography>
      <Button
        variant="outlined"
        aria-haspopup="menu"
        aria-expanded={anchor ? true : undefined}
        onClick={(e) => setAnchor(e.currentTarget)}
        endIcon={<DvIcon name="arrow_drop_down" size={20} />}
        sx={{
          color: 'common.white',
          borderColor: 'common.white',
          '&:hover': { borderColor: 'common.white', bgcolor: 'primary.dark' },
        }}
      >
        Action
      </Button>
      {segmentBy}
      <Box sx={{ flex: 1 }} />
      <DvTooltip title="Clear selection">
        <IconButton
          aria-label="Clear selection"
          onClick={onClear}
          sx={{ color: 'common.white', '&:hover': { bgcolor: 'primary.dark' } }}
        >
          <DvIcon name="close" size={24} />
        </IconButton>
      </DvTooltip>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        slotProps={{ paper: { sx: { minWidth: 260 } } }}
      >
        {groups.flatMap((g, i) => [
          ...(i > 0 ? [<Divider component="li" key={`${g.label}-divider`} />] : []),
          <ListSubheader
            key={`${g.label}-header`}
            sx={{ typography: 'subtitle2', color: 'text.secondary', lineHeight: '32px' }}
          >
            {g.label}
          </ListSubheader>,
          ...g.items.map(renderItem),
        ])}
      </Menu>
      <Menu
        anchorEl={sub?.anchor}
        open={Boolean(sub && subItem?.children)}
        onClose={() => setSub(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {subItem?.children?.map(renderItem)}
      </Menu>
    </Box>
  );
}
