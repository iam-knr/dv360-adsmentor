'use client';

// Date range dropdown of the Campaigns and Insertion orders lists (fidelity audit CAM-005, CAM-034): the trigger shows
// the dates ("Oct 31, 2026"); the popover has the real preset list (Custom, Today, Yesterday, Last 7 days, Last 14
// days, Last 30 days, Month to date, Quarter to date, Year to date, Lifetime, "n days up to today", "n days up to
// yesterday"), start and end fields and a two-month calendar. `today` is the SIM date, so "Today" and every relative
// preset follow the simulator clock. The value travels as the `d` list param (routes.md 6.1).
import { useMemo } from 'react';
import { DvDateRange } from './DvDateRange';
import { paramFromValue, rangeText, valueFromParam } from './date-param';
import { PRESET_SETS, type DateRangeValue } from './date-presets';

export interface DvDatePresetRangeProps {
  /** Current `d` param (token, `nD_TODAY` or `YYYYMMDD:YYYYMMDD`). */
  d: string | null;
  /** Sim date, `YYYY-MM-DD`, in the advertiser time zone. */
  today: string;
  onChange: (d: string, value: DateRangeValue) => void;
}

export function DvDatePresetRange({ d, today, onChange }: DvDatePresetRangeProps) {
  const value = useMemo(() => valueFromParam(d, today), [d, today]);
  const todayDate = useMemo(() => {
    const [y, m, day] = today.split('-').map(Number);
    return new Date(y ?? 1970, (m ?? 1) - 1, day ?? 1);
  }, [today]);
  return (
    <DvDateRange
      value={value}
      presets={[...PRESET_SETS.grid]}
      today={todayDate}
      triggerText={rangeText(value)}
      onChange={(v) => onChange(paramFromValue(v), v)}
    />
  );
}
