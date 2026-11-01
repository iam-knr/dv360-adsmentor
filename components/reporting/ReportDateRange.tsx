'use client';

// Thin date range control of the reporting builders (audit REP-014/022). Shows `Date range: Oct 25 – 31, 2026` and opens
// the preset list. It keeps the report's token syntax (`LAST_7_DAYS` or `YYYYMMDD:YYYYMMDD`). Swap for the shared
// `DvDatePresetRange` once it lands in components/dv.
import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { DvIcon } from '@/components/icons';
import { parseDateRangeParam } from '@/lib/metrics/date-range';
import { formatRange } from '@/lib/reporting/format';

export const RANGE_PRESETS = [
  ['YESTERDAY', 'Yesterday'],
  ['LAST_7_DAYS', 'Last 7 days'],
  ['LAST_14_DAYS', 'Last 14 days'],
  ['LAST_30_DAYS', 'Last 30 days'],
  ['MONTH_TO_DATE', 'Month to date'],
  ['LAST_MONTH', 'Last month'],
  ['QUARTER_TO_DATE', 'Quarter to date'],
  ['YEAR_TO_DATE', 'Year to date'],
  ['LAST_2_YEARS', 'Last 2 years'],
] as const;

const CUSTOM = /^(\d{4})(\d{2})(\d{2}):(\d{4})(\d{2})(\d{2})$/;
const compact = (iso: string) => iso.replace(/-/g, '');
const iso = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;

export function resolveRange(range: string, today: string): { from: string; to: string } | null {
  try {
    return parseDateRangeParam(range, today);
  } catch {
    return null;
  }
}

export function presetLabel(range: string): string {
  return RANGE_PRESETS.find(([v]) => v === range)?.[1] ?? 'Custom';
}

export function ReportDateRange({
  value,
  today,
  disabled,
  onChange,
}: {
  value: string;
  today: string;
  disabled?: boolean;
  onChange: (range: string) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const r = resolveRange(value, today);
  const custom = CUSTOM.exec(value);
  const [cFrom, cTo] = custom ? [iso(`${custom[1]}${custom[2]}${custom[3]}`), iso(`${custom[4]}${custom[5]}${custom[6]}`)] : ['', ''];
  return (
    <>
      <Button
        aria-label="Date range"
        aria-haspopup="menu"
        disabled={disabled}
        onClick={(e) => setAnchor(e.currentTarget)}
        endIcon={<DvIcon name="expand_more" />}
        data-testid="range-button"
      >
        <span data-testid="range-text">Date range: {r ? formatRange(r.from, r.to) : ''}</span>
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {RANGE_PRESETS.map(([v, label]) => (
          <MenuItem
            key={v}
            selected={value === v}
            onClick={() => {
              setAnchor(null);
              onChange(v);
            }}
          >
            {label}
          </MenuItem>
        ))}
        <MenuItem
          selected={!!custom}
          onClick={() => {
            setAnchor(null);
            onChange(`${compact(today.slice(0, 8))}01:${compact(today)}`);
          }}
        >
          Custom
        </MenuItem>
      </Menu>
      {custom ? (
        <Box sx={{ display: 'inline-flex', gap: 1 }}>
          <input
            aria-label="From date"
            type="date"
            value={cFrom}
            disabled={disabled}
            max={cTo || today}
            onChange={(e) => e.target.value && onChange(`${compact(e.target.value)}:${compact(cTo)}`)}
          />
          <input
            aria-label="To date"
            type="date"
            value={cTo}
            disabled={disabled}
            min={cFrom}
            max={today}
            onChange={(e) => e.target.value && onChange(`${compact(cFrom)}:${compact(e.target.value)}`)}
          />
        </Box>
      ) : null}
    </>
  );
}
