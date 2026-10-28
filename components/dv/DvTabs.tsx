'use client';

import type { ReactNode, SyntheticEvent } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { DvIcon } from '@/components/icons';
import { DvStatusChip } from './DvStatus';

export interface DvTabItem {
  id: string;
  label: string;
  /** Shown in parentheses: "Assigned (3)". */
  count?: number;
  /** Pin icon marks the default tab. */
  pinned?: boolean;
  badge?: 'NEW';
  disabled?: boolean;
}

export interface DvTabsProps {
  tabs: DvTabItem[];
  value: string;
  onChange: (id: string) => void;
  /** page: under the title. card: 40 px inside a card or slide-over. segmented and chips as in 2.17. */
  variant?: 'page' | 'card' | 'segmented' | 'chips';
  ariaLabel?: string;
}

function tabLabel(t: DvTabItem): ReactNode {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
      {t.pinned ? <DvIcon name="push_pin" size={16} /> : null}
      {t.label}
      {t.count !== undefined ? ` (${t.count})` : null}
      {t.badge ? <DvStatusChip kind="new" /> : null}
    </Box>
  );
}

/** Underline tabs, segmented toggle or chip tabs (design-system 2.17). Arrow keys, Home and End move; activation follows focus. */
export function DvTabs({ tabs, value, onChange, variant = 'page', ariaLabel }: DvTabsProps) {
  if (variant === 'segmented') {
    return (
      <ToggleButtonGroup
        exclusive
        size="small"
        value={value}
        aria-label={ariaLabel}
        onChange={(_e, next: string | null) => {
          if (next) onChange(next);
        }}
        sx={{ '& .MuiToggleButton-root': { height: 32, textTransform: 'none', px: 3 } }}
      >
        {tabs.map((t) => (
          <ToggleButton key={t.id} value={t.id} disabled={t.disabled}>
            {t.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    );
  }
  if (variant === 'chips') {
    return (
      <Box role="group" aria-label={ariaLabel} sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {tabs.map((t) => {
          const selected = t.id === value;
          return (
            <Chip
              key={t.id}
              label={t.label}
              clickable
              disabled={t.disabled}
              aria-pressed={selected}
              icon={selected ? <DvIcon name="check" size={16} /> : undefined}
              onClick={() => onChange(t.id)}
              sx={selected ? { bgcolor: 'primary.light', color: 'primary.main' } : undefined}
            />
          );
        })}
      </Box>
    );
  }
  return (
    <Tabs
      value={value}
      onChange={(_e: SyntheticEvent, next: string) => onChange(next)}
      variant="scrollable"
      scrollButtons="auto"
      selectionFollowsFocus
      aria-label={ariaLabel}
      sx={variant === 'card' ? { minHeight: 40, '& .MuiTab-root': { minHeight: 40 } } : undefined}
    >
      {tabs.map((t) => (
        <Tab key={t.id} value={t.id} label={tabLabel(t)} disabled={t.disabled} />
      ))}
    </Tabs>
  );
}
