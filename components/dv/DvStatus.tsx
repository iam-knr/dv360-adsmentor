'use client';

import { useState, type MouseEvent } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import type { DvIconName } from '@/components/icons';
import { DvIcon } from '@/components/icons';
import { DvTooltip } from './DvTooltip';

export type EntityStatus = 'active' | 'paused' | 'draft' | 'archived' | 'scheduledForDeletion';
export type DvStatus = EntityStatus | 'completed' | 'notServable' | 'pending' | 'trafficked';

interface StatusMeta {
  label: string;
  icon: DvIconName;
  color: string;
  filled: boolean;
  size: number;
}

/** Dot shapes and colours of design-system 2.9. Shape differs per status so colour is never the only cue. */
export const STATUS_META: Record<DvStatus, StatusMeta> = {
  active: { label: 'Active', icon: 'circle', color: 'status.active', filled: true, size: 12 },
  paused: { label: 'Paused', icon: 'pause_circle', color: 'status.paused', filled: true, size: 20 },
  draft: {
    label: 'Draft',
    icon: 'radio_button_unchecked',
    color: 'status.draft',
    filled: false,
    size: 20,
  },
  archived: { label: 'Archived', icon: 'archive', color: 'status.paused', filled: false, size: 20 },
  scheduledForDeletion: {
    label: 'Scheduled for deletion',
    icon: 'delete',
    color: 'status.error',
    filled: false,
    size: 20,
  },
  completed: {
    label: 'Completed',
    icon: 'check_circle',
    color: 'status.active',
    filled: true,
    size: 20,
  },
  notServable: {
    label: 'Not servable',
    icon: 'cancel',
    color: 'status.error',
    filled: true,
    size: 20,
  },
  pending: { label: 'Pending', icon: 'schedule', color: 'status.warning', filled: false, size: 20 },
  trafficked: {
    label: 'Trafficked',
    icon: 'check_circle',
    color: 'status.info',
    filled: false,
    size: 20,
  },
};

export interface DvStatusDotProps {
  status: DvStatus;
  /** Overrides the word used for the tooltip and aria-label. */
  label?: string;
}

/** Status column icon (20 px box). Carries `aria-label` and a tooltip with the status word. */
export function DvStatusDot({ status, label }: DvStatusDotProps) {
  const meta = STATUS_META[status];
  const text = label ?? meta.label;
  return (
    <DvTooltip title={text}>
      <Box
        component="span"
        role="img"
        aria-label={text}
        data-status={status}
        sx={{
          display: 'inline-flex',
          width: 20,
          height: 20,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <DvIcon name={meta.icon} size={meta.size} filled={meta.filled} color={meta.color} />
      </Box>
    </DvTooltip>
  );
}

export type DvStatusChipKind =
  | 'servable'
  | 'pending'
  | 'disapproved'
  | 'completed'
  | 'failed'
  | 'limitedAccess'
  | 'recommended'
  | 'beta'
  | 'new'
  | 'alpha';

interface ChipMeta {
  label: string;
  icon?: DvIconName;
  bg?: string;
  fg: string;
  border?: string;
}

const CHIP_META: Record<DvStatusChipKind, ChipMeta> = {
  servable: { label: 'Servable', icon: 'check', bg: 'banner.success.bg', fg: 'statusText.active' },
  pending: {
    label: 'Pending',
    icon: 'schedule',
    bg: 'banner.warning.bg',
    fg: 'statusText.warning',
  },
  disapproved: {
    label: 'Disapproved',
    icon: 'close',
    bg: 'banner.error.bg',
    fg: 'statusText.error',
  },
  completed: {
    label: 'Completed',
    icon: 'check',
    bg: 'banner.success.bg',
    fg: 'statusText.active',
  },
  failed: { label: 'Failed', icon: 'close', bg: 'banner.error.bg', fg: 'statusText.error' },
  limitedAccess: { label: 'Limited Access', bg: 'surface.sunken', fg: 'text.secondary' },
  recommended: { label: 'Recommended', bg: 'banner.success.bg', fg: 'statusText.active' },
  beta: { label: 'Beta', fg: 'primary.main', border: 'primary.main' },
  new: { label: 'New', fg: 'primary.main', border: 'primary.main' },
  alpha: { label: 'Alpha', fg: 'primary.main', border: 'primary.main' },
};

const TAG_KINDS: DvStatusChipKind[] = ['beta', 'new', 'alpha'];

export interface DvStatusChipProps {
  kind: DvStatusChipKind;
  label?: string;
}

/** 24 px review/status chip, or an 18 px BETA / NEW / ALPHA tag (design-system 2.9). */
export function DvStatusChip({ kind, label }: DvStatusChipProps) {
  const meta = CHIP_META[kind];
  const tag = TAG_KINDS.includes(kind);
  return (
    <Box
      component="span"
      data-kind={kind}
      sx={[
        {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1,
          height: tag ? 18 : 24,
          px: tag ? 1.5 : 2,
          borderRadius: tag ? '9px' : '16px',
          bgcolor: meta.bg,
          color: meta.fg,
          border: meta.border ? '1px solid' : undefined,
          borderColor: meta.border,
          whiteSpace: 'nowrap',
        },
        tag ? { typography: 'badge' } : { typography: 'caption', color: meta.fg, fontWeight: 500 },
      ]}
    >
      {meta.icon ? <DvIcon name={meta.icon} size={16} /> : null}
      {label ?? meta.label}
    </Box>
  );
}

export interface DvStatusSelectProps {
  value: EntityStatus;
  options: EntityStatus[];
  onChange: (v: EntityStatus) => void;
  disabled?: boolean;
  /** Accessible name. Default "Status". */
  label?: string;
}

/** Outlined 28 px chip-button: dot, word, caret. Menu lists the allowed statuses (design-system 2.9). */
export function DvStatusSelect({
  value,
  options,
  onChange,
  disabled,
  label = 'Status',
}: DvStatusSelectProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const meta = STATUS_META[value];
  // The caller decides the order: Draft, Active for new entities; Active, Paused for existing ones.
  const ordered = options;
  const open = (e: MouseEvent<HTMLElement>) => setAnchor(e.currentTarget);
  return (
    <>
      <Button
        variant="outlined"
        size="small"
        disabled={disabled}
        onClick={open}
        aria-haspopup="menu"
        aria-expanded={anchor ? true : undefined}
        aria-label={`${label}: ${meta.label}`}
        sx={{ color: 'text.primary', gap: 1, borderRadius: '16px', pr: 1 }}
      >
        <DvIcon
          name={meta.icon}
          size={meta.size === 12 ? 12 : 16}
          filled={meta.filled}
          color={meta.color}
        />
        {meta.label}
        <DvIcon name="arrow_drop_down" size={20} />
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {ordered.map((o) => (
          <MenuItem
            key={o}
            selected={o === value}
            onClick={() => {
              setAnchor(null);
              if (o !== value) onChange(o);
            }}
            sx={{ gap: 2 }}
          >
            <DvIcon
              name={STATUS_META[o].icon}
              size={STATUS_META[o].size === 12 ? 12 : 16}
              filled={STATUS_META[o].filled}
              color={STATUS_META[o].color}
            />
            {STATUS_META[o].label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
